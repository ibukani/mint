import type {
  PerformanceEnvironment,
  PerformanceEvent,
  PerformanceSnapshot,
} from "./types";

// Deterministic fixture generators. Every call returns the same snapshot for
// the same sizes, so tests and perf scenarios can diff output reliably.

export const createFixtureEnvironment = (): PerformanceEnvironment => ({
  platform: "win32",
  arch: "x64",
  appVersion: "0.3.1",
  commitSha: "0123456789abcdef0123456789abcdef01234567",
  isRelease: false,
});

const isoAt = (index: number): string =>
  `2026-08-04T00:00:00.000Z`.replace(
    "000Z",
    `${String(index % 1000).padStart(3, "0")}Z`,
  );

export const createClockEvents = (count: number): PerformanceEvent[] =>
  Array.from({ length: count }, (_, index) => ({
    name: "window:shown",
    startedAt: isoAt(index),
    durationMs: 4 + (index % 11),
    windowLabel: "clock",
  }));

export const createGameLauncherEvents = (count: number): PerformanceEvent[] =>
  Array.from({ length: count }, (_, index) => ({
    name: "data:loaded",
    startedAt: isoAt(index),
    durationMs: 8 + (index % 17),
    windowLabel: "gameLauncher",
  }));

export const createCalendarEvents = (count: number): PerformanceEvent[] => {
  const events: PerformanceEvent[] = [];
  for (let i = 0; i < count; i += 1) {
    events.push({
      name: "data:loaded",
      startedAt: isoAt(i),
      durationMs: 12 + (i % 23),
      windowLabel: "calendar",
      metadata: { eventIndex: i },
    });
  }
  return events;
};

export const createFixtureSnapshot = (
  options: {
    clockEvents?: number;
    gameLauncherEvents?: number;
    calendarEvents?: number;
    counters?: Record<string, number>;
  } = {},
): PerformanceSnapshot => {
  const {
    clockEvents = 10,
    gameLauncherEvents = 10,
    calendarEvents = 100,
    counters = {
      windowsCreated: 4,
      windowsDestroyed: 1,
      workersStarted: 1,
    },
  } = options;
  return {
    capturedAt: "2026-08-04T00:00:00.000Z",
    environment: createFixtureEnvironment(),
    events: [
      ...createClockEvents(clockEvents),
      ...createGameLauncherEvents(gameLauncherEvents),
      ...createCalendarEvents(calendarEvents),
    ],
    counters,
  };
};
