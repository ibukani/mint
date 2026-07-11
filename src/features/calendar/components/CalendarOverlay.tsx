import { X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { startOfMonth, toMachineDate } from "../calendar";
import { eventsForDate } from "../events";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { useCalendarOverlay } from "../hooks/useCalendarOverlay";
import type { CalendarEvent } from "../types";
import { CalendarDayAgenda } from "./CalendarDayAgenda";
import { CalendarEventDetail } from "./CalendarEventDetail";
import { CalendarEventEditor } from "./CalendarEventEditor";
import { MonthCalendar } from "./MonthCalendar";
import "./CalendarOverlay.css";

type CalendarScreen =
  | { kind: "month" }
  | { kind: "day"; date: string }
  | { kind: "detail"; event: CalendarEvent; returnDate?: string }
  | { kind: "create"; date: string; returnDate?: string }
  | { kind: "edit"; event: CalendarEvent; returnDate?: string }
  | { kind: "duplicate"; event: CalendarEvent; returnDate?: string };

export const CalendarOverlay: React.FC = () => {
  const dirtyRef = useRef(false);
  const canClose = useCallback(
    () => !dirtyRef.current || window.confirm("未保存の変更を破棄しますか？"),
    [],
  );
  const {
    animationClass,
    closeCalendar,
    isDocked,
    openMode,
    showSequence,
    themeColor,
  } = useCalendarOverlay(canClose);
  const [today, setToday] = useState(() => new Date());
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [screen, setScreen] = useState<CalendarScreen>({ kind: "month" });
  const { events, nextEvent, loading, error, refresh } = useCalendarEvents(
    viewMonth,
    today,
    showSequence,
  );

  // Clear any residual CSS zoom left by previous code versions (HMR / cached WebView state)
  useEffect(() => {
    (
      document.documentElement.style as CSSStyleDeclaration & { zoom: string }
    ).zoom = "";
  }, []);

  useEffect(() => {
    void showSequence;
    const nextToday = new Date();
    setToday(nextToday);
    setViewMonth(startOfMonth(nextToday));
    setScreen((current) => {
      if (
        openMode === "createEvent" &&
        dirtyRef.current &&
        (current.kind === "create" ||
          current.kind === "edit" ||
          current.kind === "duplicate")
      ) {
        return current;
      }
      return openMode === "createEvent"
        ? { kind: "create", date: toMachineDate(nextToday) }
        : { kind: "month" };
    });
  }, [openMode, showSequence]);

  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const handleBack = useCallback(() => {
    if (
      (screen.kind === "create" ||
        screen.kind === "edit" ||
        screen.kind === "duplicate") &&
      !canClose()
    ) {
      return;
    }
    dirtyRef.current = false;
    switch (screen.kind) {
      case "day":
        setScreen({ kind: "month" });
        break;
      case "detail":
      case "create":
        setScreen(
          screen.returnDate
            ? { kind: "day", date: screen.returnDate }
            : { kind: "month" },
        );
        break;
      case "edit":
      case "duplicate":
        setScreen({
          kind: "detail",
          event: screen.event,
          returnDate: screen.returnDate,
        });
        break;
      default:
        closeCalendar();
    }
  }, [canClose, closeCalendar, screen]);

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
        setScreen({
          kind: "create",
          date: screen.date,
          returnDate: screen.date,
        });
      } else if (screen.kind === "detail" && key === "e") {
        event.preventDefault();
        setScreen({
          kind: "edit",
          event: screen.event,
          returnDate: screen.returnDate,
        });
      } else if (screen.kind === "detail" && key === "d") {
        event.preventDefault();
        setScreen({
          kind: "duplicate",
          event: screen.event,
          returnDate: screen.returnDate,
        });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeCalendar, handleBack, screen]);

  const renderScreen = () => {
    switch (screen.kind) {
      case "day":
        return (
          <CalendarDayAgenda
            date={screen.date}
            events={eventsForDate(events, screen.date)}
            loading={loading}
            error={error}
            onBack={handleBack}
            onAdd={() =>
              setScreen({
                kind: "create",
                date: screen.date,
                returnDate: screen.date,
              })
            }
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
              setScreen({
                kind: "edit",
                event: screen.event,
                returnDate: screen.returnDate,
              })
            }
            onDuplicate={() =>
              setScreen({
                kind: "duplicate",
                event: screen.event,
                returnDate: screen.returnDate,
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
      case "create":
      case "edit":
      case "duplicate":
        return (
          <CalendarEventEditor
            event={screen.kind === "edit" ? screen.event : undefined}
            template={screen.kind === "duplicate" ? screen.event : undefined}
            initialDate={screen.kind === "create" ? screen.date : undefined}
            onCancel={handleBack}
            onDirtyChange={handleDirtyChange}
            onSaved={(event) => {
              dirtyRef.current = false;
              refresh();
              setScreen({
                kind: "detail",
                event,
                returnDate: screen.returnDate,
              });
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
            onOpenDay={(date) => setScreen({ kind: "day", date })}
            onOpenEvent={(event) => setScreen({ kind: "detail", event })}
            onCreate={(date) => setScreen({ kind: "create", date })}
          />
        );
    }
  };

  return (
    <OverlayFrame>
      <OverlayCard
        className={`${animationClass} calendar-overlay-card${isDocked ? " is-docked" : ""}`}
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
        {renderScreen()}
      </OverlayCard>
    </OverlayFrame>
  );
};
