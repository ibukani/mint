import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuickCaptureNote, QuickCaptureState } from "../types";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  importBackup: vi.fn(),
  promote: vi.fn(),
  saveDraft: vi.fn(),
  updateNote: vi.fn(),
  hide: vi.fn(),
  listen: vi.fn(),
}));

vi.mock("../api", () => ({
  addQuickCaptureAttachment: vi.fn(),
  chooseQuickCaptureAttachment: vi.fn(),
  createQuickCaptureNote: vi.fn(),
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
  getCurrentWindow: () => ({ hide: mocks.hide }),
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
    mocks.listen.mockResolvedValue(() => undefined);
    mocks.importBackup.mockResolvedValue(state);
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
