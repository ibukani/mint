import { getCurrentWindow } from "@tauri-apps/api/window";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  chooseAudioFile,
  isSupportedAudioFilePath,
  transcribeAudio,
  transcribeAudioRecording,
} from "../api";
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
const DROPPED_FILE_ERROR_STATUS =
  "対応していない形式です。音声ファイルをドロップしてください";
const MULTIPLE_DROPPED_FILES_STATUS =
  "音声ファイルは1つずつドロップしてください";
const MAX_RECORDING_SECONDS = 5 * 60;
const RECORDER_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
] as const;

const getRecorderMimeType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  if (typeof MediaRecorder.isTypeSupported !== "function") {
    return "audio/webm";
  }
  return (
    RECORDER_MIME_TYPES.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType),
    ) ?? ""
  );
};

const recordingFileName = (mimeType: string) =>
  mimeType.includes("ogg") ? "mint-recording.ogg" : "mint-recording.webm";

type TranscriptionRetry =
  | { type: "file" }
  | { type: "recording"; audioBlob: Blob; fileName: string };

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
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const workbenchRef = useRef<HTMLElement | null>(null);
  const transcriptionAttemptRef = useRef(0);
  const transcribingRef = useRef(false);
  const recordingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingDiscardedRef = useRef(false);
  const transcriptionRetryRef = useRef<TranscriptionRetry | null>(null);
  const [audioFilePasteStatus, setAudioFilePasteStatus, audioFilePasteTone] =
    useTransientStatus(STATUS_VISIBLE_MS);
  const [copyStatus, setCopyStatus, copyTone] = useTransientStatus(
    getCopyStatusDuration,
  );

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

  useEffect(() => {
    if (transcriptionText) focusAndSelect("v2t-transcription-result");
  }, [transcriptionText]);

  useEffect(() => {
    if (audioFilePasteStatus === "音声ファイルパスを貼り付けました") {
      focusAndSelect("v2t-audio-file-input");
    }
  }, [audioFilePasteStatus]);

  const clearTranscriptionOutput = useCallback(() => {
    transcriptionAttemptRef.current += 1;
    transcribingRef.current = false;
    transcriptionRetryRef.current = null;
    setTranscribing(false);
    setTranscriptionText("");
    setTranscriptionError("");
    setCopyStatus("");
  }, [setCopyStatus]);

  const stopRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const releaseRecordingResources = useCallback(() => {
    stopRecordingTimer();
    recordingStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    recordingStreamRef.current = null;
    recorderRef.current = null;
    recordingChunksRef.current = [];
    recordingStartedAtRef.current = null;
  }, [stopRecordingTimer]);

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
    if (transcribingRef.current) return;

    const attempt = transcriptionAttemptRef.current + 1;
    transcriptionAttemptRef.current = attempt;
    transcribingRef.current = true;
    setTranscribing(true);
    setTranscriptionText("");
    setTranscriptionError("");
    setCopyStatus("");
    transcriptionRetryRef.current = { type: "file" };
    clearApiKeyPasteStatus();
    setAudioFilePasteStatus("");

    try {
      const result = await transcribeAudio(settings, audioFilePath.trim());
      if (attempt !== transcriptionAttemptRef.current) return;
      setTranscriptionText(result.text);
    } catch (error) {
      if (attempt !== transcriptionAttemptRef.current) return;
      setTranscriptionError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      if (attempt === transcriptionAttemptRef.current) {
        transcribingRef.current = false;
        setTranscribing(false);
      }
    }
  }, [
    audioFilePath,
    clearApiKeyPasteStatus,
    setAudioFilePasteStatus,
    setCopyStatus,
    settings,
  ]);

  const transcribeRecordedAudio = useCallback(
    async (audioBlob: Blob, fileName: string) => {
      if (transcribingRef.current || !audioBlob.size) return;

      transcriptionRetryRef.current = {
        type: "recording",
        audioBlob,
        fileName,
      };
      const attempt = transcriptionAttemptRef.current + 1;
      transcriptionAttemptRef.current = attempt;
      transcribingRef.current = true;
      setTranscribing(true);
      setTranscriptionText("");
      setTranscriptionError("");
      setCopyStatus("");
      clearApiKeyPasteStatus();
      setAudioFilePasteStatus("");

      try {
        const audioData = Array.from(
          new Uint8Array(await audioBlob.arrayBuffer()),
        );
        const result = await transcribeAudioRecording(
          settings,
          audioData,
          fileName,
        );
        if (attempt !== transcriptionAttemptRef.current) return;
        setTranscriptionText(result.text);
      } catch (error) {
        if (attempt !== transcriptionAttemptRef.current) return;
        setTranscriptionError(
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        if (attempt === transcriptionAttemptRef.current) {
          transcribingRef.current = false;
          setTranscribing(false);
        }
      }
    },
    [clearApiKeyPasteStatus, setAudioFilePasteStatus, setCopyStatus, settings],
  );

  const canRetryTranscription =
    Boolean(transcriptionRetryRef.current) &&
    Boolean(transcriptionError) &&
    !transcribing;

  const retryTranscription = useCallback(async () => {
    const retry = transcriptionRetryRef.current;
    if (!retry || transcribingRef.current) return;

    if (retry.type === "file") {
      await transcribeAudioFile();
      return;
    }
    await transcribeRecordedAudio(retry.audioBlob, retry.fileName);
  }, [transcribeAudioFile, transcribeRecordedAudio]);

  const canRecord =
    settings.enabled &&
    apiKeyLoaded &&
    Boolean(apiKey.trim()) &&
    !configurationError &&
    !transcribing;

  const startRecording = useCallback(async () => {
    if (recordingRef.current || transcribingRef.current) return;
    if (!canRecord) return;
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setTranscriptionError("この環境ではマイク録音を利用できません。");
      return;
    }

    clearTranscriptionOutput();
    setTranscriptionError("");
    setAudioFilePasteStatus("");
    recordingDiscardedRef.current = false;

    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecorderMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recordingStreamRef.current = stream;
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recordingDiscardedRef.current = true;
        recordingRef.current = false;
        setRecording(false);
        releaseRecordingResources();
        setTranscriptionError(
          "マイク録音に失敗しました。権限を確認してください。",
        );
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        const shouldTranscribe = !recordingDiscardedRef.current;
        recordingRef.current = false;
        setRecording(false);
        releaseRecordingResources();
        if (shouldTranscribe) {
          void transcribeRecordedAudio(
            audioBlob,
            recordingFileName(recorder.mimeType || mimeType),
          );
        }
      };
      recorder.start(250);
      recordingRef.current = true;
      setRecording(true);
      setRecordingSeconds(0);
      recordingStartedAtRef.current = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const startedAt = recordingStartedAtRef.current;
        const elapsed = startedAt
          ? Math.floor((Date.now() - startedAt) / 1000)
          : 0;
        setRecordingSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS) {
          const activeRecorder = recorderRef.current;
          if (activeRecorder && activeRecorder.state !== "inactive") {
            activeRecorder.stop();
          }
        }
      }, 1000);
    } catch (error) {
      stream?.getTracks().forEach((track) => {
        track.stop();
      });
      releaseRecordingResources();
      setTranscriptionError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "マイクへのアクセスが拒否されました。OSのマイク権限を確認してください。"
          : "マイクを開始できませんでした。入力デバイスと権限を確認してください。",
      );
    }
  }, [
    canRecord,
    clearTranscriptionOutput,
    releaseRecordingResources,
    setAudioFilePasteStatus,
    transcribeRecordedAudio,
  ]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  const discardRecording = useCallback(() => {
    recordingDiscardedRef.current = true;
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }, []);

  useEffect(
    () => () => {
      recordingDiscardedRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      } else {
        releaseRecordingResources();
      }
    },
    [releaseRecordingResources],
  );

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

        if (disposed) {
          cleanup();
        } else {
          unlisten = cleanup;
        }
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
    clearTranscriptionText,
    updateAudioFilePath,
    clearAudioFilePath,
    pasteAudioFilePath,
    selectAudioFile,
    handleAudioFilePathKeyDown,
    handleWorkbenchKeyDown,
    normalizeAudioFilePath: (value: string) => setAudioFilePath(value.trim()),
    resetTranscriptionUi,
  };
};
