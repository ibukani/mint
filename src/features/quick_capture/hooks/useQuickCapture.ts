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
  saveQuickCaptureDraft,
  updateQuickCaptureNote,
} from "../api";
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
  const [focusSequence, setFocusSequence] = useState(0);
  const loaded = useRef(false);
  const revision = useRef(0);
  const draftRef = useRef({ content: "", tags: "" });
  const closeRef = useRef<() => Promise<void>>(async () => {});

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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    }
  }, [showDraft, sortNotes]);

  const persist = useCallback(async () => {
    if (!loaded.current) return;
    const sequence = ++revision.current;
    setStatus("saving");
    setError(null);
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
      if (sequence === revision.current) setStatus("saved");
    } catch (reason) {
      if (sequence === revision.current) {
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
      }
    }
  }, [activeId, content, pinned, sortNotes, tags]);

  useEffect(() => {
    if (!loaded.current) return;
    const timer = window.setTimeout(() => void persist(), 350);
    return () => window.clearTimeout(timer);
  }, [persist]);

  const selectNote = useCallback(
    async (note: QuickCaptureNote) => {
      await persist();
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
    await persist();
    showDraft();
  }, [persist, showDraft]);

  const promote = useCallback(async () => {
    if (activeId || !content.trim()) return;
    revision.current += 1;
    setStatus("saving");
    try {
      const note = await createQuickCaptureNote({
        content,
        tags: parseTags(tags),
        pinned: false,
      });
      const empty = await saveQuickCaptureDraft({ content: "", tags: [] });
      setNotes((current) => sortNotes([note, ...current]));
      const nextDraft = { content: empty.content, tags: "" };
      setDraft(nextDraft);
      draftRef.current = nextDraft;
      showDraft(nextDraft);
      setStatus("saved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    }
  }, [activeId, content, showDraft, sortNotes, tags]);

  const removeActive = useCallback(async () => {
    if (!activeId) return;
    await deleteQuickCaptureNote(activeId);
    setNotes((current) => current.filter((note) => note.id !== activeId));
    showDraft();
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    }
  }, [activeId]);

  const exportBackup = useCallback(async (path: string) => {
    try {
      await exportQuickCaptureBackup(path);
      setStatus("saved");
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus("error");
    }
  }, []);

  const importBackup = useCallback(
    async (path: string) => {
      try {
        await importQuickCaptureBackup(path);
        await reload();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
      }
    },
    [reload],
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
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
      }
    },
    [activeId],
  );

  const close = useCallback(async () => {
    await persist();
    await getCurrentWindow().hide();
  }, [persist]);
  closeRef.current = close;

  useEffect(() => {
    void reload();
    document.body.classList.add("is-overlay");
    document.documentElement.classList.add("is-overlay");
    const shown = listen("quick-capture-shown", () => showDraft());
    const hide = listen(
      "quick-capture-hide-requested",
      () => void closeRef.current(),
    );
    return () => {
      document.body.classList.remove("is-overlay");
      document.documentElement.classList.remove("is-overlay");
      void shown.then((unlisten) => unlisten());
      void hide.then((unlisten) => unlisten());
    };
  }, [reload, showDraft]);

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
    error,
    exportBackup,
    focusSequence,
    notes,
    openDraft,
    pinned,
    promote,
    removeActive,
    removeAttachment,
    selectNote,
    setContent,
    setPinned,
    setTags,
    showDraft,
    status,
    tags,
    importBackup,
    reload,
  };
};
