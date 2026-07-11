import { CalendarSync, CheckCircle2, Cloud, ShieldCheck } from "lucide-react";
import { Button, Field, Select, Switch } from "../../../design/components";
import { useGoogleCalendarSettings } from "../hooks/useGoogleCalendarSettings";

export const GoogleCalendarSettings = () => {
  const {
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
  } = useGoogleCalendarSettings();

  if (!calendar) return null;

  return (
    <section
      className="settings-group calendar-google-settings"
      aria-labelledby="google-calendar-title"
    >
      <div className="settings-group__heading">
        <CalendarSync size={18} aria-hidden="true" />
        <div>
          <h3 id="google-calendar-title">Google Calendar連携</h3>
          <p>予定を一か所にまとめ、変更を双方向で同期します。</p>
        </div>
      </div>
      {!connection?.connected ? (
        <div className="calendar-google-onboarding">
          <div
            className="calendar-google-onboarding__visual"
            aria-hidden="true"
          >
            <Cloud size={24} />
            <span />
            <CalendarSync size={24} />
          </div>
          <div className="calendar-google-onboarding__copy">
            <h4>いつもの予定を、そのままmintへ</h4>
            <p>表示する予定表と新規予定の保存先は、接続後に個別に選べます。</p>
            <span>
              <ShieldCheck size={14} aria-hidden="true" />
              認証情報はOSの安全な領域に保存されます
            </span>
          </div>
          <Button disabled={busy} onClick={connect}>
            {busy ? "接続しています…" : "Googleアカウントを接続"}
          </Button>
        </div>
      ) : (
        <>
          <div className="calendar-google-account">
            <CheckCircle2 size={18} aria-hidden="true" />
            <div>
              <strong>Googleアカウント接続済み</strong>
              <span>{connection.accountEmail}</span>
            </div>
          </div>
          <div className="calendar-google-list-heading">
            <strong>表示する予定表</strong>
            <span>
              {calendar.selectedGoogleCalendarIds.length}/{calendars.length}
              件を同期
            </span>
          </div>
          <div className="calendar-google-list">
            {calendars.map((item) => (
              <div key={item.id} className="calendar-google-row">
                <span
                  className="calendar-google-row__color"
                  aria-hidden="true"
                />
                <label
                  className="calendar-google-row__copy"
                  htmlFor={`google-calendar-${item.id}`}
                >
                  <strong>{item.name}</strong>
                  <small>
                    {item.primary ? "メイン予定表" : "追加の予定表"} ·{" "}
                    {item.accessRole === "reader" ||
                    item.accessRole === "freeBusyReader"
                      ? "閲覧のみ"
                      : "編集可能"}
                  </small>
                </label>
                <Switch
                  id={`google-calendar-${item.id}`}
                  aria-label={`${item.name}を同期`}
                  checked={calendar.selectedGoogleCalendarIds.includes(item.id)}
                  onChange={(event) =>
                    toggleCalendar(item.id, event.target.checked)
                  }
                />
              </div>
            ))}
          </div>
          <Field id="google-calendar-default" label="新規予定の保存先">
            <Select
              id="google-calendar-default"
              value={calendar.defaultGoogleCalendarId}
              onChange={(event) => setDefaultCalendar(event.target.value)}
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
            <Button disabled={busy} onClick={sync}>
              今すぐ同期
            </Button>
            <Button variant="ghost" disabled={busy} onClick={disconnect}>
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
      {error && (
        <p className="calendar-google-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
