import type React from "react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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

const findMatches = (content: string, query: string) => {
  if (!query) return [] as Array<[number, number]>;
  const matches: Array<[number, number]> = [];
  const haystack = content.toLocaleLowerCase();
  const needle = query.toLocaleLowerCase();
  let start = haystack.indexOf(needle);
  while (start >= 0) {
    matches.push([start, start + needle.length]);
    start = haystack.indexOf(needle, start + Math.max(needle.length, 1));
  }
  return matches;
};

export const useQuickCaptureOverlayController = () => {
  const capture = useQuickCapture();
  const [preview, setPreview] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [editorSearchOpen, setEditorSearchOpen] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [editorSearchQuery, setEditorSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const editorSearchRef = useRef<HTMLInputElement>(null);
  const editorStateRef = useRef(
    new Map<
      string,
      { selectionStart: number; selectionEnd: number; scrollTop: number }
    >(),
  );
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
  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);
  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);
  const createNewNote = useCallback(async () => {
    closeCommandPalette();
    await capture.openDraft();
  }, [capture, closeCommandPalette]);

  const focusEditorMatch = useCallback(
    (direction: 1 | -1 = 1) => {
      const matches = findMatches(capture.content, editorSearchQuery);
      if (matches.length === 0 || !editorRef.current) return;
      const current = editorRef.current.selectionStart;
      const next =
        direction > 0
          ? (matches.find(([start]) => start > current) ?? matches[0])
          : ([...matches].reverse().find(([, end]) => end < current) ??
            matches[matches.length - 1]);
      editorRef.current.focus();
      editorRef.current.setSelectionRange(next[0], next[1]);
    },
    [capture.content, editorSearchQuery],
  );

  const openEditorSearch = useCallback((withReplace = false) => {
    setReplaceMode(withReplace);
    setEditorSearchOpen(true);
    requestAnimationFrame(() => editorSearchRef.current?.focus());
  }, []);

  const focusLibrarySearch = useCallback(() => {
    setLibraryOpen(true);
    requestAnimationFrame(() => library.focusSearch());
  }, [library.focusSearch]);

  const closeEditorSearch = useCallback(() => {
    setEditorSearchOpen(false);
    editorSearchRef.current?.blur();
    editorRef.current?.focus();
  }, []);

  const replaceEditorMatch = useCallback(() => {
    const textarea = editorRef.current;
    if (!textarea || !editorSearchQuery) return;
    const selected = capture.content.slice(
      textarea.selectionStart,
      textarea.selectionEnd,
    );
    if (
      selected.toLocaleLowerCase() !== editorSearchQuery.toLocaleLowerCase()
    ) {
      focusEditorMatch();
      return;
    }
    const start = textarea.selectionStart;
    capture.setContent(
      `${capture.content.slice(0, start)}${replaceQuery}${capture.content.slice(textarea.selectionEnd)}`,
    );
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + replaceQuery.length);
    });
  }, [capture, editorSearchQuery, focusEditorMatch, replaceQuery]);

  const replaceAllEditorMatches = useCallback(() => {
    if (!editorSearchQuery) return;
    const escaped = editorSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    capture.setContent(
      capture.content.replace(new RegExp(escaped, "giu"), replaceQuery),
    );
  }, [capture, editorSearchQuery, replaceQuery]);

  useEffect(() => {
    void capture.focusSequence;
    if (library.librarySearchFocusedRef.current) return;
    const focusTarget = preview ? previewRef.current : editorRef.current;
    focusTarget?.focus();
    if (!preview) {
      const key = capture.activeId ?? "draft";
      const saved = editorStateRef.current.get(key);
      const editor = editorRef.current;
      const length = editor?.value.length ?? 0;
      editor?.setSelectionRange(
        saved?.selectionStart ?? length,
        saved?.selectionEnd ?? saved?.selectionStart ?? length,
      );
      if (saved) editor?.scrollTo({ top: saved.scrollTop });
    }
  }, [
    capture.activeId,
    capture.focusSequence,
    library.librarySearchFocusedRef,
    preview,
  ]);

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

  useEffect(() => {
    if (!editorSearchOpen || !editorSearchQuery) return;
    requestAnimationFrame(() => focusEditorMatch(1));
  }, [editorSearchOpen, editorSearchQuery, focusEditorMatch]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const hasSearchModifier = usesMetaShortcut
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;
    if (
      hasSearchModifier &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLocaleLowerCase() === "k"
    ) {
      event.preventDefault();
      openCommandPalette();
    } else if (
      hasSearchModifier &&
      !event.altKey &&
      event.key.toLocaleLowerCase() === "f"
    ) {
      event.preventDefault();
      if (event.shiftKey) {
        focusLibrarySearch();
      } else {
        openEditorSearch(false);
      }
    } else if (
      hasSearchModifier &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLocaleLowerCase() === "h"
    ) {
      event.preventDefault();
      openEditorSearch(true);
    } else if (event.key === "F3") {
      event.preventDefault();
      focusEditorMatch(event.shiftKey ? -1 : 1);
    } else if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !isEditableTarget(event.target)
    ) {
      event.preventDefault();
      focusLibrarySearch();
    } else if (event.key === "Escape" && editorSearchOpen) {
      event.preventDefault();
      closeEditorSearch();
    } else if (event.key === "Escape" && commandPaletteOpen) {
      event.preventDefault();
      closeCommandPalette();
    } else if (event.key === "Escape" || (event.altKey && event.key === "2")) {
      event.preventDefault();
      void capture.close();
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
      !isSaving
    ) {
      event.preventDefault();
      void createNewNote();
    } else if (
      event.key === "Tab" &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !isSaving
    ) {
      event.preventDefault();
      void capture.cycleTab(event.shiftKey ? -1 : 1);
    } else if (
      event.key.toLocaleLowerCase() === "w" &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !isSaving
    ) {
      event.preventDefault();
      void capture.closeActiveTab();
    } else if (
      hasSearchModifier &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLocaleLowerCase() === "p"
    ) {
      event.preventDefault();
      focusLibrarySearch();
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
      event.key.toLocaleLowerCase() === "a" &&
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      !event.altKey &&
      capture.activeId &&
      !isSaving
    ) {
      event.preventDefault();
      void capture.toggleArchived();
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
    closeCommandPalette();
    setLibraryOpen(false);
    const editor = editorRef.current;
    if (editor) {
      editorStateRef.current.set(capture.activeId ?? "draft", {
        selectionStart: editor.selectionStart,
        selectionEnd: editor.selectionEnd,
        scrollTop: editor.scrollTop,
      });
    }
    library.setLibraryCursorId(note.id);
    void capture.selectNote(note);
  };

  return {
    ...actions,
    ...library,
    activeNote,
    capture,
    closeCommandPalette,
    commandPaletteOpen,
    continueList: actions.continueList,
    createNewNote,
    editorRef,
    handleKeyDown,
    handleLibrarySearchBlur: library.handleSearchBlur,
    handleLibrarySearchFocus: library.handleSearchFocus,
    handleLibrarySearchKeyDown: library.handleSearchKeyDown,
    closeEditorSearch,
    editorSearchOpen,
    editorSearchQuery,
    editorSearchRef,
    focusEditorMatch,
    focusLibrarySearch,
    isSaving,
    indentSelection: actions.indentSelection,
    insertTemplate: actions.insertTemplate,
    formatBlock: actions.formatBlock,
    noteListId,
    libraryOpen,
    openCommandPalette,
    openEditorSearch,
    preview,
    previewRef,
    replaceAllEditorMatches,
    replaceEditorMatch,
    replaceMode,
    replaceQuery,
    selectLibraryNote,
    setPreview,
    setEditorSearchQuery,
    setLibraryOpen,
    setReplaceQuery,
    shortcutModifier,
    usesMetaShortcut,
  };
};
