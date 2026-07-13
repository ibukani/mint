import { beforeEach, describe, expect, it } from "vitest";
import {
  mockAddFileShelfPaths,
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
});
