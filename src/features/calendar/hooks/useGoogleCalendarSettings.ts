import { useCallback, useEffect, useRef, useState } from "react";
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
  const {
    featureSettings: calendar,
    handleChange,
    updateFeatureSettings,
  } = useFeatureSettings("calendar");
  const [connection, setConnection] = useState<GoogleCalendarConnection | null>(
    null,
  );
  const [calendars, setCalendars] = useState<GoogleCalendarInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const reloadSequenceRef = useRef(0);

  const reload = useCallback(async () => {
    const sequence = ++reloadSequenceRef.current;
    const next = await getGoogleCalendarConnection();
    const nextCalendars = next.connected ? await listGoogleCalendars() : [];
    if (sequence !== reloadSequenceRef.current) return;
    setConnection(next);
    setCalendars(nextCalendars);
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
        updateFeatureSettings({
          selectedGoogleCalendarIds: [],
          defaultGoogleCalendarId: "",
        });
      }),
    [run, updateFeatureSettings],
  );

  const toggleCalendar = useCallback(
    (id: string, checked: boolean) => {
      if (!calendar) return;
      const selected = checked
        ? [...calendar.selectedGoogleCalendarIds, id]
        : calendar.selectedGoogleCalendarIds.filter((value) => value !== id);
      updateFeatureSettings({
        selectedGoogleCalendarIds: [...new Set(selected)],
        ...(!checked && calendar.defaultGoogleCalendarId === id
          ? { defaultGoogleCalendarId: "" }
          : {}),
      });
    },
    [calendar, updateFeatureSettings],
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
