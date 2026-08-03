import { startHarness } from "./helpers/harness.mjs";
import { runSmokeSpecs } from "./specs/smoke.mjs";

function argValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    port: Number(argValue(args, "--port") ?? 4444),
    nativeDriver: argValue(args, "--native-driver"),
    build: !args.includes("--no-build"),
  };
}

const options = parseArgs(process.argv);

let harness;
try {
  harness = await startHarness(options);
} catch (error) {
  console.error(`[e2e] Harness startup failed: ${error.message}`);
  process.exit(1);
}

let results = [];
try {
  results = await runSmokeSpecs(harness);
} catch (error) {
  console.error(`\n[e2e] Spec run aborted: ${error.message}`);
} finally {
  await harness.stop();
}

for (const result of results) {
  const mark = result.status === "passed" ? "PASS" : "FAIL";
  console.log(`[e2e] ${mark} ${result.name}`);
  if (result.error) {
    console.error(`[e2e]      ${result.error}`);
  }
}
const passed = results.filter((result) => result.status === "passed").length;
console.log(
  `\n[e2e] ${passed}/${results.length} specs passed (artifacts: ${harness.reportDir})`,
);

if (passed !== results.length) {
  process.exitCode = 1;
}
