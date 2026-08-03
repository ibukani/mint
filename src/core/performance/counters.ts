// Lifecycle counters track window, worker, and timer/listener counts so that
// leaks (growing windows, duplicate workers) become visible in diagnostics.
let counters: Record<string, number> = {};

export const incrementCounter = (name: string, by = 1): void => {
  counters[name] = (counters[name] ?? 0) + by;
};

export const decrementCounter = (name: string, by = 1): void => {
  counters[name] = Math.max(0, (counters[name] ?? 0) - by);
};

export const setCounter = (name: string, value: number): void => {
  counters[name] = Math.max(0, Math.floor(value));
};

export const getCounters = (): Readonly<Record<string, number>> => ({
  ...counters,
});

export const resetCounters = (): void => {
  counters = {};
};
