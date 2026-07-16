import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  adjustEndTimeForStartChange,
  CalendarEventValidationError,
  countEventsForDate,
  createDefaultEventDraft,
  draftToEventInput,
  eventOccursOnDate,
  eventToDraft,
  formatEventForClipboard,
} from "./events";
import type { CalendarEvent } from "./types";

const allDayEvent: CalendarEvent = {
  id: "event-1",
  title: "休暇",
  notes: "",
  schedule: {
    kind: "allDay",
    startDate: "2026-07-11",
    endDateExclusive: "2026-07-13",
  },
  source: { kind: "local" },
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
};

describe("calendar event helpers", () => {
  afterEach(() => vi.useRealTimers());

  it("defaults quick entry to the next half hour", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 10, 10, 10, 0));

    expect(createDefaultEventDraft()).toMatchObject({
      date: "2026-07-10",
      allDayDurationDays: 1,
      startTime: "10:30",
      endTime: "11:30",
      allDay: false,
    });
  });

  it("moves adjacent dates across month and year boundaries", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("creates an exclusive end date for all-day events", () => {
    expect(
      draftToEventInput({
        title: " 休暇 ",
        date: "2026-07-11",
        allDayDurationDays: 1,
        startTime: "09:00",
        endTime: "10:00",
        allDay: true,
        notes: "",
      }),
    ).toEqual({
      title: "休暇",
      notes: "",
      schedule: {
        kind: "allDay",
        startDate: "2026-07-11",
        endDateExclusive: "2026-07-12",
      },
    });
  });

  it("rejects empty titles and reversed time ranges", () => {
    expect(() =>
      draftToEventInput({
        title: " ",
        date: "2026-07-11",
        allDayDurationDays: 1,
        startTime: "09:00",
        endTime: "10:00",
        allDay: false,
        notes: "",
      }),
    ).toThrow("タイトルを入力してください");
    expect(() =>
      draftToEventInput({
        title: "予定",
        date: "2026-07-11",
        allDayDurationDays: 1,
        startTime: "10:00",
        endTime: "09:00",
        allDay: false,
        notes: "",
      }),
    ).toThrow("終了時刻は開始時刻より後");
  });

  it("preserves duration when the start time changes and clamps at day end", () => {
    expect(adjustEndTimeForStartChange("09:00", "10:30", "13:00")).toBe(
      "14:30",
    );
    expect(adjustEndTimeForStartChange("09:00", "08:00", "13:00")).toBe(
      "14:00",
    );
    expect(adjustEndTimeForStartChange("22:30", "23:30", "23:30")).toBe(
      "23:59",
    );
  });

  it("identifies the field responsible for validation errors", () => {
    expect.assertions(2);
    try {
      draftToEventInput({
        title: "予定",
        date: "2026-07-11",
        allDayDurationDays: 1,
        startTime: "10:00",
        endTime: "09:00",
        allDay: false,
        notes: "",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(CalendarEventValidationError);
      expect((error as CalendarEventValidationError).field).toBe("endTime");
    }
  });

  it("marks each date covered by an all-day event", () => {
    expect(eventOccursOnDate(allDayEvent, "2026-07-10")).toBe(false);
    expect(eventOccursOnDate(allDayEvent, "2026-07-11")).toBe(true);
    expect(eventOccursOnDate(allDayEvent, "2026-07-12")).toBe(true);
    expect(eventOccursOnDate(allDayEvent, "2026-07-13")).toBe(false);
  });

  it("counts events for a month cell without sorting the event list", () => {
    expect(countEventsForDate([allDayEvent], "2026-07-10")).toBe(0);
    expect(countEventsForDate([allDayEvent], "2026-07-11")).toBe(1);
    expect(countEventsForDate([allDayEvent], "2026-07-12")).toBe(1);
  });

  it("preserves the duration of multi-day all-day events when editing", () => {
    const draft = eventToDraft(allDayEvent);
    expect(draft.allDayDurationDays).toBe(2);
    expect(draftToEventInput(draft).schedule).toEqual({
      kind: "allDay",
      startDate: "2026-07-11",
      endDateExclusive: "2026-07-13",
    });
  });

  it("formats event details into a shareable clipboard text", () => {
    expect(formatEventForClipboard(allDayEvent)).toBe(
      "休暇\n2026年7月11日(土)〜2026年7月12日(日) 終日",
    );
  });
});
