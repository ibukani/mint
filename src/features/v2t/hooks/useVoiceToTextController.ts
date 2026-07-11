import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { defaultAppSettings } from "../../../core/defaultSettings";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import type { TranscriptionResult } from "../types";

const PASTE_STATUS_VISIBLE_MS = 2000;
const API_KEY_SAVE_STATUS_VISIBLE_MS = 2000;
const COPY_ERROR_VISIBLE_MS = 5000;
const EMPTY_PASTE_STATUS = "貼り付ける内容がありません";
const CLIPBOARD_READ_ERROR_STATUS =
  "クリップボードから貼り付けられませんでした";
const FILE_PICKER_ERROR_STATUS = "音声ファイルを選択できませんでした";

const focusAndSelect = (id: string) => {
  const element = document.getElementById(id);
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    element.focus();
    element.select();
  }
};

const useTransientStatus = (
  visibleMs: number | ((status: string) => number),
) => {
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!status) return undefined;
    const duration =
      typeof visibleMs === "function" ? visibleMs(status) : visibleMs;
    const timer = setTimeout(() => setStatus(""), duration);
    return () => clearTimeout(timer);
  }, [status, visibleMs]);

  return [status, setStatus] as const;
};

const getCopyStatusDuration = (status: string) =>
  status === "コピーしました" ? PASTE_STATUS_VISIBLE_MS : COPY_ERROR_VISIBLE_MS;

export const useVoiceToTextController = () => {
  const {
    featureSettings: voiceToText,
    handleChange,
    shortcutError,
  } = useFeatureSettings("voiceToText");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [apiKeySaveError, setApiKeySaveError] = useState("");
  const [baseUrlError, setBaseUrlError] = useState("");
  const [modelError, setModelError] = useState("");
  const [languageError, setLanguageError] = useState("");
  const [audioFilePath, setAudioFilePath] = useState("");
  const [transcriptionText, setTranscriptionText] = useState("");
  const [transcriptionError, setTranscriptionError] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [apiKeySaveStatus, setApiKeySaveStatus] = useTransientStatus(
    API_KEY_SAVE_STATUS_VISIBLE_MS,
  );
  const [apiKeyPasteStatus, setApiKeyPasteStatus] = useTransientStatus(
    PASTE_STATUS_VISIBLE_MS,
  );
  const [audioFilePasteStatus, setAudioFilePasteStatus] = useTransientStatus(
    PASTE_STATUS_VISIBLE_MS,
  );
  const [copyStatus, setCopyStatus] = useTransientStatus(getCopyStatusDuration);

  useEffect(() => {
    async function loadKey() {
      try {
        const key = await invoke<string>("load_api_key", {
          service: "voice_to_text",
        });
        setApiKey(typeof key === "string" ? key : "");
      } catch (error) {
        console.error("Failed to load API key:", error);
      } finally {
        setApiKeyLoaded(true);
      }
    }
    void loadKey();
  }, []);

  useEffect(() => {
    if (transcriptionText) focusAndSelect("v2t-transcription-result");
  }, [transcriptionText]);

  useEffect(() => {
    if (showApiKey && apiKeyLoaded) focusAndSelect("v2t-api-key-input");
  }, [apiKeyLoaded, showApiKey]);

  useEffect(() => {
    if (apiKeyPasteStatus === "API キーを貼り付けました") {
      focusAndSelect("v2t-api-key-input");
    }
  }, [apiKeyPasteStatus]);

  useEffect(() => {
    if (audioFilePasteStatus === "音声ファイルパスを貼り付けました") {
      focusAndSelect("v2t-audio-file-input");
    }
  }, [audioFilePasteStatus]);

  const clearTranscriptionOutput = useCallback(() => {
    setTranscriptionText("");
    setTranscriptionError("");
    setCopyStatus("");
  }, [setCopyStatus]);

  const saveApiKey = useCallback(async () => {
    setApiKeyPasteStatus("");
    setApiKeySaveStatus("");
    try {
      await invoke("save_api_key", { service: "voice_to_text", key: apiKey });
      setApiKeySaveError("");
      setApiKeySaveStatus("APIキーを保存しました");
    } catch (error) {
      console.error("Failed to save API key:", error);
      setApiKeySaveError(
        "APIキーの保存に失敗しました。もう一度お試しください。",
      );
      setApiKeySaveStatus("");
    }
  }, [apiKey, setApiKeyPasteStatus, setApiKeySaveStatus]);

  const pasteApiKey = useCallback(async () => {
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (!value) {
        setApiKeyPasteStatus(EMPTY_PASTE_STATUS);
        setAudioFilePasteStatus("");
        return;
      }
      setApiKey(value);
      setApiKeySaveStatus("");
      setApiKeyPasteStatus("API キーを貼り付けました");
      setAudioFilePasteStatus("");
    } catch (error) {
      console.error("Failed to paste API key:", error);
      setApiKeyPasteStatus(CLIPBOARD_READ_ERROR_STATUS);
      setAudioFilePasteStatus("");
    } finally {
      focusAndSelect("v2t-api-key-input");
    }
  }, [setApiKeyPasteStatus, setApiKeySaveStatus, setAudioFilePasteStatus]);

  if (!voiceToText) return null;

  const canTranscribe =
    voiceToText.enabled &&
    apiKeyLoaded &&
    Boolean(apiKey.trim()) &&
    Boolean(audioFilePath.trim()) &&
    !transcribing;

  const transcribeAudioFile = async () => {
    setTranscribing(true);
    clearTranscriptionOutput();
    setApiKeySaveStatus("");
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
    } catch (error) {
      setTranscriptionError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setTranscribing(false);
    }
  };

  const copyTranscriptionText = async () => {
    if (!transcriptionText) return;
    try {
      await navigator.clipboard.writeText(transcriptionText);
      setCopyStatus("コピーしました");
      focusAndSelect("v2t-transcription-result");
    } catch (error) {
      console.error("Failed to copy transcription text:", error);
      setCopyStatus("コピーに失敗しました");
    }
  };

  const clearTranscriptionText = () => {
    clearTranscriptionOutput();
    setApiKeyPasteStatus("");
    setAudioFilePasteStatus("");
    document.getElementById("v2t-audio-file-input")?.focus();
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
      const value = (await navigator.clipboard.readText()).trim();
      if (!value) {
        setAudioFilePasteStatus(EMPTY_PASTE_STATUS);
        setApiKeyPasteStatus("");
        return;
      }
      setAudioFilePath(value);
      setAudioFilePasteStatus("音声ファイルパスを貼り付けました");
      setApiKeyPasteStatus("");
    } catch (error) {
      console.error("Failed to paste audio file path:", error);
      setAudioFilePasteStatus(CLIPBOARD_READ_ERROR_STATUS);
      setApiKeyPasteStatus("");
    } finally {
      focusAndSelect("v2t-audio-file-input");
    }
  };

  const selectAudioFile = async () => {
    setAudioFilePasteStatus("");
    setApiKeyPasteStatus("");
    try {
      const selected = await open({
        title: "文字起こしする音声ファイルを選択",
        multiple: false,
        directory: false,
        filters: [
          {
            name: "音声ファイル",
            extensions: ["wav", "mp3", "m4a", "aac", "flac", "ogg", "webm"],
          },
        ],
      });
      if (!selected) return;
      setAudioFilePath(selected);
      clearTranscriptionOutput();
      setAudioFilePasteStatus("音声ファイルを選択しました");
    } catch (error) {
      console.error("Failed to select an audio file:", error);
      setAudioFilePasteStatus(FILE_PICKER_ERROR_STATUS);
    } finally {
      focusAndSelect("v2t-audio-file-input");
    }
  };

  const handleAudioFilePathKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || !canTranscribe) return;
    event.preventDefault();
    void transcribeAudioFile();
  };

  const resetVoiceToTextSettings = () => {
    handleChange("enabled", defaultAppSettings.voiceToText.enabled);
    handleChange("shortcut", defaultAppSettings.voiceToText.shortcut);
    handleChange("baseUrl", defaultAppSettings.voiceToText.baseUrl);
    handleChange("model", defaultAppSettings.voiceToText.model);
    handleChange("language", defaultAppSettings.voiceToText.language);
    clearTranscriptionOutput();
    setApiKeySaveStatus("");
    setApiKeyPasteStatus("");
    setAudioFilePasteStatus("");
    setShowApiKey(false);
    focusAndSelect("v2t-shortcut-input");
  };

  const transcribeHelpText = !voiceToText.enabled
    ? "実行するには、この機能を有効にしてください。"
    : !apiKeyLoaded
      ? "APIキーを読み込み中です。"
      : !apiKey.trim()
        ? "実行するには、APIキーを入力してください。"
        : !audioFilePath.trim()
          ? "実行するには、音声ファイルパスを入力してください。"
          : undefined;

  const setupSteps = [
    {
      label: "機能",
      complete: voiceToText.enabled,
      detail: voiceToText.enabled ? "有効" : "有効化が必要",
    },
    {
      label: "APIキー",
      complete: apiKeyLoaded && Boolean(apiKey.trim()),
      detail: !apiKeyLoaded
        ? "読み込み中"
        : apiKey.trim()
          ? "設定済み"
          : "入力が必要",
    },
    {
      label: "音声ファイル",
      complete: Boolean(audioFilePath.trim()),
      detail: audioFilePath.trim() ? "指定済み" : "パスが必要",
    },
  ];

  return {
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
    audioFilePath,
    audioFilePasteStatus,
    transcriptionText,
    transcriptionError,
    copyStatus,
    showApiKey,
    transcribing,
    canTranscribe,
    transcribeHelpText,
    setupSteps,
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
    transcribeAudioFile,
    copyTranscriptionText,
    clearTranscriptionText,
    updateAudioFilePath,
    clearAudioFilePath,
    pasteAudioFilePath,
    selectAudioFile,
    handleAudioFilePathKeyDown,
    normalizeAudioFilePath: (value: string) => setAudioFilePath(value.trim()),
    resetVoiceToTextSettings,
  };
};

export type VoiceToTextController = NonNullable<
  ReturnType<typeof useVoiceToTextController>
>;
