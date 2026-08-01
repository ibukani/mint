import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  MINT_ACTIONS,
  type MintAction,
  type MintActionContext,
  searchMintActions,
} from "../../../core/actions/mintActions";
import { useAppSettings } from "../../../core/context/AppSettings";
import { useOverlayWindowEviction } from "../../../core/hooks/useOverlayWindowEviction";
import { useOverlayWindowReady } from "../../../core/hooks/useOverlayWindowReady";
import {
  prependRecentActionKey,
  RECENT_ACTIONS_STORAGE_KEY,
  readRecentActionKeys,
} from "../../../core/navigation/quickActions";
import type { SettingsTabId } from "../../../core/navigation/settingsTabs";
import { openOverlay, openSettingsTab } from "../../../core/windowCommands";
import { toMachineDate } from "../../calendar/calendar";
import { openCalendarEditor } from "../../calendar/events";

const HIDE_ANIMATION_MS = 220;

interface DisabledSettingsTarget {
  tabId: SettingsTabId;
  targetId?: string;
}

export const useMintPalette = () => {
  const { settings, updateSettings } = useAppSettings();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [disabledSettingsTarget, setDisabledSettingsTarget] =
    useState<DisabledSettingsTarget | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [recentKeys, setRecentKeys] = useState<string[]>(readRecentActionKeys);
  const [isAnimateVisible, setIsAnimateVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = searchMintActions(MINT_ACTIONS, query, recentKeys);

  const resetQuery = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setActionError(null);
    setDisabledSettingsTarget(null);
  }, []);

  const focusInput = useCallback(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  useEffect(() => {
    let mounted = true;
    const showPalette = () => {
      if (!mounted) return;
      resetQuery();
      setIsAnimateVisible(true);
      focusInput();
    };

    const currentWindow = getCurrentWindow();
    if (typeof currentWindow.isVisible !== "function") {
      showPalette();
    } else {
      void currentWindow
        .isVisible()
        .then((visible) => {
          if (visible !== false) showPalette();
        })
        .catch(showPalette);
    }

    document.body.classList.add("is-overlay");
    document.documentElement.classList.add("is-overlay");

    return () => {
      mounted = false;
      document.body.classList.remove("is-overlay");
      document.documentElement.classList.remove("is-overlay");
    };
  }, [focusInput, resetQuery]);

  useOverlayWindowEviction(isAnimateVisible);
  useOverlayWindowReady();

  const hidePaletteWindow = useCallback(() => {
    setIsAnimateVisible(false);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    hideTimerRef.current = setTimeout(
      () => {
        getCurrentWindow()
          .hide()
          .then(() => {
            hideTimerRef.current = null;
          })
          .catch((error) => {
            console.error("Failed to hide MintPalette window:", error);
            hideTimerRef.current = null;
          });
      },
      reduceMotion ? 0 : HIDE_ANIMATION_MS,
    );
  }, []);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const unlistenPromise = listen("mint-palette-shown", () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      resetQuery();
      setIsAnimateVisible(true);
      focusInput();
    });
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [focusInput, resetQuery]);

  useEffect(() => {
    if (recentKeys.length === 0) {
      window.localStorage.removeItem(RECENT_ACTIONS_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        RECENT_ACTIONS_STORAGE_KEY,
        recentKeys.join("\n"),
      );
    }
  }, [recentKeys]);

  const executeContext: MintActionContext = {
    updateSettings,
    openOverlay: (target) => openOverlay(target),
    openSettingsTab: (tab, targetId) => openSettingsTab(tab, targetId),
    openCalendarEditor: () =>
      openCalendarEditor({ mode: "create", date: toMachineDate(new Date()) }),
  };

  const selectAction = async (action: MintAction) => {
    const availability = action.availability(settings);
    if (!availability.available) {
      setDisabledSettingsTarget(availability.disabledSettingsTarget ?? null);
      setActionError(availability.reason ?? "この操作は現在利用できません。");
      return;
    }
    if (isSelecting) return;
    setIsSelecting(true);
    try {
      await action.execute(executeContext);
      setRecentKeys((current) => prependRecentActionKey(current, action.key));
      hidePaletteWindow();
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : "操作を実行できませんでした。",
      );
    } finally {
      setIsSelecting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;
    const results = search.results;
    const count = results.length;

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        hidePaletteWindow();
        break;
      case "Enter": {
        event.preventDefault();
        const current = results[activeIndex];
        if (current) void selectAction(current);
        break;
      }
      case "ArrowDown":
        event.preventDefault();
        if (count > 0) setActiveIndex((activeIndex + 1) % count);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (count > 0) setActiveIndex((activeIndex - 1 + count) % count);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(Math.max(0, count - 1));
        break;
      case "PageDown":
        event.preventDefault();
        if (count > 0) setActiveIndex(Math.min(count - 1, activeIndex + 5));
        break;
      case "PageUp":
        event.preventDefault();
        setActiveIndex(Math.max(0, activeIndex - 5));
        break;
    }
  };

  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const activeOption = container.querySelectorAll(".mint-palette__option")[
      activeIndex
    ];
    activeOption?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setActiveIndex(0);
    setActionError(null);
    setDisabledSettingsTarget(null);
    if (resultsRef.current) resultsRef.current.scrollTop = 0;
  };

  return {
    query,
    handleQueryChange,
    activeIndex,
    setActiveIndex,
    actionError,
    disabledSettingsTarget,
    results: search.results,
    recentResults: search.recentResults,
    normalizedQuery: search.normalizedQuery,
    handleKeyDown,
    selectAction,
    hidePaletteWindow,
    isAnimateVisible,
    inputRef,
    resultsRef,
  };
};
