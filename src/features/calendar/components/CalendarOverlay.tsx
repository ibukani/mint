import { CircleAlert, LoaderCircle, RefreshCw, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../../../design/components";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { startOfMonth, toMachineDate } from "../calendar";
import { eventsForDate, openCalendarEditor } from "../events";
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
    nextEvent,
    loading,
    error,
    refresh,
    syncError,
    syncing,
    retrySync,
  } = useCalendarEvents(viewMonth, today, showSequence);

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

  useEffect(() => {
    void showSequence;
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
            events={eventsForDate(events, screen.date)}
            loading={loading}
            error={error}
            onBack={handleBack}
            onAdd={() => void openEditor({ mode: "create", date: screen.date })}
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
            onOpenDay={(date) => setScreen({ kind: "day", date })}
            onOpenEvent={(event) => setScreen({ kind: "detail", event })}
            onCreate={(date) => void openEditor({ mode: "create", date })}
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
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
        {syncing && (
          <div className="calendar-overlay__sync-status" role="status">
            <LoaderCircle
              className="spinner-icon"
              size={15}
              aria-hidden="true"
            />
            <span>Google Calendarと同期しています…</span>
          </div>
        )}
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
