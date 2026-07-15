import type {
  AddFileShelfContentInput,
  AddFileShelfPathsInput,
} from "../../features/file_shelf/types";
import {
  mockAddFileShelfContent,
  mockAddFileShelfPaths,
  mockClearFileShelf,
  mockClearFileShelfClipboardHistory,
  mockLoadFileShelfPreview,
  mockLoadFileShelfState,
  mockRemoveFileShelfItems,
  mockRenameFileShelfItem,
  mockRestoreFileShelfRemoval,
  mockRestoreRecentFileShelfRemoval,
  mockSetFileShelfItemsPinned,
} from "./fileShelfMock";
import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

export interface FileShelfIpcMockOptions {
  shouldAutoExpand?: () => boolean | Promise<boolean>;
}

export async function handleFileShelfIpcCommand(
  command: string,
  args: MockIPCArgs,
  options: FileShelfIpcMockOptions = {},
): Promise<MockIPCResult> {
  switch (command) {
    case "load_file_shelf_state":
      return handled(mockLoadFileShelfState());
    case "load_file_shelf_preview": {
      const itemId = args?.itemId as string | undefined;
      if (!itemId) throw new Error("File shelf item id is required.");
      return handled(mockLoadFileShelfPreview(itemId));
    }
    case "add_file_shelf_paths": {
      const input = args?.input as AddFileShelfPathsInput | undefined;
      if (!input) throw new Error("File shelf paths are required.");
      return handled(mockAddFileShelfPaths(input));
    }
    case "add_file_shelf_content": {
      const input = args?.input as AddFileShelfContentInput | undefined;
      if (!input) throw new Error("File shelf content is required.");
      return handled(mockAddFileShelfContent(input));
    }
    case "remove_file_shelf_items": {
      const itemIds = args?.itemIds as string[] | undefined;
      if (!itemIds) throw new Error("File shelf item ids are required.");
      return handled(mockRemoveFileShelfItems(itemIds));
    }
    case "set_file_shelf_items_pinned": {
      const itemIds = args?.itemIds as string[] | undefined;
      const pinned = args?.pinned as boolean | undefined;
      if (!itemIds || pinned === undefined) {
        throw new Error("File shelf pin state is required.");
      }
      return handled(mockSetFileShelfItemsPinned(itemIds, pinned));
    }
    case "rename_file_shelf_item": {
      const itemId = args?.itemId as string | undefined;
      const displayName = args?.displayName as string | undefined;
      if (!itemId || displayName === undefined) {
        throw new Error("File shelf rename input is required.");
      }
      return handled(mockRenameFileShelfItem(itemId, displayName));
    }
    case "restore_file_shelf_removal": {
      const undoToken = args?.undoToken as string | undefined;
      if (!undoToken) throw new Error("File shelf undo token is required.");
      return handled(mockRestoreFileShelfRemoval(undoToken));
    }
    case "restore_recent_file_shelf_removal":
      return handled(mockRestoreRecentFileShelfRemoval());
    case "clear_file_shelf":
      return handled(mockClearFileShelf());
    case "clear_file_shelf_clipboard_history":
      return handled(mockClearFileShelfClipboardHistory());
    case "should_auto_expand_file_shelf":
      return handled(await (options.shouldAutoExpand?.() ?? true));
    case "set_file_shelf_expanded":
      return handled(undefined);
    default:
      return unhandled();
  }
}
