# Mint アーキテクチャ設計書

Mint は、機能追加の安全性・拡張性・保守性を高めるため、**「静的 Feature-Module 設計」** を採用しています。

## 1. 静的 Feature-Module 設計の概要
各機能（ツール）は完全に分離されたモジュールとして存在しますが、動的プラグイン機構は持たず、全てコンパイル時に静的に解決されます。

### 特徴
- 実行時の動的ロード（Dynamic Plugin / DLLロード）は行いません。
- Rust と TypeScript 間の通信に汎用JSONペイロード (`serde_json::Value`等) を使用せず、専用の型を定義します。
- これにより、型の不整合や未実装のコマンド呼び出しをコンパイル時および静的解析 (`npm run check`) で確実に検知できます。

## 2. ディレクトリ構成と責務

### フロントエンド (`src/features/<feature>/`)
- `components/`: UIコンポーネント（機能管理ダッシュボード（設定画面）、オーバーレイウィジェット等）。
- `hooks/`: その機能専用のローカルステートやサイドエフェクト管理。
- `types.ts`: その機能専用の設定インターフェース定義 (`AppSettings` に結合される)。

### バックエンド (`src-tauri/src/features/<feature>.rs`)
- その機能専用の Tauri コマンド (IPC) の実装。
- ここに定義されたコマンドは、`src-tauri/src/lib.rs` 内で明示的に登録する必要があります。

### 機能管理ダッシュボードと共通設定 (`AppSettings`)
- `src/core/context/AppSettings.tsx` (TypeScript)
- `src-tauri/src/core/settings.rs` (Rust)
- すべての機能の設定や有効状態はここで一元管理され、ローカルファイルにシリアライズされて保存されます。
- `theme` などの共通設定と、機能ごとの個別設定 (`clock`, `voiceToText` 等) が混在します。

## 3. モック層の責務
- `src/core/mocks/tauriMock.ts` は、Tauriのバックエンド環境がないブラウザ単体起動時でも動作するように、各Tauriコマンドのダミー処理を提供します。
- 新規コマンドを追加した際は、必ずモック層にも実装を追加する必要があります。

## 4. 追加手順
新しいフィーチャーの追加は、手作業でのミスを防ぐため、必ずスキャッフォールドスクリプトを使用します。

```bash
npm run scaffold:feature <feature_name>
```

生成後は、必要な機能差分だけを明示的に追加します：
- **Tauriコマンド追加**: Rust側で型付きコマンドを実装し、`src-tauri/src/lib.rs` の `tauri::generate_handler!` とブラウザ/Vitestモックに登録。
- **Window Route追加**: `tauri.conf.json` にウィンドウ定義を追加し、`src/core/windowRoutes.ts` でルーティングを設定。
- **検証**: `npm run check:quick` で構造同期を確認し、PR前には環境が許す限り `npm run check:all` を実行。

## 5. 禁止パターン
- ❌ **動的プラグイン機構**: セキュリティリスクと型安全性の低下を招くため禁止。
- ❌ **汎用JSON dispatcher**: `invoke("do_action", { payload: any })` のような型のない通信は禁止。
- ❌ **暗黙登録**: ファイルを置くだけで自動登録されるような黒魔術的機構は禁止。必ずエントリポイント (`lib.rs` や `App.tsx`) で明示的にインポート・登録する。
- ❌ **型安全性を壊す `any`**: TypeScript内での `any` や `as any` による型チェックの回避は禁止。
- ❌ **Git管理から漏れる生成物**: コードジェネレータの出力は全て `.gitignore` の対象外とし、バージョン管理に含めること。
