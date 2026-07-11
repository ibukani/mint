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
const SETTINGS_TABS_PATH = path.join(
  ROOT_DIR,
  "src/core/navigation/settingsTabs.ts",
);
const WINDOW_ROUTES_PATH = path.join(ROOT_DIR, "src/core/windowRoutes.ts");
const TAURI_CONF_PATH = path.join(ROOT_DIR, "src-tauri/tauri.conf.json");
const RS_LIB_PATH = path.join(ROOT_DIR, "src-tauri/src/lib.rs");
const INDEX_CSS_PATH = path.join(ROOT_DIR, "src/index.css");

const verbose =
  process.argv.includes("--verbose") ||
  process.env.VERBOSE_ARCHITECTURE === "1";

let errorsCount = 0;
let successCount = 0;
const validationState = {
  featureMetadata: [],
  rustSettingsFields: new Set(),
};

function reportError(message) {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`);
  errorsCount++;
}

function reportSuccess(message) {
  successCount++;
  if (verbose) {
    console.log(`\x1b[32m[PASS]\x1b[0m ${message}`);
  }
}

function listFilesRecursive(rootDir, options = {}) {
  const {
    extensions,
    ignoredDirs = new Set(["node_modules", "dist"]),
    ignoredFiles = new Set(),
  } = options;
  const results = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (!ignoredDirs.has(entry)) {
          walk(fullPath);
        }
        continue;
      }
      if (ignoredFiles.has(entry)) continue;
      if (extensions && !extensions.some((ext) => entry.endsWith(ext))) {
        continue;
      }
      results.push(fullPath);
    }
  }

  if (fs.existsSync(rootDir)) {
    walk(rootDir);
  }
  return results;
}

// 1. Scan features directory
if (!fs.existsSync(FEATURES_DIR)) {
  reportError(`Features directory does not exist: ${FEATURES_DIR}`);
  process.exit(1);
}

const featureFolders = fs.readdirSync(FEATURES_DIR).filter((file) => {
  return fs.statSync(path.join(FEATURES_DIR, file)).isDirectory();
});

if (verbose) {
  console.log(
    "\x1b[36m%s\x1b[0m",
    "=== Static Feature-Module Architecture Validator ===\n",
  );
  console.log(
    `Scanning features in src/features/: ${featureFolders.join(", ")}`,
  );
}

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

  // Verify base properties
  if (!/settingsShortcut\s*:\s*string/.test(interfaceBody)) {
    reportError(
      `AppSettings interface is missing property "settingsShortcut: string"`,
    );
  } else {
    reportSuccess(
      `AppSettings interface has property "settingsShortcut: string"`,
    );
  }

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

      validationState.featureMetadata.push({
        folder,
        typeName,
        propertyName,
        tsFields,
      });
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
  validationState.rustSettingsFields.add(snakeCaseProp);

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
        fieldName !== "settings_shortcut" && // Base property
        fieldName !== "autostart" && // Base property
        !validationState.rustSettingsFields.has(fieldName)
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
  for (const { propertyName, tsFields } of validationState.featureMetadata) {
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

// 5. Check settings tab navigation sync
if (fs.existsSync(SETTINGS_TABS_PATH)) {
  const settingsTabsContent = fs.readFileSync(SETTINGS_TABS_PATH, "utf-8");
  for (const prop of featureProperties) {
    const tabConfigRegex = new RegExp(`id\\s*:\\s*["']${prop}["']`);
    if (!tabConfigRegex.test(settingsTabsContent)) {
      reportError(
        `Settings Tabs Sync: SETTINGS_TABS is missing tab configuration for "${prop}"`,
      );
    } else {
      reportSuccess(
        `Settings Tabs Sync: SETTINGS_TABS registers tab for "${prop}"`,
      );
    }

    const tabCompRegex = new RegExp(`\\b${prop}\\s*:`);
    if (!tabCompRegex.test(settingsTabsContent)) {
      reportError(
        `Settings Tabs Sync: SETTINGS_TAB_COMPONENTS is missing mapping for "${prop}"`,
      );
    } else {
      reportSuccess(
        `Settings Tabs Sync: SETTINGS_TAB_COMPONENTS maps component for "${prop}"`,
      );
    }
  }
} else {
  reportError(`Settings tabs file not found at: ${SETTINGS_TABS_PATH}`);
}

if (!fs.existsSync(APP_TSX_PATH)) {
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
  const rustCommands = [];

  for (const rustFile of listFilesRecursive(
    path.join(ROOT_DIR, "src-tauri/src"),
    {
      extensions: [".rs"],
    },
  )) {
    const content = fs.readFileSync(rustFile, "utf-8");
    const cmdRegex = /#\[tauri::command\]\s*(?:pub\s+)?fn\s+(\w+)/g;
    let cmdMatch = cmdRegex.exec(content);
    while (cmdMatch !== null) {
      rustCommands.push({
        name: cmdMatch[1],
        file: path.relative(ROOT_DIR, rustFile),
      });
      cmdMatch = cmdRegex.exec(content);
    }
  }

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
for (const sourceFile of listFilesRecursive(path.join(ROOT_DIR, "src"), {
  extensions: [".ts", ".tsx"],
  ignoredDirs: new Set(["mocks", "node_modules", "dist"]),
})) {
  const content = fs.readFileSync(sourceFile, "utf-8");
  const invokeRegex = /invoke(?:<\w+>)?\(\s*["'](\w+)["']/g;
  let invokeMatch = invokeRegex.exec(content);
  while (invokeMatch !== null) {
    frontendInvokes.add(invokeMatch[1]);
    invokeMatch = invokeRegex.exec(content);
  }
}

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
for (const sourceFile of listFilesRecursive(path.join(ROOT_DIR, "src"), {
  extensions: [".ts", ".tsx"],
  ignoredDirs: new Set(["mocks", "node_modules", "dist", "test"]),
  ignoredFiles: new Set(["vite-env.d.ts"]),
})) {
  if (sourceFile.endsWith(".test.ts") || sourceFile.endsWith(".test.tsx")) {
    continue;
  }
  const content = fs.readFileSync(sourceFile, "utf-8");
  const anyRegex = /(?::\s*any\b|as\s+any\b)/g;
  if (anyRegex.test(content)) {
    const relativeFile = path.relative(ROOT_DIR, sourceFile);
    reportError(
      `Type safety: "any" or "as any" usage detected in "${relativeFile}". Avoid type safety bypass.`,
    );
  }
}

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

function scanTodoFiles(rootDir) {
  const files = listFilesRecursive(rootDir, {
    extensions: [".ts", ".tsx", ".rs", ".md"],
    ignoredDirs: new Set(["node_modules", "dist", "mocks", "test"]),
    ignoredFiles: new Set(["verify-architecture.js", "scaffold-feature.js"]),
  });

  for (const filePath of files) {
    if (filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) {
      continue;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const todoLines = content.split("\n");
    todoLines.forEach((line, idx) => {
      if (/placeholder=/i.test(line)) return;
      if (line.includes('"placeholder"') || line.includes("is placeholder"))
        return;

      if (/todo|\bplaceholder\b|未実装/i.test(line)) {
        const isAllowed = allowedTodos.some((allowed) =>
          line.includes(allowed),
        );
        if (!isAllowed) {
          const relativeFile = path.relative(ROOT_DIR, filePath);
          reportError(
            `TODO/Placeholder leak in "${relativeFile}" at line ${idx + 1}: "${line.trim()}"`,
          );
        }
      }
    });
  }
}
scanTodoFiles(path.join(ROOT_DIR, "src"));
scanTodoFiles(path.join(ROOT_DIR, "src-tauri/src"));

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

// 12. Check design boundary in feature modules
const disallowedGlobalClasses = [
  "form-control",
  "form-group",
  "form-label",
  "glass-panel",
  "primary-button",
  "settings-section",
  "section-title",
  "section-description",
];

const designBoundaryAllowlist = new Map([
  // Clock overlay and preview forward user-configured values through CSS custom properties.
  ["src/features/clock/components/ClockOverlay.tsx", new Set(["inline-style"])],
  ["src/features/clock/components/ClockPreview.tsx", new Set(["inline-style"])],
  // Analog hands and progress indicators require runtime-calculated SVG/CSS values.
  ["src/features/clock/components/ClockDisplay.tsx", new Set(["inline-style"])],
  // Preset colors are clock feature data and are passed to CSS as a swatch variable.
  [
    "src/features/clock/components/ClockAppearanceSettings.tsx",
    new Set(["inline-style", "color-literal"]),
  ],
  [
    "src/features/calendar/components/CalendarOverlay.tsx",
    new Set(["inline-style"]),
  ],
  [
    "src/features/calendar/components/CalendarSettings.tsx",
    new Set(["inline-style", "color-literal"]),
  ],
]);

function isDesignBoundaryAllowed(relativeFile, rule) {
  return designBoundaryAllowlist.get(relativeFile)?.has(rule) ?? false;
}

for (const sourceFile of listFilesRecursive(FEATURES_DIR, {
  extensions: [".ts", ".tsx"],
  ignoredDirs: new Set(["node_modules", "dist", "test"]),
})) {
  if (sourceFile.endsWith(".test.ts") || sourceFile.endsWith(".test.tsx")) {
    continue;
  }
  const relativeFile = path.relative(ROOT_DIR, sourceFile).replace(/\\/g, "/");
  const content = fs.readFileSync(sourceFile, "utf-8");

  const colorLiteralRegex = /#[0-9a-fA-F]{3,8}\b/g;
  if (
    colorLiteralRegex.test(content) &&
    !isDesignBoundaryAllowed(relativeFile, "color-literal")
  ) {
    reportError(
      `Design boundary: "${relativeFile}" contains hard-coded color literals. Use src/design tokens/components instead.`,
    );
  }

  if (/\brgba\(/.test(content)) {
    reportError(
      `Design boundary: "${relativeFile}" contains hard-coded rgba(...). Use src/design tokens/components instead.`,
    );
  }

  if (
    /\bstyle\s*=/.test(content) &&
    !isDesignBoundaryAllowed(relativeFile, "inline-style")
  ) {
    reportError(
      `Design boundary: "${relativeFile}" contains inline style. Move visual styling into src/design or document an allowlist exception.`,
    );
  }

  for (const className of disallowedGlobalClasses) {
    const classRegex = new RegExp(
      `["'\`]([^"'\`]*\\b${className}\\b[^"'\`]*)["'\`]`,
    );
    if (classRegex.test(content)) {
      reportError(
        `Design boundary: "${relativeFile}" directly uses legacy global class "${className}". Use src/design components instead.`,
      );
    }
  }
}

// 13. Enforce CSS ownership and keep the global entry point declarative.
const SRC_DIR = path.join(ROOT_DIR, "src");
const DESIGN_DIR = path.join(SRC_DIR, "design");
const CORE_DIR = path.join(SRC_DIR, "core");
const DESIGN_FEATURES_DIR = path.join(DESIGN_DIR, "features");
const referencedCssFiles = new Set();

function toPosixRelative(filePath) {
  return path.relative(ROOT_DIR, filePath).replace(/\\/g, "/");
}

function isPathInside(parentPath, childPath) {
  const relativePath = path.relative(parentPath, childPath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${path.sep}`) && relativePath !== "..")
  );
}

function resolveCssImport(importerPath, importPath) {
  if (!importPath.startsWith(".")) return null;
  return path.resolve(path.dirname(importerPath), importPath);
}

if (fs.existsSync(DESIGN_FEATURES_DIR)) {
  reportError(
    `CSS architecture: ${toPosixRelative(DESIGN_FEATURES_DIR)} must not exist. Keep feature-owned CSS under src/features/<feature>/.`,
  );
} else {
  reportSuccess(
    "CSS architecture: feature-owned CSS is not stored in src/design/features/.",
  );
}

if (!fs.existsSync(INDEX_CSS_PATH)) {
  reportError(`Global stylesheet entry point not found: ${INDEX_CSS_PATH}`);
} else {
  const indexCssContent = fs.readFileSync(INDEX_CSS_PATH, "utf-8");
  const indexCssWithoutComments = indexCssContent.replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const indexCssStatements = indexCssWithoutComments
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const importStatementRegex = /^@import\s+["']([^"']+)["'];$/;
  const invalidStatement = indexCssStatements.find(
    (line) => !importStatementRegex.test(line),
  );

  if (invalidStatement) {
    reportError(
      `CSS architecture: src/index.css must contain imports only. Move style rules to their owning module. Invalid statement: "${invalidStatement}"`,
    );
  } else {
    reportSuccess(
      "CSS architecture: src/index.css is an import-only stylesheet entry point.",
    );
  }

  for (const statement of indexCssStatements) {
    const importMatch = statement.match(importStatementRegex);
    if (!importMatch) continue;
    const importPath = importMatch[1];
    const resolvedPath = resolveCssImport(INDEX_CSS_PATH, importPath);

    if (!importPath.startsWith("./design/") || !resolvedPath) {
      reportError(
        `CSS architecture: src/index.css may import only src/design/ stylesheets. Invalid import: "${importPath}"`,
      );
      continue;
    }
    if (!resolvedPath.endsWith(".css") || !fs.existsSync(resolvedPath)) {
      reportError(
        `CSS architecture: src/index.css import does not resolve to an existing CSS file: "${importPath}"`,
      );
      continue;
    }
    if (!isPathInside(DESIGN_DIR, resolvedPath)) {
      reportError(
        `CSS architecture: src/index.css import escapes src/design/: "${importPath}"`,
      );
      continue;
    }
    referencedCssFiles.add(path.normalize(resolvedPath));
  }
}

const cssImporters = listFilesRecursive(SRC_DIR, {
  extensions: [".ts", ".tsx", ".css"],
  ignoredDirs: new Set(["node_modules", "dist"]),
});

for (const importerPath of cssImporters) {
  if (path.normalize(importerPath) === path.normalize(INDEX_CSS_PATH)) continue;
  const content = fs.readFileSync(importerPath, "utf-8");
  const importPaths = [];

  if (importerPath.endsWith(".css")) {
    const cssImportRegex = /@import\s+["']([^"']+\.css)["'];/g;
    let cssImportMatch = cssImportRegex.exec(content);
    while (cssImportMatch !== null) {
      importPaths.push(cssImportMatch[1]);
      cssImportMatch = cssImportRegex.exec(content);
    }
  } else {
    const moduleCssImportRegex = /import\s+["']([^"']+\.css)["'];/g;
    let moduleImportMatch = moduleCssImportRegex.exec(content);
    while (moduleImportMatch !== null) {
      importPaths.push(moduleImportMatch[1]);
      moduleImportMatch = moduleCssImportRegex.exec(content);
    }
  }

  for (const importPath of importPaths) {
    const resolvedPath = resolveCssImport(importerPath, importPath);
    const importerRelative = toPosixRelative(importerPath);
    if (!resolvedPath || !fs.existsSync(resolvedPath)) {
      reportError(
        `CSS architecture: "${importerRelative}" imports a missing stylesheet: "${importPath}"`,
      );
      continue;
    }
    if (path.normalize(resolvedPath) !== path.normalize(INDEX_CSS_PATH)) {
      referencedCssFiles.add(path.normalize(resolvedPath));
    }

    if (isPathInside(FEATURES_DIR, importerPath)) {
      const relativeFeaturePath = path.relative(FEATURES_DIR, importerPath);
      const [featureName] = relativeFeaturePath.split(path.sep);
      const featureRoot = path.join(FEATURES_DIR, featureName);
      if (!isPathInside(featureRoot, resolvedPath)) {
        reportError(
          `CSS architecture: feature importer "${importerRelative}" must keep component-owned CSS inside src/features/${featureName}/.`,
        );
      }
    }

    if (
      isPathInside(CORE_DIR, importerPath) &&
      !isPathInside(CORE_DIR, resolvedPath)
    ) {
      reportError(
        `CSS architecture: core importer "${importerRelative}" must keep component-owned CSS inside src/core/.`,
      );
    }
  }
}

for (const cssFile of listFilesRecursive(SRC_DIR, { extensions: [".css"] })) {
  if (path.normalize(cssFile) === path.normalize(INDEX_CSS_PATH)) continue;
  if (!referencedCssFiles.has(path.normalize(cssFile))) {
    reportError(
      `CSS architecture: orphan stylesheet is not imported by src/index.css or an owning module: "${toPosixRelative(cssFile)}"`,
    );
  }
}

if (
  listFilesRecursive(SRC_DIR, { extensions: [".css"] }).length - 1 ===
  referencedCssFiles.size
) {
  reportSuccess(
    "CSS architecture: all stylesheets have an explicit owner/import path.",
  );
}

if (errorsCount > 0) {
  console.log("\n----------------------------------------");
  console.log(
    `\x1b[31m%s\x1b[0m`,
    `Verification FAILED with ${errorsCount} error(s).`,
  );
  process.exit(1);
} else {
  console.log(
    `\x1b[32m%s\x1b[0m`,
    `Verification PASSED. Architecture is aligned (${successCount} checks).`,
  );
  process.exit(0);
}
