import { CircleAlert, RefreshCw, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect } from "react";
import { Button } from "../../../design/components";
import { OverlayCard, OverlayFrame } from "../../../design/layout";
import { useCalendarEvents } from "../hooks/useCalendarEvents";
import { useCalendarOverlay } from "../hooks/useCalendarOverlay";
import { useCalendarScreenActions } from "../hooks/useCalendarScreenActions";
import { useCalendarViewState } from "../hooks/useCalendarViewState";
import { CalendarDayAgenda } from "./CalendarDayAgenda";
import { CalendarEventDetail } from "./CalendarEventDetail";
import { MonthCalendar } from "./MonthCalendar";
import "./CalendarOverlay.css";

export const CalendarOverlay: React.FC = () => {
  const canClose = useCallback(() => true, []);
  const overlay = useCalendarOverlay(canClose);
  const view = useCalendarViewState({
    openMode: overlay.openMode,
    showSequence: overlay.showSequence,
  });
  const calendarEvents = useCalendarEvents(
    view.viewMonth,
    view.today,
    overlay.showSequence,
    overlay.selectedGoogleCalendarIds,
    overlay.isVisible,
  );
  const actions = useCalendarScreenActions({
    screen: view.screen,
    setScreen: view.setScreen,
    setSelectedDate: view.setSelectedDate,
    setViewMonth: view.setViewMonth,
    openMode: overlay.openMode,
    showSequence: overlay.showSequence,
    events: calendarEvents.events,
    lastChangedEvent: calendarEvents.lastChangedEvent,
    closeCalendar: overlay.closeCalendar,
  });

  useEffect(() => {
    (
      document.documentElement.style as CSSStyleDeclaration & { zoom: string }
    ).zoom = "";
  }, []);

  const renderScreen = () => {
    const screen = view.screen;
    switch (screen.kind) {
      case "day":
        return (
          <CalendarDayAgenda
            date={screen.date}
            events={actions.dayEvents}
            loading={calendarEvents.loading}
            error={calendarEvents.error}
            onBack={actions.handleBack}
            onAdd={() =>
              void actions.openEditor({
                mode: "create",
                date: screen.date,
              })
            }
            onNextDay={() => actions.moveDay(1)}
            onPreviousDay={() => actions.moveDay(-1)}
            onRetry={calendarEvents.refresh}
            onSelect={(event) =>
              view.setScreen({
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
            onBack={actions.handleBack}
            onEdit={() =>
              void actions.openEditor({
                mode: "edit",
                event: screen.event,
              })
            }
            onDuplicate={() =>
              void actions.openEditor({
                mode: "duplicate",
                template: screen.event,
              })
            }
            onDeleted={() => {
              calendarEvents.refresh();
              view.setScreen(
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
            error={calendarEvents.error}
            events={calendarEvents.events}
            loading={calendarEvents.loading}
            nextEvent={calendarEvents.nextEvent}
            today={view.today}
            viewMonth={view.viewMonth}
            onViewMonthChange={view.setViewMonth}
            onOpenDay={actions.openDay}
            onOpenEvent={actions.openMonthEvent}
            onCreate={(date) =>
              void actions.openEditor({ mode: "create", date })
            }
            onRetry={calendarEvents.refresh}
            selectedDate={view.selectedDate}
            onSelectedDateChange={view.setSelectedDate}
            syncing={calendarEvents.syncing}
          />
        );
    }
  };

  const retryEditor = () => {
    const payload = actions.editorRetryPayload;
    if (payload) void actions.openEditor(payload);
  };

  return (
    <OverlayFrame>
      <OverlayCard
        className={`${overlay.animationClass} calendar-overlay-card theme-accent-scope${overlay.isDocked ? " is-docked" : ""}`}
        role="dialog"
        aria-label="カレンダーオーバーレイ"
        style={{ "--color-accent": overlay.themeColor } as React.CSSProperties}
      >
        <button
          type="button"
          className="overlay-close-button"
          aria-label="カレンダーオーバーレイを閉じる"
          aria-keyshortcuts="Escape"
          title="閉じる（Esc）"
          onClick={overlay.closeCalendar}
        >
          <X size={15} aria-hidden="true" />
        </button>
        {calendarEvents.syncError && (
          <div className="calendar-overlay__sync-error" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            <span>
              Google Calendarとの同期に失敗しました。{calendarEvents.syncError}
            </span>
            <Button
              variant="ghost"
              className="calendar-overlay__action-error-retry"
              disabled={calendarEvents.syncing}
              onClick={() => void calendarEvents.retrySync()}
            >
              <RefreshCw size={14} aria-hidden="true" /> 再同期
            </Button>
          </div>
        )}
        {actions.editorActionError && actions.editorRetryPayload && (
          <div className="calendar-overlay__action-error" role="alert">
            <span>{actions.editorActionError}</span>
            <Button
              variant="ghost"
              className="calendar-overlay__action-error-retry"
              onClick={retryEditor}
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
