import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFileShelf } from "./useFileShelf";

const apiMocks = vi.hoisted(() => ({
  loadFileShelfState: vi.fn(),
}));

vi.mock("../api", () => ({
  addFileShelfContent: vi.fn(),
  addFileShelfPaths: vi.fn(),
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
    onDragDropEvent: vi.fn(async () => vi.fn()),
  }),
}));

describe("useFileShelf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.loadFileShelfState.mockResolvedValue({ groups: [] });
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
});
