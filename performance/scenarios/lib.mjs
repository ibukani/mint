import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function readJson(relativeOrAbsolutePath) {
  const path = isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : join(ROOT, relativeOrAbsolutePath);
  return { path, data: JSON.parse(readFileSync(path, "utf8")) };
}

export function resolveCommitSha(fallback) {
  if (process.env.MINT_COMMIT_SHA) return process.env.MINT_COMMIT_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return fallback;
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

export function aggregateEvents(events) {
  const byName = new Map();
  for (const event of events) {
    const durationMs =
      typeof event.durationMs === "number" ? event.durationMs : 0;
    const row = byName.get(event.name) ?? {
      name: event.name,
      count: 0,
      totalMs: 0,
      durations: [],
    };
    row.count += 1;
    row.totalMs += durationMs;
    row.durations.push(durationMs);
    byName.set(event.name, row);
  }
  const rows = [...byName.values()]
    .map((row) => {
      const sorted = [...row.durations].sort((a, b) => a - b);
      return {
        name: row.name,
        count: row.count,
        totalMs: row.totalMs,
        avgMs: row.count === 0 ? 0 : row.totalMs / row.count,
        maxMs: sorted.length === 0 ? 0 : sorted[sorted.length - 1],
        p95Ms: percentile(sorted, 95),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const totalDurationMs = rows.reduce((sum, row) => sum + row.totalMs, 0);
  const totalEvents = rows.reduce((sum, row) => sum + row.count, 0);
  return { rows, totalDurationMs, totalEvents };
}

export function checkBudgets(rows, totalDurationMs, budgets) {
  const violations = [];
  for (const row of rows) {
    const maxMs = budgets.maxEventDurationMs?.[row.name];
    if (typeof maxMs === "number" && row.maxMs > maxMs) {
      violations.push(
        `${row.name}: max ${row.maxMs.toFixed(1)} ms exceeds budget ${maxMs} ms`,
      );
    }
  }
  const maxTotal = budgets.maxTotalDurationMs;
  if (typeof maxTotal === "number" && totalDurationMs > maxTotal) {
    violations.push(
      `total: ${totalDurationMs.toFixed(1)} ms exceeds budget ${maxTotal} ms`,
    );
  }
  const minPerName = budgets.minEventsPerName;
  if (typeof minPerName === "number") {
    for (const row of rows) {
      if (row.count < minPerName) {
        violations.push(
          `${row.name}: count ${row.count} below minimum ${minPerName}`,
        );
      }
    }
  }
  return violations;
}

function formatMs(value) {
  return `${value.toFixed(1)} ms`;
}

export function renderMarkdown({
  input,
  rows,
  totalDurationMs,
  totalEvents,
  counters,
  violations,
  budgetsChecked,
}) {
  const env = input.environment ?? {};
  const lines = [
    "# Mint Performance Report",
    "",
    `- Captured at: ${input.capturedAt ?? "-"}`,
    `- Platform: ${env.platform ?? "-"} (${env.arch ?? "-"})`,
    `- App version: ${env.appVersion ?? "-"}`,
    `- Commit SHA: ${env.commitSha ?? "-"}`,
    `- Build: ${env.isRelease ? "release" : "debug"}`,
    "",
    "## Events",
    "",
    "| # | name | count | avg | max | p95 |",
    "|---|------|-------|-----|-----|-----|",
    ...rows.map((row, index) => {
      const avg = row.count === 0 ? "-" : formatMs(row.avgMs);
      const max = row.count === 0 ? "-" : formatMs(row.maxMs);
      const p95 = row.count === 0 ? "-" : formatMs(row.p95Ms);
      return `| ${index + 1} | ${row.name} | ${row.count} | ${avg} | ${max} | ${p95} |`;
    }),
    "",
    `Total: ${formatMs(totalDurationMs)} across ${totalEvents} events`,
    "",
    "## Counters",
    "",
    "| name | value |",
    "|------|-------|",
    ...Object.entries(counters ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `| ${name} | ${value} |`),
  ];
  if (budgetsChecked) {
    lines.push("", "## Budgets", "");
    if (violations.length === 0) {
      lines.push("All hard budgets are satisfied.");
    } else {
      lines.push(...violations.map((violation) => `- FAIL: ${violation}`));
    }
  }
  return `${lines.join("\n")}\n`;
}

export function runScenario({
  inputRelativePath,
  outputName,
  budgetsRelativePath,
}) {
  const input = readJson(inputRelativePath).data;
  const { rows, totalDurationMs, totalEvents } = aggregateEvents(
    input.events ?? [],
  );
  const counters = input.counters ?? {};
  let violations = [];
  let checked = false;
  if (budgetsRelativePath) {
    const budgets = readJson(budgetsRelativePath).data;
    violations = checkBudgets(rows, totalDurationMs, budgets);
    checked = true;
  }
  const environment = {
    ...(input.environment ?? {}),
    commitSha: resolveCommitSha(input.environment?.commitSha ?? null),
  };
  const report = {
    capturedAt: new Date().toISOString(),
    environment,
    summary: {
      totalEvents,
      totalDurationMs,
      events: rows,
    },
    counters,
    budgets: checked ? { checked: true, violations } : { checked: false },
  };
  mkdirSync(join(ROOT, "reports"), { recursive: true });
  writeFileSync(
    join(ROOT, "reports", `${outputName}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const markdown = renderMarkdown({
    input: { ...input, environment },
    rows,
    totalDurationMs,
    totalEvents,
    counters,
    violations,
    budgetsChecked: checked,
  });
  writeFileSync(join(ROOT, "reports", `${outputName}.md`), markdown);
  return { report, markdown, violations, checked };
}
