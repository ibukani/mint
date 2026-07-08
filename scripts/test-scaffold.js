import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const FEATURE_NAME = "test_feature";

const BACKUP_FILES = [
  "src-tauri/src/features/mod.rs",
  "src/core/context/AppSettings.tsx",
  "src-tauri/src/core/settings.rs",
  "src/core/mocks/tauriMock.ts",
  "src/core/mocks/vitestSetup.ts",
  "src/App.tsx",
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

try {
  // 3. Run scaffold
  console.log("Running scaffold-feature.js...");
  execSync(`node scripts/scaffold-feature.js ${FEATURE_NAME} TestFeature`, {
    stdio: "inherit",
  });

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
  execSync(`node scripts/verify-architecture.js`, { stdio: "inherit" });

  console.log("\\x1b[32m[PASS]\\x1b[0m Scaffold smoke test succeeded.");
} catch (err) {
  console.error(
    "\\x1b[31m[ERROR]\\x1b[0m Scaffold smoke test failed:",
    err.message,
  );
  hasError = true;
} finally {
  cleanup();
}

if (hasError) {
  process.exit(1);
}
