import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const TEMP_ROOT = path.join(ROOT_DIR, "tmp");
const SOURCE_PATHS = [
  "src-tauri/src/features/mod.rs",
  "src/core/settingsModel.ts",
  "src-tauri/src/core/settings_model.rs",
  "src/core/defaultSettings.ts",
  "src/core/mocks/mockSettings.ts",
  "src/core/mocks/tauriMock.ts",
  "src/core/mocks/vitestSetup.ts",
  "src/core/navigation/settingsTabs.ts",
];
const originals = new Map(
  SOURCE_PATHS.map((relative) => [
    relative,
    fs.readFileSync(path.join(ROOT_DIR, relative)),
  ]),
);

fs.mkdirSync(TEMP_ROOT, { recursive: true });
const fixtureDir = fs.mkdtempSync(path.join(TEMP_ROOT, "scaffold-test-"));
let featureName = "test_feature";
for (
  let index = 2;
  fs.existsSync(path.join(ROOT_DIR, "src/features", featureName)) ||
  fs.existsSync(
    path.join(ROOT_DIR, "src-tauri/src/features", `${featureName}.rs`),
  );
  index++
) {
  featureName = `test_feature_${index}`;
}
const words = featureName.split("_");
const componentName = words
  .map((word) => word[0].toUpperCase() + word.slice(1))
  .join("");
const settingsKey = componentName[0].toLowerCase() + componentName.slice(1);

function runScript(relativePath, args = [], stdio = "inherit") {
  return execFileSync(
    process.execPath,
    [path.join(ROOT_DIR, relativePath), ...args],
    {
      cwd: fixtureDir,
      stdio,
    },
  );
}

function expectScaffoldFailure(args) {
  assert.throws(() => runScript("scripts/scaffold-feature.js", args, "pipe"));
}

console.log("=== Isolated Scaffold Smoke Test ===");
try {
  // Copy only inputs used by generation, architecture validation and frontend build.
  for (const entry of [
    "src",
    "src-tauri/src",
    "src-tauri/capabilities",
    "src-tauri/tauri.conf.json",
    "public",
    "index.html",
    "package.json",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.ts",
  ]) {
    const destination = path.join(fixtureDir, entry);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(path.join(ROOT_DIR, entry), destination, { recursive: true });
  }
  const biomeConfig = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "biome.json"), "utf8"),
  );
  // The ignored temporary directory is a standalone verification workspace.
  biomeConfig.vcs = { ...biomeConfig.vcs, enabled: false };
  fs.writeFileSync(
    path.join(fixtureDir, "biome.json"),
    JSON.stringify(biomeConfig, null, 2),
  );

  expectScaffoldFailure(["../bad", "Bad"]);
  expectScaffoldFailure(["bad-name", "BadName"]);
  expectScaffoldFailure(["bad_name", "badName"]);
  runScript("scripts/scaffold-feature.js", [featureName, componentName]);
  const generatedTypes = path.join(
    fixtureDir,
    "src/features",
    featureName,
    "types.ts",
  );
  const generatedRust = path.join(
    fixtureDir,
    "src-tauri/src/features",
    `${featureName}.rs`,
  );
  assert(fs.existsSync(generatedTypes), "types.ts was not generated");
  assert(fs.existsSync(generatedRust), "Rust feature module was not generated");
  const tabs = fs.readFileSync(
    path.join(fixtureDir, "src/core/navigation/settingsTabs.ts"),
    "utf8",
  );
  const generatedTabIndex = tabs.indexOf(`id: "${settingsKey}"`);
  assert(
    generatedTabIndex > tabs.indexOf('id: "calendar"'),
    "Generated settings tabs must follow the built-in order",
  );
  expectScaffoldFailure([featureName, componentName]);

  // Dependencies resolve from the repository ancestor; no links or install needed.
  // The generator's local Biome binary is absent in this isolated copy.
  runScript("node_modules/@biomejs/biome/bin/biome", [
    "check",
    "--write",
    "--unsafe",
    ".",
  ]);
  runScript("scripts/verify-architecture.js");
  runScript("node_modules/typescript/bin/tsc", ["--noEmit"]);
  runScript("node_modules/@biomejs/biome/bin/biome", ["check", "."]);
  runScript("node_modules/vite/bin/vite.js", ["build"]);
  console.log(
    "Scaffold inputs, wiring, types, lint, architecture and bundle passed.",
  );
} finally {
  const relative = path.relative(TEMP_ROOT, fixtureDir);
  assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative));
  fs.rmSync(fixtureDir, { recursive: true, force: true });
  for (const [relativePath, content] of originals) {
    assert(
      fs.readFileSync(path.join(ROOT_DIR, relativePath)).equals(content),
      `Scaffold verification changed the source worktree: ${relativePath}`,
    );
  }
  assert(
    !fs.existsSync(fixtureDir),
    "Temporary scaffold workspace was not removed",
  );
  console.log(
    "Source worktree preserved; temporary scaffold workspace removed.",
  );
}
