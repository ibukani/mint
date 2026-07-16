import { save } from "@tauri-apps/plugin-dialog";
import Fuse from "fuse.js";
import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { defaultAppSettings } from "../../../core/defaultSettings";
import {
  getPlatformShortcutModifier,
  isApplePlatform,
  revealElementVertically,
} from "../../../design/layout";
import {
  chooseQuickCaptureBackupForOpen,
  chooseQuickCaptureBackupForSave,
  exportQuickCaptureMarkdown,
} from "../api";
import { useQuickCapture } from "../hooks/useQuickCapture";
import type { QuickCaptureNote } from "../types";
import { noteTitle, parseTags, safeFileName } from "../utils";

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

const QUICK_CAPTURE_PAGE_STEP = 5;

type QuickCaptureConfirmation =
  | { kind: "delete"; note: QuickCaptureNote }
  | { kind: "import"; path: string };

export const useQuickCaptureOverlayController = () => {
  const { settings } = useAppSettings();
  const capture = useQuickCapture();
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const [libraryCursorId, setLibraryCursorId] = useState<string | null>(null);
  const [librarySearchFocused, setLibrarySearchFocused] = useState(false);
  const [confirmation, setConfirmation] =
    useState<QuickCaptureConfirmation | null>(null);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const librarySearchFocusedRef = useRef(false);
  const noteListRef = useRef<HTMLDivElement>(null);
  const noteListId = useId();
  const shortcutModifier = getPlatformShortcutModifier();
  const usesMetaShortcut = isApplePlatform();
  const { focusSequence } = capture;
  const isSaving = capture.status === "saving";
  const activeNote = capture.activeId
    ? (capture.notes.find((note) => note.id === capture.activeId) ?? null)
    : null;

  useEffect(() => {
    void focusSequence;
    if (librarySearchFocusedRef.current) return;
    const focusTarget = preview ? previewRef.current : editorRef.current;
    focusTarget?.focus();
    if (!preview) {
      const length = editorRef.current?.value.length ?? 0;
      editorRef.current?.setSelectionRange(length, length);
    }
  }, [focusSequence, preview]);

  useEffect(() => {
    void focusSequence;
    if (capture.activeId !== null) return;
    setPreview(false);
    setQuery("");
    setTagFilter(null);
    setPinnedOnly(false);
    setActionStatus("");
  }, [capture.activeId, focusSequence]);

  const filteredNotes = useMemo(() => {
    const tagged = capture.notes.filter(
      (note) =>
        (!pinnedOnly || note.pinned) &&
        (!tagFilter || note.tags.includes(tagFilter)),
    );
    if (!query.trim()) return tagged;
    return new Fuse(tagged, {
      keys: ["content", "tags"],
      threshold: 0.35,
      ignoreLocation: true,
    })
      .search(query)
      .map((result) => result.item);
  }, [capture.notes, pinnedOnly, query, tagFilter]);

  const libraryCursorNote =
    filteredNotes.find((note) => note.id === libraryCursorId) ??
    filteredNotes[0] ??
    null;
  const pinnedCount = capture.notes.filter((note) => note.pinned).length;

  useEffect(() => {
    if (!librarySearchFocused || !libraryCursorNote) return;
    const activeOption = noteListRef.current?.querySelector<HTMLElement>(
      ".quick-capture__note.is-keyboard-active",
    );
    if (noteListRef.current && activeOption) {
      revealElementVertically(noteListRef.current, activeOption, 4);
    }
  }, [libraryCursorNote, librarySearchFocused]);

  const focusLibrarySearch = () => {
    const currentNote = filteredNotes.find(
      (note) => note.id === capture.activeId,
    );
    setLibraryCursorId(currentNote?.id ?? filteredNotes[0]?.id ?? null);
    librarySearchRef.current?.focus({ preventScroll: true });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const hasSearchModifier = usesMetaShortcut
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;
    if (
      hasSearchModifier &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLocaleLowerCase() === "f"
    ) {
      event.preventDefault();
      focusLibrarySearch();
    } else if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !isEditableTarget(event.target)
    ) {
      event.preventDefault();
      focusLibrarySearch();
    } else if (event.key === "Escape" || (event.altKey && event.key === "2")) {
      event.preventDefault();
      void capture.close();
    } else if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey) &&
      !isSaving
    ) {
      event.preventDefault();
      void capture.promote();
    } else if (
      event.key.toLocaleLowerCase() === "n" &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      capture.activeId &&
      !isSaving
    ) {
      event.preventDefault();
      void capture.openDraft();
    } else if (
      event.key.toLocaleLowerCase() === "p" &&
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      !event.altKey &&
      capture.activeId &&
      !isSaving
    ) {
      event.preventDefault();
      capture.setPinned(!capture.pinned);
    } else if (
      event.key.toLocaleLowerCase() === "d" &&
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      capture.activeId &&
      !isSaving
    ) {
      event.preventDefault();
      void capture.duplicateActive();
    }
  };

  const handleLibrarySearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (query || tagFilter) {
        setQuery("");
        setTagFilter(null);
        setLibraryCursorId(capture.notes[0]?.id ?? null);
      } else {
        librarySearchRef.current?.blur();
      }
      return;
    }

    if (filteredNotes.length === 0) return;
    const currentIndex = Math.max(
      0,
      filteredNotes.findIndex((note) => note.id === libraryCursorNote?.id),
    );
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % filteredNotes.length;
    } else if (event.key === "ArrowUp") {
      nextIndex =
        (currentIndex - 1 + filteredNotes.length) % filteredNotes.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = filteredNotes.length - 1;
    } else if (event.key === "PageDown") {
      nextIndex = Math.min(
        filteredNotes.length - 1,
        currentIndex + QUICK_CAPTURE_PAGE_STEP,
      );
    } else if (event.key === "PageUp") {
      nextIndex = Math.max(0, currentIndex - QUICK_CAPTURE_PAGE_STEP);
    } else if (event.key === "Enter" && libraryCursorNote) {
      event.preventDefault();
      event.stopPropagation();
      librarySearchRef.current?.blur();
      void capture.selectNote(libraryCursorNote);
      return;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    setLibraryCursorId(filteredNotes[nextIndex]?.id ?? null);
  };

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
      capture.setContent(
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

  const handleLibrarySearchFocus = () => {
    librarySearchFocusedRef.current = true;
    setLibrarySearchFocused(true);
    setLibraryCursorId(libraryCursorNote?.id ?? filteredNotes[0]?.id ?? null);
  };

  const handleLibrarySearchBlur = () => {
    librarySearchFocusedRef.current = false;
    setLibrarySearchFocused(false);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setLibraryCursorId(null);
  };

  const handleClearFilters = () => {
    setPinnedOnly(false);
    setTagFilter(null);
    setLibraryCursorId(null);
  };

  const handleTogglePinnedOnly = () => {
    setPinnedOnly((value) => !value);
    setLibraryCursorId(null);
  };

  const handleToggleTag = (tag: string) => {
    setTagFilter(tagFilter === tag ? null : tag);
    setLibraryCursorId(null);
  };

  const selectLibraryNote = (note: QuickCaptureNote) => {
    setLibraryCursorId(note.id);
    void capture.selectNote(note);
  };

  const cancelConfirmation = () => {
    setConfirmation(null);
    setConfirmationError("");
  };

  const themeColor =
    settings?.quickCapture.themeColor ||
    defaultAppSettings.quickCapture.themeColor;

  return {
    capture,
    themeColor,
    preview,
    setPreview,
    query,
    setQuery,
    tagFilter,
    setTagFilter,
    pinnedOnly,
    setPinnedOnly,
    actionStatus,
    libraryCursorNote,
    librarySearchFocused,
    setLibrarySearchFocused,
    librarySearchFocusedRef,
    confirmation,
    confirmationBusy,
    confirmationError,
    editorRef,
    previewRef,
    librarySearchRef,
    noteListRef,
    noteListId,
    shortcutModifier,
    usesMetaShortcut,
    isSaving,
    activeNote,
    filteredNotes,
    pinnedCount,
    setLibraryCursorId,
    setConfirmationError,
    setConfirmation,
    handleKeyDown,
    handleLibrarySearchKeyDown,
    pasteClipboard,
    copyClipboard,
    copySavedNote,
    exportMarkdown,
    exportBackup,
    requestImportBackup,
    requestDeleteNote,
    confirmDestructiveAction,
    handleLibrarySearchFocus,
    handleLibrarySearchBlur,
    handleQueryChange,
    handleClearFilters,
    handleTogglePinnedOnly,
    handleToggleTag,
    selectLibraryNote,
    cancelConfirmation,
  };
};
