import {
  CalendarSync,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cloud,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button, Field, Select, Switch } from "../../../design/components";
import { useGoogleCalendarSettings } from "../hooks/useGoogleCalendarSettings";

const operationLabels = {
  connecting: "Googleアカウントを接続しています…",
  syncing: "Google Calendarと同期しています…",
  disconnecting: "Google Calendarの接続を解除しています…",
} as const;

export const GoogleCalendarSettings = () => {
  const {
    calendar,
    connection,
    calendars,
    loading,
    operation,
    busy,
    error,
    notice,
    reload,
    connect,
    sync,
    disconnect,
    toggleCalendar,
    setDefaultCalendar,
  } = useGoogleCalendarSettings();

  if (!calendar) return null;

  const writableCalendars = calendars.filter(
    (item) =>
      ["writer", "owner"].includes(item.accessRole) &&
      calendar.selectedGoogleCalendarIds.includes(item.id),
  );
  const activity = operation
    ? operationLabels[operation]
    : connection?.syncing
      ? "別の画面で開始した同期を完了しています…"
      : loading && connection
        ? "接続状態を更新しています…"
        : "";

  return (
    <section
      className="settings-group calendar-google-settings"
      aria-labelledby="google-calendar-title"
      aria-busy={busy}
    >
      <div className="settings-group__heading">
        <CalendarSync size={18} aria-hidden="true" />
        <div>
          <h3 id="google-calendar-title">Google Calendar連携</h3>
          <p>予定を一か所にまとめ、変更を双方向で同期します。</p>
        </div>
      </div>

      {connection === null ? (
        <div
          className={`calendar-google-state${error ? " is-error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error ? (
            <CircleAlert size={20} aria-hidden="true" />
          ) : (
            <LoaderCircle
              className="spinner-icon"
              size={20}
              aria-hidden="true"
            />
          )}
          <div>
            <strong>
              {error
                ? "接続状態を確認できませんでした"
                : "Google Calendarの接続状態を確認中"}
            </strong>
            <span>
              {error
                ? error
                : "保存済みの認証情報と同期状態を読み込んでいます。"}
            </span>
          </div>
          {error && (
            <Button variant="ghost" disabled={loading} onClick={reload}>
              <RefreshCw size={14} aria-hidden="true" />
              再確認
            </Button>
          )}
        </div>
      ) : !connection.connected ? (
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
            <h4>いつもの予定を、そのままMintへ</h4>
            <p>表示する予定表と新規予定の保存先は、接続後に個別に選べます。</p>
            <span>
              <ShieldCheck size={14} aria-hidden="true" />
              認証情報はOSの安全な領域に保存されます
            </span>
          </div>
          <Button disabled={busy} onClick={connect}>
            {operation === "connecting" ? (
              <LoaderCircle
                className="spinner-icon"
                size={15}
                aria-hidden="true"
              />
            ) : null}
            {operation === "connecting"
              ? "接続しています…"
              : "Googleアカウントを接続"}
          </Button>
        </div>
      ) : (
        <>
          <div className="calendar-google-account">
            {connection.syncing ? (
              <LoaderCircle
                className="spinner-icon"
                size={18}
                aria-hidden="true"
              />
            ) : (
              <CheckCircle2 size={18} aria-hidden="true" />
            )}
            <div>
              <strong>Googleアカウント接続済み</strong>
              <span>
                {connection.accountEmail || "接続済みのGoogleアカウント"}
              </span>
            </div>
            <span className="design-status-badge design-status-badge--available">
              接続中
            </span>
          </div>

          {activity && (
            <div className="calendar-google-activity" role="status">
              <LoaderCircle
                className="spinner-icon"
                size={16}
                aria-hidden="true"
              />
              {activity}
            </div>
          )}

          {connection.pendingOperations > 0 && (
            <div className="calendar-google-pending" role="status">
              <CircleAlert size={18} aria-hidden="true" />
              <div>
                <strong>
                  未同期の変更が{connection.pendingOperations}件あります
                </strong>
                <span>
                  接続を解除する前に「今すぐ同期」を実行してください。
                </span>
              </div>
            </div>
          )}

          <div className="calendar-google-list-heading">
            <strong>表示する予定表</strong>
            <span>
              {calendar.selectedGoogleCalendarIds.length}/{calendars.length}
              件を同期
            </span>
          </div>
          {connection.syncing || (loading && calendars.length === 0) ? (
            <div className="calendar-google-list-state" role="status">
              <LoaderCircle
                className="spinner-icon"
                size={18}
                aria-hidden="true"
              />
              予定表を読み込んでいます…
            </div>
          ) : calendars.length === 0 ? (
            <div className="calendar-google-list-state">
              {error ? (
                <CircleAlert size={20} aria-hidden="true" />
              ) : (
                <CalendarSync size={20} aria-hidden="true" />
              )}
              <div>
                <strong>
                  {error
                    ? "予定表を表示できませんでした"
                    : "表示できる予定表がありません"}
                </strong>
                <span>
                  {error
                    ? "下のエラーを確認して、接続状態を再確認してください。"
                    : "Google Calendar側で予定表を作成してから再確認してください。"}
                </span>
              </div>
              {!error && (
                <Button variant="ghost" disabled={busy} onClick={reload}>
                  <RefreshCw size={14} aria-hidden="true" />
                  再確認
                </Button>
              )}
            </div>
          ) : (
            <div className="calendar-google-list">
              {calendars.map((item) => (
                <div key={item.id} className="calendar-google-row">
                  <span
                    className={`calendar-google-row__color${item.primary ? " is-primary" : ""}`}
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
                    checked={calendar.selectedGoogleCalendarIds.includes(
                      item.id,
                    )}
                    disabled={busy}
                    onChange={(event) =>
                      toggleCalendar(item.id, event.target.checked)
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <Field
            id="google-calendar-default"
            label="新規予定の保存先"
            helpText={
              writableCalendars.length === 0
                ? "編集可能な予定表を1つ以上オンにすると選択できます。"
                : "Mintで追加した予定のGoogle Calendar側の保存先です。"
            }
          >
            <Select
              id="google-calendar-default"
              value={calendar.defaultGoogleCalendarId}
              disabled={busy || writableCalendars.length === 0}
              onChange={(event) => setDefaultCalendar(event.target.value)}
            >
              <option value="">選択してください</option>
              {writableCalendars.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="calendar-google-actions">
            <Button disabled={busy} onClick={sync}>
              {operation === "syncing" && (
                <LoaderCircle
                  className="spinner-icon"
                  size={15}
                  aria-hidden="true"
                />
              )}
              {operation === "syncing" ? "同期しています…" : "今すぐ同期"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy || connection.pendingOperations > 0}
              title={
                connection.pendingOperations > 0
                  ? "未同期の変更を同期してから接続を解除してください"
                  : undefined
              }
              onClick={disconnect}
            >
              {operation === "disconnecting" ? "解除しています…" : "接続を解除"}
            </Button>
          </div>

          {connection.lastSyncedAt && (
            <p className="calendar-google-last-sync">
              <Clock3 size={14} aria-hidden="true" />
              最終同期:{" "}
              <time dateTime={connection.lastSyncedAt}>
                {new Date(connection.lastSyncedAt).toLocaleString()}
              </time>
            </p>
          )}
        </>
      )}

      {notice && (
        <p className="calendar-google-notice" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {notice}
        </p>
      )}
      {error && connection !== null && (
        <div className="calendar-google-error" role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <span>{error}</span>
          <Button variant="ghost" disabled={loading} onClick={reload}>
            <RefreshCw size={14} aria-hidden="true" />
            状態を再確認
          </Button>
        </div>
      )}
    </section>
  );
};
