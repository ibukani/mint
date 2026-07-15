import { beforeEach, describe, expect, it } from "vitest";
import {
  clearFileShelfClipboardHistory,
  loadFileShelfPreview,
  renameFileShelfItem,
  setFileShelfItemsPinned,
} from "../../features/file_shelf/api";
import {
  mockAddFileShelfPaths,
  mockCaptureFileShelfClipboardText,
  mockClearFileShelfClipboardHistory,
  mockLoadFileShelfState,
  mockRemoveFileShelfItems,
  mockResetFileShelfRemovals,
  mockRestoreFileShelfRemoval,
  mockRestoreRecentFileShelfRemoval,
} from "./fileShelfMock";

describe("fileShelfMock", () => {
  beforeEach(() => {
    localStorage.removeItem("mint_mock_file_shelf");
    mockResetFileShelfRemovals();
  });

  it("groups a multi-path drop and ignores duplicate paths", () => {
    const mutation = mockAddFileShelfPaths({
      paths: ["C:\\Work\\one.txt", "C:\\Work\\two.txt", "c:\\work\\one.txt"],
    });
    expect(mutation.addedCount).toBe(2);
    expect(mutation.skippedCount).toBe(1);
    expect(mutation.state.groups).toHaveLength(1);
    expect(mutation.state.groups[0].items).toHaveLength(2);
  });

  it("identifies image paths and exposes a typed preview", async () => {
    const mutation = mockAddFileShelfPaths({
      paths: ["C:\\Work\\reference.png"],
    });
    const item = mutation.state.groups[0].items[0];

    expect(item.kind).toBe("image");
    await expect(loadFileShelfPreview(item.id)).resolves.toMatchObject({
      dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
    });
  });

  it("removes items and restores them with an undo token", () => {
    const mutation = mockAddFileShelfPaths({ paths: ["C:\\Work\\one.txt"] });
    const itemId = mutation.state.groups[0].items[0].id;
    const removal = mockRemoveFileShelfItems([itemId]);
    expect(removal.state.groups).toHaveLength(0);

    const restored = mockRestoreFileShelfRemoval(removal.undoToken);
    expect(restored.groups[0].items[0].id).toBe(itemId);
    expect(mockLoadFileShelfState()).toEqual(restored);
  });

  it("recalls recent removals without losing items added afterward", () => {
    const removed = mockAddFileShelfPaths({
      paths: ["C:\\Work\\removed.txt"],
    });
    mockRemoveFileShelfItems([removed.state.groups[0].items[0].id]);
    const addedLater = mockAddFileShelfPaths({
      paths: ["C:\\Work\\added-later.txt"],
    });

    const restored = mockRestoreRecentFileShelfRemoval();

    expect(
      restored.groups
        .flatMap((group) => group.items)
        .map((item) => item.displayName),
    ).toEqual(["removed.txt", "added-later.txt"]);
    expect(
      restored.groups
        .flatMap((group) => group.items)
        .some((item) => item.id === addedLater.state.groups[0].items[0].id),
    ).toBe(true);
    expect(() => mockRestoreRecentFileShelfRemoval()).toThrow("ありません");
  });

  it("recalls multiple removal batches newest first", () => {
    const first = mockAddFileShelfPaths({ paths: ["C:\\Work\\first.txt"] });
    mockRemoveFileShelfItems([first.state.groups[0].items[0].id]);
    const second = mockAddFileShelfPaths({ paths: ["C:\\Work\\second.txt"] });
    mockRemoveFileShelfItems([second.state.groups[0].items[0].id]);

    expect(
      mockRestoreRecentFileShelfRemoval().groups[0].items[0].displayName,
    ).toBe("second.txt");
    expect(
      mockRestoreRecentFileShelfRemoval().groups[0].items[0].displayName,
    ).toBe("first.txt");
  });

  it("deduplicates and limits clipboard history without removing manual items", () => {
    mockAddFileShelfPaths({ paths: ["C:\\Work\\keep.txt"] });
    for (let index = 0; index < 6; index += 1) {
      mockCaptureFileShelfClipboardText(`history ${index}`, 5);
    }
    const duplicate = mockCaptureFileShelfClipboardText("history 3", 5);

    expect(duplicate.addedCount).toBe(0);
    expect(duplicate.state.groups.flatMap((group) => group.items)).toHaveLength(
      6,
    );
    expect(duplicate.state.groups[0].items[0].textContent).toBe("history 3");

    const cleared = mockClearFileShelfClipboardHistory();
    expect(cleared.state.groups).toHaveLength(1);
    expect(cleared.state.groups[0].items[0].source).toBe("manual");
  });

  it("exposes clipboard-history clearing through the typed IPC mock", async () => {
    mockCaptureFileShelfClipboardText("remember me");

    const removal = await clearFileShelfClipboardHistory();

    expect(removal.state.groups).toHaveLength(0);
    expect(removal.undoToken).toBeTruthy();
  });

  it("persists pin state and protects pinned items from removal", async () => {
    const mutation = mockAddFileShelfPaths({
      paths: ["C:\\Work\\keep.pdf"],
    });
    const item = mutation.state.groups[0].items[0];

    const pinned = await setFileShelfItemsPinned([item.id], true);
    expect(pinned.groups[0].items[0].pinned).toBe(true);
    expect(() => mockRemoveFileShelfItems([item.id])).toThrow("固定");
    expect(mockLoadFileShelfState().groups[0].items[0].id).toBe(item.id);

    const unpinned = await setFileShelfItemsPinned([item.id], false);
    expect(unpinned.groups[0].items[0].pinned).toBe(false);
  });

  it("renames only the shelf label through the typed IPC mock", async () => {
    const mutation = mockAddFileShelfPaths({
      paths: ["C:\\Work\\original.pdf"],
    });
    const item = mutation.state.groups[0].items[0];

    const renamed = await renameFileShelfItem(item.id, "  提出用資料  ");

    expect(renamed.groups[0].items[0]).toMatchObject({
      displayName: "提出用資料",
      sourcePath: "C:\\Work\\original.pdf",
    });
    await expect(renameFileShelfItem(item.id, "\n")).rejects.toThrow(
      "名前を入力",
    );
  });
});
