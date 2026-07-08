import { invoke } from "@tauri-apps/api/core";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import type { TranscriptionResult } from "../types";

export const VoiceToTextSettings: React.FC = () => {
  const {
    featureSettings: voiceToText,
    handleChange,
    shortcutError,
  } = useFeatureSettings("voiceToText");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [audioFilePath, setAudioFilePath] = useState("");
  const [transcriptionText, setTranscriptionText] = useState("");
  const [transcriptionError, setTranscriptionError] = useState("");
  const [transcribing, setTranscribing] = useState(false);

  // Load API key from OS keychain
  useEffect(() => {
    async function loadKey() {
      try {
        const key = await invoke<string>("load_api_key", {
          service: "voice_to_text",
        });
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

  const transcribeAudioFile = async () => {
    setTranscribing(true);
    setTranscriptionText("");
    setTranscriptionError("");

    try {
      const result = await invoke<TranscriptionResult>(
        "transcribe_audio_file",
        {
          settings: voiceToText,
          audio_file_path: audioFilePath,
        },
      );
      setTranscriptionText(result.text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTranscriptionError(message);
    } finally {
      setTranscribing(false);
    }
  };

  return (
    <div className="settings-section">
      <h2 className="section-title">音声入力 (Voice to Text) 設定</h2>
      <p className="section-description">
        OpenAI互換の音声認識APIを使って音声ファイルを文字起こしします。
      </p>

      <div
        className="form-group"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <input
          id="v2t-enabled-checkbox"
          type="checkbox"
          checked={voiceToText.enabled}
          onChange={(e) => handleChange("enabled", e.target.checked)}
          style={{ width: "20px", height: "20px", cursor: "pointer" }}
        />
        <label
          htmlFor="v2t-enabled-checkbox"
          style={{ fontWeight: "bold", cursor: "pointer" }}
        >
          この機能を有効にする (Enable Feature)
        </label>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="v2t-shortcut-input">
          起動/録音ショートカットキー
        </label>
        <input
          id="v2t-shortcut-input"
          type="text"
          className={`form-control ${shortcutError ? "is-invalid" : ""}`}
          value={voiceToText.shortcut}
          onChange={(e) => handleChange("shortcut", e.target.value)}
          placeholder="例: Ctrl+Alt+V"
        />
        {shortcutError && (
          <p
            className="error-message"
            style={{
              color: "var(--color-error, #ff4d4f)",
              marginTop: "4px",
              fontSize: "0.85rem",
              fontWeight: "bold",
            }}
          >
            {shortcutError}
          </p>
        )}
        <span className="form-help">
          音声入力ワークフローを起動するグローバルショートカットキーを指定します。
        </span>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="v2t-base-url-input">
          API エンドポイント (Base URL)
        </label>
        <input
          id="v2t-base-url-input"
          type="text"
          className="form-control"
          value={voiceToText.baseUrl}
          onChange={(e) => handleChange("baseUrl", e.target.value)}
          placeholder="例: https://api.openai.com/v1"
        />
        <span className="form-help">
          OpenAI互換の音声認識APIエンドポイント。OpenAIの場合は{" "}
          <code>https://api.openai.com/v1</code>、Groqの場合は{" "}
          <code>https://api.groq.com/openai/v1</code> 等を指定します。
        </span>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="v2t-api-key-input">
          API キー
        </label>
        <input
          id="v2t-api-key-input"
          type="password"
          className="form-control"
          value={apiKeyLoaded ? apiKey : ""}
          onChange={(e) => setApiKey(e.target.value)}
          onBlur={saveApiKey}
          placeholder={apiKeyLoaded ? "APIキーを入力" : "読み込み中..."}
          disabled={!apiKeyLoaded}
        />
        <span className="form-help">
          音声認識APIの認証キーです。キーはOSのセキュアストレージ（Windows
          資格情報マネージャー）に安全に保存されます。
        </span>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="v2t-model-input">
          モデル名
        </label>
        <input
          id="v2t-model-input"
          type="text"
          className="form-control"
          value={voiceToText.model}
          onChange={(e) => handleChange("model", e.target.value)}
          placeholder="例: whisper-1"
        />
        <span className="form-help">
          APIで使用する音声認識モデル名。OpenAIの場合は <code>whisper-1</code>
          、Groqの場合は <code>whisper-large-v3</code> などを入力します。
        </span>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="v2t-language-input">
          言語コード (Language)
        </label>
        <input
          id="v2t-language-input"
          type="text"
          className="form-control"
          value={voiceToText.language}
          onChange={(e) => handleChange("language", e.target.value)}
          placeholder="例: ja"
        />
        <span className="form-help">
          音声認識時の入力言語（ISO 639-1コード）。日本語の場合は{" "}
          <code>ja</code>、英語の場合は <code>en</code> を指定します。
        </span>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="v2t-audio-file-input">
          音声ファイルパス
        </label>
        <input
          id="v2t-audio-file-input"
          type="text"
          className="form-control"
          value={audioFilePath}
          onChange={(e) => setAudioFilePath(e.target.value)}
          placeholder="例: /Users/me/audio.wav"
        />
        <span className="form-help">
          wav、mp3、m4a
          など、利用する音声認識APIが対応する音声ファイルを指定します。
        </span>
      </div>

      <div className="form-group">
        <button
          type="button"
          className="primary-button"
          onClick={transcribeAudioFile}
          disabled={
            transcribing ||
            !voiceToText.enabled ||
            !apiKeyLoaded ||
            !audioFilePath.trim()
          }
        >
          {transcribing ? "文字起こし中..." : "文字起こしを実行"}
        </button>
        {!voiceToText.enabled && (
          <span className="form-help">
            実行するには、この機能を有効にしてください。
          </span>
        )}
      </div>

      {transcriptionError && (
        <p className="error-message" role="alert">
          {transcriptionError}
        </p>
      )}

      {transcriptionText && (
        <div className="form-group">
          <label className="form-label" htmlFor="v2t-transcription-result">
            文字起こし結果
          </label>
          <textarea
            id="v2t-transcription-result"
            className="form-control"
            value={transcriptionText}
            readOnly
            rows={6}
          />
        </div>
      )}
    </div>
  );
};
