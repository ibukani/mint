# AI Development Rules & Architecture Guidelines

This document serves as the master reference for AI assistants working on the Mint repository. Always follow these guidelines to ensure the project remains maintainable, type-safe, and robust.

## 1. Project Structure & Module Organization

This repository is a Tauri 2 desktop app with a React 19 + TypeScript frontend.

- `src/` contains the React application entry points and UI code. `main.tsx` mounts the app, and `App.tsx` currently contains the main screen.
- `src/assets/` stores frontend assets imported by React components.
- `public/` stores static files served directly by Vite, such as logos.
- `src-tauri/` contains the Rust/Tauri application shell. Rust commands and app setup live in `src-tauri/src/`; Tauri configuration lives in `src-tauri/tauri.conf.json`.
- Root TypeScript and Vite config files (`tsconfig*.json`, `vite.config.ts`) control frontend builds.

## 2. Build, Test, and Development Commands

Use the package scripts in `package.json`:

- `npm run ai:context` prints a compact, live summary of feature modules, settings, windows, IPC commands, and verification scripts. Run this before broad exploration to reduce token usage.
- `npm run dev` starts the Vite frontend development server.
- `npm run build` runs `tsc` and then builds the Vite frontend.
- `npm run preview` serves the built frontend locally.
- `npm run tauri -- dev` runs the full Tauri desktop app in development.
- `npm run tauri -- build` builds the distributable desktop app.
- `npm run test` runs frontend Vitest tests.
- `npm run check:quick` runs TypeScript, Biome, script syntax checks, and architecture validation without tests or bundling. Use it for fast feedback while iterating, then run the full checks before completion.

For Rust-only checks, run commands from `src-tauri/`, for example `cargo check` or `cargo test`.

## 3. Architecture Overview

This project uses a **Static Feature-Module Architecture** to prevent codebase bloat, maintain strong compile-time type safety, and ensure high maintainability. **Do NOT use dynamic runtime plugin registries or generic JSON (e.g. `serde_json::Value`) dispatchers.** All new tools must be statically typed and modularized.

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

## 4. Extension Guidelines (How to add a new tool)

To add a new tool (e.g. `new_tool`), follow these steps:

### Step 1: Update AppSettings Types
Modify the global configuration types to include the new tool's settings.

1. **TypeScript (`src/features/new_tool/types.ts` & `src/core/context/AppSettings.tsx`)**:
   ```typescript
   // src/features/new_tool/types.ts
   export interface NewToolSettings {
     enabled: boolean;
     shortcut: string;
     // other fields...
   }
   
   // src/core/context/AppSettings.tsx
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

## 5. AI Development Harness & Testing

### 0. Token-Efficient Orientation
- 最初に `npm run ai:context` を実行して、現時点の機能一覧、設定スキーマ、Tauri ウィンドウ、IPC コマンド、主要検証コマンドを確認してください。
- 広い調査が必要な場合でも、まず `AGENTS.md`、本ファイル、該当 Skill、`npm run ai:context` の出力に絞り、必要になったファイルだけ追加で読んでください。
- 検証ログは通常 `rtk npm run check:quick`、`rtk npm run check:ai-context`、`rtk npm run check` のように `rtk` 経由で取得し、失敗箇所中心の短い出力にしてください。アーキテクチャ検証の成功詳細が必要な場合だけ `npm run verify:architecture:verbose` を使ってください。

### 1. Browser-Only Development & Mocking
- 本アプリはブラウザ単体での動作確認用のTauri API自動モック環境 (`src/core/mocks/tauriMock.ts`) を備えています。
- 通常のWebブラウザで動作している場合は、設定の読み込みや保存などのIPC呼び出しが自動的に `localStorage` を使うモックに切り替わります。
- クエリパラメータ `?label=<label>` をURLに付与することで、特定のウィンドウ（例: `?label=clock`）のレンダリングや動作確認がブラウザ上で直接行えます。

### 2. フィーチャーの自動生成 (Scaffolding)
- 新しいフィーチャー（ツール）を作成する際は、必ず提供されているScaffoldingスクリプトを使用してください：
  ```bash
  node scripts/scaffold-feature.js <feature_name> [PascalComponentName]
  ```
- 生成されたファイルの詳細ログが必要な場合だけ `--verbose` を付けてください。通常は短いサマリ出力で十分です。
- 詳しい作成手順や手動登録の詳細は、カスタムSkillの指示書 `.agents/skills/create_static_feature/SKILL.md` を参照してください。

### 3. 設計整合性の検証 (Verification)
- コードの追加・変更を行った際は、必ず以下のコマンドを実行して設計構造に整合性エラーがないかを検証してください：
  ```bash
  npm run verify:architecture
  ```
- コミットやPR作成前、または実装完了宣言の前に、この整合性チェックがパスすることを確認してください。
- Scaffold 機能でモジュールを追加した直後は、追加されたコードが正常にビルド・フォーマットされていることを確認するため、必ず `npm run check` （フロントエンド検証）を通すこと。

### 4. フロントエンド単体テストの記述
- フロントエンドコンポーネントのテストは、Vitest を使用します。
- テストファイルは `src/**/*.test.tsx` または `src/**/*.test.ts` の命名規則で、実装元の近くに配置してください。
- テストは以下のコマンドで実行できます：
  ```bash
  npm run test
  ```

### 5. 一括検証コマンド (Full Verification)
- コミット前やPR作成前には、必ず以下の一括検証コマンドを実行してください：
  - フロントエンド検証（TypeScript, Biome, Vitest, Validator, Vite Build）:
    ```bash
    npm run check
    ```
  - バックエンド検証（Cargo Format, Clippy, Cargo Test, Cargo Check）:
    ```bash
    npm run check:tauri
    ```

### 6. Rust/Tauri Backend Verification Manual

When running `npm run check:tauri` or working on the Rust backend, developers and AI agents must ensure the following environment constraints are met:

- **Prerequisites**: Node.js (v20+), Rust, Cargo, and `rustup` must be installed.
- **Tauri Linux Dependencies**: On Linux environments, ensure you have the required WebKitGTK and build-essential packages installed. Without them, `npm run check:tauri` or `cargo check` will fail to compile Tauri.
- **Windows Environments**: Native Windows dependencies (MSVC or MinGW) must be installed.
- **Missing Cargo**: If `cargo` is missing in the environment, you **cannot** execute `npm run check:tauri`. The AI agent must document this limitation in its final report if encountered.

**Final Verification Steps (if environment permits):**
To manually verify the backend, `cd src-tauri` and run:
1. `cargo fmt --check` (Ensures formatting matches standard)
2. `cargo clippy --all-targets --all-features -- -D warnings` (Catches memory/logic issues)
3. `cargo test` (Runs backend unit tests)
4. `cargo check` (Final compilation check)

### 7. React State Updater と非同期/副作用の分離
- `useState` や `useReducer` の setState（関数型アップデート `prev => ...` 内）の中で、Tauri の `invoke` のような非同期処理や副作用（Side Effect）を絶対に呼ばないでください。
- 代わりに React の `useEffect`、あるいはイベントハンドラ（例: `useCallback` でラップした関数）の中で次の状態を計算した後に副作用を実行し、同期的に state を更新する設計にしてください。
- レースコンディション（Debounce中の遅延保存による古いStateへの巻き戻り）を防ぐため、Sequence ID / Revision 番号でのガード処理を実装してください。

### 8. Placeholder 機能の OS 副作用禁止
- `placeholder` 状態の機能に対して、OS のグローバルショートカット登録やシステム状態の変更（例: レジストリ書き換え、バックグラウンドデーモン起動）を行わないでください。
- バックエンド（Rust側）の設定構造体に `status` や `enabled` フィールドを設け、それがアクティブでない場合は副作用をスキップするガードを必ず実装してください。
- `lib.rs` などでショートカットを登録・処理する際は、個別のフィーチャーのショートカット（例: `settings.voice_to_text.shortcut`）に直接アクセスするのではなく、必ず `settings.active_shortcuts()` メソッドを使用して有効なものだけを一括取得・処理してください。

## 6. Coding Style & Naming Conventions
- Frontend code uses TypeScript modules, React function components, 2-space indentation, double quotes, and semicolons. Name React components in `PascalCase` and hooks/state variables in `camelCase`.
- Rust code follows standard `rustfmt` formatting with 4-space indentation. Use `snake_case` for functions, variables, and Tauri command names. Keep Tauri commands small and register them in `tauri::generate_handler!`.
- Always configure `.biomeignore` and other lint configurations to match these styling requirements.

## 7. Commit & Pull Request Guidelines
- Local Git history is not available in this workspace, so use clear, imperative commit subjects such as `Add greeting command` or `Refine Tauri window config`.
- Pull requests should include a short description, testing notes, linked issues when applicable, and screenshots or screen recordings for visible UI changes. Keep changes scoped: separate frontend UI work, Rust command changes, and configuration updates when practical.
