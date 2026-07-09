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
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
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

  it("toggles API key visibility", async () => {
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

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      return undefined;
    });

    render(
      <AppSettingsProvider>
        <VoiceToTextSettings />
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const apiKeyInput = screen.getByLabelText("API キー") as HTMLInputElement;
    expect(apiKeyInput.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "表示" }));

    expect(apiKeyInput.type).toBe("text");
    expect(
      screen.getByRole("button", { name: "隠す", pressed: true }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "隠す" }));

    expect(apiKeyInput.type).toBe("password");
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
      target: { value: "  /tmp/audio.wav  " },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "文字起こしを実行" }));
      await Promise.resolve();
    });

    expect(screen.getByLabelText("文字起こし結果")).toHaveValue(
      "これはテスト音声です",
    );
    expect(screen.getByLabelText("文字起こし結果")).toHaveFocus();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "結果をコピー" }));
      await Promise.resolve();
    });

    expect(screen.getByRole("button", { name: "結果をコピー" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("コピーしました");
  });

  it("requires an API key before transcription", async () => {
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

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "";
      return undefined;
    });

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

    expect(
      screen.getByRole("button", { name: "文字起こしを実行" }),
    ).toBeDisabled();
    expect(
      screen.getByText("実行するには、APIキーを入力してください。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "文字起こしを実行" }),
    ).toHaveAttribute("aria-describedby");
    expect(
      screen
        .getByRole("button", { name: "文字起こしを実行" })
        .getAttribute("aria-describedby"),
    ).toContain("v2t-transcribe-button-help");
  });

  it("focuses the transcription error after a failed request", async () => {
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

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "transcribe_audio_file") {
        throw new Error("文字起こしに失敗しました");
      }
      return undefined;
    });

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

    expect(screen.getByText("文字起こしに失敗しました")).toHaveFocus();
  });

  it("clears the audio file path from the clear button", async () => {
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

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      return undefined;
    });

    render(
      <AppSettingsProvider>
        <VoiceToTextSettings />
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const audioFileInput = screen.getByLabelText(
      "音声ファイルパス",
    ) as HTMLInputElement;
    fireEvent.change(audioFileInput, { target: { value: "/tmp/audio.wav" } });

    fireEvent.click(screen.getByRole("button", { name: "クリア" }));

    expect(audioFileInput).toHaveValue("");
    expect(audioFileInput).toHaveFocus();
  });

  it("copies and clears transcription results", async () => {
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

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "transcribe_audio_file") {
        return { text: "これはテスト音声です" };
      }
      return undefined;
    });

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

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "結果をコピー" }));
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "これはテスト音声です",
    );
    expect(screen.getByText("コピーしました")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "結果をクリア" }));

    expect(screen.queryByLabelText("文字起こし結果")).not.toBeInTheDocument();
    expect(screen.queryByText("コピーしました")).not.toBeInTheDocument();
    expect(screen.getByLabelText("音声ファイルパス")).toHaveFocus();
  });

  it("clears transcription output when resetting voice-to-text settings", async () => {
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

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "transcribe_audio_file") {
        return { text: "これはテスト音声です" };
      }
      if (cmd === "save_settings") return undefined;
      return undefined;
    });

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

    fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));

    expect(screen.queryByLabelText("文字起こし結果")).not.toBeInTheDocument();
    expect(screen.queryByText("コピーしました")).not.toBeInTheDocument();
    expect(screen.getByLabelText("API キー")).toHaveValue("mocked-api-key");
  });

  it("resets editable voice-to-text settings without clearing the API key", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Ctrl+Shift+R",
        baseUrl: "http://localhost:1234/v1",
        model: "custom-model",
        language: "en",
        status: "available",
      },
    });

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "save_settings") return undefined;
      return undefined;
    });

    render(
      <AppSettingsProvider>
        <VoiceToTextSettings />
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));

    expect(
      screen.getByLabelText("この機能を有効にする (Enable Feature)"),
    ).not.toBeChecked();
    expect(screen.getByLabelText("起動/録音ショートカットキー")).toHaveValue(
      "Ctrl+Alt+V",
    );
    expect(screen.getByLabelText("API エンドポイント (Base URL)")).toHaveValue(
      "https://api.openai.com/v1",
    );
    expect(screen.getByLabelText("モデル名")).toHaveValue("whisper-1");
    expect(screen.getByLabelText("言語コード (Language)")).toHaveValue("ja");
    expect(screen.getByLabelText("API キー")).toHaveValue("mocked-api-key");
  });

  it("returns focus to the shortcut field after resetting voice-to-text settings", async () => {
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

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "save_settings") return undefined;
      return undefined;
    });

    render(
      <AppSettingsProvider>
        <VoiceToTextSettings />
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));

    expect(screen.getByLabelText("起動/録音ショートカットキー")).toHaveFocus();
  });

  it("trims shortcut whitespace when leaving the field", async () => {
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

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "save_settings") return undefined;
      return undefined;
    });

    render(
      <AppSettingsProvider>
        <VoiceToTextSettings />
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const shortcutInput = screen.getByLabelText(
      "起動/録音ショートカットキー",
    ) as HTMLInputElement;

    fireEvent.change(shortcutInput, { target: { value: "  Ctrl+Shift+V  " } });
    fireEvent.blur(shortcutInput);

    expect(shortcutInput.value).toBe("Ctrl+Shift+V");
  });

  it("normalizes provider settings when leaving fields", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Ctrl+Alt+V",
        baseUrl: "https://api.openai.com/v1",
        model: "whisper-1",
        language: "ja",
        status: "available",
      },
    });

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "save_settings") return undefined;
      return undefined;
    });

    render(
      <AppSettingsProvider>
        <VoiceToTextSettings />
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const baseUrlInput = screen.getByLabelText("API エンドポイント (Base URL)");
    const modelInput = screen.getByLabelText("モデル名");
    const languageInput = screen.getByLabelText("言語コード (Language)");

    fireEvent.change(baseUrlInput, {
      target: { value: "  https://api.example.com/v1///  " },
    });
    fireEvent.blur(baseUrlInput);
    fireEvent.change(modelInput, { target: { value: "  whisper-large-v3  " } });
    fireEvent.blur(modelInput);
    fireEvent.change(languageInput, { target: { value: "  EN  " } });
    fireEvent.blur(languageInput);

    expect(baseUrlInput).toHaveValue("https://api.example.com/v1");
    expect(modelInput).toHaveValue("whisper-large-v3");
    expect(languageInput).toHaveValue("en");
  });
});
