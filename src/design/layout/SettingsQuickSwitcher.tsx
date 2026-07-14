import { Search, X } from "lucide-react";
import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { TextInput } from "../components";
import type {
  SidebarQuickAction,
  SidebarSearchItem,
  SidebarTab,
} from "./Sidebar";
import { revealElementVertically } from "./scrollVisibility";

type SettingsSearchResult<TTabId extends string> =
  | {
      kind: "tab";
      key: string;
      tab: SidebarTab<TTabId>;
    }
  | {
      kind: "setting";
      key: string;
      item: SidebarSearchItem;
      tab: SidebarTab<TTabId>;
    }
  | {
      kind: "action";
      key: string;
      action: SidebarQuickAction;
    };

interface SettingsQuickSwitcherProps<TTabId extends string> {
  tabs: readonly SidebarTab<TTabId>[];
  activeTab: TTabId;
  isOpen: boolean;
  onClose: () => void;
  onTabChange: (tabId: TTabId, targetId?: string) => void;
  quickActions?: readonly SidebarQuickAction[];
  onQuickAction?: (targetId: string) => Promise<void> | void;
}

const normalizeSearchText = (value: string) =>
  value.toLocaleLowerCase("ja").replace(/\s+/g, "");

const MAX_RECENT_RESULTS = 4;

export const SettingsQuickSwitcher = <TTabId extends string>({
  tabs,
  activeTab,
  isOpen,
  onClose,
  onTabChange,
  quickActions = [],
  onQuickAction,
}: SettingsQuickSwitcherProps<TTabId>) => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [actionError, setActionError] = useState("");
  const [isSelecting, setIsSelecting] = useState(false);
  const [recentKeys, setRecentKeys] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const resultsId = useId();

  const normalizedQuery = normalizeSearchText(query);
  const filteredResults = useMemo(() => {
    if (!normalizedQuery) {
      return [
        ...tabs.map<SettingsSearchResult<TTabId>>((tab) => ({
          kind: "tab",
          key: `tab:${tab.id}`,
          tab,
        })),
        ...quickActions.map<SettingsSearchResult<TTabId>>((action) => ({
          kind: "action",
          key: `action:${action.id}`,
          action,
        })),
      ];
    }

    const tabResults = tabs.flatMap<SettingsSearchResult<TTabId>>((tab) => {
      const tabSearchableText = [
        tab.label,
        tab.navigationLabel,
        tab.description,
        ...(tab.keywords ?? []),
      ]
        .filter(Boolean)
        .join(" ");
      const results: SettingsSearchResult<TTabId>[] = [];
      if (normalizeSearchText(tabSearchableText).includes(normalizedQuery)) {
        results.push({ kind: "tab", key: `tab:${tab.id}`, tab });
      }

      for (const item of tab.searchItems ?? []) {
        const itemSearchableText = [
          item.label,
          item.description,
          ...(item.keywords ?? []),
        ]
          .filter(Boolean)
          .join(" ");
        if (normalizeSearchText(itemSearchableText).includes(normalizedQuery)) {
          results.push({
            kind: "setting",
            key: `setting:${tab.id}:${item.id}`,
            item,
            tab,
          });
        }
      }
      return results;
    });
    const actionResults = quickActions
      .filter((action) => {
        const searchableText = [
          action.label,
          action.description,
          ...(action.keywords ?? []),
        ]
          .filter(Boolean)
          .join(" ");
        return normalizeSearchText(searchableText).includes(normalizedQuery);
      })
      .map<SettingsSearchResult<TTabId>>((action) => ({
        kind: "action",
        key: `action:${action.id}`,
        action,
      }));
    return [...tabResults, ...actionResults];
  }, [normalizedQuery, quickActions, tabs]);
  const recentResults = useMemo(() => {
    if (normalizedQuery) return [];
    return recentKeys.flatMap((key) => {
      const result = filteredResults.find((candidate) => candidate.key === key);
      return result ? [result] : [];
    });
  }, [filteredResults, normalizedQuery, recentKeys]);
  const orderedResults = useMemo(() => {
    if (recentResults.length === 0) return filteredResults;
    const recentResultKeys = new Set(recentResults.map((result) => result.key));
    return [
      ...recentResults,
      ...filteredResults.filter((result) => !recentResultKeys.has(result.key)),
    ];
  }, [filteredResults, recentResults]);
  const recentResultKeys = useMemo(
    () => new Set(recentResults.map((result) => result.key)),
    [recentResults],
  );
  const selectedResult = orderedResults[activeIndex];

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedElement.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    return () => {
      const elementToRestore = previouslyFocusedElement.current;
      previouslyFocusedElement.current = null;
      elementToRestore?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setActionError("");
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
    if (results && activeOption) {
      revealElementVertically(results, activeOption, 8);
    }
  }, [isOpen, selectedResult]);

  if (!isOpen) return null;

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
      if (!onQuickAction || isSelecting) return;
      setIsSelecting(true);
      setActionError("");
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
    if (result.kind === "setting") {
      onTabChange(result.tab.id, result.item.targetId);
    } else {
      onTabChange(result.tab.id);
    }
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
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        filteredResults.length === 0
          ? 0
          : (current + 1) % filteredResults.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        filteredResults.length === 0
          ? 0
          : (current - 1 + filteredResults.length) % filteredResults.length,
      );
      return;
    }
    if (event.key === "Enter" && selectedResult) {
      event.preventDefault();
      void selectResult(selectedResult);
    }
  };

  return (
    <div className="settings-switcher-backdrop" data-window-drag-block>
      <button
        type="button"
        className="settings-switcher-backdrop__dismiss"
        onClick={onClose}
        aria-label="検索を閉じる"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        className="settings-switcher"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="settings-switcher__header">
          <div>
            <span className="settings-switcher__eyebrow">QUICK ACTIONS</span>
            <h2 id={titleId}>クイックランチャー</h2>
          </div>
          <button
            type="button"
            className="settings-switcher__close"
            onClick={onClose}
            aria-label="検索を閉じる"
            title="検索を閉じる"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="settings-switcher__search">
          <Search size={18} aria-hidden="true" />
          <TextInput
            ref={inputRef}
            value={query}
            role="combobox"
            aria-label="設定や項目、操作を検索"
            aria-controls={resultsId}
            aria-expanded="true"
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-keyshortcuts="ArrowDown ArrowUp Enter Escape"
            aria-activedescendant={
              selectedResult ? `${resultsId}-${selectedResult.key}` : undefined
            }
            autoComplete="off"
            placeholder="機能名、設定、操作を入力…"
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setActionError("");
            }}
            onKeyDown={handleSearchKeyDown}
          />
          {query && (
            <button
              type="button"
              className="settings-switcher__clear"
              aria-label="クイックランチャーの検索をクリア"
              title="検索をクリア"
              onClick={() => {
                setQuery("");
                setActiveIndex(0);
                inputRef.current?.focus();
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {recentResults.length > 0 && (
          <div className="settings-switcher__section-label">最近使った項目</div>
        )}
        <div
          ref={resultsRef}
          id={resultsId}
          className="settings-switcher__results"
          role="listbox"
          aria-label="設定カテゴリ・項目・操作"
        >
          {orderedResults.map((result, index) => (
            <button
              type="button"
              role="option"
              id={`${resultsId}-${result.key}`}
              key={result.key}
              tabIndex={-1}
              className={`settings-switcher__option${result.kind === "setting" ? " is-setting" : ""}${result.kind === "action" ? " is-action" : ""}${recentResultKeys.has(result.key) ? " is-recent" : ""} ${
                index === activeIndex ? "is-active" : ""
              }`}
              aria-selected={index === activeIndex}
              onClick={() => void selectResult(result)}
              onMouseEnter={() => setActiveIndex(index)}
              disabled={isSelecting}
            >
              <span
                className="settings-switcher__option-icon"
                aria-hidden="true"
              >
                {result.kind === "action"
                  ? result.action.icon
                  : result.tab.icon}
              </span>
              <span className="settings-switcher__option-copy">
                <strong>
                  {result.kind === "setting"
                    ? result.item.label
                    : result.kind === "action"
                      ? result.action.label
                      : result.tab.label}
                </strong>
                <small>
                  {result.kind === "setting"
                    ? [
                        result.tab.navigationLabel ?? result.tab.label,
                        result.item.description,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : result.kind === "action"
                      ? result.action.description
                      : result.tab.description}
                </small>
              </span>
              {result.kind === "tab" && result.tab.id === activeTab && (
                <span className="settings-switcher__current">表示中</span>
              )}
              {recentResultKeys.has(result.key) ? (
                <span className="settings-switcher__scope">最近</span>
              ) : result.kind === "setting" ? (
                <span className="settings-switcher__scope">項目</span>
              ) : result.kind === "action" ? (
                <span className="settings-switcher__scope">操作</span>
              ) : null}
            </button>
          ))}
          {orderedResults.length === 0 && (
            <div className="settings-switcher__empty">
              <Search size={20} aria-hidden="true" />
              <strong>一致する設定や操作がありません</strong>
              <span>別の機能名、設定内容、操作名で検索してください。</span>
            </div>
          )}
        </div>

        <div className="settings-switcher__footer">
          {actionError && (
            <span className="settings-switcher__action-error" role="alert">
              {actionError}
            </span>
          )}
          <span aria-live="polite">{orderedResults.length} 件の候補</span>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> 選択 <kbd>Enter</kbd> 決定
          </span>
        </div>
      </div>
    </div>
  );
};
