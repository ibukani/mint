import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const options = new Set(args.filter((arg) => arg.startsWith("--")));
const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
const verbose = options.has("--verbose");

if (positionalArgs.length < 1) {
  console.error(
    "\x1b[31m[ERROR]\x1b[0m 使用法: node scripts/scaffold-feature.js <feature_name> [PascalComponentName] [--verbose]",
  );
  console.error("例: node scripts/scaffold-feature.js my_tool MyTool");
  process.exit(1);
}

const featureName = positionalArgs[0];
const FEATURE_NAME_REGEX = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const PASCAL_NAME_REGEX = /^[A-Z][A-Za-z0-9]*$/;

if (!FEATURE_NAME_REGEX.test(featureName)) {
  console.error(
    "\x1b[31m[ERROR]\x1b[0m feature_name は Rust モジュール名として有効な snake_case で指定してください。",
  );
  console.error("例: my_tool, voice_note2");
  process.exit(1);
}

// Convert snake_case / kebab-case feature_name to PascalCase component prefix
const defaultPascal = featureName
  .split(/[_-]/)
  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  .join("");

const pascalName = positionalArgs[1] || defaultPascal;

if (!PASCAL_NAME_REGEX.test(pascalName)) {
  console.error(
    "\x1b[31m[ERROR]\x1b[0m PascalComponentName は PascalCase の TypeScript/Rust 識別子で指定してください。",
  );
  console.error("例: MyTool, VoiceNote2");
  process.exit(1);
}

// Convert snake_case / kebab-case feature_name to camelCase settings key
const camelName = featureName
  .split(/[_-]/)
  .map((word, index) =>
    index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1),
  )
  .join("");

// Convert camelCase settings key to snake_case for Rust struct fields
const snakeName = camelName.replace(
  /[A-Z]/g,
  (letter) => `_${letter.toLowerCase()}`,
);

const ROOT_DIR = process.cwd();
const FEATURE_DIR = path.join(ROOT_DIR, "src/features", featureName);
const RUST_FEATURE_PATH = path.join(
  ROOT_DIR,
  "src-tauri/src/features",
  `${featureName}.rs`,
);

const actions = [];

function recordAction(message) {
  actions.push(message);
  if (verbose) {
    console.log(message);
  }
}

if (verbose) {
  console.log(
    "\x1b[36m%s\x1b[0m",
    `=== Static Feature Module Scaffolder: ${featureName} ===\n`,
  );
}

// 1. Create directories
const componentsDir = path.join(FEATURE_DIR, "components");
const hooksDir = path.join(FEATURE_DIR, "hooks");

if (fs.existsSync(FEATURE_DIR)) {
  console.error(
    `\x1b[31m[ERROR]\x1b[0m フィーチャーフォルダは既に存在します: ${FEATURE_DIR}`,
  );
  process.exit(1);
}

fs.mkdirSync(componentsDir, { recursive: true });
fs.mkdirSync(hooksDir, { recursive: true });
recordAction(`[CREATED] ディレクトリを作成しました: ${componentsDir}`);
recordAction(`[CREATED] ディレクトリを作成しました: ${hooksDir}`);

// 2. Generate types.ts
const typesContent = `export interface ${pascalName}Settings {
  enabled: boolean;
  shortcut: string;
}
`;
fs.writeFileSync(path.join(FEATURE_DIR, "types.ts"), typesContent);
recordAction("[CREATED] types.ts を作成しました");

// 3. Generate Component Settings file (Type-Safe, no any/as any)
const componentContent = `import type React from "react";
import { useFeatureSettings } from "../../../core/hooks/useFeatureSettings";

export const ${pascalName}Settings: React.FC = () => {
  const { featureSettings: settings, handleChange, shortcutError } = useFeatureSettings("${camelName}");

  if (!settings) return null;

  return (
    <div className="settings-section">
      <h2 className="section-title">${pascalName} 設定</h2>
      <p className="section-description">
        ${pascalName} 機能の設定を行います。
      </p>

      <div className="form-group checkbox-group">
        <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={() => handleChange("enabled", !settings.enabled)}
          />
          機能を有効化する
        </label>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="${featureName}-shortcut-input">ショートカットキー</label>
        <input
          id="${featureName}-shortcut-input"
          type="text"
          className={\`form-control \\\${shortcutError ? "is-invalid" : ""}\`}
          value={settings.shortcut}
          onChange={(e) => handleChange("shortcut", e.target.value)}
          placeholder="例: Ctrl+Alt+${pascalName.charAt(0)}"
        />
        {shortcutError && (
          <p
            className="error-message"
            style={{ color: "var(--color-error, #ff4d4f)", marginTop: "4px", fontSize: "0.85rem", fontWeight: "bold" }}
          >
            {shortcutError}
          </p>
        )}
      </div>
    </div>
  );
};
`;
fs.writeFileSync(
  path.join(componentsDir, `${pascalName}Settings.tsx`),
  componentContent,
);
recordAction(`[CREATED] ${pascalName}Settings.tsx を作成しました`);

// 4. Generate Rust backend file
const rustContent = `use serde::{Serialize, Deserialize};

// ${pascalName} 機能のバックエンドコマンド定義プレースホルダー
// 必要に応じてコマンドを定義し、src-tauri/src/lib.rs の tauri::generate_handler! に登録します。
`;
fs.writeFileSync(RUST_FEATURE_PATH, rustContent);
recordAction(`[CREATED] Rustモジュールを作成しました: ${RUST_FEATURE_PATH}`);

// 5. Update src-tauri/src/features/mod.rs if exists
const rustModPath = path.join(ROOT_DIR, "src-tauri/src/features/mod.rs");
if (fs.existsSync(rustModPath)) {
  let modContent = fs.readFileSync(rustModPath, "utf-8");
  const modLine = `pub mod ${featureName};`;
  if (!modContent.includes(modLine)) {
    modContent = `${modContent.trim()}\n${modLine}\n`;
    fs.writeFileSync(rustModPath, modContent);
    recordAction(`[UPDATED] ${rustModPath} に "${modLine}" を追記しました。`);
  }
}

// 6. Auto-Register in AppSettings.tsx
const appSettingsPath = path.join(ROOT_DIR, "src/core/context/AppSettings.tsx");
if (fs.existsSync(appSettingsPath)) {
  let content = fs.readFileSync(appSettingsPath, "utf-8");
  if (!content.includes(`features/${featureName}/types`)) {
    // 6.1 Add Import (find first import statement)
    const importRegex = /(import\s+.*from\s+["'].*["'];)/;
    const importLine = `import type { ${pascalName}Settings } from "../../features/${featureName}/types";\n`;
    content = content.replace(importRegex, `${importLine}$1`);

    // 6.2 Add Property to AppSettings
    content = content.replace(
      /(export\s+interface\s+AppSettings\s*\{)/,
      `$1\n  ${camelName}: ${pascalName}Settings;`,
    );
    fs.writeFileSync(appSettingsPath, content, "utf-8");
    recordAction("[AUTO-REGISTERED] AppSettings.tsx に型定義を登録しました。");
  }
}

// 7. Auto-Register in settings.rs
const settingsRsPath = path.join(ROOT_DIR, "src-tauri/src/core/settings.rs");
if (fs.existsSync(settingsRsPath)) {
  let content = fs.readFileSync(settingsRsPath, "utf-8");
  if (!content.includes(`pub struct ${pascalName}Settings`)) {
    // 7.1 Add Struct Definition before AppSettings
    const structDef = `#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(default, rename_all = "camelCase")]
pub struct ${pascalName}Settings {
    pub enabled: bool,
    pub shortcut: String,
}

impl Default for ${pascalName}Settings {
    fn default() -> Self {
        Self {
            enabled: false,
            shortcut: "Ctrl+Alt+${pascalName.charAt(0)}".to_string(),
        }
    }
}

`;
    const appSettingsRegex =
      /(#\[derive\(Serialize,\s*Deserialize,\s*Clone,\s*Debug\)\]\s*#\[serde\(default,\s*rename_all\s*=\s*"camelCase"\)\]\s*pub\s+struct\s+AppSettings)/;
    content = content.replace(appSettingsRegex, `${structDef}$1`);

    // 7.2 Add field to AppSettings struct
    content = content.replace(
      /(pub\s+struct\s+AppSettings\s*\{)/,
      `$1\n    pub ${snakeName}: ${pascalName}Settings,`,
    );

    // 7.3 Add field default to Default impl
    content = content.replace(
      /(impl\s+Default\s+for\s+AppSettings\s*\{[\s\S]*?fn\s+default\(\)\s*->\s*Self\s*\{\s*Self\s*\{)/,
      `$1\n            ${snakeName}: ${pascalName}Settings::default(),`,
    );

    fs.writeFileSync(settingsRsPath, content, "utf-8");
    recordAction(
      `[AUTO-REGISTERED] settings.rs に構造体定義と初期値を登録しました。`,
    );
  }
}

// 8. Auto-Register in mocks (mockSettings.ts)
const mockPaths = [path.join(ROOT_DIR, "src/core/mocks/mockSettings.ts")];
for (const mockPath of mockPaths) {
  if (fs.existsSync(mockPath)) {
    let content = fs.readFileSync(mockPath, "utf-8");
    if (!content.includes(`${camelName}:`)) {
      const defaultSettingsRegex =
        /(export\s+const\s+createMockSettings\s*=\s*\([\s\S]*?\)\s*:\s*AppSettings\s*=>\s*\(\s*\{)/;
      const mockField = `\n  ${camelName}: {\n    enabled: false,\n    shortcut: "Ctrl+Alt+${pascalName.charAt(0)}",\n  },`;
      content = content.replace(defaultSettingsRegex, `$1${mockField}`);
      fs.writeFileSync(mockPath, content, "utf-8");
      recordAction(
        `[AUTO-REGISTERED] ${path.basename(mockPath)} にモックデータを登録しました。`,
      );
    }
  }
}

// 9. Auto-Register in App.tsx
const appTsxPath = path.join(ROOT_DIR, "src/App.tsx");
if (fs.existsSync(appTsxPath)) {
  let content = fs.readFileSync(appTsxPath, "utf-8");
  if (!content.includes(`./features/${featureName}/components/`)) {
    // 9.1 Add Import
    const importRegex = /(import\s+.*from\s+["'].*["'];)/;
    const importLine = `import { ${pascalName}Settings } from "./features/${featureName}/components/${pascalName}Settings";\n`;
    content = content.replace(importRegex, `${importLine}$1`);

    // 9.2 Add tab to TAB_CONFIG
    content = content.replace(
      /(const\s+TAB_CONFIG\s*=\s*\[)/,
      `$1\n  { id: "${camelName}", label: "${pascalName} 設定" },`,
    );

    // 9.3 Add component to TAB_COMPONENTS
    content = content.replace(
      /(const\s+TAB_COMPONENTS:\s*Record<TabId,\s*React\.FC>\s*=\s*\{)/,
      `$1\n  ${camelName}: ${pascalName}Settings,`,
    );

    fs.writeFileSync(appTsxPath, content, "utf-8");
    recordAction("[AUTO-REGISTERED] App.tsx に設定タブを登録しました。");
  }
}

if (verbose) {
  console.log(
    "\n\x1b[32m%s\x1b[0m",
    "=== Scaffolding & Auto-registration 完了 ===",
  );
  console.log(
    "\nフォーマッタとリンター (Biome) を実行して生成コードを整形しています...\n",
  );
}
try {
  const biomeBin =
    process.platform === "win32"
      ? path.join(ROOT_DIR, "node_modules/.bin/biome.cmd")
      : path.join(ROOT_DIR, "node_modules/.bin/biome");
  const biomeResult = spawnSync(
    biomeBin,
    ["check", "--write", "--unsafe", "."],
    {
      stdio: verbose ? "inherit" : "pipe",
    },
  );
  if (biomeResult.error) {
    throw biomeResult.error;
  }
  if (verbose) {
    console.log("\n\x1b[32m%s\x1b[0m", "=== Biome formatting 完了 ===");
  }
} catch (_e) {
  if (verbose) {
    console.warn(
      "\x1b[33m[WARN]\x1b[0m Biome の自動修正に失敗しました。`npm run check` 等で手動確認してください。",
    );
  }
}

console.log(
  `\x1b[32m[PASS]\x1b[0m Scaffolded feature "${featureName}" (${actions.length} actions).`,
);
console.log("Run `npm run check` to verify the generated feature.");
if (!verbose) {
  console.log("Use `--verbose` to show created and updated files.");
}
