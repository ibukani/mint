import { save } from "@tauri-apps/plugin-dialog";
import { type RefObject, useCallback, useState } from "react";
import {
  chooseQuickCaptureBackupForOpen,
  chooseQuickCaptureBackupForSave,
  exportQuickCaptureMarkdown,
} from "../api";
import type { QuickCaptureTemplate } from "../templates";
import type { QuickCaptureNote } from "../types";
import {
  continueMarkdownList,
  indentMarkdownSelection,
  insertMarkdownTemplate,
  type MarkdownTextEdit,
  mergeTags,
  noteTitle,
  parseTags,
  safeFileName,
} from "../utils";

export type QuickCaptureConfirmation =
  | { kind: "delete"; note: QuickCaptureNote }
  | { kind: "import"; path: string };

interface CaptureActionSource {
  content: string;
  tags: string;
  captureText: (text: string) => Promise<boolean>;
  setTags: (value: string) => void;
  exportBackup: (path: string) => Promise<void>;
  importBackup: (path: string) => Promise<string | null>;
  removeNote: (noteId: string) => Promise<string | null>;
  withAutoHideSuspended: <T>(operation: () => Promise<T>) => Promise<T>;
}

interface UseQuickCaptureOverlayActionsProps {
  capture: CaptureActionSource;
  editorRef: RefObject<HTMLTextAreaElement | null>;
  setContent: (value: string) => void;
}

export const useQuickCaptureOverlayActions = ({
  capture,
  editorRef,
  setContent,
}: UseQuickCaptureOverlayActionsProps) => {
  const [actionStatus, setActionStatus] = useState("");
  const [confirmation, setConfirmation] =
    useState<QuickCaptureConfirmation | null>(null);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const clearActionStatus = useCallback(() => setActionStatus(""), []);

  const applyEditorEdit = useCallback(
    (edit: MarkdownTextEdit) => {
      setContent(edit.content);
      requestAnimationFrame(() => {
        const textarea = editorRef.current;
        textarea?.focus();
        textarea?.setSelectionRange(edit.selectionStart, edit.selectionEnd);
      });
    },
    [editorRef, setContent],
  );

  const pasteClipboard = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (!value) {
        setActionStatus("クリップボードが空です");
        return;
      }
      const textarea = editorRef.current;
      const start = textarea?.selectionStart ?? capture.content.length;
      const end = textarea?.selectionEnd ?? start;
      setContent(
        `${capture.content.slice(0, start)}${value}${capture.content.slice(end)}`,
      );
      setActionStatus("貼り付けました");
      requestAnimationFrame(() => {
        textarea?.focus();
        textarea?.setSelectionRange(start + value.length, start + value.length);
      });
    } catch {
      setActionStatus("クリップボードを読み取れませんでした");
    }
  };

  const copyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(capture.content);
      setActionStatus("クリップボードへコピーしました");
    } catch {
      setActionStatus("クリップボードへコピーできませんでした");
    }
  };

  const copySavedNote = async (note: QuickCaptureNote) => {
    try {
      await navigator.clipboard.writeText(note.content);
      setActionStatus("メモをクリップボードへコピーしました");
    } catch {
      setActionStatus("メモをコピーできませんでした");
    }
  };

  const formatSelection = (
    prefix: string,
    suffix: string,
    fallbackText: string,
  ) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = capture.content.slice(start, end);
    const replacement = selected || fallbackText;
    const nextContent = `${capture.content.slice(0, start)}${prefix}${replacement}${suffix}${capture.content.slice(end)}`;
    const nextStart = start + prefix.length;
    const nextEnd = nextStart + replacement.length;
    applyEditorEdit({
      content: nextContent,
      selectionStart: selected ? nextEnd + suffix.length : nextStart,
      selectionEnd: selected ? nextEnd + suffix.length : nextEnd,
    });
  };

  const continueList = () => {
    const textarea = editorRef.current;
    if (!textarea) return false;
    const edit = continueMarkdownList(
      capture.content,
      textarea.selectionStart,
      textarea.selectionEnd,
    );
    if (!edit) return false;
    applyEditorEdit(edit);
    return true;
  };

  const indentSelection = (outdent: boolean) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    applyEditorEdit(
      indentMarkdownSelection(
        capture.content,
        textarea.selectionStart,
        textarea.selectionEnd,
        outdent,
      ),
    );
  };

  const insertTemplate = (template: QuickCaptureTemplate) => {
    const textarea = editorRef.current;
    const start = textarea?.selectionStart ?? capture.content.length;
    const end = textarea?.selectionEnd ?? start;
    applyEditorEdit(
      insertMarkdownTemplate(capture.content, start, end, template),
    );
    capture.setTags(mergeTags(capture.tags, template.tags));
    setActionStatus(`${template.label}テンプレートを挿入しました`);
  };

  const captureClipboard = async () => {
    try {
      const value = await navigator.clipboard.readText();
      if (!value.trim()) {
        setActionStatus("クリップボードが空です");
        return;
      }
      if (await capture.captureText(value)) {
        setActionStatus("クリップボードを新しいメモとして保存しました");
      }
    } catch {
      setActionStatus("クリップボードを読み取れませんでした");
    }
  };

  const exportMarkdown = async () => {
    try {
      const path = await capture.withAutoHideSuspended(() =>
        save({
          title: "Markdownとして書き出す",
          defaultPath: safeFileName(noteTitle({ content: capture.content })),
          filters: [{ name: "Markdown", extensions: ["md"] }],
        }),
      );
      if (!path) return;
      await exportQuickCaptureMarkdown({
        path,
        content: capture.content,
        tags: parseTags(capture.tags),
      });
      setActionStatus("Markdownを書き出しました");
    } catch (reason) {
      setActionStatus(
        reason instanceof Error ? reason.message : "書き出しに失敗しました",
      );
    }
  };

  const exportBackup = async () => {
    try {
      const path = await capture.withAutoHideSuspended(() =>
        chooseQuickCaptureBackupForSave(),
      );
      if (path) await capture.exportBackup(path);
    } catch (reason) {
      setActionStatus(
        reason instanceof Error ? reason.message : "バックアップに失敗しました",
      );
    }
  };

  const requestImportBackup = async () => {
    try {
      const path = await capture.withAutoHideSuspended(() =>
        chooseQuickCaptureBackupForOpen(),
      );
      if (path && !Array.isArray(path)) {
        setConfirmationError("");
        setConfirmation({ kind: "import", path });
      }
    } catch (reason) {
      setActionStatus(
        reason instanceof Error ? reason.message : "復元に失敗しました",
      );
    }
  };

  const requestDeleteNote = (note: QuickCaptureNote) => {
    setConfirmationError("");
    setConfirmation({ kind: "delete", note });
  };

  const confirmDestructiveAction = async () => {
    if (!confirmation) return;
    setConfirmationBusy(true);
    setConfirmationError("");
    const operationError =
      confirmation.kind === "delete"
        ? await capture.removeNote(confirmation.note.id)
        : await capture.importBackup(confirmation.path);
    if (operationError) setConfirmationError(operationError);
    else setConfirmation(null);
    setConfirmationBusy(false);
  };

  return {
    actionStatus,
    clearActionStatus,
    cancelConfirmation: () => {
      setConfirmation(null);
      setConfirmationError("");
    },
    captureClipboard,
    confirmation,
    confirmationBusy,
    confirmationError,
    confirmDestructiveAction,
    copyClipboard,
    copySavedNote,
    continueList,
    exportBackup,
    exportMarkdown,
    formatSelection,
    indentSelection,
    insertTemplate,
    pasteClipboard,
    requestDeleteNote,
    requestImportBackup,
  };
};
