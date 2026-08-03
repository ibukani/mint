export type PerformanceEventName =
  | "app:startup"
  | "window:created"
  | "window:shown"
  | "window:hidden"
  | "window:destroyed"
  | "overlay:opened"
  | "worker:started"
  | "worker:stopped"
  | "data:loaded";

export interface PerformanceEvent {
  name: PerformanceEventName;
  startedAt: string;
  durationMs?: number;
  windowLabel?: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export interface PerformanceEnvironment {
  platform: string;
  arch: string;
  appVersion: string;
  commitSha: string | null;
  isRelease: boolean;
}

export interface PerformanceSnapshot {
  capturedAt: string;
  environment: PerformanceEnvironment;
  events: PerformanceEvent[];
  counters: Record<string, number>;
}
