import { ClipboardPaste, Eye, EyeOff, Mic2, Server } from "lucide-react";
import type React from "react";
import {
  Button,
  ErrorMessage,
  Field,
  FieldRow,
  ShortcutInput,
  TextInput,
} from "../../../design/components";
import type { VoiceToTextController } from "../hooks/useVoiceToTextController";
import {
  normalizeBaseUrl,
  normalizeLanguageCode,
  normalizeModelName,
  validateBaseUrl,
  validateLanguageCode,
  validateModelName,
} from "../settings";
import { StatusToast } from "./StatusToast";

export const VoiceToTextConnectionSettings: React.FC<{
  controller: VoiceToTextController;
}> = ({ controller }) => {
  const {
    voiceToText,
    handleChange,
    shortcutError,
    apiKey,
    apiKeyLoaded,
    apiKeySaveError,
    apiKeySaveStatus,
    apiKeyPasteStatus,
    baseUrlError,
    modelError,
    languageError,
    showApiKey,
    setApiKey,
    setApiKeySaveError,
    setApiKeySaveStatus,
    setApiKeyPasteStatus,
    setBaseUrlError,
    setModelError,
    setLanguageError,
    setShowApiKey,
    clearTranscriptionOutput,
    saveApiKey,
    pasteApiKey,
  } = controller;

  return (
    <div className="v2t-settings-column">
      <section className="settings-group" aria-labelledby="v2t-launch-title">
        <div className="settings-group__heading">
          <Mic2 size={18} aria-hidden="true" />
          <div>
            <h3 id="v2t-launch-title">起動</h3>
            <p>録音を開始するグローバルショートカット</p>
          </div>
        </div>
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
      </section>

      <section className="settings-group" aria-labelledby="v2t-api-title">
        <div className="settings-group__heading">
          <Server size={18} aria-hidden="true" />
          <div>
            <h3 id="v2t-api-title">API 接続</h3>
            <p>OpenAI互換エンドポイントと認証情報</p>
          </div>
        </div>

        <Field
          id="v2t-base-url-input"
          label="API エンドポイント (Base URL)"
          error={baseUrlError}
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
            onChange={(event) => {
              clearTranscriptionOutput();
              setBaseUrlError("");
              handleChange("baseUrl", event.target.value);
            }}
            onBlur={(event) => {
              const normalized = normalizeBaseUrl(event.target.value);
              setBaseUrlError(validateBaseUrl(normalized) ?? "");
              handleChange("baseUrl", normalized);
            }}
            invalid={Boolean(baseUrlError)}
            inputMode="url"
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
              className="v2t-row-input"
              type={showApiKey ? "text" : "password"}
              value={apiKeyLoaded ? apiKey : ""}
              onChange={(event) => {
                clearTranscriptionOutput();
                setApiKey(event.target.value);
                setApiKeySaveError("");
                setApiKeySaveStatus("");
                setApiKeyPasteStatus("");
              }}
              onBlur={saveApiKey}
              placeholder={apiKeyLoaded ? "APIキーを入力" : "読み込み中..."}
              disabled={!apiKeyLoaded}
            />
            <Button
              variant="ghost"
              className="v2t-icon-button"
              disabled={!apiKeyLoaded}
              aria-label="API キーを貼り付け"
              title="貼り付け"
              onClick={() => void pasteApiKey()}
            >
              <ClipboardPaste size={16} aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              className="v2t-icon-button"
              aria-label={showApiKey ? "隠す" : "表示"}
              title={showApiKey ? "APIキーを隠す" : "APIキーを表示"}
              aria-pressed={showApiKey}
              disabled={!apiKeyLoaded}
              onClick={() => setShowApiKey((current) => !current)}
            >
              {showApiKey ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
            </Button>
            {apiKeyPasteStatus && <StatusToast message={apiKeyPasteStatus} />}
            {apiKeySaveStatus && <StatusToast message={apiKeySaveStatus} />}
          </FieldRow>
          {apiKeySaveError && <ErrorMessage>{apiKeySaveError}</ErrorMessage>}
        </Field>

        <div className="v2t-model-grid">
          <Field
            id="v2t-model-input"
            label="モデル名"
            helpText={
              <>
                APIで使用する音声認識モデル名。OpenAIの場合は{" "}
                <code>whisper-1</code> 、Groqの場合は{" "}
                <code>whisper-large-v3</code> などを入力します。
              </>
            }
          >
            <TextInput
              id="v2t-model-input"
              type="text"
              value={voiceToText.model}
              onChange={(event) => {
                clearTranscriptionOutput();
                setModelError("");
                handleChange("model", event.target.value);
              }}
              onBlur={(event) => {
                const normalized = normalizeModelName(event.target.value);
                setModelError(validateModelName(normalized) ?? "");
                handleChange("model", normalized);
              }}
              invalid={Boolean(modelError)}
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
              onChange={(event) => {
                clearTranscriptionOutput();
                setLanguageError("");
                handleChange("language", event.target.value);
              }}
              onBlur={(event) => {
                const normalized = normalizeLanguageCode(event.target.value);
                setLanguageError(validateLanguageCode(normalized) ?? "");
                handleChange("language", normalized);
              }}
              invalid={Boolean(languageError)}
              inputMode="text"
              maxLength={3}
              autoCapitalize="none"
              placeholder="例: ja"
            />
          </Field>
        </div>
      </section>
    </div>
  );
};
