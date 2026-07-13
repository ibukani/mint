import type {
  QuickCaptureAttachment,
  QuickCaptureAttachmentInput,
  QuickCaptureDraftInput,
  QuickCaptureNote,
  QuickCaptureNoteInput,
  QuickCaptureState,
} from "../../features/quick_capture/types";

const STORAGE_KEY = "mint_mock_quick_capture";

const emptyState = (): QuickCaptureState => ({
  draft: { content: "", tags: [], updatedAt: new Date().toISOString() },
  notes: [],
});

const normalizeTags = (tags: string[]) => {
  const seen = new Set<string>();
  return tags.flatMap((raw) => {
    const tag = raw.trim().replace(/^#+/, "").trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) return [];
    seen.add(key);
    return [tag];
  });
};

const read = (): QuickCaptureState => {
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) return emptyState();
  try {
    const state = JSON.parse(value) as QuickCaptureState;
    return {
      ...state,
      notes: state.notes.map((note) => ({
        ...note,
        attachments: note.attachments ?? [],
      })),
    };
  } catch {
    return emptyState();
  }
};

const write = (state: QuickCaptureState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const sortNotes = (notes: QuickCaptureNote[]) =>
  [...notes].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      b.updatedAt.localeCompare(a.updatedAt),
  );

export const mockLoadQuickCaptureState = () => read();

export const mockSaveQuickCaptureDraft = (input: QuickCaptureDraftInput) => {
  const state = read();
  const draft = {
    content: input.content,
    tags: normalizeTags(input.tags),
    updatedAt: new Date().toISOString(),
  };
  write({ ...state, draft });
  return draft;
};

export const mockPromoteQuickCaptureNote = (input: QuickCaptureNoteInput) => {
  if (!input.content.trim()) throw new Error("メモの本文を入力してください。");
  const state = read();
  const now = new Date().toISOString();
  const note: QuickCaptureNote = {
    id: crypto.randomUUID(),
    content: input.content,
    tags: normalizeTags(input.tags),
    pinned: input.pinned,
    createdAt: now,
    updatedAt: now,
    attachments: [],
  };
  const draft = {
    content: "",
    tags: [],
    updatedAt: now,
  };
  write({ draft, notes: sortNotes([note, ...state.notes]) });
  return { note, draft };
};

export const mockCreateQuickCaptureNote = (input: QuickCaptureNoteInput) => {
  if (!input.content.trim()) throw new Error("メモの本文を入力してください。");
  const state = read();
  const now = new Date().toISOString();
  const note: QuickCaptureNote = {
    id: crypto.randomUUID(),
    content: input.content,
    tags: normalizeTags(input.tags),
    pinned: input.pinned,
    createdAt: now,
    updatedAt: now,
    attachments: [],
  };
  write({ ...state, notes: sortNotes([note, ...state.notes]) });
  return note;
};

export const mockUpdateQuickCaptureNote = (
  id: string,
  input: QuickCaptureNoteInput,
) => {
  if (!input.content.trim()) throw new Error("メモの本文を入力してください。");
  const state = read();
  const existing = state.notes.find((note) => note.id === id);
  if (!existing) throw new Error("メモが見つかりません。");
  const note: QuickCaptureNote = {
    ...existing,
    ...input,
    tags: normalizeTags(input.tags),
    updatedAt: new Date().toISOString(),
  };
  write({
    ...state,
    notes: sortNotes(state.notes.map((item) => (item.id === id ? note : item))),
  });
  return note;
};

export const mockDeleteQuickCaptureNote = (id: string) => {
  const state = read();
  if (!state.notes.some((note) => note.id === id)) {
    throw new Error("メモが見つかりません。");
  }
  write({ ...state, notes: state.notes.filter((note) => note.id !== id) });
};

export const mockAddQuickCaptureAttachment = (
  input: QuickCaptureAttachmentInput,
) => {
  const state = read();
  const note = state.notes.find((item) => item.id === input.noteId);
  if (!note) throw new Error("メモが見つかりません。");
  const createdAt = new Date().toISOString();
  const fileName = input.sourcePath.split(/[\\/]/).pop() || "添付ファイル";
  const attachment: QuickCaptureAttachment = {
    id: crypto.randomUUID(),
    fileName,
    mimeType: "application/octet-stream",
    sizeBytes: 0,
    storedPath: input.sourcePath,
    createdAt,
  };
  write({
    ...state,
    notes: state.notes.map((item) =>
      item.id === input.noteId
        ? { ...item, attachments: [...item.attachments, attachment] }
        : item,
    ),
  });
  return attachment;
};

export const mockDeleteQuickCaptureAttachment = (
  noteId: string,
  attachmentId: string,
) => {
  const state = read();
  const note = state.notes.find((item) => item.id === noteId);
  if (!note?.attachments.some((item) => item.id === attachmentId)) {
    throw new Error("添付ファイルが見つかりません。");
  }
  write({
    ...state,
    notes: state.notes.map((item) =>
      item.id === noteId
        ? {
            ...item,
            attachments: item.attachments.filter(
              (attachment) => attachment.id !== attachmentId,
            ),
          }
        : item,
    ),
  });
};
