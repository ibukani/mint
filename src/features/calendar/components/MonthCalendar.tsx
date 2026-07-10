import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { buildCalendarDays, shiftMonth, startOfMonth } from "../calendar";
import { eventsForDate, formatEventDate, formatEventTime } from "../events";
import type { CalendarEvent } from "../types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

interface MonthCalendarProps {
  error: string;
  events: CalendarEvent[];
  loading: boolean;
  nextEvent: CalendarEvent | null;
  onCreate: () => void;
  onOpenDay: (date: string) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onViewMonthChange: (month: Date) => void;
  today: Date;
  viewMonth: Date;
}

export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  error,
  events,
  loading,
  nextEvent,
  onCreate,
  onOpenDay,
  onOpenEvent,
  onViewMonthChange,
  today,
  viewMonth,
}) => {
  const days = useMemo(
    () => buildCalendarDays(viewMonth, today),
    [viewMonth, today],
  );
  const monthLabel = `${viewMonth.getFullYear()}年 ${viewMonth.getMonth() + 1}月`;

  const moveMonth = (delta: number) => {
    onViewMonthChange(shiftMonth(viewMonth, delta));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveMonth(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveMonth(1);
    }
  };

  return (
    <section
      className="month-calendar"
      aria-label="月間カレンダー"
      onKeyDown={handleKeyDown}
    >
      <header className="month-calendar__header">
        <div className="month-calendar__switcher">
          <button
            type="button"
            className="month-calendar__nav-button"
            aria-label="前の月"
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <h2 aria-live="polite">{monthLabel}</h2>
          <button
            type="button"
            className="month-calendar__nav-button"
            aria-label="次の月"
            onClick={() => moveMonth(1)}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="month-calendar__weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="month-calendar__grid">
        {days.map((day) => {
          const dayEvents = eventsForDate(events, day.machineDate);
          const eventLabel =
            dayEvents.length > 0 ? `、予定${dayEvents.length}件` : "";
          return (
            <button
              type="button"
              key={day.machineDate}
              className={`month-calendar__day${day.inCurrentMonth ? "" : " is-outside"}${day.isToday ? " is-today" : ""}`}
              aria-label={`${day.date.getMonth() + 1}月${day.date.getDate()}日${eventLabel}`}
              aria-current={day.isToday ? "date" : undefined}
              onClick={() => onOpenDay(day.machineDate)}
            >
              <time dateTime={day.machineDate}>{day.date.getDate()}</time>
              {dayEvents.length > 0 && (
                <span
                  className="month-calendar__event-dot"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <footer className="month-calendar__footer">
        <button
          type="button"
          className="month-calendar__today-button"
          onClick={() => onViewMonthChange(startOfMonth(today))}
        >
          今日
        </button>
        {nextEvent ? (
          <button
            type="button"
            className="month-calendar__next-event"
            aria-label={`次の予定、${nextEvent.title}`}
            onClick={() => onOpenEvent(nextEvent)}
          >
            <span>次の予定</span>
            <strong>
              {formatEventDate(nextEvent)} {formatEventTime(nextEvent)}
            </strong>
            <span>{nextEvent.title}</span>
          </button>
        ) : (
          <div
            className="month-calendar__next-event is-empty"
            aria-live="polite"
          >
            <span>
              {loading ? "予定を確認中…" : error || "次の予定はありません"}
            </span>
          </div>
        )}
        <button
          type="button"
          className="month-calendar__add-button"
          aria-label="予定を追加"
          onClick={onCreate}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
};
