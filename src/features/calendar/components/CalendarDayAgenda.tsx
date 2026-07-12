import { ArrowLeft, Plus } from "lucide-react";
import type React from "react";
import { formatEventTime } from "../events";
import type { CalendarEvent } from "../types";

interface CalendarDayAgendaProps {
  date: string;
  events: CalendarEvent[];
  loading: boolean;
  error: string;
  onAdd: () => void;
  onBack: () => void;
  onSelect: (event: CalendarEvent) => void;
}

const formatDateHeading = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
};

export const CalendarDayAgenda: React.FC<CalendarDayAgendaProps> = ({
  date,
  events,
  loading,
  error,
  onAdd,
  onBack,
  onSelect,
}) => (
  <section className="calendar-screen calendar-day-agenda">
    <header className="calendar-screen__header">
      <button
        type="button"
        className="calendar-icon-button"
        aria-label="月表示に戻る"
        onClick={onBack}
      >
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <h2>{formatDateHeading(date)}</h2>
      <button
        type="button"
        className="calendar-icon-button"
        aria-label="この日に予定を追加"
        aria-keyshortcuts="N"
        title="この日に予定を追加（N）"
        onClick={onAdd}
      >
        <Plus size={18} aria-hidden="true" />
      </button>
    </header>

    <div
      className="calendar-day-agenda__list"
      aria-live="polite"
      data-window-drag-block
    >
      {loading && <p className="calendar-screen__status">読み込み中…</p>}
      {!loading && error && (
        <p className="calendar-screen__status is-error">{error}</p>
      )}
      {!loading && !error && events.length === 0 && (
        <div className="calendar-screen__empty">
          <p>この日の予定はありません</p>
          <button type="button" onClick={onAdd}>
            <Plus size={16} aria-hidden="true" />
            予定を追加
          </button>
        </div>
      )}
      {!loading &&
        !error &&
        events.map((event) => (
          <button
            type="button"
            className="calendar-agenda-item"
            key={event.id}
            onClick={() => onSelect(event)}
          >
            <span className="calendar-agenda-item__time">
              {formatEventTime(event)}
            </span>
            <span className="calendar-agenda-item__title">{event.title}</span>
          </button>
        ))}
    </div>
  </section>
);
