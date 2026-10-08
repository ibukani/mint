import { emitTo } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type {
  GoogleCalendarConnection,
  GoogleCalendarInfo,
} from "../../features/calendar/types";
import type { GameScanResult } from "../../features/game_launcher/types";
import { handleCalendarIpcCommand } from "./calendarIpcMock";
import { handleGameLauncherIpcCommand } from "./gameLauncherIpcMock";
import { handleGoogleCalendarIpcCommand } from "./googleCalendarIpcMock";
import { createMockSettings } from "./mockSettings";
import { handlePerformanceIpcCommand } from "./performanceIpcMock";
import { handlePluginIpcCommand } from "./pluginIpcMock";
import { handleSettingsIpcCommand } from "./settingsIpcMock";
import { handleWindowIpcCommand } from "./windowIpcMock";
import { getMockWindowRegistration } from "./windowRegistration";

const mockIPCWithEvents = (handler: Parameters<typeof mockIPC>[0]) =>
  mockIPC(handler, { shouldMockEvents: true });

const waitForMockOperation = (duration: number) =>
  new Promise<void>((resolve) => window.setTimeout(resolve, duration));

// Tauri環境内かどうかを判定（window.__TAURI_INTERNALS__ が存在しない場合はブラウザ環境とみなす）
const isTauri =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !==
    undefined;

declare const process: { env?: { NODE_ENV?: string } } | undefined;
const isTest =
  typeof process !== "undefined" && process?.env?.NODE_ENV === "test";

if (!isTauri && typeof window !== "undefined" && !isTest) {
  (window as unknown as Record<string, unknown>).__MINT_BROWSER_MOCK__ = true;
  console.log(
    "[Tauri Mock] 非Tauri環境（ブラウザ）を検出しました。Tauri APIのモックを初期化します。",
  );

  // クエリパラメータからウィンドウラベルを取得（例: ?label=clock）、指定がなければ "main"
  const params = new URLSearchParams(window.location.search);
  const currentLabel = params.get("label") || "main";
  const mockUpdateAvailable = params.get("mockUpdate") === "available";
  // mockWindows の第1引数が現在のウィンドウになるため、URLのlabelを先頭にする。
  const [registeredCurrentLabel, ...additionalWindowLabels] =
    getMockWindowRegistration(currentLabel);
  mockWindows(registeredCurrentLabel, ...additionalWindowLabels);

  // ローカルストレージキー
  const STORAGE_KEY = "mint_mock_settings";

  // Rust側のデフォルト実装と合わせた設定値の初期データ
  const defaultSettings = createMockSettings();

  const mergeSettingsSection = <T extends object>(
    defaults: T,
    value: unknown,
  ): T => ({
    ...defaults,
    ...(value && typeof value === "object" ? value : {}),
  });

  const loadBrowserSettings = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, unknown>;
        // Retired settings may remain in an older browser profile.
        for (const key of ["fileShelf", "quickCapture", "voiceToText"]) {
          delete parsed[key];
        }
        console.log(
          "[Tauri Mock] load_settings: localStorageから読み込みました。",
          parsed,
        );
        return {
          ...defaultSettings,
          ...parsed,
          calendar: mergeSettingsSection(
            defaultSettings.calendar,
            parsed.calendar,
          ),
          gameLauncher: mergeSettingsSection(
            defaultSettings.gameLauncher,
            parsed.gameLauncher,
          ),
          mintPalette: mergeSettingsSection(
            defaultSettings.mintPalette,
            parsed.mintPalette,
          ),
        };
      } catch (error) {
        console.error(
          "[Tauri Mock] load_settings: 設定データのパースに失敗しました。デフォルトを返します。",
          error,
        );
      }
    }
    console.log(
      "[Tauri Mock] load_settings: 設定未保存のため、初期設定を返します。",
      defaultSettings,
    );
    return defaultSettings;
  };

  const enabledOverlayTargets: Record<string, boolean> = {
    clock: defaultSettings.clock.enabled,
    calendar: defaultSettings.calendar.enabled,
    gameLauncher: defaultSettings.gameLauncher.enabled,
    mintPalette: defaultSettings.mintPalette.enabled,
  };

  const openBrowserOverlay = (target: string) => {
    let enabled = enabledOverlayTargets[target];
    const storedSettings = localStorage.getItem(STORAGE_KEY);
    if (storedSettings) {
      try {
        const parsed = JSON.parse(storedSettings) as Record<string, unknown>;
        const featureSettings = parsed[target];
        if (
          featureSettings &&
          typeof featureSettings === "object" &&
          "enabled" in featureSettings
        ) {
          enabled = Boolean((featureSettings as { enabled?: unknown }).enabled);
        }
      } catch {
        // Fall back to the default mock settings when storage is invalid.
      }
    }
    if (!enabled) {
      throw new Error("このオーバーレイは無効になっています。");
    }
    localStorage.setItem("mint_mock_last_overlay", target);
    window.dispatchEvent(
      new CustomEvent("mint-overlay-opened", { detail: { target } }),
    );
  };

  const browserGameScanResult: GameScanResult = {
    games: [
      {
        id: "730",
        title: "Counter-Strike 2",
        store: "steam",
        imagePath: null,
        fallbackImagePath: null,
      },
      {
        id: "fn:catalog:Fortnite",
        title: "Fortnite",
        store: "epic",
        imagePath: null,
        fallbackImagePath: null,
      },
      {
        id: "league_of_legends",
        title: "League of Legends",
        store: "riot",
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
      { store: "epic", detected: true, warning: null },
      { store: "riot", detected: true, warning: null },
    ],
  };

  const browserCalendars: GoogleCalendarInfo[] = [
    {
      id: "primary",
      name: "メイン",
      primary: true,
      accessRole: "owner",
      backgroundColor: "#4285f4",
    },
    {
      id: "team",
      name: "チーム",
      primary: false,
      accessRole: "reader",
      backgroundColor: "#33b679",
    },
  ];

  const getBrowserGoogleConnection = (): GoogleCalendarConnection => ({
    connected: localStorage.getItem("mint_mock_google_connected") === "true",
    accountEmail: "demo@example.com",
    lastSyncedAt: localStorage.getItem("mint_mock_google_last_sync"),
    pendingOperations: 0,
    error: null,
    syncing: localStorage.getItem("mint_mock_google_syncing") === "true",
  });

  // IPC（Rust側のコマンド呼び出し）をモック化
  mockIPCWithEvents(async (cmd, args) => {
    const typedArgs = args as Record<string, unknown> | undefined;

    const settingsResult = await handleSettingsIpcCommand(cmd, typedArgs, {
      load: loadBrowserSettings,
      save: (settings) => {
        if (settings) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
          console.log(
            "[Tauri Mock] save_settings: localStorageに保存しました。",
            settings,
          );
        }
      },
      enabledTargets: enabledOverlayTargets,
      onOpenOverlay: openBrowserOverlay,
    });
    if (settingsResult.handled) return settingsResult.value;

    const windowResult = await handleWindowIpcCommand(cmd, typedArgs, {
      onOverlayReady: () => {
        window.dispatchEvent(
          new CustomEvent("mint-overlay-ready", {
            detail: { label: currentLabel },
          }),
        );
      },
      onOpenSettingsTab: async (openArgs) => {
        const tab = typeof openArgs.tab === "string" ? openArgs.tab : "";
        const targetId =
          typeof openArgs.targetId === "string" ? openArgs.targetId : null;
        localStorage.setItem(
          "mint_mock_pending_settings_tab",
          JSON.stringify({ tab, targetId }),
        );
        await emitTo("main", "settings-tab-requested", { tab, targetId });
      },
      onTakePendingSettingsTab: () => {
        const stored = localStorage.getItem("mint_mock_pending_settings_tab");
        if (!stored) return null;
        localStorage.removeItem("mint_mock_pending_settings_tab");
        try {
          return JSON.parse(stored) as unknown;
        } catch {
          return null;
        }
      },
    });
    if (windowResult.handled) return windowResult.value;

    const calendarResult = await handleCalendarIpcCommand(cmd, typedArgs);
    if (calendarResult.handled) return calendarResult.value;
    const gameResult = await handleGameLauncherIpcCommand(cmd, typedArgs, {
      scanResult: browserGameScanResult,
      onLaunch: (request) => {
        if (request.id === "launch-error") {
          throw new Error("ゲームクライアントを起動できませんでした。");
        }
        console.log(
          `[Tauri Mock] ${request.store}ゲーム ${request.id} の起動をシミュレートしました。`,
        );
      },
      onOpenStorePage: (request) => {
        if (request.id === "store-error") {
          throw new Error("ゲームクライアントを起動できませんでした。");
        }
        console.log(
          `[Tauri Mock] ${request.store}ゲーム ${request.id} の管理画面を開きました。`,
        );
      },
    });
    if (gameResult.handled) return gameResult.value;
    const googleResult = await handleGoogleCalendarIpcCommand(cmd, typedArgs, {
      defaultConnection: getBrowserGoogleConnection(),
      defaultCalendars: browserCalendars,
      getConnection: getBrowserGoogleConnection,
      connect: async () => {
        await waitForMockOperation(450);
        localStorage.setItem("mint_mock_google_connected", "true");
        return getBrowserGoogleConnection();
      },
      listCalendars: () => browserCalendars,
      sync: async (calendarIds) => {
        localStorage.setItem("mint_mock_google_syncing", "true");
        await waitForMockOperation(650);
        const syncedAt = new Date().toISOString();
        localStorage.setItem("mint_mock_google_last_sync", syncedAt);
        localStorage.removeItem("mint_mock_google_syncing");
        return {
          syncedCalendars: calendarIds.length,
          changedEvents: 0,
          pendingOperations: 0,
          syncedAt,
        };
      },
      disconnect: async () => {
        await waitForMockOperation(350);
        localStorage.removeItem("mint_mock_google_connected");
        localStorage.removeItem("mint_mock_google_last_sync");
        localStorage.removeItem("mint_mock_google_syncing");
      },
    });
    if (googleResult.handled) return googleResult.value;
    const performanceResult = await handlePerformanceIpcCommand(
      cmd,
      typedArgs,
      {},
    );
    if (performanceResult.handled) return performanceResult.value;

    const pluginResult = await handlePluginIpcCommand(cmd, typedArgs, {
      update: mockUpdateAvailable
        ? {
            rid: 1,
            currentVersion: "0.1.0",
            version: "0.2.0",
            date: "2026-07-10T00:00:00Z",
            body: "ブラウザ確認用のモックアップデートです。\n更新フローと進捗表示を確認できます。",
            rawJson: {},
          }
        : null,
      onDownloadAndInstall: async (channel) => {
        channel?.onmessage?.({
          event: "Started",
          data: { contentLength: 100 },
        });
        await new Promise((resolve) => setTimeout(resolve, 350));
        channel?.onmessage?.({ event: "Progress", data: { chunkLength: 60 } });
        await new Promise((resolve) => setTimeout(resolve, 350));
        channel?.onmessage?.({ event: "Progress", data: { chunkLength: 40 } });
        await new Promise((resolve) => setTimeout(resolve, 250));
        channel?.onmessage?.({ event: "Finished" });
      },
      onRestart: () => {
        console.log(
          "[Tauri Mock] アップデート後の再起動をシミュレートしました。",
        );
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
        console.warn(
          `[Tauri Mock] 未定義のIPCコマンド呼び出しを受信しました: ${cmd}`,
          args,
        );
        return null;
    }
  });
}
