import { CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildCalendarDays,
  shiftMonth,
  startOfMonth,
  toMachineDate,
} from "../calendar";
import { eventsForDate, formatEventDate, formatEventTime } from "../events";
import type { CalendarEvent } from "../types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

interface MonthCalendarProps {
  error: string;
  events: CalendarEvent[];
  loading: boolean;
  nextEvent: CalendarEvent | null;
  onCreate: (date: string) => void;
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
  const [selectedDate, setSelectedDate] = useState(() => toMachineDate(today));
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const shouldFocusSelectedRef = useRef(false);
  const days = useMemo(
    () => buildCalendarDays(viewMonth, today),
    [viewMonth, today],
  );
  const monthLabel = `${viewMonth.getFullYear()}年 ${viewMonth.getMonth() + 1}月`;

  useEffect(() => {
    if (days.some((day) => day.machineDate === selectedDate)) return;
    const firstCurrentDay = days.find((day) => day.inCurrentMonth);
    if (firstCurrentDay) setSelectedDate(firstCurrentDay.machineDate);
  }, [days, selectedDate]);

  useEffect(() => {
    if (!shouldFocusSelectedRef.current) return;
    const selectedButton = dayRefs.current.get(selectedDate);
    if (!selectedButton) return;
    selectedButton.focus();
    shouldFocusSelectedRef.current = false;
  }, [selectedDate]);

  const selectAndFocusDate = (date: Date) => {
    const machineDate = toMachineDate(date);
    shouldFocusSelectedRef.current = true;
    setSelectedDate(machineDate);
    if (
      date.getFullYear() !== viewMonth.getFullYear() ||
      date.getMonth() !== viewMonth.getMonth()
    ) {
      onViewMonthChange(startOfMonth(date));
    }
  };

  const selectedDateValue = () => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
  };

  const shiftSelectedMonth = (delta: number) => {
    const current = selectedDateValue();
    const targetMonth = new Date(
      current.getFullYear(),
      current.getMonth() + delta,
      1,
    );
    const lastDay = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0,
    ).getDate();
    targetMonth.setDate(Math.min(current.getDate(), lastDay));
    selectAndFocusDate(targetMonth);
  };

  const moveMonth = (delta: number) => {
    const current = selectedDateValue();
    const targetMonth = shiftMonth(viewMonth, delta);
    const lastDay = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      0,
    ).getDate();
    setSelectedDate(
      toMachineDate(
        new Date(
          targetMonth.getFullYear(),
          targetMonth.getMonth(),
          Math.min(current.getDate(), lastDay),
        ),
      ),
    );
    onViewMonthChange(shiftMonth(viewMonth, delta));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const isDayButton = (event.target as HTMLElement).classList.contains(
      "month-calendar__day",
    );
    const dayDelta: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };

    if (isDayButton && event.key in dayDelta) {
      event.preventDefault();
      const nextDate = selectedDateValue();
      nextDate.setDate(nextDate.getDate() + (dayDelta[event.key] ?? 0));
      selectAndFocusDate(nextDate);
    } else if (isDayButton && event.key === "PageUp") {
      event.preventDefault();
      shiftSelectedMonth(event.shiftKey ? -12 : -1);
    } else if (isDayButton && event.key === "PageDown") {
      event.preventDefault();
      shiftSelectedMonth(event.shiftKey ? 12 : 1);
    } else if (
      event.key.toLowerCase() === "t" &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      selectAndFocusDate(today);
    } else if (
      event.key.toLowerCase() === "n" &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      onCreate(selectedDate);
    }
  };

  const goToToday = () => {
    setSelectedDate(toMachineDate(today));
    onViewMonthChange(startOfMonth(today));
  };

  return (
    <section
      className="month-calendar"
      aria-label="月間カレンダー"
      onKeyDown={handleKeyDown}
    >
      <header className="month-calendar__header">
        <h2 aria-live="polite" aria-label={monthLabel}>
          <span className="month-calendar__year">
            {viewMonth.getFullYear()}年
          </span>
          <strong className="month-calendar__month">
            {viewMonth.getMonth() + 1}月
          </strong>
        </h2>
        <div className="month-calendar__switcher">
          <button
            type="button"
            className="month-calendar__nav-button"
            aria-label="前の月"
            aria-keyshortcuts="PageUp"
            title="前の月（Page Up）"
            onClick={() => moveMonth(-1)}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="month-calendar__nav-button"
            aria-label="次の月"
            aria-keyshortcuts="PageDown"
            title="次の月（Page Down）"
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
              className={`month-calendar__day${day.inCurrentMonth ? "" : " is-outside"}${day.isToday ? " is-today" : ""}${day.machineDate === selectedDate ? " is-selected" : ""}`}
              aria-label={`${day.date.getMonth() + 1}月${day.date.getDate()}日${eventLabel}`}
              aria-current={day.isToday ? "date" : undefined}
              tabIndex={day.machineDate === selectedDate ? 0 : -1}
              ref={(element) => {
                if (element) dayRefs.current.set(day.machineDate, element);
                else dayRefs.current.delete(day.machineDate);
              }}
              onClick={() => {
                setSelectedDate(day.machineDate);
                onOpenDay(day.machineDate);
              }}
            >
              <time dateTime={day.machineDate}>
                <span className="month-calendar__day-number">
                  {day.date.getDate()}
                </span>
              </time>
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
          aria-keyshortcuts="T"
          title="今日（T）"
          onClick={goToToday}
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
            <CalendarClock size={15} aria-hidden="true" />
            <span className="month-calendar__next-eyebrow">次の予定</span>
            <strong className="month-calendar__next-title">
              {nextEvent.title}
            </strong>
            <time className="month-calendar__next-time">
              {formatEventDate(nextEvent)} {formatEventTime(nextEvent)}
            </time>
          </button>
        ) : (
          <div
            className="month-calendar__next-event is-empty"
            aria-live="polite"
          >
            <CalendarClock size={15} aria-hidden="true" />
            <span className="month-calendar__next-empty-label">
              {loading ? "予定を確認中…" : error || "次の予定はありません"}
            </span>
          </div>
        )}
        <button
          type="button"
          className="month-calendar__add-button"
          aria-label="予定を追加"
          aria-keyshortcuts="N"
          title="選択日に予定を追加（N）"
          onClick={() => onCreate(selectedDate)}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
};
