import { beforeEach, describe, expect, it } from "vitest";
import {
  decrementCounter,
  getCounters,
  incrementCounter,
  resetCounters,
  setCounter,
} from "./counters";

describe("performance counters", () => {
  beforeEach(() => {
    resetCounters();
  });

  it("increments and reads counters", () => {
    incrementCounter("windowsCreated");
    incrementCounter("windowsCreated");
    incrementCounter("workersStarted");
    expect(getCounters()).toEqual({
      windowsCreated: 2,
      workersStarted: 1,
    });
  });

  it("decrements without going below zero", () => {
    incrementCounter("windowsCreated");
    decrementCounter("windowsCreated", 2);
    expect(getCounters().windowsCreated).toBe(0);
  });

  it("supports explicit values and floors them", () => {
    setCounter("listeners", 3.9);
    expect(getCounters().listeners).toBe(3);
  });

  it("returns copies so callers cannot mutate the registry", () => {
    incrementCounter("windowsCreated");
    const copy = getCounters() as Record<string, number>;
    copy.windowsCreated = 99;
    expect(getCounters().windowsCreated).toBe(1);
  });
});
