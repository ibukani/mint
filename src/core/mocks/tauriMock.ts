import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { createMockSettings } from "./mockSettings";

// Tauri環境内かどうかを判定（window.__TAURI_INTERNALS__ が存在しない場合はブラウザ環境とみなす）
const isTauri =
  typeof window !== "undefined" &&
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !==
    undefined;

declare const process: { env?: { NODE_ENV?: string } } | undefined;
const isTest =
  typeof process !== "undefined" && process?.env?.NODE_ENV === "test";

if (!isTauri && typeof window !== "undefined" && !isTest) {
  console.log(
    "[Tauri Mock] 非Tauri環境（ブラウザ）を検出しました。Tauri APIのモックを初期化します。",
  );

  // クエリパラメータからウィンドウラベルを取得（例: ?label=clock）、指定がなければ "main"
  const params = new URLSearchParams(window.location.search);
  const currentLabel = params.get("label") || "main";

  // 利用するウィンドウラベルをモック登録
  mockWindows(currentLabel, "main", "clock");

  // ローカルストレージキー
  const STORAGE_KEY = "mint_mock_settings";

  // Rust側のデフォルト実装と合わせた設定値の初期データ
  const defaultSettings = createMockSettings();

  // IPC（Rust側のコマンド呼び出し）をモック化
  mockIPC(async (cmd, args) => {
    const typedArgs = args as Record<string, unknown> | undefined;
    switch (cmd) {
      case "load_settings": {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            console.log(
              "[Tauri Mock] load_settings: localStorageから読み込みました。",
              parsed,
            );
            return parsed;
          } catch (e) {
            console.error(
              "[Tauri Mock] load_settings: 設定データのパースに失敗しました。デフォルトを返します。",
              e,
            );
          }
        }
        console.log(
          "[Tauri Mock] load_settings: 設定未保存のため、初期設定を返します。",
          defaultSettings,
        );
        return defaultSettings;
      }
      case "save_settings": {
        const settings = typedArgs?.settings;
        if (settings) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
          console.log(
            "[Tauri Mock] save_settings: localStorageに保存しました。",
            settings,
          );
        }
        return;
      }
      case "load_api_key": {
        const service = typedArgs?.service as string | undefined;
        const key =
          (service ? localStorage.getItem(`mock_api_key_${service}`) : "") ||
          "";
        console.log(
          `[Tauri Mock] load_api_key for ${service}:`,
          key ? "***" : "(empty)",
        );
        return key;
      }
      case "save_api_key": {
        const service = typedArgs?.service as string | undefined;
        const key = typedArgs?.key as string | undefined;
        if (service !== undefined && key !== undefined) {
          localStorage.setItem(`mock_api_key_${service}`, key);
          console.log(`[Tauri Mock] save_api_key for ${service} completed.`);
        }
        return;
      }
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
        console.warn(
          `[Tauri Mock] 未定義のIPCコマンド呼び出しを受信しました: ${cmd}`,
          args,
        );
        return null;
    }
  });
}
