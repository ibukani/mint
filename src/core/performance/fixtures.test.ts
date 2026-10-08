import { describe, expect, it } from "vitest";
import {
  createCalendarEvents,
  createClockEvents,
  createFixtureSnapshot,
  createGameLauncherEvents,
} from "./fixtures";

describe("performance fixtures", () => {
  it("generate the requested event counts", () => {
    expect(createClockEvents(10)).toHaveLength(10);
    expect(createClockEvents(1000)).toHaveLength(1000);
    expect(createClockEvents(10000)).toHaveLength(10000);
    expect(createGameLauncherEvents(10)).toHaveLength(10);
    expect(createGameLauncherEvents(1000)).toHaveLength(1000);
    expect(createCalendarEvents(100)).toHaveLength(100);
    expect(createCalendarEvents(1000)).toHaveLength(1000);
  });

  it("are deterministic", () => {
    expect(createClockEvents(3)).toEqual(createClockEvents(3));
    expect(createGameLauncherEvents(5)).toEqual(createGameLauncherEvents(5));
    expect(createCalendarEvents(7)).toEqual(createCalendarEvents(7));
    expect(createFixtureSnapshot()).toEqual(createFixtureSnapshot());
  });

  it("build a combined snapshot with stable counters", () => {
    const snapshot = createFixtureSnapshot({
      clockEvents: 10,
      gameLauncherEvents: 10,
      calendarEvents: 100,
    });
    expect(snapshot.events).toHaveLength(120);
    expect(snapshot.environment.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(snapshot.counters.windowsCreated).toBe(4);
  });
});
