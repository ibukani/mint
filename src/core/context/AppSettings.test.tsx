import { invoke } from "@tauri-apps/api/core";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSettings } from "../mocks/mockSettings";
import { AppSettingsProvider, useAppSettings } from "./AppSettings";

// Mock invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  listeners: new Map<string, () => void | Promise<void>>(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, handler: () => void | Promise<void>) => {
    eventMocks.listeners.set(event, handler);
    return () => eventMocks.listeners.delete(event);
  }),
}));

const TestComponent: React.FC = () => {
  const {
    settings,
    updateSettings,
    error,
    saveStatus,
    shortcutErrors,
    retrySaveSettings,
  } = useAppSettings();
  if (!settings) return <div>Loading...</div>;
  return (
    <div>
      <div data-testid="theme">{settings.theme}</div>
      <div data-testid="clock-shortcut">{settings.clock.shortcut}</div>
      <div data-testid="clock-showdate">{String(settings.clock.showDate)}</div>
      <div data-testid="error">{error || "no-error"}</div>
      <div data-testid="save-status">{saveStatus}</div>
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
            clock: { ...prev.clock, showDate: !prev.clock.showDate },
          }))
        }
        data-testid="btn-showdate"
      >
        Toggle ShowDate
      </button>
      <button type="button" onClick={() => void retrySaveSettings()}>
        Retry Save
      </button>
    </div>
  );
};

describe("AppSettingsProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventMocks.listeners.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(screen.getByTestId("clock-showdate")).toHaveTextContent("true");
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
    const btn = screen.getByTestId("btn-showdate");
    act(() => {
      fireEvent.click(btn);
    });

    expect(screen.getByTestId("clock-showdate")).toHaveTextContent("false");
    expect(screen.getByTestId("save-status")).toHaveTextContent("pending");
    // save_settings should not be called immediately due to debounce
    expect(invoke).not.toHaveBeenCalledWith(
      "save_settings",
      expect.any(Object),
    );

    // Fast-forward time
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledWith("save_settings", expect.any(Object));
    expect(screen.getByTestId("save-status")).toHaveTextContent("saved");
  });

  it("saves date visibility changes", async () => {
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

    act(() => {
      fireEvent.click(screen.getByTestId("btn-showdate"));
    });

    expect(screen.getByTestId("clock-showdate")).toHaveTextContent("false");

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledWith(
      "save_settings",
      expect.objectContaining({
        settings: expect.objectContaining({
          clock: expect.objectContaining({
            showDate: false,
          }),
        }),
      }),
    );
  });

  it("serializes immediate saves so an older request cannot finish last", async () => {
    const mockSettings = createMockSettings();
    let resolveFirstSave: (() => void) | undefined;
    const firstSave = new Promise<void>((resolve) => {
      resolveFirstSave = resolve;
    });
    let saveCalls = 0;
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === "load_settings") return Promise.resolve(mockSettings);
      if (cmd === "save_settings") {
        saveCalls += 1;
        return saveCalls === 1 ? firstSave : Promise.resolve();
      }
      return Promise.resolve(undefined);
    });

    render(
      <AppSettingsProvider>
        <TestComponent />
      </AppSettingsProvider>,
    );
    await act(async () => Promise.resolve());

    fireEvent.click(screen.getByTestId("btn-theme"));
    fireEvent.click(screen.getByTestId("btn-shortcut"));

    await waitFor(() => expect(saveCalls).toBe(1));
    expect(invoke).toHaveBeenCalledWith(
      "save_settings",
      expect.objectContaining({
        settings: expect.objectContaining({ theme: "light" }),
      }),
    );

    await act(async () => {
      resolveFirstSave?.();
      await firstSave;
    });

    await waitFor(() => expect(saveCalls).toBe(2));
    expect(invoke).toHaveBeenLastCalledWith(
      "save_settings",
      expect.objectContaining({
        settings: expect.objectContaining({
          theme: "light",
          clock: expect.objectContaining({ shortcut: "Ctrl+Alt+X" }),
        }),
      }),
    );
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
    await waitFor(() => {
      expect(screen.getByTestId("save-status")).toHaveTextContent("saved");
    });
  });

  it("clears the saved status after a short delay", async () => {
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

    act(() => {
      fireEvent.click(screen.getByTestId("btn-theme"));
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("save-status")).toHaveTextContent("saved");

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(screen.getByTestId("save-status")).toHaveTextContent("idle");
  });

  it("keeps the error status visible until the failed save is resolved", async () => {
    vi.useFakeTimers();
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

    act(() => {
      fireEvent.click(screen.getByTestId("btn-theme"));
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("save-status")).toHaveTextContent("error");

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("save-status")).toHaveTextContent("error");
  });

  it("retries the exact failed settings and clears the error on success", async () => {
    const mockSettings = createMockSettings();
    let saveAttempts = 0;
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "save_settings") {
        saveAttempts += 1;
        if (saveAttempts === 1) throw new Error("temporary write failure");
        return undefined;
      }
      return undefined;
    });

    render(
      <AppSettingsProvider>
        <TestComponent />
      </AppSettingsProvider>,
    );
    await act(async () => Promise.resolve());

    fireEvent.click(screen.getByTestId("btn-theme"));
    await waitFor(() =>
      expect(screen.getByTestId("save-status")).toHaveTextContent("error"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry Save" }));

    await waitFor(() =>
      expect(screen.getByTestId("save-status")).toHaveTextContent("saved"),
    );
    expect(screen.getByTestId("error")).toHaveTextContent("no-error");
    expect(invoke).toHaveBeenLastCalledWith(
      "save_settings",
      expect.objectContaining({
        settings: expect.objectContaining({ theme: "light" }),
      }),
    );
    expect(saveAttempts).toBe(2);
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
    expect(screen.getByTestId("error")).toHaveTextContent(
      "ショートカットキーを確認してください。競合または登録できないキーがあります。",
    );
    expect(screen.getByTestId("save-status")).toHaveTextContent("error");
  });

  it("clears the top-level error when the user makes a new change", async () => {
    vi.useFakeTimers();
    const mockSettings = createMockSettings();
    let saveAttempts = 0;
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return mockSettings;
      if (cmd === "save_settings") {
        saveAttempts += 1;
        if (saveAttempts === 1) {
          throw new Error("時計ショートカットの登録に失敗しました");
        }
        return undefined;
      }
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

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-theme"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("save-status")).toHaveTextContent("error");
    expect(screen.getByTestId("error")).toHaveTextContent(
      "ショートカットキーを確認してください。競合または登録できないキーがあります。",
    );

    act(() => {
      fireEvent.click(screen.getByTestId("btn-showdate"));
    });

    expect(screen.getByTestId("error")).toHaveTextContent("no-error");
    expect(screen.getByTestId("save-status")).toHaveTextContent("pending");

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("save-status")).toHaveTextContent("saved");
  });

  it("does not overwrite a pending local edit with a stale settings-changed reload", async () => {
    vi.useFakeTimers();
    const initial = createMockSettings();
    const stale = createMockSettings();
    let loadCount = 0;
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "load_settings") {
        loadCount += 1;
        return loadCount === 1 ? initial : stale;
      }
      return undefined;
    });

    render(
      <AppSettingsProvider>
        <TestComponent />
      </AppSettingsProvider>,
    );
    await act(async () => Promise.resolve());

    fireEvent.click(screen.getByTestId("btn-showdate"));
    expect(screen.getByTestId("clock-showdate")).toHaveTextContent("false");

    await act(async () => {
      await eventMocks.listeners.get("settings-changed")?.();
    });

    expect(screen.getByTestId("clock-showdate")).toHaveTextContent("false");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(invoke).toHaveBeenCalledWith(
      "save_settings",
      expect.objectContaining({
        settings: expect.objectContaining({
          clock: expect.objectContaining({ showDate: false }),
        }),
      }),
    );
  });
});
