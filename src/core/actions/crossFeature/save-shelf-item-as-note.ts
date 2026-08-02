import { ActionValidationError } from "../errors";
import type { CrossFeatureAction } from "../types";

export interface SaveShelfItemAsNoteInput {
  itemId: string;
}

const MAX_NOTE_CONTENT_LENGTH = 100_000;
const URL_SCHEME_PATTERN = /^https?:\/\//i;

/**
 * Copies the text content or URL of a file-shelf item into a brand-new
 * quick-capture note. The source item is never modified or removed.
 */
export const saveShelfItemAsNoteAction: CrossFeatureAction<
  SaveShelfItemAsNoteInput,
  { noteId: string }
> = {
  id: "file-shelf:save-as-note",
  title: "メモとして保存",
  description:
    "ファイルシェルのテキストまたはURLを新しいメモとして保存します。",
  sourceFeature: "file_shelf",
  destinationFeature: "quick_capture",
  inputSchema: {
    parse(input) {
      if (typeof input !== "object" || input === null) {
        throw new ActionValidationError("入力が正しくありません。");
      }
      const itemId = (input as { itemId?: unknown }).itemId;
      if (typeof itemId !== "string" || !itemId.trim()) {
        throw new ActionValidationError("項目IDが必要です。");
      }
      return { itemId: itemId.trim() };
    },
  },
  availability(context) {
    if (!context.settings?.quickCapture.enabled) {
      return {
        available: false,
        reason: "クイックキャプチャーが無効になっています。",
        disabledSettingsTarget: {
          tabId: "quickCapture",
          targetId: "quick-capture-enabled",
        },
      };
    }
    return { available: true };
  },
  async execute(input, context) {
    const item = await context.ports.fileShelf.getItem(input.itemId);
    if (!item) {
      return {
        status: "failed",
        message: "ファイルシェルの項目が見つかりません。",
      };
    }

    let content: string;
    if (item.kind === "text") {
      content = item.textContent ?? "";
    } else if (item.kind === "url") {
      content = item.textContent ?? "";
      if (!URL_SCHEME_PATTERN.test(content.trim())) {
        return {
          status: "validationError",
          message: "URLの形式が正しくありません。",
        };
      }
    } else {
      return {
        status: "validationError",
        message: "テキストまたはURLの項目だけをメモとして保存できます。",
      };
    }

    content = content.trim();
    if (!content) {
      return {
        status: "validationError",
        message: "保存する内容がありません。",
      };
    }
    if (content.length > MAX_NOTE_CONTENT_LENGTH) {
      return {
        status: "validationError",
        message: "内容が長すぎるためメモとして保存できません。",
      };
    }

    const note = await context.ports.quickCapture.createNote({
      content,
      tags: [],
      pinned: false,
    });
    return { status: "success", data: { noteId: note.id } };
  },
};
