import { execFileSync, spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebDriverClient, waitFor } from "./webdriver.mjs";

const E2E_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const REPO_ROOT = path.resolve(E2E_ROOT, "..");

export function defaultAppBinaryPath() {
  return path.join(REPO_ROOT, "src-tauri", "target", "debug", "mint.exe");
}

export function defaultReportDir() {
  return path.join(E2E_ROOT, "reports");
}

function buildDebugBinary() {
  console.log(
    "[harness] Building debug binary (tauri build --debug --no-bundle)...",
  );
  const tauriCli = path.join(
    REPO_ROOT,
    "node_modules",
    "@tauri-apps",
    "cli",
    "tauri.js",
  );
  const result = spawnSync(
    process.execPath,
    [tauriCli, "build", "--debug", "--no-bundle"],
    {
      cwd: REPO_ROOT,
      stdio: "inherit",
    },
  );
  if (result.status !== 0) {
    throw new Error(`Debug build failed with exit code ${result.status}`);
  }
}

function resolveNativeDriver(explicitPath) {
  if (explicitPath) return explicitPath;
  if (process.env.MSEDGEDRIVER_PATH) return process.env.MSEDGEDRIVER_PATH;
  if (process.platform === "win32") {
    try {
      const result = spawnSync("where.exe", ["msedgedriver"], {
        encoding: "utf8",
      });
      if (result.status === 0) {
        const first = result.stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean);
        if (first) return first;
      }
    } catch {
      // fall through to tauri-driver's own resolution
    }
  }
  return null;
}

function createRunDir() {
  const runDir = path.join(E2E_ROOT, "tmp", randomUUID());
  mkdirSync(runDir, { recursive: true });
  return runDir;
}

function seedSettings(dataDir) {
  const configDir = path.join(dataDir, "config");
  mkdirSync(configDir, { recursive: true });
  const fixture = readFileSync(
    path.join(E2E_ROOT, "fixtures", "settings.json"),
    "utf8",
  );
  writeFileSync(path.join(configDir, "settings.json"), fixture);
}

function resolveMintProcessIds() {
  if (process.platform === "win32") {
    try {
      const stdout = execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          "Get-Process mint -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id",
        ],
        { encoding: "utf8" },
      );
      return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map(Number);
    } catch {
      return [];
    }
  }
  try {
    const stdout = execFileSync("pgrep", ["-x", "mint"], { encoding: "utf8" });
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(Number);
  } catch {
    return [];
  }
}

async function startTauriDriver({
  port,
  nativeDriver,
  dataDir,
  reportDir,
  commitSha,
}) {
  mkdirSync(reportDir, { recursive: true });
  const logPath = path.join(reportDir, "tauri-driver.log");
  const logStream = createWriteStream(logPath, { flags: "a" });

  const args = ["--port", String(port)];
  if (nativeDriver) {
    args.push("--native-driver", nativeDriver);
  }
  const env = {
    ...process.env,
    MINT_E2E_DATA_DIR: dataDir,
  };
  if (commitSha) env.MINT_COMMIT_SHA = commitSha;

  console.log(
    `[harness] Starting tauri-driver on port ${port} (log: ${logPath})...`,
  );
  const driver = spawn("tauri-driver", args, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  driver.stdout.on("data", (chunk) => logStream.write(chunk));
  driver.stderr.on("data", (chunk) => logStream.write(chunk));
  driver.on("exit", (code) => {
    logStream.write(`[tauri-driver] exited with code ${code}\n`);
    logStream.end();
  });

  await waitFor(
    async () => {
      const response = await fetch(`http://127.0.0.1:${port}/status`);
      return response.ok ? true : null;
    },
    { timeoutMs: 15000, intervalMs: 250, description: "tauri-driver /status" },
  );
  return driver;
}

export async function startHarness({
  build = true,
  nativeDriver = null,
  port = 4444,
  commitSha = process.env.MINT_COMMIT_SHA ?? null,
} = {}) {
  const appBinary = defaultAppBinaryPath();
  if (!existsSync(appBinary)) {
    if (build) {
      buildDebugBinary();
    } else {
      throw new Error(
        `App binary not found at ${appBinary}. Run "node node_modules/@tauri-apps/cli/tauri.js build --debug --no-bundle" first.`,
      );
    }
  }

  const driverPath = resolveNativeDriver(nativeDriver);
  if (process.platform === "win32" && !driverPath) {
    throw new Error(
      "msedgedriver was not found in PATH. Install it via msedgedriver-tool or pass --native-driver <path>.",
    );
  }

  const runDir = createRunDir();
  seedSettings(runDir);
  const baselineMintPids = resolveMintProcessIds();
  const reportDir = defaultReportDir();
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    path.join(reportDir, "run-info.json"),
    JSON.stringify(
      { appBinary, dataDir: runDir, port, startedAt: new Date().toISOString() },
      null,
      2,
    ),
  );

  const driver = await startTauriDriver({
    port,
    nativeDriver: driverPath,
    dataDir: runDir,
    reportDir,
    commitSha,
  });
  const webDriver = new WebDriverClient(`http://127.0.0.1:${port}`);

  const stop = async () => {
    try {
      await webDriver.deleteSession();
    } catch {
      // session may already be gone
    }
    driver.kill();
    await new Promise((resolve) => driver.once("exit", resolve));
  };

  return {
    appBinary,
    dataDir: runDir,
    reportDir,
    port,
    webDriver,
    driver,
    stop,
    baselineMintPids,
  };
}

export async function captureScreenshot(webDriver, reportDir, name) {
  try {
    const data = await webDriver.screenshot();
    if (!data) return;
    const png = Buffer.from(data, "base64");
    const dir = path.join(reportDir, "screenshots");
    mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `${name}.png`);
    writeFileSync(filePath, png);
    console.log(`[harness] Screenshot saved: ${filePath}`);
  } catch (error) {
    console.warn(`[harness] Screenshot failed: ${error.message}`);
  }
}

export async function assertNoProcessRemaining(
  knownPids,
  { timeoutMs = 10000 } = {},
) {
  await waitFor(
    async () => {
      const current = resolveMintProcessIds();
      const alive = knownPids.filter((pid) => current.includes(pid));
      return alive.length === 0 ? true : null;
    },
    { timeoutMs, intervalMs: 250, description: "app process to exit" },
  );
}

export async function currentMintProcessIds({ exclude = [] } = {}) {
  const pids = resolveMintProcessIds();
  const excluded = new Set(exclude);
  return pids.filter((pid) => !excluded.has(pid));
}
