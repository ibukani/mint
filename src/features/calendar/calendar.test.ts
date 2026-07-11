import { describe, expect, it } from "vitest";
import {
  buildCalendarDays,
  shiftMonth,
  startOfMonth,
  toMachineDate,
} from "./calendar";

describe("calendar month calculations", () => {
  it("builds a Sunday-first six-week grid", () => {
    const days = buildCalendarDays(new Date(2026, 6, 1), new Date(2026, 6, 10));

    expect(days).toHaveLength(42);
    expect(days[0]?.machineDate).toBe("2026-06-28");
    expect(days[41]?.machineDate).toBe("2026-08-08");
    expect(days.find((day) => day.isToday)?.machineDate).toBe("2026-07-10");
  });

  it("includes leap day and marks adjacent-month dates", () => {
    const days = buildCalendarDays(new Date(2024, 1, 1), new Date(2024, 1, 29));

    expect(days.some((day) => day.machineDate === "2024-02-29")).toBe(true);
    expect(days.find((day) => day.machineDate === "2024-01-28")).toMatchObject({
      inCurrentMonth: false,
    });
  });

  it("normalizes and shifts month values across years", () => {
    expect(toMachineDate(startOfMonth(new Date(2026, 11, 20)))).toBe(
      "2026-12-01",
    );
    expect(toMachineDate(shiftMonth(new Date(2026, 11, 1), 1))).toBe(
      "2027-01-01",
    );
  });
});
