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

  it("lets the user retry when settings loading fails", async () => {
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

  it("focuses the first field when switching to a settings tab", async () => {
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
      expect(screen.getByLabelText("表示秒数 (0でトグル表示)")).toHaveFocus();
    });
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
