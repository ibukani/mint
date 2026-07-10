import { ChevronLeft, ChevronRight } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { buildCalendarDays, shiftMonth, startOfMonth } from "../calendar";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

interface MonthCalendarProps {
  showSequence: number;
}

export const MonthCalendar: React.FC<MonthCalendarProps> = ({
  showSequence,
}) => {
  const [today, setToday] = useState(() => new Date());
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    void showSequence;
    const nextToday = new Date();
    setToday(nextToday);
    setViewMonth(startOfMonth(nextToday));
  }, [showSequence]);

  const days = useMemo(
    () => buildCalendarDays(viewMonth, today),
    [viewMonth, today],
  );
  const monthLabel = `${viewMonth.getFullYear()}年 ${viewMonth.getMonth() + 1}月`;

  const moveMonth = (delta: number) => {
    setViewMonth((current) => shiftMonth(current, delta));
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
      </header>

      <div className="month-calendar__weekdays" aria-hidden="true">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>

      <div className="month-calendar__grid">
        {days.map((day) => (
          <time
            key={day.machineDate}
            className={`month-calendar__day${day.inCurrentMonth ? "" : " is-outside"}${day.isToday ? " is-today" : ""}`}
            dateTime={day.machineDate}
            aria-current={day.isToday ? "date" : undefined}
          >
            {day.date.getDate()}
          </time>
        ))}
      </div>

      <button
        type="button"
        className="month-calendar__today-button"
        onClick={() => {
          const nextToday = new Date();
          setToday(nextToday);
          setViewMonth(startOfMonth(nextToday));
        }}
      >
        今日
      </button>
    </section>
  );
};
