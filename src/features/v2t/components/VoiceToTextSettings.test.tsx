import { type InvokeArgs, invoke } from "@tauri-apps/api/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { createMockSettings } from "../../../core/mocks/mockSettings";
import { VoiceToTextSettings } from "./VoiceToTextSettings";

// Mock invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("VoiceToTextSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads api key on mount and saves api key on blur", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Ctrl+Alt+V",
        baseUrl: "http://api",
        model: "w",
        language: "ja",
        status: "available",
      },
    });

    vi.mocked(invoke).mockImplementation(
      async (cmd: string, args?: InvokeArgs) => {
        if (cmd === "load_settings") return mockSettings;
        if (
          cmd === "load_api_key" &&
          args &&
          typeof args === "object" &&
          !Array.isArray(args) &&
          "service" in args &&
          args.service === "voice_to_text"
        ) {
          return "mocked-api-key";
        }
        return undefined;
      },
    );

    render(
      <AppSettingsProvider>
        <VoiceToTextSettings />
      </AppSettingsProvider>,
    );

    // Wait for setting load and API key load
    await act(async () => {
      await Promise.resolve(); // Load settings
      await Promise.resolve(); // Load api key
    });

    const apiKeyInput = screen.getByLabelText("API キー") as HTMLInputElement;
    expect(apiKeyInput.value).toBe("mocked-api-key");
    expect(invoke).toHaveBeenCalledWith("load_api_key", {
      service: "voice_to_text",
    });

    // Change value and blur
    fireEvent.change(apiKeyInput, { target: { value: "new-api-key" } });
    await act(async () => {
      fireEvent.blur(apiKeyInput);
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledWith("save_api_key", {
      service: "voice_to_text",
      key: "new-api-key",
    });
  });

  it("transcribes an audio file with the typed backend command", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Ctrl+Alt+V",
        baseUrl: "http://api",
        model: "whisper-1",
        language: "ja",
        status: "available",
      },
    });

    vi.mocked(invoke).mockImplementation(
      async (cmd: string, args?: InvokeArgs) => {
        if (cmd === "load_settings") return mockSettings;
        if (cmd === "load_api_key") return "mocked-api-key";
        if (cmd === "transcribe_audio_file") {
          expect(args).toMatchObject({
            settings: mockSettings.voiceToText,
            audio_file_path: "/tmp/audio.wav",
          });
          return { text: "これはテスト音声です" };
        }
        return undefined;
      },
    );

    render(
      <AppSettingsProvider>
        <VoiceToTextSettings />
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText("音声ファイルパス"), {
      target: { value: "/tmp/audio.wav" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "文字起こしを実行" }));
      await Promise.resolve();
    });

    expect(screen.getByLabelText("文字起こし結果")).toHaveValue(
      "これはテスト音声です",
    );
  });
});
