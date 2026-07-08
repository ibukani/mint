import { buildAiContext } from "./ai-context.js";

const output = buildAiContext();

const requiredSections = [
  "# Mint AI Context",
  "## Features",
  "## AppSettings",
  "## Windows",
  "## Frontend invokes",
  "## Rust commands",
  "## Useful scripts",
];

const missing = requiredSections.filter((section) => !output.includes(section));

if (missing.length > 0) {
  console.error(
    `ai:context output is missing required section(s): ${missing.join(", ")}`,
  );
  process.exit(1);
}

const requiredContent = [
  "docs/ai-development.md - mandatory AI development rules",
  "docs/ai-foundation-audit.md - current AI development foundation status",
  "docs/ai-quality-rubric.md - 100-point AI development quality bar",
  "check:ai-foundation:",
  "verify:architecture:",
  "check:quick:",
  "check:",
  "check:all:",
  "check:tauri:",
];

const missingContent = requiredContent.filter((item) => !output.includes(item));

if (missingContent.length > 0) {
  console.error(
    `ai:context output is missing required content: ${missingContent.join(", ")}`,
  );
  process.exit(1);
}

console.log("ai:context output contains required sections and content.");
