import { describe, expect, it } from "vitest";
import { isSupportedAudioFilePath } from "./api";

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
});
