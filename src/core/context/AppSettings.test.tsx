import { invoke } from "@tauri-apps/api/core";
import { act, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider, useAppSettings } from "./AppSettings";

// Mock invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const TestComponent: React.FC = () => {
  const { settings, updateSettings, error, shortcutErrors } = useAppSettings();
  if (!settings) return <div>Loading...</div>;
  return (
    <div>
      <div data-testid="theme">{settings.theme}</div>
      <div data-testid="clock-shortcut">{settings.clock.shortcut}</div>
      <div data-testid="clock-fontsize">{settings.clock.fontSize}</div>
      <div data-testid="error">{error || "no-error"}</div>
      <div data-testid="clock-error">
        {shortcutErrors.clock || "no-clock-error"}
      </div>
      <button
        type="button"
        onClick={() => updateSettings({ theme: "light" })}
        data-testid="btn-theme"
      >
        Change Theme
      </button>
      <button
        type="button"
        onClick={() =>
          updateSettings((prev) => ({
            ...prev,
            clock: { ...prev.clock, shortcut: "Ctrl+Alt+X" },
          }))
        }
        data-testid="btn-shortcut"
      >
        Change Shortcut
      </button>
      <button
        type="button"
        onClick={() =>
          updateSettings((prev) => ({
            ...prev,
            clock: { ...prev.clock, fontSize: "2.5rem" },
          }))
        }
        data-testid="btn-fontsize"
      >
        Change FontSize
      </button>
    </div>
  );
};

describe("AppSettingsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it("loads settings on mount", async () => {
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

    render(
      <AppSettingsProvider>
        <TestComponent />
      </AppSettingsProvider>,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await act(async () => {
      await Promise.resolve(); // Flush microtasks
    });

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(invoke).toHaveBeenCalledWith("load_settings");
  });

  it("debounces normal settings save", async () => {
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

    render(
      <AppSettingsProvider>
        <TestComponent />
      </AppSettingsProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    // Change normal setting
    const btn = screen.getByTestId("btn-fontsize");
    act(() => {
      btn.click();
    });

    expect(screen.getByTestId("clock-fontsize")).toHaveTextContent("2.5rem");
    // save_settings should not be called immediately due to debounce
    expect(invoke).not.toHaveBeenCalledWith(
      "save_settings",
      expect.any(Object),
    );

    // Fast-forward time
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(invoke).toHaveBeenCalledWith("save_settings", expect.any(Object));
  });

  it("saves important settings (shortcut/theme) immediately", async () => {
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

    render(
      <AppSettingsProvider>
        <TestComponent />
      </AppSettingsProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    // Change shortcut (important)
    const btn = screen.getByTestId("btn-shortcut");
    act(() => {
      btn.click();
    });

    // Should save immediately
    expect(invoke).toHaveBeenCalledWith("save_settings", expect.any(Object));
  });

  it("parses registration error and sets shortcut error state", async () => {
    vi.useRealTimers();

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
    vi.mocked(invoke).mockImplementation(((cmd: string) => {
      if (cmd === "load_settings") return Promise.resolve(mockSettings);
      if (cmd === "save_settings")
        return Promise.reject(
          new Error("時計ショートカットの登録に失敗しました"),
        );
      return Promise.resolve();
    }) as unknown as typeof invoke);

    render(
      <AppSettingsProvider>
        <TestComponent />
      </AppSettingsProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    const btn = screen.getByTestId("btn-shortcut");
    act(() => {
      btn.click();
    });

    // Wait for the async invoke promise rejection to resolve and catch block to run
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByTestId("error")).toHaveTextContent(
      "設定の保存に失敗しました",
    );
    expect(screen.getByTestId("clock-error")).toHaveTextContent(
      "時計ショートカットの登録に失敗しました",
    );

    vi.useFakeTimers();
  });
});
