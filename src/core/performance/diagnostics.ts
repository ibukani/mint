import { invoke } from "@tauri-apps/api/core";
import type { PerformanceEvent, PerformanceEventName } from "./types";

export interface DiagnosticsEnvironment {
  os: string;
  arch: string;
  appVersion: string;
  commitSha: string | null;
  webviewVersion: string | null;
  debugBuild: boolean;
  performanceEnabled: boolean;
}

export interface DiagnosticsSettings {
  theme: string;
  autostart: boolean;
  enabledFeatures: string[];
  shortcuts: Record<string, string>;
}

export interface DiagnosticsReport {
  collectedAt: string;
  environment: DiagnosticsEnvironment;
  settings: DiagnosticsSettings;
  windows: string[];
  counters: Record<string, number>;
  events: PerformanceEvent[];
  dataCounts: Record<string, number>;
  recentErrors: string[];
}

export const isPerformanceEventName = (
  value: string,
): value is PerformanceEventName =>
  [
    "app:startup",
    "window:created",
    "window:shown",
    "window:hidden",
    "window:destroyed",
    "overlay:opened",
    "worker:started",
    "worker:stopped",
    "data:loaded",
  ].includes(value);

export const collectDiagnostics = () =>
  invoke<DiagnosticsReport>("collect_diagnostics");

const formatDuration = (durationMs?: number): string =>
  durationMs === undefined ? "-" : `${durationMs.toFixed(1)} ms`;

export const renderDiagnosticsMarkdown = (
  report: DiagnosticsReport,
): string => {
  const {
    environment,
    settings,
    windows,
    counters,
    events,
    dataCounts,
    recentErrors,
  } = report;
  const lines = [
    "# Mint Diagnostics",
    "",
    `- Collected at: ${report.collectedAt}`,
    `- OS: ${environment.os} (${environment.arch})`,
    `- App version: ${environment.appVersion}`,
    `- Commit SHA: ${environment.commitSha ?? "unknown"}`,
    `- WebView version: ${environment.webviewVersion ?? "unknown"}`,
    `- Build: ${environment.debugBuild ? "debug" : "release"}`,
    `- Performance measurement: ${environment.performanceEnabled ? "enabled" : "disabled"}`,
    "",
    "## Settings",
    "",
    `- Theme: ${settings.theme}`,
    `- Autostart: ${settings.autostart ? "on" : "off"}`,
    `- Enabled features: ${settings.enabledFeatures.length > 0 ? settings.enabledFeatures.join(", ") : "none"}`,
    "",
    "## Shortcuts",
    "",
  ];
  const shortcutEntries = Object.entries(settings.shortcuts);
  if (shortcutEntries.length === 0) {
    lines.push("- none");
  } else {
    for (const [feature, key] of shortcutEntries) {
      lines.push(`- ${feature}: ${key}`);
    }
  }
  lines.push("", "## Windows", "");
  lines.push(
    windows.length > 0
      ? windows.map((label) => `- ${label}`).join("\n")
      : "- none",
  );
  lines.push("", "## Counters", "");
  const counterEntries = Object.entries(counters);
  if (counterEntries.length === 0) {
    lines.push("- none");
  } else {
    for (const [name, value] of counterEntries) {
      lines.push(`- ${name}: ${value}`);
    }
  }
  lines.push("", "## Stored data counts", "");
  const dataEntries = Object.entries(dataCounts);
  if (dataEntries.length === 0) {
    lines.push("- none");
  } else {
    for (const [name, value] of dataEntries) {
      lines.push(`- ${name}: ${value}`);
    }
  }
  lines.push(
    "",
    "## Events",
    "",
    "| # | name | startedAt | durationMs | window |",
    "| --- | --- | --- | --- | --- |",
  );
  events.forEach((event, index) => {
    lines.push(
      `| ${index + 1} | ${event.name} | ${event.startedAt} | ${formatDuration(event.durationMs)} | ${event.windowLabel ?? "-"} |`,
    );
  });
  lines.push("", "## Recent errors", "");
  lines.push(
    recentErrors.length > 0
      ? recentErrors.map((error) => `- ${error}`).join("\n")
      : "- none",
  );
  lines.push("");
  return lines.join("\n");
};
