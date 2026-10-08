import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNoProcessRemaining,
  captureScreenshot,
  currentMintProcessIds,
} from "../helpers/harness.mjs";
import { waitFor } from "../helpers/webdriver.mjs";

const E2E_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const FIXTURE_SETTINGS = path.join(E2E_ROOT, "fixtures", "settings.json");

function invokeScript(command, args) {
  return `const done = arguments[arguments.length - 1];
window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)}, ${JSON.stringify(args)})
  .then(() => done(null))
  .catch((error) => done(String(error)));`;
}

async function invokeOk(webDriver, command, args) {
  const error = await webDriver.executeAsync(invokeScript(command, args));
  if (error) {
    throw new Error(`${command} failed: ${error}`);
  }
}

async function waitForWindowHandle(webDriver, knownHandles, description) {
  const handles = await waitFor(
    async () => {
      const current = await webDriver.windowHandles();
      return current.some((handle) => !knownHandles.has(handle))
        ? current
        : null;
    },
    { description },
  );
  return handles.find((handle) => !knownHandles.has(handle));
}

async function waitForMainWindow(webDriver) {
  const handles = await waitFor(
    async () => {
      const current = await webDriver.windowHandles();
      return current.length > 0 ? current : null;
    },
    { description: "main window handle" },
  );
  await webDriver.switchWindow(handles[0]);
  return handles[0];
}

export async function runSmokeSpecs(harness) {
  const { webDriver, appBinary, dataDir, reportDir, baselineMintPids } =
    harness;
  const results = [];
  let appPids = [];
  const mintProcesses = () =>
    currentMintProcessIds({ exclude: baselineMintPids });

  const spec = async (name, fn) => {
    try {
      await fn();
      results.push({ name, status: "passed" });
    } catch (error) {
      await captureScreenshot(webDriver, reportDir, `failure-${name}`);
      results.push({ name, status: "failed", error: error.message });
      throw error;
    }
  };

  const retiredFiles = [
    "quick_capture.sqlite3",
    "quick_capture_attachments/sentinel-note/sentinel.txt",
    "file_shelf.sqlite3",
    "file_shelf_assets/sentinel.txt",
  ];
  for (const name of retiredFiles) {
    const target = path.join(dataDir, "data", name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, "retired data must remain unchanged");
  }

  await spec("起動とメインウィンドウ表示", async () => {
    await webDriver.createSession(appBinary);
    await waitForMainWindow(webDriver);
    const info = await waitFor(
      async () => {
        const value = await webDriver.execute(`return {
          title: document.title,
          root: !!document.querySelector("#root"),
          theme: document.documentElement.dataset.theme || null
        };`);
        return value.root && value.theme === "dark" ? value : null;
      },
      { description: "main UI rendered with theme applied" },
    );
    if (!info.title.toLowerCase().includes("mint")) {
      throw new Error(`Unexpected document.title: ${info.title}`);
    }
    if (info.theme !== "dark") {
      throw new Error(`Unexpected initial theme: ${info.theme}`);
    }
    appPids = await mintProcesses();
    if (appPids.length === 0) {
      throw new Error("mint process not found after startup");
    }
  });

  await spec("廃止機能の移行と保存データ保持", async () => {
    const saved = JSON.parse(
      readFileSync(path.join(dataDir, "config", "settings.json"), "utf8"),
    );
    if (saved.schemaVersion !== 3)
      throw new Error("settings were not migrated to v3");
    for (const key of ["fileShelf", "quickCapture", "voiceToText"]) {
      if (key in saved.data) throw new Error(`retired settings remain: ${key}`);
      const error = await webDriver.executeAsync(
        invokeScript("open_overlay", { target: key }),
      );
      if (!error) throw new Error(`retired target accepted: ${key}`);
    }
    for (const command of [
      "load_quick_capture_state",
      "load_file_shelf_state",
      "transcribe_audio_file",
      "load_api_key",
    ]) {
      const error = await webDriver.executeAsync(invokeScript(command, {}));
      if (!error) throw new Error(`retired command accepted: ${command}`);
    }
    const backupDir = path.join(dataDir, "config", "backups");
    const backups = existsSync(backupDir) ? readdirSync(backupDir) : [];
    if (!backups.some((name) => name.startsWith("settings.v2.backup-")))
      throw new Error("migration backup missing");
    for (const name of retiredFiles) {
      if (
        readFileSync(path.join(dataDir, "data", name), "utf8") !==
        "retired data must remain unchanged"
      )
        throw new Error(`retired saved data changed: ${name}`);
    }
    const labels = await webDriver.execute(
      'return Array.from(document.querySelectorAll("nav button")).map(el => el.textContent);',
    );
    if (
      labels.some((label) =>
        /クイックキャプチャー|音声入力|シェルフ/.test(label),
      )
    )
      throw new Error("retired tab remains visible");
  });

  await spec("設定保存と再起動後の復元", async () => {
    const settings = JSON.parse(readFileSync(FIXTURE_SETTINGS, "utf8"));
    settings.data.theme = "light";
    await invokeOk(webDriver, "save_settings", { settings: settings.data });

    const saved = await waitFor(
      () => {
        const onDisk = JSON.parse(
          readFileSync(path.join(dataDir, "config", "settings.json"), "utf8"),
        );
        return onDisk.data?.theme === "light" ? onDisk : null;
      },
      { description: "settings.json theme light on disk" },
    );
    if (saved.data.theme !== "light") {
      throw new Error("theme was not persisted to settings.json");
    }

    await webDriver.deleteSession();
    await webDriver.createSession(appBinary);
    await waitForMainWindow(webDriver);
    const theme = await waitFor(
      async () => {
        const value = await webDriver.execute(
          `return document.documentElement.dataset.theme || null;`,
        );
        return value === "light" ? value : null;
      },
      { description: "theme light applied after restart" },
    );
    if (theme !== "light") {
      throw new Error(`Theme was not restored after restart: ${theme}`);
    }
    appPids = await mintProcesses();
  });

  await spec("clock overlay の開閉", async () => {
    const before = new Set(await webDriver.windowHandles());
    await invokeOk(webDriver, "open_overlay", { target: "clock" });
    const clockHandle = await waitForWindowHandle(
      webDriver,
      before,
      "clock window handle",
    );
    await webDriver.switchWindow(clockHandle);
    await waitFor(
      async () => {
        const value = await webDriver.execute(`return {
          root: !!document.querySelector("#root"),
          text: (document.querySelector("#root")?.textContent || "").trim()
        };`);
        return value.root && value.text.length > 0 ? value : null;
      },
      { description: "clock UI rendered" },
    );
    await captureScreenshot(webDriver, reportDir, "clock-overlay");

    await webDriver.switchWindow(before.values().next().value);
    await invokeOk(webDriver, "open_overlay", { target: "clock" });
  });

  await spec("正常終了とプロセス残存なし", async () => {
    await webDriver.deleteSession();
    await assertNoProcessRemaining(appPids);
  });

  return results;
}
