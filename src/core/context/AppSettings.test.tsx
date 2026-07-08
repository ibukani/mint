import { invoke } from "@tauri-apps/api/core";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSettings } from "../mocks/mockSettings";
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
      <div data-testid="shortcut-error-clock">
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
  });

  it("loads settings on mount", async () => {
    const mockSettings = createMockSettings();
    vi.mocked(invoke).mockResolvedValue(mockSettings);

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
    vi.useFakeTimers();
    const mockSettings = createMockSettings();
    vi.mocked(invoke).mockResolvedValue(mockSettings);

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
      fireEvent.click(btn);
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
    vi.useRealTimers();
  });

  it("saves important settings (shortcut/theme) immediately", async () => {
    const mockSettings = createMockSettings();
    vi.mocked(invoke).mockResolvedValue(mockSettings);

    render(
      <AppSettingsProvider>
        <TestComponent />
      </AppSettingsProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    // Change theme (important)
    const btn = screen.getByTestId("btn-theme");
    act(() => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith(
        "save_settings",
        expect.objectContaining({
          settings: expect.objectContaining({
            theme: "light",
          }),
        }),
      );
    });
  });

  it("parses registration error and sets shortcut error state", async () => {
    const mockSettings = createMockSettings();
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "save_settings")
        throw new Error("時計ショートカットの登録に失敗しました");
      return undefined;
    });

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
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(screen.getByTestId("shortcut-error-clock")).toHaveTextContent(
        "時計ショートカットの登録に失敗しました",
      );
    });
  });
});
