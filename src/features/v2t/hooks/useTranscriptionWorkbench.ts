import { getCurrentWindow } from "@tauri-apps/api/window";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { chooseAudioFile, isSupportedAudioFilePath } from "../api";
import { focusAndSelect } from "../focus";
import type { VoiceToTextSettings } from "../types";
import { useTranscriptionActions } from "./useTranscriptionActions";
import { useTransientStatus } from "./useTransientStatus";

const STATUS_VISIBLE_MS = 2000;
const EMPTY_PASTE_STATUS = "貼り付ける内容がありません";
const CLIPBOARD_READ_ERROR_STATUS =
  "クリップボードから貼り付けられませんでした";
const FILE_PICKER_ERROR_STATUS = "音声ファイルを選択できませんでした";
const DROPPED_FILE_ERROR_STATUS =
  "対応していない形式です。音声ファイルをドロップしてください";
const MULTIPLE_DROPPED_FILES_STATUS =
  "音声ファイルは1つずつドロップしてください";

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
  const [isDropTarget, setIsDropTarget] = useState(false);
  const workbenchRef = useRef<HTMLElement | null>(null);
  const [audioFilePasteStatus, setAudioFilePasteStatus, audioFilePasteTone] =
    useTransientStatus(STATUS_VISIBLE_MS);

  const isPositionInsideWorkbench = useCallback(
    (position: { x: number; y: number }) => {
      const workbench = workbenchRef.current;
      if (!workbench) return false;

      const rect = workbench.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const x = position.x / scale;
      const y = position.y / scale;
      return (
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      );
    },
    [],
  );

  const {
    canRecord,
    canRetryTranscription,
    canTranscribe,
    configurationError,
    copyStatus,
    copyTone,
    copyTranscriptionText,
    clearTranscriptionOutput,
    discardRecording,
    recording,
    recordingSeconds,
    retryTranscription,
    saveNoteStatus,
    saveNoteTone,
    saveTranscriptionAsNote,
    savingNote,
    startRecording,
    stopRecording,
    transcribeAudioFile,
    transcribing,
    transcriptionError,
    transcriptionSaved,
    transcriptionText,
  } = useTranscriptionActions({
    settings,
    apiKey,
    apiKeyLoaded,
    audioFilePath,
    clearApiKeyPasteStatus,
    setAudioFilePasteStatus,
  });

  useEffect(() => {
    if (transcriptionText) focusAndSelect("v2t-transcription-result");
  }, [transcriptionText]);

  useEffect(() => {
    if (audioFilePasteStatus === "音声ファイルパスを貼り付けました") {
      focusAndSelect("v2t-audio-file-input");
    }
  }, [audioFilePasteStatus]);

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
      clearTranscriptionOutput();
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
  }, [
    clearApiKeyPasteStatus,
    clearTranscriptionOutput,
    setAudioFilePasteStatus,
  ]);

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

  const acceptDroppedAudioFiles = useCallback(
    (paths: string[]) => {
      if (paths.length !== 1) {
        setAudioFilePasteStatus(
          paths.length > 1
            ? MULTIPLE_DROPPED_FILES_STATUS
            : DROPPED_FILE_ERROR_STATUS,
          "warning",
        );
        return;
      }

      const path = paths[0]?.trim() ?? "";
      if (!isSupportedAudioFilePath(path)) {
        setAudioFilePasteStatus(DROPPED_FILE_ERROR_STATUS, "warning");
        return;
      }

      clearTranscriptionOutput();
      setAudioFilePath(path);
      setAudioFilePasteStatus("音声ファイルをドロップしました");
      focusAndSelect("v2t-audio-file-input");
    },
    [clearTranscriptionOutput, setAudioFilePasteStatus],
  );

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const listenForFileDrop = async () => {
      try {
        const currentWindow = getCurrentWindow();
        if (typeof currentWindow.onDragDropEvent !== "function") return;

        const cleanup = await currentWindow.onDragDropEvent((event) => {
          if (disposed) return;
          const { payload } = event;

          if (payload.type === "leave") {
            setIsDropTarget(false);
            return;
          }

          const isInside = isPositionInsideWorkbench(payload.position);
          if (payload.type === "drop") {
            setIsDropTarget(false);
            if (isInside) acceptDroppedAudioFiles(payload.paths);
            return;
          }
          setIsDropTarget(isInside);
        });

        if (disposed) cleanup();
        else unlisten = cleanup;
      } catch (error) {
        console.warn("Failed to register audio file drop listener:", error);
      }
    };

    void listenForFileDrop();
    return () => {
      disposed = true;
      setIsDropTarget(false);
      unlisten?.();
    };
  }, [acceptDroppedAudioFiles, isPositionInsideWorkbench]);

  const handleAudioFilePathKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        !canTranscribe
      ) {
        return;
      }
      event.preventDefault();
      void transcribeAudioFile();
    },
    [canTranscribe, transcribeAudioFile],
  );

  const handleWorkbenchKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (
        event.key !== "Enter" ||
        (!event.ctrlKey && !event.metaKey) ||
        event.altKey ||
        event.shiftKey ||
        !canTranscribe
      ) {
        return;
      }
      event.preventDefault();
      void transcribeAudioFile();
    },
    [canTranscribe, transcribeAudioFile],
  );

  const normalizeAudioFilePath = useCallback((value: string) => {
    setAudioFilePath(value.trim());
  }, []);

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
            : "ファイル欄のEnter、またはCtrl/Command+Enterで実行できます。";

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
    canRecord,
    canRetryTranscription,
    isDropTarget,
    workbenchRef,
    transcriptionText,
    transcriptionError,
    copyStatus,
    copyTone,
    transcribing,
    recording,
    recordingSeconds,
    canTranscribe,
    transcribeHelpText,
    setupSteps,
    setAudioFilePasteStatus,
    clearTranscriptionOutput,
    transcribeAudioFile,
    retryTranscription,
    startRecording,
    stopRecording,
    discardRecording,
    copyTranscriptionText,
    saveTranscriptionAsNote,
    saveNoteStatus,
    saveNoteTone,
    savingNote,
    transcriptionSaved,
    clearTranscriptionText,
    updateAudioFilePath,
    clearAudioFilePath,
    pasteAudioFilePath,
    selectAudioFile,
    handleAudioFilePathKeyDown,
    handleWorkbenchKeyDown,
    normalizeAudioFilePath,
    resetTranscriptionUi,
  };
};
