import { describe, expect, it, vi } from "vitest";
import { defaultAppSettings } from "../../core/defaultSettings";
import { isSupportedAudioFilePath, transcribeAudioRecording } from "./api";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("Voice to Text audio file paths", () => {
  it("accepts supported extensions on Unix and Windows paths", () => {
    expect(isSupportedAudioFilePath("/tmp/interview.M4A")).toBe(true);
    expect(isSupportedAudioFilePath("C:\\Recordings\\voice.WAV")).toBe(true);
  });

  it("rejects unrelated and double-extension files", () => {
    expect(isSupportedAudioFilePath("/tmp/notes.txt")).toBe(false);
    expect(isSupportedAudioFilePath("/tmp/voice.mp3.bak")).toBe(false);
    expect(isSupportedAudioFilePath("/tmp/voice")).toBe(false);
  });

  it("passes recording bytes and the file name to the typed command", async () => {
    invokeMock.mockResolvedValueOnce({ text: "文字起こし結果" });
    const settings = {
      ...defaultAppSettings.voiceToText,
      enabled: true,
    };

    await expect(
      transcribeAudioRecording(settings, [1, 2, 3], "mint-recording.webm"),
    ).resolves.toEqual({ text: "文字起こし結果" });
    expect(invokeMock).toHaveBeenCalledWith("transcribe_audio_recording", {
      settings,
      audio_data: [1, 2, 3],
      file_name: "mint-recording.webm",
    });
  });
});
