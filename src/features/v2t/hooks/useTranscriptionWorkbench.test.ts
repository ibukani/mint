import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultAppSettings } from "../../../core/defaultSettings";
import type { VoiceToTextSettings } from "../types";
import { useTranscriptionWorkbench } from "./useTranscriptionWorkbench";

const apiMocks = vi.hoisted(() => ({
  transcribeRecording: vi.fn(),
}));

vi.mock("../api", () => ({
  chooseAudioFile: vi.fn(),
  isSupportedAudioFilePath: vi.fn(() => true),
  transcribeAudio: vi.fn(),
  transcribeAudioRecording: apiMocks.transcribeRecording,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onDragDropEvent: vi.fn(async () => vi.fn()),
  }),
}));

const createSettings = (): VoiceToTextSettings => ({
  ...defaultAppSettings.voiceToText,
  enabled: true,
  baseUrl: "https://api.example.com/v1",
  model: "whisper-1",
});

describe("useTranscriptionWorkbench microphone recording", () => {
  let getUserMedia: ReturnType<typeof vi.fn>;
  let stopTrack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.transcribeRecording.mockResolvedValue({ text: "録音した結果" });
    stopTrack = vi.fn();
    getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: stopTrack }],
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    class FakeMediaRecorder {
      static isTypeSupported = () => true;
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;

      constructor(_stream: unknown, options?: { mimeType?: string }) {
        this.mimeType = options?.mimeType ?? this.mimeType;
      }

      start() {
        this.state = "recording";
        this.ondataavailable?.({
          data: new Blob(["sample audio"], { type: this.mimeType }),
        });
      }

      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    }

    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records from the microphone, releases the stream, and transcribes the clip", async () => {
    const { result, unmount } = renderHook(() =>
      useTranscriptionWorkbench({
        settings: createSettings(),
        apiKey: "test-api-key",
        apiKeyLoaded: true,
        clearApiKeyPasteStatus: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startRecording();
    });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.current.recording).toBe(true);

    act(() => result.current.stopRecording());

    await waitFor(() => {
      expect(apiMocks.transcribeRecording).toHaveBeenCalledWith(
        createSettings(),
        expect.any(Array),
        "mint-recording.webm",
      );
      expect(result.current.transcriptionText).toBe("録音した結果");
    });
    expect(result.current.recording).toBe(false);
    expect(stopTrack).toHaveBeenCalledOnce();

    unmount();
  });

  it("explains a microphone permission failure", async () => {
    getUserMedia.mockRejectedValueOnce(
      new DOMException("permission denied", "NotAllowedError"),
    );
    const { result } = renderHook(() =>
      useTranscriptionWorkbench({
        settings: createSettings(),
        apiKey: "test-api-key",
        apiKeyLoaded: true,
        clearApiKeyPasteStatus: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.transcriptionError).toContain(
      "マイクへのアクセスが拒否されました",
    );
  });

  it("keeps a failed recording available for retry", async () => {
    apiMocks.transcribeRecording
      .mockRejectedValueOnce(new Error("temporarily unavailable"))
      .mockResolvedValueOnce({ text: "再試行後の結果" });
    const { result } = renderHook(() =>
      useTranscriptionWorkbench({
        settings: createSettings(),
        apiKey: "test-api-key",
        apiKeyLoaded: true,
        clearApiKeyPasteStatus: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.startRecording();
    });
    act(() => result.current.stopRecording());

    await waitFor(() => {
      expect(result.current.transcriptionError).toBe("temporarily unavailable");
      expect(result.current.canRetryTranscription).toBe(true);
    });

    await act(async () => {
      await result.current.retryTranscription();
    });

    expect(result.current.transcriptionText).toBe("再試行後の結果");
    expect(result.current.transcriptionError).toBe("");
    expect(apiMocks.transcribeRecording).toHaveBeenCalledTimes(2);
  });
});
