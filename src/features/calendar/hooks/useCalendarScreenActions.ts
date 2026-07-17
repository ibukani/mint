import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startOfMonth, toMachineDate } from "../calendar";
import {
  addDays,
  eventsForDate,
  openCalendarEditor,
  parseMachineDate,
} from "../events";
import type { CalendarEditorPayload, CalendarEvent } from "../types";
import type { CalendarScreen } from "./useCalendarViewState";

const eventStartDate = (event: CalendarEvent) =>
  event.schedule.kind === "allDay"
    ? event.schedule.startDate
    : toMachineDate(new Date(event.schedule.startsAt));

const isSameMonth = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth();

interface UseCalendarScreenActionsProps {
  screen: CalendarScreen;
  setScreen: (screen: CalendarScreen) => void;
  setSelectedDate: (date: string) => void;
  setViewMonth: React.Dispatch<React.SetStateAction<Date>>;
  openMode: "month" | "createEvent";
  showSequence: number;
  events: CalendarEvent[];
  lastChangedEvent: CalendarEvent | null;
  closeCalendar: () => void;
}

export const useCalendarScreenActions = ({
  screen,
  setScreen,
  setSelectedDate,
  setViewMonth,
  openMode,
  showSequence,
  events,
  lastChangedEvent,
  closeCalendar,
}: UseCalendarScreenActionsProps) => {
  const [editorActionError, setEditorActionError] = useState("");
  const [editorRetryPayload, setEditorRetryPayload] =
    useState<CalendarEditorPayload | null>(null);
  const editorAttemptRef = useRef(0);

  const openEditor = useCallback(async (payload: CalendarEditorPayload) => {
    const attempt = ++editorAttemptRef.current;
    setEditorActionError("");
    setEditorRetryPayload(payload);
    try {
      await openCalendarEditor(payload);
      if (attempt === editorAttemptRef.current) setEditorRetryPayload(null);
    } catch (openError) {
      if (attempt !== editorAttemptRef.current) return;
      console.error("Failed to open calendar editor window:", openError);
      setEditorActionError(
        "予定入力画面を開けませんでした。再試行してください。",
      );
    }
  }, []);

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
  }, [events, lastChangedEvent, screen, setScreen]);

  useEffect(() => {
    void showSequence;
    if (openMode !== "createEvent") return;
    setEditorActionError("");
    setEditorRetryPayload(null);
    void openEditor({ mode: "create", date: toMachineDate(new Date()) });
  }, [openEditor, openMode, showSequence]);

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
  }, [closeCalendar, screen, setScreen]);

  const openDay = useCallback(
    (date: string) => {
      const nextMonth = startOfMonth(parseMachineDate(date));
      setSelectedDate(date);
      setViewMonth((currentMonth) =>
        isSameMonth(currentMonth, nextMonth) ? currentMonth : nextMonth,
      );
      setScreen({ kind: "day", date });
    },
    [setScreen, setSelectedDate, setViewMonth],
  );

  const openMonthEvent = useCallback(
    (event: CalendarEvent) => {
      const eventDate = eventStartDate(event);
      setSelectedDate(eventDate);
      setViewMonth(startOfMonth(parseMachineDate(eventDate)));
      setScreen({ kind: "detail", event });
    },
    [setScreen, setSelectedDate, setViewMonth],
  );

  const moveDay = useCallback(
    (delta: number) => {
      if (screen.kind === "day") openDay(addDays(screen.date, delta));
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

  return {
    dayEvents,
    editorActionError,
    editorRetryPayload,
    handleBack,
    moveDay,
    openDay,
    openEditor,
    openMonthEvent,
  };
};
