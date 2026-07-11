import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();

const REQUIRED_PACKAGE_SCRIPTS = [
  "ai:context",
  "check:ai-context",
  "check:ai-foundation",
  "check:quick",
  "check",
  "check:all",
  "check:tauri",
  "test:scaffold",
  "verify:architecture",
];

const REQUIRED_CORE_DOCS = [
  "AGENTS.md",
  "README.md",
  "docs/ai-development.md",
  "docs/ai-foundation-audit.md",
  "docs/ai-quality-rubric.md",
  "docs/architecture.md",
  "docs/manual-verification.md",
  "docs/adr/001-static-feature-module.md",
];

const REQUIRED_REPOSITORY_SKILLS = [
  "add-overlay-window",
  "add-tauri-command",
  "audit-feature",
  "change-mint-ui",
  "create-static-feature",
  "repair-after-review",
  "update-settings-schema",
];

const REQUIRED_CI_COMMANDS = [
  "npm run check",
  "npm run test:scaffold",
  "npm run check:tauri",
];

const REQUIRED_PR_TEMPLATE_CHECKS = [
  "Featureの追加・変更",
  "AppSettingsの変更",
  "Tauriコマンドの追加・変更",
  "Window Routeの追加・変更",
  "Placeholderの副作用制御",
  "npm run check:quick",
  "npm run check",
  "npm run check:all",
  "npm run test:scaffold",
  "npm run check:tauri",
];

const REQUIRED_AI_DEVELOPMENT_CONTENT = [
  "npm run scaffold:feature new_tool NewTool",
  "Do not manually create the initial feature wiring.",
  "npm run check:all",
];

const FORBIDDEN_AI_DEVELOPMENT_CONTENT = [
  "### Step 1: Update AppSettings Types",
  "Modify the global configuration types to include the new tool's settings.",
];

const REQUIRED_ARCHITECTURE_CONTENT = [
  "npm run scaffold:feature <feature_name>",
  "ブラウザ/Vitestモック",
  "npm run check:all",
];

const REQUIRED_AI_RUBRIC_CONTENT = [
  "## 100-Point Standard",
  "npm run ai:context",
  "npm run check:quick",
  "npm run check:all",
  "Residual Risk Policy",
];

let hasError = false;
let passCount = 0;
const verbose = process.argv.includes("--verbose");

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT_DIR, relativePath), "utf-8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function reportError(message) {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`);
  hasError = true;
}

function reportPass(message) {
  passCount++;
  if (verbose) {
    console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
  }
}

function expectFile(relativePath) {
  if (!fs.existsSync(path.join(ROOT_DIR, relativePath))) {
    reportError(`Required file is missing: ${relativePath}`);
    return false;
  }
  reportPass(`Required file exists: ${relativePath}`);
  return true;
}

function expectContains(label, content, expected) {
  if (!content.includes(expected)) {
    reportError(`${label} is missing "${expected}"`);
    return;
  }
  reportPass(`${label} includes "${expected}"`);
}

const packageJson = readJson("package.json");
const nvmVersion = fs.existsSync(path.join(ROOT_DIR, ".nvmrc"))
  ? readText(".nvmrc").trim()
  : "";

for (const script of REQUIRED_PACKAGE_SCRIPTS) {
  if (!packageJson.scripts?.[script]) {
    reportError(`package.json is missing required script "${script}"`);
  } else {
    reportPass(`package.json defines "${script}"`);
  }
}

function scriptRunsAiFoundation(scriptName) {
  const script = packageJson.scripts?.[scriptName] ?? "";
  return (
    script.includes("check:ai-foundation") ||
    script.includes("scripts/check-ai-foundation.js")
  );
}

if (!scriptRunsAiFoundation("check:quick")) {
  reportError('package.json script "check:quick" must run check:ai-foundation');
} else {
  reportPass('package.json script "check:quick" runs check:ai-foundation');
}

if (!scriptRunsAiFoundation("check")) {
  reportError('package.json script "check" must run check:ai-foundation');
} else {
  reportPass('package.json script "check" runs check:ai-foundation');
}

const checkAllScript = packageJson.scripts?.["check:all"] ?? "";
for (const requiredCommand of [
  "npm run check",
  "npm run test:scaffold",
  "npm run check:tauri",
]) {
  if (!checkAllScript.includes(requiredCommand)) {
    reportError(
      `package.json script "check:all" must run "${requiredCommand}"`,
    );
  } else {
    reportPass(`package.json script "check:all" runs "${requiredCommand}"`);
  }
}

if (expectFile(".nvmrc")) {
  const engineVersion = packageJson.engines?.node?.replace(/^>=/, "");
  if (nvmVersion !== engineVersion) {
    reportError(
      `.nvmrc (${nvmVersion}) must match package.json engines.node (${packageJson.engines?.node})`,
    );
  } else {
    reportPass(".nvmrc matches package.json engines.node");
  }
}

for (const doc of REQUIRED_CORE_DOCS) {
  expectFile(doc);
}

for (const skill of REQUIRED_REPOSITORY_SKILLS) {
  const skillDir = `.agents/skills/${skill}`;
  const skillPath = `${skillDir}/SKILL.md`;
  const metadataPath = `${skillDir}/agents/openai.yaml`;
  if (expectFile(skillPath)) {
    const skillContent = readText(skillPath);
    expectContains(skillPath, skillContent, `name: ${skill}`);
    if (/\bTODO\b|\[TODO/.test(skillContent)) {
      reportError(`${skillPath} contains unfinished TODO guidance`);
    } else {
      reportPass(`${skillPath} contains no unfinished TODO guidance`);
    }
  }
  if (expectFile(metadataPath)) {
    const metadata = readText(metadataPath);
    expectContains(metadataPath, metadata, "display_name:");
    expectContains(metadataPath, metadata, "short_description:");
    expectContains(metadataPath, metadata, `$${skill}`);
  }
}

const skillRoot = path.join(ROOT_DIR, ".agents/skills");
for (const entry of fs.readdirSync(skillRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) {
    reportError(
      `Skill directory must use kebab-case: .agents/skills/${entry.name}`,
    );
  } else {
    reportPass(`Skill directory uses kebab-case: ${entry.name}`);
  }
}

if (expectFile("docs/ai-development.md")) {
  const aiDevelopment = readText("docs/ai-development.md");
  for (const item of REQUIRED_AI_DEVELOPMENT_CONTENT) {
    expectContains("docs/ai-development.md", aiDevelopment, item);
  }
  for (const forbidden of FORBIDDEN_AI_DEVELOPMENT_CONTENT) {
    if (aiDevelopment.includes(forbidden)) {
      reportError(
        `docs/ai-development.md contains stale guidance: "${forbidden}"`,
      );
    } else {
      reportPass(`docs/ai-development.md omits stale guidance: "${forbidden}"`);
    }
  }
}

if (expectFile("docs/architecture.md")) {
  const architecture = readText("docs/architecture.md");
  for (const item of REQUIRED_ARCHITECTURE_CONTENT) {
    expectContains("docs/architecture.md", architecture, item);
  }
}

if (expectFile("docs/ai-quality-rubric.md")) {
  const rubric = readText("docs/ai-quality-rubric.md");
  for (const item of REQUIRED_AI_RUBRIC_CONTENT) {
    expectContains("docs/ai-quality-rubric.md", rubric, item);
  }
}

if (expectFile(".github/workflows/ci.yml")) {
  const ciContent = readText(".github/workflows/ci.yml");
  for (const command of REQUIRED_CI_COMMANDS) {
    expectContains(".github/workflows/ci.yml", ciContent, command);
  }
  expectContains(
    ".github/workflows/ci.yml",
    ciContent,
    `node-version: '${nvmVersion}'`,
  );
  expectContains(
    ".github/workflows/ci.yml",
    ciContent,
    "dtolnay/rust-toolchain@stable",
  );
  expectContains(
    ".github/workflows/ci.yml",
    ciContent,
    "components: rustfmt, clippy",
  );
}

if (expectFile(".github/pull_request_template.md")) {
  const prTemplate = readText(".github/pull_request_template.md");
  for (const item of REQUIRED_PR_TEMPLATE_CHECKS) {
    expectContains(".github/pull_request_template.md", prTemplate, item);
  }
}

if (expectFile("README.md")) {
  const readme = readText("README.md");
  expectContains("README.md", readme, "npm run scaffold:feature");
  expectContains("README.md", readme, "npm run check:all");
  expectContains("README.md", readme, "docs/ai-quality-rubric.md");
  expectContains("README.md", readme, "AGENTS.md");
  if (readme.includes(".agents/AGENTS.md")) {
    reportError(
      "README.md points to .agents/AGENTS.md, but the repository uses root AGENTS.md",
    );
  } else {
    reportPass("README.md points to root AGENTS.md");
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`AI development foundation checks passed (${passCount} checks).`);
