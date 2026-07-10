export interface CalendarSettings {
  enabled: boolean;
  shortcut: string;
  createEventShortcut: string;
}

export interface AllDayEventSchedule {
  kind: "allDay";
  startDate: string;
  endDateExclusive: string;
}

export interface TimedEventSchedule {
  kind: "timed";
  startsAt: string;
  endsAt: string;
  timeZone: string;
}

export type CalendarEventSchedule = AllDayEventSchedule | TimedEventSchedule;

export interface CalendarEventSource {
  kind: "local";
}

export interface CalendarEventInput {
  title: string;
  notes: string;
  schedule: CalendarEventSchedule;
}

export interface CalendarEvent extends CalendarEventInput {
  id: string;
  source: CalendarEventSource;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventRange {
  startInstant: string;
  endInstant: string;
  startDate: string;
  endDateExclusive: string;
}

export interface CalendarEventCursor {
  nowInstant: string;
  todayDate: string;
}

export interface CalendarEventDraft {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  notes: string;
}

export type CalendarOpenMode = "month" | "createEvent";
