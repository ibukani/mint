import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "../../../core/context/AppSettings";
import { createMockSettings } from "../../../core/mocks/mockSettings";
import { ClockOverlay } from "./ClockOverlay";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

let clockShownHandler:
  | ((event: { event: string; payload: unknown }) => void)
  | null = null;

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, handler: typeof clockShownHandler) => {
    if (event === "clock-shown") {
      clockShownHandler = handler;
    }
    return vi.fn();
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    label: "clock",
    hide: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe("ClockOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clockShownHandler = null;
    vi.mocked(getCurrentWindow).mockReturnValue({
      label: "clock",
      hide: vi.fn().mockResolvedValue(undefined),
      show: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getCurrentWindow>);
  });

  it("restarts the auto-hide timer when the clock-shown event fires", async () => {
    vi.useFakeTimers();
    try {
      const hide = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getCurrentWindow).mockReturnValue({
        label: "clock",
        hide,
        show: vi.fn().mockResolvedValue(undefined),
      } as unknown as ReturnType<typeof getCurrentWindow>);
      vi.mocked(invoke).mockResolvedValue(
        createMockSettings({
          clock: { autoHideSeconds: 3 },
        }) as unknown as ReturnType<typeof invoke>,
      );

      render(
        <AppSettingsProvider>
          <ClockOverlay />
        </AppSettingsProvider>,
      );

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
        clockShownHandler?.({ event: "clock-shown", payload: undefined });
      });

      expect(hide).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(2999);
        await Promise.resolve();
      });

      expect(hide).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1);
        await Promise.resolve();
      });

      expect(hide).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides the clock overlay with Escape", async () => {
    const hide = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getCurrentWindow).mockReturnValue({
      label: "clock",
      hide,
      show: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof getCurrentWindow>);
    vi.mocked(invoke).mockResolvedValue(
      createMockSettings({
        clock: { autoHideSeconds: 3 },
      }) as unknown as ReturnType<typeof invoke>,
    );

    render(
      <AppSettingsProvider>
        <ClockOverlay />
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(hide).toHaveBeenCalledTimes(1);
  });

  it("does not auto-hide when the timer is disabled", async () => {
    vi.useFakeTimers();
    try {
      const hide = vi.fn().mockResolvedValue(undefined);
      vi.mocked(getCurrentWindow).mockReturnValue({
        label: "clock",
        hide,
        show: vi.fn().mockResolvedValue(undefined),
      } as unknown as ReturnType<typeof getCurrentWindow>);
      vi.mocked(invoke).mockResolvedValue(
        createMockSettings({
          clock: { autoHideSeconds: 0 },
        }) as unknown as ReturnType<typeof invoke>,
      );

      render(
        <AppSettingsProvider>
          <ClockOverlay />
        </AppSettingsProvider>,
      );

      await act(async () => {
        await Promise.resolve();
      });

      await act(async () => {
        vi.advanceTimersByTime(10000);
        await Promise.resolve();
      });

      expect(hide).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
