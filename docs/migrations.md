# Mint 永続データ・マイグレーションガイド

## 概要

設定のJSONは **スキーマバージョン** を持ち、バージョン間の変換を「隣接マイグレーション」の連結として適用する。ほかの永続データは下表の所有元・保存方式を使用し、すべてがこのJSON基盤の対象という意味ではない。

- 保存形式: `{ "schemaVersion": N, "data": { ... } }` の envelope 形式
- バージョン指定のない既存ファイルは **バージョン 0** として扱う
- マイグレーションはバージョン間の純粋変換（v0→v1→v2→…）を順に適用
- 破壊的変更の適用前にはバックアップを作成する
- 未来バージョンのファイルは上書きせずエラーを返す

## 実装場所

- 共通基盤: `src-tauri/src/core/migrations/`
  - `mod.rs`: Migration 型・MigrationError・`detect_version`・`run_migrations`
  - `backup.rs`: バックアップ作成と上限付き整理
  - `settings/`: settings.json 用のマイグレーション定義

## 対象データの棚卸し

| データ | ファイル | 状態 |
|---|---|---|
| settings.json | `app_config_dir/settings.json` | v3（envelope・onboarding移行・廃止機能の設定削除） |
| 廃止済み quick_capture メモ・下書き・添付 | `app_data_dir/quick_capture.sqlite3` と添付ファイル | 削除せず保持。アプリは読み込み・初期化しない |
| 廃止済み file_shelf 保存項目 | `app_data_dir/file_shelf.sqlite3`・`file_shelf_assets/` | 削除せず保持。アプリは読み込み・初期化しない |
| calendar ローカル予定 | `app_data_dir/calendar.sqlite3` | SQLite `user_version` による移行（`features/calendar/database.rs`） |
| game_launcher お気に入り | settings.json 内 | 設定と同じ envelope・移行チェーンで管理 |
| Mint Palette 最近使用 | WebView localStorage | `useMintPalette` と共通quick-switcher検索helperが管理 |
| Window State | `app_config_dir/window_state/<label>.json` | 共通マイグレーション基盤の対象外（`core/window_state/` が独自versionを管理） |

OAuth token は OS キーリングで管理し、マイグレーション対象外。廃止した音声入力のAPIキーと旧window stateも自動削除しない。

`tauri dev` のデバッグビルドは、インストール済みリリース版を保護するため、
`app_config_dir/development`、`app_data_dir/development` と専用のキーリングサービス名を使う。
リリースビルドの既存保存先は変更しない。

## 新規マイグレーションの追加手順

1. `src-tauri/src/core/migrations/<data>/mod.rs`（なければ作成）のマイグレーション一覧に追加する:
   ```rust
   Migration {
       from_version: N,
       to_version: N + 1,
       name: "<data>-vN-to-v{N+1}-<概要>",
       apply: Box::new(|data| { /* 純粋変換 */ }),
   }
   ```
   - 必ず `from_version + 1 == to_version` の隣接ペアにすること（`ChainGap` エラーになる）
   - `apply` は I/O を一切行わない純粋関数にすること（テスト容易性のため）
   - バージョン定数（例: `SETTINGS_SCHEMA_VERSION`）を更新する
2. fixture ファイルを追加する（`fixtures/` 配下、移行前・後の両パターン）
3. `run_migrations` の動作を単体テストで検証する
4. `cargo test --manifest-path src-tauri/Cargo.toml --lib core::migrations` で確認

## 動作詳細

- `detect_version(content)`: `schemaVersion` フィールドを読み取り、無ければ 0。JSON として壊れている場合は `InvalidJson`
- `run_migrations(content, chain, latest)`: 現在バージョンから最新まで隣接マイグレーションを適用。適用したマイグレーション名を `applied` に記録
- 未来バージョン検出時: `FutureVersion { found, latest }` エラー。ファイルは変更しない
- バックアップ: `create_backup(path, kind, from_version)` が `backups/<kind>.v<旧version>.backup-<日時>.json` を作成（最大 5 件まで保持）。バックアップ作成に失敗した場合はマイグレーション自体を中止する
- 書き込み: 既存の `write_settings_atomically`（一時ファイル + rename、失敗時ロールバック）を使用

## settings.json の現行仕様

- v0（旧形式）: envelope なしの AppSettings 直書き
- v1: `{ "schemaVersion": 1, "data": { ...AppSettings } }`
- v2: `{ "schemaVersion": 2, "data": { ...AppSettings } }`。v1→v2 で既存ユーザーの `onboarding.completedVersion` を補う
- v3（現行）: `{ "schemaVersion": 3, "data": { ...AppSettings } }`。v2→v3 で `fileShelf`・`quickCapture`・`voiceToText` を除く。移行前の設定をバックアップし、残る設定・onboarding・独立した保存データは保持する
- 最新バージョンとチェーンの所有元は `src-tauri/src/core/migrations/settings/mod.rs` の `SETTINGS_SCHEMA_VERSION` と `settings_migrations()`
- 読み込み時: 旧バージョンからv3まで隣接移行を適用し、バックアップ → 書き戻しを経て読み込む。既存の onboarding 値は保持する
- 保存時: 常に最新バージョンの envelope で書き出す
- 新規インストールは `completedVersion: 0` で初回セットアップを表示する。既存ユーザーの移行と、既存ユーザーを模擬するブラウザ mock（`completedVersion: 1`）を新規 default に揃えない

## ログに関する制約

マイグレーションのエラー・ログにメモ本文・API キー・トークン等の機微情報を出力しないこと。エラーは構造化された `MigrationError` として伝播させる。
