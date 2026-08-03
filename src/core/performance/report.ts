import { getCounters } from "./counters";
import { getEvents } from "./events";
import { redactRecord, redactSensitiveText } from "./redact";
import type {
  PerformanceEnvironment,
  PerformanceEvent,
  PerformanceSnapshot,
} from "./types";

const APP_VERSION = "0.3.1";

declare const navigator:
  | {
      platform?: string;
      userAgent?: string;
      language?: string;
    }
  | undefined;

declare const process: { env?: Record<string, string | undefined> } | undefined;

export const collectEnvironment = (): PerformanceEnvironment => {
  const isRelease =
    typeof process !== "undefined" && process.env?.NODE_ENV === "production";
  return {
    platform: navigator?.platform || "unknown",
    arch: /arm|aarch/i.test(navigator?.userAgent ?? "") ? "arm64" : "x64",
    appVersion: APP_VERSION,
    commitSha: process?.env?.VITE_MINT_COMMIT_SHA ?? null,
    isRelease,
  };
};

export const createSnapshot = (): PerformanceSnapshot => ({
  capturedAt: new Date().toISOString(),
  environment: collectEnvironment(),
  events: [...getEvents()],
  counters: { ...getCounters() },
});

const formatDuration = (durationMs?: number): string =>
  durationMs === undefined ? "-" : `${durationMs.toFixed(1)} ms`;

export const renderMarkdownReport = (snapshot: PerformanceSnapshot): string => {
  const { environment, counters, events } = snapshot;
  const lines = [
    "# Mint Performance Report",
    "",
    `- Captured at: ${snapshot.capturedAt}`,
    `- Platform: ${environment.platform} (${environment.arch})`,
    `- App version: ${environment.appVersion}`,
    `- Commit SHA: ${environment.commitSha ?? "unknown"}`,
    `- Build: ${environment.isRelease ? "release" : "development"}`,
    "",
    "## Events",
    "",
    "| # | name | startedAt | durationMs | window |",
    "| --- | --- | --- | --- | --- |",
  ];
  events.forEach((event, index) => {
    lines.push(
      `| ${index + 1} | ${event.name} | ${event.startedAt} | ${formatDuration(event.durationMs)} | ${event.windowLabel ?? "-"} |`,
    );
  });
  lines.push("", "## Counters", "");
  const counterEntries = Object.entries(counters);
  if (counterEntries.length === 0) {
    lines.push("- none");
  } else {
    for (const [name, value] of counterEntries) {
      lines.push(`- ${name}: ${value}`);
    }
  }
  lines.push("");
  return lines.join("\n");
};

export const renderJsonReport = (snapshot: PerformanceSnapshot): string =>
  JSON.stringify(snapshot, null, 2);

/** Markdown with a defensive redaction pass applied to free-form values. */
export const renderMarkdownReportRedacted = (
  snapshot: PerformanceSnapshot,
): string => {
  const redactedEvents: PerformanceEvent[] = snapshot.events.map((event) => ({
    ...event,
    metadata: event.metadata
      ? redactRecord(
          Object.fromEntries(
            Object.entries(event.metadata).map(([key, value]) => [
              key,
              String(value),
            ]),
          ),
        )
      : undefined,
  }));
  return renderMarkdownReport({
    ...snapshot,
    events: redactedEvents,
  });
};

/** Sanitizes a raw diagnostics string before it is shown or copied. */
export const sanitizeDiagnosticsText = (text: string): string =>
  redactSensitiveText(text);
