import { useCallback, useEffect, useRef, useState } from "react";

const MAX_RECORDING_SECONDS = 5 * 60;
const RECORDER_TIMESLICE_MS = 1000;
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

interface UseAudioRecorderOptions {
  canRecord: boolean;
  onStart: () => void;
  onRecordingReady: (audioBlob: Blob, fileName: string) => void;
  onError: (message: string) => void;
}

export const useAudioRecorder = ({
  canRecord,
  onStart,
  onRecordingReady,
  onError,
}: UseAudioRecorderOptions) => {
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingDiscardedRef = useRef(false);

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

  const startRecording = useCallback(async () => {
    if (recordingRef.current || !canRecord) return;
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      onError("この環境ではマイク録音を利用できません。");
      return;
    }

    onStart();
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
        onError("マイク録音に失敗しました。権限を確認してください。");
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
          onRecordingReady(
            audioBlob,
            recordingFileName(recorder.mimeType || mimeType),
          );
        }
      };
      recorder.start(RECORDER_TIMESLICE_MS);
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
      onError(
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "マイクへのアクセスが拒否されました。OSのマイク権限を確認してください。"
          : "マイクを開始できませんでした。入力デバイスと権限を確認してください。",
      );
    }
  }, [
    canRecord,
    onError,
    onRecordingReady,
    onStart,
    releaseRecordingResources,
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

  return {
    discardRecording,
    recording,
    recordingSeconds,
    startRecording,
    stopRecording,
  };
};
