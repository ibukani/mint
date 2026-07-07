import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

// Tauri環境内かどうかを判定（window.__TAURI_INTERNALS__ が存在しない場合はブラウザ環境とみなす）
const isTauri = typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;

if (!isTauri && typeof window !== "undefined") {
  console.log("[Tauri Mock] 非Tauri環境（ブラウザ）を検出しました。Tauri APIのモックを初期化します。");

  // クエリパラメータからウィンドウラベルを取得（例: ?label=clock）、指定がなければ "main"
  const params = new URLSearchParams(window.location.search);
  const currentLabel = params.get("label") || "main";

  // 利用するウィンドウラベルをモック登録
  mockWindows(currentLabel, "main", "clock");

  // ローカルストレージキー
  const STORAGE_KEY = "mint_mock_settings";

  // Rust側のデフォルト実装と合わせた設定値の初期データ
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

  // IPC（Rust側のコマンド呼び出し）をモック化
  mockIPC(async (cmd, args) => {
    switch (cmd) {
      case "load_settings": {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            console.log("[Tauri Mock] load_settings: localStorageから読み込みました。", parsed);
            return parsed;
          } catch (e) {
            console.error("[Tauri Mock] load_settings: 設定データのパースに失敗しました。デフォルトを返します。", e);
          }
        }
        console.log("[Tauri Mock] load_settings: 設定未保存のため、初期設定を返します。", defaultSettings);
        return defaultSettings;
      }
      case "save_settings": {
        const settings = (args as any)?.settings;
        if (settings) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
          console.log("[Tauri Mock] save_settings: localStorageに保存しました。", settings);
        }
        return;
      }
      default:
        console.warn(`[Tauri Mock] 未定義のIPCコマンド呼び出しを受信しました: ${cmd}`, args);
        return null;
    }
  });
}
