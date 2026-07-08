import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const SCRIPTS_DIR = path.join(ROOT_DIR, "scripts");

let hasError = false;

const files = fs.readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith(".js"));

console.log(`Checking syntax for ${files.length} script files...`);

for (const file of files) {
  const filePath = path.join(SCRIPTS_DIR, file);
  try {
    execSync(`node --check "${filePath}"`, { stdio: "inherit" });
  } catch (_err) {
    console.error(`Syntax error in ${file}`);
    hasError = true;
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log("All scripts passed syntax check.");
}
