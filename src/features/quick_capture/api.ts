import { invoke } from "@tauri-apps/api/core";
import type {
  QuickCaptureDraft,
  QuickCaptureDraftInput,
  QuickCaptureNote,
  QuickCaptureNoteInput,
  QuickCaptureState,
} from "./types";

export const loadQuickCaptureState = () =>
  invoke<QuickCaptureState>("load_quick_capture_state");

export const saveQuickCaptureDraft = (input: QuickCaptureDraftInput) =>
  invoke<QuickCaptureDraft>("save_quick_capture_draft", { input });

export const createQuickCaptureNote = (input: QuickCaptureNoteInput) =>
  invoke<QuickCaptureNote>("create_quick_capture_note", { input });

export const updateQuickCaptureNote = (
  id: string,
  input: QuickCaptureNoteInput,
) => invoke<QuickCaptureNote>("update_quick_capture_note", { id, input });

export const deleteQuickCaptureNote = (id: string) =>
  invoke<void>("delete_quick_capture_note", { id });
