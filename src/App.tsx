import { getCurrentWindow } from "@tauri-apps/api/window";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { ErrorToast } from "./core/components/ErrorToast";
import {
  AppSettingsProvider,
  type SaveStatus,
  useAppSettings,
} from "./core/context/AppSettings";
import { SettingsNavigationProvider } from "./core/context/SettingsNavigation";
import {
  SETTINGS_TAB_COMPONENTS,
  SETTINGS_TABS,
  type SettingsTabId,
} from "./core/navigation/settingsTabs";
import { WINDOW_ROUTES } from "./core/windowRoutes";
import { AppShell } from "./design/layout";

const saveStatusLabels: Record<SaveStatus, string> = {
  idle: "",
  pending: "保存待ち...",
  saving: "保存中...",
  saved: "保存完了",
  error: "保存失敗",
};

const saveStatusIcons: Record<SaveStatus, React.ReactNode> = {
  idle: null,
  pending: (
    <LoaderCircle className="spinner-icon" size={14} aria-hidden="true" />
  ),
  saving: (
    <LoaderCircle className="spinner-icon" size={14} aria-hidden="true" />
  ),
  saved: <Check size={14} aria-hidden="true" />,
  error: <CircleAlert size={14} aria-hidden="true" />,
};

const overlayWindowTitles: Record<string, string> = {
  clock: "時計オーバーレイ",
};

const getInitialSettingsTab = (): SettingsTabId => {
  const requestedTab = new URLSearchParams(window.location.search).get("tab");
  return SETTINGS_TABS.some((tab) => tab.id === requestedTab)
    ? (requestedTab as SettingsTabId)
    : "general";
};

const AppContent: React.FC = () => {
  const { settings, loading, error, saveStatus, clearError } = useAppSettings();
  const [label, setLabel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTabId>(
    getInitialSettingsTab,
  );

  useEffect(() => {
    setLabel(getCurrentWindow().label);
  }, []);

  useEffect(() => {
    if (settings) {
      document.documentElement.dataset.theme = settings.theme;
    }
  }, [settings]);

  useEffect(() => {
    const tabLabel =
      SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? "一般設定";
    const currentLabel =
      label && label !== "main"
        ? (overlayWindowTitles[label] ?? label)
        : tabLabel;
    document.title = `mint - ${currentLabel}`;
  }, [activeTab, label]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeTab is used as a trigger for focusing
  useEffect(() => {
    const timer = setTimeout(() => {
      const contentEl = document.querySelector(".app-content");
      if (contentEl) {
        const focusable = contentEl.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([type="checkbox"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
        );
        focusable?.focus();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab]);

  if (loading) {
    return <div className="app-loading">設定を読み込み中...</div>;
  }

  // Overlay window routing via lookup table
  if (label && label in WINDOW_ROUTES) {
    const OverlayComponent = WINDOW_ROUTES[label];
    return <OverlayComponent />;
  }

  // Main settings window
  const ActiveTabComponent = SETTINGS_TAB_COMPONENTS[activeTab];
  const saveStatusLabel = saveStatusLabels[saveStatus];

  return (
    <>
      <ErrorToast message={error} onDismiss={clearError} />
      <SettingsNavigationProvider
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      >
        <AppShell
          title="mint"
          tabs={SETTINGS_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          <div
            className={`settings-save-status settings-save-status--${saveStatus}`}
            role={saveStatus === "idle" ? undefined : "status"}
            aria-hidden={saveStatus === "idle"}
          >
            {saveStatusIcons[saveStatus]}
            <span>{saveStatusLabel}</span>
          </div>
          <ActiveTabComponent />
        </AppShell>
      </SettingsNavigationProvider>
    </>
  );
};

function App() {
  return (
    <AppSettingsProvider>
      <AppContent />
    </AppSettingsProvider>
  );
}

export default App;
