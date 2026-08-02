import { ActionValidationError } from "../errors";
import type { CrossFeatureAction } from "../types";

export interface CreateEventFromNoteInput {
  title: string;
  notes?: string;
}

const MAX_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 10_000;

/**
 * Opens the calendar event editor pre-filled from a note title or a piece of
 * selected text. Nothing in the source note is modified.
 */
export const createEventFromNoteAction: CrossFeatureAction<
  CreateEventFromNoteInput,
  void
> = {
  id: "quick-capture:create-event",
  title: "予定を作成",
  description: "メモのタイトルまたは選択テキストから予定入力画面を開きます。",
  sourceFeature: "quick_capture",
  destinationFeature: "calendar",
  inputSchema: {
    parse(input) {
      if (typeof input !== "object" || input === null) {
        throw new ActionValidationError("入力が正しくありません。");
      }
      const { title, notes } = input as { title?: unknown; notes?: unknown };
      if (typeof title !== "string" || !title.trim()) {
        throw new ActionValidationError("予定のタイトルが必要です。");
      }
      const trimmedTitle = title.trim();
      if (trimmedTitle.length > MAX_TITLE_LENGTH) {
        throw new ActionValidationError("予定のタイトルが長すぎます。");
      }
      if (notes !== undefined && typeof notes !== "string") {
        throw new ActionValidationError("メモの形式が正しくありません。");
      }
      const trimmedNotes = typeof notes === "string" ? notes.trim() : "";
      if (trimmedNotes.length > MAX_NOTES_LENGTH) {
        throw new ActionValidationError("メモが長すぎます。");
      }
      return {
        title: trimmedTitle,
        notes: trimmedNotes || undefined,
      };
    },
  },
  availability(context) {
    if (!context.settings?.calendar.enabled) {
      return {
        available: false,
        reason: "カレンダーが無効になっています。",
        disabledSettingsTarget: {
          tabId: "calendar",
          targetId: "calendar-enabled-checkbox",
        },
      };
    }
    return { available: true };
  },
  async execute(input, context) {
    await context.ports.calendar.openCreateEvent({
      mode: "create",
      draftTitle: input.title,
      draftNotes: input.notes,
    });
    return { status: "success", data: undefined };
  },
};
