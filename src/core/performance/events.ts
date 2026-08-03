import type { PerformanceEvent, PerformanceEventName } from "./types";

// Ring-buffer cap keeps memory bounded during long sessions.
export const MAX_BUFFERED_EVENTS = 500;

// Release builds disable instrumentation by default. Development and test
// environments keep it enabled; explicit opt-in is available for profiling a
// release binary with the MINT_PERFORMANCE_ENABLED flag handled natively.
let enabled = true;

let bufferedEvents: PerformanceEvent[] = [];

export const isPerformanceEnabled = () => enabled;

export const setPerformanceEnabled = (value: boolean) => {
  enabled = value;
  if (!value) {
    bufferedEvents = [];
  }
};

const nowIso = () => new Date().toISOString();

export const recordEvent = (
  name: PerformanceEventName,
  options: {
    startedAt?: string;
    durationMs?: number;
    windowLabel?: string;
    metadata?: Readonly<Record<string, string | number | boolean>>;
  } = {},
): void => {
  if (!enabled) return;

  const event: PerformanceEvent = {
    name,
    startedAt: options.startedAt ?? nowIso(),
    ...(options.durationMs !== undefined && { durationMs: options.durationMs }),
    ...(options.windowLabel !== undefined && {
      windowLabel: options.windowLabel,
    }),
    ...(options.metadata !== undefined && { metadata: options.metadata }),
  };
  bufferedEvents.push(event);
  if (bufferedEvents.length > MAX_BUFFERED_EVENTS) {
    bufferedEvents.splice(0, bufferedEvents.length - MAX_BUFFERED_EVENTS);
  }
};

/** Measures a synchronous operation and records it when it finishes. */
export const measure = <T>(
  name: PerformanceEventName,
  operation: () => T,
  options: {
    windowLabel?: string;
    metadata?: Readonly<Record<string, string | number | boolean>>;
  } = {},
): T => {
  const startedAt = performance.now();
  const result = operation();
  recordEvent(name, {
    durationMs: performance.now() - startedAt,
    windowLabel: options.windowLabel,
    metadata: options.metadata,
  });
  return result;
};

export const getEvents = (): readonly PerformanceEvent[] =>
  bufferedEvents.map((event) => ({ ...event }));

export const clearEvents = (): void => {
  bufferedEvents = [];
};
