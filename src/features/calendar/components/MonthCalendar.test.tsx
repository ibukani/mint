import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonthCalendar } from "./MonthCalendar";

describe("MonthCalendar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves between months and returns to today", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 6, 10, 9, 0, 0));
    render(<MonthCalendar showSequence={0} />);

    expect(
      screen.getByRole("heading", { name: "2026年 7月" }),
    ).toBeInTheDocument();
    expect(document.querySelector('[aria-current="date"]')).toHaveAttribute(
      "datetime",
      "2026-07-10",
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
    render(<MonthCalendar showSequence={0} />);

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
});
