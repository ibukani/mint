import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  rememberGoogleCalendarSync,
  shouldRunAutomaticGoogleCalendarSync,
} from "../autoSyncPolicy";
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
  calendarIds: string[] | null,
  isVisible: boolean,
) => {
  const calendarIdsKey = calendarIds?.join("\u0000") ?? "";
  // Keep the selected IDs stable by content so unrelated overlay renders do
  // not restart the automatic sync effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: calendarIdsKey is the intentional content-based dependency.
  const stableCalendarIds = useMemo(() => calendarIds, [calendarIdsKey]);
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
  const isVisibleRef = useRef(isVisible);
  isVisibleRef.current = isVisible;

  const refresh = useCallback(() => {
    if (isVisibleRef.current) {
      setRevision((current) => current + 1);
    }
  }, []);

  const sync = useCallback(
    async (force = false) => {
      if (!isVisibleRef.current) return;
      const sequence = ++syncSequenceRef.current;
      setSyncError("");
      const selectedCalendarIds = stableCalendarIds;

      try {
        if (!selectedCalendarIds || selectedCalendarIds.length === 0) return;
        const connection = await getGoogleCalendarConnection();
        if (
          !force &&
          !shouldRunAutomaticGoogleCalendarSync(connection, selectedCalendarIds)
        ) {
          return;
        }

        setSyncing(true);

        await syncGoogleCalendars(selectedCalendarIds);
        rememberGoogleCalendarSync(selectedCalendarIds);
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
    },
    [refresh, stableCalendarIds],
  );

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  // showSequence is an explicit event-driven signal for a newly shown window.
  // biome-ignore lint/correctness/useExhaustiveDependencies: showSequence intentionally retriggers sync without being read by the effect body.
  useEffect(() => {
    if (isVisible) void sync();
  }, [isVisible, showSequence, sync]);

  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | undefined;
    const unlistenPromise = listen<CalendarEventsChangedPayload>(
      CALENDAR_EVENTS_CHANGED_EVENT,
      ({ payload }) => {
        if (!isVisibleRef.current) return;
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

  // Both counters are explicit reload signals; the request itself is derived
  // from the current view and must restart when either one changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: showSequence and revision intentionally retrigger the request.
  useEffect(() => {
    if (!isVisible) return;
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
  }, [isVisible, viewMonth, today, showSequence, revision]);

  useEffect(() => {
    if (isVisible) return;
    requestSequenceRef.current += 1;
    syncSequenceRef.current += 1;
    setEvents([]);
    setNextEvent(null);
    setLastChangedEvent(null);
    setError("");
    setSyncError("");
    setSyncing(false);
    setLoading(false);
  }, [isVisible]);

  return {
    events,
    lastChangedEvent,
    nextEvent,
    loading,
    error,
    refresh,
    syncError,
    syncing,
    retrySync: () => sync(true),
  };
};
