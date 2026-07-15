import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { loadApiKey, saveApiKey } from "../../core/settings";
import type { TranscriptionResult, VoiceToTextSettings } from "./types";

export const AUDIO_FILE_EXTENSIONS = [
  "wav",
  "mp3",
  "m4a",
  "aac",
  "flac",
  "ogg",
  "webm",
] as const;

const AUDIO_FILE_FILTER = {
  name: "音声ファイル",
  extensions: [...AUDIO_FILE_EXTENSIONS],
};

export const isSupportedAudioFilePath = (path: string) => {
  const fileName = path.split(/[\\/]/).pop()?.toLocaleLowerCase() ?? "";
  return AUDIO_FILE_EXTENSIONS.some((extension) =>
    fileName.endsWith(`.${extension}`),
  );
};

export const loadVoiceToTextApiKey = () => loadApiKey("voice_to_text");

export const saveVoiceToTextApiKey = (key: string) =>
  saveApiKey("voice_to_text", key);

export const transcribeAudio = (
  settings: VoiceToTextSettings,
  audioFilePath: string,
) =>
  invoke<TranscriptionResult>("transcribe_audio_file", {
    settings,
    audio_file_path: audioFilePath,
  });

export const transcribeAudioRecording = (
  settings: VoiceToTextSettings,
  audioData: number[],
  fileName: string,
) =>
  invoke<TranscriptionResult>("transcribe_audio_recording", {
    settings,
    audio_data: audioData,
    file_name: fileName,
  });

export const chooseAudioFile = () =>
  open({
    title: "文字起こしする音声ファイルを選択",
    multiple: false,
    directory: false,
    filters: [AUDIO_FILE_FILTER],
  });
