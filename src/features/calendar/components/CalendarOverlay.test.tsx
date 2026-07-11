import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSettings } from "../../../core/mocks/mockSettings";
import type { CalendarEvent } from "../types";
import { CalendarOverlay } from "./CalendarOverlay";

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: { payload?: unknown }) => void>(),
  hideCalendar: vi.fn().mockResolvedValue(undefined),
  hideClock: vi.fn().mockResolvedValue(undefined),
  emitTo: vi.fn().mockResolvedValue(undefined),
  setCalendarPosition: vi.fn().mockResolvedValue(undefined),
  setCalendarSize: vi.fn().mockResolvedValue(undefined),
  invoke: vi.fn<(command: string) => Promise<unknown>>(async (command) => {
    if (command === "list_calendar_events") return [];
    if (command === "get_next_calendar_event") return null;
    return undefined;
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
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

const calendarEvent: CalendarEvent = {
  id: "event-1",
  title: "設計レビュー",
  notes: "確認事項",
  schedule: {
    kind: "allDay",
    startDate: "2026-07-11",
    endDateExclusive: "2026-07-12",
  },
  source: { kind: "local" },
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
};

describe("CalendarOverlay window coordination", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 11, 9, 0, 0));
    mocks.listeners.clear();
    mocks.hideCalendar.mockClear();
    mocks.hideClock.mockClear();
    mocks.emitTo.mockClear();
    mocks.setCalendarPosition.mockClear();
    mocks.setCalendarSize.mockClear();
    mocks.invoke.mockClear();
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "list_calendar_events") return [];
      if (command === "get_next_calendar_event") return null;
      return undefined;
    });
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
    expect(size.width).toBe(420);
    expect(size.height).toBe(384);
  });

  it("opens the event editor when quick entry is requested", async () => {
    render(<CalendarOverlay />);
    expect(mocks.listeners.has("calendar-create-requested")).toBe(true);

    act(() => {
      mocks.listeners.get("calendar-create-requested")?.({});
    });

    expect(
      screen.getByRole("heading", { name: "予定を追加" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("タイトル")).toHaveFocus();
  });

  it("creates an event for the open day with the N shortcut", async () => {
    render(<CalendarOverlay />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "7月11日" }));
    fireEvent.keyDown(window, { key: "n" });

    expect(
      screen.getByRole("heading", { name: "予定を追加" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("日付")).toHaveValue("2026-07-11");
  });

  it("opens a reusable copy from event detail with the D shortcut", async () => {
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "list_calendar_events") return [calendarEvent];
      if (command === "get_next_calendar_event") return calendarEvent;
      return undefined;
    });
    render(<CalendarOverlay />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "7月11日、予定1件" }));
    fireEvent.click(screen.getByRole("button", { name: /設計レビュー/ }));
    fireEvent.keyDown(window, { key: "d" });

    expect(
      screen.getByRole("heading", { name: "予定を複製" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("タイトル")).toHaveValue("設計レビュー");
  });
});
