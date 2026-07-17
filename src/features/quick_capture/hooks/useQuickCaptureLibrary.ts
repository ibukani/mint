import Fuse from "fuse.js";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { revealElementVertically } from "../../../design/layout";
import type { QuickCaptureNote } from "../types";
import { parseQuickCaptureSearch } from "../utils";

const QUICK_CAPTURE_PAGE_STEP = 5;

interface UseQuickCaptureLibraryProps {
  notes: QuickCaptureNote[];
  activeId: string | null;
  selectNote: (note: QuickCaptureNote) => Promise<void>;
}

export const useQuickCaptureLibrary = ({
  notes,
  activeId,
  selectNote,
}: UseQuickCaptureLibraryProps) => {
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [attachmentsOnly, setAttachmentsOnly] = useState(false);
  const [libraryCursorId, setLibraryCursorId] = useState<string | null>(null);
  const [librarySearchFocused, setLibrarySearchFocused] = useState(false);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const librarySearchFocusedRef = useRef(false);
  const noteListRef = useRef<HTMLDivElement>(null);
  const searchIndexRef = useRef<{
    notes: QuickCaptureNote[];
    index: Fuse<QuickCaptureNote>;
  } | null>(null);
  const parsedQuery = useMemo(() => parseQuickCaptureSearch(query), [query]);
  const filteredBaseNotes = useMemo(
    () =>
      notes.filter(
        (note) =>
          (!(pinnedOnly || parsedQuery.pinnedOnly) || note.pinned) &&
          (!(attachmentsOnly || parsedQuery.attachmentsOnly) ||
            note.attachments.length > 0) &&
          (!tagFilter || note.tags.includes(tagFilter)) &&
          (!parsedQuery.tag ||
            note.tags.some(
              (tag) => tag.toLowerCase() === parsedQuery.tag?.toLowerCase(),
            )),
      ),
    [attachmentsOnly, notes, parsedQuery, pinnedOnly, tagFilter],
  );
  const filteredNotes = useMemo(() => {
    if (!parsedQuery.text) return filteredBaseNotes;
    if (searchIndexRef.current?.notes !== filteredBaseNotes) {
      searchIndexRef.current = {
        notes: filteredBaseNotes,
        index: new Fuse(filteredBaseNotes, {
          keys: ["content", "tags"],
          threshold: 0.35,
          ignoreLocation: true,
        }),
      };
    }
    return searchIndexRef.current.index
      .search(parsedQuery.text)
      .map((result) => result.item);
  }, [filteredBaseNotes, parsedQuery.text]);
  const libraryCursorNote =
    filteredNotes.find((note) => note.id === libraryCursorId) ??
    filteredNotes[0] ??
    null;
  const pinnedCount = useMemo(
    () => notes.filter((note) => note.pinned).length,
    [notes],
  );
  const attachmentCount = useMemo(
    () => notes.filter((note) => note.attachments.length > 0).length,
    [notes],
  );

  const focusSearch = () => {
    const currentNote = filteredNotes.find((note) => note.id === activeId);
    setLibraryCursorId(currentNote?.id ?? filteredNotes[0]?.id ?? null);
    librarySearchRef.current?.focus({ preventScroll: true });
  };

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (query || tagFilter || pinnedOnly || attachmentsOnly) {
        setQuery("");
        setTagFilter(null);
        setPinnedOnly(false);
        setAttachmentsOnly(false);
        setLibraryCursorId(notes[0]?.id ?? null);
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
    const nextIndex =
      event.key === "ArrowDown"
        ? (currentIndex + 1) % filteredNotes.length
        : event.key === "ArrowUp"
          ? (currentIndex - 1 + filteredNotes.length) % filteredNotes.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? filteredNotes.length - 1
              : event.key === "PageDown"
                ? Math.min(
                    filteredNotes.length - 1,
                    currentIndex + QUICK_CAPTURE_PAGE_STEP,
                  )
                : event.key === "PageUp"
                  ? Math.max(0, currentIndex - QUICK_CAPTURE_PAGE_STEP)
                  : null;
    if (event.key === "Enter" && libraryCursorNote) {
      event.preventDefault();
      event.stopPropagation();
      librarySearchRef.current?.blur();
      void selectNote(libraryCursorNote);
      return;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    setLibraryCursorId(filteredNotes[nextIndex]?.id ?? null);
  };

  const handleSearchFocus = () => {
    librarySearchFocusedRef.current = true;
    setLibrarySearchFocused(true);
    setLibraryCursorId(libraryCursorNote?.id ?? filteredNotes[0]?.id ?? null);
  };
  const handleSearchBlur = () => {
    librarySearchFocusedRef.current = false;
    setLibrarySearchFocused(false);
  };
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setLibraryCursorId(null);
  };
  const handleClearFilters = () => {
    setPinnedOnly(false);
    setAttachmentsOnly(false);
    setTagFilter(null);
    setLibraryCursorId(null);
  };
  const handleTogglePinnedOnly = () => {
    setPinnedOnly((value) => !value);
    setLibraryCursorId(null);
  };
  const handleToggleAttachmentsOnly = () => {
    setAttachmentsOnly((value) => !value);
    setLibraryCursorId(null);
  };
  const handleToggleTag = (tag: string) => {
    setTagFilter((current) => (current === tag ? null : tag));
    setLibraryCursorId(null);
  };
  const reset = useCallback(() => {
    setQuery("");
    setTagFilter(null);
    setPinnedOnly(false);
    setAttachmentsOnly(false);
    setLibraryCursorId(null);
  }, []);

  useEffect(() => {
    if (!librarySearchFocused || !libraryCursorNote) return;
    const activeOption = noteListRef.current?.querySelector<HTMLElement>(
      ".quick-capture__note.is-keyboard-active",
    );
    if (noteListRef.current && activeOption) {
      revealElementVertically(noteListRef.current, activeOption, 4);
    }
  }, [libraryCursorNote, librarySearchFocused]);

  return {
    filteredNotes,
    handleClearFilters,
    handleQueryChange,
    handleSearchBlur,
    handleSearchFocus,
    handleSearchKeyDown,
    handleTogglePinnedOnly,
    handleToggleAttachmentsOnly,
    handleToggleTag,
    libraryCursorNote,
    librarySearchFocused,
    librarySearchFocusedRef,
    librarySearchRef,
    noteListRef,
    attachmentCount,
    pinnedCount,
    pinnedOnly,
    attachmentsOnly,
    query,
    reset,
    setLibraryCursorId,
    tagFilter,
    focusSearch,
  };
};
