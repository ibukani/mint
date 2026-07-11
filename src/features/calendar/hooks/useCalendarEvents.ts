import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSettings } from "../../../core/context/AppSettings";
import {
  buildEventCursor,
  buildEventRange,
  getNextCalendarEvent,
  listCalendarEvents,
} from "../events";
import {
  getGoogleCalendarConnection,
  syncGoogleCalendars,
} from "../googleCalendar";
import type { CalendarEvent } from "../types";

export const useCalendarEvents = (
  viewMonth: Date,
  today: Date,
  showSequence: number,
) => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const requestSequenceRef = useRef(0);

  const refresh = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(() => {
    void showSequence;
    let active = true;
    invoke<AppSettings>("load_settings")
      .then(async (settings) => {
        const connection = await getGoogleCalendarConnection();
        if (!connection.connected) return null;
        return syncGoogleCalendars(settings.calendar.selectedGoogleCalendarIds);
      })
      .then((result) => {
        if (active && result) refresh();
      })
      .catch((syncError) =>
        console.warn("Google Calendar sync was skipped:", syncError),
      );
    return () => {
      active = false;
    };
  }, [showSequence, refresh]);

  useEffect(() => {
    void showSequence;
    void revision;
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    setLoading(true);
    setError("");

    Promise.all([
      listCalendarEvents(buildEventRange(viewMonth, today)),
      getNextCalendarEvent(buildEventCursor(new Date())),
    ])
      .then(([nextEvents, upcoming]) => {
        if (requestSequenceRef.current !== requestSequence) return;
        setEvents(nextEvents);
        setNextEvent(upcoming);
      })
      .catch((loadError) => {
        if (requestSequenceRef.current !== requestSequence) return;
        console.error("Failed to load calendar events:", loadError);
        setError("予定を読み込めませんでした");
      })
      .finally(() => {
        if (requestSequenceRef.current === requestSequence) setLoading(false);
      });
  }, [viewMonth, today, showSequence, revision]);

  return { events, nextEvent, loading, error, refresh };
};
