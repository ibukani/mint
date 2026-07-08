# Mint Design Architecture

Mint の UI は、静的 Feature-Module 設計を維持したまま、見た目の判断と再利用部品を `src/design/` に集約します。機能追加時に色、余白、フォームUI、レイアウトが個別実装でばらつくことを防ぐための境界です。

## 責務境界

### `src/design/`
- 色、余白、角丸、影、blur、フォントサイズ、transition などの design token を持つ。
- アプリテーマを `theme.css` の CSS custom properties として定義する。
- `Button`、`Panel`、`Field`、`TextInput`、`Select`、`SettingsSection` など、設定画面で使う共通UI部品を提供する。
- `AppShell`、`Sidebar`、`ContentArea`、`OverlayFrame`、`OverlayCard` など、画面外枠や overlay の見た目を提供する。
- feature 固有の設定名、IPC、保存処理、業務ロジックは持たない。

### `src/core/`
- アプリ全体の状態、設定保存、window routing、navigation 定義などを持つ。
- 設定タブの登録は `src/core/navigation/settingsTabs.ts` に集約する。
- 共通設定画面など、feature ではないアプリ全体の設定UIを持つことができる。ただし見た目は `src/design/` の部品を使う。

### `src/features/<feature>/`
- その feature が「どの設定項目を表示するか」と、その設定値をどう更新するかを持つ。
- `useFeatureSettings` や feature 固有 hook を使って状態と副作用を扱う。
- 色、余白、影、角丸、低レベルフォームclassを直接定義しない。
- 設定画面は `SettingsSection`、`Field`、`TextInput`、`Select`、`Button` を組み合わせて作る。
- overlay も可能な限り `OverlayFrame` / `OverlayCard` を使い、feature 側の inline style はユーザー設定由来の動的サイズなど最小限に限る。

## 新しい設定画面の作り方

1. 新規 feature は `npm run scaffold:feature <feature_name>` で作成する。
2. 生成された `*Settings.tsx` では `SettingsSection` を画面単位の外枠にする。
3. 各設定項目は `Field` で label、help text、error を表現し、入力部品には `TextInput` または `Select` を使う。
4. 実行ボタンは `Button` を使う。
5. feature 内で `form-control`、`form-group`、`form-label`、`primary-button`、`glass-panel` などの旧 global class を使わない。

## 直接定義を避けるもの

feature 内では以下を直接書かないでください。

- 色コードや `rgba(...)`
- 余白、影、角丸、blur、transition の低レベル指定
- 見た目のための inline style
- 旧 global class

必要な見た目が足りない場合は、まず `src/design/` に汎用 token または共通コンポーネントの variant として追加できるかを判断します。feature 固有の業務状態や文言を design layer に入れてはいけません。

## 例外

例外は、通常の UI 部品では表現できない動的表示に限ります。

- overlay のフォントサイズなど、ユーザー設定に基づく動的な CSS custom property
- canvas や座標計算など、値そのものが runtime 入力で決まる UI
- 移行中に安全上どうしても残す必要がある箇所

例外を置く場合は、`scripts/verify-architecture.js` の allowlist に理由が分かる粒度で追加し、増えすぎないようにしてください。

## 検証

`npm run verify:architecture` は feature 内の以下を検出します。

- 不要な色コード直書き
- 不要な `rgba(...)` 直書き
- 不要な inline style
- 低レベル global class の直接利用

通常の実装後は `npm run check:quick` を実行し、PR前または引き渡し前には環境が許す限り `npm run check:all` を実行してください。
