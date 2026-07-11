import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("saves with Ctrl+Enter without interfering with ordinary typing", async () => {
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

    const title = screen.getByLabelText("タイトル");
    fireEvent.change(title, { target: { value: "設計レビュー" } });
    fireEvent.keyDown(title, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(onSaved).toHaveBeenCalledWith(savedEvent);
  });

  it("preserves the event duration when the start time changes", () => {
    render(
      <CalendarEventEditor
        initialDate="2030-07-11"
        onCancel={vi.fn()}
        onDirtyChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("開始")).toHaveValue("09:00");
    expect(screen.getByLabelText("終了")).toHaveValue("10:00");

    fireEvent.change(screen.getByLabelText("開始"), {
      target: { value: "11:30" },
    });

    expect(screen.getByLabelText("終了")).toHaveValue("12:30");
  });

  it("shows a time validation error at the end field and focuses it", async () => {
    render(
      <CalendarEventEditor
        initialDate="2030-07-11"
        onCancel={vi.fn()}
        onDirtyChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: "設計レビュー" },
    });
    fireEvent.change(screen.getByLabelText("終了"), {
      target: { value: "08:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "終了時刻は開始時刻より後にしてください",
    );
    expect(screen.getByLabelText("終了")).toHaveFocus();
    expect(screen.getByLabelText("終了")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("タイトル")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("shows backend failures separately from field validation", async () => {
    mocks.create.mockRejectedValueOnce(new Error("database unavailable"));
    render(
      <CalendarEventEditor
        initialDate="2026-07-11"
        onCancel={vi.fn()}
        onDirtyChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("タイトル"), {
      target: { value: "設計レビュー" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "予定を保存できませんでした。もう一度お試しください。",
    );
    expect(screen.queryByText("database unavailable")).toBeNull();
    expect(screen.getByLabelText("タイトル")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("creates a new event from a reusable template", async () => {
    mocks.create.mockResolvedValue(savedEvent);
    const onSaved = vi.fn();
    render(
      <CalendarEventEditor
        template={savedEvent}
        onCancel={vi.fn()}
        onDirtyChange={vi.fn()}
        onSaved={onSaved}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "予定を複製" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("タイトル")).toHaveValue("設計レビュー");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    expect(mocks.update).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(savedEvent);
  });
});
