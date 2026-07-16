import type { QuickCaptureNote } from "./types";

export const noteTitle = (note: Pick<QuickCaptureNote, "content">) =>
  note.content
    .split("\n")
    .find((line) => line.trim())
    ?.trim() || "無題のメモ";

export const formatUpdatedAt = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export const parseTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

export const safeFileName = (value: string) =>
  `${value.replace(/[\\/:*?"<>|]+/g, "-").trim() || "quick-capture"}.md`;
