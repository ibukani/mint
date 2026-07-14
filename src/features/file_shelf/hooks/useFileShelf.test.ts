import type { DragDropEvent } from "@tauri-apps/api/webview";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileShelf } from "./useFileShelf";

const apiMocks = vi.hoisted(() => ({
  addFileShelfPaths: vi.fn(),
  loadFileShelfState: vi.fn(),
}));

const webviewMocks = vi.hoisted(() => ({
  dragHandler: null as ((event: { payload: DragDropEvent }) => void) | null,
  onDragDropEvent: vi.fn(),
}));

vi.mock("../api", () => ({
  addFileShelfContent: vi.fn(),
  addFileShelfPaths: apiMocks.addFileShelfPaths,
  chooseFileShelfPaths: vi.fn(),
  clearFileShelf: vi.fn(),
  clearFileShelfClipboardHistory: vi.fn(),
  loadFileShelfState: apiMocks.loadFileShelfState,
  openFileShelfPath: vi.fn(),
  openFileShelfUrl: vi.fn(),
  removeFileShelfItems: vi.fn(),
  restoreFileShelfRemoval: vi.fn(),
  revealFileShelfPath: vi.fn(),
  setFileShelfExpanded: vi.fn(),
  startFileShelfDrag: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => vi.fn()),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: webviewMocks.onDragDropEvent,
  }),
}));

describe("useFileShelf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.loadFileShelfState.mockResolvedValue({ groups: [] });
    apiMocks.addFileShelfPaths.mockResolvedValue({
      state: { groups: [] },
      addedCount: 1,
      skippedCount: 0,
    });
    webviewMocks.dragHandler = null;
    webviewMocks.onDragDropEvent.mockImplementation(
      async (handler: (event: { payload: DragDropEvent }) => void) => {
        webviewMocks.dragHandler = handler;
        return vi.fn();
      },
    );
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
});
