import type {
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
    return JSON.parse(value) as QuickCaptureState;
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
