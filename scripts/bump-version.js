import fs from "node:fs";

const newVersion = process.argv[2]?.replace(/^v/, "");

if (!newVersion) {
  console.error("Usage: npm run version:bump <new_version>");
  process.exit(1);
}

const semverPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
if (!semverPattern.test(newVersion)) {
  console.error(`Invalid semver version: ${newVersion}`);
  process.exit(1);
}

// 1. package.json
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
packageJson.version = newVersion;
fs.writeFileSync("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);

// 2. package-lock.json
if (fs.existsSync("package-lock.json")) {
  const packageLock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  packageLock.version = newVersion;
  if (packageLock.packages?.[""]) {
    packageLock.packages[""].version = newVersion;
  }
  fs.writeFileSync(
    "package-lock.json",
    `${JSON.stringify(packageLock, null, 2)}\n`,
  );
}

// 3. src-tauri/tauri.conf.json
const tauriPath = "src-tauri/tauri.conf.json";
if (fs.existsSync(tauriPath)) {
  const tauriConfig = JSON.parse(fs.readFileSync(tauriPath, "utf8"));
  tauriConfig.version = newVersion;
  fs.writeFileSync(tauriPath, `${JSON.stringify(tauriConfig, null, 2)}\n`);
}

// 4. src-tauri/Cargo.toml
const cargoTomlPath = "src-tauri/Cargo.toml";
if (fs.existsSync(cargoTomlPath)) {
  let cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
  cargoToml = cargoToml.replace(
    /(\[package\][\s\S]*?\bversion\s*=\s*")[^"]+(")/,
    `$1${newVersion}$2`,
  );
  fs.writeFileSync(cargoTomlPath, cargoToml);
}

// 5. src-tauri/Cargo.lock
const cargoLockPath = "src-tauri/Cargo.lock";
if (fs.existsSync(cargoLockPath)) {
  let cargoLock = fs.readFileSync(cargoLockPath, "utf8");
  cargoLock = cargoLock.replace(
    /(\[\[package\]\]\s*\nname = "mint"\s*\nversion = ")[^"]+(")/,
    `$1${newVersion}$2`,
  );
  fs.writeFileSync(cargoLockPath, cargoLock);
}

console.log(
  `Successfully bumped version to ${newVersion} across all manifests.`,
);
