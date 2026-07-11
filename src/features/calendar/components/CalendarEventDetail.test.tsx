import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../types";
import { CalendarEventDetail } from "./CalendarEventDetail";

const mocks = vi.hoisted(() => ({ deleteEvent: vi.fn() }));

vi.mock("../events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../events")>()),
  deleteCalendarEvent: mocks.deleteEvent,
}));

const event: CalendarEvent = {
  id: "event-1",
  title: "設計レビュー",
  notes: "確認事項",
  schedule: {
    kind: "allDay",
    startDate: "2026-07-11",
    endDateExclusive: "2026-07-12",
  },
  source: { kind: "local" },
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z",
};

describe("CalendarEventDetail", () => {
  afterEach(() => vi.restoreAllMocks());

  it("edits and deletes a confirmed event", async () => {
    const onEdit = vi.fn();
    const onDeleted = vi.fn();
    const onDuplicate = vi.fn();
    mocks.deleteEvent.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <CalendarEventDetail
        event={event}
        onBack={vi.fn()}
        onDeleted={onDeleted}
        onDuplicate={onDuplicate}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByRole("heading", { name: "設計レビュー" })).toBeVisible();
    expect(screen.getByText("確認事項")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /編集/ }));
    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /編集/ })).toHaveAttribute(
      "aria-keyshortcuts",
      "E",
    );

    fireEvent.click(screen.getByRole("button", { name: /複製/ }));
    expect(onDuplicate).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: /複製/ })).toHaveAttribute(
      "aria-keyshortcuts",
      "D",
    );

    fireEvent.click(screen.getByRole("button", { name: /削除/ }));
    await waitFor(() =>
      expect(mocks.deleteEvent).toHaveBeenCalledWith(event.id),
    );
    expect(onDeleted).toHaveBeenCalledOnce();
  });
});
