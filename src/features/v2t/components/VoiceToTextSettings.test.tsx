import { type InvokeArgs, invoke } from "@tauri-apps/api/core";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import type { DragDropEvent } from "@tauri-apps/api/window";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { createMockSettings } from "../../../core/mocks/mockSettings";
import { QUICK_CAPTURE_NOTE_CREATED_EVENT } from "../../quick_capture/events";
import { VoiceToTextSettings } from "./VoiceToTextSettings";

const dialogMocks = vi.hoisted(() => ({ open: vi.fn() }));
const eventMocks = vi.hoisted(() => ({
  emit: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn().mockResolvedValue(() => undefined),
}));
type DropEventHandler = (event: { payload: DragDropEvent }) => void;
const dragDropMocks = vi.hoisted(() => ({
  handler: null as DropEventHandler | null,
}));

const silenceExpectedConsoleError = () =>
  vi.spyOn(console, "error").mockImplementation(() => undefined);

// Mock invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: eventMocks.emit,
  listen: eventMocks.listen,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: dialogMocks.open,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onDragDropEvent: async (handler: DropEventHandler) => {
      dragDropMocks.handler = handler;
      return vi.fn();
    },
  }),
}));

describe("VoiceToTextSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventMocks.emit.mockClear();
    dragDropMocks.handler = null;
    dialogMocks.open.mockResolvedValue(null);
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
        shortcut: "Alt+End",
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
    expect(screen.getByRole("status")).toHaveTextContent(
      "APIキーを保存しました",
    );
  });

  it("shows an error when saving the API key fails", async () => {
    const consoleError = silenceExpectedConsoleError();
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
        baseUrl: "http://api",
        model: "w",
        language: "ja",
        status: "available",
      },
    });

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "save_api_key") throw new Error("keychain unavailable");
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

    const apiKeyInput = screen.getByLabelText("API キー");
    fireEvent.change(apiKeyInput, { target: { value: "new-api-key" } });
    await act(async () => {
      fireEvent.blur(apiKeyInput);
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "APIキーの保存に失敗しました。もう一度お試しください。",
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to save API key:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("toggles API key visibility", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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
    expect(apiKeyInput).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "隠す", pressed: true }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "隠す" }));

    expect(apiKeyInput.type).toBe("password");
  });

  it("pastes the API key from the clipboard", async () => {
    vi.useFakeTimers();
    try {
      const mockSettings = createMockSettings({
        voiceToText: {
          enabled: true,
          shortcut: "Alt+End",
          baseUrl: "http://api",
          model: "w",
          language: "ja",
          status: "available",
        },
      });

      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue("  pasted-api-key  "),
          writeText: vi.fn().mockResolvedValue(undefined),
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

      const apiKeyInput = screen.getByLabelText("API キー") as HTMLInputElement;
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "API キーを貼り付け" }),
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(apiKeyInput).toHaveValue("pasted-api-key");
      expect(apiKeyInput).toHaveFocus();
      expect(apiKeyInput.selectionStart).toBe(0);
      expect(apiKeyInput.selectionEnd).toBe(apiKeyInput.value.length);
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent("API キーを貼り付けました");
      expect(status.closest(".v2t-control-status")).toBeInTheDocument();
      expect(status.closest(".design-row")).toBeNull();

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      expect(
        screen.queryByText("API キーを貼り付けました"),
      ).not.toBeInTheDocument();
      expect(apiKeyInput).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores empty clipboard content when pasting the API key", async () => {
    vi.useFakeTimers();
    try {
      const mockSettings = createMockSettings({
        voiceToText: {
          enabled: true,
          shortcut: "Alt+End",
          baseUrl: "http://api",
          model: "w",
          language: "ja",
          status: "available",
        },
      });

      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue("   "),
          writeText: vi.fn().mockResolvedValue(undefined),
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
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "API キーを貼り付け" }),
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(apiKeyInput).toHaveValue("mocked-api-key");
      expect(apiKeyInput).toHaveFocus();
      expect(screen.getByRole("status")).toHaveTextContent(
        "貼り付ける内容がありません",
      );
      expect(screen.getByRole("status")).toHaveClass(
        "status-toast-label--warning",
      );

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      expect(
        screen.queryByText("貼り付ける内容がありません"),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows an error when the API key cannot be read from the clipboard", async () => {
    const consoleError = silenceExpectedConsoleError();
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
        baseUrl: "http://api",
        model: "w",
        language: "ja",
        status: "available",
      },
    });

    Object.assign(navigator, {
      clipboard: {
        readText: vi.fn().mockRejectedValue(new Error("permission denied")),
        writeText: vi.fn().mockResolvedValue(undefined),
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

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "API キーを貼り付け" }),
      );
      await Promise.resolve();
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "クリップボードから貼り付けられませんでした",
    );
    expect(status).toHaveClass("status-toast-label--error");
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to paste API key:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("transcribes an audio file with the typed backend command", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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

    expect(screen.getByLabelText("文字起こし結果")).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("コピーしました");
  });

  it("saves a transcription result as a quick capture note once", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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
        if (cmd === "transcribe_audio_file") return { text: "保存する議事録" };
        if (cmd === "create_quick_capture_note") {
          expect(args).toEqual({
            input: {
              content: "保存する議事録",
              tags: ["文字起こし"],
              pinned: false,
            },
          });
          return {
            id: "note-1",
            content: "保存する議事録",
            tags: ["文字起こし"],
            pinned: false,
            createdAt: "2026-07-14T12:00:00Z",
            updatedAt: "2026-07-14T12:00:00Z",
            attachments: [],
          };
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

    const saveButton = screen.getByRole("button", {
      name: "クイックキャプチャーに保存",
    });
    await act(async () => {
      fireEvent.click(saveButton);
      await Promise.resolve();
    });

    expect(
      await screen.findByText("クイックキャプチャーに保存しました"),
    ).toBeVisible();
    expect(saveButton).toBeDisabled();
    expect(invoke).toHaveBeenCalledTimes(4);
    expect(eventMocks.emit).toHaveBeenCalledWith(
      QUICK_CAPTURE_NOTE_CREATED_EVENT,
      {
        note: expect.objectContaining({
          content: "保存する議事録",
          tags: ["文字起こし"],
        }),
      },
    );
  });

  it("keeps note saving retryable when quick capture rejects the note", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
        baseUrl: "http://api",
        model: "whisper-1",
        language: "ja",
        status: "available",
      },
    });

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "transcribe_audio_file") return { text: "保存失敗を試す" };
      if (cmd === "create_quick_capture_note") {
        throw new Error("クイックキャプチャーを保存できませんでした");
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

    const saveButton = screen.getByRole("button", {
      name: "クイックキャプチャーに保存",
    });
    fireEvent.click(saveButton);

    expect(
      await screen.findByText("クイックキャプチャーを保存できませんでした"),
    ).toBeVisible();
    expect(saveButton).toBeEnabled();
  });

  it("requires an API key before transcription", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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

  it("blocks transcription when provider settings are invalid", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
        baseUrl: "not a url",
        model: "whisper-1",
        language: "ja",
        status: "available",
      },
    });

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "transcribe_audio_file") {
        throw new Error("transcription should be blocked");
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

    const transcribeButton = screen.getByRole("button", {
      name: "文字起こしを実行",
    });
    expect(transcribeButton).toBeDisabled();
    expect(screen.getByText("API接続")).toBeInTheDocument();
    expect(screen.getByText("設定を確認")).toBeInTheDocument();
    expect(screen.getByText("準備中")).toHaveAttribute("aria-live", "polite");
    expect(
      screen.getByText("有効なAPIエンドポイントURLを入力してください。"),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("API エンドポイント (Base URL)"), {
      target: { value: "https://api.example.com/v1" },
    });

    expect(transcribeButton).toBeEnabled();
    expect(screen.getByText("接続設定済み")).toBeInTheDocument();
  });

  it("focuses the transcription error after a failed request", async () => {
    let transcriptionAttempts = 0;
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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
        transcriptionAttempts += 1;
        if (transcriptionAttempts === 1) {
          throw new Error("文字起こしに失敗しました");
        }
        return { text: "再試行で復旧した結果" };
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
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "再試行" }));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByLabelText("文字起こし結果")).toHaveValue(
        "再試行で復旧した結果",
      );
    });
    expect(transcriptionAttempts).toBe(2);
  });

  it("clears the audio file path from the clear button", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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
    vi.useFakeTimers();
    try {
      const mockSettings = createMockSettings({
        voiceToText: {
          enabled: true,
          shortcut: "Alt+End",
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
        fireEvent.click(
          screen.getByRole("button", { name: "文字起こしを実行" }),
        );
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
      expect(screen.getByLabelText("文字起こし結果")).toHaveFocus();
      expect(screen.getByLabelText("文字起こし結果")).toHaveValue(
        "これはテスト音声です",
      );

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      expect(screen.queryByText("コピーしました")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the copy error message after a short delay", async () => {
    const consoleError = silenceExpectedConsoleError();
    vi.useFakeTimers();
    try {
      const mockSettings = createMockSettings({
        voiceToText: {
          enabled: true,
          shortcut: "Alt+End",
          baseUrl: "http://api",
          model: "whisper-1",
          language: "ja",
          status: "available",
        },
      });

      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error("copy failed")),
          readText: vi.fn().mockResolvedValue(undefined),
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
        fireEvent.click(
          screen.getByRole("button", { name: "文字起こしを実行" }),
        );
        await Promise.resolve();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "結果をコピー" }));
        await Promise.resolve();
      });

      expect(screen.getByText("コピーに失敗しました")).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(
        screen.queryByText("コピーに失敗しました"),
      ).not.toBeInTheDocument();
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to copy transcription text:",
        expect.any(Error),
      );
      consoleError.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears stale transcription output when the audio file path changes", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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

    expect(screen.getByLabelText("文字起こし結果")).toHaveValue(
      "これはテスト音声です",
    );

    fireEvent.change(screen.getByLabelText("音声ファイルパス"), {
      target: { value: "/tmp/audio-2.wav" },
    });

    expect(screen.queryByLabelText("文字起こし結果")).not.toBeInTheDocument();
    expect(screen.queryByText("コピーしました")).not.toBeInTheDocument();
  });

  it("ignores an in-flight transcription result after the source file changes", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
        baseUrl: "http://api",
        model: "whisper-1",
        language: "ja",
        status: "available",
      },
    });
    let resolveTranscription: ((result: { text: string }) => void) | undefined;
    const pendingTranscription = new Promise<{ text: string }>((resolve) => {
      resolveTranscription = resolve;
    });

    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "transcribe_audio_file") return pendingTranscription;
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

    const audioFileInput = screen.getByLabelText("音声ファイルパス");
    fireEvent.change(audioFileInput, { target: { value: "/tmp/old.wav" } });
    fireEvent.click(screen.getByRole("button", { name: "文字起こしを実行" }));
    expect(
      screen.getByRole("button", { name: "文字起こし中..." }),
    ).toBeDisabled();

    fireEvent.change(audioFileInput, { target: { value: "/tmp/new.wav" } });
    expect(
      screen.getByRole("button", { name: "文字起こしを実行" }),
    ).toBeEnabled();

    await act(async () => {
      resolveTranscription?.({ text: "古いファイルの結果" });
      await pendingTranscription;
    });

    expect(screen.queryByLabelText("文字起こし結果")).not.toBeInTheDocument();
    expect(audioFileInput).toHaveValue("/tmp/new.wav");
  });

  it("starts transcription from the audio file field when Enter is pressed", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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

    const audioFileInput = screen.getByLabelText(
      "音声ファイルパス",
    ) as HTMLInputElement;
    fireEvent.change(audioFileInput, {
      target: { value: "  /tmp/audio.wav  " },
    });
    await act(async () => {
      fireEvent.keyDown(audioFileInput, { key: "Enter" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText("文字起こし結果")).toHaveValue(
      "これはテスト音声です",
    );
  });

  it("starts transcription with Ctrl+Enter from the workbench", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
        baseUrl: "http://api",
        model: "whisper-1",
        language: "ja",
        status: "available",
      },
    });
    let transcriptionCalls = 0;
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "load_api_key") return "mocked-api-key";
      if (cmd === "transcribe_audio_file") {
        transcriptionCalls += 1;
        return { text: "ショートカットで実行しました" };
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

    const audioFileInput = screen.getByLabelText("音声ファイルパス");
    fireEvent.change(audioFileInput, { target: { value: "/tmp/audio.wav" } });
    await act(async () => {
      fireEvent.keyDown(audioFileInput, { key: "Enter", ctrlKey: true });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(transcriptionCalls).toBe(1);
    expect(screen.getByLabelText("文字起こし結果")).toHaveValue(
      "ショートカットで実行しました",
    );
    expect(
      screen.getByRole("button", { name: "文字起こしを実行" }),
    ).toHaveAttribute("aria-keyshortcuts", "Control+Enter Meta+Enter");
  });

  it("mentions Enter in the audio file help text", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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

    expect(
      screen.getByText(/Enter でも文字起こしを開始できます。/),
    ).toBeInTheDocument();
    expect(screen.getByText("準備中")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByLabelText("音声ファイルパス")).toHaveAttribute(
      "aria-keyshortcuts",
      "Enter",
    );
  });

  it("pastes the audio file path from the clipboard", async () => {
    vi.useFakeTimers();
    try {
      const mockSettings = createMockSettings({
        voiceToText: {
          enabled: true,
          shortcut: "Alt+End",
          baseUrl: "http://api",
          model: "whisper-1",
          language: "ja",
          status: "available",
        },
      });

      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue("  /tmp/audio.wav  "),
          writeText: vi.fn().mockResolvedValue(undefined),
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
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "音声ファイルパスを貼り付け" }),
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(audioFileInput).toHaveValue("/tmp/audio.wav");
      expect(audioFileInput).toHaveFocus();
      expect(audioFileInput.selectionStart).toBe(0);
      expect(audioFileInput.selectionEnd).toBe(audioFileInput.value.length);
      expect(screen.getByRole("status")).toHaveTextContent(
        "音声ファイルパスを貼り付けました",
      );

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      expect(
        screen.queryByText("音声ファイルパスを貼り付けました"),
      ).not.toBeInTheDocument();
      expect(audioFileInput).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("selects an audio file with the native file picker", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
        baseUrl: "http://api",
        model: "whisper-1",
        language: "ja",
        status: "available",
      },
    });
    dialogMocks.open.mockResolvedValue("/tmp/interview.m4a");
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

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "音声ファイルを選択" }),
      );
      await Promise.resolve();
    });

    expect(dialogMocks.open).toHaveBeenCalledWith({
      title: "文字起こしする音声ファイルを選択",
      multiple: false,
      directory: false,
      filters: [
        {
          name: "音声ファイル",
          extensions: ["wav", "mp3", "m4a", "aac", "flac", "ogg", "webm"],
        },
      ],
    });
    expect(screen.getByLabelText("音声ファイルパス")).toHaveValue(
      "/tmp/interview.m4a",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "音声ファイルを選択しました",
    );
  });

  it("accepts a supported audio file dropped on the transcription workbench", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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
    await waitFor(() => expect(dragDropMocks.handler).not.toBeNull());

    const workbench = screen.getByRole("region", { name: "文字起こし" });
    workbench.getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 0,
          right: 500,
          bottom: 600,
          left: 0,
          width: 500,
          height: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    await act(async () => {
      dragDropMocks.handler?.({
        payload: {
          type: "drop",
          paths: ["/tmp/outside.wav"],
          position: new PhysicalPosition(700, 100),
        },
      });
    });
    expect(screen.getByLabelText("音声ファイルパス")).toHaveValue("");

    await act(async () => {
      dragDropMocks.handler?.({
        payload: {
          type: "enter",
          paths: ["C:\\Recordings\\INTERVIEW.M4A"],
          position: new PhysicalPosition(100, 100),
        },
      });
    });
    expect(workbench).toHaveClass("is-drop-target");

    await act(async () => {
      dragDropMocks.handler?.({
        payload: {
          type: "drop",
          paths: ["C:\\Recordings\\INTERVIEW.M4A"],
          position: new PhysicalPosition(100, 100),
        },
      });
    });

    expect(workbench).not.toHaveClass("is-drop-target");
    expect(screen.getByLabelText("音声ファイルパス")).toHaveValue(
      "C:\\Recordings\\INTERVIEW.M4A",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "音声ファイルをドロップしました",
    );
  });

  it("keeps the current path and explains unsupported dropped files", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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
    await waitFor(() => expect(dragDropMocks.handler).not.toBeNull());

    const input = screen.getByLabelText("音声ファイルパス");
    fireEvent.change(input, { target: { value: "/tmp/current.wav" } });
    const workbench = screen.getByRole("region", { name: "文字起こし" });
    workbench.getBoundingClientRect = vi.fn(
      () =>
        ({
          top: 0,
          right: 500,
          bottom: 600,
          left: 0,
          width: 500,
          height: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    await act(async () => {
      dragDropMocks.handler?.({
        payload: {
          type: "drop",
          paths: ["/tmp/notes.txt"],
          position: new PhysicalPosition(100, 100),
        },
      });
    });

    expect(input).toHaveValue("/tmp/current.wav");
    expect(screen.getByRole("status")).toHaveTextContent(
      "対応していない形式です",
    );
  });

  it("keeps the current file when the picker is cancelled", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
        baseUrl: "http://api",
        model: "whisper-1",
        language: "ja",
        status: "available",
      },
    });
    dialogMocks.open.mockResolvedValue(null);
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
    const input = screen.getByLabelText("音声ファイルパス");
    fireEvent.change(input, { target: { value: "/tmp/current.wav" } });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "音声ファイルを選択" }),
      );
      await Promise.resolve();
    });

    expect(input).toHaveValue("/tmp/current.wav");
  });

  it("ignores empty clipboard content when pasting the audio file path", async () => {
    vi.useFakeTimers();
    try {
      const mockSettings = createMockSettings({
        voiceToText: {
          enabled: true,
          shortcut: "Alt+End",
          baseUrl: "http://api",
          model: "whisper-1",
          language: "ja",
          status: "available",
        },
      });

      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue("   "),
          writeText: vi.fn().mockResolvedValue(undefined),
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
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "音声ファイルパスを貼り付け" }),
        );
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(audioFileInput).toHaveValue("/tmp/audio.wav");
      expect(audioFileInput).toHaveFocus();
      expect(screen.getByRole("status")).toHaveTextContent(
        "貼り付ける内容がありません",
      );

      await act(async () => {
        vi.advanceTimersByTime(2000);
        await Promise.resolve();
      });

      expect(
        screen.queryByText("貼り付ける内容がありません"),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows an error when the audio file path cannot be read from the clipboard", async () => {
    const consoleError = silenceExpectedConsoleError();
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
        baseUrl: "http://api",
        model: "whisper-1",
        language: "ja",
        status: "available",
      },
    });

    Object.assign(navigator, {
      clipboard: {
        readText: vi.fn().mockRejectedValue(new Error("permission denied")),
        writeText: vi.fn().mockResolvedValue(undefined),
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

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "音声ファイルパスを貼り付け" }),
      );
      await Promise.resolve();
    });

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "クリップボードから貼り付けられませんでした",
    );
    expect(status).toHaveClass("status-toast-label--error");
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to paste audio file path:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("trims the audio file path when leaving the field", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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
    fireEvent.change(audioFileInput, {
      target: { value: "  /tmp/audio.wav  " },
    });
    fireEvent.blur(audioFileInput);

    expect(audioFileInput).toHaveValue("/tmp/audio.wav");
  });

  it("clears transcription output when resetting voice-to-text settings", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));
      await Promise.resolve();
    });

    expect(screen.queryByLabelText("文字起こし結果")).not.toBeInTheDocument();
    expect(screen.queryByText("コピーしました")).not.toBeInTheDocument();
    expect(screen.getByLabelText("API キー")).toHaveValue("mocked-api-key");
  });

  it("clears transcription output when voice-to-text settings change", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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

    expect(screen.getByLabelText("文字起こし結果")).toHaveValue(
      "これはテスト音声です",
    );

    fireEvent.change(screen.getByLabelText("モデル名"), {
      target: { value: "gpt-4o-mini-transcribe" },
    });

    expect(screen.queryByLabelText("文字起こし結果")).not.toBeInTheDocument();
    expect(screen.queryByText("コピーしました")).not.toBeInTheDocument();
  });

  it("clears transcription output when the API key changes", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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

    expect(screen.getByLabelText("文字起こし結果")).toHaveValue(
      "これはテスト音声です",
    );

    fireEvent.change(screen.getByLabelText("API キー"), {
      target: { value: "new-api-key" },
    });

    expect(screen.queryByLabelText("文字起こし結果")).not.toBeInTheDocument();
    expect(screen.queryByText("コピーしました")).not.toBeInTheDocument();
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

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));
      await Promise.resolve();
    });

    expect(screen.getByLabelText("音声入力を有効にする")).not.toBeChecked();
    expect(screen.getByLabelText("文字起こしショートカットキー")).toHaveValue(
      "Alt+End",
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
        shortcut: "Alt+End",
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

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "デフォルトに戻す" }));
      await Promise.resolve();
    });

    const shortcutInput = screen.getByLabelText(
      "文字起こしショートカットキー",
    ) as HTMLInputElement;
    expect(shortcutInput).toHaveFocus();
    expect(shortcutInput.selectionStart).toBe(0);
    expect(shortcutInput.selectionEnd).toBe(shortcutInput.value.length);
  });

  it("records shortcut key combination on key down", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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
      "文字起こしショートカットキー",
    ) as HTMLInputElement;

    await act(async () => {
      fireEvent.focus(shortcutInput);
      fireEvent.keyDown(shortcutInput, {
        key: "v",
        ctrlKey: true,
        shiftKey: true,
      });
      await Promise.resolve();
    });

    expect(shortcutInput.value).toBe("Ctrl+Shift+V");
  });

  it("normalizes provider settings when leaving fields", async () => {
    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: true,
        shortcut: "Alt+End",
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
