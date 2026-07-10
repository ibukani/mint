import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../types";
import { CalendarEventEditor } from "./CalendarEventEditor";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../events")>()),
  createCalendarEvent: mocks.create,
  updateCalendarEvent: mocks.update,
}));

const savedEvent: CalendarEvent = {
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

describe("CalendarEventEditor", () => {
  it("creates an all-day event and reports the saved value", async () => {
    mocks.create.mockResolvedValue(savedEvent);
    const onSaved = vi.fn();
    render(
      <CalendarEventEditor
        initialDate="2026-07-11"
        onCancel={vi.fn()}
        onDirtyChange={vi.fn()}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: "設計レビュー" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "終日の予定" }));
    expect(screen.queryByLabelText("開始")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        title: "設計レビュー",
        notes: "",
        schedule: {
          kind: "allDay",
          startDate: "2026-07-11",
          endDateExclusive: "2026-07-12",
        },
      }),
    );
    expect(onSaved).toHaveBeenCalledWith(savedEvent);
  });

  it("keeps input visible when validation fails", async () => {
    render(
      <CalendarEventEditor
        initialDate="2026-07-11"
        onCancel={vi.fn()}
        onDirtyChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "タイトルを入力してください",
    );
    expect(screen.getByLabelText("タイトル")).toHaveValue("");
  });
});
