import type { QuickCaptureNote } from "./types";

export const QUICK_CAPTURE_NOTE_CREATED_EVENT = "quick-capture-note-created";

export interface QuickCaptureNoteCreatedPayload {
  note: QuickCaptureNote;
}
