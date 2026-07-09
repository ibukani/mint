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
    expect(
      screen.getByRole("heading", { name: "mint", level: 1 }),
    ).toBeInTheDocument();
    expect(document.title).toBe("mint - 一般設定");
    expect(screen.getByRole("button", { name: "一般設定" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getAllByText("一般設定").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "一般設定" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "機能管理" })).toBeNull();
    expect(document.querySelector(".settings-save-status")).toBeInTheDocument();
  });

  it("renders ClockOverlay when label=clock", async () => {
    vi.useFakeTimers();
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

      expect(screen.getByText("2026年7月9日(木)")).toBeInTheDocument();
      expect(screen.getByText(/:/)).toBeInTheDocument();
      expect(screen.queryByText("mint")).not.toBeInTheDocument();
      expect(document.title).toBe("mint - 時計オーバーレイ");
      expect(screen.getByText("Esc でも閉じられます。")).toBeInTheDocument();
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

    fireEvent.click(
      screen.getByRole("button", { name: "時計オーバーレイを閉じる" }),
    );

    expect(hide).toHaveBeenCalledTimes(1);
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

    expect(hide).toHaveBeenCalledTimes(1);
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
});
