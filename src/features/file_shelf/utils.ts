import type { FileShelfItem, FileShelfItemKind } from "./types";

export const kindLabel: Record<FileShelfItemKind, string> = {
  file: "ファイル",
  folder: "フォルダ",
  image: "画像",
  text: "文章",
  url: "URL",
};

export const formatBytes = (value: number | null) => {
  if (value === null) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export const isSupportedUrl = (value: string) => {
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(
      new URL(value).protocol,
    );
  } catch {
    return false;
  }
};

export const supportedImageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export const fileShelfSearchText = (item: FileShelfItem) =>
  [
    item.displayName,
    item.sourcePath,
    item.textContent,
    kindLabel[item.kind],
    item.source === "clipboardHistory" ? "履歴" : "手動",
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ja");

export const matchesQuery = (item: FileShelfItem, query: string) =>
  fileShelfSearchText(item).includes(query);
