import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSettings } from "../../../core/mocks/mockSettings";
import { CALENDAR_EVENTS_CHANGED_EVENT } from "../events";
import type { CalendarEvent } from "../types";
import { CalendarOverlay } from "./CalendarOverlay";

const mocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: { payload?: unknown }) => void>(),
  hideCalendar: vi.fn().mockResolvedValue(undefined),
  hideClock: vi.fn().mockResolvedValue(undefined),
  emitTo: vi.fn().mockResolvedValue(undefined),
  setCalendarPosition: vi.fn().mockResolvedValue(undefined),
  setCalendarSize: vi.fn().mockResolvedValue(undefined),
  closeRequested: null as (() => void) | null,
  checkVisibility: false,
  windowVisible: true,
  isCalendarVisible: vi.fn(),
  currentMonitor: vi.fn().mockResolvedValue({
    size: { width: 1920, height: 1080 },
    scaleFactor: 1,
  }),
  openEditorShouldFail: false,
  syncShouldFail: false,
  invoke: vi.fn<(command: string) => Promise<unknown>>(async (command) => {
    if (command === "list_calendar_events") return [];
    if (command === "get_next_calendar_event") return null;
    if (command === "get_google_calendar_connection") {
      return {
        connected: false,
        accountEmail: "",
        lastSyncedAt: null,
        pendingOperations: 0,
        error: null,
        syncing: false,
      };
    }
    if (command === "sync_google_calendars") {
      if (mocks.syncShouldFail) throw new Error("network unavailable");
      return {
        changedEvents: 0,
        pendingOperations: 0,
      };
    }
    if (command === "open_calendar_editor_window") {
      if (mocks.openEditorShouldFail) {
        throw new Error("editor window unavailable");
      }
      return undefined;
    }
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
  currentMonitor: mocks.currentMonitor,
  getCurrentWindow: vi.fn(() => ({
    hide: mocks.hideCalendar,
    ...(mocks.checkVisibility ? { isVisible: mocks.isCalendarVisible } : {}),
    setPosition: mocks.setCalendarPosition,
    setSize: mocks.setCalendarSize,
    onCloseRequested: vi.fn(async (callback: () => void) => {
      mocks.closeRequested = callback;
      return () => {
        mocks.closeRequested = null;
      };
    }),
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
    window.localStorage.clear();
    mocks.listeners.clear();
    mocks.hideCalendar.mockClear();
    mocks.hideClock.mockClear();
    mocks.emitTo.mockClear();
    mocks.setCalendarPosition.mockClear();
    mocks.setCalendarSize.mockClear();
    mocks.closeRequested = null;
    mocks.currentMonitor.mockClear();
    mocks.checkVisibility = false;
    mocks.windowVisible = true;
    mocks.isCalendarVisible
      .mockReset()
      .mockImplementation(() => Promise.resolve(mocks.windowVisible));
    mocks.openEditorShouldFail = false;
    mocks.syncShouldFail = false;
    mocks.invoke.mockClear();
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "load_settings") return createMockSettings();
      if (command === "list_calendar_events") return [];
      if (command === "get_next_calendar_event") return null;
      if (command === "get_google_calendar_connection") {
        return {
          connected: false,
          accountEmail: "",
          lastSyncedAt: null,
          pendingOperations: 0,
          error: null,
          syncing: false,
        };
      }
      if (command === "sync_google_calendars") {
        if (mocks.syncShouldFail) throw new Error("network unavailable");
        return {
          changedEvents: 0,
          pendingOperations: 0,
        };
      }
      if (command === "open_calendar_editor_window") {
        if (mocks.openEditorShouldFail) {
          throw new Error("editor window unavailable");
        }
        return undefined;
      }
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
    expect(mocks.emitTo).toHaveBeenCalledWith("clock", "calendar-closed", {
      hideClock: false,
    });
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

    fireEvent.click(
      screen.getByRole("button", {
        name: "カレンダーオーバーレイを閉じる",
      }),
    );
    act(() => vi.advanceTimersByTime(240));
    await act(async () => Promise.resolve());

    expect(mocks.hideCalendar).toHaveBeenCalledOnce();
    expect(mocks.hideClock).toHaveBeenCalledOnce();
  });

  it("keeps native close requests on the same lifecycle as the overlay close", async () => {
    render(<CalendarOverlay />);
    act(() => {
      mocks.closeRequested?.();
      vi.advanceTimersByTime(240);
    });
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

  it("does not load or position while the newly created window is hidden", async () => {
    mocks.checkVisibility = true;
    mocks.windowVisible = false;
    render(<CalendarOverlay />);
    const showCalendar = mocks.listeners.get("calendar-shown");

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.currentMonitor).not.toHaveBeenCalled();
    expect(
      mocks.invoke.mock.calls.filter(
        ([command]) =>
          command === "list_calendar_events" ||
          command === "get_next_calendar_event",
      ),
    ).toHaveLength(0);

    mocks.windowVisible = true;
    act(() => {
      showCalendar?.({
        payload: { closeClockOnToggle: false, docked: false },
      });
      vi.advanceTimersByTime(20);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.currentMonitor).toHaveBeenCalled();
    expect(
      mocks.invoke.mock.calls.filter(
        ([command]) => command === "list_calendar_events",
      ),
    ).not.toHaveLength(0);
  });

  it("treats an unknown browser visibility result as visible", async () => {
    mocks.checkVisibility = true;
    mocks.isCalendarVisible.mockResolvedValue(undefined);

    render(<CalendarOverlay />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByRole("region", { name: "月間カレンダー" }),
    ).toBeVisible();
    expect(mocks.currentMonitor).toHaveBeenCalled();
  });

  it("does not reposition when an unrelated settings update rerenders the overlay", async () => {
    const view = render(<CalendarOverlay />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const initialMonitorCalls = mocks.currentMonitor.mock.calls.length;

    view.rerender(<CalendarOverlay />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.currentMonitor).toHaveBeenCalledTimes(initialMonitorCalls);
  });

  it("opens the event editor when quick entry is requested", async () => {
    render(<CalendarOverlay />);
    expect(mocks.listeners.has("calendar-create-requested")).toBe(true);

    act(() => {
      mocks.listeners.get("calendar-create-requested")?.({});
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.invoke).toHaveBeenCalledWith("open_calendar_editor_window", {
      payload: expect.objectContaining({
        mode: "create",
      }),
    });
  });

  it("shows a retry action when the event editor cannot be opened", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.openEditorShouldFail = true;
    render(<CalendarOverlay />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "7月11日" }));
    fireEvent.click(screen.getByRole("button", { name: "この日に予定を追加" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "予定入力画面を開けませんでした。再試行してください。",
    );
    const retryButton = screen.getByRole("button", { name: "再試行" });

    mocks.openEditorShouldFail = false;
    fireEvent.click(retryButton);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to open calendar editor window:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("shows a retry action when Google Calendar sync fails", async () => {
    const consoleWarn = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const settings = createMockSettings();
    settings.calendar.selectedGoogleCalendarIds = ["primary"];
    mocks.syncShouldFail = true;
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "load_settings") return settings;
      if (command === "list_calendar_events") return [];
      if (command === "get_next_calendar_event") return null;
      if (command === "get_google_calendar_connection") {
        return {
          connected: true,
          accountEmail: "user@example.com",
          lastSyncedAt: null,
          pendingOperations: 0,
          error: null,
          syncing: false,
        };
      }
      if (command === "sync_google_calendars") {
        if (mocks.syncShouldFail) throw new Error("network unavailable");
        return { changedEvents: 0, pendingOperations: 0 };
      }
      return undefined;
    });

    render(<CalendarOverlay />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Google Calendarとの同期に失敗しました。Google Calendarに接続できませんでした。通信環境を確認して、もう一度お試しください。",
    );
    expect(consoleWarn).toHaveBeenCalledWith(
      "Google Calendar sync failed:",
      expect.any(Error),
    );

    mocks.syncShouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: "再同期" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.invoke).toHaveBeenCalledWith("sync_google_calendars", {
      calendarIds: ["primary"],
    });
    consoleWarn.mockRestore();
  });

  it("refreshes after the event editor saves in another window", async () => {
    render(<CalendarOverlay />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const listCallCount = () =>
      mocks.invoke.mock.calls.filter(
        ([command]) => command === "list_calendar_events",
      ).length;
    const initialListCallCount = listCallCount();
    expect(initialListCallCount).toBeGreaterThan(0);

    await act(async () => {
      mocks.listeners.get(CALENDAR_EVENTS_CHANGED_EVENT)?.({});
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(listCallCount()).toBe(initialListCallCount + 1);
  });

  it("updates open detail when an external save moves the event out of view", async () => {
    let currentEvent = calendarEvent;
    let listedEvents: CalendarEvent[] = [calendarEvent];
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "load_settings") return createMockSettings();
      if (command === "list_calendar_events") return listedEvents;
      if (command === "get_next_calendar_event") return listedEvents[0] ?? null;
      if (command === "get_google_calendar_connection") {
        return {
          connected: false,
          accountEmail: "",
          lastSyncedAt: null,
          pendingOperations: 0,
          error: null,
          syncing: false,
        };
      }
      return undefined;
    });

    render(<CalendarOverlay />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "7月11日、予定1件" }));
    fireEvent.click(screen.getByRole("button", { name: /設計レビュー/ }));
    expect(
      screen.getByRole("heading", { name: "設計レビュー" }),
    ).toBeInTheDocument();

    currentEvent = {
      ...calendarEvent,
      title: "更新されたレビュー",
      notes: "保存後の内容",
      schedule: {
        kind: "allDay",
        startDate: "2026-08-02",
        endDateExclusive: "2026-08-03",
      },
    };
    listedEvents = [];
    await act(async () => {
      mocks.listeners.get(CALENDAR_EVENTS_CHANGED_EVENT)?.({
        payload: { event: currentEvent },
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", { name: "更新されたレビュー" }),
    ).toBeInTheDocument();
    expect(screen.getByText("保存後の内容")).toBeInTheDocument();
    expect(screen.getByText(/8月2日/)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "戻る" }));
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: /8月2日/ })).toBeInTheDocument();
  });

  it("creates an event for the open day with the N shortcut", async () => {
    render(<CalendarOverlay />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "7月11日" }));
    fireEvent.keyDown(window, { key: "n" });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.invoke).toHaveBeenCalledWith("open_calendar_editor_window", {
      payload: {
        mode: "create",
        date: "2026-07-11",
      },
    });
  });

  it("restores the selected day after returning from its agenda", async () => {
    render(<CalendarOverlay />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const selectedDay = screen.getByRole("button", { name: "7月11日" });
    fireEvent.click(selectedDay);
    fireEvent.click(screen.getByRole("button", { name: "月表示に戻る" }));

    await act(async () => Promise.resolve());

    expect(screen.getByRole("button", { name: "7月11日" })).toHaveFocus();
  });

  it("moves across month boundaries and reloads the visible event range", async () => {
    render(<CalendarOverlay />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const listCallCount = () =>
      mocks.invoke.mock.calls.filter(
        ([command]) => command === "list_calendar_events",
      ).length;
    const beforeMonthChange = listCallCount();

    fireEvent.click(screen.getByRole("button", { name: "7月31日" }));
    expect(
      screen.getByRole("heading", { name: /7月31日/ }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "次の日" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("heading", { name: /8月1日/ })).toBeInTheDocument();
    expect(listCallCount()).toBeGreaterThan(beforeMonthChange);
    const listCalls = mocks.invoke.mock.calls.filter(
      ([command]) => command === "list_calendar_events",
    );
    const latestListCall = listCalls[listCalls.length - 1] as unknown as
      | [string, unknown]
      | undefined;
    expect(latestListCall?.[1]).toEqual({
      range: expect.objectContaining({
        startDate: "2026-07-26",
        endDateExclusive: "2026-09-06",
      }),
    });
  });

  it("returns to the month of the next event after opening its detail", async () => {
    const upcomingEvent: CalendarEvent = {
      ...calendarEvent,
      id: "event-next-month",
      title: "来月の計画会議",
      schedule: {
        kind: "allDay",
        startDate: "2026-08-02",
        endDateExclusive: "2026-08-03",
      },
    };
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "list_calendar_events") return [calendarEvent];
      if (command === "get_next_calendar_event") return upcomingEvent;
      if (command === "get_google_calendar_connection") {
        return {
          connected: false,
          accountEmail: "",
          lastSyncedAt: null,
          pendingOperations: 0,
          error: null,
          syncing: false,
        };
      }
      return undefined;
    });

    render(<CalendarOverlay />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "次の予定、来月の計画会議" }),
      );
      await Promise.resolve();
    });
    expect(
      screen.getByRole("heading", { name: "来月の計画会議" }),
    ).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "戻る" }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", { name: "2026年 8月" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8月2日" })).toHaveFocus();
  });

  it("opens a reusable copy from event detail with the D shortcut", async () => {
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "list_calendar_events") return [calendarEvent];
      if (command === "get_next_calendar_event") return calendarEvent;
      if (command === "get_google_calendar_connection") {
        return {
          connected: false,
          accountEmail: "",
          lastSyncedAt: null,
          pendingOperations: 0,
          error: null,
          syncing: false,
        };
      }
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

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.invoke).toHaveBeenCalledWith("open_calendar_editor_window", {
      payload: expect.objectContaining({
        mode: "duplicate",
        template: expect.objectContaining({
          title: "設計レビュー",
        }),
      }),
    });
  });
});
