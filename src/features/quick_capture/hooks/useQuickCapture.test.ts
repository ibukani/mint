import { PhysicalPosition } from "@tauri-apps/api/dpi";
import type { DragDropEvent } from "@tauri-apps/api/window";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUICK_CAPTURE_NOTE_CREATED_EVENT } from "../events";
import type { QuickCaptureNote, QuickCaptureState } from "../types";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  importBackup: vi.fn(),
  createNote: vi.fn(),
  promote: vi.fn(),
  saveDraft: vi.fn(),
  updateNote: vi.fn(),
  addAttachment: vi.fn(),
  hide: vi.fn(),
  isVisible: vi.fn(),
  listen: vi.fn(),
  listeners: new Map<string, (event: { payload?: unknown }) => void>(),
  focusChanged: null as ((event: { payload: boolean }) => void) | null,
  dragDropHandler: null as ((event: { payload: DragDropEvent }) => void) | null,
}));

vi.mock("../api", () => ({
  addQuickCaptureAttachment: mocks.addAttachment,
  chooseQuickCaptureAttachment: vi.fn(),
  createQuickCaptureNote: mocks.createNote,
  deleteQuickCaptureAttachment: vi.fn(),
  deleteQuickCaptureNote: vi.fn(),
  exportQuickCaptureBackup: vi.fn(),
  importQuickCaptureBackup: mocks.importBackup,
  loadQuickCaptureState: mocks.load,
  promoteQuickCaptureNote: mocks.promote,
  saveQuickCaptureDraft: mocks.saveDraft,
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
    onDragDropEvent: async (
      handler: (event: { payload: DragDropEvent }) => void,
    ) => {
      mocks.dragDropHandler = handler;
      return () => {
        mocks.dragDropHandler = null;
      };
    },
  }),
}));

import { useQuickCapture } from "./useQuickCapture";

const savedNote: QuickCaptureNote = {
  id: "note-1",
  content: "保存済みのメモ",
  tags: [],
  pinned: false,
  createdAt: "2026-07-13T00:00:00.000Z",
  updatedAt: "2026-07-13T00:00:00.000Z",
  attachments: [],
};

const state: QuickCaptureState = {
  draft: {
    content: "下書きの内容",
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
    mocks.dragDropHandler = null;
    mocks.isVisible.mockResolvedValue(true);
    mocks.load.mockResolvedValue(state);
    mocks.promote.mockResolvedValue({
      note: savedNote,
      draft: {
        content: "",
        tags: [],
        updatedAt: "2026-07-13T00:00:01.000Z",
      },
    });
    mocks.saveDraft.mockImplementation(async (input) => ({
      content: input.content,
      tags: input.tags,
      updatedAt: "2026-07-13T00:00:00.000Z",
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
    mocks.importBackup.mockResolvedValue(state);
    mocks.createNote.mockReset();
    mocks.updateNote.mockReset();
    mocks.addAttachment.mockReset();
  });

  it("attaches dropped files to the selected note without replacing the draft", async () => {
    mocks.addAttachment.mockImplementation(async ({ sourcePath }) => ({
      id: `attachment-${sourcePath}`,
      fileName: sourcePath.split("/").pop() ?? sourcePath,
      mimeType: "application/octet-stream",
      sizeBytes: 10,
      storedPath: sourcePath,
      createdAt: "2026-07-14T00:00:00.000Z",
    }));

    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));
    await waitFor(() => expect(mocks.dragDropHandler).not.toBeNull());

    await act(async () => {
      await result.current.selectNote(savedNote);
    });
    expect(result.current.activeId).toBe(savedNote.id);

    act(() => {
      mocks.dragDropHandler?.({
        payload: {
          type: "enter",
          paths: [],
          position: new PhysicalPosition(20, 20),
        } as DragDropEvent,
      });
    });
    expect(result.current.isDropTarget).toBe(true);

    act(() => {
      mocks.dragDropHandler?.({
        payload: {
          type: "drop",
          paths: ["/tmp/first.pdf", "/tmp/second.png", "/tmp/first.pdf"],
          position: new PhysicalPosition(20, 20),
        } as DragDropEvent,
      });
    });
    await waitFor(() => expect(mocks.addAttachment).toHaveBeenCalledTimes(2));

    expect(mocks.addAttachment).toHaveBeenNthCalledWith(1, {
      noteId: savedNote.id,
      sourcePath: "/tmp/first.pdf",
    });
    expect(mocks.addAttachment).toHaveBeenNthCalledWith(2, {
      noteId: savedNote.id,
      sourcePath: "/tmp/second.png",
    });
    expect(result.current.notes[0]?.attachments).toHaveLength(2);
    expect(result.current.content).toBe("保存済みのメモ");
    expect(result.current.isDropTarget).toBe(false);
  });

  it("asks for a saved note before accepting a dropped file", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));
    await waitFor(() => expect(mocks.dragDropHandler).not.toBeNull());

    act(() => {
      mocks.dragDropHandler?.({
        payload: {
          type: "drop",
          paths: ["/tmp/draft-only.pdf"],
          position: new PhysicalPosition(20, 20),
        } as DragDropEvent,
      });
    });

    expect(mocks.addAttachment).not.toHaveBeenCalled();
    expect(result.current.error).toBe(
      "ファイルを添付するには、先に保存済みメモを選択してください。",
    );
    expect(result.current.content).toBe("下書きの内容");
  });

  it("keeps the draft open when selecting a note cannot save the latest edit", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));

    act(() => result.current.setContent("保存できない最新の編集"));
    mocks.saveDraft.mockRejectedValueOnce(new Error("保存に失敗しました"));

    await act(async () => {
      await result.current.selectNote(savedNote);
    });

    expect(result.current.activeId).toBeNull();
    expect(result.current.content).toBe("保存できない最新の編集");
    expect(result.current.error).toBe("保存に失敗しました");
  });

  it("adds a note created in another window without replacing the current draft", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));

    const externalNote: QuickCaptureNote = {
      ...savedNote,
      id: "note-from-transcription",
      content: "別画面から保存された文字起こし",
      tags: ["文字起こし"],
      updatedAt: "2026-07-14T12:00:00.000Z",
    };

    await act(async () => {
      mocks.listeners.get(QUICK_CAPTURE_NOTE_CREATED_EVENT)?.({
        payload: { note: externalNote },
      });
      await Promise.resolve();
    });

    expect(result.current.notes[0]).toEqual(externalNote);
    expect(result.current.content).toBe("下書きの内容");
    expect(result.current.activeId).toBeNull();
  });

  it("does not hide the window when closing cannot save the latest edit", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));

    act(() => result.current.setContent("終了前に保存できない編集"));
    mocks.saveDraft.mockRejectedValueOnce(new Error("保存に失敗しました"));

    await act(async () => {
      await result.current.close();
    });

    expect(mocks.hide).not.toHaveBeenCalled();
    expect(result.current.content).toBe("終了前に保存できない編集");
    expect(result.current.error).toBe("保存に失敗しました");
  });

  it("releases the saved note list while hidden and reloads it when shown", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    act(() => mocks.listeners.get("quick-capture-shown")?.({}));
    await act(async () => Promise.resolve());
    expect(mocks.load).toHaveBeenCalledOnce();

    await act(async () => result.current.close());
    expect(result.current.notes).toEqual([]);

    act(() => mocks.listeners.get("quick-capture-shown")?.({}));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });

  it("does not load the saved state until a hidden window is shown", async () => {
    mocks.isVisible.mockResolvedValue(false);
    const { result } = renderHook(() => useQuickCapture());
    const showQuickCapture = mocks.listeners.get("quick-capture-shown");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.load).not.toHaveBeenCalled();
    expect(result.current.notes).toEqual([]);

    act(() => showQuickCapture?.({}));
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));

    expect(mocks.load).toHaveBeenCalledOnce();
  });

  it("saves and hides once when an unpinned visible window loses focus", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));
    await waitFor(() => expect(mocks.focusChanged).not.toBeNull());

    act(() => {
      mocks.listeners.get("quick-capture-shown")?.({});
      mocks.focusChanged?.({ payload: false });
      mocks.focusChanged?.({ payload: false });
    });

    await waitFor(() => expect(mocks.hide).toHaveBeenCalledOnce());
  });

  it("keeps the window open while pinned and remembers the pin after reopening", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));
    await waitFor(() => expect(mocks.focusChanged).not.toBeNull());

    act(() => {
      mocks.listeners.get("quick-capture-shown")?.({});
      result.current.setWindowPinned(true);
      mocks.focusChanged?.({ payload: false });
    });
    await act(async () => Promise.resolve());
    expect(mocks.hide).not.toHaveBeenCalled();

    await act(async () => result.current.close());
    expect(mocks.hide).toHaveBeenCalledOnce();
    act(() => mocks.listeners.get("quick-capture-shown")?.({}));
    expect(result.current.windowPinned).toBe(true);

    act(() => mocks.focusChanged?.({ payload: false }));
    await act(async () => Promise.resolve());
    expect(mocks.hide).toHaveBeenCalledOnce();

    act(() => {
      result.current.setWindowPinned(false);
      mocks.focusChanged?.({ payload: true });
      mocks.focusChanged?.({ payload: false });
    });
    await waitFor(() => expect(mocks.hide).toHaveBeenCalledTimes(2));
  });

  it("ignores focus loss until a related native dialog returns focus", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));
    await waitFor(() => expect(mocks.focusChanged).not.toBeNull());
    act(() => mocks.listeners.get("quick-capture-shown")?.({}));

    let resolveDialog: (() => void) | undefined;
    let dialogPromise: Promise<void> | undefined;
    act(() => {
      dialogPromise = result.current.withAutoHideSuspended(
        () =>
          new Promise<void>((resolve) => {
            resolveDialog = resolve;
          }),
      );
      mocks.focusChanged?.({ payload: false });
    });
    await act(async () => Promise.resolve());
    expect(mocks.hide).not.toHaveBeenCalled();

    await act(async () => {
      resolveDialog?.();
      await dialogPromise;
    });
    act(() => {
      mocks.focusChanged?.({ payload: true });
      mocks.focusChanged?.({ payload: false });
    });
    await waitFor(() => expect(mocks.hide).toHaveBeenCalledOnce());
  });

  it("offers a save retry and clears the failure after the retry succeeds", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));

    act(() => result.current.setContent("再試行する最新の編集"));
    mocks.saveDraft.mockRejectedValueOnce(new Error("保存に失敗しました"));

    await act(async () => {
      await result.current.close();
    });

    expect(result.current.canRetrySave).toBe(true);
    mocks.saveDraft.mockResolvedValueOnce({
      content: "再試行する最新の編集",
      tags: [],
      updatedAt: "2026-07-13T00:00:01.000Z",
    });

    await act(async () => {
      await result.current.retrySave();
    });

    expect(result.current.canRetrySave).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe("saved");
  });

  it("promotes a draft through one atomic command and does not save it twice", async () => {
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));

    act(() => result.current.setContent("一度だけ保存するメモ"));

    await act(async () => {
      await result.current.promote();
    });

    expect(mocks.promote).toHaveBeenCalledWith({
      content: "一度だけ保存するメモ",
      tags: [],
      pinned: false,
    });
    expect(mocks.saveDraft).not.toHaveBeenCalledWith({
      content: "",
      tags: [],
    });
    expect(result.current.content).toBe("");
  });

  it("saves the latest edit before duplicating the active note", async () => {
    const duplicatedNote = {
      ...savedNote,
      id: "note-2",
      content: "テンプレートから作ったメモ",
      tags: ["work"],
      updatedAt: "2026-07-14T00:00:02.000Z",
    };
    mocks.updateNote.mockResolvedValue({
      ...savedNote,
      content: "テンプレートから作ったメモ",
      tags: ["work"],
      updatedAt: "2026-07-14T00:00:01.000Z",
    });
    mocks.createNote.mockResolvedValue(duplicatedNote);

    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));
    await act(async () => {
      await result.current.selectNote(savedNote);
    });
    act(() => {
      result.current.setContent("テンプレートから作ったメモ");
      result.current.setTags("work");
    });

    await act(async () => {
      await result.current.duplicateActive();
    });

    expect(mocks.updateNote).toHaveBeenCalledWith("note-1", {
      content: "テンプレートから作ったメモ",
      tags: ["work"],
      pinned: false,
    });
    expect(mocks.createNote).toHaveBeenCalledWith({
      content: "テンプレートから作ったメモ",
      tags: ["work"],
      pinned: false,
    });
    expect(result.current.activeId).toBe("note-2");
    expect(result.current.content).toBe("テンプレートから作ったメモ");
  });

  it("keeps the active note and exposes a retryable error when duplication fails", async () => {
    mocks.updateNote.mockResolvedValue(savedNote);
    mocks.createNote.mockRejectedValueOnce(new Error("複製に失敗しました"));
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));
    await act(async () => {
      await result.current.selectNote(savedNote);
    });
    await waitFor(() => expect(result.current.activeId).toBe("note-1"));
    await act(async () => {
      await result.current.duplicateActive();
    });

    expect(result.current.activeId).toBe("note-1");
    expect(result.current.error).toBe("複製に失敗しました");
    expect(result.current.status).toBe("error");
    expect(result.current.canRetryDuplicate).toBe(true);

    mocks.createNote.mockResolvedValueOnce({
      ...savedNote,
      id: "note-2",
      content: savedNote.content,
    });
    await act(async () => {
      await result.current.retryDuplicate();
    });

    expect(result.current.activeId).toBe("note-2");
    expect(result.current.canRetryDuplicate).toBe(false);
  });

  it("keeps a newer edit when promotion finishes after the user keeps typing", async () => {
    let resolvePromotion: ((value: unknown) => void) | undefined;
    const pendingPromotion = new Promise((resolve) => {
      resolvePromotion = resolve;
    });
    mocks.promote.mockReturnValueOnce(pendingPromotion);

    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));

    act(() => result.current.setContent("先に保存する内容"));
    let promotion: Promise<void> | undefined;
    await act(async () => {
      promotion = result.current.promote();
      result.current.setContent("保存中に追記した内容");
      resolvePromotion?.({
        note: savedNote,
        draft: {
          content: "",
          tags: [],
          updatedAt: "2026-07-13T00:00:01.000Z",
        },
      });
      await promotion;
    });

    expect(result.current.content).toBe("保存中に追記した内容");
  });

  it("coalesces repeated promotion requests while the first is in flight", async () => {
    let resolvePromotion: ((value: unknown) => void) | undefined;
    mocks.promote.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromotion = resolve;
      }),
    );
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));
    act(() => result.current.setContent("一度だけ作成するメモ"));

    let firstPromotion: Promise<void> | undefined;
    act(() => {
      firstPromotion = result.current.promote();
      void result.current.promote();
    });
    expect(mocks.promote).toHaveBeenCalledOnce();

    await act(async () => {
      resolvePromotion?.({
        note: savedNote,
        draft: {
          content: "",
          tags: [],
          updatedAt: "2026-07-13T00:00:02.000Z",
        },
      });
      await firstPromotion;
    });
    expect(result.current.content).toBe("");
  });

  it("waits for an in-flight save before replacing state from a backup", async () => {
    let resolveSave: ((value: unknown) => void) | undefined;
    mocks.saveDraft.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const importedState: QuickCaptureState = {
      draft: {
        content: "復元した下書き",
        tags: [],
        updatedAt: "2026-07-14T00:00:00.000Z",
      },
      notes: [],
    };
    const { result } = renderHook(() => useQuickCapture());
    await waitFor(() => expect(result.current.content).toBe("下書きの内容"));
    mocks.load.mockResolvedValue(importedState);

    act(() => result.current.setContent("置き換え前の編集中メモ"));
    let savePromise: Promise<boolean> | undefined;
    await act(async () => {
      savePromise = result.current.retrySave();
      await Promise.resolve();
    });
    expect(mocks.saveDraft).toHaveBeenCalledOnce();

    let importPromise: Promise<string | null> | undefined;
    act(() => {
      importPromise = result.current.importBackup("/tmp/backup.mintbackup");
    });
    await Promise.resolve();
    expect(mocks.importBackup).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave?.({
        content: "置き換え前の編集中メモ",
        tags: [],
        updatedAt: "2026-07-13T00:00:02.000Z",
      });
      await Promise.all([savePromise, importPromise]);
    });

    expect(mocks.importBackup).toHaveBeenCalledWith("/tmp/backup.mintbackup");
    expect(result.current.content).toBe("復元した下書き");
    expect(mocks.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.importBackup.mock.invocationCallOrder[0],
    );
  });
});
