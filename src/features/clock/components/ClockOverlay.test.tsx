import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
let clockShownCleanup: ReturnType<typeof vi.fn> | null = null;

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, handler: typeof clockShownHandler) => {
    if (event === "clock-shown") {
      clockShownHandler = handler;
    }
    clockShownCleanup = vi.fn();
    return clockShownCleanup;
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
    clockShownCleanup = null;
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

  it("renders the clock summary and date when enabled", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-09T12:34:56+09:00"));
      vi.mocked(invoke).mockResolvedValue(
        createMockSettings({
          clock: { autoHideSeconds: 0, showDate: true },
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

      expect(
        screen.getByText("2026年7月9日(木) 12:34:56", {
          selector: ".sr-only",
        }),
      ).toBeInTheDocument();
      expect(screen.getAllByText("2026年7月9日(木)")).toHaveLength(2);
      expect(screen.getByText("Esc でも閉じられます。")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
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

  it("unsubscribes from clock-shown on unmount", async () => {
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

    const { unmount } = render(
      <AppSettingsProvider>
        <ClockOverlay />
      </AppSettingsProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(clockShownCleanup).toHaveBeenCalledTimes(1);
  });
});
