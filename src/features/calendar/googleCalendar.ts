import { invoke } from "@tauri-apps/api/core";
import type {
  GoogleCalendarConnection,
  GoogleCalendarInfo,
  GoogleCalendarSyncResult,
} from "./types";

export const getGoogleCalendarConnection = () =>
  invoke<GoogleCalendarConnection>("get_google_calendar_connection");

export const connectGoogleCalendar = () =>
  invoke<GoogleCalendarConnection>("connect_google_calendar");

export const listGoogleCalendars = () =>
  invoke<GoogleCalendarInfo[]>("list_google_calendars");

export const syncGoogleCalendars = (calendarIds: string[]) =>
  invoke<GoogleCalendarSyncResult>("sync_google_calendars", { calendarIds });

export const disconnectGoogleCalendar = () =>
  invoke<void>("disconnect_google_calendar");
