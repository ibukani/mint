import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { DownloadEvent } from "@tauri-apps/plugin-updater";
import "@testing-library/jest-dom";

// テスト環境でTauriのウィンドウ管理をモック
mockWindows("main", "clock", "calendar");

import { createMockSettings } from "./mockSettings";

// テスト用のデフォルト設定データ
const defaultSettings = createMockSettings();

// テスト中のIPC呼び出しの共通モック定義
mockIPC(async (cmd, args) => {
  const typedArgs = args as Record<string, unknown> | undefined;

  switch (cmd) {
    case "load_settings":
      return defaultSettings;
    case "save_settings":
      return;
    case "load_api_key":
      return "mock-api-key";
    case "save_api_key":
      return;
    case "transcribe_audio_file": {
      const audioFilePath = typedArgs?.audio_file_path as string | undefined;
      const settings = typedArgs?.settings as
        | { enabled?: boolean; model?: string }
        | undefined;
      if (!settings?.enabled) {
        throw new Error("Voice to Text is disabled.");
      }
      if (!audioFilePath?.trim()) {
        throw new Error("Audio file path is required.");
      }
      return {
        text: `[MOCK] ${audioFilePath} を ${settings.model || "default"} で文字起こししました。`,
      };
    }
    case "plugin:updater|check":
      return null;
    case "plugin:updater|download_and_install": {
      const channel = typedArgs?.onEvent as
        | { onmessage?: (event: DownloadEvent) => void }
        | undefined;
      channel?.onmessage?.({
        event: "Started",
        data: { contentLength: 100 },
      });
      channel?.onmessage?.({ event: "Progress", data: { chunkLength: 100 } });
      channel?.onmessage?.({ event: "Finished" });
      return;
    }
    case "plugin:process|restart":
    case "plugin:resources|close":
      return;
    default:
      return null;
  }
});
