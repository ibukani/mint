# Security Capabilities

Mint は Tauri Capability を**ウィンドウ単位**に分割し、各ウィンドウが必要最小限の
権限だけを持つことを原則とする（最小権限化）。本ドキュメントは現在の権限マトリクスと、
新しいウィンドウ・権限を追加する際の手順を定める。

## 権限マトリクス

`src-tauri/capabilities/*.json` はウィンドウ label ごとに 1 ファイル対応する。
ファイル名は Capability identifier（`main`, `clock`, `calendar`, `calendar-editor`,
`game-launcher`, `quick-capture`, `file-shelf`）。

| Permission | main | clock | calendar | calendarEditor | gameLauncher | quickCapture | fileShelf |
|---|---|---|---|---|---|---|---|
| `core:default` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `core:window:allow-hide` | - | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| `core:window:allow-destroy` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| `core:window:allow-start-dragging` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | - |
| `core:window:allow-minimize` | ✓ | - | - | - | - | - | - |
| `core:window:allow-close` | ✓ | - | - | - | - | - | - |
| `core:window:allow-set-position` | - | - | ✓ | - | - | - | - |
| `core:window:allow-set-size` | - | - | ✓ | - | - | - | - |
| `dialog:allow-open` | ✓ | - | - | - | - | ✓ | ✓ |
| `dialog:allow-save` | - | - | - | - | - | ✓ | - |
| `opener:default` | - | - | - | - | - | ✓ | ✓ |
| `opener:allow-open-path` | - | - | - | - | - | ✓ | ✓ |
| `drag:default` | - | - | - | - | - | - | ✓ |
| `updater:default` | ✓ | - | - | - | - | - | - |
| `process:default` | ✓ | - | - | - | - | - | - |
| `global-shortcut:default` | - | - | - | - | - | - | - |
| `autostart:default` | - | - | - | - | - | - | - |

### 補足

- `core:default` には読み取り系ウィンドウ API（`is-visible`, `current-monitor`,
  `primary-monitor`, `outer-position`, `outer-size` など）が含まれるため、明示不要。
- `opener:default` には `allow-open-url`（http/https/mailto/tel 限定）と
  `allow-reveal-item-in-dir` が含まれる。任意パスを開く `opener:allow-open-path` は
  個別に必要なウィンドウ（quickCapture, fileShelf）のみに付与する。
- `global-shortcut` / `autostart` はフロントエンドから直接使わず、Rust 側
  （`lib.rs`, `settings_store.rs`）で集約しているため、**どの Capability にも付与しない**。
- Google Calendar 認証 URL のオープンも Rust 側（`auth.rs` の `app.opener()`）で行う。
- ウィンドウ破棄（`allow-destroy`）は `useOverlayWindowEviction`（main 含む）が
  `isVisible() === false` のときに使用するため、main を含む主要ウィンドウに付与する。

## 自動検証

`npm run check:quick`（`verify:architecture`）が以下を CI で検証する
（`scripts/verify-architecture.js` セクション 6.5）。

1. `tauri.conf.json` の全ウィンドウ label が、いずれかの Capability の `windows` に
   含まれること。
2. Capability の `windows` に存在しない label が書かれていないこと。
3. 高影響 permission（`updater`, `process`, `dialog`, `opener`, `drag`,
   `core:window:allow-minimize/close/set-position/set-size`）が allowlist 以外の
   Capability に含まれないこと（`RESTRICTED_CAPABILITY_PERMISSIONS`）。
4. `global-shortcut:default` / `autostart:default` がどの Capability にも含まれないこと。
5. 旧 `default.json`（全ウィンドウ一括）が存在しないこと。
6. 各 Capability が JSON としてパース可能であること。

## 新しいウィンドウ・権限を追加する手順

1. 新ウィンドウの label を `src-tauri/tauri.conf.json` と
   `src/core/windowRoutes.ts` に追加する。
2. `src-tauri/capabilities/<label>.json` を作成し、`windows` に label を設定する。
   **権限は必ず最小限**に。未使用の権限をコピーしない。
3. 制限対象 permission を追加する場合は、利用ウィンドウを
   `RESTRICTED_CAPABILITY_PERMISSIONS`（`scripts/verify-architecture.js`）に
   反映し、本ドキュメントのマトリクスも更新する。
4. `npm run check:quick` で検証が通ることを確認する。
5. 高影響な Rust command を新設する場合は、影響度に応じて
   `ensure_window_allowed(window, allowed_labels)` のような window label 検証を
   lib.rs / 該当モジュールに追加する。
