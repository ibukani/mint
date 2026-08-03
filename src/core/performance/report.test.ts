import { beforeEach, describe, expect, it } from "vitest";
import { clearEvents, recordEvent, setPerformanceEnabled } from "./events";
import { createFixtureSnapshot } from "./fixtures";
import {
  collectEnvironment,
  createSnapshot,
  renderJsonReport,
  renderMarkdownReport,
  sanitizeDiagnosticsText,
} from "./report";

describe("performance report", () => {
  beforeEach(() => {
    setPerformanceEnabled(true);
    clearEvents();
  });

  it("collects the environment", () => {
    const env = collectEnvironment();
    expect(env.platform).toBeTruthy();
    expect(env.arch).toBeTruthy();
    expect(env.appVersion).toBe("0.3.1");
    expect(env.commitSha).toBeNull();
    expect(typeof env.isRelease).toBe("boolean");
  });

  it("creates a snapshot from buffered events and counters", () => {
    recordEvent("app:startup");
    const snapshot = createSnapshot();
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(snapshot.environment.appVersion).toBe("0.3.1");
  });

  it("renders a markdown report with env and commit sha", () => {
    const snapshot = createFixtureSnapshot({ quickCaptureEvents: 2 });
    const markdown = renderMarkdownReport(snapshot);
    expect(markdown).toContain("# Mint Performance Report");
    expect(markdown).toContain(snapshot.environment.commitSha ?? "unknown");
    expect(markdown).toContain("data:loaded");
    expect(markdown).toContain("quickCapture");
    expect(markdown).toContain("| 1 |");
    expect(markdown).toContain("windowsCreated: 4");
  });

  it("renders a JSON report", () => {
    const snapshot = createFixtureSnapshot({ quickCaptureEvents: 1 });
    const json = renderJsonReport(snapshot);
    const parsed = JSON.parse(json) as {
      environment: { commitSha: string | null };
      events: unknown[];
    };
    expect(parsed.events).toHaveLength(snapshot.events.length);
    expect(parsed.environment.commitSha).toBe(snapshot.environment.commitSha);
  });

  it("sanitizes raw diagnostics text defensively", () => {
    const sanitized = sanitizeDiagnosticsText(
      "error for user demo@example.com with key sk-abcdefghijklm",
    );
    expect(sanitized).not.toContain("demo@example.com");
    expect(sanitized).not.toContain("sk-abcdefghijklm");
  });
});
