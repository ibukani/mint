import { CircleAlert, RefreshCw, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../design/components";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { startOfMonth, toMachineDate } from "../calendar";
import {
  addDays,
  eventsForDate,
  openCalendarEditor,
  parseMachineDate,
} from "../events";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { useCalendarOverlay } from "../hooks/useCalendarOverlay";
import type { CalendarEditorPayload, CalendarEvent } from "../types";
import { CalendarDayAgenda } from "./CalendarDayAgenda";
import { CalendarEventDetail } from "./CalendarEventDetail";
import { MonthCalendar } from "./MonthCalendar";
import "./CalendarOverlay.css";

type CalendarScreen =
  | { kind: "month" }
  | { kind: "day"; date: string }
  | { kind: "detail"; event: CalendarEvent; returnDate?: string };

const eventStartDate = (event: CalendarEvent) =>
  event.schedule.kind === "allDay"
    ? event.schedule.startDate
    : toMachineDate(new Date(event.schedule.startsAt));

const isSameMonth = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth();

export const CalendarOverlay: React.FC = () => {
  const canClose = useCallback(() => true, []);
  const {
    animationClass,
    closeCalendar,
    isDocked,
    isVisible,
    openMode,
    selectedGoogleCalendarIds,
    showSequence,
    themeColor,
  } = useCalendarOverlay(canClose);
  const [today, setToday] = useState(() => new Date());
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() =>
    toMachineDate(new Date()),
  );
  const [screen, setScreen] = useState<CalendarScreen>({ kind: "month" });
  const [editorActionError, setEditorActionError] = useState("");
  const [editorRetryPayload, setEditorRetryPayload] =
    useState<CalendarEditorPayload | null>(null);
  const editorAttemptRef = useRef(0);
  const {
    events,
    lastChangedEvent,
    nextEvent,
    loading,
    error,
    refresh,
    syncError,
    syncing,
    retrySync,
  } = useCalendarEvents(
    viewMonth,
    today,
    showSequence,
    selectedGoogleCalendarIds,
    isVisible,
  );

  const openEditor = useCallback(async (payload: CalendarEditorPayload) => {
    const attempt = ++editorAttemptRef.current;
    setEditorActionError("");
    setEditorRetryPayload(payload);

    try {
      await openCalendarEditor(payload);
      if (attempt === editorAttemptRef.current) {
        setEditorRetryPayload(null);
      }
    } catch (openError) {
      if (attempt !== editorAttemptRef.current) return;
      console.error("Failed to open calendar editor window:", openError);
      setEditorActionError(
        "予定入力画面を開けませんでした。再試行してください。",
      );
    }
  }, []);

  // Clear any residual CSS zoom left by previous code versions (HMR / cached WebView state)
  useEffect(() => {
    (
      document.documentElement.style as CSSStyleDeclaration & { zoom: string }
    ).zoom = "";
  }, []);

  // A new show sequence is a session reset, even when the open mode is unchanged.
  // biome-ignore lint/correctness/useExhaustiveDependencies: showSequence intentionally resets the overlay session.
  useEffect(() => {
    const nextToday = new Date();
    setToday(nextToday);
    setViewMonth(startOfMonth(nextToday));
    setSelectedDate(toMachineDate(nextToday));
    setEditorActionError("");
    setEditorRetryPayload(null);
    if (openMode === "createEvent") {
      setScreen({ kind: "month" });
      void openEditor({
        mode: "create",
        date: toMachineDate(nextToday),
      });
    } else {
      setScreen({ kind: "month" });
    }
  }, [openMode, openEditor, showSequence]);

  useEffect(() => {
    if (screen.kind !== "detail") return;
    const updatedEvent =
      (lastChangedEvent?.id === screen.event.id && lastChangedEvent) ||
      events.find((event) => event.id === screen.event.id);
    if (!updatedEvent || updatedEvent === screen.event) return;
    setScreen({
      kind: "detail",
      event: updatedEvent,
      returnDate: screen.returnDate ? eventStartDate(updatedEvent) : undefined,
    });
  }, [events, lastChangedEvent, screen]);

  const handleBack = useCallback(() => {
    switch (screen.kind) {
      case "day":
        setScreen({ kind: "month" });
        break;
      case "detail":
        setScreen(
          screen.returnDate
            ? { kind: "day", date: screen.returnDate }
            : { kind: "month" },
        );
        break;
      default:
        closeCalendar();
    }
  }, [screen, closeCalendar]);

  const openDay = useCallback((date: string) => {
    const nextMonth = startOfMonth(parseMachineDate(date));
    setSelectedDate(date);
    setViewMonth((currentMonth) =>
      isSameMonth(currentMonth, nextMonth) ? currentMonth : nextMonth,
    );
    setScreen({ kind: "day", date });
  }, []);

  const openMonthEvent = useCallback((event: CalendarEvent) => {
    const eventDate = eventStartDate(event);
    setSelectedDate(eventDate);
    setViewMonth(startOfMonth(parseMachineDate(eventDate)));
    setScreen({ kind: "detail", event });
  }, []);

  const moveDay = useCallback(
    (delta: number) => {
      if (screen.kind !== "day") return;
      openDay(addDays(screen.date, delta));
    },
    [openDay, screen],
  );

  const dayDate = screen.kind === "day" ? screen.date : null;
  const dayEvents = useMemo(
    () => (dayDate ? eventsForDate(events, dayDate) : []),
    [dayDate, events],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (screen.kind === "month") closeCalendar();
        else handleBack();
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable) ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (screen.kind === "day" && key === "n") {
        event.preventDefault();
        void openEditor({ mode: "create", date: screen.date });
      } else if (screen.kind === "detail" && key === "e") {
        event.preventDefault();
        void openEditor({ mode: "edit", event: screen.event });
      } else if (screen.kind === "detail" && key === "d") {
        event.preventDefault();
        void openEditor({ mode: "duplicate", template: screen.event });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeCalendar, handleBack, openEditor, screen]);

  const renderScreen = () => {
    switch (screen.kind) {
      case "day":
        return (
          <CalendarDayAgenda
            date={screen.date}
            events={dayEvents}
            loading={loading}
            error={error}
            onBack={handleBack}
            onAdd={() => void openEditor({ mode: "create", date: screen.date })}
            onNextDay={() => moveDay(1)}
            onPreviousDay={() => moveDay(-1)}
            onRetry={refresh}
            onSelect={(event) =>
              setScreen({
                kind: "detail",
                event,
                returnDate: screen.date,
              })
            }
          />
        );
      case "detail":
        return (
          <CalendarEventDetail
            event={screen.event}
            onBack={handleBack}
            onEdit={() =>
              void openEditor({ mode: "edit", event: screen.event })
            }
            onDuplicate={() =>
              void openEditor({
                mode: "duplicate",
                template: screen.event,
              })
            }
            onDeleted={() => {
              refresh();
              setScreen(
                screen.returnDate
                  ? { kind: "day", date: screen.returnDate }
                  : { kind: "month" },
              );
            }}
          />
        );
      default:
        return (
          <MonthCalendar
            error={error}
            events={events}
            loading={loading}
            nextEvent={nextEvent}
            today={today}
            viewMonth={viewMonth}
            onViewMonthChange={setViewMonth}
            onOpenDay={openDay}
            onOpenEvent={openMonthEvent}
            onCreate={(date) => void openEditor({ mode: "create", date })}
            onRetry={refresh}
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            syncing={syncing}
          />
        );
    }
  };

  return (
    <OverlayFrame>
      <OverlayCard
        className={`${animationClass} calendar-overlay-card theme-accent-scope${isDocked ? " is-docked" : ""}`}
        role="dialog"
        aria-label="カレンダーオーバーレイ"
        style={{ "--color-accent": themeColor } as React.CSSProperties}
      >
        <button
          type="button"
          className="overlay-close-button"
          aria-label="カレンダーオーバーレイを閉じる"
          aria-keyshortcuts="Escape"
          title="閉じる（Esc）"
          onClick={closeCalendar}
        >
          <X size={15} aria-hidden="true" />
        </button>

        {syncError && (
          <div className="calendar-overlay__sync-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            <span>Google Calendarとの同期に失敗しました。{syncError}</span>
            <Button
              variant="ghost"
              className="calendar-overlay__action-error-retry"
              disabled={syncing}
              onClick={() => void retrySync()}
            >
              <RefreshCw size={14} aria-hidden="true" />
              再同期
            </Button>
          </div>
        )}
        {editorActionError && editorRetryPayload && (
          <div className="calendar-overlay__action-error" role="alert">
            <span>{editorActionError}</span>
            <Button
              variant="ghost"
              className="calendar-overlay__action-error-retry"
              onClick={() => void openEditor(editorRetryPayload)}
            >
              再試行
            </Button>
          </div>
        )}
        {renderScreen()}
      </OverlayCard>
    </OverlayFrame>
  );
};
