import { runScenario } from "./lib.mjs";

const inputArg = process.argv[2] ?? "fixtures/desktop-input.json";
const { report } = runScenario({
  inputRelativePath: inputArg,
  outputName: "desktop-report",
  budgetsRelativePath: null,
});

console.log(
  `Desktop performance scenario: ${report.summary.totalEvents} events, ${report.summary.totalDurationMs.toFixed(1)} ms total`,
);
