import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getClockDimensions, TickingClock } from "./ClockOverlay";

const WEEKDAY_LABELS = [
  "日曜日",
  "月曜日",
  "火曜日",
  "水曜日",
  "木曜日",
  "金曜日",
  "土曜日",
] as const;

describe("digital clock presentation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a wider digital layout and adapts its height to the date", () => {
    expect(getClockDimensions("digital", true)).toEqual({
      width: 420,
      height: 168,
    });
    expect(getClockDimensions("digital", false)).toEqual({
      width: 420,
      height: 132,
    });
    expect(getClockDimensions("analog", true)).toEqual({
      width: 240,
      height: 250,
    });
  });

  it("renders date, weekday, seconds and progress in the default layout", () => {
    vi.useFakeTimers();
    // Use local Date constructor to avoid timezone-dependent failures in CI
    vi.setSystemTime(new Date(2026, 6, 10, 8, 42, 18));

    const localDate = new Date(2026, 6, 10, 8, 42, 18);
    const expectedWeekday = WEEKDAY_LABELS[localDate.getDay()] as string;

    const { container } = render(
      <TickingClock
        showDate
        showSeconds
        blinkColon={false}
        displayMode="digital"
        hourFormat="24h"
        glowEffect={false}
        clockColor="#38bdf8"
      />,
    );

    expect(container.querySelector(".digital-clock__date")).toHaveTextContent(
      "2026年7月10日",
    );
    expect(screen.getByText(expectedWeekday)).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(
      container.querySelector(".digital-clock__progress"),
    ).toBeInTheDocument();
  });

  it("removes optional regions cleanly in compact 12-hour mode", () => {
    vi.useFakeTimers();
    // Use local Date constructor to avoid timezone-dependent failures in CI
    vi.setSystemTime(new Date(2026, 6, 10, 20, 42, 18));

    const { container } = render(
      <TickingClock
        showDate={false}
        showSeconds={false}
        blinkColon={false}
        displayMode="digital"
        hourFormat="12h"
        glowEffect={false}
        clockColor="#38bdf8"
      />,
    );

    expect(screen.getByText("PM")).toBeInTheDocument();
    expect(
      container.querySelector(".digital-clock__date"),
    ).not.toBeInTheDocument();
    expect(
      container.querySelector(".digital-clock__progress"),
    ).not.toBeInTheDocument();
  });

  it("gives the analog clock a readable accessible label", () => {
    vi.useFakeTimers();
    // Use local Date constructor to avoid timezone-dependent failures in CI
    vi.setSystemTime(new Date(2026, 6, 10, 20, 42, 18));

    render(
      <TickingClock
        showDate={false}
        showSeconds
        blinkColon={false}
        displayMode="analog"
        hourFormat="24h"
        glowEffect={false}
        clockColor="#38bdf8"
      />,
    );

    expect(screen.getByRole("img")).toHaveAccessibleName("現在時刻 20時42分");
  });

  it("pauses its timer while the overlay is hidden", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 10, 8, 42, 18));

    render(
      <TickingClock
        isActive={false}
        showDate={false}
        showSeconds
        blinkColon={false}
        displayMode="digital"
        hourFormat="24h"
        glowEffect={false}
        clockColor="#38bdf8"
      />,
    );

    expect(screen.getByText("18")).toBeInTheDocument();
    vi.advanceTimersByTime(2_000);
    expect(screen.getByText("18")).toBeInTheDocument();
  });
});
