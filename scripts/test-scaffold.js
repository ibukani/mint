import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const FEATURE_NAME = "test_feature";
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const BACKUP_FILES = [
  "src-tauri/src/features/mod.rs",
  "src/core/context/AppSettings.tsx",
  "src/core/defaultSettings.ts",
  "src-tauri/src/core/settings.rs",
  "src/core/mocks/mockSettings.ts",
  "src/core/mocks/tauriMock.ts",
  "src/core/mocks/vitestSetup.ts",
  "src/core/navigation/settingsTabs.ts",
];

const backups = new Map();

console.log("=== Scaffold Smoke Test ===");

// 1. Create backups
for (const relPath of BACKUP_FILES) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (fs.existsSync(fullPath)) {
    backups.set(fullPath, fs.readFileSync(fullPath, "utf-8"));
  }
}

// 2. Clean previous test artifacts if they exist
const featureDir = path.join(ROOT_DIR, "src/features", FEATURE_NAME);
const featureRs = path.join(
  ROOT_DIR,
  "src-tauri/src/features",
  `${FEATURE_NAME}.rs`,
);

function cleanup() {
  console.log("Cleaning up generated test artifacts...");
  if (fs.existsSync(featureDir)) {
    fs.rmSync(featureDir, { recursive: true, force: true });
  }
  if (fs.existsSync(featureRs)) {
    fs.rmSync(featureRs, { force: true });
  }
  for (const [fullPath, content] of backups.entries()) {
    fs.writeFileSync(fullPath, content, "utf-8");
  }
}

// Initial cleanup just in case
cleanup();

let hasError = false;

function expectScaffoldFailure(args, label) {
  let failed = false;
  try {
    execFileSync("node", ["scripts/scaffold-feature.js", ...args], {
      stdio: "pipe",
    });
  } catch (_err) {
    failed = true;
  }
  if (!failed) {
    throw new Error(`${label} unexpectedly succeeded.`);
  }
}

try {
  console.log("Verifying invalid scaffold inputs are rejected...");
  expectScaffoldFailure(["../bad", "Bad"], "Path traversal feature name");
  expectScaffoldFailure(["bad-name", "BadName"], "kebab-case feature name");
  expectScaffoldFailure(["bad_name", "badName"], "non-Pascal component name");

  // 3. Run scaffold
  console.log("Running scaffold-feature.js...");
  execFileSync(
    "node",
    ["scripts/scaffold-feature.js", FEATURE_NAME, "TestFeature"],
    {
      stdio: "inherit",
    },
  );

  // 4. Verify generated files
  console.log("Verifying generated files...");
  if (!fs.existsSync(path.join(featureDir, "types.ts"))) {
    throw new Error("types.ts was not generated.");
  }
  if (!fs.existsSync(featureRs)) {
    throw new Error("Rust feature module was not generated.");
  }

  // 5. Run verify:architecture
  console.log("Running verify:architecture...");
  execFileSync("node", ["scripts/verify-architecture.js"], {
    stdio: "inherit",
  });

  console.log("Running full frontend check...");
  execFileSync(npmCmd, ["run", "check"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  console.log("\x1b[32m[PASS]\x1b[0m Scaffold smoke test succeeded.");
} catch (err) {
  console.error(
    "\x1b[31m[ERROR]\x1b[0m Scaffold smoke test failed:",
    err.message,
  );
  hasError = true;
} finally {
  cleanup();
}

if (hasError) {
  process.exit(1);
}
