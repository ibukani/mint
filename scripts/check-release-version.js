import fs from "node:fs";

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const packageJson = readJson("package.json");

const arg = process.argv[2];
const expectedTag = arg
  ? arg.startsWith("v")
    ? arg
    : `v${arg}`
  : `v${packageJson.version}`;

const expectedVersion = expectedTag.startsWith("v") ? expectedTag.slice(1) : "";
const semverPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (!expectedVersion || !semverPattern.test(expectedVersion)) {
  console.error(`Release tag must use the form v<semver>: ${expectedTag}`);
  process.exit(1);
}

const packageLock = readJson("package-lock.json");
const tauriConfig = readJson("src-tauri/tauri.conf.json");
const cargoToml = fs.readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoLock = fs.readFileSync("src-tauri/Cargo.lock", "utf8");

const cargoPackageSection = cargoToml.match(
  /\[package\]([\s\S]*?)(?=\n\[|$)/,
)?.[1];
const cargoTomlVersion = cargoPackageSection?.match(
  /^version\s*=\s*"([^"]+)"/m,
)?.[1];
const cargoLockVersion = cargoLock.match(
  /\[\[package\]\]\s*\nname = "mint"\s*\nversion = "([^"]+)"/,
)?.[1];

const versions = [
  ["package.json", packageJson.version],
  ["package-lock.json", packageLock.version],
  ["package-lock.json packages['']", packageLock.packages?.[""]?.version],
  ["src-tauri/tauri.conf.json", tauriConfig.version],
  ["src-tauri/Cargo.toml", cargoTomlVersion],
  ["src-tauri/Cargo.lock", cargoLockVersion],
];

const mismatches = versions.filter(
  ([, version]) => version !== expectedVersion,
);

if (mismatches.length > 0) {
  console.error(
    `Release tag ${expectedTag} does not match application versions:`,
  );
  for (const [file, version] of mismatches) {
    console.error(`- ${file}: ${version ?? "missing"}`);
  }
  process.exit(1);
}

console.log(
  `Release version ${expectedVersion} is synchronized across all manifests.`,
);
