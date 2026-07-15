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
  { groups: FileShelfGroup[]; removedAt: number; sequence: number }
>();
let removalSequence = 0;

export const mockResetFileShelfRemovals = () => {
  removals.clear();
  removalSequence = 0;
};

const emptyState = (): FileShelfState => ({ groups: [] });

const read = (): FileShelfState => {
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) return emptyState();
  try {
    const parsed = JSON.parse(value) as FileShelfState;
    return {
      groups: parsed.groups.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          source: item.source ?? "manual",
          pinned: item.pinned ?? false,
        })),
      })),
    };
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
    Omit<
      FileShelfItem,
      "id" | "groupId" | "createdAt" | "availability" | "pinned"
    >
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
      pinned: false,
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
    const isFolder = /[\\/]$/.test(path);
    const isImage = /\.(?:png|jpe?g|gif|webp)$/i.test(path);
    const kind: FileShelfItemKind = isFolder
      ? "folder"
      : isImage
        ? "image"
        : "file";
    return {
      kind,
      displayName: fileName(path),
      sourcePath: path,
      textContent: null,
      mimeType: isImage ? "image/png" : null,
      sizeBytes: kind === "file" ? 0 : null,
      source: "manual" as const,
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

export const mockLoadFileShelfPreview = (itemId: string) => {
  const item = read()
    .groups.flatMap((group) => group.items)
    .find((candidate) => candidate.id === itemId);
  if (!item) throw new Error("プレビューする項目が見つかりません。");
  return {
    dataUrl:
      item.kind === "image"
        ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XxT7WQAAAABJRU5ErkJggg=="
        : null,
  };
};

export const mockAddFileShelfContent = (
  input: AddFileShelfContentInput,
): FileShelfMutation => {
  const state = read();
  let item: Omit<
    FileShelfItem,
    "id" | "groupId" | "createdAt" | "availability" | "pinned"
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
      source: "manual",
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
      source: "manual",
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
  const removableIds = new Set(
    previous.groups.flatMap((group) =>
      group.items.filter((item) => !item.pinned).map((item) => item.id),
    ),
  );
  if (!itemIds.some((id) => removableIds.has(id))) {
    throw new Error(
      itemIds.length
        ? "項目が見つからないか、固定されています。"
        : "削除する項目を選択してください。",
    );
  }
  const selected = new Set(itemIds.filter((id) => removableIds.has(id)));
  const removedGroups = previous.groups.flatMap((group) => {
    const items = group.items.filter((item) => selected.has(item.id));
    return items.length ? [{ ...group, items }] : [];
  });
  const groups = previous.groups.flatMap((group) => {
    const items = group.items.filter((item) => !selected.has(item.id));
    return items.length ? [{ ...group, items }] : [];
  });
  const state = { groups };
  const undoToken = crypto.randomUUID();
  removals.set(undoToken, {
    groups: removedGroups,
    removedAt: Date.now(),
    sequence: ++removalSequence,
  });
  write(state);
  return { state, undoToken };
};

export const mockSetFileShelfItemsPinned = (
  itemIds: string[],
  pinned: boolean,
) => {
  if (!itemIds.length) {
    throw new Error("固定状態を変更する項目を選択してください。");
  }
  const selected = new Set(itemIds);
  const previous = read();
  let changed = 0;
  const groups = previous.groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (!selected.has(item.id) || item.pinned === pinned) return item;
      changed += 1;
      return { ...item, pinned };
    }),
  }));
  if (!changed) throw new Error("固定状態を変更できる項目がありません。");
  const state = {
    groups: [...groups].sort((left, right) => {
      const leftPinned = left.items.some((item) => item.pinned);
      const rightPinned = right.items.some((item) => item.pinned);
      return Number(rightPinned) - Number(leftPinned);
    }),
  };
  write(state);
  return state;
};

export const mockRenameFileShelfItem = (
  itemId: string,
  displayName: string,
) => {
  const normalized = displayName.trim();
  if (!normalized) throw new Error("棚で表示する名前を入力してください。");
  if ([...normalized].length > 120) {
    throw new Error("棚で表示する名前は120文字以内にしてください。");
  }
  if (/\p{Cc}/u.test(normalized)) {
    throw new Error("棚で表示する名前に改行や制御文字は使えません。");
  }

  const previous = read();
  let changed = false;
  const groups = previous.groups.map((group) => ({
    ...group,
    items: group.items.map((item) => {
      if (item.id !== itemId || item.displayName === normalized) return item;
      changed = true;
      return { ...item, displayName: normalized };
    }),
  }));
  if (!changed) {
    throw new Error("名前を変更できる項目がないか、同じ名前です。");
  }
  const state = { groups };
  write(state);
  return state;
};

export const mockRestoreFileShelfRemoval = (undoToken: string) => {
  const removal = removals.get(undoToken);
  if (!removal || Date.now() - removal.removedAt > 10_000) {
    throw new Error("元に戻せる時間を過ぎました。");
  }
  removals.delete(undoToken);
  return restoreRemovalGroups(removal.groups);
};

const restoreRemovalGroups = (removedGroups: FileShelfGroup[]) => {
  const current = read();
  const restoredIds = new Set(removedGroups.map((group) => group.id));
  const currentById = new Map(current.groups.map((group) => [group.id, group]));
  const restored = removedGroups.map((removedGroup) => {
    const currentGroup = currentById.get(removedGroup.id);
    if (!currentGroup) return removedGroup;
    const currentItemIds = new Set(currentGroup.items.map((item) => item.id));
    return {
      ...currentGroup,
      items: [
        ...currentGroup.items,
        ...removedGroup.items.filter((item) => !currentItemIds.has(item.id)),
      ],
    };
  });
  const state = {
    groups: [
      ...restored,
      ...current.groups.filter((group) => !restoredIds.has(group.id)),
    ],
  };
  write(state);
  return state;
};

export const mockRestoreRecentFileShelfRemoval = () => {
  const recent = [...removals.entries()].sort(
    (left, right) =>
      right[1].removedAt - left[1].removedAt ||
      right[1].sequence - left[1].sequence,
  )[0];
  if (!recent) throw new Error("最近棚から外した項目はありません。");
  const [undoToken, removal] = recent;
  if (Date.now() - removal.removedAt > 24 * 60 * 60 * 1_000) {
    throw new Error("呼び戻せる項目の保存期間（24時間）を過ぎました。");
  }
  removals.delete(undoToken);
  return restoreRemovalGroups(removal.groups);
};

export const mockClearFileShelf = () => {
  const ids = read().groups.flatMap((group) =>
    group.items.filter((item) => !item.pinned).map((item) => item.id),
  );
  return mockRemoveFileShelfItems(ids);
};

export const mockCaptureFileShelfClipboardText = (
  value: string,
  maxItems = 25,
): FileShelfMutation => {
  const text = value.trim();
  if (!text || new TextEncoder().encode(text).byteLength > 64 * 1024) {
    throw new Error(
      "クリップボード履歴は64KB以下の文章またはURLに対応しています。",
    );
  }
  const state = read();
  const existingGroup = state.groups.find((group) =>
    group.items.some(
      (item) => item.textContent === text && item.availability === "ready",
    ),
  );
  if (existingGroup) {
    const next =
      existingGroup.items[0]?.source === "clipboardHistory"
        ? {
            groups: [
              { ...existingGroup, createdAt: new Date().toISOString() },
              ...state.groups.filter((group) => group.id !== existingGroup.id),
            ],
          }
        : state;
    write(next);
    return {
      state: next,
      addedCount: 0,
      skippedCount:
        existingGroup.items[0]?.source === "clipboardHistory" ? 0 : 1,
    };
  }

  let historyUrl: URL | null = null;
  try {
    const parsed = new URL(text);
    if (["http:", "https:"].includes(parsed.protocol)) historyUrl = parsed;
  } catch {
    historyUrl = null;
  }
  const item = {
    kind: (historyUrl ? "url" : "text") as FileShelfItemKind,
    displayName: historyUrl?.host || text.replace(/\s+/g, " ").slice(0, 42),
    sourcePath: null,
    textContent: text,
    mimeType: historyUrl ? "text/uri-list" : "text/plain",
    sizeBytes: null,
    source: "clipboardHistory" as const,
  };
  const withNewGroup = [createGroup([item]), ...state.groups];
  const limit = Math.min(100, Math.max(5, maxItems));
  let historyItems = 0;
  const groups = withNewGroup.filter((group) => {
    if (group.items[0]?.source !== "clipboardHistory") return true;
    historyItems += 1;
    return historyItems <= limit;
  });
  const next = { groups };
  write(next);
  return { state: next, addedCount: 1, skippedCount: 0 };
};

export const mockClearFileShelfClipboardHistory = () => {
  const ids = read().groups.flatMap((group) =>
    group.items
      .filter((item) => item.source === "clipboardHistory")
      .filter((item) => !item.pinned)
      .map((item) => item.id),
  );
  if (!ids.length) {
    throw new Error("消去できるクリップボード履歴がありません。");
  }
  return mockRemoveFileShelfItems(ids);
};
