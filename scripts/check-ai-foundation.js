import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_SCRIPTS = [
  "ai:context",
  "check:ai-context",
  "check:ai-foundation",
  "test:ai-foundation",
  "check:quick",
  "check",
  "check:all",
  "check:tauri",
  "test:scaffold",
  "verify:architecture",
];
const CORE_DOCS = [
  "AGENTS.md",
  ".agents/AGENTS.md",
  "README.md",
  "docs/ai-development.md",
  "docs/ai-foundation-audit.md",
  "docs/ai-quality-rubric.md",
  "docs/architecture.md",
  "docs/design-architecture.md",
  "docs/manual-verification.md",
  "docs/migrations.md",
  "docs/security-capabilities.md",
  "docs/adr/001-static-feature-module.md",
];
const REQUIRED_SKILLS = [
  "add-overlay-window",
  "add-tauri-command",
  "audit-feature",
  "change-mint-ui",
  "create-static-feature",
  "repair-after-review",
  "update-settings-schema",
];

// Basic scalar checks for discovery/UI fields, not a general YAML parser.
function readScalar(content, key, indented = false) {
  const match = new RegExp(
    `^${indented ? "[ \\t]*" : ""}${key}:[ \\t]*(.*)$`,
    "m",
  ).exec(content);
  if (!match) return "";
  const value = match[1].trim();
  if (/^[>|][-+]?$/.test(value)) {
    const continuation = content
      .slice(match.index + match[0].length)
      .match(/^(?:\r?\n[ \t]+[^\r\n]*)+/);
    return continuation?.[0].trim() ?? "";
  }
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "string" ? parsed.trim() : "";
    } catch {
      return "";
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'").trim();
  }
  if (/^(?:null|true|false|\d+(?:\.\d+)?|\[.*\]|\{.*\})$/.test(value))
    return "";
  return value.replace(/\s+#.*$/, "").trim();
}

export function validateAiFoundation(rootDir = process.cwd()) {
  const errors = [];
  let checks = 0;
  const expect = (condition, message) => {
    checks++;
    if (!condition) errors.push(message);
  };
  const readText = (relativePath) => {
    const absolutePath = path.join(rootDir, relativePath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      expect(false, `Required file is missing: ${relativePath}`);
      return "";
    }
    const content = fs.readFileSync(absolutePath, "utf8");
    expect(
      content.trim().length > 0,
      `Required file is empty: ${relativePath}`,
    );
    return content;
  };
  const readJson = (relativePath) => {
    try {
      return JSON.parse(readText(relativePath));
    } catch {
      expect(false, `Invalid JSON: ${relativePath}`);
      return {};
    }
  };
  const checkLinks = (relativePath, content) => {
    for (const match of content.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const target = match[1].replace(/^<|>$/g, "");
      if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) continue;
      try {
        const localPath = decodeURIComponent(target.split("#")[0]);
        const resolved = path.resolve(
          rootDir,
          path.dirname(relativePath),
          localPath,
        );
        expect(
          fs.existsSync(resolved),
          `${relativePath} has a missing local reference: ${target}`,
        );
      } catch {
        expect(
          false,
          `${relativePath} has an invalid local reference: ${target}`,
        );
      }
    }
  };
  const packageJson = readJson("package.json");
  for (const script of REQUIRED_SCRIPTS) {
    expect(
      Boolean(packageJson.scripts?.[script]),
      `Missing package script: ${script}`,
    );
  }
  for (const scriptName of ["check:quick", "check"]) {
    const commands = (packageJson.scripts?.[scriptName] ?? "").split(
      /\s*&&\s*/,
    );
    expect(
      commands.includes("node scripts/check-ai-foundation.js") ||
        commands.includes("npm run check:ai-foundation"),
      `${scriptName} must run check:ai-foundation`,
    );
  }
  const allCommands = (packageJson.scripts?.["check:all"] ?? "").split(
    /\s*&&\s*/,
  );
  for (const command of [
    "npm run check",
    "npm run test:scaffold",
    "npm run check:tauri",
  ]) {
    expect(allCommands.includes(command), `check:all must run ${command}`);
  }
  expect(
    (packageJson.scripts?.check ?? "")
      .split(/\s*&&\s*/)
      .some(
        (command) =>
          command === "npm run test:ai-foundation" ||
          command === "node --test scripts/check-ai-foundation.test.js",
      ),
    "check must run the AI foundation regression tests",
  );
  const nodeVersion = readText(".nvmrc").trim();
  expect(
    nodeVersion === packageJson.engines?.node?.replace(/^>=/, ""),
    ".nvmrc must match package.json engines.node",
  );
  for (const doc of CORE_DOCS) checkLinks(doc, readText(doc));

  const skillRoot = path.join(rootDir, ".agents/skills");
  const directories = fs.existsSync(skillRoot)
    ? fs
        .readdirSync(skillRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];
  for (const name of REQUIRED_SKILLS) {
    expect(directories.includes(name), `Required skill is missing: ${name}`);
  }
  for (const name of directories) {
    expect(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && name.length <= 64,
      `Skill directory must use kebab-case (max 64 characters): ${name}`,
    );
    const skillPath = `.agents/skills/${name}/SKILL.md`;
    const content = readText(skillPath);
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
    expect(Boolean(frontmatter), `${skillPath} must have YAML frontmatter`);
    if (frontmatter) {
      expect(
        readScalar(frontmatter[1], "name") === name,
        `${skillPath} name must match its directory`,
      );
      const description = readScalar(frontmatter[1], "description");
      expect(
        description.length > 0 && description.length <= 1024,
        `${skillPath} requires a nonempty description (max 1024 characters)`,
      );
      expect(
        content.slice(frontmatter[0].length).trim().length > 0,
        `${skillPath} requires workflow instructions`,
      );
      expect(
        !/^\s*\[TODO:[^\n]*\]\s*$/m.test(content),
        `${skillPath} contains an unfinished scaffold placeholder`,
      );
    }
    checkLinks(skillPath, content);
    const metadataPath = `.agents/skills/${name}/agents/openai.yaml`;
    if (fs.existsSync(path.join(rootDir, metadataPath))) {
      const metadata = readText(metadataPath);
      expect(
        Boolean(readScalar(metadata, "display_name", true)),
        `${metadataPath} requires display_name`,
      );
      const shortDescription = readScalar(metadata, "short_description", true);
      expect(
        Array.from(shortDescription).length >= 25 &&
          Array.from(shortDescription).length <= 64,
        `${metadataPath} short_description must contain 25–64 characters`,
      );
      expect(
        readScalar(metadata, "default_prompt", true).includes(`$${name}`),
        `${metadataPath} default_prompt must mention $${name}`,
      );
    }
  }
  const ci = readText(".github/workflows/ci.yml");
  for (const script of ["check", "test:scaffold", "check:tauri"]) {
    expect(
      new RegExp(`\\bnpm run ${script}(?=\\s|$)`).test(ci),
      `CI must run ${script}`,
    );
  }
  const ciVersions = [
    ...ci.matchAll(/node-version:\s*["']?(\d+\.\d+\.\d+)["']?/g),
  ];
  expect(
    ciVersions.length > 0 &&
      ciVersions.every((match) => match[1] === nodeVersion),
    "CI Node versions must match .nvmrc",
  );
  expect(
    ci.includes("dtolnay/rust-toolchain@stable") &&
      ci.includes("components: rustfmt, clippy"),
    "CI must install rustfmt and clippy",
  );
  checkLinks(
    ".github/pull_request_template.md",
    readText(".github/pull_request_template.md"),
  );
  return { errors, checks };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = validateAiFoundation();
  for (const error of result.errors) console.error(`[ERROR] ${error}`);
  if (result.errors.length > 0) process.exitCode = 1;
  else
    console.log(
      `AI development foundation checks passed (${result.checks} checks).`,
    );
}
