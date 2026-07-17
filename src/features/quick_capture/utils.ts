import type { QuickCaptureNote } from "./types";

export interface MarkdownTextEdit {
  content: string;
  selectionStart: number;
  selectionEnd: number;
}

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

const lineBounds = (content: string, position: number) => {
  const start = content.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
  const endIndex = content.indexOf("\n", position);
  return { start, end: endIndex === -1 ? content.length : endIndex };
};

export const continueMarkdownList = (
  content: string,
  selectionStart: number,
  selectionEnd: number,
): MarkdownTextEdit | null => {
  if (selectionStart !== selectionEnd) return null;
  const { start, end } = lineBounds(content, selectionStart);
  if (selectionStart !== end) return null;

  const line = content.slice(start, end);
  const unordered = line.match(/^(\s*)([-*+])\s+(?:\[([ xX])\]\s+)?(.*)$/);
  const ordered = line.match(/^(\s*)(\d+)\.\s+(.*)$/);
  const quote = line.match(/^(\s*>\s+)(.*)$/);
  const match = unordered ?? ordered ?? quote;
  if (!match) return null;

  const body = unordered ? unordered[4] : ordered ? ordered[3] : quote?.[2];
  if (!body?.trim()) {
    return {
      content: `${content.slice(0, start)}${content.slice(end)}`,
      selectionStart: start,
      selectionEnd: start,
    };
  }

  let continuation = "";
  if (unordered) {
    const checkbox = unordered[3] ? "[ ] " : "";
    continuation = `${unordered[1]}${unordered[2]} ${checkbox}`;
  } else if (ordered) {
    continuation = `${ordered[1]}${Number(ordered[2]) + 1}. `;
  } else if (quote) {
    continuation = quote[1];
  }

  const inserted = `\n${continuation}`;
  const nextContent = `${content.slice(0, end)}${inserted}${content.slice(end)}`;
  const nextCursor = end + inserted.length;
  return {
    content: nextContent,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
  };
};

export const indentMarkdownSelection = (
  content: string,
  selectionStart: number,
  selectionEnd: number,
  outdent = false,
): MarkdownTextEdit => {
  const firstLineStart =
    content.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  const selectionIncludesNextLine =
    selectionEnd > selectionStart && content[selectionEnd - 1] === "\n";
  const lastLineEnd = selectionIncludesNextLine
    ? selectionEnd - 1
    : (() => {
        const lineEnd = content.indexOf("\n", selectionEnd);
        return lineEnd === -1 ? content.length : lineEnd;
      })();
  const selectedLines = content.slice(firstLineStart, lastLineEnd);
  const lines = selectedLines.split("\n");
  const editedLines = lines.map((line) => {
    if (!outdent) return `  ${line}`;
    if (line.startsWith("\t")) return line.slice(1);
    return line.replace(/^ {1,2}/, "");
  });
  const replacement = editedLines.join("\n");
  const nextContent = `${content.slice(0, firstLineStart)}${replacement}${content.slice(lastLineEnd)}`;
  const lengthDelta = replacement.length - selectedLines.length;
  const nextStart = selectionStart + (outdent ? Math.max(-2, lengthDelta) : 2);
  const nextEnd = selectionEnd + lengthDelta;
  return {
    content: nextContent,
    selectionStart: Math.max(firstLineStart, nextStart),
    selectionEnd: Math.max(firstLineStart, nextEnd),
  };
};
