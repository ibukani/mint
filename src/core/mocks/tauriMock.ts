import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { DownloadEvent } from "@tauri-apps/plugin-updater";
import type {
  CalendarEventCursor,
  CalendarEventInput,
  CalendarEventRange,
} from "../../features/calendar/types";
import {
  mockCreateCalendarEvent,
  mockDeleteCalendarEvent,
  mockGetNextCalendarEvent,
  mockListCalendarEvents,
  mockUpdateCalendarEvent,
} from "./calendarEventMock";
import { createMockSettings } from "./mockSettings";
import { getMockWindowRegistration } from "./windowRegistration";

// Tauri環境内かどうかを判定（window.__TAURI_INTERNALS__ が存在しない場合はブラウザ環境とみなす）
const isTauri =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !==
    undefined;

declare const process: { env?: { NODE_ENV?: string } } | undefined;
const isTest =
  typeof process !== "undefined" && process?.env?.NODE_ENV === "test";

if (!isTauri && typeof window !== "undefined" && !isTest) {
  console.log(
    "[Tauri Mock] 非Tauri環境（ブラウザ）を検出しました。Tauri APIのモックを初期化します。",
  );

  // クエリパラメータからウィンドウラベルを取得（例: ?label=clock）、指定がなければ "main"
  const params = new URLSearchParams(window.location.search);
  const currentLabel = params.get("label") || "main";
  const mockUpdateAvailable = params.get("mockUpdate") === "available";
  const mockAudioPath = params.get("mockAudioPath");

  // mockWindows の第1引数が現在のウィンドウになるため、URLのlabelを先頭にする。
  const [registeredCurrentLabel, ...additionalWindowLabels] =
    getMockWindowRegistration(currentLabel);
  mockWindows(registeredCurrentLabel, ...additionalWindowLabels);

  // ローカルストレージキー
  const STORAGE_KEY = "mint_mock_settings";

  // Rust側のデフォルト実装と合わせた設定値の初期データ
  const defaultSettings = createMockSettings();

  // IPC（Rust側のコマンド呼び出し）をモック化
  mockIPC(async (cmd, args) => {
    const typedArgs = args as Record<string, unknown> | undefined;
    switch (cmd) {
      case "load_settings": {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            console.log(
              "[Tauri Mock] load_settings: localStorageから読み込みました。",
              parsed,
            );
            return {
              ...defaultSettings,
              ...parsed,
              calendar: {
                ...defaultSettings.calendar,
                ...(parsed.calendar ?? {}),
              },
              gameLauncher: {
                ...defaultSettings.gameLauncher,
                ...(parsed.gameLauncher ?? {}),
              },
            };
          } catch (e) {
            console.error(
              "[Tauri Mock] load_settings: 設定データのパースに失敗しました。デフォルトを返します。",
              e,
            );
          }
        }
        console.log(
          "[Tauri Mock] load_settings: 設定未保存のため、初期設定を返します。",
          defaultSettings,
        );
        return defaultSettings;
      }
      case "save_settings": {
        const settings = typedArgs?.settings;
        if (settings) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
          console.log(
            "[Tauri Mock] save_settings: localStorageに保存しました。",
            settings,
          );
        }
        return;
      }
      case "list_calendar_events": {
        const range = typedArgs?.range as CalendarEventRange | undefined;
        if (!range) throw new Error("Calendar event range is required.");
        return mockListCalendarEvents(range);
      }
      case "get_next_calendar_event": {
        const cursor = typedArgs?.cursor as CalendarEventCursor | undefined;
        if (!cursor) throw new Error("Calendar event cursor is required.");
        return mockGetNextCalendarEvent(cursor);
      }
      case "open_calendar_editor_window": {
        return;
      }
      case "get_calendar_editor_payload": {
        return null;
      }
      case "create_calendar_event": {
        const input = typedArgs?.input as CalendarEventInput | undefined;
        if (!input) throw new Error("Calendar event input is required.");
        return mockCreateCalendarEvent(input);
      }
      case "update_calendar_event": {
        const id = typedArgs?.id as string | undefined;
        const input = typedArgs?.input as CalendarEventInput | undefined;
        if (!id || !input) throw new Error("Calendar event update is invalid.");
        return mockUpdateCalendarEvent(id, input);
      }
      case "delete_calendar_event": {
        const id = typedArgs?.id as string | undefined;
        if (!id) throw new Error("Calendar event id is required.");
        mockDeleteCalendarEvent(id);
        return;
      }
      case "list_installed_games":
        return {
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
      case "launch_game": {
        const request = typedArgs?.request as { id?: string } | undefined;
        if (!request?.id) throw new Error("Game id is required.");
        if (request.id === "launch-error") {
          throw new Error("ゲームクライアントを起動できませんでした。");
        }
        console.log(
          `[Tauri Mock] ゲーム ${request.id} の起動をシミュレートしました。`,
        );
        return;
      }
      case "open_game_store_page": {
        const request = typedArgs?.request as { id?: string } | undefined;
        if (!request?.id) throw new Error("Game id is required.");
        if (request.id === "store-error") {
          throw new Error("ゲームクライアントを起動できませんでした。");
        }
        console.log(
          `[Tauri Mock] ゲーム ${request.id} の管理画面を開きました。`,
        );
        return;
      }
      case "get_google_calendar_connection":
        return {
          connected:
            localStorage.getItem("mint_mock_google_connected") === "true",
          accountEmail: "demo@example.com",
          lastSyncedAt: localStorage.getItem("mint_mock_google_last_sync"),
          pendingOperations: 0,
          error: null,
        };
      case "connect_google_calendar":
        localStorage.setItem("mint_mock_google_connected", "true");
        return {
          connected: true,
          accountEmail: "demo@example.com",
          lastSyncedAt: null,
          pendingOperations: 0,
          error: null,
        };
      case "list_google_calendars":
        return [
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
      case "sync_google_calendars": {
        const syncedAt = new Date().toISOString();
        localStorage.setItem("mint_mock_google_last_sync", syncedAt);
        return {
          syncedCalendars:
            (typedArgs?.calendarIds as string[] | undefined)?.length ?? 0,
          changedEvents: 0,
          pendingOperations: 0,
          syncedAt,
        };
      }
      case "disconnect_google_calendar":
        localStorage.removeItem("mint_mock_google_connected");
        localStorage.removeItem("mint_mock_google_last_sync");
        return;
      case "load_api_key": {
        const service = typedArgs?.service as string | undefined;
        const key =
          (service ? localStorage.getItem(`mock_api_key_${service}`) : "") ||
          "";
        console.log(
          `[Tauri Mock] load_api_key for ${service}:`,
          key ? "***" : "(empty)",
        );
        return key;
      }
      case "save_api_key": {
        const service = typedArgs?.service as string | undefined;
        const key = typedArgs?.key as string | undefined;
        if (service !== undefined && key !== undefined) {
          localStorage.setItem(`mock_api_key_${service}`, key);
          console.log(`[Tauri Mock] save_api_key for ${service} completed.`);
        }
        return;
      }
      case "transcribe_audio_file": {
        const audioFilePath = typedArgs?.audio_file_path as string | undefined;
        const settings = typedArgs?.settings as
          | { enabled?: boolean; model?: string }
          | undefined;
        if (!settings?.enabled) {
          throw new Error("Voice to Text is disabled.");
        }
        if (!audioFilePath?.trim()) {
          throw new Error("Audio file path is required.");
        }
        return {
          text: `[MOCK] ${audioFilePath} を ${settings.model || "default"} で文字起こししました。`,
        };
      }
      case "plugin:updater|check":
        return mockUpdateAvailable
          ? {
              rid: 1,
              currentVersion: "0.1.0",
              version: "0.2.0",
              date: "2026-07-10T00:00:00Z",
              body: "ブラウザ確認用のモックアップデートです。\n更新フローと進捗表示を確認できます。",
              rawJson: {},
            }
          : null;
      case "plugin:dialog|open":
        return mockAudioPath;
      case "plugin:updater|download_and_install": {
        const channel = typedArgs?.onEvent as
          | { onmessage?: (event: DownloadEvent) => void }
          | undefined;
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
        return;
      }
      case "plugin:process|restart":
        console.log(
          "[Tauri Mock] アップデート後の再起動をシミュレートしました。",
        );
        return;
      case "plugin:resources|close":
        return;
      default:
        console.warn(
          `[Tauri Mock] 未定義のIPCコマンド呼び出しを受信しました: ${cmd}`,
          args,
        );
        return null;
    }
  });
}
