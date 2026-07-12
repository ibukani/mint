import { describe, expect, it } from "vitest";
import { getMockWindowRegistration } from "./windowRegistration";

describe("getMockWindowRegistration", () => {
  it("registers the URL-selected label as the current window", () => {
    expect(getMockWindowRegistration("main")[0]).toBe("main");
    expect(getMockWindowRegistration("clock")[0]).toBe("clock");
  });

  it("keeps every known window available without duplicating the current one", () => {
    const labels = getMockWindowRegistration("calendarEditor");

    expect(labels).toEqual([
      "calendarEditor",
      "main",
      "clock",
      "calendar",
      "gameLauncher",
    ]);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
