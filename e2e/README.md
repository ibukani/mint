# E2E / スモークテスト

Mint の Tauri 実挙動（ウィンドウ生成、設定の永続化、オーバーレイの開閉、データの保存・復元、プロセス終了）を Windows 上の実バイナリで自動検証します。

## 採用方式: 外部 tauri-driver + WebDriver 直接プロトコル

実装前に以下の 3 方式を比較し、外部 tauri-driver 方式を採用しました。

| 方式 | 検証 | 本番への影響 | 決定 |
| --- | --- | --- | --- |
| WebDriver（tauri-driver + msedgedriver） | DOM まで実挙動で検証可能。Tauri 公式サポート | なし（外部プロセス） | **採用** |
| Windows UI Automation | ウィンドウ構造のみ。WebView2 内部 DOM の検証不可 | なし | 却下 |
| テスト専用 IPC ドライバの埋め込み | 任意の内部状態を検証可能 | 本番バイナリへのデバッグ用コマンド・Capability 拡張・無認証 IPC が必要になり、Issue の制約に違反 | 却下 |

素の WebDriver HTTP プロトコルを `fetch` で直接使用し、WebdriverIO 等のライブラリ依存を持ち込みません（Windows では msedgedriver と WebView2 のバージョン一致が必須のため、バージョン管理が難しい高級ラッパーを避けます）。

### 制約（テスト専用モードの安全設計）

- `MINT_E2E_DATA_DIR` 環境変数でデータ・設定ディレクトリを `e2e/tmp/<run-id>` に分離します。この変数は **debug ビルドでのみ有効**（`src-tauri/src/core/paths.rs`）で、本番ビルド・実ユーザーデータには一切影響しません。
- テスト専用コマンドの追加や Capability の拡張は行いません。
- テストは起動した mint プロセスの終了を確認し、プロセス残存なしを検証します。

## 構成

| パス | 内容 |
| --- | --- |
| `e2e/run.mjs` | エントリポイント（起動 → 実行 → 後始末 → サマリー） |
| `e2e/helpers/webdriver.mjs` | 素の WebDriver プロトコルクライアント（fetch ベース） |
| `e2e/helpers/harness.mjs` | アプリ・ドライバ・データディレクトリ・後始末の管理 |
| `e2e/specs/smoke.mjs` | スモークシナリオ |
| `e2e/fixtures/settings.json` | 初期設定（onboarding 完了済み、オーバーレイ有効） |
| `e2e/reports/` | 実行ログ・スクリーンショット（gitignore 対象） |
| `e2e/tmp/` | 実行時データディレクトリ（gitignore 対象） |

## 使い方

```sh
npm run test:e2e
```

実行に必要なもの（Windows）:

1. Rust ツールチェーン（`tauri build --debug --no-bundle` に使用。バイナリが既にあればスキップ）
2. [tauri-driver](https://github.com/tauri-apps/tauri-driver)（`cargo install tauri-driver --locked`）
3. `msedgedriver`（WebView2 とバージョン一致。`cargo install --git https://github.com/chippers/msedgedriver-tool` の `msedgedriver-tool` でダウンロードし、PATH に追加するか `--native-driver <path>` で指定）

オプション:

```sh
# ビルドせず既存バイナリで実行
node e2e/run.mjs --no-build

# ドライバポートと msedgedriver を指定
node e2e/run.mjs --port 4445 --native-driver C:\tools\msedgedriver.exe
```

> 注意: npm は `--no-*` 形式の引数を npm 自身の設定として解釈するため、`npm run test:e2e -- --no-build` の形は使用できません。引数を渡す場合は `node e2e/run.mjs` を直接実行してください。

## スモークシナリオ

1. 起動とメインウィンドウ表示（`document.title`、`#root`、テーマ適用）
2. 設定保存 → 再起動で復元（`save_settings` → ディスク確認 → 新セッションでテーマ反映）
3. clock オーバーレイの開閉（`open_overlay` で表示 → DOM 確認 → 再実行で非表示）
4. クイックキャプチャーの文字入力 → 再表示で残存（textarea への入力 → 自動保存 → 開閉 → 値の復元）
5. 正常終了（セッション削除 → mint プロセス残存なし）

## CI（GitHub Actions）

`.github/workflows/ci.yml` の `e2e` job（windows-latest）で実行します。失敗時は `e2e/reports/`（tauri-driver ログ・スクリーンショット）をアーティファクトとして保存します。

## ローカル実行の注意

- `npm run check:quick` / `npm run check` には E2E は含めません（デスクトップ環境が必要なため）。
- 実行中はテスト専用の mint プロセスが起動します。正常終了しない場合は `taskkill /IM mint.exe /F` で掃除してください（実データには影響しません）。
