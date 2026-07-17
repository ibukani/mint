import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "@testing-library/jest-dom";
import type {
  GoogleCalendarConnection,
  GoogleCalendarInfo,
} from "../../features/calendar/types";
import type { GameScanResult } from "../../features/game_launcher/types";
import { handleApiKeyIpcCommand } from "./apiKeyIpcMock";
import { handleCalendarIpcCommand } from "./calendarIpcMock";
import { handleFileShelfIpcCommand } from "./fileShelfIpcMock";
import { handleGameLauncherIpcCommand } from "./gameLauncherIpcMock";
import { handleGoogleCalendarIpcCommand } from "./googleCalendarIpcMock";
import { handlePluginIpcCommand } from "./pluginIpcMock";
import { handleQuickCaptureIpcCommand } from "./quickCaptureIpcMock";
import { handleSettingsIpcCommand } from "./settingsIpcMock";
import { handleTranscriptionIpcCommand } from "./transcriptionIpcMock";
import { handleWindowIpcCommand } from "./windowIpcMock";

// テスト環境でTauriのウィンドウ管理をモック
mockWindows(
  "main",
  "clock",
  "calendar",
  "gameLauncher",
  "quickCapture",
  "fileShelf",
);

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
      imagePath:
        "https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg",
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
      quickCapture: true,
      fileShelf: true,
    },
  });
  if (settingsResult.handled) return settingsResult.value;

  const windowResult = await handleWindowIpcCommand(cmd, typedArgs);
  if (windowResult.handled) return windowResult.value;

  const calendarResult = await handleCalendarIpcCommand(cmd, typedArgs);
  if (calendarResult.handled) return calendarResult.value;
  const fileShelfResult = await handleFileShelfIpcCommand(cmd, typedArgs);
  if (fileShelfResult.handled) return fileShelfResult.value;
  const quickCaptureResult = await handleQuickCaptureIpcCommand(cmd, typedArgs);
  if (quickCaptureResult.handled) return quickCaptureResult.value;
  const transcriptionResult = await handleTranscriptionIpcCommand(
    cmd,
    typedArgs,
  );
  if (transcriptionResult.handled) return transcriptionResult.value;

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
  const apiKeyResult = await handleApiKeyIpcCommand(cmd, typedArgs, {
    defaultKey: "mock-api-key",
  });
  if (apiKeyResult.handled) return apiKeyResult.value;

  const pluginResult = await handlePluginIpcCommand(cmd, typedArgs, {
    update: null,
    dialogSave: "/tmp/quick-capture.mintbackup",
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
    default:
      return null;
  }
});
