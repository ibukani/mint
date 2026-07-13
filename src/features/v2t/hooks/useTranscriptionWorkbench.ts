import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { chooseAudioFile, transcribeAudio } from "../api";
import { focusAndSelect } from "../focus";
import {
  validateBaseUrl,
  validateLanguageCode,
  validateModelName,
} from "../settings";
import type { VoiceToTextSettings } from "../types";
import { useTransientStatus } from "./useTransientStatus";

const STATUS_VISIBLE_MS = 2000;
const COPY_ERROR_VISIBLE_MS = 5000;
const EMPTY_PASTE_STATUS = "貼り付ける内容がありません";
const CLIPBOARD_READ_ERROR_STATUS =
  "クリップボードから貼り付けられませんでした";
const FILE_PICKER_ERROR_STATUS = "音声ファイルを選択できませんでした";

const getCopyStatusDuration = (status: string) =>
  status === "コピーしました" ? STATUS_VISIBLE_MS : COPY_ERROR_VISIBLE_MS;

interface TranscriptionWorkbenchOptions {
  settings: VoiceToTextSettings;
  apiKey: string;
  apiKeyLoaded: boolean;
  clearApiKeyPasteStatus: () => void;
}

export const useTranscriptionWorkbench = ({
  settings,
  apiKey,
  apiKeyLoaded,
  clearApiKeyPasteStatus,
}: TranscriptionWorkbenchOptions) => {
  const [audioFilePath, setAudioFilePath] = useState("");
  const [transcriptionText, setTranscriptionText] = useState("");
  const [transcriptionError, setTranscriptionError] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [audioFilePasteStatus, setAudioFilePasteStatus, audioFilePasteTone] =
    useTransientStatus(STATUS_VISIBLE_MS);
  const [copyStatus, setCopyStatus, copyTone] = useTransientStatus(
    getCopyStatusDuration,
  );

  useEffect(() => {
    if (transcriptionText) focusAndSelect("v2t-transcription-result");
  }, [transcriptionText]);

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

  const configurationError =
    validateBaseUrl(settings.baseUrl) ??
    validateModelName(settings.model) ??
    validateLanguageCode(settings.language);

  const canTranscribe =
    settings.enabled &&
    apiKeyLoaded &&
    Boolean(apiKey.trim()) &&
    Boolean(audioFilePath.trim()) &&
    !configurationError &&
    !transcribing;

  const transcribeAudioFile = useCallback(async () => {
    setTranscribing(true);
    clearTranscriptionOutput();
    clearApiKeyPasteStatus();
    setAudioFilePasteStatus("");

    try {
      const result = await transcribeAudio(settings, audioFilePath.trim());
      setTranscriptionText(result.text);
    } catch (error) {
      setTranscriptionError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setTranscribing(false);
    }
  }, [
    audioFilePath,
    clearApiKeyPasteStatus,
    clearTranscriptionOutput,
    setAudioFilePasteStatus,
    settings,
  ]);

  const copyTranscriptionText = useCallback(async () => {
    if (!transcriptionText) return;
    try {
      await navigator.clipboard.writeText(transcriptionText);
      setCopyStatus("コピーしました");
      focusAndSelect("v2t-transcription-result");
    } catch (error) {
      console.error("Failed to copy transcription text:", error);
      setCopyStatus("コピーに失敗しました", "error");
    }
  }, [setCopyStatus, transcriptionText]);

  const clearTranscriptionText = useCallback(() => {
    clearTranscriptionOutput();
    clearApiKeyPasteStatus();
    setAudioFilePasteStatus("");
    document.getElementById("v2t-audio-file-input")?.focus();
  }, [
    clearApiKeyPasteStatus,
    clearTranscriptionOutput,
    setAudioFilePasteStatus,
  ]);

  const updateAudioFilePath = useCallback(
    (value: string) => {
      setAudioFilePath(value);
      clearTranscriptionOutput();
      setAudioFilePasteStatus("");
    },
    [clearTranscriptionOutput, setAudioFilePasteStatus],
  );

  const clearAudioFilePath = useCallback(() => {
    updateAudioFilePath("");
    document.getElementById("v2t-audio-file-input")?.focus();
  }, [updateAudioFilePath]);

  const pasteAudioFilePath = useCallback(async () => {
    try {
      const value = (await navigator.clipboard.readText()).trim();
      if (!value) {
        setAudioFilePasteStatus(EMPTY_PASTE_STATUS, "warning");
        clearApiKeyPasteStatus();
        return;
      }
      setAudioFilePath(value);
      setAudioFilePasteStatus("音声ファイルパスを貼り付けました");
      clearApiKeyPasteStatus();
    } catch (error) {
      console.error("Failed to paste audio file path:", error);
      setAudioFilePasteStatus(CLIPBOARD_READ_ERROR_STATUS, "error");
      clearApiKeyPasteStatus();
    } finally {
      focusAndSelect("v2t-audio-file-input");
    }
  }, [clearApiKeyPasteStatus, setAudioFilePasteStatus]);

  const selectAudioFile = useCallback(async () => {
    setAudioFilePasteStatus("");
    clearApiKeyPasteStatus();
    try {
      const selected = await chooseAudioFile();
      if (!selected) return;
      setAudioFilePath(selected);
      clearTranscriptionOutput();
      setAudioFilePasteStatus("音声ファイルを選択しました");
    } catch (error) {
      console.error("Failed to select an audio file:", error);
      setAudioFilePasteStatus(FILE_PICKER_ERROR_STATUS, "error");
    } finally {
      focusAndSelect("v2t-audio-file-input");
    }
  }, [
    clearApiKeyPasteStatus,
    clearTranscriptionOutput,
    setAudioFilePasteStatus,
  ]);

  const handleAudioFilePathKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Enter" || !canTranscribe) return;
      event.preventDefault();
      void transcribeAudioFile();
    },
    [canTranscribe, transcribeAudioFile],
  );

  const resetTranscriptionUi = useCallback(() => {
    clearTranscriptionOutput();
    setAudioFilePasteStatus("");
  }, [clearTranscriptionOutput, setAudioFilePasteStatus]);

  const transcribeHelpText = !settings.enabled
    ? "実行するには、この機能を有効にしてください。"
    : !apiKeyLoaded
      ? "APIキーを読み込み中です。"
      : !apiKey.trim()
        ? "実行するには、APIキーを入力してください。"
        : !audioFilePath.trim()
          ? "実行するには、音声ファイルパスを入力してください。"
          : configurationError
            ? configurationError
            : undefined;

  const setupSteps = [
    {
      label: "機能",
      complete: settings.enabled,
      detail: settings.enabled ? "有効" : "有効化が必要",
    },
    {
      label: "API接続",
      complete: apiKeyLoaded && Boolean(apiKey.trim()) && !configurationError,
      detail: !apiKeyLoaded
        ? "読み込み中"
        : apiKey.trim()
          ? configurationError
            ? "設定を確認"
            : "接続設定済み"
          : "APIキーが必要",
    },
    {
      label: "音声ファイル",
      complete: Boolean(audioFilePath.trim()),
      detail: audioFilePath.trim() ? "指定済み" : "パスが必要",
    },
  ];

  return {
    audioFilePath,
    audioFilePasteStatus,
    audioFilePasteTone,
    transcriptionText,
    transcriptionError,
    copyStatus,
    copyTone,
    transcribing,
    canTranscribe,
    transcribeHelpText,
    setupSteps,
    setAudioFilePasteStatus,
    clearTranscriptionOutput,
    transcribeAudioFile,
    copyTranscriptionText,
    clearTranscriptionText,
    updateAudioFilePath,
    clearAudioFilePath,
    pasteAudioFilePath,
    selectAudioFile,
    handleAudioFilePathKeyDown,
    normalizeAudioFilePath: (value: string) => setAudioFilePath(value.trim()),
    resetTranscriptionUi,
  };
};
