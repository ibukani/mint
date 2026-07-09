import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "@testing-library/jest-dom";

// テスト環境でTauriのウィンドウ管理をモック
mockWindows("main", "clock");

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
    default:
      return null;
  }
});
