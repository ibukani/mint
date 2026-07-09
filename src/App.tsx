import { getCurrentWindow } from "@tauri-apps/api/window";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { FeatureDashboard } from "./core/components/dashboard/FeatureDashboard";
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
  pending: "変更を保存しています...",
  saving: "設定を保存中...",
  saved: "設定を保存しました",
  error: "設定の保存に失敗しました",
};

const overlayWindowTitles: Record<string, string> = {
  clock: "時計オーバーレイ",
};

const AppContent: React.FC = () => {
  const { settings, loading, error, saveStatus, clearError } = useAppSettings();
  const [label, setLabel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
  const previousTabRef = useRef<SettingsTabId>("general");
  const dashboardFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
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

  useEffect(() => {
    if (previousTabRef.current !== "dashboard" && activeTab === "dashboard") {
      if (dashboardFocusTimerRef.current) {
        clearTimeout(dashboardFocusTimerRef.current);
      }

      dashboardFocusTimerRef.current = setTimeout(() => {
        document
          .querySelector<HTMLButtonElement>('button[aria-current="page"]')
          ?.focus();
        dashboardFocusTimerRef.current = null;
      }, 0);
    }

    previousTabRef.current = activeTab;
    return () => {
      if (dashboardFocusTimerRef.current) {
        clearTimeout(dashboardFocusTimerRef.current);
        dashboardFocusTimerRef.current = null;
      }
    };
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
  const openFeatureSettings = (
    tabId: Extract<SettingsTabId, "clock" | "voiceToText">,
  ) => {
    setActiveTab(tabId);
  };
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
            {saveStatusLabel}
          </div>
          {activeTab === "dashboard" ? (
            <FeatureDashboard onOpenSettings={openFeatureSettings} />
          ) : (
            <ActiveTabComponent />
          )}
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
