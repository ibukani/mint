import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { SETTINGS_TABS, type SettingsTabId } from "../navigation/settingsTabs";

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

export const useSettingsWindow = (theme: "dark" | "light" | undefined) => {
  const [label, setLabel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    getInitialSettingsTab,
  );

  useEffect(() => {
    setLabel(getCurrentWindow().label);
  }, []);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
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
      setActiveTab(tab.id);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [label]);

  return { label, activeTab, setActiveTab };
};
