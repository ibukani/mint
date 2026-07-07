# AI Development Rules & Architecture Guidelines

## Architecture Overview
This project uses a **Static Feature-Module Architecture** to prevent codebase bloat, maintain strong compile-time type safety, and ensure high maintainability. Do NOT use dynamic runtime plugin registries or generic JSON (e.g. `serde_json::Value`) dispatchers. All new tools must be statically typed and modularized.

### Module Structure
All new features (tools) must be organized as follows:

1. **Frontend (`src/features/<feature_name>/`)**:
   - `components/`: Contains settings, main widget, or overlay UI.
   - `hooks/`: Local state management and side effects.
   - `types.ts`: Strongly typed configurations for this feature.
   - Example:
     ```text
     src/features/my_tool/
     ├── components/
     │   ├── MyToolSettings.tsx
     │   └── MyToolOverlay.tsx
     ├── hooks/
     │   └── useMyTool.ts
     └── types.ts
     ```

2. **Backend (`src-tauri/src/features/<feature_name>.rs`)**:
   - Write standard Tauri commands with typed arguments (e.g. `pub fn my_command(settings: MyToolSettings) -> Result<String, String>`).
   - Register them in `src-tauri/src/lib.rs` inside `tauri::generate_handler!`.

---

## Extension Guidelines (How to add a new tool)

To add a new tool (e.g. `new_tool`), follow these steps:

### Step 1: Update AppSettings Types
Modify the global configuration types to include the new tool's settings.

1. **TypeScript (`src/features/types.ts`)**:
   ```typescript
   export interface NewToolSettings {
     enabled: boolean;
     shortcut: string;
     // other fields...
   }
   
   export interface AppSettings {
     // ... existing features
     newTool: NewToolSettings;
   }
   ```
2. **Rust (`src-tauri/src/core/settings.rs`)**:
   ```rust
   #[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
   pub struct NewToolSettings {
       pub enabled: bool,
       pub shortcut: String,
   }
   
   #[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default)]
   pub struct AppSettings {
       // ... existing features
       pub new_tool: NewToolSettings,
   }
   ```

### Step 2: Create the Feature Module
1. Create `src/features/new_tool/` and implement the settings panel (`NewToolSettings.tsx`) and optional overlay (`NewToolOverlay.tsx`).
2. Create `src-tauri/src/features/new_tool.rs` and write any backend commands.

### Step 3: Register in App Shell
1. Import and place the settings panel inside `src/App.tsx` Settings tabs.
2. If the tool has an overlay window, add a window in `tauri.conf.json` and route its label in `src/App.tsx`.
3. Register the Rust commands in `src-tauri/src/lib.rs`.

---

## AI Development Harness & Testing

### 1. Browser-Only Development & Mocking
- 本アプリはブラウザ単体での動作確認用のTauri API自動モック環境 (`src/core/mocks/tauriMock.ts`) を備えています。
- 通常のWebブラウザで動作している場合は、設定の読み込みや保存などのIPC呼び出しが自動的に `localStorage` を使うモックに切り替わります。
- クエリパラメータ `?label=<label>` をURLに付与することで、特定のウィンドウ（例: `?label=clock`）のレンダリングや動作確認がブラウザ上で直接行えます。

### 2. フィーチャーの自動生成 (Scaffolding)
- 新しいフィーチャー（ツール）を作成する際は、必ず提供されているScaffoldingスクリプトを使用してください：
  ```bash
  node scripts/scaffold-feature.js <feature_name> [PascalComponentName]
  ```
- 詳しい作成手順や手動登録の詳細は、カスタムSkillの指示書 `.agents/skills/create_static_feature/SKILL.md` を参照してください。

### 3. 設計整合性の検証 (Verification)
- コードの追加・変更を行った際は、必ず以下のコマンドを実行して設計構造に整合性エラーがないかを検証してください：
  ```bash
  npm run verify:architecture
  ```
- コミットやPR作成前、または実装完了宣言の前に、この整合性チェックがパスすることを確認してください。

### 4. フロントエンド単体テストの記述
- フロントエンドコンポーネントのテストは、Vitest を使用します。
- テストファイルは `src/**/*.test.tsx` または `src/**/*.test.ts` の命名規則で、実装元の近くに配置してください。
- テストは以下のコマンドで実行できます：
  ```bash
  npm run test
  ```
