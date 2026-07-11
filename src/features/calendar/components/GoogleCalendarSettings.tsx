import { useCallback, useEffect, useState } from "react";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";
import { Button, Field, Select, Switch } from "../../../design/components";
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleCalendarConnection,
  listGoogleCalendars,
  syncGoogleCalendars,
} from "../googleCalendar";
import type { GoogleCalendarConnection, GoogleCalendarInfo } from "../types";

export const GoogleCalendarSettings = () => {
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

  if (!calendar) return null;

  const run = async (action: () => Promise<unknown>) => {
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
  };

  const toggleCalendar = (id: string, checked: boolean) => {
    const selected = checked
      ? [...calendar.selectedGoogleCalendarIds, id]
      : calendar.selectedGoogleCalendarIds.filter((value) => value !== id);
    handleChange("selectedGoogleCalendarIds", [...new Set(selected)]);
    if (!checked && calendar.defaultGoogleCalendarId === id) {
      handleChange("defaultGoogleCalendarId", "");
    }
  };

  return (
    <section className="settings-group" aria-labelledby="google-calendar-title">
      <div className="settings-group__heading">
        <div>
          <h3 id="google-calendar-title">Google Calendar連携</h3>
          <p>複数の予定表をMintへ同期します。</p>
        </div>
      </div>
      {!connection?.connected ? (
        <Button disabled={busy} onClick={() => run(connectGoogleCalendar)}>
          Googleアカウントを接続
        </Button>
      ) : (
        <>
          <p>{connection.accountEmail || "Googleアカウント接続済み"}</p>
          {calendars.map((item) => (
            <div key={item.id} className="calendar-google-row">
              <Switch
                id={`google-calendar-${item.id}`}
                aria-label={`${item.name}を同期`}
                checked={calendar.selectedGoogleCalendarIds.includes(item.id)}
                onChange={(event) =>
                  toggleCalendar(item.id, event.target.checked)
                }
              />
              <label htmlFor={`google-calendar-${item.id}`}>{item.name}</label>
            </div>
          ))}
          <Field id="google-calendar-default" label="新規予定の保存先">
            <Select
              id="google-calendar-default"
              value={calendar.defaultGoogleCalendarId}
              onChange={(event) =>
                handleChange("defaultGoogleCalendarId", event.target.value)
              }
            >
              <option value="">選択してください</option>
              {calendars
                .filter(
                  (item) =>
                    ["writer", "owner"].includes(item.accessRole) &&
                    calendar.selectedGoogleCalendarIds.includes(item.id),
                )
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="calendar-google-actions">
            <Button
              disabled={busy}
              onClick={() =>
                run(() =>
                  syncGoogleCalendars(calendar.selectedGoogleCalendarIds),
                )
              }
            >
              今すぐ同期
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await disconnectGoogleCalendar();
                  handleChange("selectedGoogleCalendarIds", []);
                  handleChange("defaultGoogleCalendarId", "");
                })
              }
            >
              接続を解除
            </Button>
          </div>
          {connection.lastSyncedAt && (
            <p>
              最終同期: {new Date(connection.lastSyncedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
};
