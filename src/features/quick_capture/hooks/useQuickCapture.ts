import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createQuickCaptureNote,
  deleteQuickCaptureNote,
  loadQuickCaptureState,
  restoreQuickCaptureNote,
  setQuickCaptureNoteArchived,
  updateQuickCaptureNote,
} from "../api";
import type { QuickCaptureNote } from "../types";
import { parseTags } from "../utils";
import { useQuickCaptureAttachments } from "./useQuickCaptureAttachments";
import { useQuickCaptureWindowLifecycle } from "./useQuickCaptureWindowLifecycle";

export type CaptureSaveStatus = "idle" | "saving" | "saved" | "error";

const tagsToText = (tags: string[]) => tags.join(", ");
const OPEN_TABS_STORAGE_KEY = "mint.quickCapture.openTabs";
type EditorHistory = { past: string[]; future: string[] };

const readOpenTabs = (): { ids: string[]; activeId: string | null } => {
  if (typeof localStorage === "undefined") return { ids: [], activeId: null };
  try {
    const parsed = JSON.parse(
      localStorage.getItem(OPEN_TABS_STORAGE_KEY) ?? "null",
    ) as { ids?: unknown; activeId?: unknown } | null;
    return {
      ids: Array.isArray(parsed?.ids)
        ? parsed.ids.filter((id): id is string => typeof id === "string")
        : [],
      activeId: typeof parsed?.activeId === "string" ? parsed.activeId : null,
    };
  } catch {
    return { ids: [], activeId: null };
  }
};

export const useQuickCapture = () => {
  const [notes, setNotes] = useState<QuickCaptureNote[]>([]);
  const [draft, setDraft] = useState({ content: "", tags: "" });
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [pinned, setPinned] = useState(false);
  const [archived, setArchived] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openNoteIds, setOpenNoteIds] = useState<string[]>(
    () => readOpenTabs().ids,
  );
  const [status, setStatus] = useState<CaptureSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [canRetrySave, setCanRetrySave] = useState(false);
  const [canRetryDuplicate, setCanRetryDuplicate] = useState(false);
  const [undoDeleteId, setUndoDeleteId] = useState<string | null>(null);
  const [focusSequence, setFocusSequence] = useState(0);
  const loaded = useRef(false);
  const revision = useRef(0);
  const notesReloadSequenceRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef({ content: "", tags: "" });
  const persistQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const persistInFlightRef = useRef(false);
  const duplicateInFlightRef = useRef(false);
  const archiveInFlightRef = useRef(false);
  const clipboardCaptureInFlightRef = useRef(false);
  const contentRef = useRef(content);
  const activeIdRef = useRef(activeId);
  const editorHistoryRef = useRef(new Map<string, EditorHistory>());
  contentRef.current = content;
  activeIdRef.current = activeId;
  const updateContent = useCallback((value: string) => {
    const key = activeIdRef.current ?? "draft";
    const current = contentRef.current;
    if (value === current) return;
    const history = editorHistoryRef.current.get(key) ?? {
      past: [],
      future: [],
    };
    history.past = [...history.past.slice(-99), current];
    history.future = [];
    editorHistoryRef.current.set(key, history);
    contentRef.current = value;
    revision.current += 1;
    setContent(value);
  }, []);
  const updateTags = useCallback((value: string) => {
    revision.current += 1;
    setTags(value);
  }, []);
  const updateTitle = useCallback((value: string) => {
    revision.current += 1;
    setTitle(value);
    setTitleEdited(true);
  }, []);
  const updatePinned = useCallback((value: boolean) => {
    revision.current += 1;
    setPinned(value);
  }, []);

  const undoContent = useCallback(() => {
    const key = activeIdRef.current ?? "draft";
    const history = editorHistoryRef.current.get(key);
    if (!history) return false;
    const previous = history.past.pop();
    if (previous === undefined) return false;
    history.future.unshift(contentRef.current);
    contentRef.current = previous;
    revision.current += 1;
    setContent(previous);
    return true;
  }, []);

  const redoContent = useCallback(() => {
    const key = activeIdRef.current ?? "draft";
    const history = editorHistoryRef.current.get(key);
    if (!history) return false;
    const next = history.future.shift();
    if (next === undefined) return false;
    history.past.push(contentRef.current);
    contentRef.current = next;
    revision.current += 1;
    setContent(next);
    return true;
  }, []);

  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      OPEN_TABS_STORAGE_KEY,
      JSON.stringify({ ids: openNoteIds, activeId }),
    );
  }, [activeId, openNoteIds]);
  const clearPendingPersist = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const sortNotes = useCallback(
    (items: QuickCaptureNote[]) =>
      [...items].sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.updatedAt.localeCompare(a.updatedAt),
      ),
    [],
  );

  const showDraft = useCallback((nextDraft = draftRef.current) => {
    revision.current += 1;
    setActiveId(null);
    setTitle("");
    setTitleEdited(false);
    setContent(nextDraft.content);
    setTags(nextDraft.tags);
    setPinned(false);
    setArchived(false);
    setError(null);
    setCanRetryDuplicate(false);
    setFocusSequence((value) => value + 1);
  }, []);

  const reload = useCallback(async () => {
    const sequence = ++notesReloadSequenceRef.current;
    try {
      const state = await loadQuickCaptureState();
      if (sequence !== notesReloadSequenceRef.current) return null;
      const nextDraft = {
        content: state.draft.content,
        tags: tagsToText(state.draft.tags),
      };
      loaded.current = true;
      setUndoDeleteId(null);
      setNotes(sortNotes(state.notes));
      const savedTabs = readOpenTabs();
      const restoredIds = savedTabs.ids.filter((id) =>
        state.notes.some((note) => note.id === id),
      );
      setDraft(nextDraft);
      draftRef.current = nextDraft;
      const restoredNote =
        state.notes.find((note) => note.id === savedTabs.activeId) ??
        state.notes.find((note) => restoredIds.includes(note.id));
      const nextOpenIds =
        restoredNote && !restoredIds.includes(restoredNote.id)
          ? [...restoredIds, restoredNote.id]
          : restoredIds;
      setOpenNoteIds(nextOpenIds);
      if (restoredNote) {
        setActiveId(restoredNote.id);
        setTitle(restoredNote.title ?? "");
        setTitleEdited(restoredNote.title !== undefined);
        setContent(restoredNote.content);
        setTags(tagsToText(restoredNote.tags));
        setPinned(restoredNote.pinned);
        setArchived(restoredNote.archived);
        setFocusSequence((value) => value + 1);
      } else {
        showDraft(nextDraft);
      }
      setStatus("saved");
      setCanRetrySave(false);
      return null;
    } catch (reason) {
      if (sequence !== notesReloadSequenceRef.current) return null;
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      setStatus("error");
      setCanRetrySave(false);
      return message;
    }
  }, [showDraft, sortNotes]);

  const reloadNotes = useCallback(async () => {
    const sequence = ++notesReloadSequenceRef.current;
    try {
      const state = await loadQuickCaptureState();
      if (sequence !== notesReloadSequenceRef.current) return;
      setNotes(sortNotes(state.notes));
    } catch (reason) {
      if (sequence !== notesReloadSequenceRef.current) return;
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    }
  }, [sortNotes]);

  const persist = useCallback((): Promise<boolean> => {
    if (!loaded.current) return Promise.resolve(false);
    if (!activeId && !content.trim()) {
      setStatus("saved");
      setError(null);
      setCanRetrySave(false);
      return Promise.resolve(true);
    }
    clearPendingPersist();
    const sequence = ++revision.current;
    setStatus("saving");
    setError(null);
    setCanRetrySave(false);
    setCanRetryDuplicate(false);
    const operation = persistQueueRef.current.then(async () => {
      try {
        if (activeId) {
          // Empty notes are intentionally kept in the editor until the user
          // closes them. The close path removes them atomically so deleting
          // text never loses the user's work mid-edit.
          if (!content.trim()) {
            if (sequence === revision.current) setStatus("saved");
            return true;
          }
          const saved = await updateQuickCaptureNote(activeId, {
            title: titleEdited ? title.trim() : undefined,
            content,
            tags: parseTags(tags),
            pinned,
          });
          if (sequence === revision.current) {
            setNotes((current) =>
              sortNotes(
                current.map((note) => (note.id === saved.id ? saved : note)),
              ),
            );
          }
        } else {
          const saved = await createQuickCaptureNote({
            title: titleEdited ? title.trim() : undefined,
            content,
            tags: parseTags(tags),
            pinned: false,
          });
          if (sequence === revision.current) {
            setActiveId(saved.id);
            setOpenNoteIds((current) =>
              current.includes(saved.id) ? current : [...current, saved.id],
            );
            setPinned(saved.pinned);
            setArchived(saved.archived);
            setTitle(saved.title ?? "");
            setTitleEdited(saved.title !== undefined);
            setNotes((current) => sortNotes([saved, ...current]));
            setDraft({ content: saved.content, tags: tagsToText(saved.tags) });
            draftRef.current = {
              content: saved.content,
              tags: tagsToText(saved.tags),
            };
          }
        }
        if (sequence === revision.current) {
          setStatus("saved");
          setCanRetrySave(false);
          return true;
        }
        return false;
      } catch (reason) {
        if (sequence === revision.current) {
          setError(reason instanceof Error ? reason.message : String(reason));
          setStatus("error");
          setCanRetrySave(true);
        }
        return false;
      }
    });
    persistInFlightRef.current = true;
    persistQueueRef.current = operation;
    void operation.then(
      () => {
        if (persistQueueRef.current === operation) {
          persistInFlightRef.current = false;
        }
      },
      () => {
        if (persistQueueRef.current === operation) {
          persistInFlightRef.current = false;
        }
      },
    );
    return operation;
  }, [
    activeId,
    clearPendingPersist,
    content,
    pinned,
    sortNotes,
    tags,
    title,
    titleEdited,
  ]);

  const prepareClose = useCallback(async () => {
    const saved = await persist();
    if (!saved) return false;
    if (activeId && !content.trim()) {
      try {
        if (persistInFlightRef.current) await persistQueueRef.current;
        await deleteQuickCaptureNote(activeId);
        setNotes((current) => current.filter((note) => note.id !== activeId));
        setOpenNoteIds((current) => current.filter((id) => id !== activeId));
        showDraft({ content: "", tags: "" });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
        setCanRetrySave(false);
        return false;
      }
    }
    return true;
  }, [activeId, content, persist, showDraft]);

  useEffect(() => {
    if (!loaded.current) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void persist();
    }, 350);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [persist]);

  const selectNote = useCallback(
    async (note: QuickCaptureNote) => {
      const saved = await persist();
      if (!saved) return;
      revision.current += 1;
      setActiveId(note.id);
      setOpenNoteIds((current) =>
        current.includes(note.id) ? current : [...current, note.id],
      );
      setTitle(note.title ?? "");
      setTitleEdited(note.title !== undefined);
      setContent(note.content);
      setTags(tagsToText(note.tags));
      setPinned(note.pinned);
      setArchived(note.archived);
      setError(null);
      setFocusSequence((value) => value + 1);
    },
    [persist],
  );

  const openDraft = useCallback(async () => {
    const saved = await persist();
    if (!saved) return;
    showDraft({ content: "", tags: "" });
  }, [persist, showDraft]);

  const duplicateActive = useCallback(async () => {
    if (!activeId || duplicateInFlightRef.current) return false;
    duplicateInFlightRef.current = true;
    try {
      const saved = await persist();
      if (!saved) return false;

      const duplicateRevision = ++revision.current;
      setStatus("saving");
      setError(null);
      setCanRetrySave(false);
      setCanRetryDuplicate(false);
      const duplicated = await createQuickCaptureNote({
        title: titleEdited ? title.trim() : undefined,
        content,
        tags: parseTags(tags),
        pinned,
      });
      setNotes((current) => sortNotes([duplicated, ...current]));
      if (duplicateRevision !== revision.current) return true;

      setActiveId(duplicated.id);
      setOpenNoteIds((current) =>
        current.includes(duplicated.id) ? current : [...current, duplicated.id],
      );
      setTitle(duplicated.title ?? "");
      setTitleEdited(duplicated.title !== undefined);
      setContent(duplicated.content);
      setTags(tagsToText(duplicated.tags));
      setPinned(duplicated.pinned);
      setArchived(duplicated.archived);
      setFocusSequence((value) => value + 1);
      setStatus("saved");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
      setCanRetrySave(false);
      setCanRetryDuplicate(true);
      return false;
    } finally {
      duplicateInFlightRef.current = false;
    }
  }, [activeId, content, persist, pinned, sortNotes, tags, title, titleEdited]);

  const toggleArchived = useCallback(async () => {
    if (!activeId || archiveInFlightRef.current) return false;
    archiveInFlightRef.current = true;
    try {
      const activeNote = notes.find((note) => note.id === activeId);
      const currentTags = parseTags(tags);
      const hasPendingEdits =
        !activeNote ||
        activeNote.content !== content ||
        activeNote.pinned !== pinned ||
        activeNote.tags.length !== currentTags.length ||
        activeNote.tags.some((tag, index) => tag !== currentTags[index]);
      const saved = hasPendingEdits
        ? await persist()
        : persistInFlightRef.current
          ? await persistQueueRef.current
          : true;
      if (!saved) return false;

      const nextArchived = !archived;
      const archiveRevision = ++revision.current;
      setStatus("saving");
      setError(null);
      setCanRetrySave(false);
      const updated = await setQuickCaptureNoteArchived(activeId, nextArchived);
      setNotes((current) =>
        sortNotes(
          current.map((note) => (note.id === updated.id ? updated : note)),
        ),
      );
      if (archiveRevision === revision.current) {
        setArchived(updated.archived);
        setStatus("saved");
      }
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
      setCanRetrySave(false);
      return false;
    } finally {
      archiveInFlightRef.current = false;
    }
  }, [activeId, archived, content, notes, persist, pinned, sortNotes, tags]);

  const captureText = useCallback(
    async (text: string) => {
      if (!text.trim() || clipboardCaptureInFlightRef.current) return false;
      clipboardCaptureInFlightRef.current = true;
      setStatus("saving");
      setError(null);
      setCanRetrySave(false);
      try {
        const note = await createQuickCaptureNote({
          content: text,
          tags: [],
          pinned: false,
        });
        setNotes((current) => sortNotes([note, ...current]));
        setStatus("saved");
        return true;
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
        return false;
      } finally {
        clipboardCaptureInFlightRef.current = false;
      }
    },
    [sortNotes],
  );

  const removeNote = useCallback(
    async (noteId: string) => {
      setStatus("saving");
      setError(null);
      setCanRetrySave(false);
      try {
        // Deletion follows the latest content update for the same note.
        if (persistInFlightRef.current) await persistQueueRef.current;
        await deleteQuickCaptureNote(noteId);
        setNotes((current) => current.filter((note) => note.id !== noteId));
        setOpenNoteIds((current) => current.filter((id) => id !== noteId));
        editorHistoryRef.current.delete(noteId);
        setUndoDeleteId(noteId);
        if (activeId === noteId) showDraft();
        setStatus("saved");
        setCanRetrySave(false);
        return null;
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : String(reason);
        setError(message);
        setStatus("error");
        setCanRetrySave(false);
        return message;
      }
    },
    [activeId, showDraft],
  );

  const removeActive = useCallback(
    async () => (activeId ? removeNote(activeId) : null),
    [activeId, removeNote],
  );

  const closeActiveTab = useCallback(async () => {
    if (!activeId) {
      showDraft({ content: "", tags: "" });
      return;
    }
    const saved = content.trim()
      ? await persist()
      : (await removeNote(activeId)) === null;
    if (!saved) return;
    const currentIndex = openNoteIds.indexOf(activeId);
    const remaining = openNoteIds.filter((id) => id !== activeId);
    setOpenNoteIds(remaining);
    const nextId =
      remaining[currentIndex] ?? remaining[currentIndex - 1] ?? null;
    const nextNote = nextId
      ? notes.find((note) => note.id === nextId)
      : undefined;
    if (nextNote) {
      await selectNote(nextNote);
    } else {
      showDraft({ content: "", tags: "" });
    }
  }, [
    activeId,
    content,
    notes,
    openNoteIds,
    persist,
    removeNote,
    selectNote,
    showDraft,
  ]);

  const cycleTab = useCallback(
    async (direction: 1 | -1 = 1) => {
      if (openNoteIds.length < 2 || !activeId) return;
      const currentIndex = openNoteIds.indexOf(activeId);
      const nextIndex =
        (currentIndex + direction + openNoteIds.length) % openNoteIds.length;
      const nextNote = notes.find((note) => note.id === openNoteIds[nextIndex]);
      if (nextNote) await selectNote(nextNote);
    },
    [activeId, notes, openNoteIds, selectNote],
  );

  const undoDelete = useCallback(async () => {
    const noteId = undoDeleteId;
    if (!noteId) return false;
    setStatus("saving");
    setError(null);
    try {
      const restored = await restoreQuickCaptureNote(noteId);
      setNotes((current) => sortNotes([restored, ...current]));
      setUndoDeleteId(null);
      setStatus("saved");
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
      return false;
    }
  }, [sortNotes, undoDeleteId]);

  const releaseNotes = useCallback(() => {
    notesReloadSequenceRef.current += 1;
    setNotes([]);
  }, []);
  const addNote = useCallback(
    (note: QuickCaptureNote) => {
      setNotes((current) =>
        sortNotes([note, ...current.filter((item) => item.id !== note.id)]),
      );
    },
    [sortNotes],
  );
  const lifecycle = useQuickCaptureWindowLifecycle({
    prepareClose,
    reload,
    reloadNotes,
    releaseNotes,
    addNote,
    setError,
    setStatus,
    setCanRetrySave,
  });
  const attachments = useQuickCaptureAttachments({
    activeId,
    setNotes,
    setStatus,
    setError,
    setCanRetrySave,
    setCanRetryDuplicate,
    withAutoHideSuspended: lifecycle.withAutoHideSuspended,
  });
  const retrySave = persist;

  const allTags = useMemo(
    () =>
      [...new Set(notes.flatMap((note) => note.tags))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [notes],
  );
  const openNotes = useMemo(
    () =>
      openNoteIds
        .map((id) => notes.find((note) => note.id === id))
        .filter((note): note is QuickCaptureNote => Boolean(note)),
    [notes, openNoteIds],
  );

  return {
    activeId,
    archived,
    ...attachments,
    allTags,
    captureText,
    close: lifecycle.close,
    content,
    draft,
    duplicateActive,
    error,
    focusSequence,
    notes,
    openNotes,
    openDraft,
    pinned,
    removeActive,
    closeActiveTab,
    cycleTab,
    removeNote,
    canUndoDelete: undoDeleteId !== null,
    undoDelete,
    retrySave,
    selectNote,
    setContent: updateContent,
    redoContent,
    setTitle: updateTitle,
    setPinned: updatePinned,
    setWindowPinned: lifecycle.setWindowPinned,
    setTags: updateTags,
    showDraft,
    status,
    title,
    tags,
    undoContent,
    canRetrySave,
    canRetryDuplicate,
    toggleArchived,
    retryDuplicate: duplicateActive,
    reload,
    withAutoHideSuspended: lifecycle.withAutoHideSuspended,
    windowPinned: lifecycle.windowPinned,
  };
};
