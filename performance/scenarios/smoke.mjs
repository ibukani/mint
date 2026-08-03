import { runScenario } from "./lib.mjs";

const inputArg = process.argv[2] ?? "fixtures/smoke-input.json";
const { report, violations, checked } = runScenario({
  inputRelativePath: inputArg,
  outputName: "smoke-report",
  budgetsRelativePath: "baselines/budgets.json",
});

console.log(
  `Smoke performance scenario: ${report.summary.totalEvents} events, ${report.summary.totalDurationMs.toFixed(1)} ms total`,
);
if (checked && violations.length > 0) {
  for (const violation of violations) {
    console.error(`FAIL: ${violation}`);
  }
  process.exitCode = 1;
} else {
  console.log("All hard budgets are satisfied.");
}
