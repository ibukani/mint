# Mint 性能計測 (Performance)

性能予算と診断基盤のローカル計測シナリオを置くディレクトリです。Issue #30 の初期実装範囲として、以下を提供します。

## 構成

| パス | 内容 |
| --- | --- |
| `fixtures/` | 決定的な計測入力（JSON）。CI やローカルで再現可能な値を固定して保持する |
| `baselines/` | ハードバジェット定義（`budgets.json`） |
| `scenarios/` | 計測シナリオ実行スクリプト（`smoke.mjs` / `desktop.mjs` / `lib.mjs`） |
| `reports/` | 実行時に生成されるレポート（gitignore 対象） |

## 使い方

```bash
npm run perf:smoke    # スモークシナリオ（ハードバジェット検証込み）
npm run perf:desktop  # デスクトップシナリオ（レポート生成のみ）
npm run perf:report   # 上記2つを連続実行
```

- 入力 JSON の `environment`（platform / arch / appVersion / commitSha / isRelease）と計測イベント、カウンターをレポートに含めます。commit SHA は `MINT_COMMIT_SHA` 環境変数 → `git rev-parse HEAD` → 入力値の順で解決します。
- カスタム入力で実行する場合: `node performance/scenarios/smoke.mjs <入力JSONへのパス>`（`desktop.mjs` も同様）。

## 入力形式

```json
{
  "capturedAt": "2026-08-04T00:00:00.000Z",
  "environment": {
    "platform": "win32",
    "arch": "x64",
    "appVersion": "0.3.1",
    "commitSha": "0123456789abcdef0123456789abcdef01234567",
    "isRelease": false
  },
  "events": [
    { "name": "app:startup", "startedAt": "2026-08-04T00:00:00.000Z", "durationMs": 412, "windowLabel": null }
  ],
  "counters": {
    "windowsCreated": 2,
    "windowsHidden": 1,
    "windowsDestroyed": 1,
    "monitorsDetected": 2,
    "workersStarted": 1,
    "workersStopped": 0
  }
}
```

## ハードバジェット

`baselines/budgets.json` の各イベント名に対する最大所要時間（`maxEventDurationMs`）、全体合計（`maxTotalDurationMs`）、イベントごとの最低件数（`minEventsPerName`）を検証します。環境差の小さい内部指標のみを対象とし、超過時は `perf:smoke` が終了コード 1 を返します（CI で失敗にできます）。RSS/CPU など環境依存の大きい指標はここでは扱いません。

## 計測 API

アプリ内の計測は `src/core/performance/`（フロントエンド）と `src-tauri/src/core/performance.rs`（バックエンド）で提供します。

- フロントエンド: `recordEvent(name, ...)` / `measure(name, fn)` / `incrementCounter(name)` / `getEvents()` など。debug ビルドのみ有効。
- バックエンド: 起動・window 生成/表示/破棄・worker 開始/停止などのライフサイクルイベントとカウンターを記録。debug ビルドのみ有効（`MINT_PERFORMANCE_ENABLED` で release でもオプトイン可能）。
- 診断情報の収集: 設定画面の「診断情報をコピー」から `collect_diagnostics` で取得でき、`src/core/performance/diagnostics.ts` の `collectDiagnostics()` で呼び出せます。
