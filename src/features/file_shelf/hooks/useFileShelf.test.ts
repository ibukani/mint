import type { DragDropEvent } from "@tauri-apps/api/webview";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileShelf } from "./useFileShelf";

const apiMocks = vi.hoisted(() => ({
  addFileShelfPaths: vi.fn(),
  chooseFileShelfFolders: vi.fn(),
  loadFileShelfState: vi.fn(),
  removeFileShelfItems: vi.fn(),
  renameFileShelfItem: vi.fn(),
  restoreRecentFileShelfRemoval: vi.fn(),
  setFileShelfExpanded: vi.fn(),
  setFileShelfItemsPinned: vi.fn(),
  shouldAutoExpandFileShelf: vi.fn(),
  startFileShelfDrag: vi.fn(),
}));

const webviewMocks = vi.hoisted(() => ({
  dragHandler: null as ((event: { payload: DragDropEvent }) => void) | null,
  onDragDropEvent: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: { payload: unknown }) => void>(),
}));

vi.mock("../api", () => ({
  addFileShelfContent: vi.fn(),
  addFileShelfPaths: apiMocks.addFileShelfPaths,
  chooseFileShelfFolders: apiMocks.chooseFileShelfFolders,
  chooseFileShelfPaths: vi.fn(),
  clearFileShelf: vi.fn(),
  clearFileShelfClipboardHistory: vi.fn(),
  loadFileShelfState: apiMocks.loadFileShelfState,
  openFileShelfPath: vi.fn(),
  openFileShelfUrl: vi.fn(),
  removeFileShelfItems: apiMocks.removeFileShelfItems,
  renameFileShelfItem: apiMocks.renameFileShelfItem,
  restoreFileShelfRemoval: vi.fn(),
  restoreRecentFileShelfRemoval: apiMocks.restoreRecentFileShelfRemoval,
  revealFileShelfPath: vi.fn(),
  setFileShelfExpanded: apiMocks.setFileShelfExpanded,
  setFileShelfItemsPinned: apiMocks.setFileShelfItemsPinned,
  shouldAutoExpandFileShelf: apiMocks.shouldAutoExpandFileShelf,
  startFileShelfDrag: apiMocks.startFileShelfDrag,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    async (
      eventName: string,
      handler: (event: { payload: unknown }) => void,
    ) => {
      eventMocks.handlers.set(eventName, handler);
      return vi.fn();
    },
  ),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: webviewMocks.onDragDropEvent,
  }),
}));

describe("useFileShelf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventMocks.handlers.clear();
    apiMocks.loadFileShelfState.mockResolvedValue({ groups: [] });
    apiMocks.addFileShelfPaths.mockResolvedValue({
      state: { groups: [] },
      addedCount: 1,
      skippedCount: 0,
    });
    apiMocks.chooseFileShelfFolders.mockResolvedValue(["C:\\Work\\assets"]);
    apiMocks.setFileShelfExpanded.mockResolvedValue(undefined);
    apiMocks.shouldAutoExpandFileShelf.mockResolvedValue(true);
    apiMocks.setFileShelfItemsPinned.mockResolvedValue({ groups: [] });
    apiMocks.renameFileShelfItem.mockResolvedValue({ groups: [] });
    apiMocks.removeFileShelfItems.mockResolvedValue({
      state: { groups: [] },
      undoToken: "drag-undo",
    });
    apiMocks.restoreRecentFileShelfRemoval.mockResolvedValue({ groups: [] });
    apiMocks.startFileShelfDrag.mockResolvedValue("Dropped");
    webviewMocks.dragHandler = null;
    webviewMocks.onDragDropEvent.mockImplementation(
      async (handler: (event: { payload: DragDropEvent }) => void) => {
        webviewMocks.dragHandler = handler;
        return vi.fn();
      },
    );
  });

  it("shows shortcut capture success and failure feedback", async () => {
    const { result } = renderHook(() => useFileShelf());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() =>
      expect(eventMocks.handlers.has("file-shelf-notice")).toBe(true),
    );

    act(() => {
      eventMocks.handlers.get("file-shelf-notice")?.({
        payload: "クリップボードから棚へ保存しました",
      });
    });
    expect(result.current.notice).toBe("クリップボードから棚へ保存しました");
    expect(result.current.error).toBe("");

    act(() => {
      eventMocks.handlers.get("file-shelf-error")?.({
        payload: "クリップボードに対応する内容がありません。",
      });
    });
    expect(result.current.notice).toBe("");
    expect(result.current.error).toBe(
      "クリップボードに対応する内容がありません。",
    );
  });

  it("recalls recently removed items and reports failures", async () => {
    const restoredState = {
      groups: [
        {
          id: "restored-group",
          createdAt: "2026-07-15T00:00:00Z",
          items: [],
        },
      ],
    };
    apiMocks.restoreRecentFileShelfRemoval.mockResolvedValueOnce(restoredState);
    const { result } = renderHook(() => useFileShelf());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.restoreRecent();
    });
    expect(result.current.state).toEqual(restoredState);
    expect(result.current.notice).toBe("最近外した項目を棚へ戻しました");

    apiMocks.restoreRecentFileShelfRemoval.mockRejectedValueOnce(
      new Error("最近棚から外した項目はありません。"),
    );
    await act(async () => {
      await result.current.restoreRecent();
    });
    expect(result.current.error).toBe("最近棚から外した項目はありません。");
  });

  it("clears a stale ten-second undo after shortcut recall", async () => {
    const { result } = renderHook(() => useFileShelf());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.removeItems(["removed"]);
    });
    expect(result.current.undoToken).toBe("drag-undo");
    await waitFor(() =>
      expect(
        eventMocks.handlers.has("file-shelf-recent-removal-restored"),
      ).toBe(true),
    );

    act(() => {
      eventMocks.handlers.get("file-shelf-recent-removal-restored")?.({
        payload: undefined,
      });
    });

    expect(result.current.undoToken).toBe("");
  });

  it("copies multiple shelf items as a newline-separated list", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { result } = renderHook(() => useFileShelf());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.copyItems([
        {
          id: "url",
          groupId: "group",
          kind: "url",
          displayName: "example.com",
          sourcePath: null,
          textContent: "https://example.com",
          mimeType: "text/uri-list",
          sizeBytes: null,
          createdAt: "2026-07-14T00:00:00Z",
          availability: "ready",
          source: "manual",
          pinned: false,
        },
        {
          id: "text",
          groupId: "group",
          kind: "text",
          displayName: "メモ",
          sourcePath: null,
          textContent: "複数選択のメモ",
          mimeType: "text/plain",
          sizeBytes: null,
          createdAt: "2026-07-14T00:00:00Z",
          availability: "ready",
          source: "manual",
          pinned: false,
        },
      ]);
    });

    expect(writeText).toHaveBeenCalledWith(
      "https://example.com\n複数選択のメモ",
    );
    expect(result.current.notice).toBe("2件をクリップボードへコピーしました");
  });

  it("tracks the native drag target and adds dropped paths", async () => {
    const { result } = renderHook(() => useFileShelf());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(webviewMocks.dragHandler).not.toBeNull();

    act(() => {
      webviewMocks.dragHandler?.({
        payload: {
          type: "enter",
          paths: ["C:\\Work\\report.pdf"],
          position: { x: 0, y: 0 },
        } as DragDropEvent,
      });
    });
    expect(result.current.isDropTarget).toBe(true);
    await waitFor(() => expect(result.current.transientExpanded).toBe(true));

    act(() => {
      webviewMocks.dragHandler?.({ payload: { type: "leave" } });
    });
    expect(result.current.isDropTarget).toBe(false);

    act(() => {
      webviewMocks.dragHandler?.({
        payload: {
          type: "drop",
          paths: ["C:\\Work\\report.pdf"],
          position: { x: 0, y: 0 },
        } as DragDropEvent,
      });
    });
    await waitFor(() =>
      expect(apiMocks.addFileShelfPaths).toHaveBeenCalledWith({
        paths: ["C:\\Work\\report.pdf"],
      }),
    );
    expect(result.current.isDropTarget).toBe(false);
  });

  it("keeps the shelf collapsed for drags from an ignored application", async () => {
    apiMocks.shouldAutoExpandFileShelf.mockResolvedValue(false);
    const { result } = renderHook(() => useFileShelf());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      webviewMocks.dragHandler?.({
        payload: {
          type: "enter",
          paths: ["C:\\Work\\secret.txt"],
          position: { x: 0, y: 0 },
        } as DragDropEvent,
      });
    });

    await waitFor(() =>
      expect(apiMocks.shouldAutoExpandFileShelf).toHaveBeenCalledOnce(),
    );
    expect(result.current.isDropTarget).toBe(true);
    expect(result.current.transientExpanded).toBe(false);
    expect(apiMocks.setFileShelfExpanded).not.toHaveBeenCalled();
  });

  it("does not expand after the drag leaves while source detection is pending", async () => {
    let resolveDetection: ((value: boolean) => void) | undefined;
    apiMocks.shouldAutoExpandFileShelf.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveDetection = resolve;
      }),
    );
    const { result } = renderHook(() => useFileShelf());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      webviewMocks.dragHandler?.({
        payload: {
          type: "enter",
          paths: ["C:\\Work\\report.pdf"],
          position: { x: 0, y: 0 },
        } as DragDropEvent,
      });
      webviewMocks.dragHandler?.({ payload: { type: "leave" } });
      resolveDetection?.(true);
    });

    await waitFor(() => expect(result.current.isDropTarget).toBe(false));
    expect(result.current.transientExpanded).toBe(false);
    expect(apiMocks.setFileShelfExpanded).not.toHaveBeenCalled();
  });

  it("adds folders selected from the native folder picker", async () => {
    const { result } = renderHook(() => useFileShelf());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.chooseFolders();
    });

    expect(apiMocks.addFileShelfPaths).toHaveBeenCalledWith({
      paths: ["C:\\Work\\assets"],
    });
  });

  it("pins items and keeps pinned files after a successful outward drag", async () => {
    const pinnedItem = {
      id: "pinned",
      groupId: "group",
      kind: "file" as const,
      displayName: "reference.pdf",
      sourcePath: "C:\\Work\\reference.pdf",
      textContent: null,
      mimeType: null,
      sizeBytes: 1024,
      createdAt: "2026-07-15T00:00:00Z",
      availability: "ready" as const,
      source: "manual" as const,
      pinned: true,
    };
    const { result } = renderHook(() => useFileShelf());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.pinItems([pinnedItem], false);
    });
    expect(apiMocks.setFileShelfItemsPinned).toHaveBeenCalledWith(
      ["pinned"],
      false,
    );

    await act(async () => {
      await result.current.dragItems([pinnedItem]);
    });
    expect(apiMocks.startFileShelfDrag).toHaveBeenCalledWith(
      ["C:\\Work\\reference.pdf"],
      "copy",
    );
    expect(apiMocks.removeFileShelfItems).not.toHaveBeenCalled();
    expect(result.current.notice).toContain("固定中の項目は棚に残ります");
  });

  it("waits for destination confirmation before removing a dragged file", async () => {
    const item = {
      id: "safe-copy",
      groupId: "group",
      kind: "file" as const,
      displayName: "report.pdf",
      sourcePath: "C:\\Work\\report.pdf",
      textContent: null,
      mimeType: null,
      sizeBytes: 1024,
      createdAt: "2026-07-15T00:00:00Z",
      availability: "ready" as const,
      source: "manual" as const,
      pinned: false,
    };
    const { result } = renderHook(() => useFileShelf());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.dragItems([item]);
    });

    expect(apiMocks.removeFileShelfItems).not.toHaveBeenCalled();
    expect(result.current.pendingDragCount).toBe(1);
    expect(result.current.notice).toContain("ドロップ先を確認");

    await act(async () => {
      await result.current.confirmDraggedItems();
    });
    expect(apiMocks.removeFileShelfItems).toHaveBeenCalledWith(["safe-copy"]);
    expect(result.current.pendingDragCount).toBe(0);
    expect(result.current.undoToken).toBe("drag-undo");
  });

  it("can keep a file after an uncertain outward drop", async () => {
    const item = {
      id: "keep-copy",
      groupId: "group",
      kind: "file" as const,
      displayName: "reference.pdf",
      sourcePath: "C:\\Work\\reference.pdf",
      textContent: null,
      mimeType: null,
      sizeBytes: 1024,
      createdAt: "2026-07-15T00:00:00Z",
      availability: "ready" as const,
      source: "manual" as const,
      pinned: false,
    };
    const { result } = renderHook(() => useFileShelf());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.dragItems([item]);
    });
    act(() => result.current.keepDraggedItems());

    expect(apiMocks.removeFileShelfItems).not.toHaveBeenCalled();
    expect(result.current.pendingDragCount).toBe(0);
    expect(result.current.notice).toBe("1件を棚に残しました");
  });

  it("renames the shelf label without changing the source path", async () => {
    const item = {
      id: "report",
      groupId: "group",
      kind: "file" as const,
      displayName: "report.pdf",
      sourcePath: "C:\\Work\\report.pdf",
      textContent: null,
      mimeType: null,
      sizeBytes: 1024,
      createdAt: "2026-07-15T00:00:00Z",
      availability: "ready" as const,
      source: "manual" as const,
      pinned: false,
    };
    const { result } = renderHook(() => useFileShelf());

    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      expect(await result.current.renameItem(item, "  提出用  ")).toBe(true);
    });

    expect(apiMocks.renameFileShelfItem).toHaveBeenCalledWith(
      "report",
      "  提出用  ",
    );
    expect(item.sourcePath).toBe("C:\\Work\\report.pdf");
    expect(result.current.notice).toBe("「提出用」として棚に表示します");
  });
});
