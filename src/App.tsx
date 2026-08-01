import type React from "react";
import { Suspense, useEffect, useRef, useState } from "react";
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
import { useMainWindowEviction } from "./core/hooks/useMainWindowEviction";
import { useSettingsWindow } from "./core/hooks/useSettingsWindow";
import { useWindowThemeColor } from "./core/hooks/useWindowThemeColor";
import { getAvailableQuickActions } from "./core/navigation/quickActions";
import {
  SETTINGS_TAB_COMPONENTS,
  SETTINGS_TABS,
} from "./core/navigation/settingsTabs";
import { OnboardingFlow } from "./core/onboarding/OnboardingFlow";
import { ONBOARDING_VERSION } from "./core/onboarding/onboardingModel";
import { isOverlayTarget, openOverlay } from "./core/windowCommands";
import { isWindowRouteLabel, WINDOW_ROUTES } from "./core/windowRoutes";
import { AppShell } from "./design/layout";
import {
  rememberGoogleCalendarSync,
  shouldRunAutomaticGoogleCalendarSync,
} from "./features/calendar/autoSyncPolicy";
import { toMachineDate } from "./features/calendar/calendar";
import { openCalendarEditor } from "./features/calendar/events";
import {
  getGoogleCalendarConnection,
  syncGoogleCalendars,
} from "./features/calendar/googleCalendar";

const saveSidebarLabels: Record<SaveStatus, string> = {
  idle: "変更時に自動保存",
  pending: "変更を保存待ち",
  saving: "保存中",
  saved: "最新の状態です",
  error: "再試行が必要です",
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
    updateSettings,
  } = useAppSettings();
  const { label, activeTab, setActiveTab, focusRequest } = useSettingsWindow(
    settings?.theme,
  );
  useWindowThemeColor(label, settings);
  useMainWindowEviction(label === "main");
  const startupSyncStarted = useRef(false);
  const initialActiveTab = useRef(activeTab);
  const [onboardingRequested, setOnboardingRequested] = useState(false);

  const showOnboarding =
    label === "main" &&
    settings !== null &&
    (onboardingRequested ||
      settings.onboarding.completedVersion < ONBOARDING_VERSION);

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
    const calendarIds = settings.calendar.selectedGoogleCalendarIds;
    getGoogleCalendarConnection()
      .then((connection) => {
        if (!shouldRunAutomaticGoogleCalendarSync(connection, calendarIds)) {
          return undefined;
        }
        return syncGoogleCalendars(calendarIds).then((result) => {
          rememberGoogleCalendarSync(calendarIds);
          return result;
        });
      })
      .catch((syncError) =>
        console.warn("Google Calendar startup sync was skipped:", syncError),
      );
  }, [label, settings]);

  if (loading) return <AppLoading />;

  if (isWindowRouteLabel(label)) {
    const OverlayComponent = WINDOW_ROUTES[label].component;
    return (
      <Suspense>
        <OverlayComponent />
      </Suspense>
    );
  }

  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => setOnboardingRequested(false)} />;
  }

  const ActiveTabComponent = SETTINGS_TAB_COMPONENTS[activeTab];
  const activeTabLabel =
    SETTINGS_TABS.find((tab) => tab.id === activeTab)?.label ?? "設定";
  const settingsLoadError = !settings ? error : null;
  const quickActions = getAvailableQuickActions(settings);

  return (
    <>
      <ErrorToast message={error} onDismiss={clearError} />
      <SettingsNavigationProvider
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        requestOnboarding={() => setOnboardingRequested(true)}
      >
        <AppShell
          title="mint"
          contextLabel={activeTabLabel}
          tabs={SETTINGS_TABS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          quickActions={quickActions}
          onQuickAction={(targetId) => {
            if (
              targetId === "themeDark" ||
              targetId === "themeLight" ||
              targetId === "themeSystem"
            ) {
              updateSettings({
                theme:
                  targetId === "themeDark"
                    ? "dark"
                    : targetId === "themeLight"
                      ? "light"
                      : "system",
              });
              return;
            }
            if (targetId === "calendarCreateEvent") {
              if (!settings?.calendar.enabled) {
                return Promise.reject(
                  new Error("カレンダーが無効になっています。"),
                );
              }
              return openCalendarEditor({
                mode: "create",
                date: toMachineDate(new Date()),
              });
            }
            if (!isOverlayTarget(targetId)) {
              return Promise.reject(new Error("利用できない操作です。"));
            }
            return openOverlay(targetId);
          }}
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
              <AutoFocusTrigger
                key={`${activeTab}:${focusRequest.id}`}
                enabled={
                  activeTab !== initialActiveTab.current || focusRequest.id > 0
                }
                targetId={focusRequest.targetId}
              />
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
