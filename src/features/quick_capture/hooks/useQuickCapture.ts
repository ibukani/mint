import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createQuickCaptureNote,
  deleteQuickCaptureNote,
  exportQuickCaptureBackup,
  importQuickCaptureBackup,
  loadQuickCaptureState,
  promoteQuickCaptureNote,
  restoreQuickCaptureNote,
  saveQuickCaptureDraft,
  setQuickCaptureNoteArchived,
  updateQuickCaptureNote,
} from "../api";
import type { QuickCaptureNote } from "../types";
import { parseTags } from "../utils";
import { useQuickCaptureAttachments } from "./useQuickCaptureAttachments";
import { useQuickCaptureWindowLifecycle } from "./useQuickCaptureWindowLifecycle";

export type CaptureSaveStatus = "idle" | "saving" | "saved" | "error";

const tagsToText = (tags: string[]) => tags.join(", ");

export const useQuickCapture = () => {
  const [notes, setNotes] = useState<QuickCaptureNote[]>([]);
  const [draft, setDraft] = useState({ content: "", tags: "" });
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [pinned, setPinned] = useState(false);
  const [archived, setArchived] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
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
  const promotionInFlightRef = useRef(false);
  const duplicateInFlightRef = useRef(false);
  const archiveInFlightRef = useRef(false);
  const clipboardCaptureInFlightRef = useRef(false);
  const updateContent = useCallback((value: string) => {
    revision.current += 1;
    setContent(value);
  }, []);
  const updateTags = useCallback((value: string) => {
    revision.current += 1;
    setTags(value);
  }, []);
  const updatePinned = useCallback((value: boolean) => {
    revision.current += 1;
    setPinned(value);
  }, []);
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
      setDraft(nextDraft);
      draftRef.current = nextDraft;
      showDraft(nextDraft);
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
    clearPendingPersist();
    const sequence = ++revision.current;
    setStatus("saving");
    setError(null);
    setCanRetrySave(false);
    setCanRetryDuplicate(false);
    const operation = persistQueueRef.current.then(async () => {
      try {
        if (activeId) {
          const saved = await updateQuickCaptureNote(activeId, {
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
          const saved = await saveQuickCaptureDraft({
            content,
            tags: parseTags(tags),
          });
          if (sequence === revision.current) {
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
  }, [activeId, clearPendingPersist, content, pinned, sortNotes, tags]);

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
    showDraft();
  }, [persist, showDraft]);

  const promote = useCallback(async () => {
    if (activeId || !content.trim() || promotionInFlightRef.current) return;
    promotionInFlightRef.current = true;
    clearPendingPersist();
    const promotionRevision = ++revision.current;
    setStatus("saving");
    setError(null);
    setCanRetrySave(false);
    try {
      // Finish an already running autosave before the atomic promotion. This
      // prevents an older draft write from landing after the promotion.
      if (persistInFlightRef.current) await persistQueueRef.current;
      const promotion = await promoteQuickCaptureNote({
        content,
        tags: parseTags(tags),
        pinned: false,
      });
      setNotes((current) => sortNotes([promotion.note, ...current]));
      if (promotionRevision !== revision.current) return;
      const nextDraft = {
        content: promotion.draft.content,
        tags: tagsToText(promotion.draft.tags),
      };
      setDraft(nextDraft);
      draftRef.current = nextDraft;
      showDraft(nextDraft);
      setStatus("saved");
      setCanRetrySave(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
      setCanRetrySave(false);
    } finally {
      promotionInFlightRef.current = false;
    }
  }, [activeId, clearPendingPersist, content, showDraft, sortNotes, tags]);

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
        content,
        tags: parseTags(tags),
        pinned,
      });
      setNotes((current) => sortNotes([duplicated, ...current]));
      if (duplicateRevision !== revision.current) return true;

      setActiveId(duplicated.id);
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
  }, [activeId, content, persist, pinned, sortNotes, tags]);

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

  const exportBackup = useCallback(
    async (path: string) => {
      try {
        const saved = await persist();
        if (!saved) {
          setError(
            "最新の変更を保存できなかったため、バックアップを作成できませんでした。",
          );
          setStatus("error");
          return;
        }
        await exportQuickCaptureBackup(path);
        setStatus("saved");
        setError(null);
        setCanRetrySave(false);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
        setCanRetrySave(false);
      }
    },
    [persist],
  );

  const importBackup = useCallback(
    async (path: string) => {
      try {
        clearPendingPersist();
        await persistQueueRef.current;
        await importQuickCaptureBackup(path);
        return await reload();
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : String(reason);
        setError(message);
        setStatus("error");
        setCanRetrySave(false);
        return message;
      }
    },
    [clearPendingPersist, reload],
  );

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
    persist,
    reload,
    reloadNotes,
    showDraft,
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
    exportBackup,
    focusSequence,
    notes,
    openDraft,
    pinned,
    promote,
    removeActive,
    removeNote,
    canUndoDelete: undoDeleteId !== null,
    undoDelete,
    retrySave,
    selectNote,
    setContent: updateContent,
    setPinned: updatePinned,
    setWindowPinned: lifecycle.setWindowPinned,
    setTags: updateTags,
    showDraft,
    status,
    tags,
    canRetrySave,
    canRetryDuplicate,
    toggleArchived,
    importBackup,
    retryDuplicate: duplicateActive,
    reload,
    withAutoHideSuspended: lifecycle.withAutoHideSuspended,
    windowPinned: lifecycle.windowPinned,
  };
};
