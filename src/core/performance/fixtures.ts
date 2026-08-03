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

export const createQuickCaptureEvents = (count: number): PerformanceEvent[] => {
  const events: PerformanceEvent[] = [];
  for (let i = 0; i < count; i += 1) {
    events.push({
      name: "data:loaded",
      startedAt: isoAt(i),
      durationMs: 8 + (i % 17),
      windowLabel: "quickCapture",
      metadata: { noteIndex: i },
    });
  }
  return events;
};

export const createFileShelfEvents = (count: number): PerformanceEvent[] => {
  const events: PerformanceEvent[] = [];
  for (let i = 0; i < count; i += 1) {
    events.push({
      name: "window:shown",
      startedAt: isoAt(i),
      durationMs: 4 + (i % 11),
      windowLabel: "fileShelf",
      metadata: { groupIndex: i },
    });
  }
  return events;
};

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
    quickCaptureEvents?: number;
    fileShelfEvents?: number;
    calendarEvents?: number;
    counters?: Record<string, number>;
  } = {},
): PerformanceSnapshot => {
  const {
    quickCaptureEvents = 10,
    fileShelfEvents = 10,
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
      ...createQuickCaptureEvents(quickCaptureEvents),
      ...createFileShelfEvents(fileShelfEvents),
      ...createCalendarEvents(calendarEvents),
    ],
    counters,
  };
};
