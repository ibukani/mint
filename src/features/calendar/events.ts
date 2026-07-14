import { invoke } from "@tauri-apps/api/core";
import { buildCalendarDays, startOfMonth, toMachineDate } from "./calendar";
import type {
  CalendarEditorPayload,
  CalendarEvent,
  CalendarEventCursor,
  CalendarEventDraft,
  CalendarEventInput,
  CalendarEventRange,
} from "./types";

export const CALENDAR_EVENTS_CHANGED_EVENT = "calendar-events-changed";

export interface CalendarEventsChangedPayload {
  event: CalendarEvent;
}

const parseMachineDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

const machineDateDistance = (start: string, endExclusive: string) => {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = endExclusive.split("-").map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.round((endUtc - startUtc) / (24 * 60 * 60 * 1000));
};

export const addDays = (value: string, days: number) => {
  const date = parseMachineDate(value);
  date.setDate(date.getDate() + days);
  return toMachineDate(date);
};

export const buildEventRange = (
  viewMonth: Date,
  today: Date,
): CalendarEventRange => {
  const days = buildCalendarDays(startOfMonth(viewMonth), today);
  const startDate = days[0]?.machineDate ?? toMachineDate(viewMonth);
  const endDateExclusive = addDays(
    days[days.length - 1]?.machineDate ?? startDate,
    1,
  );
  return {
    startInstant: parseMachineDate(startDate).toISOString(),
    endInstant: parseMachineDate(endDateExclusive).toISOString(),
    startDate,
    endDateExclusive,
  };
};

export const buildEventCursor = (now: Date): CalendarEventCursor => ({
  nowInstant: now.toISOString(),
  todayDate: toMachineDate(now),
});

export const listCalendarEvents = (range: CalendarEventRange) =>
  invoke<CalendarEvent[]>("list_calendar_events", { range });

export const getNextCalendarEvent = (cursor: CalendarEventCursor) =>
  invoke<CalendarEvent | null>("get_next_calendar_event", { cursor });

export const createCalendarEvent = (input: CalendarEventInput) =>
  invoke<CalendarEvent>("create_calendar_event", { input });

export const updateCalendarEvent = (id: string, input: CalendarEventInput) =>
  invoke<CalendarEvent>("update_calendar_event", { id, input });

export const deleteCalendarEvent = (id: string) =>
  invoke<void>("delete_calendar_event", { id });

const formatTimeInput = (date: Date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const timeInputToMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const minutesToTimeInput = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export const adjustEndTimeForStartChange = (
  previousStart: string,
  previousEnd: string,
  nextStart: string,
) => {
  const previousStartMinutes = timeInputToMinutes(previousStart);
  const previousEndMinutes = timeInputToMinutes(previousEnd);
  const nextStartMinutes = timeInputToMinutes(nextStart);
  if (nextStartMinutes === null) return previousEnd;

  const previousDuration =
    previousStartMinutes !== null &&
    previousEndMinutes !== null &&
    previousEndMinutes > previousStartMinutes
      ? previousEndMinutes - previousStartMinutes
      : 60;
  const nextEndMinutes = Math.min(
    nextStartMinutes + previousDuration,
    23 * 60 + 59,
  );
  return minutesToTimeInput(nextEndMinutes);
};

export type CalendarEventValidationField =
  | "title"
  | "date"
  | "startTime"
  | "endTime";

export class CalendarEventValidationError extends Error {
  constructor(
    public readonly field: CalendarEventValidationField,
    message: string,
  ) {
    super(message);
    this.name = "CalendarEventValidationError";
  }
}

export const createDefaultEventDraft = (
  requestedDate?: string,
  now = new Date(),
): CalendarEventDraft => {
  const todayDate = toMachineDate(now);
  let date = requestedDate ?? todayDate;
  let start = new Date(now);
  start.setSeconds(0, 0);
  start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  if (date !== todayDate || toMachineDate(end) !== todayDate) {
    start = parseMachineDate(date);
    start.setHours(9, 0, 0, 0);
    end.setTime(start.getTime() + 60 * 60 * 1000);
  } else {
    date = toMachineDate(start);
  }

  return {
    title: "",
    date,
    allDayDurationDays: 1,
    startTime: formatTimeInput(start),
    endTime: formatTimeInput(end),
    allDay: false,
    notes: "",
  };
};

export const eventToDraft = (event: CalendarEvent): CalendarEventDraft => {
  if (event.schedule.kind === "allDay") {
    return {
      title: event.title,
      date: event.schedule.startDate,
      allDayDurationDays: Math.max(
        1,
        machineDateDistance(
          event.schedule.startDate,
          event.schedule.endDateExclusive,
        ),
      ),
      startTime: "09:00",
      endTime: "10:00",
      allDay: true,
      notes: event.notes,
    };
  }

  const start = new Date(event.schedule.startsAt);
  const end = new Date(event.schedule.endsAt);
  return {
    title: event.title,
    date: toMachineDate(start),
    allDayDurationDays: 1,
    startTime: formatTimeInput(start),
    endTime: formatTimeInput(end),
    allDay: false,
    notes: event.notes,
  };
};

export const openCalendarEditor = async (payload: CalendarEditorPayload) => {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke<void>("open_calendar_editor_window", { payload });
};

export const draftToEventInput = (
  draft: CalendarEventDraft,
): CalendarEventInput => {
  const title = draft.title.trim();
  if (!title) {
    throw new CalendarEventValidationError(
      "title",
      "タイトルを入力してください。",
    );
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
    toMachineDate(parseMachineDate(draft.date)) !== draft.date
  ) {
    throw new CalendarEventValidationError("date", "日付を入力してください。");
  }

  if (draft.allDay) {
    return {
      title,
      notes: draft.notes,
      schedule: {
        kind: "allDay",
        startDate: draft.date,
        endDateExclusive: addDays(
          draft.date,
          Math.max(1, draft.allDayDurationDays),
        ),
      },
    };
  }

  const startMinutes = timeInputToMinutes(draft.startTime);
  if (startMinutes === null) {
    throw new CalendarEventValidationError(
      "startTime",
      "開始時刻を入力してください。",
    );
  }
  const endMinutes = timeInputToMinutes(draft.endTime);
  if (endMinutes === null || endMinutes <= startMinutes) {
    throw new CalendarEventValidationError(
      "endTime",
      "終了時刻は開始時刻より後にしてください。",
    );
  }

  const startsAt = new Date(`${draft.date}T${draft.startTime}:00`);
  const endsAt = new Date(`${draft.date}T${draft.endTime}:00`);

  return {
    title,
    notes: draft.notes,
    schedule: {
      kind: "timed",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    },
  };
};

export const eventOccursOnDate = (event: CalendarEvent, date: string) => {
  if (event.schedule.kind === "allDay") {
    return (
      event.schedule.startDate <= date && event.schedule.endDateExclusive > date
    );
  }
  const startsAt = new Date(event.schedule.startsAt);
  const endsAt = new Date(event.schedule.endsAt);
  const dayStart = parseMachineDate(date);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return startsAt < dayEnd && endsAt > dayStart;
};

export const eventsForDate = (events: CalendarEvent[], date: string) =>
  events
    .filter((event) => eventOccursOnDate(event, date))
    .sort((left, right) => {
      if (left.schedule.kind !== right.schedule.kind) {
        return left.schedule.kind === "allDay" ? -1 : 1;
      }
      if (left.schedule.kind === "timed" && right.schedule.kind === "timed") {
        return left.schedule.startsAt.localeCompare(right.schedule.startsAt);
      }
      return left.title.localeCompare(right.title, "ja");
    });

export const formatEventTime = (event: CalendarEvent) => {
  if (event.schedule.kind === "allDay") return "終日";
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatter.format(new Date(event.schedule.startsAt))}–${formatter.format(new Date(event.schedule.endsAt))}`;
};

export const formatEventDate = (event: CalendarEvent) => {
  const value =
    event.schedule.kind === "allDay"
      ? parseMachineDate(event.schedule.startDate)
      : new Date(event.schedule.startsAt);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(value);
};

const formatClipboardDate = (value: Date) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(value);

export const formatEventForClipboard = (event: CalendarEvent) => {
  let dateLabel: string;
  if (event.schedule.kind === "allDay") {
    const start = parseMachineDate(event.schedule.startDate);
    const end = parseMachineDate(addDays(event.schedule.endDateExclusive, -1));
    const startLabel = formatClipboardDate(start);
    const endLabel = formatClipboardDate(end);
    dateLabel =
      startLabel === endLabel ? startLabel : `${startLabel}〜${endLabel}`;
  } else {
    dateLabel = formatClipboardDate(new Date(event.schedule.startsAt));
  }

  return [
    event.title,
    `${dateLabel} ${formatEventTime(event)}`,
    event.notes.trim(),
  ]
    .filter(Boolean)
    .join("\n");
};
