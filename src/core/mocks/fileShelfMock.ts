import type {
  AddFileShelfContentInput,
  AddFileShelfPathsInput,
  FileShelfGroup,
  FileShelfItem,
  FileShelfItemKind,
  FileShelfMutation,
  FileShelfRemoval,
  FileShelfState,
} from "../../features/file_shelf/types";

const STORAGE_KEY = "mint_mock_file_shelf";
const removals = new Map<
  string,
  { state: FileShelfState; removedAt: number }
>();

const emptyState = (): FileShelfState => ({ groups: [] });

const read = (): FileShelfState => {
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) return emptyState();
  try {
    return JSON.parse(value) as FileShelfState;
  } catch {
    return emptyState();
  }
};

const write = (state: FileShelfState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const fileName = (path: string) =>
  path.split(/[\\/]/).filter(Boolean).pop() || path;

const createGroup = (
  items: Array<
    Omit<FileShelfItem, "id" | "groupId" | "createdAt" | "availability">
  >,
): FileShelfGroup => {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  return {
    id,
    createdAt,
    items: items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      groupId: id,
      createdAt,
      availability: "ready",
    })),
  };
};

export const mockLoadFileShelfState = () => read();

export const mockAddFileShelfPaths = (
  input: AddFileShelfPathsInput,
): FileShelfMutation => {
  const state = read();
  const existing = new Set(
    state.groups
      .flatMap((group) => group.items)
      .flatMap((item) =>
        item.sourcePath ? [item.sourcePath.toLowerCase()] : [],
      ),
  );
  const paths = input.paths.filter((path) => {
    const key = path.toLowerCase();
    if (!path.trim() || existing.has(key)) return false;
    existing.add(key);
    return true;
  });
  const items = paths.map((path) => {
    const kind: FileShelfItemKind = /[\\/]$/.test(path) ? "folder" : "file";
    return {
      kind,
      displayName: fileName(path),
      sourcePath: path,
      textContent: null,
      mimeType: null,
      sizeBytes: kind === "file" ? 0 : null,
    };
  });
  const next = items.length
    ? { groups: [createGroup(items), ...state.groups] }
    : state;
  write(next);
  return {
    state: next,
    addedCount: items.length,
    skippedCount: input.paths.length - items.length,
  };
};

export const mockAddFileShelfContent = (
  input: AddFileShelfContentInput,
): FileShelfMutation => {
  const state = read();
  let item: Omit<
    FileShelfItem,
    "id" | "groupId" | "createdAt" | "availability"
  >;
  if (input.kind === "image") {
    if (!input.dataBase64) throw new Error("画像データが空です。");
    item = {
      kind: "image",
      displayName: input.fileName || "pasted-image.png",
      sourcePath: `mock://file-shelf/${crypto.randomUUID()}`,
      textContent: null,
      mimeType: input.mimeType,
      sizeBytes: input.dataBase64.length,
    };
  } else {
    const value = input.kind === "url" ? input.url : input.text;
    if (!value.trim()) throw new Error("貼り付ける内容が空です。");
    item = {
      kind: input.kind,
      displayName:
        input.kind === "url"
          ? new URL(value).host
          : value.trim().replace(/\s+/g, " ").slice(0, 42),
      sourcePath: null,
      textContent: value.trim(),
      mimeType: input.kind === "url" ? "text/uri-list" : "text/plain",
      sizeBytes: null,
    };
  }
  const next = { groups: [createGroup([item]), ...state.groups] };
  write(next);
  return { state: next, addedCount: 1, skippedCount: 0 };
};

export const mockRemoveFileShelfItems = (
  itemIds: string[],
): FileShelfRemoval => {
  const previous = read();
  const activeIds = new Set(
    previous.groups.flatMap((group) => group.items.map((item) => item.id)),
  );
  if (!itemIds.some((id) => activeIds.has(id))) {
    throw new Error(
      itemIds.length
        ? "項目が見つかりません。"
        : "削除する項目を選択してください。",
    );
  }
  const selected = new Set(itemIds);
  const groups = previous.groups.flatMap((group) => {
    const items = group.items.filter((item) => !selected.has(item.id));
    return items.length ? [{ ...group, items }] : [];
  });
  const state = { groups };
  const undoToken = crypto.randomUUID();
  removals.set(undoToken, { state: previous, removedAt: Date.now() });
  write(state);
  return { state, undoToken };
};

export const mockRestoreFileShelfRemoval = (undoToken: string) => {
  const removal = removals.get(undoToken);
  if (!removal || Date.now() - removal.removedAt > 10_000) {
    throw new Error("元に戻せる時間を過ぎました。");
  }
  removals.delete(undoToken);
  write(removal.state);
  return removal.state;
};

export const mockClearFileShelf = () => {
  const ids = read().groups.flatMap((group) =>
    group.items.map((item) => item.id),
  );
  return mockRemoveFileShelfItems(ids);
};
