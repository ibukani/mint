import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = process.cwd();
const TS_SETTINGS_PATH = path.join(
  ROOT_DIR,
  "src/core/context/AppSettings.tsx",
);
const RS_SETTINGS_PATH = path.join(ROOT_DIR, "src-tauri/src/core/settings.rs");
const FEATURES_DIR = path.join(ROOT_DIR, "src/features");
const TAURI_MOCK_PATH = path.join(ROOT_DIR, "src/core/mocks/tauriMock.ts");
const VITEST_SETUP_PATH = path.join(ROOT_DIR, "src/core/mocks/vitestSetup.ts");
const APP_TSX_PATH = path.join(ROOT_DIR, "src/App.tsx");
const WINDOW_ROUTES_PATH = path.join(ROOT_DIR, "src/core/windowRoutes.ts");
const TAURI_CONF_PATH = path.join(ROOT_DIR, "src-tauri/tauri.conf.json");
const RS_LIB_PATH = path.join(ROOT_DIR, "src-tauri/src/lib.rs");

console.log(
  "\x1b[36m%s\x1b[0m",
  "=== Static Feature-Module Architecture Validator ===\n",
);

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

const featureFolders = fs.readdirSync(FEATURES_DIR).filter((file) => {
  return fs.statSync(path.join(FEATURES_DIR, file)).isDirectory();
});

console.log(`Scanning features in src/features/: ${featureFolders.join(", ")}`);

// 2. Load AppSettings.tsx
if (!fs.existsSync(TS_SETTINGS_PATH)) {
  reportError(`AppSettings.tsx not found at: ${TS_SETTINGS_PATH}`);
  process.exit(1);
}
const tsSettingsContent = fs.readFileSync(TS_SETTINGS_PATH, "utf-8");

const importRegex =
  /import\s+(?:type\s+)?\{\s*(\w+)\s*\}\s+from\s+["']\.\.\/\.\.\/features\/([^/]+)\/types["']/g;
const importedSettings = new Map(); // folder => typeName
let match = importRegex.exec(tsSettingsContent);
while (match !== null) {
  const [_full, typeName, folderName] = match;
  importedSettings.set(folderName, typeName);
  match = importRegex.exec(tsSettingsContent);
}

// Verify every folder in src/features is registered
const RUST_FEATURES_MOD = path.join(ROOT_DIR, "src-tauri/src/features/mod.rs");
let rustModContent = "";
if (fs.existsSync(RUST_FEATURES_MOD)) {
  rustModContent = fs.readFileSync(RUST_FEATURES_MOD, "utf-8");
} else {
  reportError(`mod.rs not found at: ${RUST_FEATURES_MOD}`);
}

for (const folder of featureFolders) {
  const typesPath = path.join(FEATURES_DIR, folder, "types.ts");
  if (!fs.existsSync(typesPath)) {
    reportError(`Feature "${folder}" is missing types.ts at ${typesPath}`);
  } else {
    reportSuccess(`Feature "${folder}" has types.ts`);
  }

  const componentsDir = path.join(FEATURES_DIR, folder, "components");
  if (!fs.existsSync(componentsDir)) {
    reportError(`Feature "${folder}" is missing components/ directory`);
  } else {
    const files = fs.readdirSync(componentsDir);
    const hasSettingsComponent = files.some((file) =>
      file.endsWith("Settings.tsx"),
    );
    if (!hasSettingsComponent) {
      reportError(
        `Feature "${folder}" is missing a *Settings.tsx component in components/`,
      );
    } else {
      reportSuccess(`Feature "${folder}" has a Settings component`);
    }
  }

  if (!importedSettings.has(folder)) {
    reportError(
      `Feature "${folder}" types are not imported in AppSettings.tsx`,
    );
  } else {
    reportSuccess(
      `Feature "${folder}" types are registered in AppSettings.tsx`,
    );
  }

  // Check Rust module registration
  const rustModRegex = new RegExp(`pub\\s+mod\\s+${folder}\\s*;`);
  if (!rustModRegex.test(rustModContent)) {
    reportError(
      `Feature "${folder}" is not registered in src-tauri/src/features/mod.rs`,
    );
  } else {
    reportSuccess(
      `Feature "${folder}" is registered in src-tauri/src/features/mod.rs`,
    );
  }
}

// 3. Check AppSettings interface properties
const appSettingsInterfaceMatch = /interface\s+AppSettings\s*\{([^}]+)\}/s.exec(
  tsSettingsContent,
);

const featureProperties = [];

if (!appSettingsInterfaceMatch) {
  reportError(`Could not find "interface AppSettings" in AppSettings.tsx`);
} else {
  const interfaceBody = appSettingsInterfaceMatch[1];
  for (const [folder, typeName] of importedSettings.entries()) {
    const propertyRegex = new RegExp(`(\\w+)\\s*\\??:\\s*${typeName}\\b`);
    const propMatch = propertyRegex.exec(interfaceBody);
    if (!propMatch) {
      reportError(
        `AppSettings interface is missing a property of type "${typeName}"`,
      );
    } else {
      const propertyName = propMatch[1];
      featureProperties.push(propertyName);
      reportSuccess(
        `AppSettings interface has property "${propertyName}" of type "${typeName}"`,
      );

      // Parse types.ts to get fields
      const typesPath = path.join(FEATURES_DIR, folder, "types.ts");
      const tsFields = [];
      if (fs.existsSync(typesPath)) {
        const typesContent = fs.readFileSync(typesPath, "utf-8");
        const typeRegex = new RegExp(
          `interface\\s+${typeName}\\s*\\{([^}]+)\\}`,
          "s",
        );
        const match = typeRegex.exec(typesContent);
        if (match) {
          const body = match[1];
          const fieldRegex = /([a-zA-Z0-9_]+)\s*\??\s*:/g;
          let fMatch = fieldRegex.exec(body);
          while (fMatch) {
            tsFields.push(fMatch[1]);
            fMatch = fieldRegex.exec(body);
          }
        }
      }

      // Verify Rust counterpart
      verifyRustSettings(propertyName, typeName, tsFields);

      if (!global.featureMetadata) global.featureMetadata = [];
      global.featureMetadata.push({ folder, typeName, propertyName, tsFields });
    }
  }
}

function verifyRustSettings(tsPropertyName, tsTypeName, tsFields) {
  if (!fs.existsSync(RS_SETTINGS_PATH)) {
    reportError(`settings.rs not found at: ${RS_SETTINGS_PATH}`);
    return;
  }
  const rsContent = fs.readFileSync(RS_SETTINGS_PATH, "utf-8");

  const structRegex = new RegExp(`pub\\s+struct\\s+${tsTypeName}\\b`);
  if (!structRegex.test(rsContent)) {
    reportError(
      `Rust backend: Struct "pub struct ${tsTypeName}" is missing in settings.rs`,
    );
    return;
  }
  reportSuccess(`Rust backend: Struct "pub struct ${tsTypeName}" exists`);

  // Extract the body of the Rust struct
  const structBodyRegex = new RegExp(
    `pub\\s+struct\\s+${tsTypeName}\\s*\\{([^}]+)\\}`,
    "s",
  );
  const structBodyMatch = structBodyRegex.exec(rsContent);
  if (!structBodyMatch) {
    reportError(
      `Rust backend: Could not parse body of "pub struct ${tsTypeName}"`,
    );
  } else {
    const structBody = structBodyMatch[1];
    for (const tsField of tsFields) {
      const snakeField = tsField.replace(
        /[A-Z]/g,
        (l) => `_${l.toLowerCase()}`,
      );
      const fieldRegex = new RegExp(`pub\\s+${snakeField}\\s*:`);
      if (!fieldRegex.test(structBody)) {
        reportError(
          `Rust backend: "pub struct ${tsTypeName}" is missing field "pub ${snakeField}"`,
        );
      } else {
        reportSuccess(
          `Rust backend: "pub struct ${tsTypeName}" has field "pub ${snakeField}"`,
        );
      }
    }
  }

  const snakeCaseProp = tsPropertyName.replace(
    /[A-Z]/g,
    (letter) => `_${letter.toLowerCase()}`,
  );

  const appSettingsStructMatch =
    /pub\s+struct\s+AppSettings\s*\{([^}]+)\}/s.exec(rsContent);
  if (!appSettingsStructMatch) {
    reportError(
      `Rust backend: Could not find "pub struct AppSettings" in settings.rs`,
    );
    return;
  }

  const structBody = appSettingsStructMatch[1];

  // Track checked fields for 1:1 matching
  if (!global.rustSettingsFields) global.rustSettingsFields = new Set();
  global.rustSettingsFields.add(snakeCaseProp);

  const fieldRegex = new RegExp(
    `pub\\s+${snakeCaseProp}\\s*:\\s*${tsTypeName}\\b`,
  );
  if (!fieldRegex.test(structBody)) {
    reportError(
      `Rust backend: "pub struct AppSettings" is missing field "pub ${snakeCaseProp}: ${tsTypeName}"`,
    );
  } else {
    reportSuccess(
      `Rust backend: "pub struct AppSettings" has field "pub ${snakeCaseProp}: ${tsTypeName}"`,
    );

    // Check Default implementation
    const defaultImplMatch =
      /impl\s+Default\s+for\s+AppSettings\s*\{([^}]+)\}/s.exec(rsContent);
    if (!defaultImplMatch) {
      reportError(
        `Rust backend: Could not find "impl Default for AppSettings" in settings.rs`,
      );
    } else {
      const defaultBody = defaultImplMatch[1];
      const defaultFieldRegex = new RegExp(`${snakeCaseProp}\\s*:`);
      if (!defaultFieldRegex.test(defaultBody)) {
        reportError(
          `Rust backend: "impl Default for AppSettings" is missing default value for "${snakeCaseProp}"`,
        );
      } else {
        reportSuccess(
          `Rust backend: "impl Default for AppSettings" sets default for "${snakeCaseProp}"`,
        );
      }
    }
  }
}

// 3.5 Check for unmapped Rust settings
if (fs.existsSync(RS_SETTINGS_PATH)) {
  const rsContent = fs.readFileSync(RS_SETTINGS_PATH, "utf-8");
  const appSettingsStructMatch =
    /pub\s+struct\s+AppSettings\s*\{([^}]+)\}/s.exec(rsContent);
  if (appSettingsStructMatch) {
    const structBody = appSettingsStructMatch[1];
    const fieldRegex = /pub\s+([a-z0-9_]+)\s*:/g;
    let match = fieldRegex.exec(structBody);
    while (match !== null) {
      const fieldName = match[1];
      if (
        fieldName !== "theme" && // Base property
        !global.rustSettingsFields?.has(fieldName)
      ) {
        reportError(
          `Rust backend: Field "${fieldName}" in AppSettings does not have a corresponding TS feature setting. TS and Rust settings must be 1:1.`,
        );
      }
      match = fieldRegex.exec(structBody);
    }
  }
}

// 4. Check Mock synchronization (mockSettings.ts & tauriMock.ts & vitestSetup.ts)
const MOCK_SETTINGS_PATH = path.join(
  ROOT_DIR,
  "src/core/mocks/mockSettings.ts",
);

function checkMockSync(mockPath) {
  if (!fs.existsSync(mockPath)) {
    reportError(`Mock file not found at: ${mockPath}`);
    return;
  }
  const mockContent = fs.readFileSync(mockPath, "utf-8");
  for (const { propertyName, tsFields } of global.featureMetadata) {
    const propRegex = new RegExp(`\\b${propertyName}\\s*:`);
    if (!propRegex.test(mockContent)) {
      reportError(
        `Mock Sync: "${path.basename(mockPath)}" defaultSettings is missing key "${propertyName}"`,
      );
    } else {
      reportSuccess(
        `Mock Sync: "${path.basename(mockPath)}" registers defaultSettings for "${propertyName}"`,
      );

      // We should check if the mock object contains the fields
      // To keep it simple, we just check if the field name exists in the mock file
      for (const field of tsFields) {
        const fieldRegex = new RegExp(`\\b${field}\\s*:`);
        if (!fieldRegex.test(mockContent)) {
          reportError(
            `Mock Sync: "${path.basename(mockPath)}" is missing field "${field}" for "${propertyName}"`,
          );
        }
      }
    }
  }
}
checkMockSync(MOCK_SETTINGS_PATH);

function checkMockFactoryUsage(mockPath) {
  if (fs.existsSync(mockPath)) {
    const mockContent = fs.readFileSync(mockPath, "utf-8");
    if (!/createMockSettings\(\)/.test(mockContent)) {
      reportError(
        `Mock Sync: "${path.basename(mockPath)}" should use createMockSettings()`,
      );
    } else {
      reportSuccess(
        `Mock Sync: "${path.basename(mockPath)}" uses createMockSettings()`,
      );
    }
  }
}
checkMockFactoryUsage(TAURI_MOCK_PATH);
checkMockFactoryUsage(VITEST_SETUP_PATH);

// 5. Check App.tsx TAB_CONFIG / TAB_COMPONENTS
if (fs.existsSync(APP_TSX_PATH)) {
  const appContent = fs.readFileSync(APP_TSX_PATH, "utf-8");
  for (const prop of featureProperties) {
    const tabConfigRegex = new RegExp(`id\\s*:\\s*["']${prop}["']`);
    if (!tabConfigRegex.test(appContent)) {
      reportError(
        `App.tsx Sync: TAB_CONFIG is missing tab configuration for "${prop}"`,
      );
    } else {
      reportSuccess(`App.tsx Sync: TAB_CONFIG registers tab for "${prop}"`);
    }

    const tabCompRegex = new RegExp(`\\b${prop}\\s*:`);
    if (!tabCompRegex.test(appContent)) {
      reportError(
        `App.tsx Sync: TAB_COMPONENTS is missing mapping for "${prop}"`,
      );
    } else {
      reportSuccess(
        `App.tsx Sync: TAB_COMPONENTS maps component for "${prop}"`,
      );
    }
  }
} else {
  reportError(`App.tsx not found at: ${APP_TSX_PATH}`);
}

// 6. Check window label sync (windowRoutes.ts & tauri.conf.json)
if (fs.existsSync(TAURI_CONF_PATH) && fs.existsSync(WINDOW_ROUTES_PATH)) {
  try {
    const tauriConf = JSON.parse(fs.readFileSync(TAURI_CONF_PATH, "utf-8"));
    const windows = tauriConf.app?.windows || [];
    const routeContent = fs.readFileSync(WINDOW_ROUTES_PATH, "utf-8");

    for (const w of windows) {
      if (w.label === "main") continue;
      const routeRegex = new RegExp(`\\b${w.label}\\s*:`);
      if (!routeRegex.test(routeContent)) {
        reportError(
          `Window Routes Sync: WINDOW_ROUTES in windowRoutes.ts is missing route for window label "${w.label}"`,
        );
      } else {
        reportSuccess(
          `Window Routes Sync: WINDOW_ROUTES defines route for window label "${w.label}"`,
        );
      }
    }
  } catch (err) {
    reportError(`Failed to parse tauri.conf.json: ${err}`);
  }
} else {
  reportError(`Tauri config or window routes file is missing.`);
}

// 7. Check Rust commands & generate_handler! sync
if (fs.existsSync(RS_LIB_PATH)) {
  const libContent = fs.readFileSync(RS_LIB_PATH, "utf-8");

  // Recursively find commands in src-tauri/src
  const rustCommands = [];
  function scanRustFiles(dir) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        scanRustFiles(fullPath);
      } else if (file.endsWith(".rs")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const cmdRegex = /#\[tauri::command\]\s*(?:pub\s+)?fn\s+(\w+)/g;
        let cmdMatch = cmdRegex.exec(content);
        while (cmdMatch !== null) {
          rustCommands.push({
            name: cmdMatch[1],
            file: path.relative(ROOT_DIR, fullPath),
          });
          cmdMatch = cmdRegex.exec(content);
        }
      }
    }
  }
  scanRustFiles(path.join(ROOT_DIR, "src-tauri/src"));

  const generateHandlerMatch = /generate_handler!\[([\s\S]*?)\]/.exec(
    libContent,
  );
  if (!generateHandlerMatch) {
    reportError(`Rust backend: tauri::generate_handler! is missing in lib.rs`);
  } else {
    const handlerBody = generateHandlerMatch[1];
    for (const cmd of rustCommands) {
      const cmdRegex = new RegExp(`\\b${cmd.name}\\b`);
      if (!cmdRegex.test(handlerBody)) {
        reportError(
          `Rust command "${cmd.name}" (in ${cmd.file}) is not registered in generate_handler! inside lib.rs`,
        );
      } else {
        reportSuccess(
          `Rust command "${cmd.name}" is registered in generate_handler!`,
        );
      }
    }
  }
}

// 8. Check frontend invoke & mockIPC sync
const frontendInvokes = new Set();
function scanInvokes(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file === "mocks" || file === "node_modules" || file === "dist")
        continue;
      scanInvokes(fullPath);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const invokeRegex = /invoke(?:<\w+>)?\(\s*["'](\w+)["']/g;
      let invokeMatch = invokeRegex.exec(content);
      while (invokeMatch !== null) {
        frontendInvokes.add(invokeMatch[1]);
        invokeMatch = invokeRegex.exec(content);
      }
    }
  }
}
scanInvokes(path.join(ROOT_DIR, "src"));

function checkMockIPCCase(mockPath, _isVitest = false) {
  if (fs.existsSync(mockPath)) {
    const mockContent = fs.readFileSync(mockPath, "utf-8");
    for (const cmd of frontendInvokes) {
      const caseRegex = new RegExp(`case\\s+["']${cmd}["']\\s*:`);
      if (!caseRegex.test(mockContent)) {
        reportError(
          `Mock Sync: "${path.basename(mockPath)}" mockIPC is missing case for command "${cmd}"`,
        );
      } else {
        reportSuccess(
          `Mock Sync: "${path.basename(mockPath)}" mockIPC handles command "${cmd}"`,
        );
      }
    }
  }
}
checkMockIPCCase(TAURI_MOCK_PATH);
checkMockIPCCase(VITEST_SETUP_PATH);

// 9. Scan for any/as any violations
function scanAnySafety(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (
        file === "mocks" ||
        file === "node_modules" ||
        file === "dist" ||
        file === "test"
      )
        continue;
      scanAnySafety(fullPath);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      if (
        file.endsWith(".test.ts") ||
        file.endsWith(".test.tsx") ||
        file === "vite-env.d.ts"
      )
        continue;
      const content = fs.readFileSync(fullPath, "utf-8");
      // Match "as any" or ": any"
      const anyRegex = /(?::\s*any\b|as\s+any\b)/g;
      if (anyRegex.test(content)) {
        const relativeFile = path.relative(ROOT_DIR, fullPath);
        reportError(
          `Type safety: "any" or "as any" usage detected in "${relativeFile}". Avoid type safety bypass.`,
        );
      }
    }
  }
}
scanAnySafety(path.join(ROOT_DIR, "src"));

// 10. Check for placeholder / TODO leak
const allowedTodos = [
  "Voice to Text features triggered",
  "Voice to text triggered via global shortcut!",
  "必要に応じてコマンドを定義し",
  "バックエンドコマンド定義プレースホルダー",
  "この機能は設定画面",
  "文字起こし処理自体はプレースホルダーであり",
  "実際に音声の録音・Whisper",
  "Voice-to-Text feature commands placeholder",
  "placeholder 状態であるため",
  "未実装のお知らせ",
  "API経由での文字起こし処理のバックエンド実装は未実装です",
  'status: "placeholder".to_string()',
  'settings.voice_to_text.status != "placeholder"',
  "<code>placeholder</code>",
  "状態であるため、機能自体が未実装です。バックエンド機能が実装されるまでは、",
  'if self.status == "placeholder" || !self.enabled || s.is_empty() {',
];

function scanTodos(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (
        file === "node_modules" ||
        file === "dist" ||
        file === "mocks" ||
        file === "test"
      )
        continue;
      scanTodos(fullPath);
    } else if (
      file.endsWith(".ts") ||
      file.endsWith(".tsx") ||
      file.endsWith(".rs") ||
      file.endsWith(".md")
    ) {
      if (
        file.endsWith(".test.ts") ||
        file.endsWith(".test.tsx") ||
        file === "verify-architecture.js" ||
        file === "scaffold-feature.js"
      )
        continue;
      const content = fs.readFileSync(fullPath, "utf-8");

      // Match TODO or placeholder/未実装
      const todoLines = content.split("\n");
      todoLines.forEach((line, idx) => {
        // Ignore HTML placeholder= attributes
        if (/placeholder=/i.test(line)) return;

        // Ignore valid placeholder literal or comments in tests
        if (line.includes('"placeholder"') || line.includes("is placeholder"))
          return;

        if (/todo|\bplaceholder\b|未実装/i.test(line)) {
          const isAllowed = allowedTodos.some((allowed) =>
            line.includes(allowed),
          );
          if (!isAllowed) {
            const relativeFile = path.relative(ROOT_DIR, fullPath);
            reportError(
              `TODO/Placeholder leak in "${relativeFile}" at line ${idx + 1}: "${line.trim()}"`,
            );
          }
        }
      });
    }
  }
}
scanTodos(path.join(ROOT_DIR, "src"));
scanTodos(path.join(ROOT_DIR, "src-tauri/src"));

// 11. Check that lib.rs does not directly use feature shortcuts
const LIB_RS_PATH = path.join(ROOT_DIR, "src-tauri/src/lib.rs");
if (fs.existsSync(LIB_RS_PATH)) {
  const libRsContent = fs.readFileSync(LIB_RS_PATH, "utf-8");
  if (/settings\.[a-zA-Z0-9_]+\.shortcut/.test(libRsContent)) {
    reportError(
      `lib.rs directly accesses a feature's shortcut (e.g. settings.voice_to_text.shortcut). Use settings.active_shortcuts() instead.`,
    );
  } else {
    reportSuccess(
      `lib.rs uses settings.active_shortcuts() instead of direct shortcut access.`,
    );
  }
}

console.log("\n----------------------------------------");
if (errorsCount > 0) {
  console.log(
    `\x1b[31m%s\x1b[0m`,
    `Verification FAILED with ${errorsCount} error(s).`,
  );
  process.exit(1);
} else {
  console.log(
    `\x1b[32m%s\x1b[0m`,
    "Verification PASSED. Architecture is aligned!",
  );
  process.exit(0);
}
