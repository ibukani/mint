import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function listDirs(relativePath) {
  const fullPath = path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(fullPath)) return [];
  return fs
    .readdirSync(fullPath)
    .filter((entry) => fs.statSync(path.join(fullPath, entry)).isDirectory())
    .sort();
}

function listFilesRecursive(relativePath, predicate) {
  const root = path.join(ROOT_DIR, relativePath);
  const results = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const relative = path.relative(ROOT_DIR, fullPath);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (["node_modules", "dist", "target"].includes(entry)) continue;
        walk(fullPath);
      } else if (predicate(relative)) {
        results.push(relative);
      }
    }
  }

  if (fs.existsSync(root)) walk(root);
  return results.sort();
}

function extractAppSettings() {
  const content = readText("src/core/context/AppSettings.tsx");
  const match = /export\s+interface\s+AppSettings\s*\{([\s\S]*?)\n\}/.exec(
    content,
  );
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"))
    .map((line) => line.replace(/;$/, ""));
}

function extractRustCommands() {
  const rustFiles = listFilesRecursive("src-tauri/src", (relative) =>
    relative.endsWith(".rs"),
  );
  const commands = [];
  for (const file of rustFiles) {
    const content = readText(file);
    const commandRegex = /#\[tauri::command\]\s*(?:pub\s+)?fn\s+(\w+)/g;
    let match = commandRegex.exec(content);
    while (match) {
      commands.push(`${match[1]} (${file})`);
      match = commandRegex.exec(content);
    }
  }
  return commands.sort();
}

function extractInvokes() {
  const sourceFiles = listFilesRecursive(
    "src",
    (relative) => relative.endsWith(".ts") || relative.endsWith(".tsx"),
  ).filter((relative) => !relative.includes("/mocks/"));
  const invokes = new Set();
  for (const file of sourceFiles) {
    const content = readText(file);
    const invokeRegex = /invoke(?:<\w+>)?\(\s*["'](\w+)["']/g;
    let match = invokeRegex.exec(content);
    while (match) {
      invokes.add(match[1]);
      match = invokeRegex.exec(content);
    }
  }
  return [...invokes].sort();
}

function formatSection(title, lines) {
  const output = [`\n## ${title}`];
  if (lines.length === 0) {
    output.push("- none");
    return output.join("\n");
  }
  for (const line of lines) {
    output.push(`- ${line}`);
  }
  return output.join("\n");
}

export function buildAiContext() {
  const packageJson = readJson("package.json");
  const tauriConf = readJson("src-tauri/tauri.conf.json");
  const windows = tauriConf.app?.windows ?? [];

  const output = [
    "# Mint AI Context",
    `Generated from current worktree: ${new Date().toISOString()}`,
    "Read first for broad changes: AGENTS.md, docs/ai-development.md",
    formatSection(
      "Features",
      listDirs("src/features").map((feature) => {
        const hasBackend = fs.existsSync(
          path.join(ROOT_DIR, "src-tauri/src/features", `${feature}.rs`),
        );
        return `${feature}${hasBackend ? " (frontend + backend module)" : " (frontend only)"}`;
      }),
    ),
    formatSection("AppSettings", extractAppSettings()),
    formatSection(
      "Windows",
      windows.map((window) => `${window.label}: ${window.url ?? "index.html"}`),
    ),
    formatSection("Frontend invokes", extractInvokes()),
    formatSection("Rust commands", extractRustCommands()),
    formatSection(
      "Repository skills",
      listDirs(".agents/skills").map(
        (skill) => `.agents/skills/${skill}/SKILL.md`,
      ),
    ),
    formatSection("Core docs", [
      "docs/ai-development.md - mandatory AI development rules",
      "docs/ai-foundation-audit.md - current AI development foundation status",
      "docs/ai-quality-rubric.md - 100-point AI development quality bar",
      "docs/architecture.md - static feature-module overview",
      "docs/manual-verification.md - manual desktop checks",
      "docs/adr/001-static-feature-module.md - architecture decision",
    ]),
    formatSection(
      "Useful scripts",
      [
        "ai:context",
        "verify:architecture",
        "verify:architecture:verbose",
        "check:scripts",
        "check:ai-context",
        "check:ai-foundation",
        "check:quick",
        "test",
        "check",
        "check:all",
        "check:tauri",
        "scaffold:feature",
      ]
        .filter((script) => packageJson.scripts?.[script])
        .map((script) => `${script}: ${packageJson.scripts[script]}`),
    ),
  ];

  return `${output.join("\n")}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(buildAiContext());
}
