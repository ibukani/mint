export interface CalendarSettings {
  enabled: boolean;
  shortcut: string;
  createEventShortcut: string;
  selectedGoogleCalendarIds: string[];
  defaultGoogleCalendarId: string;
  themeColor: string;
}

export interface GoogleCalendarInfo {
  id: string;
  name: string;
  primary: boolean;
  accessRole: "freeBusyReader" | "reader" | "writer" | "owner";
  backgroundColor: string;
}

export interface GoogleCalendarConnection {
  connected: boolean;
  accountEmail: string;
  lastSyncedAt: string | null;
  pendingOperations: number;
  error: string | null;
  syncing: boolean;
}

export interface GoogleCalendarSyncResult {
  syncedCalendars: number;
  changedEvents: number;
  pendingOperations: number;
  syncedAt: string;
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

export type CalendarEventSource =
  | { kind: "local" }
  | {
      kind: "google";
      calendarId: string;
      eventId: string;
      etag: string;
      accessRole: "freeBusyReader" | "reader" | "writer" | "owner";
      recurringEventId?: string;
      originalStartTime?: string;
    };

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

export interface CalendarEditorPayload {
  mode: "create" | "edit" | "duplicate";
  date?: string;
  event?: CalendarEvent;
  template?: CalendarEvent;
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
  allDayDurationDays: number;
  startTime: string;
  endTime: string;
  allDay: boolean;
  notes: string;
}

export type CalendarOpenMode = "month" | "createEvent";
