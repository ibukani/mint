import { emit } from "@tauri-apps/api/event";
import { useCallback, useRef, useState } from "react";
import { createQuickCaptureNote } from "../../quick_capture/api";
import { QUICK_CAPTURE_NOTE_CREATED_EVENT } from "../../quick_capture/events";
import { transcribeAudio, transcribeAudioRecording } from "../api";
import { focusAndSelect } from "../focus";
import {
  validateBaseUrl,
  validateLanguageCode,
  validateModelName,
} from "../settings";
import type { StatusTone, VoiceToTextSettings } from "../types";
import { useAudioRecorder } from "./useAudioRecorder";
import { useTransientStatus } from "./useTransientStatus";

const STATUS_VISIBLE_MS = 2000;
const COPY_ERROR_VISIBLE_MS = 5000;

type TranscriptionRetry =
  | { type: "file" }
  | { type: "recording"; audioBlob: Blob; fileName: string };

interface TranscriptionActionsOptions {
  settings: VoiceToTextSettings;
  apiKey: string;
  apiKeyLoaded: boolean;
  audioFilePath: string;
  clearApiKeyPasteStatus: () => void;
  setAudioFilePasteStatus: (status: string, tone?: StatusTone) => void;
}

const getCopyStatusDuration = (status: string) =>
  status === "コピーしました" ? STATUS_VISIBLE_MS : COPY_ERROR_VISIBLE_MS;

export const useTranscriptionActions = ({
  settings,
  apiKey,
  apiKeyLoaded,
  audioFilePath,
  clearApiKeyPasteStatus,
  setAudioFilePasteStatus,
}: TranscriptionActionsOptions) => {
  const [transcriptionText, setTranscriptionText] = useState("");
  const [transcriptionError, setTranscriptionError] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const transcriptionAttemptRef = useRef(0);
  const transcribingRef = useRef(false);
  const transcriptionRetryRef = useRef<TranscriptionRetry | null>(null);
  const saveNoteAttemptRef = useRef(0);
  const saveNoteInFlightRef = useRef(false);
  const [savingNote, setSavingNote] = useState(false);
  const [transcriptionSaved, setTranscriptionSaved] = useState(false);
  const [copyStatus, setCopyStatus, copyTone] = useTransientStatus(
    getCopyStatusDuration,
  );
  const [saveNoteStatus, setSaveNoteStatus, saveNoteTone] = useTransientStatus(
    getCopyStatusDuration,
  );

  const clearTranscriptionOutput = useCallback(() => {
    transcriptionAttemptRef.current += 1;
    saveNoteAttemptRef.current += 1;
    saveNoteInFlightRef.current = false;
    transcribingRef.current = false;
    transcriptionRetryRef.current = null;
    setTranscribing(false);
    setSavingNote(false);
    setTranscriptionText("");
    setTranscriptionError("");
    setTranscriptionSaved(false);
    setCopyStatus("");
    setSaveNoteStatus("");
  }, [setCopyStatus, setSaveNoteStatus]);

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
    saveNoteAttemptRef.current += 1;
    saveNoteInFlightRef.current = false;
    setSavingNote(false);
    setTranscriptionSaved(false);
    setCopyStatus("");
    setSaveNoteStatus("");
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
    setSaveNoteStatus,
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
      saveNoteAttemptRef.current += 1;
      saveNoteInFlightRef.current = false;
      setSavingNote(false);
      setTranscriptionSaved(false);
      setCopyStatus("");
      setSaveNoteStatus("");
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
    [
      clearApiKeyPasteStatus,
      setAudioFilePasteStatus,
      setCopyStatus,
      setSaveNoteStatus,
      settings,
    ],
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

  const recorder = useAudioRecorder({
    canRecord,
    onStart: () => {
      clearTranscriptionOutput();
      setTranscriptionError("");
      setAudioFilePasteStatus("");
    },
    onRecordingReady: (audioBlob, fileName) => {
      void transcribeRecordedAudio(audioBlob, fileName);
    },
    onError: setTranscriptionError,
  });

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

  const saveTranscriptionAsNote = useCallback(async () => {
    if (
      !transcriptionText ||
      transcriptionSaved ||
      saveNoteInFlightRef.current
    ) {
      return;
    }

    const attempt = saveNoteAttemptRef.current + 1;
    saveNoteAttemptRef.current = attempt;
    saveNoteInFlightRef.current = true;
    setSavingNote(true);
    setSaveNoteStatus("");

    try {
      const createdNote = await createQuickCaptureNote({
        content: transcriptionText,
        tags: ["文字起こし"],
        pinned: false,
      });
      void emit(QUICK_CAPTURE_NOTE_CREATED_EVENT, { note: createdNote }).catch(
        (error) => {
          console.warn("Failed to notify quick capture note creation", error);
        },
      );
      if (attempt !== saveNoteAttemptRef.current) return;
      setTranscriptionSaved(true);
      setSaveNoteStatus("クイックキャプチャーに保存しました");
    } catch (error) {
      if (attempt !== saveNoteAttemptRef.current) return;
      setSaveNoteStatus(
        error instanceof Error
          ? error.message
          : "クイックキャプチャーへの保存に失敗しました",
        "error",
      );
    } finally {
      if (attempt === saveNoteAttemptRef.current) {
        saveNoteInFlightRef.current = false;
        setSavingNote(false);
      }
    }
  }, [setSaveNoteStatus, transcriptionSaved, transcriptionText]);

  return {
    canRecord,
    canRetryTranscription,
    canTranscribe,
    configurationError,
    copyStatus,
    copyTone,
    copyTranscriptionText,
    clearTranscriptionOutput,
    discardRecording: recorder.discardRecording,
    recording: recorder.recording,
    recordingSeconds: recorder.recordingSeconds,
    saveNoteStatus,
    saveNoteTone,
    saveTranscriptionAsNote,
    savingNote,
    startRecording: recorder.startRecording,
    stopRecording: recorder.stopRecording,
    transcribeAudioFile,
    transcribing,
    transcriptionError,
    transcriptionSaved,
    transcriptionText,
    retryTranscription,
  };
};
