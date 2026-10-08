# Mint アーキテクチャ設計書

Mint は、機能追加の安全性・拡張性・保守性を高めるため、**「静的 Feature-Module 設計」** を採用しています。

## 1. 静的 Feature-Module 設計の概要
各機能（ツール）は完全に分離されたモジュールとして存在しますが、動的プラグイン機構は持たず、全てコンパイル時に静的に解決されます。

### 特徴
- 実行時の動的ロード（Dynamic Plugin / DLLロード）は行いません。
- Rust と TypeScript 間の通信に汎用JSONペイロード (`serde_json::Value`等) を使用せず、専用の型を定義します。
- TypeScript/Rust/mockの同期はコンパイル・architecture検査・契約テストで確認します。文字列IPCやregex検査には限界があり、検査の成功だけで実動作を保証しません。
- 禁止対象はMint featureの実行時plugin登録と型なしIPC dispatcherです。既存の静的action registry、Tauri plugin、永続データ移行の `serde_json::Value` は用途に応じて使用します。

## 2. ディレクトリ構成と責務

### フロントエンド (`src/features/<feature>/`)
- `components/`: UIコンポーネント（機能管理ダッシュボード（設定画面）、オーバーレイウィジェット等）。
- `hooks/`: その機能専用のローカルステートやサイドエフェクト管理。
- `types.ts`: その機能専用の設定インターフェース定義 (`AppSettings` に結合される)。
- `ports.ts`: feature間で利用する公開API。featureから他featureのcomponents・hooks・IPC wrapper等を直接importせず、公開 `ports` / `types` だけを参照します。

### feature間の連携 (`src/core/actions/`)
- 機能をまたぐ操作の調整は `core/actions` が所有し、featureの公開 `ports` / `types` にのみ依存します。
- `mintActions.ts` は設定・overlay操作の静的なaction一覧。実行時のfeature探索・plugin登録は導入しません。

### バックエンド (`src-tauri/src/features/<feature>.rs` または `<feature>/`)
- 小規模な機能は `<feature>.rs` から開始し、責務が増えた機能は
  `<feature>/mod.rs` を facade として、永続化・検証・OS連携などを内部モジュールへ分割します。
- facade は外部へ公開する型付き Tauri コマンドだけを再公開し、内部実装を
  `src-tauri/src/lib.rs` や他機能へ漏らしません。
- 公開コマンドは構成にかかわらず、`src-tauri/src/lib.rs` 内で明示的に登録する必要があります。

### 機能管理ダッシュボードと共通設定 (`AppSettings`)
- `src/core/settingsModel.ts` (TypeScript): 設定スキーマの単一ソース
- `src/core/store/settingsStore.ts` (TypeScript): 外部設定ストア（`useSyncExternalStore` 対応、保存キュー・debounce・即時保存・retry・sequence・`settings-changed` 同期を所有）
- `src/core/context/AppSettings.tsx` (TypeScript): Provider（store instance配布）と選択購読 hook API
- `src/core/hooks/useFeatureSettings.ts` (TypeScript): feature固有設定の selector 購読 + 更新 API
- `src-tauri/src/core/settings.rs` (Rust facade) / `settings_model.rs` (Rust model)
- `src/core/defaultSettings.ts` (frontend default)、`src/core/mocks/mockSettings.ts` (mock factory)、Rust `settings_store.rs` (保存)、`core/migrations/settings/` (永続形式の移行)
- すべての機能の設定や有効状態はここで一元管理され、ローカルファイルにシリアライズされて保存されます。
- `theme` などの共通設定と、機能ごとの個別設定 (`clock`, `calendar` 等) が混在します。

### 設定ストアの購読モデル
- 設定状態は単一の Context value として配布せず、store instance を Provider が配布し、各コンポーネントは `useSettingsSelector` / `useSettings` / `useFeatureSettings` / `useSettingsSaveStatus` / `useShortcutError` などの selector hook で必要な slice だけを購読します。
- selector 結果は `Object.is`（または指定した equalityFn）で比較され、等しい場合は再レンダリングしません。更新対象でない top-level slice は同一参照を維持します。
- 保存状態（`saveStatus`）は `SidebarSaveStatus` / `SettingsSaveStatusBar` のような自己購読 leaf コンポーネントだけへ通知されます。
- 保存フロー（debounce・即時保存・queue 直列化・sequence による古い結果の無視・retry・外部 `settings-changed` との競合防止）は `settingsStore.ts` が所有し、`settingsChangePolicy` / `shortcutErrors` を再利用します。
- React state updaterは純粋に保ち、invoke等の副作用はイベント処理やeffectへ分離します。保存の競合制御は既存storeを再利用し、他の非同期処理でも古い結果が新しい状態を上書きしないようにします。
- legacy の全体 Context 購読 API（`useAppSettings` 相当）は移行後に残しません。

## 3. モック層の責務
- `src/core/mocks/tauriMock.ts` と `vitestSetup.ts` は、Tauriのバックエンド環境がないブラウザ単体起動時・テスト時でも動作するように、`*IpcMock.ts` の静的な feature 別 handler を共有します。環境固有の保存・遅延・表示差分だけを各入口で注入します。
- 新規コマンドを追加した際は、必ずモック層にも実装を追加する必要があります。
- 名前・型だけでなく、状態変更と必要な失敗動作を再現します。ブラウザmockのonboarding完了値は既存ユーザーを模擬する意図的な例外です。

### OS副作用とwindowの境界
- 無効・placeholder機能はOS shortcut登録やシステム状態変更を起こさないようRust側でguardします。shortcutの登録・処理は `settings.active_shortcuts()` を使用します。
- windowごとの最小権限と高影響commandの呼び出し元確認は [security-capabilities.md](security-capabilities.md)。overlayは静的routeだけでなく、型付き起動経路・初回ready通知・非表示時の破棄と再生成に対応します。

## 4. 追加手順
新しいフィーチャーの追加は、手作業でのミスを防ぐため、必ずスキャッフォールドスクリプトを使用します。

```bash
npm run scaffold:feature <feature_name>
```

生成後は、必要な機能差分だけを明示的に追加します：
- **Tauriコマンド追加**: Rust側で型付きコマンドを実装し、`src-tauri/src/lib.rs` の `tauri::generate_handler!` とブラウザ/Vitestモックに登録。
- **Window Route追加**: [add-overlay-window](../.agents/skills/add-overlay-window/SKILL.md) の該当する統合手順を使用。
- **検証**: [開発ガイドの検証範囲](ai-development.md#検証範囲) に従い、包含する検査を重複実行しません。

## 5. 禁止パターン
- ❌ **動的プラグイン機構**: セキュリティリスクと型安全性の低下を招くため禁止。
- ❌ **汎用JSON dispatcher**: `invoke("do_action", { payload: any })` のような型のない通信は禁止。
- ❌ **暗黙登録**: ファイル配置だけで実行時登録する機構は禁止。Rustは `features/mod.rs`・`lib.rs`、frontendは `settingsTabs.ts`・`windowRoutes.ts` 等で静的に登録する。
- ❌ **型安全性を壊す `any`**: TypeScript内での `any` や `as any` による型チェックの回避は禁止。
- ❌ **Git管理から漏れるfeature初期配線**: scaffolderが本体に生成したコードはバージョン管理に含める。検証用の隔離コピーやbuild成果物は除外する。
