import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEventInput } from "../../features/calendar/types";
import {
  mockCreateCalendarEvent,
  mockDeleteCalendarEvent,
  mockGetNextCalendarEvent,
  mockListCalendarEvents,
  mockUpdateCalendarEvent,
} from "./calendarEventMock";

const input: CalendarEventInput = {
  title: "設計レビュー",
  notes: "",
  schedule: {
    kind: "timed",
    startsAt: "2026-07-11T05:00:00.000Z",
    endsAt: "2026-07-11T06:00:00.000Z",
    timeZone: "Asia/Tokyo",
  },
};

describe("calendar event browser mock", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-10T00:00:00.000Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("persists, filters, updates and deletes events", () => {
    const created = mockCreateCalendarEvent(input);
    const listed = mockListCalendarEvents({
      startInstant: "2026-07-01T00:00:00.000Z",
      endInstant: "2026-08-01T00:00:00.000Z",
      startDate: "2026-07-01",
      endDateExclusive: "2026-08-01",
    });
    expect(listed).toEqual([created]);

    const updated = mockUpdateCalendarEvent(created.id, {
      ...input,
      title: "更新した予定",
    });
    expect(updated.title).toBe("更新した予定");
    expect(
      mockGetNextCalendarEvent({
        nowInstant: "2026-07-11T04:00:00.000Z",
        todayDate: "2026-07-11",
      })?.id,
    ).toBe(created.id);

    mockDeleteCalendarEvent(created.id);
    expect(
      mockGetNextCalendarEvent({
        nowInstant: "2026-07-11T04:00:00.000Z",
        todayDate: "2026-07-11",
      }),
    ).toBeNull();
  });
});
