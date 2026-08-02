import { ActionValidationError } from "../errors";
import type { CrossFeatureAction } from "../types";

export interface TranscribeShelfAudioInput {
  itemId: string;
}

/**
 * Opens the Voice to Text workbench with an audio file from the file shelf
 * already set as the transcription source.
 */
export const transcribeShelfAudioAction: CrossFeatureAction<
  TranscribeShelfAudioInput,
  { path: string }
> = {
  id: "file-shelf:transcribe-audio",
  title: "文字起こし",
  description:
    "ファイルシェルの音声ファイルを音声入力へセットして文字起こしします。",
  sourceFeature: "file_shelf",
  destinationFeature: "v2t",
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
    if (!context.settings?.voiceToText.enabled) {
      return {
        available: false,
        reason: "音声入力が無効になっています。",
        disabledSettingsTarget: {
          tabId: "voiceToText",
          targetId: "v2t-enabled-checkbox",
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
    if (item.kind !== "file") {
      return {
        status: "validationError",
        message: "音声ファイルの項目ではありません。",
      };
    }
    const path = item.sourcePath;
    if (!path) {
      return {
        status: "validationError",
        message: "音声ファイルのパスがありません。",
      };
    }
    if (!context.ports.voiceToText.isSupportedAudioPath(path)) {
      return {
        status: "validationError",
        message:
          "対応していない音声形式です。WAV・MP3・M4A・AAC・FLAC・OGG・WebMに対応しています。",
      };
    }
    await context.ports.voiceToText.openWithAudioFile(path);
    return { status: "success", data: { path } };
  },
};
