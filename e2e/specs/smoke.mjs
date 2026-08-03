import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertNoProcessRemaining,
  captureScreenshot,
  currentMintProcessIds,
} from "../helpers/harness.mjs";
import { sleepMs, waitFor } from "../helpers/webdriver.mjs";

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

  await spec("クイックキャプチャー文字入力と再表示後の残存", async () => {
    const mainHandle = await webDriver.currentWindowHandle();
    const before = new Set(await webDriver.windowHandles());
    await invokeOk(webDriver, "open_overlay", { target: "quickCapture" });
    const qcHandle = await waitForWindowHandle(
      webDriver,
      before,
      "quick capture window handle",
    );
    await webDriver.switchWindow(qcHandle);
    await waitFor(
      async () =>
        (await webDriver.execute(
          `return !!document.getElementById("quick-capture-content");`,
        ))
          ? true
          : null,
      { description: "quick capture textarea" },
    );
    await webDriver.execute(`const el = document.getElementById("quick-capture-content");
const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
setter.call(el, "E2E draft text");
el.dispatchEvent(new Event("input", { bubbles: true }));
return el.value;`);
    await sleepMs(800);

    await webDriver.switchWindow(mainHandle);
    await invokeOk(webDriver, "open_overlay", { target: "quickCapture" });
    await sleepMs(300);
    await invokeOk(webDriver, "open_overlay", { target: "quickCapture" });
    await webDriver.switchWindow(qcHandle);

    const value = await waitFor(
      async () => {
        const current = await webDriver.execute(
          `return document.getElementById("quick-capture-content")?.value ?? "";`,
        );
        return current === "E2E draft text" ? current : null;
      },
      { description: "draft content preserved across hide/show" },
    );
    if (value !== "E2E draft text") {
      throw new Error(`Unexpected draft content after reopen: ${value}`);
    }
    await captureScreenshot(webDriver, reportDir, "quick-capture-draft");
  });

  await spec("正常終了とプロセス残存なし", async () => {
    await webDriver.deleteSession();
    await assertNoProcessRemaining(appPids);
  });

  return results;
}
