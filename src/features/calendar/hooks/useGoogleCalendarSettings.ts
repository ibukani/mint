import { useCallback, useEffect, useRef, useState } from "react";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarConnection,
  listGoogleCalendars,
  syncGoogleCalendars,
} from "../googleCalendar";
import { formatGoogleCalendarError } from "../googleCalendarErrors";
import type {
  GoogleCalendarConnection,
  GoogleCalendarInfo,
  GoogleCalendarSyncResult,
} from "../types";

type GoogleCalendarOperation = "connecting" | "syncing" | "disconnecting";

const syncNotice = (result: GoogleCalendarSyncResult) => {
  if (result.pendingOperations > 0) {
    return `同期を完了しました。未送信の変更が${result.pendingOperations}件あります。`;
  }
  if (result.changedEvents > 0) {
    return `${result.changedEvents}件の予定を更新しました。`;
  }
  return "同期が完了しました。予定は最新です。";
};

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
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<GoogleCalendarOperation | null>(
    null,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const mountedRef = useRef(false);
  const operationRef = useRef<GoogleCalendarOperation | null>(null);
  const reloadSequenceRef = useRef(0);

  const reload = useCallback(async () => {
    const sequence = ++reloadSequenceRef.current;
    if (mountedRef.current) {
      setLoading(true);
      setError("");
    }
    try {
      const next = await getGoogleCalendarConnection();
      if (!mountedRef.current || sequence !== reloadSequenceRef.current) {
        return false;
      }
      setConnection(next);
      setError(next.error ? formatGoogleCalendarError(next.error) : "");

      if (!next.connected || next.syncing) {
        setCalendars([]);
        return true;
      }

      const nextCalendars = await listGoogleCalendars();
      if (!mountedRef.current || sequence !== reloadSequenceRef.current) {
        return false;
      }
      setCalendars(nextCalendars);
      return true;
    } catch (reason) {
      if (mountedRef.current && sequence === reloadSequenceRef.current) {
        setError(formatGoogleCalendarError(reason));
      }
      return false;
    } finally {
      if (mountedRef.current && sequence === reloadSequenceRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void reload();
    return () => {
      mountedRef.current = false;
      reloadSequenceRef.current += 1;
    };
  }, [reload]);

  useEffect(() => {
    if (!connection?.syncing || operation) return;
    let cancelled = false;
    let timeout = 0;
    const poll = async () => {
      await reload();
      if (!cancelled) timeout = window.setTimeout(() => void poll(), 1_000);
    };
    timeout = window.setTimeout(() => void poll(), 1_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [connection?.syncing, operation, reload]);

  const run = useCallback(
    async <T>(
      nextOperation: GoogleCalendarOperation,
      action: () => Promise<T>,
      getNotice: (result: T) => string,
    ) => {
      if (operationRef.current) return;
      operationRef.current = nextOperation;
      setOperation(nextOperation);
      setError("");
      setNotice("");
      try {
        const result = await action();
        const reloaded = await reload();
        if (mountedRef.current && reloaded) {
          setNotice(getNotice(result));
        }
      } catch (reason) {
        if (mountedRef.current) {
          setError(formatGoogleCalendarError(reason));
        }
      } finally {
        operationRef.current = null;
        if (mountedRef.current) setOperation(null);
      }
    },
    [reload],
  );

  const connect = useCallback(
    () =>
      run(
        "connecting",
        connectGoogleCalendar,
        () => "Google Calendarに接続しました。",
      ),
    [run],
  );

  const sync = useCallback(() => {
    if (!calendar) return Promise.resolve();
    return run(
      "syncing",
      () => syncGoogleCalendars(calendar.selectedGoogleCalendarIds),
      syncNotice,
    );
  }, [calendar, run]);

  const disconnect = useCallback(
    () =>
      run(
        "disconnecting",
        async () => {
          await disconnectGoogleCalendar();
          updateFeatureSettings({
            selectedGoogleCalendarIds: [],
            defaultGoogleCalendarId: "",
          });
        },
        () => "Google Calendarの接続を解除しました。",
      ),
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
    loading,
    operation,
    busy: loading || operation !== null || Boolean(connection?.syncing),
    error,
    notice,
    reload,
    connect,
    sync,
    disconnect,
    toggleCalendar,
    setDefaultCalendar,
  };
};
