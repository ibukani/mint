import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addQuickCaptureAttachment,
  chooseQuickCaptureAttachment,
  createQuickCaptureNote,
  deleteQuickCaptureAttachment,
  deleteQuickCaptureNote,
  exportQuickCaptureBackup,
  importQuickCaptureBackup,
  loadQuickCaptureState,
  promoteQuickCaptureNote,
  saveQuickCaptureDraft,
  updateQuickCaptureNote,
} from "../api";
import type { QuickCaptureNoteCreatedPayload } from "../events";
import { QUICK_CAPTURE_NOTE_CREATED_EVENT } from "../events";
import type { QuickCaptureNote } from "../types";

export type CaptureSaveStatus = "idle" | "saving" | "saved" | "error";

const tagsToText = (tags: string[]) => tags.join(", ");
const parseTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

export const useQuickCapture = () => {
  const [notes, setNotes] = useState<QuickCaptureNote[]>([]);
  const [draft, setDraft] = useState({ content: "", tags: "" });
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [pinned, setPinned] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<CaptureSaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [canRetrySave, setCanRetrySave] = useState(false);
  const [canRetryDuplicate, setCanRetryDuplicate] = useState(false);
  const [focusSequence, setFocusSequence] = useState(0);
  const loaded = useRef(false);
  const revision = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef({ content: "", tags: "" });
  const closeRef = useRef<() => Promise<void>>(async () => {});
  const persistQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const promotionInFlightRef = useRef(false);
  const duplicateInFlightRef = useRef(false);
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
    setError(null);
    setCanRetryDuplicate(false);
    setFocusSequence((value) => value + 1);
  }, []);

  const reload = useCallback(async () => {
    try {
      const state = await loadQuickCaptureState();
      const nextDraft = {
        content: state.draft.content,
        tags: tagsToText(state.draft.tags),
      };
      loaded.current = true;
      setNotes(sortNotes(state.notes));
      setDraft(nextDraft);
      draftRef.current = nextDraft;
      showDraft(nextDraft);
      setStatus("saved");
      setCanRetrySave(false);
      return null;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      setStatus("error");
      setCanRetrySave(false);
      return message;
    }
  }, [showDraft, sortNotes]);

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
    persistQueueRef.current = operation;
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

  const removeActive = useCallback(async () => {
    if (!activeId) return null;
    setStatus("saving");
    setError(null);
    setCanRetrySave(false);
    try {
      await deleteQuickCaptureNote(activeId);
      setNotes((current) => current.filter((note) => note.id !== activeId));
      showDraft();
      setStatus("saved");
      setCanRetrySave(false);
      return null;
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason);
      setError(message);
      setStatus("error");
      setCanRetrySave(false);
      return message;
    }
  }, [activeId, showDraft]);

  const addAttachment = useCallback(async () => {
    if (!activeId) return;
    try {
      const sourcePath = await chooseQuickCaptureAttachment();
      if (!sourcePath || Array.isArray(sourcePath)) return;
      const attachment = await addQuickCaptureAttachment({
        noteId: activeId,
        sourcePath,
      });
      setNotes((current) =>
        current.map((note) =>
          note.id === activeId
            ? { ...note, attachments: [...note.attachments, attachment] }
            : note,
        ),
      );
      setStatus("saved");
      setError(null);
      setCanRetrySave(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
      setCanRetrySave(false);
    }
  }, [activeId]);

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

  const removeAttachment = useCallback(
    async (attachmentId: string) => {
      if (!activeId) return;
      try {
        await deleteQuickCaptureAttachment(activeId, attachmentId);
        setNotes((current) =>
          current.map((note) =>
            note.id === activeId
              ? {
                  ...note,
                  attachments: note.attachments.filter(
                    (attachment) => attachment.id !== attachmentId,
                  ),
                }
              : note,
          ),
        );
        setStatus("saved");
        setError(null);
        setCanRetrySave(false);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
        setCanRetrySave(false);
      }
    },
    [activeId],
  );

  const close = useCallback(async () => {
    const saved = await persist();
    if (!saved) return;
    await getCurrentWindow().hide();
  }, [persist]);
  const retrySave = persist;
  closeRef.current = close;

  useEffect(() => {
    void reload();
    document.body.classList.add("is-overlay");
    document.documentElement.classList.add("is-overlay");
    const shown = listen("quick-capture-shown", () => showDraft());
    const noteCreated = listen<QuickCaptureNoteCreatedPayload>(
      QUICK_CAPTURE_NOTE_CREATED_EVENT,
      ({ payload }) => {
        const note = payload?.note;
        if (!note) return;
        setNotes((current) =>
          sortNotes([note, ...current.filter((item) => item.id !== note.id)]),
        );
      },
    );
    const hide = listen(
      "quick-capture-hide-requested",
      () => void closeRef.current(),
    );
    return () => {
      document.body.classList.remove("is-overlay");
      document.documentElement.classList.remove("is-overlay");
      void shown.then((unlisten) => unlisten());
      void noteCreated.then((unlisten) => unlisten());
      void hide.then((unlisten) => unlisten());
    };
  }, [reload, showDraft, sortNotes]);

  const allTags = useMemo(
    () =>
      [...new Set(notes.flatMap((note) => note.tags))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [notes],
  );

  return {
    activeId,
    addAttachment,
    allTags,
    close,
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
    removeAttachment,
    retrySave,
    selectNote,
    setContent: updateContent,
    setPinned: updatePinned,
    setTags: updateTags,
    showDraft,
    status,
    tags,
    canRetrySave,
    canRetryDuplicate,
    importBackup,
    retryDuplicate: duplicateActive,
    reload,
  };
};
