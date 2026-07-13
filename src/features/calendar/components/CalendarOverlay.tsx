import { X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { startOfMonth, toMachineDate } from "../calendar";
import { eventsForDate, openCalendarEditor } from "../events";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { useCalendarOverlay } from "../hooks/useCalendarOverlay";
import type { CalendarEvent } from "../types";
import { CalendarDayAgenda } from "./CalendarDayAgenda";
import { CalendarEventDetail } from "./CalendarEventDetail";
import { MonthCalendar } from "./MonthCalendar";
import "./CalendarOverlay.css";

type CalendarScreen =
  | { kind: "month" }
  | { kind: "day"; date: string }
  | { kind: "detail"; event: CalendarEvent; returnDate?: string };

export const CalendarOverlay: React.FC = () => {
  const {
    animationClass,
    closeCalendar,
    isDocked,
    openMode,
    showSequence,
    themeColor,
  } = useCalendarOverlay(() => true);
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
    if (openMode === "createEvent") {
      setScreen({ kind: "month" });
      openCalendarEditor({
        mode: "create",
        date: toMachineDate(nextToday),
      }).catch(console.error);
    } else {
      setScreen({ kind: "month" });
    }
  }, [openMode, showSequence]);

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
        openCalendarEditor({ mode: "create", date: screen.date }).catch(
          console.error,
        );
      } else if (screen.kind === "detail" && key === "e") {
        event.preventDefault();
        openCalendarEditor({ mode: "edit", event: screen.event }).catch(
          console.error,
        );
      } else if (screen.kind === "detail" && key === "d") {
        event.preventDefault();
        openCalendarEditor({ mode: "duplicate", template: screen.event }).catch(
          console.error,
        );
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
              openCalendarEditor({ mode: "create", date: screen.date }).catch(
                console.error,
              )
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
              openCalendarEditor({ mode: "edit", event: screen.event }).catch(
                console.error,
              )
            }
            onDuplicate={() =>
              openCalendarEditor({
                mode: "duplicate",
                template: screen.event,
              }).catch(console.error)
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
            onOpenDay={(date) => setScreen({ kind: "day", date })}
            onOpenEvent={(event) => setScreen({ kind: "detail", event })}
            onCreate={(date) =>
              openCalendarEditor({ mode: "create", date }).catch(console.error)
            }
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
        {renderScreen()}
      </OverlayCard>
    </OverlayFrame>
  );
};
