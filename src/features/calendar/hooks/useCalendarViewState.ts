import { useEffect, useState } from "react";
import { startOfMonth, toMachineDate } from "../calendar";
import type { CalendarEvent, CalendarOpenMode } from "../types";

export type CalendarScreen =
  | { kind: "month" }
  | { kind: "day"; date: string }
  | { kind: "detail"; event: CalendarEvent; returnDate?: string };

interface UseCalendarViewStateProps {
  openMode: CalendarOpenMode;
  showSequence: number;
}

export const useCalendarViewState = ({
  openMode,
  showSequence,
}: UseCalendarViewStateProps) => {
  const [today, setToday] = useState(() => new Date());
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(() =>
    toMachineDate(new Date()),
  );
  const [screen, setScreen] = useState<CalendarScreen>({ kind: "month" });

  // A new show sequence is a session reset, even when the open mode is unchanged.
  // biome-ignore lint/correctness/useExhaustiveDependencies: showSequence intentionally resets the overlay session.
  useEffect(() => {
    const nextToday = new Date();
    setToday(nextToday);
    setViewMonth(startOfMonth(nextToday));
    setSelectedDate(toMachineDate(nextToday));
    setScreen({ kind: "month" });
  }, [openMode, showSequence]);

  return {
    screen,
    selectedDate,
    setScreen,
    setSelectedDate,
    setViewMonth,
    today,
    viewMonth,
  };
};
