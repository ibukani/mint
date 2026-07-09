import { invoke } from "@tauri-apps/api/core";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  Button,
  ErrorMessage,
  Field,
  FieldRow,
  SettingsSection,
  ShortcutInput,
  Switch,
  TextArea,
  TextInput,
} from "../../../design/components";
import {
  normalizeBaseUrl,
  normalizeLanguageCode,
  normalizeModelName,
} from "../settings";
import type { TranscriptionResult } from "../types";

const PASTE_STATUS_VISIBLE_MS = 2000;
const COPY_ERROR_VISIBLE_MS = 5000;
const EMPTY_PASTE_STATUS = "貼り付ける内容がありません";

const getStatusLabelClass = (status: string) => {
  const isError =
    status.includes("失敗") ||
    status.includes("ありません") ||
    status.includes("エラー");
  return `status-toast-label ${isError ? "status-toast-label--error" : ""}`;
};

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
  const [copyStatus, setCopyStatus] = useState("");
  const [apiKeyPasteStatus, setApiKeyPasteStatus] = useState("");
  const [audioFilePasteStatus, setAudioFilePasteStatus] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const copyStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiKeyPasteStatusTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const audioFilePasteStatusTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

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

  const pasteApiKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const value = text.trim();
      if (!value) {
        setApiKeyPasteStatus(EMPTY_PASTE_STATUS);
        setAudioFilePasteStatus("");
        return;
      }
      setApiKey(value);
      setApiKeyPasteStatus("API キーを貼り付けました");
      setAudioFilePasteStatus("");
    } catch (err) {
      console.error("Failed to paste API key:", err);
    } finally {
      const apiKeyInput = document.getElementById(
        "v2t-api-key-input",
      ) as HTMLInputElement | null;
      apiKeyInput?.focus();
      apiKeyInput?.select();
    }
  };

  useEffect(() => {
    if (!transcriptionText) return;

    const resultField = document.getElementById("v2t-transcription-result");
    if (resultField instanceof HTMLTextAreaElement) {
      resultField.focus();
      resultField.select();
    }
  }, [transcriptionText]);

  useEffect(() => {
    if (!showApiKey || !apiKeyLoaded) return;

    const apiKeyInput = document.getElementById(
      "v2t-api-key-input",
    ) as HTMLInputElement | null;
    apiKeyInput?.focus();
    apiKeyInput?.select();
  }, [apiKeyLoaded, showApiKey]);

  useEffect(() => {
    if (apiKeyPasteStatus !== "API キーを貼り付けました") return;

    const apiKeyInput = document.getElementById(
      "v2t-api-key-input",
    ) as HTMLInputElement | null;
    apiKeyInput?.focus();
    apiKeyInput?.select();
  }, [apiKeyPasteStatus]);

  useEffect(() => {
    if (audioFilePasteStatus !== "音声ファイルパスを貼り付けました") return;

    const audioFileInput = document.getElementById(
      "v2t-audio-file-input",
    ) as HTMLInputElement | null;
    audioFileInput?.focus();
    audioFileInput?.select();
  }, [audioFilePasteStatus]);

  useEffect(() => {
    if (apiKeyPasteStatusTimerRef.current) {
      clearTimeout(apiKeyPasteStatusTimerRef.current);
      apiKeyPasteStatusTimerRef.current = null;
    }

    if (!apiKeyPasteStatus) return undefined;

    apiKeyPasteStatusTimerRef.current = setTimeout(() => {
      setApiKeyPasteStatus("");
      apiKeyPasteStatusTimerRef.current = null;
    }, PASTE_STATUS_VISIBLE_MS);

    return () => {
      if (apiKeyPasteStatusTimerRef.current) {
        clearTimeout(apiKeyPasteStatusTimerRef.current);
        apiKeyPasteStatusTimerRef.current = null;
      }
    };
  }, [apiKeyPasteStatus]);

  useEffect(() => {
    if (audioFilePasteStatusTimerRef.current) {
      clearTimeout(audioFilePasteStatusTimerRef.current);
      audioFilePasteStatusTimerRef.current = null;
    }

    if (!audioFilePasteStatus) return undefined;

    audioFilePasteStatusTimerRef.current = setTimeout(() => {
      setAudioFilePasteStatus("");
      audioFilePasteStatusTimerRef.current = null;
    }, PASTE_STATUS_VISIBLE_MS);

    return () => {
      if (audioFilePasteStatusTimerRef.current) {
        clearTimeout(audioFilePasteStatusTimerRef.current);
        audioFilePasteStatusTimerRef.current = null;
      }
    };
  }, [audioFilePasteStatus]);

  useEffect(() => {
    if (copyStatusTimerRef.current) {
      clearTimeout(copyStatusTimerRef.current);
      copyStatusTimerRef.current = null;
    }

    if (!copyStatus) return undefined;

    const visibleMs =
      copyStatus === "コピーしました"
        ? PASTE_STATUS_VISIBLE_MS
        : COPY_ERROR_VISIBLE_MS;

    copyStatusTimerRef.current = setTimeout(() => {
      setCopyStatus("");
      copyStatusTimerRef.current = null;
    }, visibleMs);

    return () => {
      if (copyStatusTimerRef.current) {
        clearTimeout(copyStatusTimerRef.current);
        copyStatusTimerRef.current = null;
      }
    };
  }, [copyStatus]);

  if (!voiceToText) return null;

  const transcribeAudioFile = async () => {
    setTranscribing(true);
    setTranscriptionText("");
    setTranscriptionError("");
    setCopyStatus("");
    setApiKeyPasteStatus("");
    setAudioFilePasteStatus("");

    try {
      const result = await invoke<TranscriptionResult>(
        "transcribe_audio_file",
        {
          settings: voiceToText,
          audio_file_path: audioFilePath.trim(),
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

  const copyTranscriptionText = async () => {
    if (!transcriptionText) return;

    try {
      await navigator.clipboard.writeText(transcriptionText);
      setCopyStatus("コピーしました");
      const resultField = document.getElementById(
        "v2t-transcription-result",
      ) as HTMLTextAreaElement | null;
      resultField?.focus();
      resultField?.select();
    } catch (err) {
      console.error("Failed to copy transcription text:", err);
      setCopyStatus("コピーに失敗しました");
    }
  };

  const clearTranscriptionText = () => {
    setTranscriptionText("");
    setTranscriptionError("");
    setCopyStatus("");
    setApiKeyPasteStatus("");
    setAudioFilePasteStatus("");
    document.getElementById("v2t-audio-file-input")?.focus();
  };

  const clearTranscriptionOutput = () => {
    setTranscriptionText("");
    setTranscriptionError("");
    setCopyStatus("");
  };

  const updateAudioFilePath = (value: string) => {
    setAudioFilePath(value);
    clearTranscriptionOutput();
    setAudioFilePasteStatus("");
  };

  const clearAudioFilePath = () => {
    updateAudioFilePath("");
    document.getElementById("v2t-audio-file-input")?.focus();
  };

  const pasteAudioFilePath = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const value = text.trim();
      if (!value) {
        setAudioFilePasteStatus(EMPTY_PASTE_STATUS);
        setApiKeyPasteStatus("");
        return;
      }
      setAudioFilePath(value);
      setAudioFilePasteStatus("音声ファイルパスを貼り付けました");
      setApiKeyPasteStatus("");
    } catch (err) {
      console.error("Failed to paste audio file path:", err);
    } finally {
      const audioFileInput = document.getElementById(
        "v2t-audio-file-input",
      ) as HTMLInputElement | null;
      audioFileInput?.focus();
      audioFileInput?.select();
    }
  };

  const handleAudioFilePathKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" || !canTranscribe) return;

    event.preventDefault();
    void transcribeAudioFile();
  };

  const normalizeAudioFilePath = (value: string) => {
    setAudioFilePath(value.trim());
  };

  const resetVoiceToTextSettings = () => {
    handleChange("enabled", defaultAppSettings.voiceToText.enabled);
    handleChange("shortcut", defaultAppSettings.voiceToText.shortcut);
    handleChange("baseUrl", defaultAppSettings.voiceToText.baseUrl);
    handleChange("model", defaultAppSettings.voiceToText.model);
    handleChange("language", defaultAppSettings.voiceToText.language);
    setTranscriptionText("");
    setTranscriptionError("");
    setCopyStatus("");
    setApiKeyPasteStatus("");
    setAudioFilePasteStatus("");
    setShowApiKey(false);
    const shortcutInput = document.getElementById(
      "v2t-shortcut-input",
    ) as HTMLInputElement | null;
    shortcutInput?.focus();
    shortcutInput?.select();
  };

  const canTranscribe =
    voiceToText.enabled &&
    apiKeyLoaded &&
    Boolean(apiKey.trim()) &&
    Boolean(audioFilePath.trim()) &&
    !transcribing;

  const transcribeHelpText = (() => {
    if (!voiceToText.enabled) {
      return "実行するには、この機能を有効にしてください。";
    }
    if (!apiKeyLoaded) {
      return "APIキーを読み込み中です。";
    }
    if (!apiKey.trim()) {
      return "実行するには、APIキーを入力してください。";
    }
    if (!audioFilePath.trim()) {
      return "実行するには、音声ファイルパスを入力してください。";
    }
    return undefined;
  })();

  return (
    <SettingsSection
      title="音声入力 (Voice to Text) 設定"
      description="OpenAI互換の音声認識APIを使って音声ファイルを文字起こしします。"
    >
      <div className="feature-settings-toolbar">
        <div className="feature-settings-actions">
          <Button variant="ghost" onClick={resetVoiceToTextSettings}>
            デフォルトに戻す
          </Button>
        </div>
      </div>

      <Field
        id="v2t-enabled-checkbox"
        label="この機能を有効にする (Enable Feature)"
        orientation="inline"
      >
        <Switch
          id="v2t-enabled-checkbox"
          checked={voiceToText.enabled}
          onChange={(e) => handleChange("enabled", e.target.checked)}
        />
      </Field>

      <Field
        id="v2t-shortcut-input"
        label="起動/録音ショートカットキー"
        error={shortcutError}
        helpText="入力欄をクリックしてキーを押すことでショートカットキーを変更できます。"
      >
        <ShortcutInput
          id="v2t-shortcut-input"
          invalid={Boolean(shortcutError)}
          value={voiceToText.shortcut}
          onChange={(value) => handleChange("shortcut", value)}
          placeholderText="例: Ctrl+Alt+V"
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
          onChange={(e) => {
            clearTranscriptionOutput();
            handleChange("baseUrl", e.target.value);
          }}
          onBlur={(e) =>
            handleChange("baseUrl", normalizeBaseUrl(e.target.value))
          }
          placeholder="例: https://api.openai.com/v1"
        />
      </Field>

      <Field
        id="v2t-api-key-input"
        label="API キー"
        helpText="音声認識APIの認証キーです。キーはOSのセキュアストレージ（Windows 資格情報マネージャー）に安全に保存されます。"
      >
        <FieldRow>
          <TextInput
            id="v2t-api-key-input"
            type={showApiKey ? "text" : "password"}
            value={apiKeyLoaded ? apiKey : ""}
            onChange={(e) => {
              clearTranscriptionOutput();
              setApiKey(e.target.value);
              setApiKeyPasteStatus("");
            }}
            onBlur={saveApiKey}
            placeholder={apiKeyLoaded ? "APIキーを入力" : "読み込み中..."}
            disabled={!apiKeyLoaded}
          />
          <Button
            variant="ghost"
            disabled={!apiKeyLoaded}
            aria-label="API キーを貼り付け"
            onClick={pasteApiKey}
          >
            貼り付け
          </Button>
          <Button
            variant="ghost"
            aria-pressed={showApiKey}
            disabled={!apiKeyLoaded}
            onClick={() => setShowApiKey((current) => !current)}
          >
            {showApiKey ? "隠す" : "表示"}
          </Button>
          {apiKeyPasteStatus && (
            <span
              className={getStatusLabelClass(apiKeyPasteStatus)}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {apiKeyPasteStatus}
            </span>
          )}
        </FieldRow>
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
          onChange={(e) => {
            clearTranscriptionOutput();
            handleChange("model", e.target.value);
          }}
          onBlur={(e) =>
            handleChange("model", normalizeModelName(e.target.value))
          }
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
          onChange={(e) => {
            clearTranscriptionOutput();
            handleChange("language", e.target.value);
          }}
          onBlur={(e) =>
            handleChange("language", normalizeLanguageCode(e.target.value))
          }
          placeholder="例: ja"
        />
      </Field>

      <Field
        id="v2t-audio-file-input"
        label="音声ファイルパス"
        helpText="wav、mp3、m4a など、利用する音声認識APIが対応する音声ファイルを指定します。Enter でも文字起こしを開始できます。"
      >
        <FieldRow>
          <TextInput
            id="v2t-audio-file-input"
            type="text"
            value={audioFilePath}
            onChange={(e) => {
              updateAudioFilePath(e.target.value);
            }}
            onBlur={(e) => normalizeAudioFilePath(e.target.value)}
            onKeyDown={handleAudioFilePathKeyDown}
            placeholder="例: /Users/me/audio.wav"
          />
          <Button
            variant="ghost"
            aria-label="音声ファイルパスを貼り付け"
            onClick={pasteAudioFilePath}
          >
            貼り付け
          </Button>
          <Button variant="ghost" onClick={clearAudioFilePath}>
            クリア
          </Button>
          {audioFilePasteStatus && (
            <span
              className={getStatusLabelClass(audioFilePasteStatus)}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {audioFilePasteStatus}
            </span>
          )}
        </FieldRow>
      </Field>

      <Field id="v2t-transcribe-button" helpText={transcribeHelpText}>
        <Button onClick={transcribeAudioFile} disabled={!canTranscribe}>
          {transcribing ? (
            <>
              <svg
                className="spinner-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  strokeDasharray="60"
                  strokeDashoffset="20"
                />
              </svg>
              文字起こし中...
            </>
          ) : (
            "文字起こしを実行"
          )}
        </Button>
      </Field>

      {transcriptionError && (
        <ErrorMessage autoFocus>{transcriptionError}</ErrorMessage>
      )}

      {transcriptionText && (
        <Field id="v2t-transcription-result" label="文字起こし結果">
          <div className="transcription-result-actions">
            <Button
              id="v2t-copy-result-button"
              variant="ghost"
              onClick={copyTranscriptionText}
            >
              結果をコピー
            </Button>
            <Button variant="ghost" onClick={clearTranscriptionText}>
              結果をクリア
            </Button>
            {copyStatus && (
              <span
                className={getStatusLabelClass(copyStatus)}
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {copyStatus}
              </span>
            )}
          </div>
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
