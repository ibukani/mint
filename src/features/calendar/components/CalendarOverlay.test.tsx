import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSettings } from "../../../core/mocks/mockSettings";
import { CalendarOverlay } from "./CalendarOverlay";

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: { payload?: unknown }) => void>(),
  hideCalendar: vi.fn().mockResolvedValue(undefined),
  hideClock: vi.fn().mockResolvedValue(undefined),
  emitTo: vi.fn().mockResolvedValue(undefined),
  setCalendarPosition: vi.fn().mockResolvedValue(undefined),
  setCalendarSize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: mocks.emitTo,
  listen: vi.fn(
    async (event: string, callback: (event: { payload?: unknown }) => void) => {
      mocks.listeners.set(event, callback);
      return () => mocks.listeners.delete(event);
    },
  ),
}));

vi.mock("@tauri-apps/api/window", () => ({
  currentMonitor: vi.fn().mockResolvedValue({
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
  }),
  getCurrentWindow: vi.fn(() => ({
    hide: mocks.hideCalendar,
    setPosition: mocks.setCalendarPosition,
    setSize: mocks.setCalendarSize,
  })),
  LogicalPosition: class LogicalPosition {
    constructor(
      public x: number,
      public y: number,
    ) {}
  },
  Window: {
    getByLabel: vi.fn().mockResolvedValue({
      hide: mocks.hideClock,
      isVisible: vi.fn().mockResolvedValue(true),
      outerPosition: vi.fn().mockResolvedValue({ x: 1500, y: 20 }),
      outerSize: vi.fn().mockResolvedValue({ width: 420, height: 168 }),
    }),
  },
}));

vi.mock("../../../core/context/AppSettings", () => ({
  useAppSettings: () => ({ settings: createMockSettings() }),
}));

describe("CalendarOverlay window coordination", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.listeners.clear();
    mocks.hideCalendar.mockClear();
    mocks.hideClock.mockClear();
    mocks.emitTo.mockClear();
    mocks.setCalendarPosition.mockClear();
    mocks.setCalendarSize.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a pre-existing clock open when the calendar shortcut closes", async () => {
    render(<CalendarOverlay />);
    expect(mocks.listeners.has("calendar-shown")).toBe(true);

    act(() => {
      mocks.listeners.get("calendar-shown")?.({
        payload: { closeClockOnToggle: false, docked: true },
      });
      mocks.listeners.get("calendar-hide-requested")?.({});
      vi.advanceTimersByTime(240);
    });
    await act(async () => Promise.resolve());

    expect(mocks.hideCalendar).toHaveBeenCalledOnce();
    expect(mocks.hideClock).not.toHaveBeenCalled();
    expect(mocks.emitTo).toHaveBeenCalledWith("clock", "calendar-closed");
  });

  it("closes a clock opened as part of the calendar session", async () => {
    render(<CalendarOverlay />);
    expect(mocks.listeners.has("calendar-shown")).toBe(true);

    act(() => {
      mocks.listeners.get("calendar-shown")?.({
        payload: { closeClockOnToggle: true, docked: true },
      });
      mocks.listeners.get("calendar-hide-requested")?.({});
      vi.advanceTimersByTime(240);
    });
    await act(async () => Promise.resolve());

    expect(mocks.hideCalendar).toHaveBeenCalledOnce();
    expect(mocks.hideClock).toHaveBeenCalledOnce();
  });

  it("closes both windows from the explicit close button", async () => {
    render(<CalendarOverlay />);
    expect(mocks.listeners.has("calendar-shown")).toBe(true);

    screen
      .getByRole("button", {
        name: "カレンダーオーバーレイを閉じる",
      })
      .click();
    act(() => vi.advanceTimersByTime(240));
    await act(async () => Promise.resolve());

    expect(mocks.hideCalendar).toHaveBeenCalledOnce();
    expect(mocks.hideClock).toHaveBeenCalledOnce();
  });

  it("resizes the default calendar with the taller base height", async () => {
    render(<CalendarOverlay />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(mocks.setCalendarSize).toHaveBeenCalled();

    const lastCall =
      mocks.setCalendarSize.mock.calls[
        mocks.setCalendarSize.mock.calls.length - 1
      ];
    const size = lastCall?.[0] as {
      height: number;
      width: number;
    };
    expect(size.width).toBe(436);
    expect(size.height).toBe(415);
  });
});
