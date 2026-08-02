import { invoke } from "@tauri-apps/api/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppSettingsProvider,
  useSettingsSaveStatus,
  useSettingsSelector,
  useShortcutError,
  useUpdateSettings,
} from "../context/AppSettings";
import { useFeatureSettings } from "../hooks/useFeatureSettings";
import { createMockSettings } from "../mocks/mockSettings";
import type { AppSettings } from "../settingsModel";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const eventMocks = vi.hoisted(() => ({
  listeners: new Map<
    string,
    (event?: { payload?: AppSettings }) => void | Promise<void>
  >(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    async (
      event: string,
      handler: (event?: { payload?: AppSettings }) => void | Promise<void>,
    ) => {
      eventMocks.listeners.set(event, handler);
      return () => eventMocks.listeners.delete(event);
    },
  ),
}));

const ClockSettingsConsumer: React.FC = () => {
  const renderCount = useRef(0);
  renderCount.current += 1;
  const { featureSettings } = useFeatureSettings("clock");
  return (
    <>
      <span data-testid="clock-renders">{renderCount.current}</span>
      <span data-testid="clock-enabled">
        {String(featureSettings?.enabled)}
      </span>
    </>
  );
};

const FileShelfSettingsConsumer: React.FC = () => {
  const renderCount = useRef(0);
  renderCount.current += 1;
  const { featureSettings } = useFeatureSettings("fileShelf");
  return (
    <>
      <span data-testid="file-shelf-renders">{renderCount.current}</span>
      <span data-testid="file-shelf-enabled">
        {String(featureSettings?.enabled)}
      </span>
    </>
  );
};

const SaveStatusConsumer: React.FC = () => {
  const saveStatus = useSettingsSaveStatus();
  return <span data-testid="save-status">{saveStatus}</span>;
};

const ClockShortcutErrorConsumer: React.FC = () => {
  const error = useShortcutError("clock");
  return <span data-testid="clock-error">{error || "no-error"}</span>;
};

const FileShelfShortcutErrorConsumer: React.FC = () => {
  const error = useShortcutError("fileShelf");
  return <span data-testid="file-shelf-error">{error || "no-error"}</span>;
};

const ThemeSelectorConsumer: React.FC = () => {
  const theme = useSettingsSelector((state) => state.settings?.theme ?? null);
  return <span data-testid="theme">{theme ?? "none"}</span>;
};

const UpdateTrigger: React.FC = () => {
  const updateSettings = useUpdateSettings();
  return (
    <button
      type="button"
      data-testid="btn-toggle-clock"
      onClick={() =>
        updateSettings((previous) => ({
          ...previous,
          clock: { ...previous.clock, enabled: !previous.clock.enabled },
        }))
      }
    >
      Toggle Clock
    </button>
  );
};

const NoopUpdateTrigger: React.FC = () => {
  const updateSettings = useUpdateSettings();
  return (
    <button
      type="button"
      data-testid="btn-noop"
      onClick={() =>
        updateSettings((previous) => ({
          ...previous,
          theme: previous.theme,
        }))
      }
    >
      Noop
    </button>
  );
};

const renderApp = () =>
  render(
    <AppSettingsProvider>
      <ClockSettingsConsumer />
      <FileShelfSettingsConsumer />
      <SaveStatusConsumer />
      <ClockShortcutErrorConsumer />
      <FileShelfShortcutErrorConsumer />
      <ThemeSelectorConsumer />
      <UpdateTrigger />
      <NoopUpdateTrigger />
    </AppSettingsProvider>,
  );

const getRenderCount = (label: string) =>
  Number(screen.getByTestId(`${label}-renders`).textContent);

describe("settings store selective subscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eventMocks.listeners.clear();
    vi.mocked(invoke).mockResolvedValue(createMockSettings());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not re-render unrelated feature subscribers when one feature changes", async () => {
    renderApp();
    await act(async () => {
      await Promise.resolve();
    });

    const clockBefore = getRenderCount("clock");
    const fileShelfBefore = getRenderCount("file-shelf");
    expect(clockBefore).toBeGreaterThan(0);
    expect(fileShelfBefore).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-toggle-clock"));
    });

    // Clock changed → clock subscriber re-renders.
    expect(getRenderCount("clock")).toBeGreaterThan(clockBefore);
    expect(screen.getByTestId("clock-enabled")).toHaveTextContent("false");
    // Unrelated file shelf slice keeps the same reference → no re-render.
    expect(getRenderCount("file-shelf")).toBe(fileShelfBefore);
    expect(screen.getByTestId("file-shelf-enabled")).toHaveTextContent("true");
  });

  it("does not re-render feature consumers when save status changes", async () => {
    vi.useFakeTimers();
    renderApp();
    await act(async () => {
      await Promise.resolve();
    });

    const clockBefore = getRenderCount("clock");
    const fileShelfBefore = getRenderCount("file-shelf");

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-toggle-clock"));
    });

    expect(screen.getByTestId("save-status")).toHaveTextContent("saved");
    // Save status changed but feature slices did not change again.
    expect(getRenderCount("clock")).toBeGreaterThan(clockBefore);
    expect(getRenderCount("file-shelf")).toBe(fileShelfBefore);
  });

  it("notifies only the feature that owns a shortcut error", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "load_settings") return createMockSettings();
      if (cmd === "save_settings")
        throw new Error("時計ショートカットの登録に失敗しました");
      return undefined;
    });

    renderApp();
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-toggle-clock"));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("clock-error")).toHaveTextContent(
      "時計ショートカットの登録に失敗しました",
    );
    expect(screen.getByTestId("file-shelf-error")).toHaveTextContent(
      "no-error",
    );
  });

  it("applies an external settings-changed payload without reloading via IPC", async () => {
    const initial = createMockSettings();
    const next = createMockSettings({ theme: "light" });
    vi.mocked(invoke).mockResolvedValue(initial);

    renderApp();
    await act(async () => {
      await Promise.resolve();
    });
    vi.mocked(invoke).mockClear();

    await act(async () => {
      await eventMocks.listeners.get("settings-changed")?.({ payload: next });
    });

    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(invoke).not.toHaveBeenCalledWith("load_settings");
  });

  it("does not notify or re-render on a no-op update", async () => {
    renderApp();
    await act(async () => {
      await Promise.resolve();
    });

    const clockBefore = getRenderCount("clock");
    const fileShelfBefore = getRenderCount("file-shelf");

    await act(async () => {
      fireEvent.click(screen.getByTestId("btn-noop"));
    });

    expect(getRenderCount("clock")).toBe(clockBefore);
    expect(getRenderCount("file-shelf")).toBe(fileShelfBefore);
    expect(screen.getByTestId("save-status")).toHaveTextContent("idle");
  });
});
