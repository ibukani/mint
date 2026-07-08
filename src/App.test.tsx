import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

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
  });

  it("renders settings screen when no query parameter is provided (label is main)", async () => {
    vi.mocked(getCurrentWindow).mockReturnValue({
      label: "main",
      hide: vi.fn().mockResolvedValue(undefined),
      show: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getCurrentWindow>);

    const mockSettings = {
      theme: "dark",
      clock: { shortcut: "Ctrl+Alt+C", autoHideSeconds: 3, fontSize: "1.5rem" },
      voiceToText: {
        shortcut: "Ctrl+Alt+V",
        baseUrl: "http://api",
        model: "w",
        language: "ja",
      },
    };
    vi.mocked(invoke).mockResolvedValue(
      mockSettings as unknown as ReturnType<typeof invoke>,
    );

    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    // Check settings screen structure
    expect(screen.getByText("mint")).toBeInTheDocument();
    expect(screen.getAllByText("一般設定").length).toBeGreaterThan(0);
  });

  it("renders ClockOverlay when label=clock", async () => {
    vi.mocked(getCurrentWindow).mockReturnValue({
      label: "clock",
      hide: vi.fn().mockResolvedValue(undefined),
      show: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getCurrentWindow>);

    const mockSettings = {
      theme: "dark",
      clock: { shortcut: "Ctrl+Alt+C", autoHideSeconds: 3, fontSize: "1.5rem" },
      voiceToText: {
        shortcut: "Ctrl+Alt+V",
        baseUrl: "http://api",
        model: "w",
        language: "ja",
      },
    };
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
  });
});
