import { beforeEach, describe, expect, it } from "vitest";
import { clearFileShelfClipboardHistory } from "../../features/file_shelf/api";
import {
  mockAddFileShelfPaths,
  mockCaptureFileShelfClipboardText,
  mockClearFileShelfClipboardHistory,
  mockLoadFileShelfState,
  mockRemoveFileShelfItems,
  mockRestoreFileShelfRemoval,
} from "./fileShelfMock";

describe("fileShelfMock", () => {
  beforeEach(() => localStorage.removeItem("mint_mock_file_shelf"));

  it("groups a multi-path drop and ignores duplicate paths", () => {
    const mutation = mockAddFileShelfPaths({
      paths: ["C:\\Work\\one.txt", "C:\\Work\\two.txt", "c:\\work\\one.txt"],
    });
    expect(mutation.addedCount).toBe(2);
    expect(mutation.skippedCount).toBe(1);
    expect(mutation.state.groups).toHaveLength(1);
    expect(mutation.state.groups[0].items).toHaveLength(2);
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
});
