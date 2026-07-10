import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startOfMonth } from "../calendar";
import type { CalendarEvent } from "../types";
import { MonthCalendar } from "./MonthCalendar";

interface HarnessProps {
  events?: CalendarEvent[];
  nextEvent?: CalendarEvent | null;
  onCreate?: () => void;
  onOpenDay?: (date: string) => void;
  onOpenEvent?: (event: CalendarEvent) => void;
}

const MonthCalendarHarness = ({
  events = [],
  nextEvent = null,
  onCreate = vi.fn(),
  onOpenDay = vi.fn(),
  onOpenEvent = vi.fn(),
}: HarnessProps) => {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(today));
  return (
    <MonthCalendar
      error=""
      events={events}
      loading={false}
      nextEvent={nextEvent}
      today={today}
      viewMonth={viewMonth}
      onCreate={onCreate}
      onOpenDay={onOpenDay}
      onOpenEvent={onOpenEvent}
      onViewMonthChange={setViewMonth}
    />
  );
};

const calendarEvent: CalendarEvent = {
  id: "event-1",
  title: "設計レビュー",
  notes: "",
  schedule: {
    kind: "timed",
    startsAt: "2026-07-11T05:00:00.000Z",
    endsAt: "2026-07-11T06:00:00.000Z",
    timeZone: "Asia/Tokyo",
  },
  source: { kind: "local" },
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
};

describe("MonthCalendar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves between months and returns to today", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 10, 9, 0, 0));
    render(<MonthCalendarHarness />);

    expect(
      screen.getByRole("heading", { name: "2026年 7月" }),
    ).toBeInTheDocument();
    expect(document.querySelector('[aria-current="date"]')).toHaveAttribute(
      "aria-label",
      "7月10日",
    );

    fireEvent.click(screen.getByRole("button", { name: "次の月" }));
    expect(
      screen.getByRole("heading", { name: "2026年 8月" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "今日" }));
    expect(
      screen.getByRole("heading", { name: "2026年 7月" }),
    ).toBeInTheDocument();
  });

  it("supports left and right arrow month navigation", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 0, 15, 9, 0, 0));
    render(<MonthCalendarHarness />);

    fireEvent.keyDown(screen.getByLabelText("月間カレンダー"), {
      key: "ArrowLeft",
    });
    expect(
      screen.getByRole("heading", { name: "2025年 12月" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(screen.getByLabelText("月間カレンダー"), {
      key: "ArrowRight",
    });
    expect(
      screen.getByRole("heading", { name: "2026年 1月" }),
    ).toBeInTheDocument();
  });

  it("shows a subtle event marker and opens event entry points", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 10, 9, 0, 0));
    const onCreate = vi.fn();
    const onOpenDay = vi.fn();
    const onOpenEvent = vi.fn();
    const { container } = render(
      <MonthCalendarHarness
        events={[calendarEvent]}
        nextEvent={calendarEvent}
        onCreate={onCreate}
        onOpenDay={onOpenDay}
        onOpenEvent={onOpenEvent}
      />,
    );

    const eventDay = screen.getByRole("button", {
      name: "7月11日、予定1件",
    });
    expect(eventDay.querySelector(".month-calendar__event-dot")).not.toBeNull();
    expect(
      container.querySelectorAll(".month-calendar__event-dot"),
    ).toHaveLength(1);

    fireEvent.click(eventDay);
    expect(onOpenDay).toHaveBeenCalledWith("2026-07-11");
    fireEvent.click(screen.getByRole("button", { name: "予定を追加" }));
    expect(onCreate).toHaveBeenCalledOnce();
    fireEvent.click(
      screen.getByRole("button", { name: "次の予定、設計レビュー" }),
    );
    expect(onOpenEvent).toHaveBeenCalledWith(calendarEvent);
  });
});
