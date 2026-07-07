import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "@testing-library/jest-dom";

// テスト環境でTauriのウィンドウ管理をモック
mockWindows("main", "clock");

// テスト用のデフォルト設定データ
const defaultSettings = {
  theme: "dark",
  clock: {
    shortcut: "Ctrl+Alt+C",
    autoHideSeconds: 3,
    fontSize: "1.5rem",
  },
  voiceToText: {
    shortcut: "Ctrl+Alt+V",
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    language: "ja",
  },
};

// テスト中のIPC呼び出しの共通モック定義
mockIPC(async (cmd, args) => {
  switch (cmd) {
    case "load_settings":
      return defaultSettings;
    case "save_settings":
      console.log("[Vitest Mock] save_settings called with:", args);
      return;
    default:
      return null;
  }
});
