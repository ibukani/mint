import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { DownloadEvent } from "@tauri-apps/plugin-updater";
import type {
  CalendarEditorPayload,
  CalendarEventCursor,
  CalendarEventInput,
  CalendarEventRange,
} from "../../features/calendar/types";
import type {
  AddFileShelfContentInput,
  AddFileShelfPathsInput,
} from "../../features/file_shelf/types";
import type {
  QuickCaptureAttachmentInput,
  QuickCaptureDraftInput,
  QuickCaptureNoteInput,
} from "../../features/quick_capture/types";
import {
  mockCreateCalendarEvent,
  mockDeleteCalendarEvent,
  mockGetNextCalendarEvent,
  mockListCalendarEvents,
  mockUpdateCalendarEvent,
} from "./calendarEventMock";
import {
  mockAddFileShelfContent,
  mockAddFileShelfPaths,
  mockCaptureFileShelfClipboardText,
  mockClearFileShelf,
  mockClearFileShelfClipboardHistory,
  mockLoadFileShelfPreview,
  mockLoadFileShelfState,
  mockRemoveFileShelfItems,
  mockRenameFileShelfItem,
  mockRestoreFileShelfRemoval,
  mockRestoreRecentFileShelfRemoval,
  mockSetFileShelfItemsPinned,
} from "./fileShelfMock";
import { createMockSettings } from "./mockSettings";
import {
  mockAddQuickCaptureAttachment,
  mockCreateQuickCaptureNote,
  mockDeleteQuickCaptureAttachment,
  mockDeleteQuickCaptureNote,
  mockLoadQuickCaptureState,
  mockPromoteQuickCaptureNote,
  mockSaveQuickCaptureDraft,
  mockUpdateQuickCaptureNote,
} from "./quickCaptureMock";
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
  const mockAudioPath = params.get("mockAudioPath");
  const mockClipboardHistory = params.get("mockClipboardHistory");
  if (mockClipboardHistory) {
    mockCaptureFileShelfClipboardText(mockClipboardHistory);
  }

  // mockWindows の第1引数が現在のウィンドウになるため、URLのlabelを先頭にする。
  const [registeredCurrentLabel, ...additionalWindowLabels] =
    getMockWindowRegistration(currentLabel);
  mockWindows(registeredCurrentLabel, ...additionalWindowLabels);

  // ローカルストレージキー
  const STORAGE_KEY = "mint_mock_settings";

  // Rust側のデフォルト実装と合わせた設定値の初期データ
  const defaultSettings = createMockSettings();

  // IPC（Rust側のコマンド呼び出し）をモック化
  mockIPCWithEvents(async (cmd, args) => {
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
              quickCapture: {
                ...defaultSettings.quickCapture,
                ...(parsed.quickCapture ?? {}),
              },
              fileShelf: {
                ...defaultSettings.fileShelf,
                ...(parsed.fileShelf ?? {}),
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
      case "open_overlay": {
        const target = typedArgs?.target as string | undefined;
        const enabledByTarget: Record<string, boolean> = {
          clock: defaultSettings.clock.enabled,
          calendar: defaultSettings.calendar.enabled,
          gameLauncher: defaultSettings.gameLauncher.enabled,
          quickCapture: defaultSettings.quickCapture.enabled,
          fileShelf: defaultSettings.fileShelf.enabled,
        };
        if (!target || !(target in enabledByTarget)) {
          throw new Error("利用できないオーバーレイです。");
        }
        let enabled = enabledByTarget[target];
        const storedSettings = localStorage.getItem(STORAGE_KEY);
        if (storedSettings) {
          try {
            const parsed = JSON.parse(storedSettings) as Record<
              string,
              unknown
            >;
            const featureSettings = parsed[target];
            if (
              featureSettings &&
              typeof featureSettings === "object" &&
              "enabled" in featureSettings
            ) {
              enabled = Boolean(
                (featureSettings as { enabled?: unknown }).enabled,
              );
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
        const payload = typedArgs?.payload as CalendarEditorPayload | undefined;
        const mode = payload?.mode;
        if (
          !mode ||
          !["create", "edit", "duplicate"].includes(mode) ||
          (mode === "edit" && !payload?.event) ||
          (mode === "duplicate" && !payload?.template)
        ) {
          throw new Error("Calendar editor payload is required.");
        }
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
      case "load_quick_capture_state":
        return mockLoadQuickCaptureState();
      case "load_file_shelf_state":
        return mockLoadFileShelfState();
      case "load_file_shelf_preview": {
        const itemId = typedArgs?.itemId as string | undefined;
        if (!itemId) throw new Error("File shelf item id is required.");
        return mockLoadFileShelfPreview(itemId);
      }
      case "add_file_shelf_paths": {
        const input = typedArgs?.input as AddFileShelfPathsInput | undefined;
        if (!input) throw new Error("File shelf paths are required.");
        return mockAddFileShelfPaths(input);
      }
      case "add_file_shelf_content": {
        const input = typedArgs?.input as AddFileShelfContentInput | undefined;
        if (!input) throw new Error("File shelf content is required.");
        return mockAddFileShelfContent(input);
      }
      case "remove_file_shelf_items": {
        const itemIds = typedArgs?.itemIds as string[] | undefined;
        if (!itemIds) throw new Error("File shelf item ids are required.");
        return mockRemoveFileShelfItems(itemIds);
      }
      case "set_file_shelf_items_pinned": {
        const itemIds = typedArgs?.itemIds as string[] | undefined;
        const pinned = typedArgs?.pinned as boolean | undefined;
        if (!itemIds || pinned === undefined) {
          throw new Error("File shelf pin state is required.");
        }
        return mockSetFileShelfItemsPinned(itemIds, pinned);
      }
      case "rename_file_shelf_item": {
        const itemId = typedArgs?.itemId as string | undefined;
        const displayName = typedArgs?.displayName as string | undefined;
        if (!itemId || displayName === undefined) {
          throw new Error("File shelf rename input is required.");
        }
        return mockRenameFileShelfItem(itemId, displayName);
      }
      case "restore_file_shelf_removal": {
        const undoToken = typedArgs?.undoToken as string | undefined;
        if (!undoToken) throw new Error("File shelf undo token is required.");
        return mockRestoreFileShelfRemoval(undoToken);
      }
      case "restore_recent_file_shelf_removal":
        return mockRestoreRecentFileShelfRemoval();
      case "clear_file_shelf":
        return mockClearFileShelf();
      case "clear_file_shelf_clipboard_history":
        return mockClearFileShelfClipboardHistory();
      case "should_auto_expand_file_shelf": {
        const sourceApplication = params.get("mockShelfSourceApp");
        if (!sourceApplication) return true;
        let ignoredApplications = defaultSettings.fileShelf.ignoredApplications;
        const storedSettings = localStorage.getItem(STORAGE_KEY);
        if (storedSettings) {
          try {
            const parsed = JSON.parse(storedSettings) as {
              fileShelf?: { ignoredApplications?: unknown };
            };
            if (Array.isArray(parsed.fileShelf?.ignoredApplications)) {
              ignoredApplications = parsed.fileShelf.ignoredApplications.filter(
                (value): value is string => typeof value === "string",
              );
            }
          } catch {
            // Invalid settings use the same defaults as load_settings.
          }
        }
        return !ignoredApplications.some(
          (application) =>
            application.toLocaleLowerCase() ===
            sourceApplication.toLocaleLowerCase(),
        );
      }
      case "set_file_shelf_expanded":
        return;
      case "save_quick_capture_draft": {
        const input = typedArgs?.input as QuickCaptureDraftInput | undefined;
        if (!input) throw new Error("Quick capture draft input is required.");
        return mockSaveQuickCaptureDraft(input);
      }
      case "promote_quick_capture_note": {
        const input = typedArgs?.input as QuickCaptureNoteInput | undefined;
        if (!input) throw new Error("Quick capture note input is required.");
        return mockPromoteQuickCaptureNote(input);
      }
      case "create_quick_capture_note": {
        const input = typedArgs?.input as QuickCaptureNoteInput | undefined;
        if (!input) throw new Error("Quick capture note input is required.");
        return mockCreateQuickCaptureNote(input);
      }
      case "update_quick_capture_note": {
        const id = typedArgs?.id as string | undefined;
        const input = typedArgs?.input as QuickCaptureNoteInput | undefined;
        if (!id || !input)
          throw new Error("Quick capture note update is invalid.");
        return mockUpdateQuickCaptureNote(id, input);
      }
      case "delete_quick_capture_note": {
        const id = typedArgs?.id as string | undefined;
        if (!id) throw new Error("Quick capture note id is required.");
        mockDeleteQuickCaptureNote(id);
        return;
      }
      case "add_quick_capture_attachment": {
        const input = typedArgs?.input as
          | QuickCaptureAttachmentInput
          | undefined;
        if (!input)
          throw new Error("Quick capture attachment input is required.");
        return mockAddQuickCaptureAttachment(input);
      }
      case "delete_quick_capture_attachment": {
        const noteId = typedArgs?.noteId as string | undefined;
        const attachmentId = typedArgs?.attachmentId as string | undefined;
        if (!noteId || !attachmentId) {
          throw new Error("Quick capture attachment id is required.");
        }
        mockDeleteQuickCaptureAttachment(noteId, attachmentId);
        return;
      }
      case "export_quick_capture_markdown": {
        const input = typedArgs?.input as
          | { path?: string; content?: string }
          | undefined;
        if (!input?.path || !input.content?.trim()) {
          throw new Error("Markdown export input is invalid.");
        }
        localStorage.setItem(
          "mint_mock_last_markdown_export",
          JSON.stringify(input),
        );
        return;
      }
      case "export_quick_capture_backup": {
        const path = typedArgs?.path as string | undefined;
        if (!path?.trim())
          throw new Error("Quick capture backup path is required.");
        localStorage.setItem("mint_mock_last_backup_path", path);
        return;
      }
      case "import_quick_capture_backup": {
        const path = typedArgs?.path as string | undefined;
        if (!path?.trim())
          throw new Error("Quick capture backup path is required.");
        return mockLoadQuickCaptureState();
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
          syncing: localStorage.getItem("mint_mock_google_syncing") === "true",
        };
      case "connect_google_calendar":
        await waitForMockOperation(450);
        localStorage.setItem("mint_mock_google_connected", "true");
        return {
          connected: true,
          accountEmail: "demo@example.com",
          lastSyncedAt: null,
          pendingOperations: 0,
          error: null,
          syncing: false,
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
        localStorage.setItem("mint_mock_google_syncing", "true");
        await waitForMockOperation(650);
        const syncedAt = new Date().toISOString();
        localStorage.setItem("mint_mock_google_last_sync", syncedAt);
        localStorage.removeItem("mint_mock_google_syncing");
        return {
          syncedCalendars:
            (typedArgs?.calendarIds as string[] | undefined)?.length ?? 0,
          changedEvents: 0,
          pendingOperations: 0,
          syncedAt,
        };
      }
      case "disconnect_google_calendar":
        await waitForMockOperation(350);
        localStorage.removeItem("mint_mock_google_connected");
        localStorage.removeItem("mint_mock_google_last_sync");
        localStorage.removeItem("mint_mock_google_syncing");
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
          | { enabled?: boolean; baseUrl?: string; model?: string }
          | undefined;
        if (!settings?.enabled) {
          throw new Error("音声入力を有効にしてください。");
        }
        if (!audioFilePath?.trim()) {
          throw new Error("音声ファイルを選択してください。");
        }
        if (!settings.baseUrl?.trim() || !settings.model?.trim()) {
          throw new Error("API接続設定を確認してください。");
        }
        if (audioFilePath === "/missing/audio.wav") {
          throw new Error(
            "音声ファイルが見つかりません。移動または削除されていないか確認してください。",
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 350));
        return {
          text: `[MOCK] ${audioFilePath} を ${settings.model || "default"} で文字起こししました。`,
        };
      }
      case "transcribe_audio_recording": {
        const audioData = typedArgs?.audio_data as number[] | undefined;
        const fileName = typedArgs?.file_name as string | undefined;
        const settings = typedArgs?.settings as
          | { enabled?: boolean; baseUrl?: string; model?: string }
          | undefined;
        if (!settings?.enabled) {
          throw new Error("音声入力を有効にしてください。");
        }
        if (!audioData?.length || !fileName?.trim()) {
          throw new Error("録音データがありません。もう一度録音してください。");
        }
        if (!settings.baseUrl?.trim() || !settings.model?.trim()) {
          throw new Error("API接続設定を確認してください。");
        }
        await new Promise((resolve) => setTimeout(resolve, 350));
        return {
          text: `[MOCK] マイク録音（${fileName}）を ${settings.model || "default"} で文字起こししました。`,
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
      case "plugin:dialog|save":
        return "/tmp/quick-capture.md";
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
