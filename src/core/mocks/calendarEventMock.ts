import type {
  CalendarEvent,
  CalendarEventCursor,
  CalendarEventInput,
  CalendarEventRange,
} from "../../features/calendar/types";

const STORAGE_KEY = "mint_mock_calendar_events";

const loadEvents = (): CalendarEvent[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as CalendarEvent[]) : [];
  } catch {
    return [];
  }
};

const saveEvents = (events: CalendarEvent[]) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));

const validateInput = (input: CalendarEventInput) => {
  if (!input.title.trim()) throw new Error("Title is required.");
  if (input.schedule.kind === "allDay") {
    if (input.schedule.endDateExclusive <= input.schedule.startDate) {
      throw new Error("endDateExclusive must be after startDate.");
    }
  } else {
    const startsAt = new Date(input.schedule.startsAt);
    const endsAt = new Date(input.schedule.endsAt);
    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new Error("endsAt must be after startsAt.");
    }
  }
};

const normalizeInput = (input: CalendarEventInput): CalendarEventInput => ({
  ...input,
  title: input.title.trim(),
  schedule:
    input.schedule.kind === "allDay"
      ? input.schedule
      : {
          ...input.schedule,
          startsAt: new Date(input.schedule.startsAt).toISOString(),
          endsAt: new Date(input.schedule.endsAt).toISOString(),
        },
});

const overlapsRange = (event: CalendarEvent, range: CalendarEventRange) =>
  event.schedule.kind === "allDay"
    ? event.schedule.startDate < range.endDateExclusive &&
      event.schedule.endDateExclusive > range.startDate
    : event.schedule.startsAt < range.endInstant &&
      event.schedule.endsAt > range.startInstant;

const eventOrderValue = (event: CalendarEvent) =>
  event.schedule.kind === "allDay"
    ? event.schedule.startDate
    : event.schedule.startsAt;

export const mockListCalendarEvents = (range: CalendarEventRange) =>
  loadEvents()
    .filter((event) => overlapsRange(event, range))
    .sort((left, right) =>
      eventOrderValue(left).localeCompare(eventOrderValue(right)),
    );

export const mockGetNextCalendarEvent = (cursor: CalendarEventCursor) => {
  const candidates = loadEvents().filter((event) =>
    event.schedule.kind === "allDay"
      ? event.schedule.endDateExclusive > cursor.todayDate
      : event.schedule.endsAt > cursor.nowInstant,
  );
  candidates.sort((left, right) => {
    const leftActive =
      left.schedule.kind === "allDay"
        ? left.schedule.startDate <= cursor.todayDate
        : left.schedule.startsAt <= cursor.nowInstant;
    const rightActive =
      right.schedule.kind === "allDay"
        ? right.schedule.startDate <= cursor.todayDate
        : right.schedule.startsAt <= cursor.nowInstant;
    if (leftActive !== rightActive) return leftActive ? -1 : 1;
    return eventOrderValue(left).localeCompare(eventOrderValue(right));
  });
  return candidates[0] ?? null;
};

export const mockCreateCalendarEvent = (input: CalendarEventInput) => {
  validateInput(input);
  const normalized = normalizeInput(input);
  const timestamp = new Date().toISOString();
  const event: CalendarEvent = {
    ...normalized,
    id:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `mock-${Date.now()}`,
    source: { kind: "local" },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const events = loadEvents();
  events.push(event);
  saveEvents(events);
  return event;
};

export const mockUpdateCalendarEvent = (
  id: string,
  input: CalendarEventInput,
) => {
  validateInput(input);
  const normalized = normalizeInput(input);
  const events = loadEvents();
  const index = events.findIndex((event) => event.id === id);
  if (index < 0) throw new Error("Calendar event was not found.");
  const previous = events[index];
  if (!previous) throw new Error("Calendar event was not found.");
  const updated: CalendarEvent = {
    ...previous,
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
  events[index] = updated;
  saveEvents(events);
  return updated;
};

export const mockDeleteCalendarEvent = (id: string) => {
  const events = loadEvents();
  const remaining = events.filter((event) => event.id !== id);
  if (remaining.length === events.length) {
    throw new Error("Calendar event was not found.");
  }
  saveEvents(remaining);
};
