import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => vi.clearAllMocks());

  it("edits and deletes a confirmed event", async () => {
    const onEdit = vi.fn();
    const onDeleted = vi.fn();
    const onDuplicate = vi.fn();
    mocks.deleteEvent.mockResolvedValue(undefined);
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
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", { name: "この予定を削除しますか？" }),
    ).toHaveTextContent("この操作は取り消せません。");
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    await waitFor(() =>
      expect(mocks.deleteEvent).toHaveBeenCalledWith(event.id),
    );
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("cancels deletion safely and restores focus to the trigger", async () => {
    render(
      <CalendarEventDetail
        event={event}
        onBack={vi.fn()}
        onDeleted={vi.fn()}
        onDuplicate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: "削除" });
    deleteButton.focus();
    fireEvent.click(deleteButton);
    expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(deleteButton).toHaveFocus();
    expect(mocks.deleteEvent).not.toHaveBeenCalled();
  });

  it("keeps a failed deletion recoverable inside the dialog", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const onDeleted = vi.fn();
    mocks.deleteEvent
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce(undefined);
    render(
      <CalendarEventDetail
        event={event}
        onBack={vi.fn()}
        onDeleted={onDeleted}
        onDuplicate={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "削除" }));
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "予定を削除できませんでした",
    );
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "削除する" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(mocks.deleteEvent).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to delete calendar event:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});
