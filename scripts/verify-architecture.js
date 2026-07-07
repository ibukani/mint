import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const TS_SETTINGS_PATH = path.join(ROOT_DIR, 'src/core/context/AppSettings.tsx');
const RS_SETTINGS_PATH = path.join(ROOT_DIR, 'src-tauri/src/core/settings.rs');
const FEATURES_DIR = path.join(ROOT_DIR, 'src/features');

console.log('\x1b[36m%s\x1b[0m', '=== Static Feature-Module Architecture Validator ===\n');

let errorsCount = 0;

function reportError(message) {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`);
  errorsCount++;
}

function reportSuccess(message) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
}

// 1. Scan features directory
if (!fs.existsSync(FEATURES_DIR)) {
  reportError(`Features directory does not exist: ${FEATURES_DIR}`);
  process.exit(1);
}

const featureFolders = fs.readdirSync(FEATURES_DIR).filter(file => {
  return fs.statSync(path.join(FEATURES_DIR, file)).isDirectory();
});

console.log(`Scanning features in src/features/: ${featureFolders.join(', ')}`);

// 2. Load AppSettings.tsx to parse imports
if (!fs.existsSync(TS_SETTINGS_PATH)) {
  reportError(`AppSettings.tsx not found at: ${TS_SETTINGS_PATH}`);
  process.exit(1);
}
const tsSettingsContent = fs.readFileSync(TS_SETTINGS_PATH, 'utf-8');

// Match: import { ClockSettings } from "../../features/clock/types";
const importRegex = /import\s+(?:type\s+)?\{\s*(\w+)\s*\}\s+from\s+["']\.\.\/\.\.\/features\/([^/]+)\/types["']/g;
const importedSettings = new Map(); // folder => typeName
let match;
while ((match = importRegex.exec(tsSettingsContent)) !== null) {
  const [_, typeName, folderName] = match;
  importedSettings.set(folderName, typeName);
}

// Verify every folder in src/features is imported in AppSettings.tsx
for (const folder of featureFolders) {
  // Check types.ts exists
  const typesPath = path.join(FEATURES_DIR, folder, 'types.ts');
  if (!fs.existsSync(typesPath)) {
    reportError(`Feature "${folder}" is missing types.ts at ${typesPath}`);
  } else {
    reportSuccess(`Feature "${folder}" has types.ts`);
  }

  // Check *Settings.tsx exists in components/
  const componentsDir = path.join(FEATURES_DIR, folder, 'components');
  if (!fs.existsSync(componentsDir)) {
    reportError(`Feature "${folder}" is missing components/ directory`);
  } else {
    const files = fs.readdirSync(componentsDir);
    const hasSettingsComponent = files.some(file => file.endsWith('Settings.tsx'));
    if (!hasSettingsComponent) {
      reportError(`Feature "${folder}" is missing a *Settings.tsx component in components/`);
    } else {
      reportSuccess(`Feature "${folder}" has a Settings component`);
    }
  }

  if (!importedSettings.has(folder)) {
    reportError(`Feature "${folder}" types are not imported in AppSettings.tsx (e.g. import { ... } from "../../features/${folder}/types")`);
  } else {
    reportSuccess(`Feature "${folder}" types are registered in AppSettings.tsx`);
  }
}

// 3. Check AppSettings interface properties
// Look for AppSettings interface definition
const appSettingsInterfaceMatch = /interface\s+AppSettings\s*\{([^}]+)\}/s.exec(tsSettingsContent);
if (!appSettingsInterfaceMatch) {
  reportError(`Could not find "interface AppSettings" in AppSettings.tsx`);
} else {
  const interfaceBody = appSettingsInterfaceMatch[1];
  // Verify that each imported settings type is declared as a property in AppSettings
  for (const [folder, typeName] of importedSettings.entries()) {
    // Search for a line like: clock: ClockSettings; or clock?: ClockSettings;
    const propertyRegex = new RegExp(`(\\w+)\\s*\\??:\\s*${typeName}\\b`);
    const propMatch = propertyRegex.exec(interfaceBody);
    if (!propMatch) {
      reportError(`AppSettings interface is missing a property of type "${typeName}"`);
    } else {
      const propertyName = propMatch[1];
      reportSuccess(`AppSettings interface has property "${propertyName}" of type "${typeName}"`);
      
      // Let's verify Rust counterpart
      verifyRustSettings(propertyName, typeName, folder);
    }
  }
}

function verifyRustSettings(tsPropertyName, tsTypeName, folderName) {
  if (!fs.existsSync(RS_SETTINGS_PATH)) {
    reportError(`settings.rs not found at: ${RS_SETTINGS_PATH}`);
    return;
  }
  const rsContent = fs.readFileSync(RS_SETTINGS_PATH, 'utf-8');

  // 1. Check if the Struct exists
  // e.g. pub struct ClockSettings
  const structRegex = new RegExp(`pub\\s+struct\\s+${tsTypeName}\\b`);
  if (!structRegex.test(rsContent)) {
    reportError(`Rust backend: Struct "pub struct ${tsTypeName}" is missing in settings.rs`);
    return;
  }
  reportSuccess(`Rust backend: Struct "pub struct ${tsTypeName}" exists`);

  // 2. Check if AppSettings struct has the field in snake_case
  // We convert tsPropertyName from camelCase to snake_case
  const snakeCaseProp = tsPropertyName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  
  // Find pub struct AppSettings definition block
  const appSettingsStructMatch = /pub\s+struct\s+AppSettings\s*\{([^}]+)\}/s.exec(rsContent);
  if (!appSettingsStructMatch) {
    reportError(`Rust backend: Could not find "pub struct AppSettings" in settings.rs`);
    return;
  }
  
  const structBody = appSettingsStructMatch[1];
  // Check for field definition: e.g. pub clock: ClockSettings or pub voice_to_text: VoiceToTextSettings
  const fieldRegex = new RegExp(`pub\\s+${snakeCaseProp}\\s*:\\s*${tsTypeName}\\b`);
  if (!fieldRegex.test(structBody)) {
    reportError(`Rust backend: "pub struct AppSettings" is missing field "pub ${snakeCaseProp}: ${tsTypeName}"`);
  } else {
    reportSuccess(`Rust backend: "pub struct AppSettings" has field "pub ${snakeCaseProp}: ${tsTypeName}"`);
  }
}

console.log('\n----------------------------------------');
if (errorsCount > 0) {
  console.log(`\x1b[31m%s\x1b[0m`, `Verification FAILED with ${errorsCount} error(s).`);
  process.exit(1);
} else {
  console.log(`\x1b[32m%s\x1b[0m`, 'Verification PASSED. Architecture is aligned!');
  process.exit(0);
}
