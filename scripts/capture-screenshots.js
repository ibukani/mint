import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const ROOT_DIR = process.cwd();
const FONTCONFIG_FILE = path.join(
  ROOT_DIR,
  "scripts/playwright-fontconfig.conf",
);
const OUTPUT_DIR =
  process.env.SCREENSHOT_DIR ?? path.join(ROOT_DIR, "tmp/screenshots");
const TARGET_URL = process.env.SCREENSHOT_URL ?? "http://127.0.0.1:1420/";

process.env.FONTCONFIG_FILE ??= FONTCONFIG_FILE;

const viewports = [
  ["desktop", 1200, 800],
  ["mobile", 390, 844],
];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const browser = await chromium.launch();

try {
  for (const [name, width, height] of viewports) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(TARGET_URL, { waitUntil: "networkidle" });
    await page.waitForSelector(".design-settings-section__title");
    await page.waitForTimeout(500);

    const outputPath = path.join(OUTPUT_DIR, `${name}.png`);
    await page.screenshot({ path: outputPath, fullPage: true });
    await page.close();
    console.log(`[captured] ${outputPath}`);
  }
} finally {
  await browser.close();
}
