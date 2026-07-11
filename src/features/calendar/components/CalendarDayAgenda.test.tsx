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
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /設計レビュー/ }));
    expect(onSelect).toHaveBeenCalledWith(event);
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
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("この日の予定はありません")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "予定を追加" }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
