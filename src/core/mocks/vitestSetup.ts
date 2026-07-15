import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { DownloadEvent } from "@tauri-apps/plugin-updater";
import "@testing-library/jest-dom";
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

// テスト中のIPC呼び出しの共通モック定義
mockIPCWithEvents(async (cmd, args) => {
  const typedArgs = args as Record<string, unknown> | undefined;

  switch (cmd) {
    case "load_settings":
      return defaultSettings;
    case "save_settings":
      return;
    case "open_overlay": {
      const target = typedArgs?.target as string | undefined;
      const allowedTargets = [
        "clock",
        "calendar",
        "gameLauncher",
        "quickCapture",
        "fileShelf",
      ];
      if (!target || !allowedTargets.includes(target)) {
        throw new Error("利用できないオーバーレイです。");
      }
      return;
    }
    case "list_calendar_events": {
      const range = typedArgs?.range as CalendarEventRange | undefined;
      return range ? mockListCalendarEvents(range) : [];
    }
    case "get_next_calendar_event": {
      const cursor = typedArgs?.cursor as CalendarEventCursor | undefined;
      return cursor ? mockGetNextCalendarEvent(cursor) : null;
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
    case "should_auto_expand_file_shelf":
      return true;
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
      const input = typedArgs?.input as QuickCaptureAttachmentInput | undefined;
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
    case "export_quick_capture_markdown":
      return;
    case "export_quick_capture_backup":
      return;
    case "import_quick_capture_backup":
      return mockLoadQuickCaptureState();
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
    case "launch_game":
    case "open_game_store_page":
      return;
    case "get_google_calendar_connection":
      return {
        connected: false,
        accountEmail: "",
        lastSyncedAt: null,
        pendingOperations: 0,
        error: null,
        syncing: false,
      };
    case "connect_google_calendar":
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
      ];
    case "sync_google_calendars":
      return {
        syncedCalendars:
          (typedArgs?.calendarIds as string[] | undefined)?.length ?? 0,
        changedEvents: 0,
        pendingOperations: 0,
        syncedAt: new Date().toISOString(),
      };
    case "disconnect_google_calendar":
      return;
    case "load_api_key":
      return "mock-api-key";
    case "save_api_key":
      return;
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
      return {
        text: `[MOCK] マイク録音（${fileName}）を ${settings.model || "default"} で文字起こししました。`,
      };
    }
    case "plugin:updater|check":
      return null;
    case "plugin:dialog|save":
      return "/tmp/quick-capture.mintbackup";
    case "plugin:updater|download_and_install": {
      const channel = typedArgs?.onEvent as
        | { onmessage?: (event: DownloadEvent) => void }
        | undefined;
      channel?.onmessage?.({
        event: "Started",
        data: { contentLength: 100 },
      });
      channel?.onmessage?.({ event: "Progress", data: { chunkLength: 100 } });
      channel?.onmessage?.({ event: "Finished" });
      return;
    }
    case "plugin:process|restart":
    case "plugin:resources|close":
      return;
    default:
      return null;
  }
});
