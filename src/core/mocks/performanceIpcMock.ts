import { defaultAppSettings } from "../defaultSettings";
import type { DiagnosticsReport } from "../performance/diagnostics";
import type { MockIPCArgs, MockIPCResult } from "./ipcMockTypes";
import { handled, unhandled } from "./ipcMockTypes";

export interface PerformanceIpcMockOptions {
  report?:
    | DiagnosticsReport
    | (() => DiagnosticsReport | Promise<DiagnosticsReport>);
}

export const createMockDiagnosticsReport = (): DiagnosticsReport => ({
  collectedAt: "2026-08-04T00:00:00.000Z",
  environment: {
    os: "win32",
    arch: "x64",
    appVersion: "0.3.1",
    commitSha: null,
    webviewVersion: "132.0.0.0 (mock)",
    debugBuild: true,
    performanceEnabled: true,
  },
  settings: {
    theme: defaultAppSettings.theme,
    autostart: false,
    enabledFeatures: ["clock", "calendar", "gameLauncher"],
    shortcuts: {
      clock: "Alt+Left",
      calendar: "Alt+Down",
      gameLauncher: "Alt+1",
    },
  },
  windows: ["main"],
  counters: {
    windowsCreated: 1,
    workersStarted: 1,
    monitorsDetected: 1,
  },
  events: [
    {
      name: "app:startup",
      startedAt: "2026-08-04T00:00:00.000Z",
      windowLabel: "main",
    },
  ],
  dataCounts: {
    calendarEvents: 42,
  },
  recentErrors: [],
});

export async function handlePerformanceIpcCommand(
  command: string,
  _args: MockIPCArgs,
  options: PerformanceIpcMockOptions,
): Promise<MockIPCResult> {
  switch (command) {
    case "collect_diagnostics":
      return handled(
        typeof options.report === "function"
          ? await options.report()
          : (options.report ?? createMockDiagnosticsReport()),
      );
    default:
      return unhandled();
  }
}
