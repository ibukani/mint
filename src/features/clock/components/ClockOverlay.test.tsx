import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getClockDimensions, TickingClock } from "./ClockOverlay";

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
    vi.setSystemTime(new Date("2026-07-10T08:42:18+09:00"));

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

    expect(screen.getByText("2026年7月10日")).toBeInTheDocument();
    expect(screen.getByText("金曜日")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(
      container.querySelector(".digital-clock__progress"),
    ).toBeInTheDocument();
  });

  it("removes optional regions cleanly in compact 12-hour mode", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T20:42:18+09:00"));

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
    expect(screen.queryByText("2026年7月10日")).not.toBeInTheDocument();
    expect(
      container.querySelector(".digital-clock__progress"),
    ).not.toBeInTheDocument();
  });
});
