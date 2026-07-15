import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type {
  AddFileShelfContentInput,
  AddFileShelfPathsInput,
  FileShelfMutation,
  FileShelfPreview,
  FileShelfRemoval,
  FileShelfState,
} from "./types";

const DRAG_PREVIEW_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAFcklEQVR42t1Xa2wUVRQ+d3aWLn1sWwpbaIugpVBKoRAUG1SKBWwkMUpMGqxpECNVTGyKCQaCJOUHP2piMP5pItEEo2JIiEikiTawFZEEfBTCstJAi7WyLWm7bWm3Oztz7z3eOzvbx7Jb+0pMbHK7Z/Zxv+8755tzz6jwH/+p/2cC5NSpU4oMvF4vqa2tZSLEh74024ASTMTK07vIDt3eX0qYogR57wrEjM9ffuzDT6NJzAYBqc5W8rq6FlW9AknfNqYECjlyCLFh0FkImIhBX1SvNG99p7y8nM1WCUhVVZW668iyV5na/RYqg09SzoBxA3SuhYE5FeAAnAsCMLzxVjg7M/eAALbvrs0t5w7/QQ53V3FkJpjOdAEeDAML0Ai4jDlns2NCt9vtcKxt/I6T9i1hEEMAMDPdBjNApt58X4iWqedWzEFb6PP5ZpQB0tDQMMdZ9Nthjfi3yHTLxS1wKlTHA5eZYDicGWtTZdJGcx/P/mL+H5+FaChVKqVMKtdHwNlE4NID1Hk9KysLp0PABL+S3OO+jYMVZ9rTbklAiqLeLDgCzseAsyhw+RnG2VyZhOHUG07/l32gLwNEuKn3vcH1xO+ly6npgYfB+RjwCBnCEr0FBQVTy4BoLDZStebdexDaxDiam3VyrehGb9ZpZoGPqOVjwKOvxV0C3OkWPYBPiYDoarY2ZXCfcBdI9XJJ1c09jjwmus0oYIQMxCgDA4WlX/d9m3EiVitWJlLf9UJGzSAamQzD6kHyF3E3HyhjNOUaiwLnUeCyP3Bqv69qOfv10uKMKXlA9vR2GNpjquej6qmIOzC0hhgOLx+nfHxJUGRIZYu/7hjYWXla2/bBHTQOSVGT7QMESrIX9kHnsmj1kgwV8S9+p1HoGgWXHKkAtdEFF3VtcZOHbkjx8Tkld5H9IO+UJYrtaCwPxG1EvamsONxLx6sHebBIpSwhEAEnRsYllbm++n3g+b4OBd/u4KyOmqSp+TuV80DOT9fOxvKAGqf+yjnaXspAqsdR9RhWL0khEkSW2GoPLDl0Obgdbiv0aA9hudQyQ5hA+DWfK2fFLcimdBZQgmlmBoRaipZ6HlYv42EtsUUdWl3aYDx1wAvGXsmMRgHL+jiE+nxC3ouV/rgmlAbUgTlH1PPx6h1IAstvzD3ZoBUf8FJjL2XiXLCW+AeUhl9VxgLPKMqLjw+xzljpj0tAdqwEavsrnvpHIanpwYa8BW2cVprAdMwS1y7GW4uBHHhJsefjN40XL9vuuaY3E8ZQL+MVPO3wXWrfOcRDyRnIWxdyOJ+E2GxHxb/c03bOZrPxB+np2I79G3vW5dT5fb0FYmp6Qiw6KQKyXnt+/qh5VH3ECwjrSFr90LkWj/LK8vXPobJe7/57/j0a3NGthyoMjineNDw4qOuLuh7czwxafng2wVlfULASp5IBzG7sP5FQAscEaBK17n8Xqq0lyrx9HvCB3vnnvAtaf0MXo5lmeThCpB0GI6eRnIJEnJMy95MpmTBSgCx0NIFVf0miyDb/Tf9VP+vfvPJI43BvXZdhZIJlOGEACJpr9FrWbVNC8kmXb9gTz4QTTcWkxn2s6ILReUmjNGk1OOtXX4Vq+cH5R9RfW3StyGr4EEn1yIFgZoNBHrG3vrZ26arq7dUhmMY8gGk/DnjyifPEYki4JsBr5MOFnOtaNAFuKQ1aSsVACGOzkQe21q3JSzcLcH3CaeffBhJ5gFxKbV/5cdn+m5KUnIjPFM7To+scyYa83uRIPVlWuGi3BY4zejSzHiRujt3IrHMUaCpCYJU9sSk33fm+y2d4BDid1LA5nQeSyuN1O1SrfIbGMT2R3AldafPKoTPeM+BsEoj3O5zOTv8AoN2SOxwvzZMAAAAASUVORK5CYII=";

const isBrowserMock = () =>
  typeof window !== "undefined" &&
  Boolean((window as unknown as Record<string, unknown>).__MINT_BROWSER_MOCK__);

export const loadFileShelfState = () =>
  invoke<FileShelfState>("load_file_shelf_state");

export const loadFileShelfPreview = (itemId: string) =>
  invoke<FileShelfPreview>("load_file_shelf_preview", { itemId });

export const addFileShelfPaths = (input: AddFileShelfPathsInput) =>
  invoke<FileShelfMutation>("add_file_shelf_paths", { input });

export const addFileShelfContent = (input: AddFileShelfContentInput) =>
  invoke<FileShelfMutation>("add_file_shelf_content", { input });

export const removeFileShelfItems = (itemIds: string[]) =>
  invoke<FileShelfRemoval>("remove_file_shelf_items", { itemIds });

export const setFileShelfItemsPinned = (itemIds: string[], pinned: boolean) =>
  invoke<FileShelfState>("set_file_shelf_items_pinned", { itemIds, pinned });

export const renameFileShelfItem = (itemId: string, displayName: string) =>
  invoke<FileShelfState>("rename_file_shelf_item", { itemId, displayName });

export const restoreFileShelfRemoval = (undoToken: string) =>
  invoke<FileShelfState>("restore_file_shelf_removal", { undoToken });

export const restoreRecentFileShelfRemoval = () =>
  invoke<FileShelfState>("restore_recent_file_shelf_removal");

export const clearFileShelf = () =>
  invoke<FileShelfRemoval>("clear_file_shelf");

export const clearFileShelfClipboardHistory = () =>
  invoke<FileShelfRemoval>("clear_file_shelf_clipboard_history");

export const setFileShelfExpanded = (expanded: boolean, focus = expanded) =>
  invoke<void>("set_file_shelf_expanded", { expanded, focus });

export const shouldAutoExpandFileShelf = () =>
  invoke<boolean>("should_auto_expand_file_shelf");

export const chooseFileShelfPaths = () =>
  open({
    title: "ファイルシェルへ追加",
    multiple: true,
    directory: false,
  });

export const chooseFileShelfFolders = () =>
  open({
    title: "ファイルシェルへフォルダを追加",
    multiple: true,
    directory: true,
  });

export const applicationNameFromPath = (path: string) => {
  const name = path.trim().split(/[\\/]/).pop()?.trim();
  return name || null;
};

export const chooseIgnoredFileShelfApplication = async () => {
  const selection = await open({
    title: "ファイルシェルで除外するアプリを選択",
    multiple: false,
    directory: false,
    filters: [{ name: "Windows アプリ", extensions: ["exe"] }],
  });
  const path = Array.isArray(selection) ? selection[0] : selection;
  return path ? applicationNameFromPath(path) : null;
};

export const openFileShelfPath = (path: string) => openPath(path);

export const revealFileShelfPath = (path: string) => revealItemInDir(path);

export const openFileShelfUrl = (url: string) => openUrl(url);

export const startFileShelfDrag = async (
  paths: string[],
  mode: "copy" | "move" = "copy",
): Promise<"Dropped" | "Cancelled"> => {
  if (isBrowserMock()) {
    return new URLSearchParams(window.location.search).get("mockShelfDrag") ===
      "cancelled"
      ? "Cancelled"
      : "Dropped";
  }
  return new Promise<"Dropped" | "Cancelled">((resolve, reject) => {
    let settled = false;
    void startDrag(
      { item: paths, icon: DRAG_PREVIEW_ICON, mode },
      ({ result }) => {
        settled = true;
        // The Rust drag crate currently serializes cancellation as `Cancel`,
        // while the npm declaration calls it `Cancelled`. Normalize both here.
        resolve(result === "Dropped" ? "Dropped" : "Cancelled");
      },
    ).catch(reject);
    window.setTimeout(() => {
      if (!settled) reject(new Error("ドラッグ操作を開始できませんでした。"));
    }, 60_000);
  });
};
