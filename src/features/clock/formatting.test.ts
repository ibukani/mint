import { describe, expect, it } from "vitest";
import {
  formatClockDate,
  formatClockSummary,
  formatClockTime,
} from "./formatting";

describe("clock formatting helpers", () => {
  const fixedTime = new Date("2026-07-09T12:34:56+09:00");

  it("formats the clock time as a zero-padded 24 hour string", () => {
    expect(formatClockTime(fixedTime)).toBe("12:34:56");
  });

  it("formats the clock date with Japanese weekday labels", () => {
    expect(formatClockDate(fixedTime)).toBe("2026年7月9日(木)");
  });

  it("combines the date and time for screen reader summaries", () => {
    expect(formatClockSummary(fixedTime)).toBe("2026年7月9日(木) 12:34:56");
  });
});
