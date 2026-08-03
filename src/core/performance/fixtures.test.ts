import { describe, expect, it } from "vitest";
import {
  createCalendarEvents,
  createFileShelfEvents,
  createFixtureSnapshot,
  createQuickCaptureEvents,
} from "./fixtures";

describe("performance fixtures", () => {
  it("generate the requested event counts", () => {
    expect(createQuickCaptureEvents(10)).toHaveLength(10);
    expect(createQuickCaptureEvents(1000)).toHaveLength(1000);
    expect(createQuickCaptureEvents(10000)).toHaveLength(10000);
    expect(createFileShelfEvents(10)).toHaveLength(10);
    expect(createFileShelfEvents(1000)).toHaveLength(1000);
    expect(createCalendarEvents(100)).toHaveLength(100);
    expect(createCalendarEvents(1000)).toHaveLength(1000);
  });

  it("are deterministic", () => {
    expect(createQuickCaptureEvents(3)).toEqual(createQuickCaptureEvents(3));
    expect(createFileShelfEvents(5)).toEqual(createFileShelfEvents(5));
    expect(createCalendarEvents(7)).toEqual(createCalendarEvents(7));
    expect(createFixtureSnapshot()).toEqual(createFixtureSnapshot());
  });

  it("build a combined snapshot with stable counters", () => {
    const snapshot = createFixtureSnapshot({
      quickCaptureEvents: 10,
      fileShelfEvents: 10,
      calendarEvents: 100,
    });
    expect(snapshot.events).toHaveLength(120);
    expect(snapshot.environment.commitSha).toMatch(/^[0-9a-f]{40}$/);
    expect(snapshot.counters.windowsCreated).toBe(4);
  });
});
