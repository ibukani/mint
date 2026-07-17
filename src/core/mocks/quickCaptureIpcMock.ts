import type {
  QuickCaptureAttachmentInput,
  QuickCaptureDraftInput,
  QuickCaptureNoteInput,
} from "../../features/quick_capture/types";
import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";
import {
  mockAddQuickCaptureAttachment,
  mockCreateQuickCaptureNote,
  mockDeleteQuickCaptureAttachment,
  mockDeleteQuickCaptureNote,
  mockLoadQuickCaptureState,
  mockPromoteQuickCaptureNote,
  mockRestoreQuickCaptureNote,
  mockSaveQuickCaptureDraft,
  mockUpdateQuickCaptureNote,
} from "./quickCaptureMock";

export interface QuickCaptureIpcMockOptions {
  onExportMarkdown?: (args: MockIPCArgs) => unknown | Promise<unknown>;
  onExportBackup?: (args: MockIPCArgs) => unknown | Promise<unknown>;
}

export async function handleQuickCaptureIpcCommand(
  command: string,
  args: MockIPCArgs,
  options: QuickCaptureIpcMockOptions = {},
): Promise<MockIPCResult> {
  switch (command) {
    case "load_quick_capture_state":
      return handled(mockLoadQuickCaptureState());
    case "save_quick_capture_draft": {
      const input = args?.input as QuickCaptureDraftInput | undefined;
      if (!input) throw new Error("Quick capture draft input is required.");
      return handled(mockSaveQuickCaptureDraft(input));
    }
    case "promote_quick_capture_note": {
      const input = args?.input as QuickCaptureNoteInput | undefined;
      if (!input) throw new Error("Quick capture note input is required.");
      return handled(mockPromoteQuickCaptureNote(input));
    }
    case "create_quick_capture_note": {
      const input = args?.input as QuickCaptureNoteInput | undefined;
      if (!input) throw new Error("Quick capture note input is required.");
      return handled(mockCreateQuickCaptureNote(input));
    }
    case "update_quick_capture_note": {
      const id = args?.id as string | undefined;
      const input = args?.input as QuickCaptureNoteInput | undefined;
      if (!id || !input) {
        throw new Error("Quick capture note update is invalid.");
      }
      return handled(mockUpdateQuickCaptureNote(id, input));
    }
    case "delete_quick_capture_note": {
      const id = args?.id as string | undefined;
      if (!id) throw new Error("Quick capture note id is required.");
      mockDeleteQuickCaptureNote(id);
      return handled(undefined);
    }
    case "restore_quick_capture_note": {
      const id = args?.id as string | undefined;
      if (!id) throw new Error("Quick capture note id is required.");
      return handled(mockRestoreQuickCaptureNote(id));
    }
    case "add_quick_capture_attachment": {
      const input = args?.input as QuickCaptureAttachmentInput | undefined;
      if (!input) {
        throw new Error("Quick capture attachment input is required.");
      }
      return handled(mockAddQuickCaptureAttachment(input));
    }
    case "delete_quick_capture_attachment": {
      const noteId = args?.noteId as string | undefined;
      const attachmentId = args?.attachmentId as string | undefined;
      if (!noteId || !attachmentId) {
        throw new Error("Quick capture attachment id is required.");
      }
      mockDeleteQuickCaptureAttachment(noteId, attachmentId);
      return handled(undefined);
    }
    case "export_quick_capture_markdown":
      return handled(await options.onExportMarkdown?.(args));
    case "export_quick_capture_backup":
      return handled(await options.onExportBackup?.(args));
    case "import_quick_capture_backup":
      return handled(mockLoadQuickCaptureState());
    default:
      return unhandled();
  }
}
