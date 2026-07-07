import React, { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";

export const VoiceToTextSettings: React.FC = () => {
  const { featureSettings: voiceToText, handleChange } = useFeatureSettings("voiceToText");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);

  // Load API key from OS keychain
  useEffect(() => {
    async function loadKey() {
      try {
        const key = await invoke<string>("load_api_key", { service: "voice_to_text" });
        setApiKey(key);
      } catch (err) {
        console.error("Failed to load API key:", err);
      } finally {
        setApiKeyLoaded(true);
      }
    }
    loadKey();
  }, []);

  // Save API key to OS keychain (debounced by blur event)
  const saveApiKey = useCallback(async () => {
    try {
      await invoke("save_api_key", { service: "voice_to_text", key: apiKey });
    } catch (err) {
      console.error("Failed to save API key:", err);
    }
  }, [apiKey]);

  if (!voiceToText) return null;

  return (
    <div className="settings-section">
      <h2 className="section-title">音声入力 (Voice to Text) 設定</h2>
      <p className="section-description">
        ショートカットキーを押して音声を録音し、自動で文字起こししてクリップボードにコピーする機能の設定です。
      </p>

      <div className="form-group">
        <label className="form-label">起動/録音ショートカットキー</label>
        <input
          type="text"
          className="form-control"
          value={voiceToText.shortcut}
          onChange={(e) => handleChange("shortcut", e.target.value)}
          placeholder="例: Ctrl+Alt+V"
        />
        <span className="form-help">
          録音の開始と終了をトグルするグローバルショートカットキーを指定します。
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">API エンドポイント (Base URL)</label>
        <input
          type="text"
          className="form-control"
          value={voiceToText.baseUrl}
          onChange={(e) => handleChange("baseUrl", e.target.value)}
          placeholder="例: https://api.openai.com/v1"
        />
        <span className="form-help">
          OpenAI互換の音声認識APIエンドポイント。OpenAIの場合は <code>https://api.openai.com/v1</code>、Groqの場合は <code>https://api.groq.com/openai/v1</code> 等を指定します。
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">API キー</label>
        <input
          type="password"
          className="form-control"
          value={apiKeyLoaded ? apiKey : ""}
          onChange={(e) => setApiKey(e.target.value)}
          onBlur={saveApiKey}
          placeholder={apiKeyLoaded ? "APIキーを入力" : "読み込み中..."}
          disabled={!apiKeyLoaded}
        />
        <span className="form-help">
          音声認識APIの認証キーです。キーはOSのセキュアストレージ（Windows 資格情報マネージャー）に安全に保存されます。
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">モデル名</label>
        <input
          type="text"
          className="form-control"
          value={voiceToText.model}
          onChange={(e) => handleChange("model", e.target.value)}
          placeholder="例: whisper-1"
        />
        <span className="form-help">
          APIで使用する音声認識モデル名。OpenAIの場合は <code>whisper-1</code>、Groqの場合は <code>whisper-large-v3</code> などを入力します。
        </span>
      </div>

      <div className="form-group">
        <label className="form-label">言語コード (Language)</label>
        <input
          type="text"
          className="form-control"
          value={voiceToText.language}
          onChange={(e) => handleChange("language", e.target.value)}
          placeholder="例: ja"
        />
        <span className="form-help">
          音声認識時の入力言語（ISO 639-1コード）。日本語の場合は <code>ja</code>、英語の場合は <code>en</code> を指定します。
        </span>
      </div>
    </div>
  );
};
