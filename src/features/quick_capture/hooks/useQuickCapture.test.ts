import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuickCaptureNote, QuickCaptureState } from "../types";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  listen: vi.fn(),
  listeners: new Map<string, (event: { payload?: unknown }) => void>(),
  focusChanged: null as ((event: { payload: boolean }) => void) | null,
  closeRequested: null as (() => void) | null,
}));

vi.mock("../api", () => ({
  addQuickCaptureAttachment: vi.fn(),
  chooseQuickCaptureAttachment: vi.fn(),
  createQuickCaptureNote: mocks.createNote,
  deleteQuickCaptureAttachment: vi.fn(),
  deleteQuickCaptureNote: mocks.deleteNote,
  exportQuickCaptureBackup: vi.fn(),
  importQuickCaptureBackup: vi.fn(),
  loadQuickCaptureState: mocks.load,
  setQuickCaptureNoteArchived: vi.fn(),
  updateQuickCaptureNote: mocks.updateNote,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: mocks.listen,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    hide: mocks.hide,
    isVisible: mocks.isVisible,
    onFocusChanged: async (handler: (event: { payload: boolean }) => void) => {
      mocks.focusChanged = handler;
      return () => {
        mocks.focusChanged = null;
      };
    },
    onCloseRequested: async (handler: () => void) => {
      mocks.closeRequested = handler;
      return () => {
        mocks.closeRequested = null;
      };
    },
    onDragDropEvent: async () => () => {},
  }),
}));

import { useQuickCapture } from "./useQuickCapture";

const savedNote: QuickCaptureNote = {
  id: "note-1",
  content: "保存済みのメモ",
  tags: [],
  pinned: false,
  archived: false,
  createdAt: "2026-07-13T00:00:00.000Z",
  updatedAt: "2026-07-13T00:00:00.000Z",
  attachments: [],
};

const state: QuickCaptureState = {
  draft: {
    content: "",
    tags: [],
    updatedAt: "2026-07-13T00:00:00.000Z",
  },
  notes: [savedNote],
};

describe("useQuickCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listeners.clear();
    mocks.focusChanged = null;
    mocks.closeRequested = null;
    mocks.isVisible.mockResolvedValue(true);
    mocks.hide.mockResolvedValue(undefined);
    mocks.load.mockResolvedValue(state);
    mocks.createNote.mockImplementation(async (input) => ({
      ...savedNote,
      id: "created-note",
      content: input.content,
      tags: input.tags,
      createdAt: "2026-07-14T00:00:00.000Z",
      updatedAt: "2026-07-14T00:00:00.000Z",
    }));
    mocks.updateNote.mockImplementation(async (id, input) => ({
      ...savedNote,
      id,
      content: input.content,
      tags: input.tags,
      pinned: input.pinned,
      updatedAt: "2026-07-14T00:00:00.000Z",
    }));
    mocks.listen.mockImplementation(
      async (
        event: string,
        handler: (event: { payload?: unknown }) => void,
      ) => {
        mocks.listeners.set(event, handler);
        return () => mocks.listeners.delete(event);
      },
    );
  });

  it("starts with an empty editor and creates a normal note on first input", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.status).toBe("saved"));
    expect(result.current.content).toBe("");
    expect(result.current.activeId).toBeNull();

    act(() => result.current.setContent("すぐ保存される本文"));

    await waitFor(() => expect(mocks.createNote).toHaveBeenCalledOnce());
    expect(mocks.createNote).toHaveBeenCalledWith({
      content: "すぐ保存される本文",
      tags: [],
      pinned: false,
    });
    await waitFor(() => expect(result.current.activeId).toBe("created-note"));
  });

  it("does not hide when focus moves to another application", async () => {
    renderHook(() => useQuickCapture());
    await waitFor(() => expect(mocks.focusChanged).not.toBeNull());

    act(() => mocks.focusChanged?.({ payload: false }));

    expect(mocks.hide).not.toHaveBeenCalled();
  });

  it("persists before an explicit close", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.status).toBe("saved"));

    act(() => result.current.setContent("閉じても残る本文"));
    await waitFor(() => expect(mocks.createNote).toHaveBeenCalledOnce());

    await act(async () => result.current.close());

    expect(mocks.hide).toHaveBeenCalledOnce();
  });

  it("removes an empty active note only when the editor closes", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.status).toBe("saved"));

    await act(async () => result.current.selectNote(savedNote));
    act(() => result.current.setContent(""));
    await act(async () => result.current.close());

    expect(mocks.deleteNote).toHaveBeenCalledWith(savedNote.id);
    expect(mocks.hide).toHaveBeenCalledOnce();
  });

  it("keeps a failed auto-save retryable without losing the editor content", async () => {
    mocks.createNote.mockRejectedValueOnce(new Error("保存に失敗しました"));
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.status).toBe("saved"));

    act(() => result.current.setContent("失敗しても保持する本文"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.content).toBe("失敗しても保持する本文");
    expect(result.current.canRetrySave).toBe(true);

    mocks.createNote.mockResolvedValueOnce({
      ...savedNote,
      id: "retry-note",
      content: "失敗しても保持する本文",
    });
    await act(async () => result.current.retrySave());
    expect(result.current.status).toBe("saved");
    expect(result.current.error).toBeNull();
  });

  it("keeps undo and redo history for the current note", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.status).toBe("saved"));

    act(() => result.current.setContent("最初の本文"));
    act(() => result.current.setContent("更新後の本文"));

    act(() => expect(result.current.undoContent()).toBe(true));
    expect(result.current.content).toBe("最初の本文");
    act(() => expect(result.current.redoContent()).toBe(true));
    expect(result.current.content).toBe("更新後の本文");
  });
});
