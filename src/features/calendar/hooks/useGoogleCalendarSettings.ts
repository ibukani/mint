import { useCallback, useEffect, useState } from "react";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarConnection,
  listGoogleCalendars,
  syncGoogleCalendars,
} from "../googleCalendar";
import type { GoogleCalendarConnection, GoogleCalendarInfo } from "../types";

export const useGoogleCalendarSettings = () => {
  const { featureSettings: calendar, handleChange } =
    useFeatureSettings("calendar");
  const [connection, setConnection] = useState<GoogleCalendarConnection | null>(
    null,
  );
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    const next = await getGoogleCalendarConnection();
    setConnection(next);
    setCalendars(next.connected ? await listGoogleCalendars() : []);
  }, []);

  useEffect(() => {
    reload().catch((reason) => setError(String(reason)));
  }, [reload]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError("");
      try {
        await action();
        await reload();
      } catch (reason) {
        setError(String(reason));
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const connect = useCallback(() => run(connectGoogleCalendar), [run]);

  const sync = useCallback(() => {
    if (!calendar) return Promise.resolve();
    return run(() => syncGoogleCalendars(calendar.selectedGoogleCalendarIds));
  }, [calendar, run]);

  const disconnect = useCallback(
    () =>
      run(async () => {
        await disconnectGoogleCalendar();
        handleChange("selectedGoogleCalendarIds", []);
        handleChange("defaultGoogleCalendarId", "");
      }),
    [handleChange, run],
  );

  const toggleCalendar = useCallback(
    (id: string, checked: boolean) => {
      if (!calendar) return;
      const selected = checked
        ? [...calendar.selectedGoogleCalendarIds, id]
        : calendar.selectedGoogleCalendarIds.filter((value) => value !== id);
      handleChange("selectedGoogleCalendarIds", [...new Set(selected)]);
      if (!checked && calendar.defaultGoogleCalendarId === id) {
        handleChange("defaultGoogleCalendarId", "");
      }
    },
    [calendar, handleChange],
  );

  const setDefaultCalendar = useCallback(
    (id: string) => handleChange("defaultGoogleCalendarId", id),
    [handleChange],
  );

  return {
    calendar,
    connection,
    calendars,
    busy,
    error,
    connect,
    sync,
    disconnect,
    toggleCalendar,
    setDefaultCalendar,
  };
};
