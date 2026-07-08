import { invoke } from "@tauri-apps/api/core";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  Button,
  ErrorMessage,
  Field,
  SettingsSection,
  TextArea,
  TextInput,
} from "../../../design/components";
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
    <SettingsSection
      title="音声入力 (Voice to Text) 設定"
      description="OpenAI互換の音声認識APIを使って音声ファイルを文字起こしします。"
    >
      <Field
        id="v2t-enabled-checkbox"
        label="この機能を有効にする (Enable Feature)"
        orientation="inline"
      >
        <TextInput
          id="v2t-enabled-checkbox"
          type="checkbox"
          checked={voiceToText.enabled}
          onChange={(e) => handleChange("enabled", e.target.checked)}
        />
      </Field>

      <Field
        id="v2t-shortcut-input"
        label="起動/録音ショートカットキー"
        error={shortcutError}
        helpText="音声入力ワークフローを起動するグローバルショートカットキーを指定します。"
      >
        <TextInput
          id="v2t-shortcut-input"
          type="text"
          invalid={Boolean(shortcutError)}
          value={voiceToText.shortcut}
          onChange={(e) => handleChange("shortcut", e.target.value)}
          placeholder="例: Ctrl+Alt+V"
        />
      </Field>

      <Field
        id="v2t-base-url-input"
        label="API エンドポイント (Base URL)"
        helpText={
          <>
            OpenAI互換の音声認識APIエンドポイント。OpenAIの場合は{" "}
            <code>https://api.openai.com/v1</code>、Groqの場合は{" "}
            <code>https://api.groq.com/openai/v1</code> 等を指定します。
          </>
        }
      >
        <TextInput
          id="v2t-base-url-input"
          type="text"
          value={voiceToText.baseUrl}
          onChange={(e) => handleChange("baseUrl", e.target.value)}
          placeholder="例: https://api.openai.com/v1"
        />
      </Field>

      <Field
        id="v2t-api-key-input"
        label="API キー"
        helpText="音声認識APIの認証キーです。キーはOSのセキュアストレージ（Windows 資格情報マネージャー）に安全に保存されます。"
      >
        <TextInput
          id="v2t-api-key-input"
          type="password"
          value={apiKeyLoaded ? apiKey : ""}
          onChange={(e) => setApiKey(e.target.value)}
          onBlur={saveApiKey}
          placeholder={apiKeyLoaded ? "APIキーを入力" : "読み込み中..."}
          disabled={!apiKeyLoaded}
        />
      </Field>

      <Field
        id="v2t-model-input"
        label="モデル名"
        helpText={
          <>
            APIで使用する音声認識モデル名。OpenAIの場合は <code>whisper-1</code>{" "}
            、Groqの場合は <code>whisper-large-v3</code> などを入力します。
          </>
        }
      >
        <TextInput
          id="v2t-model-input"
          type="text"
          value={voiceToText.model}
          onChange={(e) => handleChange("model", e.target.value)}
          placeholder="例: whisper-1"
        />
      </Field>

      <Field
        id="v2t-language-input"
        label="言語コード (Language)"
        helpText={
          <>
            音声認識時の入力言語（ISO 639-1コード）。日本語の場合は{" "}
            <code>ja</code>、英語の場合は <code>en</code> を指定します。
          </>
        }
      >
        <TextInput
          id="v2t-language-input"
          type="text"
          value={voiceToText.language}
          onChange={(e) => handleChange("language", e.target.value)}
          placeholder="例: ja"
        />
      </Field>

      <Field
        id="v2t-audio-file-input"
        label="音声ファイルパス"
        helpText="wav、mp3、m4a など、利用する音声認識APIが対応する音声ファイルを指定します。"
      >
        <TextInput
          id="v2t-audio-file-input"
          type="text"
          value={audioFilePath}
          onChange={(e) => setAudioFilePath(e.target.value)}
          placeholder="例: /Users/me/audio.wav"
        />
      </Field>

      <Field
        helpText={
          !voiceToText.enabled
            ? "実行するには、この機能を有効にしてください。"
            : undefined
        }
      >
        <Button
          onClick={transcribeAudioFile}
          disabled={
            transcribing ||
            !voiceToText.enabled ||
            !apiKeyLoaded ||
            !audioFilePath.trim()
          }
        >
          {transcribing ? "文字起こし中..." : "文字起こしを実行"}
        </Button>
      </Field>

      {transcriptionError && <ErrorMessage>{transcriptionError}</ErrorMessage>}

      {transcriptionText && (
        <Field id="v2t-transcription-result" label="文字起こし結果">
          <TextArea
            id="v2t-transcription-result"
            value={transcriptionText}
            readOnly
            rows={6}
          />
        </Field>
      )}
    </SettingsSection>
  );
};
