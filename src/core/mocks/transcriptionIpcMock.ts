import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

interface TranscriptionSettings {
  enabled?: boolean;
  baseUrl?: string;
  model?: string;
}

export interface TranscriptionIpcMockOptions {
  waitForOperation?: (duration: number) => Promise<void>;
}

export async function handleTranscriptionIpcCommand(
  command: string,
  args: MockIPCArgs,
  options: TranscriptionIpcMockOptions = {},
): Promise<MockIPCResult> {
  const settings = args?.settings as TranscriptionSettings | undefined;
  switch (command) {
    case "transcribe_audio_file": {
      const audioFilePath = args?.audio_file_path as string | undefined;
      if (!settings?.enabled) {
        throw new Error("音声入力を有効にしてください。");
      }
      if (!audioFilePath?.trim()) {
        throw new Error("音声ファイルを選択してください。");
      }
      if (!settings.baseUrl?.trim() || !settings.model?.trim()) {
        throw new Error("API接続設定を確認してください。");
      }
      if (audioFilePath === "/missing/audio.wav") {
        throw new Error(
          "音声ファイルが見つかりません。移動または削除されていないか確認してください。",
        );
      }
      await options.waitForOperation?.(350);
      return handled({
        text: `[MOCK] ${audioFilePath} を ${settings.model || "default"} で文字起こししました。`,
      });
    }
    case "transcribe_audio_recording": {
      const audioData = args?.audio_data as number[] | undefined;
      const fileName = args?.file_name as string | undefined;
      if (!settings?.enabled) {
        throw new Error("音声入力を有効にしてください。");
      }
      if (!audioData?.length || !fileName?.trim()) {
        throw new Error("録音データがありません。もう一度録音してください。");
      }
      if (!settings.baseUrl?.trim() || !settings.model?.trim()) {
        throw new Error("API接続設定を確認してください。");
      }
      await options.waitForOperation?.(350);
      return handled({
        text: `[MOCK] マイク録音（${fileName}）を ${settings.model || "default"} で文字起こししました。`,
      });
    }
    default:
      return unhandled();
  }
}
