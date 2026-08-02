import { emit } from "@tauri-apps/api/event";
import type { QuickCapturePort } from "../../core/actions/ports";
import { createQuickCaptureNote } from "./api";
import { QUICK_CAPTURE_NOTE_CREATED_EVENT } from "./events";
import type { QuickCaptureNoteInput } from "./types";

/**
 * Public quick-capture port. Wraps the IPC wrapper and keeps the
 * "note created" notification in a single place so every caller (the editor
 * itself, Voice to Text, cross-feature actions) behaves identically.
 */
export const quickCapturePort: QuickCapturePort = {
  async createNote(input: QuickCaptureNoteInput) {
    const note = await createQuickCaptureNote(input);
    void emit(QUICK_CAPTURE_NOTE_CREATED_EVENT, { note }).catch((error) => {
      console.warn("Failed to notify quick capture note creation", error);
    });
    return note;
  },
};
