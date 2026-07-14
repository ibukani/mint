import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { createMockSettings } from "./core/mocks/mockSettings";

const silenceExpectedConsoleError = () =>
  vi.spyOn(console, "error").mockImplementation(() => undefined);

const eventMocks = vi.hoisted(() => ({
  listeners: new Map<string, () => void | Promise<void>>(),
}));

// Mock invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, handler: () => void | Promise<void>) => {
    eventMocks.listeners.set(event, handler);
    return () => eventMocks.listeners.delete(event);
  }),
}));

// Mock getCurrentWindow
vi.mock("@tauri-apps/api/window", () => ({
  Window: {
    getByLabel: vi.fn().mockResolvedValue(null),
  },
  getCurrentWindow: vi.fn(() => ({
    label: "main",
    hide: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    setSize: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
  })),
  currentMonitor: vi.fn().mockResolvedValue({
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
  }),
}));

describe("App Window Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventMocks.listeners.clear();
    window.localStorage.clear();
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
        shortcut: "Alt+End",
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
    expect(
      screen.getByRole("heading", { name: "mint", level: 1 }),
    ).toBeInTheDocument();
    expect(document.title).toBe("mint - 一般設定");
    expect(screen.getByRole("button", { name: "一般設定" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("button", { name: "一般設定" }),
    ).toHaveAccessibleDescription("テーマと起動操作");
    expect(screen.getAllByText("一般設定").length).toBeGreaterThan(0);
    expect(
      await screen.findByRole("heading", { name: "一般設定" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "機能管理" })).toBeNull();
    expect(document.querySelector(".settings-save-status")).toBeInTheDocument();
  });

  it("announces the loading state while settings are being fetched", () => {
    vi.mocked(invoke).mockReturnValue(new Promise(() => {}) as never);

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("設定を読み込み中...");
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("opens a new event editor for today from the quick launcher", async () => {
    const settings = createMockSettings();
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === "load_settings") return settings;
      if (command === "open_calendar_editor_window") return undefined;
      return undefined;
    });

    render(<App />);
    await screen.findByRole("heading", { name: "一般設定" });

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = screen.getByRole("combobox", {
      name: "設定や項目、操作を検索",
    });
    fireEvent.change(searchInput, { target: { value: "今日の予定" } });
    expect(screen.getByRole("option")).toHaveTextContent("今日の予定を追加");
    fireEvent.keyDown(searchInput, { key: "Enter" });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("open_calendar_editor_window", {
        payload: {
          mode: "create",
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        },
      });
    });
  });

  it("lets the user retry when settings loading fails", async () => {
    const consoleError = silenceExpectedConsoleError();
    const mockSettings = createMockSettings();
    vi.mocked(invoke)
      .mockRejectedValueOnce(new Error("settings unavailable"))
      .mockResolvedValue(mockSettings as unknown as ReturnType<typeof invoke>);

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "設定を読み込めませんでした",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("設定の読み込みに失敗しました")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));

    await screen.findByRole("heading", { name: "一般設定" });
    expect(
      screen.queryByRole("heading", { name: "設定を読み込めませんでした" }),
    ).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to load settings:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("keeps a single retry action for settings save failures", async () => {
    const consoleError = silenceExpectedConsoleError();
    const mockSettings = createMockSettings({ theme: "dark" });
    vi.mocked(invoke).mockImplementation(async (command: string) => {
      if (command === "load_settings") return mockSettings;
      if (command === "save_settings") {
        throw new Error("settings storage unavailable");
      }
      return undefined;
    });

    render(<App />);

    await screen.findByRole("heading", { name: "一般設定" });
    fireEvent.click(screen.getByRole("radio", { name: "ライト" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "設定の保存に失敗しました",
    );
    expect(screen.getAllByRole("button", { name: "再試行" })).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: "もう一度保存" }),
    ).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to save settings:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("renders ClockOverlay when label=clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-07-09T12:34:56+09:00"));
      vi.mocked(getCurrentWindow).mockReturnValue({
        label: "clock",
        hide: vi.fn().mockResolvedValue(undefined),
        show: vi.fn().mockResolvedValue(undefined),
      } as unknown as ReturnType<typeof getCurrentWindow>);

      const mockSettings = createMockSettings({
        voiceToText: {
          enabled: false,
          shortcut: "Alt+End",
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

      await waitFor(() => {
        expect(
          document.querySelector(".digital-clock__date"),
        ).toHaveTextContent("2026年7月9日");
      });
      expect(screen.getByText("木曜日")).toBeInTheDocument();
      expect(screen.getByText(/:/)).toBeInTheDocument();
      expect(screen.queryByText("mint")).not.toBeInTheDocument();
      expect(document.title).toBe("mint - 時計オーバーレイ");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders CalendarOverlay when label=calendar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(2026, 6, 10, 9, 0, 0));
      vi.mocked(getCurrentWindow).mockReturnValue({
        label: "calendar",
        hide: vi.fn().mockResolvedValue(undefined),
        show: vi.fn().mockResolvedValue(undefined),
        setPosition: vi.fn().mockResolvedValue(undefined),
        setSize: vi.fn().mockResolvedValue(undefined),
      } as unknown as ReturnType<typeof getCurrentWindow>);
      const settings = createMockSettings();
      vi.mocked(invoke).mockImplementation(async (command: string) => {
        if (command === "load_settings") return settings;
        if (command === "get_google_calendar_connection") {
          return {
            connected: false,
            accountEmail: "",
            lastSyncedAt: null,
            pendingOperations: 0,
            error: null,
            syncing: false,
          };
        }
        if (command === "list_calendar_events") return [];
        if (command === "get_next_calendar_event") return null;
        return undefined;
      });

      render(<App />);

      expect(
        await screen.findByRole("dialog", {
          name: "カレンダーオーバーレイ",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "2026年 7月" }),
      ).toBeInTheDocument();
      expect(document.title).toBe("mint - カレンダーオーバーレイ");
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides the clock overlay from the close button", async () => {
    const hide = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getCurrentWindow).mockReturnValue({
      label: "clock",
      hide,
      show: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getCurrentWindow>);

    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    const closeBtn = await screen.findByRole("button", {
      name: "時計オーバーレイを閉じる",
    });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(hide).toHaveBeenCalledTimes(1);
    });
  });

  it("hides the clock overlay with Escape", async () => {
    const hide = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getCurrentWindow).mockReturnValue({
      label: "clock",
      hide,
      show: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getCurrentWindow>);

    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(hide).toHaveBeenCalledTimes(1);
    });
  });

  it("focuses the page heading when switching to a settings tab", async () => {
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    await screen.findByRole("heading", { name: "一般設定" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "時計オーバーレイ" }));
    });

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "時計オーバーレイ設定" }),
      ).toHaveFocus();
    });
  });

  it("switches settings tabs with Ctrl+number shortcuts", async () => {
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);
    await screen.findByRole("heading", { name: "一般設定" });

    const calendarTab = screen.getByRole("button", { name: "カレンダー" });
    const shortcut = calendarTab.getAttribute("aria-keyshortcuts") ?? "";
    const shortcutNumber = shortcut.match(/Control\+(\d+)/)?.[1];
    expect(shortcutNumber).toBeDefined();
    if (!shortcutNumber) return;
    fireEvent.keyDown(window, { key: shortcutNumber, ctrlKey: true });

    expect(
      await screen.findByRole("heading", { name: "カレンダー設定" }),
    ).toBeInTheDocument();
    expect(calendarTab).toHaveAttribute("aria-current", "page");
    expect(shortcut).toContain(`Control+${shortcutNumber}`);
  });

  it("opens the transcription workflow and focuses its file field from the global shortcut event", async () => {
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);
    await screen.findByRole("heading", { name: "一般設定" });
    await waitFor(() => {
      expect(eventMocks.listeners.has("voice-to-text-shortcut")).toBe(true);
    });

    await act(async () => {
      await eventMocks.listeners.get("voice-to-text-shortcut")?.();
    });

    expect(
      await screen.findByRole("heading", { name: "音声入力設定" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText("音声ファイルパス")).toHaveFocus();
    });
    expect(screen.getByRole("button", { name: "音声入力" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not steal Ctrl+number from an editable control", async () => {
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);
    await screen.findByRole("heading", { name: "一般設定" });

    const themeRadio = screen.getByRole("radio", { name: "ダーク" });
    themeRadio.focus();
    fireEvent.keyDown(themeRadio, { key: "4", ctrlKey: true });

    expect(
      screen.queryByRole("heading", { name: "時計オーバーレイ設定" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "一般設定" })).toBeVisible();
  });

  it("restores the last selected settings tab", async () => {
    window.localStorage.setItem("mint.active-settings-tab", "clock");
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await screen.findByRole("heading", { name: "時計オーバーレイ設定" });

    expect(
      screen.getByRole("button", { name: "時計オーバーレイ" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("prefers an explicit tab query over the restored tab", async () => {
    window.localStorage.setItem("mint.active-settings-tab", "clock");
    window.history.pushState({}, "", "?tab=voiceToText");
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await screen.findByRole("heading", { name: "音声入力設定" });

    expect(screen.getByRole("button", { name: "音声入力" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    window.history.pushState({}, "", "/");
  });

  it("adds is-overlay class to body and html elements when clock overlay is rendered", async () => {
    vi.mocked(getCurrentWindow).mockReturnValue({
      label: "clock",
      hide: vi.fn().mockResolvedValue(undefined),
      show: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getCurrentWindow>);

    vi.mocked(invoke).mockResolvedValue(
      createMockSettings() as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(document.body.classList.contains("is-overlay")).toBe(true);
    });
    expect(document.documentElement.classList.contains("is-overlay")).toBe(
      true,
    );
  });
});
