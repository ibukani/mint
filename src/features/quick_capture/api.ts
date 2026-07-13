import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  QuickCaptureAttachment,
  QuickCaptureAttachmentInput,
  QuickCaptureDraft,
  QuickCaptureDraftInput,
  QuickCaptureExportInput,
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

export const chooseQuickCaptureAttachment = () =>
  open({
    title: "メモに添付するファイルを選択",
    multiple: false,
    directory: false,
  });

export const addQuickCaptureAttachment = (input: QuickCaptureAttachmentInput) =>
  invoke<QuickCaptureAttachment>("add_quick_capture_attachment", { input });

export const deleteQuickCaptureAttachment = (
  noteId: string,
  attachmentId: string,
) =>
  invoke<void>("delete_quick_capture_attachment", {
    noteId,
    attachmentId,
  });

export const exportQuickCaptureMarkdown = (input: QuickCaptureExportInput) =>
  invoke<void>("export_quick_capture_markdown", { input });

export const chooseQuickCaptureBackupForSave = () =>
  save({
    title: "クイックキャプチャーをバックアップ",
    defaultPath: "mint-quick-capture.mintbackup",
    filters: [{ name: "Mintバックアップ", extensions: ["mintbackup"] }],
  });

export const chooseQuickCaptureBackupForOpen = () =>
  open({
    title: "クイックキャプチャーのバックアップを選択",
    multiple: false,
    directory: false,
    filters: [{ name: "Mintバックアップ", extensions: ["mintbackup"] }],
  });

export const exportQuickCaptureBackup = (path: string) =>
  invoke<void>("export_quick_capture_backup", { path });

export const importQuickCaptureBackup = (path: string) =>
  invoke<QuickCaptureState>("import_quick_capture_backup", { path });
