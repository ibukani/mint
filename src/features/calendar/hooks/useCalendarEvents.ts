import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadSettings } from "../../../core/settings";
import {
  buildEventCursor,
  buildEventRange,
  CALENDAR_EVENTS_CHANGED_EVENT,
  type CalendarEventsChangedPayload,
  getNextCalendarEvent,
  listCalendarEvents,
} from "../events";
import {
  getGoogleCalendarConnection,
  syncGoogleCalendars,
} from "../googleCalendar";
import { formatGoogleCalendarError } from "../googleCalendarErrors";
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
  const [syncError, setSyncError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastChangedEvent, setLastChangedEvent] =
    useState<CalendarEvent | null>(null);
  const [revision, setRevision] = useState(0);
  const requestSequenceRef = useRef(0);
  const syncSequenceRef = useRef(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(() => setRevision((current) => current + 1), []);

  const sync = useCallback(async () => {
    const sequence = ++syncSequenceRef.current;
    setSyncError("");

    try {
      const settings = await loadSettings();
      const connection = await getGoogleCalendarConnection();
      if (!connection.connected || connection.syncing) return;

      setSyncing(true);

      await syncGoogleCalendars(settings.calendar.selectedGoogleCalendarIds);
      if (!mountedRef.current || syncSequenceRef.current !== sequence) return;
      refresh();
    } catch (syncReason) {
      if (!mountedRef.current || syncSequenceRef.current !== sequence) return;
      console.warn("Google Calendar sync failed:", syncReason);
      setSyncError(formatGoogleCalendarError(syncReason));
    } finally {
      if (mountedRef.current && syncSequenceRef.current === sequence) {
        setSyncing(false);
      }
    }
  }, [refresh]);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  useEffect(() => {
    void showSequence;
    void sync();
  }, [showSequence, sync]);

  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | undefined;
    const unlistenPromise = listen<CalendarEventsChangedPayload>(
      CALENDAR_EVENTS_CHANGED_EVENT,
      ({ payload }) => {
        if (payload?.event) setLastChangedEvent(payload.event);
        refresh();
      },
    );

    void unlistenPromise.then((cleanup) => {
      if (isMounted) unlisten = cleanup;
      else cleanup();
    });

    return () => {
      isMounted = false;
      unlisten?.();
    };
  }, [refresh]);

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

  return {
    events,
    lastChangedEvent,
    nextEvent,
    loading,
    error,
    refresh,
    syncError,
    syncing,
    retrySync: sync,
  };
};
