import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { SidebarQuickAction, SidebarTab } from "./Sidebar";
import { revealElementVertically } from "./scrollVisibility";
import {
  buildSettingsSearchResults,
  type SettingsSearchResult,
} from "./settingsQuickSwitcherSearch";

const MAX_RECENT_RESULTS = 4;
const RECENT_RESULTS_STORAGE_KEY =
  "mint.settings-quick-switcher.recent-results";

const readRecentKeys = () => {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(RECENT_RESULTS_STORAGE_KEY);
    return stored
      ? stored.split("\n").filter(Boolean).slice(0, MAX_RECENT_RESULTS)
      : [];
  } catch {
    return [];
  }
};

interface UseSettingsQuickSwitcherProps<TTabId extends string> {
  tabs: readonly SidebarTab<TTabId>[];
  activeTab: TTabId;
  isOpen: boolean;
  onClose: () => void;
  onTabChange: (tabId: TTabId, targetId?: string) => void;
  quickActions: readonly SidebarQuickAction<TTabId>[];
  onQuickAction?: (targetId: string) => Promise<void> | void;
}

export const useSettingsQuickSwitcher = <TTabId extends string>({
  tabs,
  activeTab,
  isOpen,
  onClose,
  onTabChange,
  quickActions,
  onQuickAction,
}: UseSettingsQuickSwitcherProps<TTabId>) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [actionError, setActionError] = useState("");
  const [disabledAction, setDisabledAction] =
    useState<SidebarQuickAction<TTabId> | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [recentKeys, setRecentKeys] = useState<string[]>(readRecentKeys);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const resultsId = useId();
  const { normalizedQuery, orderedResults, recentResults, recentResultKeys } =
    useMemo(
      () => buildSettingsSearchResults(tabs, quickActions, query, recentKeys),
      [quickActions, query, recentKeys, tabs],
    );
  const selectedResult = orderedResults[activeIndex];

  useEffect(() => {
    if (!isOpen) return undefined;
    previouslyFocusedElement.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      previouslyFocusedElement.current?.focus();
      previouslyFocusedElement.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActionError("");
    setDisabledAction(null);
    setActiveIndex(
      recentKeys.length > 0
        ? 0
        : Math.max(
            0,
            tabs.findIndex((tab) => tab.id === activeTab),
          ),
    );
    inputRef.current?.focus();
  }, [activeTab, isOpen, recentKeys.length, tabs]);

  useEffect(() => {
    if (!isOpen || !selectedResult) return;
    const results = resultsRef.current;
    const activeOption = results?.querySelector<HTMLElement>(
      ".settings-switcher__option.is-active",
    );
    if (results && activeOption)
      revealElementVertically(results, activeOption, 8);
  }, [isOpen, selectedResult]);

  useEffect(() => {
    try {
      if (recentKeys.length === 0) {
        window.localStorage.removeItem(RECENT_RESULTS_STORAGE_KEY);
      } else {
        window.localStorage.setItem(
          RECENT_RESULTS_STORAGE_KEY,
          recentKeys.join("\n"),
        );
      }
    } catch {
      // Recent navigation is optional; the launcher remains usable without storage.
    }
  }, [recentKeys]);

  const clearActionError = () => {
    setActionError("");
    setDisabledAction(null);
  };

  const rememberResult = (result: SettingsSearchResult<TTabId>) => {
    setRecentKeys((current) =>
      [result.key, ...current.filter((key) => key !== result.key)].slice(
        0,
        MAX_RECENT_RESULTS,
      ),
    );
  };

  const selectResult = async (result: SettingsSearchResult<TTabId>) => {
    if (result.kind === "action") {
      if (result.action.disabled) {
        setDisabledAction(result.action);
        setActionError(
          result.action.disabledReason ?? "この操作は現在利用できません。",
        );
        return;
      }
      if (!onQuickAction || isSelecting) return;
      setIsSelecting(true);
      clearActionError();
      try {
        await onQuickAction(result.action.targetId);
        rememberResult(result);
        onClose();
      } catch (reason) {
        setActionError(
          reason instanceof Error
            ? reason.message
            : "操作を実行できませんでした。",
        );
      } finally {
        setIsSelecting(false);
      }
      return;
    }
    rememberResult(result);
    if (result.kind === "setting")
      onTabChange(result.tab.id, result.item.targetId);
    else onTabChange(result.tab.id);
    onClose();
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusableElements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]):not([tabindex='-1']), input:not([disabled]):not([tabindex='-1'])",
      ) ?? [],
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) return;
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    const move = (nextIndex: number) => {
      event.preventDefault();
      setActiveIndex(nextIndex);
    };
    if (event.key === "Home") return move(0);
    if (event.key === "End")
      return move(Math.max(0, orderedResults.length - 1));
    if (event.key === "PageDown") {
      return move(
        orderedResults.length === 0
          ? 0
          : Math.min(orderedResults.length - 1, activeIndex + 5),
      );
    }
    if (event.key === "PageUp") return move(Math.max(0, activeIndex - 5));
    if (event.key === "ArrowDown") {
      return move(
        orderedResults.length === 0
          ? 0
          : (activeIndex + 1) % orderedResults.length,
      );
    }
    if (event.key === "ArrowUp") {
      return move(
        orderedResults.length === 0
          ? 0
          : (activeIndex - 1 + orderedResults.length) % orderedResults.length,
      );
    }
    if (event.key === "Enter" && selectedResult) {
      event.preventDefault();
      void selectResult(selectedResult);
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    clearActionError();
  };

  const clearQuery = () => {
    handleQueryChange("");
    inputRef.current?.focus();
  };

  const clearRecent = () => {
    setRecentKeys([]);
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  return {
    actionError,
    activeIndex,
    clearQuery,
    clearRecent,
    disabledAction,
    handleDialogKeyDown,
    handleQueryChange,
    handleSearchKeyDown,
    inputRef,
    isSelecting,
    normalizedQuery,
    onMouseEnter: setActiveIndex,
    orderedResults,
    query,
    recentResultKeys,
    recentResults,
    resultsId,
    resultsRef,
    selectResult,
    selectedResult,
    titleId,
    dialogRef,
  };
};
