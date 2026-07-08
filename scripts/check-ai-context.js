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

console.log("ai:context output contains all required sections.");
