import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import { SETTINGS_TABS, type SettingsTabId } from "../navigation/settingsTabs";
import type { ThemeMode } from "../settingsModel";

const ACTIVE_TAB_STORAGE_KEY = "mint.active-settings-tab";

const overlayWindowTitles: Record<string, string> = {
  clock: "時計オーバーレイ",
  calendar: "カレンダーオーバーレイ",
};

const isSettingsTabId = (value: string | null): value is SettingsTabId =>
  SETTINGS_TABS.some((tab) => tab.id === value);

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const getInitialSettingsTab = (): SettingsTabId => {
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  if (isSettingsTabId(requestedTab)) return requestedTab;

  try {
    const storedTab = window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    return isSettingsTabId(storedTab) ? storedTab : "general";
  } catch {
    return "general";
  }
};

export const useSettingsWindow = (theme: ThemeMode | undefined) => {
  const [label, setLabel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    getInitialSettingsTab,
  );
  const [focusRequest, setFocusRequest] = useState<{
    id: number;
    targetId?: string;
  }>({ id: 0 });
  const navigateToTab = useCallback(
    (tabId: SettingsTabId, targetId?: string) => {
      setFocusRequest((current) => {
        if (targetId) {
          return { id: current.id + 1, targetId };
        }
        return current.targetId ? { id: current.id } : current;
      });
      setActiveTab(tabId);
    },
    [],
  );

  useEffect(() => {
    setLabel(getCurrentWindow().label);
  }, []);

  useEffect(() => {
    const effectiveTheme = theme ?? "system";

    const mediaQuery =
      effectiveTheme === "system" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: light)")
        : null;
    const applyTheme = () => {
      const resolvedTheme =
        effectiveTheme === "system"
          ? mediaQuery?.matches
            ? "light"
            : "dark"
          : effectiveTheme;
      document.documentElement.dataset.theme = resolvedTheme;
    };

    applyTheme();
    if (!mediaQuery) return undefined;

    const handleThemeChange = () => applyTheme();
    mediaQuery.addEventListener("change", handleThemeChange);
    return () => mediaQuery.removeEventListener("change", handleThemeChange);
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
    } catch {
      // Storage access is optional; navigation remains usable without it.
    }
  }, [activeTab]);

  useEffect(() => {
    const tabLabel =
      SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? "一般設定";
    const currentLabel =
      label && label !== "main"
        ? (overlayWindowTitles[label] ?? label)
        : tabLabel;
    document.title = `mint - ${currentLabel}`;
  }, [activeTab, label]);

  useEffect(() => {
    if (label && label !== "main") return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }
      if (isEditableTarget(event.target)) return;

      const tabIndex = Number(event.key) - 1;
      const tab = SETTINGS_TABS[tabIndex];
      if (!tab) return;

      event.preventDefault();
      navigateToTab(tab.id);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [label, navigateToTab]);

  useEffect(() => {
    if (label !== "main") return undefined;

    const unlistenPromise = listen("voice-to-text-shortcut", () => {
      setActiveTab("voiceToText");
      setFocusRequest((current) => ({
        id: current.id + 1,
        targetId: "v2t-audio-file-input",
      }));
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [label]);

  return {
    label,
    activeTab,
    setActiveTab: navigateToTab,
    focusRequest,
  };
};
