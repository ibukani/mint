import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateAiFoundation } from "./check-ai-foundation.js";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const TEMP_ROOT = path.join(ROOT_DIR, "tmp");

function fixture(t) {
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
  const directory = fs.mkdtempSync(path.join(TEMP_ROOT, "foundation-test-"));
  t.after(() => {
    const relative = path.relative(TEMP_ROOT, directory);
    assert(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    );
    fs.rmSync(directory, { recursive: true, force: true });
  });
  for (const entry of [
    "AGENTS.md",
    "README.md",
    "package.json",
    ".nvmrc",
    ".agents",
    "docs",
    ".github",
    "e2e/README.md",
    "performance/README.md",
  ]) {
    const destination = path.join(directory, entry);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.cpSync(path.join(ROOT_DIR, entry), destination, { recursive: true });
  }
  assert.deepEqual(validateAiFoundation(directory).errors, []);
  return directory;
}

test("document wording and headings can change without breaking foundation checks", (t) => {
  const directory = fixture(t);
  const document = path.join(directory, "docs/manual-verification.md");
  const content = fs
    .readFileSync(document, "utf8")
    .replace("## UI変更時の必須確認", "## 画面品質の確認")
    .replace("不自然な点があれば修正し", "表示上の問題を修正して");
  fs.writeFileSync(document, content);
  assert.deepEqual(validateAiFoundation(directory).errors, []);
});

test("a broken skill reference is reported", (t) => {
  const directory = fixture(t);
  fs.appendFileSync(
    path.join(directory, ".agents/skills/audit-feature/SKILL.md"),
    "\nSee [missing reference](../../../docs/missing-reference.md).\n",
  );
  const result = validateAiFoundation(directory);
  assert(result.errors.some((error) => error.includes("missing-reference.md")));
});

test("a frontmatter name mismatch is rejected", (t) => {
  const directory = fixture(t);
  const skill = path.join(directory, ".agents/skills/audit-feature/SKILL.md");
  fs.writeFileSync(
    skill,
    fs
      .readFileSync(skill, "utf8")
      .replace("name: audit-feature", "name: wrong-name"),
  );
  assert(
    validateAiFoundation(directory).errors.some((error) =>
      error.includes("name must match"),
    ),
  );
});

test("optional UI metadata can be absent", (t) => {
  const directory = fixture(t);
  for (const entry of fs.readdirSync(path.join(directory, ".agents/skills"))) {
    fs.rmSync(
      path.join(directory, ".agents/skills", entry, "agents/openai.yaml"),
    );
  }
  assert.deepEqual(validateAiFoundation(directory).errors, []);
});

test("newly discovered skills are validated too", (t) => {
  const directory = fixture(t);
  const skillDirectory = path.join(directory, ".agents/skills/new-workflow");
  fs.mkdirSync(skillDirectory);
  fs.writeFileSync(
    path.join(skillDirectory, "SKILL.md"),
    "---\nname: new-workflow\n---\n\nDescribe the requested workflow.\n",
  );
  assert(
    validateAiFoundation(directory).errors.some(
      (error) =>
        error.includes("new-workflow") && error.includes("description"),
    ),
  );
});

test("a numeric description is rejected", (t) => {
  const directory = fixture(t);
  const skill = path.join(directory, ".agents/skills/audit-feature/SKILL.md");
  fs.writeFileSync(
    skill,
    fs
      .readFileSync(skill, "utf8")
      .replace(/^description:.*$/m, "description: 123"),
  );
  assert(
    validateAiFoundation(directory).errors.some((error) =>
      error.includes("requires a nonempty description"),
    ),
  );
});

test("a full gate cannot silently omit Rust verification", (t) => {
  const directory = fixture(t);
  const packagePath = path.join(directory, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  packageJson.scripts["check:all"] = "npm run check && npm run test:scaffold";
  fs.writeFileSync(packagePath, JSON.stringify(packageJson));
  assert(
    validateAiFoundation(directory).errors.includes(
      "check:all must run npm run check:tauri",
    ),
  );
});

test("CI and local Node version drift is reported", (t) => {
  const directory = fixture(t);
  fs.writeFileSync(path.join(directory, ".nvmrc"), "24.0.0\n");
  const result = validateAiFoundation(directory);
  assert(result.errors.includes(".nvmrc must match package.json engines.node"));
  assert(result.errors.includes("CI Node versions must match .nvmrc"));
});

test("an inconsistent optional UI prompt is reported", (t) => {
  const directory = fixture(t);
  const metadataPath = path.join(
    directory,
    ".agents/skills/audit-feature/agents/openai.yaml",
  );
  fs.writeFileSync(
    metadataPath,
    fs
      .readFileSync(metadataPath, "utf8")
      .replace("$audit-feature", "$different-workflow"),
  );
  assert(
    validateAiFoundation(directory).errors.some((error) =>
      error.includes("default_prompt must mention $audit-feature"),
    ),
  );
});
