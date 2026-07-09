import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createMockSettings } from "./core/mocks/mockSettings";

// Mock invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock getCurrentWindow
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    label: "main",
    hide: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("App Window Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentWindow).mockReturnValue({
      label: "main",
      hide: vi.fn().mockResolvedValue(undefined),
      show: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getCurrentWindow>);
  });

  it("renders settings screen when no query parameter is provided (label is main)", async () => {
    vi.mocked(getCurrentWindow).mockReturnValue({
      label: "main",
      hide: vi.fn().mockResolvedValue(undefined),
      show: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getCurrentWindow>);

    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: false,
        shortcut: "Ctrl+Alt+V",
        baseUrl: "http://api",
        model: "w",
        language: "ja",
        status: "available",
      },
    });
    vi.mocked(invoke).mockResolvedValue(
      mockSettings as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    // Check settings screen structure
    expect(screen.getByText("mint")).toBeInTheDocument();
    expect(document.title).toBe("mint - 一般設定");
    expect(screen.getAllByText("一般設定").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "一般設定" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "機能管理" })).toBeNull();
    expect(document.querySelector(".settings-save-status")).toBeInTheDocument();
  });

  it("renders ClockOverlay when label=clock", async () => {
    vi.mocked(getCurrentWindow).mockReturnValue({
      label: "clock",
      hide: vi.fn().mockResolvedValue(undefined),
      show: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getCurrentWindow>);

    const mockSettings = createMockSettings({
      voiceToText: {
        enabled: false,
        shortcut: "Ctrl+Alt+V",
        baseUrl: "http://api",
        model: "w",
        language: "ja",
        status: "available",
      },
    });
    vi.mocked(invoke).mockResolvedValue(
      mockSettings as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    // colons in formatted time
    const clockCard = screen.getByText(/:/);
    expect(clockCard).toBeInTheDocument();
    expect(screen.queryByText("mint")).not.toBeInTheDocument();
    expect(document.title).toBe("mint - 時計オーバーレイ");
  });

  it("shows feature cards when the dashboard tab is selected", async () => {
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "機能管理" }));

    expect(
      screen.getByRole("heading", { name: "機能管理" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "時計オーバーレイ" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "音声入力" }),
    ).toBeInTheDocument();
  });

  it("focuses the first field when switching to a settings tab", async () => {
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "時計オーバーレイ" }));

    await waitFor(() => {
      expect(screen.getByLabelText("起動ショートカットキー")).toHaveFocus();
    });
  });

  it("returns to the dashboard from a feature settings tab", async () => {
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "時計オーバーレイ" }));
    fireEvent.click(screen.getByRole("button", { name: "機能管理に戻る" }));

    expect(
      screen.getByRole("heading", { name: "機能管理" }),
    ).toBeInTheDocument();
  });

  it("disables voice-to-text dashboard controls when the feature is unavailable", async () => {
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings({
        voiceToText: {
          enabled: false,
          shortcut: "Ctrl+Alt+V",
          baseUrl: "http://api",
          model: "whisper-1",
          language: "ja",
          status: "unavailable",
        },
      }) as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "機能管理" }));

    const voiceToTextCard = screen
      .getByRole("heading", { name: "音声入力" })
      .closest("section");
    expect(voiceToTextCard).not.toBeNull();

    expect(
      within(voiceToTextCard as HTMLElement).getByText(
        "現在は利用できないため、設定は編集できません。",
      ),
    ).toBeInTheDocument();
    expect(
      within(voiceToTextCard as HTMLElement).getByRole("button", {
        name: "詳細設定",
      }),
    ).toBeDisabled();
    expect(
      within(voiceToTextCard as HTMLElement).getByLabelText(
        "この機能を有効にする",
      ),
    ).toBeDisabled();
  });

  it("shows a preparation message when voice-to-text is still pending", async () => {
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings({
        voiceToText: {
          enabled: false,
          shortcut: "Ctrl+Alt+V",
          baseUrl: "http://api",
          model: "whisper-1",
          language: "ja",
          status: "placeholder",
        },
      }) as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "機能管理" }));

    const voiceToTextCard = screen
      .getByRole("heading", { name: "音声入力" })
      .closest("section");
    expect(voiceToTextCard).not.toBeNull();

    expect(
      within(voiceToTextCard as HTMLElement).getByText(
        "準備中のため、設定は編集できません。",
      ),
    ).toBeInTheDocument();
    expect(
      within(voiceToTextCard as HTMLElement).getByRole("button", {
        name: "詳細設定",
      }),
    ).toBeDisabled();
    expect(
      within(voiceToTextCard as HTMLElement).getByRole("button", {
        name: "詳細設定",
      }),
    ).toHaveAttribute("title", "準備中のため、設定は編集できません。");
  });

  it("shows an error badge when the clock shortcut registration fails", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") {
        return createMockSettings();
      }
      if (cmd === "save_settings") {
        throw new Error("時計ショートカットの登録に失敗しました");
      }
      return null;
    });

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "機能管理" }));

    const clockCard = screen
      .getByRole("heading", { name: "時計オーバーレイ" })
      .closest("section");
    expect(clockCard).not.toBeNull();

    const shortcutInput = within(clockCard as HTMLElement).getByLabelText(
      "ショートカットキー",
    );
    fireEvent.change(shortcutInput, {
      target: { value: "Ctrl+Shift+X" },
    });
    fireEvent.blur(shortcutInput);

    await waitFor(() => {
      expect(
        within(clockCard as HTMLElement).getByText("エラー"),
      ).toBeInTheDocument();
    });
  });

  it("saves voice-to-text enabled changes from the dashboard", async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "load_settings") {
        return Promise.resolve(createMockSettings());
      }
      if (cmd === "save_settings") {
        return Promise.resolve();
      }
      return Promise.resolve(null);
    });

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "機能管理" }));
    fireEvent.click(screen.getByLabelText("この機能を有効にする"));

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("save_settings", {
        settings: expect.objectContaining({
          voiceToText: expect.objectContaining({ enabled: true }),
        }),
      });
    });
  });

  it("clamps clock auto-hide seconds from the dashboard", async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "load_settings") {
        return Promise.resolve(createMockSettings());
      }
      if (cmd === "save_settings") {
        return Promise.resolve();
      }
      return Promise.resolve(null);
    });

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "機能管理" }));

    const clockCard = screen
      .getByRole("heading", { name: "時計オーバーレイ" })
      .closest("section");
    expect(clockCard).not.toBeNull();

    fireEvent.change(
      within(clockCard as HTMLElement).getByLabelText("表示秒数"),
      {
        target: { value: "999" },
      },
    );

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("save_settings", {
        settings: expect.objectContaining({
          clock: expect.objectContaining({ autoHideSeconds: 60 }),
        }),
      });
    });
  });

  it("trims dashboard shortcut whitespace before saving", async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "load_settings") {
        return Promise.resolve(createMockSettings());
      }
      if (cmd === "save_settings") {
        return Promise.resolve();
      }
      return Promise.resolve(null);
    });

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "機能管理" }));

    const clockCard = screen
      .getByRole("heading", { name: "時計オーバーレイ" })
      .closest("section");
    expect(clockCard).not.toBeNull();

    const shortcutInput = within(clockCard as HTMLElement).getByLabelText(
      "ショートカットキー",
    );
    fireEvent.change(shortcutInput, {
      target: { value: "  Ctrl+Shift+C  " },
    });
    fireEvent.blur(shortcutInput);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("save_settings", {
        settings: expect.objectContaining({
          clock: expect.objectContaining({ shortcut: "Ctrl+Shift+C" }),
        }),
      });
    });
  });

  it("normalizes dashboard voice-to-text model and language before saving", async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "load_settings") {
        return Promise.resolve(createMockSettings());
      }
      if (cmd === "save_settings") {
        return Promise.resolve();
      }
      return Promise.resolve(null);
    });

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "機能管理" }));

    const voiceToTextCard = screen
      .getByRole("heading", { name: "音声入力" })
      .closest("section");
    expect(voiceToTextCard).not.toBeNull();

    const modelInput = within(voiceToTextCard as HTMLElement).getByLabelText(
      "モデル名",
    );
    const languageInput = within(voiceToTextCard as HTMLElement).getByLabelText(
      "言語コード",
    );

    fireEvent.change(modelInput, {
      target: { value: "  whisper-large-v3  " },
    });
    fireEvent.blur(modelInput);
    fireEvent.change(languageInput, {
      target: { value: "  EN  " },
    });
    fireEvent.blur(languageInput);

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("save_settings", {
        settings: expect.objectContaining({
          voiceToText: expect.objectContaining({
            model: "whisper-large-v3",
            language: "en",
          }),
        }),
      });
    });
  });

  it("shows shortcut errors inside the matching dashboard card", async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === "load_settings") {
        return Promise.resolve(createMockSettings());
      }
      if (cmd === "save_settings") {
        return Promise.reject(
          JSON.stringify({
            type: "duplicateShortcut",
            features: ["clock"],
          }),
        );
      }
      return Promise.resolve(null);
    });

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "機能管理" }));

    const clockCard = screen
      .getByRole("heading", { name: "時計オーバーレイ" })
      .closest("section");
    expect(clockCard).not.toBeNull();

    fireEvent.change(
      within(clockCard as HTMLElement).getByLabelText("ショートカットキー"),
      {
        target: { value: "Ctrl+Alt+V" },
      },
    );

    await waitFor(() => {
      expect(
        within(clockCard as HTMLElement).getByText(
          "ショートカットキーが重複しています",
        ),
      ).toBeInTheDocument();
    });
  });

  it("opens feature detail settings from dashboard cards", async () => {
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("button", { name: "機能管理" }));

    const clockCard = screen
      .getByRole("heading", { name: "時計オーバーレイ" })
      .closest("section");
    expect(clockCard).not.toBeNull();
    fireEvent.click(
      within(clockCard as HTMLElement).getByRole("button", {
        name: "詳細設定",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "時計オーバーレイ設定" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "機能管理" }));
    const voiceToTextCard = screen
      .getByRole("heading", { name: "音声入力" })
      .closest("section");
    expect(voiceToTextCard).not.toBeNull();
    fireEvent.click(
      within(voiceToTextCard as HTMLElement).getByRole("button", {
        name: "詳細設定",
      }),
    );

    expect(
      screen.getByRole("heading", { name: "音声入力 (Voice to Text) 設定" }),
    ).toBeInTheDocument();
  });
});
