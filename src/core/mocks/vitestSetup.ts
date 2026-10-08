import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "@testing-library/jest-dom";
import type {
  GoogleCalendarConnection,
  GoogleCalendarInfo,
} from "../../features/calendar/types";
import type { GameScanResult } from "../../features/game_launcher/types";
import { handleCalendarIpcCommand } from "./calendarIpcMock";
import { handleGameLauncherIpcCommand } from "./gameLauncherIpcMock";
import { handleGoogleCalendarIpcCommand } from "./googleCalendarIpcMock";
import { handlePluginIpcCommand } from "./pluginIpcMock";
import { handleSettingsIpcCommand } from "./settingsIpcMock";
import { handleWindowIpcCommand } from "./windowIpcMock";

// テスト環境でTauriのウィンドウ管理をモック
mockWindows("main", "clock", "calendar", "gameLauncher", "mintPalette");

import { createMockSettings } from "./mockSettings";

const mockIPCWithEvents = (handler: Parameters<typeof mockIPC>[0]) =>
  mockIPC(handler, { shouldMockEvents: true });

// テスト用のデフォルト設定データ
const defaultSettings = createMockSettings();

const testGameScanResult: GameScanResult = {
  games: [
    {
      id: "730",
      title: "Counter-Strike 2",
      store: "steam",
      imagePath: null,
      fallbackImagePath: null,
    },
    {
      id: "valorant",
      title: "VALORANT",
      store: "riot",
      imagePath: null,
      fallbackImagePath: null,
    },
  ],
  sources: [
    { store: "steam", detected: true, warning: null },
    { store: "epic", detected: false, warning: null },
    { store: "riot", detected: true, warning: null },
  ],
};

const testGoogleConnection: GoogleCalendarConnection = {
  connected: false,
  accountEmail: "",
  lastSyncedAt: null,
  pendingOperations: 0,
  error: null,
  syncing: false,
};

const testConnectedGoogleConnection: GoogleCalendarConnection = {
  ...testGoogleConnection,
  connected: true,
  accountEmail: "demo@example.com",
};

const testGoogleCalendars: GoogleCalendarInfo[] = [
  {
    id: "primary",
    name: "メイン",
    primary: true,
    accessRole: "owner",
    backgroundColor: "#4285f4",
  },
];

// テスト中のIPC呼び出しの共通モック定義
mockIPCWithEvents(async (cmd, args) => {
  const typedArgs = args as Record<string, unknown> | undefined;

  const settingsResult = await handleSettingsIpcCommand(cmd, typedArgs, {
    load: () => defaultSettings,
    enabledTargets: {
      clock: true,
      calendar: true,
      gameLauncher: true,
      mintPalette: true,
    },
  });
  if (settingsResult.handled) return settingsResult.value;

  const windowResult = await handleWindowIpcCommand(cmd, typedArgs);
  if (windowResult.handled) return windowResult.value;

  const calendarResult = await handleCalendarIpcCommand(cmd, typedArgs);
  if (calendarResult.handled) return calendarResult.value;
  const gameResult = await handleGameLauncherIpcCommand(cmd, typedArgs, {
    scanResult: testGameScanResult,
  });
  if (gameResult.handled) return gameResult.value;
  const googleResult = await handleGoogleCalendarIpcCommand(cmd, typedArgs, {
    defaultConnection: testGoogleConnection,
    defaultConnectedConnection: testConnectedGoogleConnection,
    defaultCalendars: testGoogleCalendars,
  });
  if (googleResult.handled) return googleResult.value;
  const pluginResult = await handlePluginIpcCommand(cmd, typedArgs, {
    update: null,
    onDownloadAndInstall: (channel) => {
      channel?.onmessage?.({
        event: "Started",
        data: { contentLength: 100 },
      });
      channel?.onmessage?.({ event: "Progress", data: { chunkLength: 100 } });
      channel?.onmessage?.({ event: "Finished" });
    },
  });
  if (pluginResult.handled) return pluginResult.value;

  switch (cmd) {
    case "overlay_ready":
      return null;
    case "reset_window_state":
      return null;
    case "open_settings_tab":
      return null;
    case "take_pending_settings_tab":
      return null;
    default:
      return null;
  }
});
