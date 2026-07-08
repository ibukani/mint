import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import "@testing-library/jest-dom";

// テスト環境でTauriのウィンドウ管理をモック
mockWindows("main", "clock");

import { createMockSettings } from "./mockSettings";

// テスト用のデフォルト設定データ
const defaultSettings = createMockSettings();

// テスト中のIPC呼び出しの共通モック定義
mockIPC(async (cmd, args) => {
  switch (cmd) {
    case "load_settings":
      return defaultSettings;
    case "save_settings":
      console.log("[Vitest Mock] save_settings called with:", args);
      return;
    case "load_api_key":
      return "mock-api-key";
    case "save_api_key":
      return;
    default:
      return null;
  }
});
