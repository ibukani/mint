import type React from "react";
import { Suspense, useEffect, useRef } from "react";
import { AppErrorState } from "./core/components/AppErrorState";
import { AppLoading } from "./core/components/AppLoading";
import { AutoFocusTrigger } from "./core/components/AutoFocusTrigger";
import { ErrorToast } from "./core/components/ErrorToast";
import { SettingsSaveStatus } from "./core/components/SettingsSaveStatus";
import {
  AppSettingsProvider,
  type SaveStatus,
  useAppSettings,
} from "./core/context/AppSettings";
import { SettingsNavigationProvider } from "./core/context/SettingsNavigation";
import { useSettingsWindow } from "./core/hooks/useSettingsWindow";
import {
  SETTINGS_TAB_COMPONENTS,
  SETTINGS_TABS,
} from "./core/navigation/settingsTabs";
import { WINDOW_ROUTES } from "./core/windowRoutes";
import { AppShell } from "./design/layout";
import { syncGoogleCalendars } from "./features/calendar/googleCalendar";

const saveSidebarLabels: Record<SaveStatus, string> = {
  idle: "設定は自動保存されます",
  pending: "変更を保存待ち",
  saving: "変更を保存中",
  saved: "変更を保存しました",
  error: "保存に失敗しました",
};

const saveSidebarTones: Record<
  SaveStatus,
  "neutral" | "pending" | "success" | "error"
> = {
  idle: "neutral",
  pending: "pending",
  saving: "pending",
  saved: "success",
  error: "error",
};

const AppContent: React.FC = () => {
  const {
    settings,
    loading,
    error,
    saveStatus,
    clearError,
    reloadSettings,
    retrySaveSettings,
  } = useAppSettings();
  const { label, activeTab, setActiveTab } = useSettingsWindow(settings?.theme);
  const startupSyncStarted = useRef(false);

  useEffect(() => {
    if (
      label !== "main" ||
      !settings ||
      startupSyncStarted.current ||
      settings.calendar.selectedGoogleCalendarIds.length === 0
    ) {
      return;
    }
    startupSyncStarted.current = true;
    syncGoogleCalendars(settings.calendar.selectedGoogleCalendarIds).catch(
      (syncError) =>
        console.warn("Google Calendar startup sync was skipped:", syncError),
    );
  }, [label, settings]);

  if (loading) return <AppLoading />;

  if (label && label in WINDOW_ROUTES) {
    const OverlayComponent = WINDOW_ROUTES[label];
    return (
      <Suspense>
        <OverlayComponent />
      </Suspense>
    );
  }

  const ActiveTabComponent = SETTINGS_TAB_COMPONENTS[activeTab];
  const activeTabLabel =
    SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? "設定";
  const settingsLoadError = !settings ? error : null;

  return (
    <>
      <ErrorToast
        message={error}
        onDismiss={clearError}
        onRetry={saveStatus === "error" ? retrySaveSettings : undefined}
      />
      <SettingsNavigationProvider
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      >
        <AppShell
          title="mint"
          contextLabel={activeTabLabel}
          tabs={SETTINGS_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          statusLabel={saveSidebarLabels[saveStatus]}
          statusTone={saveSidebarTones[saveStatus]}
        >
          <SettingsSaveStatus status={saveStatus} onRetry={retrySaveSettings} />
          {settingsLoadError ? (
            <AppErrorState
              message={settingsLoadError}
              onRetry={() => void reloadSettings()}
            />
          ) : (
            <Suspense fallback={<AppLoading compact />}>
              <ActiveTabComponent />
              <AutoFocusTrigger key={activeTab} />
            </Suspense>
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
