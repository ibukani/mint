import type React from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAppSettings } from "../../../core/context/AppSettings";
import { defaultAppSettings } from "../../../core/defaultSettings";
import {
  getPlatformShortcutModifier,
  isApplePlatform,
} from "../../../design/layout";
import { useQuickCapture } from "../hooks/useQuickCapture";
import type { QuickCaptureNote } from "../types";
import { useQuickCaptureLibrary } from "./useQuickCaptureLibrary";
import { useQuickCaptureOverlayActions } from "./useQuickCaptureOverlayActions";

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);

export const useQuickCaptureOverlayController = () => {
  const { settings } = useAppSettings();
  const capture = useQuickCapture();
  const [preview, setPreview] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const noteListId = useId();
  const previousActiveIdRef = useRef<string | null>(null);
  const shortcutModifier = getPlatformShortcutModifier();
  const usesMetaShortcut = isApplePlatform();
  const isSaving = capture.status === "saving";
  const activeNote = useMemo(
    () =>
      capture.activeId
        ? (capture.notes.find((note) => note.id === capture.activeId) ?? null)
        : null,
    [capture.activeId, capture.notes],
  );
  const library = useQuickCaptureLibrary({
    notes: capture.notes,
    activeId: capture.activeId,
    selectNote: capture.selectNote,
  });
  const actions = useQuickCaptureOverlayActions({
    capture,
    editorRef,
    setContent: capture.setContent,
  });

  useEffect(() => {
    void capture.focusSequence;
    if (library.librarySearchFocusedRef.current) return;
    const focusTarget = preview ? previewRef.current : editorRef.current;
    focusTarget?.focus();
    if (!preview) {
      const length = editorRef.current?.value.length ?? 0;
      editorRef.current?.setSelectionRange(length, length);
    }
  }, [capture.focusSequence, library.librarySearchFocusedRef, preview]);

  useEffect(() => {
    void capture.focusSequence;
    if (capture.activeId === null) {
      setPreview(false);
      library.reset();
    }
  }, [capture.activeId, capture.focusSequence, library.reset]);

  useEffect(() => {
    if (capture.activeId === null && previousActiveIdRef.current !== null) {
      actions.clearActionStatus();
    }
    previousActiveIdRef.current = capture.activeId;
  }, [actions.clearActionStatus, capture.activeId]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const hasSearchModifier = usesMetaShortcut
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;
    if (
      hasSearchModifier &&
      !event.altKey &&
      !event.shiftKey &&
      ["f", "k"].includes(event.key.toLocaleLowerCase())
    ) {
      event.preventDefault();
      library.focusSearch();
    } else if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !isEditableTarget(event.target)
    ) {
      event.preventDefault();
      library.focusSearch();
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
      event.key.toLocaleLowerCase() === "s" &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      !isSaving
    ) {
      event.preventDefault();
      void capture.retrySave();
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

  const selectLibraryNote = (note: QuickCaptureNote) => {
    library.setLibraryCursorId(note.id);
    void capture.selectNote(note);
  };

  return {
    ...actions,
    ...library,
    activeNote,
    capture,
    continueList: actions.continueList,
    editorRef,
    handleKeyDown,
    handleLibrarySearchBlur: library.handleSearchBlur,
    handleLibrarySearchFocus: library.handleSearchFocus,
    handleLibrarySearchKeyDown: library.handleSearchKeyDown,
    isSaving,
    indentSelection: actions.indentSelection,
    insertTemplate: actions.insertTemplate,
    formatBlock: actions.formatBlock,
    noteListId,
    preview,
    previewRef,
    selectLibraryNote,
    setPreview,
    shortcutModifier,
    themeColor:
      settings?.quickCapture.themeColor ||
      defaultAppSettings.quickCapture.themeColor,
    usesMetaShortcut,
  };
};
