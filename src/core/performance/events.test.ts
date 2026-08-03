import { beforeEach, describe, expect, it } from "vitest";
import {
  clearEvents,
  getEvents,
  isPerformanceEnabled,
  MAX_BUFFERED_EVENTS,
  measure,
  recordEvent,
  setPerformanceEnabled,
} from "./events";

describe("performance events", () => {
  beforeEach(() => {
    setPerformanceEnabled(true);
    clearEvents();
  });

  it("records an event with a timestamp", () => {
    recordEvent("app:startup", { windowLabel: "main" });
    const events = getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("app:startup");
    expect(events[0].windowLabel).toBe("main");
    expect(events[0].startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("records duration and metadata", () => {
    recordEvent("data:loaded", {
      durationMs: 12.5,
      metadata: { notes: 42 },
    });
    expect(getEvents()[0]).toMatchObject({
      durationMs: 12.5,
      metadata: { notes: 42 },
    });
  });

  it("measures synchronous operations", () => {
    const result = measure("data:loaded", () => 1 + 1);
    expect(result).toBe(2);
    const events = getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe("data:loaded");
    expect(events[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("caps the buffer at MAX_BUFFERED_EVENTS", () => {
    for (let i = 0; i < MAX_BUFFERED_EVENTS + 50; i += 1) {
      recordEvent("worker:started");
    }
    expect(getEvents()).toHaveLength(MAX_BUFFERED_EVENTS);
  });

  it("returns copies so callers cannot mutate the buffer", () => {
    recordEvent("app:startup");
    const [first] = getEvents();
    first.startedAt = "changed";
    expect(getEvents()[0].startedAt).not.toBe("changed");
  });

  it("disables recording and clears the buffer", () => {
    recordEvent("app:startup");
    setPerformanceEnabled(false);
    recordEvent("window:created");
    expect(getEvents()).toHaveLength(0);
    expect(isPerformanceEnabled()).toBe(false);
  });
});
