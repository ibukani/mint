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
  SETTINGS_QUICK_ACTIONS,
  SETTINGS_TAB_COMPONENTS,
  SETTINGS_TABS,
  type SettingsTabId,
} from "./core/navigation/settingsTabs";
import { isOverlayTarget, openOverlay } from "./core/windowCommands";
import { WINDOW_ROUTES } from "./core/windowRoutes";
import { AppShell } from "./design/layout";
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

type OverlayFeatureSettingsKey =
  | "clock"
  | "calendar"
  | "gameLauncher"
  | "quickCapture"
  | "fileShelf";

type QuickActionAvailability = {
  settingsKey: OverlayFeatureSettingsKey;
  tabId: SettingsTabId;
  targetId: string;
  label: string;
};

const quickActionAvailability: Record<string, QuickActionAvailability> = {
  clock: {
    settingsKey: "clock",
    tabId: "clock",
    targetId: "clock-enabled-checkbox",
    label: "時計オーバーレイ",
  },
  calendar: {
    settingsKey: "calendar",
    tabId: "calendar",
    targetId: "calendar-enabled-checkbox",
    label: "カレンダー",
  },
  calendarCreateEvent: {
    settingsKey: "calendar",
    tabId: "calendar",
    targetId: "calendar-enabled-checkbox",
    label: "カレンダー",
  },
  gameLauncher: {
    settingsKey: "gameLauncher",
    tabId: "gameLauncher",
    targetId: "game-launcher-enabled",
    label: "ゲームランチャー",
  },
  quickCapture: {
    settingsKey: "quickCapture",
    tabId: "quickCapture",
    targetId: "quick-capture-enabled",
    label: "クイックキャプチャー",
  },
  fileShelf: {
    settingsKey: "fileShelf",
    tabId: "fileShelf",
    targetId: "file-shelf-enabled",
    label: "ファイルシェル",
  },
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
  const startupSyncStarted = useRef(false);
  const initialActiveTab = useRef(activeTab);

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
    getGoogleCalendarConnection()
      .then((connection) => {
        if (!connection.connected || connection.syncing) return undefined;
        return syncGoogleCalendars(settings.calendar.selectedGoogleCalendarIds);
      })
      .catch((syncError) =>
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
  const quickActions = settings
    ? SETTINGS_QUICK_ACTIONS.map((action) => {
        const availability = quickActionAvailability[action.targetId];
        if (!availability || settings[availability.settingsKey].enabled) {
          return action;
        }

        return {
          ...action,
          disabled: true,
          disabledReason: `${availability.label}が無効です。詳細設定で有効にしてください。`,
          disabledSettingsTarget: {
            tabId: availability.tabId,
            targetId: availability.targetId,
          },
        };
      })
    : SETTINGS_QUICK_ACTIONS;

  return (
    <>
      <ErrorToast message={error} onDismiss={clearError} />
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
