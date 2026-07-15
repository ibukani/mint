import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatEventTime } from "../events";
import type { CalendarEvent } from "../types";

interface CalendarDayAgendaProps {
  date: string;
  events: CalendarEvent[];
  loading: boolean;
  error: string;
  onAdd: () => void;
  onBack: () => void;
  onNextDay: () => void;
  onPreviousDay: () => void;
  onRetry: () => void;
  onSelect: (event: CalendarEvent) => void;
}

const dayAgendaHintId = "calendar-day-agenda-hint";

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
  onNextDay,
  onPreviousDay,
  onRetry,
  onSelect,
}) => {
  const [focusedEventId, setFocusedEventId] = useState<string | null>(
    events[0]?.id ?? null,
  );
  const eventRefs = useRef(new Map<string, HTMLButtonElement>());
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const retryButtonRef = useRef<HTMLButtonElement>(null);
  const autoFocusedDateRef = useRef<string | null>(null);
  const firstEventId = events[0]?.id ?? null;
  const focusableEventId = useMemo(
    () =>
      events.find((event) => event.id === focusedEventId)?.id ??
      events[0]?.id ??
      null,
    [events, focusedEventId],
  );

  useEffect(() => {
    void date;
    setFocusedEventId(firstEventId);
  }, [date, firstEventId]);

  useEffect(() => {
    if (loading || autoFocusedDateRef.current === date) return;
    const target = error
      ? retryButtonRef.current
      : (eventRefs.current.get(firstEventId ?? "") ?? addButtonRef.current);
    if (!target) return;
    target.focus({ preventScroll: true });
    autoFocusedDateRef.current = date;
  }, [date, error, firstEventId, loading]);

  const moveFocus = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = events.findIndex(
      (calendarEvent) =>
        calendarEvent.id === event.currentTarget.dataset.eventId,
    );
    if (currentIndex < 0) return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "ArrowLeft") onPreviousDay();
      else onNextDay();
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") {
      nextIndex = Math.min(events.length - 1, currentIndex + 1);
    } else if (event.key === "ArrowUp") {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = events.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    event.stopPropagation();
    if (nextIndex === currentIndex) return;

    const nextEvent = events[nextIndex];
    if (!nextEvent) return;
    setFocusedEventId(nextEvent.id);
    eventRefs.current.get(nextEvent.id)?.focus({ preventScroll: true });
  };

  return (
    <section
      className="calendar-screen calendar-day-agenda"
      aria-describedby={dayAgendaHintId}
    >
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
        <div className="calendar-screen__header-actions">
          <button
            type="button"
            className="calendar-icon-button"
            aria-label="前の日"
            aria-keyshortcuts="ArrowLeft"
            title="前の日（←）"
            onClick={onPreviousDay}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="calendar-icon-button"
            aria-label="次の日"
            aria-keyshortcuts="ArrowRight"
            title="次の日（→）"
            onClick={onNextDay}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <button
            ref={addButtonRef}
            type="button"
            className="calendar-icon-button"
            aria-label="この日に予定を追加"
            aria-keyshortcuts="N"
            title="この日に予定を追加（N）"
            onClick={onAdd}
          >
            <Plus size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <p id={dayAgendaHintId} className="calendar-day-agenda__hint">
        ←→で前後の日へ移動、予定にフォーカスして↑↓で移動、Home/Endで先頭・末尾、Enterで詳細
      </p>

      <div
        className="calendar-day-agenda__list"
        aria-live="polite"
        data-window-drag-block
      >
        {loading && <p className="calendar-screen__status">読み込み中…</p>}
        {!loading && error && (
          <div className="calendar-screen__load-error" role="alert">
            <p>{error}</p>
            <button ref={retryButtonRef} type="button" onClick={onRetry}>
              <RefreshCw size={14} aria-hidden="true" />
              再読み込み
            </button>
          </div>
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
              ref={(element) => {
                if (element) eventRefs.current.set(event.id, element);
                else eventRefs.current.delete(event.id);
              }}
              type="button"
              className="calendar-agenda-item"
              key={event.id}
              data-event-id={event.id}
              tabIndex={event.id === focusableEventId ? 0 : -1}
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Home End Enter"
              onFocus={() => setFocusedEventId(event.id)}
              onKeyDown={moveFocus}
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
};
