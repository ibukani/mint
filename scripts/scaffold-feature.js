import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('\x1b[31m[ERROR]\x1b[0m 使用法: node scripts/scaffold-feature.js <feature_name> [PascalComponentName]');
  console.error('例: node scripts/scaffold-feature.js my_tool MyTool');
  process.exit(1);
}

const featureName = args[0];

// Convert snake_case / kebab-case feature_name to PascalCase component prefix
const defaultPascal = featureName
  .split(/[_-]/)
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join('');

const pascalName = args[1] || defaultPascal;

// Convert snake_case / kebab-case feature_name to camelCase settings key
const camelName = featureName
  .split(/[_-]/)
  .map((word, index) => index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1))
  .join('');

// Convert camelCase settings key to snake_case for Rust struct fields
const snakeName = camelName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

const ROOT_DIR = process.cwd();
const FEATURE_DIR = path.join(ROOT_DIR, 'src/features', featureName);
const RUST_FEATURE_PATH = path.join(ROOT_DIR, 'src-tauri/src/features', `${featureName}.rs`);

console.log('\x1b[36m%s\x1b[0m', `=== Static Feature Module Scaffolder: ${featureName} ===\n`);

// 1. Create directories
const componentsDir = path.join(FEATURE_DIR, 'components');
const hooksDir = path.join(FEATURE_DIR, 'hooks');

if (fs.existsSync(FEATURE_DIR)) {
  console.error(`\x1b[31m[ERROR]\x1b[0m フィーチャーフォルダは既に存在します: ${FEATURE_DIR}`);
  process.exit(1);
}

fs.mkdirSync(componentsDir, { recursive: true });
fs.mkdirSync(hooksDir, { recursive: true });
console.log(`[CREATED] ディレクトリを作成しました: ${componentsDir}`);
console.log(`[CREATED] ディレクトリを作成しました: ${hooksDir}`);

// 2. Generate types.ts
const typesContent = `export interface ${pascalName}Settings {
  enabled: boolean;
  shortcut: string;
}
`;
fs.writeFileSync(path.join(FEATURE_DIR, 'types.ts'), typesContent);
console.log(`[CREATED] types.ts を作成しました`);

// 3. Generate Component Settings file
const componentContent = `import React from "react";
import { useAppSettings } from "../../../core/context/AppSettings";

export const ${pascalName}Settings: React.FC = () => {
  const { settings, updateSettings } = useAppSettings();

  if (!settings) return null;

  // AppSettings.tsx への型定義追加後に有効になります
  const toolSettings = (settings as any).${camelName};

  if (!toolSettings) {
    return (
      <div className="settings-section">
        <h2 className="section-title">${pascalName} 設定</h2>
        <p style={{ color: "var(--text-muted)" }}>
          AppSettings.tsx / settings.rs への設定定義の追加を完了してください。
        </p>
      </div>
    );
  }

  const handleToggle = async () => {
    await updateSettings({
      ${camelName}: {
        ...toolSettings,
        enabled: !toolSettings.enabled,
      },
    } as any);
  };

  const handleShortcutChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await updateSettings({
      ${camelName}: {
        ...toolSettings,
        shortcut: e.target.value,
      },
    } as any);
  };

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
            checked={toolSettings.enabled}
            onChange={handleToggle}
          />
          機能を有効化する
        </label>
      </div>

      <div className="form-group">
        <label className="form-label">ショートカットキー</label>
        <input
          type="text"
          className="form-control"
          value={toolSettings.shortcut}
          onChange={handleShortcutChange}
        />
      </div>
    </div>
  );
};
`;
fs.writeFileSync(path.join(componentsDir, `${pascalName}Settings.tsx`), componentContent);
console.log(`[CREATED] ${pascalName}Settings.tsx を作成しました`);

// 4. Generate Rust backend file
const rustContent = `use serde::{Serialize, Deserialize};

// ${pascalName} 機能のバックエンドコマンド定義プレースホルダー
// 必要に応じてコマンドを定義し、src-tauri/src/lib.rs の tauri::generate_handler! に登録します。
`;
fs.writeFileSync(RUST_FEATURE_PATH, rustContent);
console.log(`[CREATED] Rustモジュールを作成しました: ${RUST_FEATURE_PATH}`);

// 5. Update src-tauri/src/features/mod.rs if exists
const rustModPath = path.join(ROOT_DIR, 'src-tauri/src/features/mod.rs');
if (fs.existsSync(rustModPath)) {
  let modContent = fs.readFileSync(rustModPath, 'utf-8');
  const modLine = `pub mod ${featureName};`;
  if (!modContent.includes(modLine)) {
    // Append to mod.rs
    modContent = modContent.trim() + `\n${modLine}\n`;
    fs.writeFileSync(rustModPath, modContent);
    console.log(`[UPDATED] ${rustModPath} に "${modLine}" を追記しました。`);
  }
}

console.log('\n\x1b[32m%s\x1b[0m', '=== Scaffolding 完了 ===');
console.log('\n以下の手動登録手順を実行して、機能の追加を完了させてください：\n');

console.log('\x1b[33m1. フロントエンド設定の登録 (src/core/context/AppSettings.tsx)\x1b[0m');
console.log(`  - インポート追加:`);
console.log(`    import { ${pascalName}Settings } from "../../features/${featureName}/types";`);
console.log(`  - AppSettings インターフェースにプロパティを追加:`);
console.log(`    export interface AppSettings {`);
console.log(`      // ...既存プロパティ`);
console.log(`      ${camelName}: ${pascalName}Settings;`);
console.log(`    }\n`);

console.log('\x1b[33m2. バックエンド設定の登録 (src-tauri/src/core/settings.rs)\x1b[0m');
console.log(`  - 設定構造体の定義を追加:`);
console.log(`    #[derive(Serialize, Deserialize, Clone, Debug)]`);
console.log(`    #[serde(rename_all = "camelCase")]`);
console.log(`    pub struct ${pascalName}Settings {`);
console.log(`        pub enabled: bool,`);
console.log(`        pub shortcut: String,`);
console.log(`    }`);
console.log(`    impl Default for ${pascalName}Settings {`);
console.log(`        fn default() -> Self {`);
console.log(`            Self {`);
console.log(`                enabled: false,`);
console.log(`                shortcut: "Ctrl+Alt+${pascalName.charAt(0)}".to_string(),`);
console.log(`            }`);
console.log(`        }`);
console.log(`    }`);
console.log(`  - AppSettings 構造体にフィールドを追加:`);
console.log(`    pub struct AppSettings {`);
console.log(`        // ...既存フィールド`);
console.log(`        pub ${snakeName}: ${pascalName}Settings,`);
console.log(`    }`);
console.log(`  - AppSettings の Default 実装にフィールド初期化を追加:`);
console.log(`    impl Default for AppSettings {`);
console.log(`        fn default() -> Self {`);
console.log(`            Self {`);
console.log(`                // ...既存初期化`);
console.log(`                ${snakeName}: ${pascalName}Settings::default(),`);
console.log(`            }`);
console.log(`        }`);
console.log(`    }\n`);

console.log('\x1b[33m3. ブラウザモック設定データの更新 (src/core/mocks/tauriMock.ts & src/core/mocks/vitestSetup.ts)\x1b[0m');
console.log(`  - defaultSettings オブジェクトに以下を追記してください:`);
console.log(`    ${camelName}: {`);
console.log(`      enabled: false,`);
console.log(`      shortcut: "Ctrl+Alt+${pascalName.charAt(0)}",`);
console.log(`    },\n`);

console.log('\x1b[33m4. メイン設定画面 UI へのタブ追加 (src/App.tsx)\x1b[0m');
console.log(`  - インポート追加:`);
console.log(`    import { ${pascalName}Settings } from "./features/${featureName}/components/${pascalName}Settings";`);
console.log(`  - activeTab の Union 型定義に "${camelName}" を追加し、サイドバーボタンを追加:`);
console.log(`    <button`);
console.log(`      className={\`nav-button \${activeTab === "${camelName}" ? "active" : ""}\`}`);
console.log(`      onClick={() => setActiveTab("${camelName}")}`);
console.log(`    >`);
console.log(`      ${pascalName} 設定`);
console.log(`    </button>`);
console.log(`  - コンテンツエリアの条件分岐に以下を追記:`);
console.log(`    {activeTab === "${camelName}" && <${pascalName}Settings />}\n`);

console.log('\x1b[33m5. 設計整合性チェックを実行して確認\x1b[0m');
console.log(`  npm run verify:architecture\n`);
