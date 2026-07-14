import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../types";
import { CalendarDayAgenda } from "./CalendarDayAgenda";

const event: CalendarEvent = {
  id: "event-1",
  title: "設計レビュー",
  notes: "",
  schedule: {
    kind: "allDay",
    startDate: "2026-07-11",
    endDateExclusive: "2026-07-12",
  },
  source: { kind: "local" },
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
};

const laterEvent: CalendarEvent = {
  ...event,
  id: "event-2",
  title: "振り返り",
  schedule: {
    kind: "allDay",
    startDate: "2026-07-11",
    endDateExclusive: "2026-07-12",
  },
};

describe("CalendarDayAgenda", () => {
  it("opens a listed event", () => {
    const onSelect = vi.fn();
    render(
      <CalendarDayAgenda
        date="2026-07-11"
        events={[event]}
        loading={false}
        error=""
        onAdd={vi.fn()}
        onBack={vi.fn()}
        onRetry={vi.fn()}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /設計レビュー/ }));
    expect(onSelect).toHaveBeenCalledWith(event);
  });

  it("moves focus through events with list navigation keys", () => {
    render(
      <CalendarDayAgenda
        date="2026-07-11"
        events={[event, laterEvent]}
        loading={false}
        error=""
        onAdd={vi.fn()}
        onBack={vi.fn()}
        onRetry={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    const firstEvent = screen.getByRole("button", { name: /設計レビュー/ });
    const secondEvent = screen.getByRole("button", { name: /振り返り/ });
    expect(firstEvent).toHaveFocus();
    expect(secondEvent).toHaveAttribute("tabindex", "-1");

    fireEvent.keyDown(firstEvent, { key: "ArrowUp" });
    expect(firstEvent).toHaveFocus();
    fireEvent.keyDown(firstEvent, { key: "ArrowDown" });
    expect(secondEvent).toHaveFocus();
    fireEvent.keyDown(secondEvent, { key: "Home" });
    expect(firstEvent).toHaveFocus();
    fireEvent.keyDown(firstEvent, { key: "End" });
    expect(secondEvent).toHaveFocus();
    fireEvent.keyDown(secondEvent, { key: "ArrowDown" });
    expect(secondEvent).toHaveFocus();
  });

  it("offers event creation for an empty day", () => {
    const onAdd = vi.fn();
    render(
      <CalendarDayAgenda
        date="2026-07-11"
        events={[]}
        loading={false}
        error=""
        onAdd={onAdd}
        onBack={vi.fn()}
        onRetry={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("この日の予定はありません")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "予定を追加" }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("offers a retry action when events cannot be loaded", () => {
    const onRetry = vi.fn();
    render(
      <CalendarDayAgenda
        date="2026-07-11"
        events={[]}
        loading={false}
        error="予定を読み込めませんでした"
        onAdd={vi.fn()}
        onBack={vi.fn()}
        onRetry={onRetry}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "予定を読み込めませんでした",
    );
    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
