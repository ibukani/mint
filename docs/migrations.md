# Mint 永続データ・マイグレーションガイド

## 概要

Mint は永続データ（設定・メモ・ファイルシェル項目など）に **スキーマバージョン** を導入し、バージョン間の変換を「隣接マイグレーション」の連結として適用する。

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
| settings.json | `app_config_dir/settings.json` | v1（envelope 導入済み） |
| quick_capture メモ・下書き | `app_data_dir/quick_capture/` | 未対応（将来） |
| file_shelf 保存項目 | `app_data_dir/file_shelf/` | 未対応（将来） |
| calendar ローカル予定 | `app_data_dir/calendar/` | 未対応（将来） |
| game_launcher お気に入り | 設定内 | 未対応（将来） |
| Mint Palette 最近使用 | 未定 | 未対応（将来） |
| Window State | 未定 | 未対応（将来） |

API キー・OAuth token は OS キーリングで管理し、マイグレーション対象外。

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
4. `cargo test --lib core::migrations` で確認

## 動作詳細

- `detect_version(content)`: `schemaVersion` フィールドを読み取り、無ければ 0。JSON として壊れている場合は `InvalidJson`
- `run_migrations(content, chain, latest)`: 現在バージョンから最新まで隣接マイグレーションを適用。適用したマイグレーション名を `applied` に記録
- 未来バージョン検出時: `FutureVersion { found, latest }` エラー。ファイルは変更しない
- バックアップ: `create_backup(path, kind, from_version)` が `backups/<kind>.v<旧version>.backup-<日時>.json` を作成（最大 5 件まで保持）。バックアップ作成に失敗した場合はマイグレーション自体を中止する
- 書き込み: 既存の `write_settings_atomically`（一時ファイル + rename、失敗時ロールバック）を使用

## settings.json の現行仕様

- v0（旧形式）: envelope なしの AppSettings 直書き
- v1（現行）: `{ "schemaVersion": 1, "data": { ...AppSettings } }`
- 読み込み時: v0 なら v1 へ移行（バックアップ → 書き戻し）してから読み込む
- 保存時: 常に v1 形式で書き出す

## ログに関する制約

マイグレーションのエラー・ログにメモ本文・API キー・トークン等の機微情報を出力しないこと。エラーは構造化された `MigrationError` として伝播させる。
