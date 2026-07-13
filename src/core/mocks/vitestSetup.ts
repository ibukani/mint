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
mockWindows("main", "clock", "calendar", "gameLauncher", "quickCapture");

import { createMockSettings } from "./mockSettings";

// テスト用のデフォルト設定データ
const defaultSettings = createMockSettings();

// テスト中のIPC呼び出しの共通モック定義
mockIPC(async (cmd, args) => {
  const typedArgs = args as Record<string, unknown> | undefined;

  switch (cmd) {
    case "load_settings":
      return defaultSettings;
    case "save_settings":
      return;
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
      };
    case "connect_google_calendar":
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
