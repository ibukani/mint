import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCalendarEvents } from "./useCalendarEvents";

const mocks = vi.hoisted(() => ({
  getGoogleCalendarConnection: vi.fn(),
  listCalendarEvents: vi.fn(),
  getNextCalendarEvent: vi.fn(),
  syncGoogleCalendars: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => vi.fn()),
}));

vi.mock("../events", () => ({
  CALENDAR_EVENTS_CHANGED_EVENT: "calendar-events-changed",
  buildEventCursor: vi.fn(() => "cursor"),
  buildEventRange: vi.fn(() => ({ start: "2026-07-01", end: "2026-08-01" })),
  getNextCalendarEvent: mocks.getNextCalendarEvent,
  listCalendarEvents: mocks.listCalendarEvents,
}));

vi.mock("../googleCalendar", () => ({
  getGoogleCalendarConnection: mocks.getGoogleCalendarConnection,
  syncGoogleCalendars: mocks.syncGoogleCalendars,
}));

describe("useCalendarEvents", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.getGoogleCalendarConnection.mockReset().mockResolvedValue({
      connected: false,
      accountEmail: "",
      lastSyncedAt: null,
      pendingOperations: 0,
      error: null,
      syncing: false,
    });
    mocks.listCalendarEvents.mockReset().mockResolvedValue([]);
    mocks.getNextCalendarEvent.mockReset().mockResolvedValue(null);
    mocks.syncGoogleCalendars.mockReset().mockResolvedValue(undefined);
  });

  it("does not recheck the connection when the selected IDs have the same contents", async () => {
    const { rerender } = renderHook(
      ({ calendarIds }) =>
        useCalendarEvents(
          new Date(2026, 6, 1),
          new Date(2026, 6, 11),
          0,
          calendarIds,
        ),
      { initialProps: { calendarIds: ["primary"] } },
    );

    await waitFor(() =>
      expect(mocks.getGoogleCalendarConnection).toHaveBeenCalledOnce(),
    );

    rerender({ calendarIds: ["primary"] });
    await Promise.resolve();
    expect(mocks.getGoogleCalendarConnection).toHaveBeenCalledOnce();

    rerender({ calendarIds: ["work"] });
    await waitFor(() =>
      expect(mocks.getGoogleCalendarConnection).toHaveBeenCalledTimes(2),
    );
  });
});
