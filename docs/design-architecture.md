# Mint Design Architecture

Mint の UI は、静的 Feature-Module 設計を維持したまま、見た目の判断と再利用部品を `src/design/` に集約します。機能追加時に色、余白、フォームUI、レイアウトが個別実装でばらつくことを防ぐための境界です。

## 責務境界

### `src/design/`
- 色、余白、角丸、影、blur、フォントサイズ、transition などの design token を持つ。
- アプリテーマを `theme.css` の CSS custom properties として定義する。
- `Button`、`Panel`、`Field`、`TextInput`、`Select`、`SettingsSection` など、設定画面で使う共通UI部品を提供する。
- `AppShell`、`Sidebar`、`ContentArea`、`OverlayFrame`、`OverlayCard` など、画面外枠や overlay の見た目を提供する。
- feature 固有の設定名、IPC、保存処理、業務ロジックは持たない。

## CSS の配置と所有権

`src/index.css` はグローバルなスタイル定義を置く場所ではなく、アプリ全体で常に必要な design layer の読み込み順だけを宣言するエントリーポイントです。

```text
src/
├── index.css                         # src/design/ の @import のみ
├── design/
│   ├── tokens.css                    # design token
│   ├── theme.css                     # theme custom properties
│   ├── foundation/                   # reset、document defaults、a11y
│   ├── layout/                       # app shell、sidebar、overlay frame
│   └── components/                   # 共通 control、button、settings UI
├── core/
│   └── **/*.css                      # アプリ基盤UIを所有する component のCSS
└── features/<feature>/
    └── **/*.css                      # feature 固有UIを所有する component のCSS
```

CSS の配置は「どの画面で使うか」ではなく「どのモジュールが所有するか」で決めます。

- token、theme、reset、共有UI、共有layoutは `src/design/` に置く。
- Clock、Voice-to-Textなど特定featureにしか意味を持たないCSSは、その `src/features/<feature>/` 配下に置く。
- ErrorToastやGeneralSettingsなどアプリ基盤コンポーネント固有のCSSは、対応する `src/core/` のコンポーネント近傍に置く。
- component固有CSSは、そのcomponentまたは同じfeature内のentry componentから相対importする。
- `src/index.css` から `src/core/` や `src/features/` のCSSを読み込まない。
- `src/design/features/` のようなfeature名を持つ共有CSS置き場は作らない。
- `refinements.css`、`overrides.css`、`final-responsive.css` のような後勝ち専用ファイルは作らず、所有元のCSSへ統合する。
- responsive ruleも原則として対象componentを所有するCSSへ置く。
- 新しいCSSファイルは、意味のある所有者と責務を名前で表せる単位にする。

`npm run verify:architecture` は、次を検証します。

- `src/index.css` が `src/design/` 配下への `@import` だけで構成されていること
- import先CSSが実在すること
- `src/design/features/` が存在しないこと
- core/featureのCSS importが、それぞれのモジュール境界を越えていないこと
- CSSファイルがentry pointまたはcomponentから参照され、孤立していないこと

### `src/core/`
- アプリ全体の状態、設定保存、window routing、navigation 定義などを持つ。
- 設定タブの登録は `src/core/navigation/settingsTabs.ts` に集約する。
- 共通設定画面など、feature ではないアプリ全体の設定UIを持つことができる。ただし見た目は `src/design/` の部品を使う。

### `src/features/<feature>/`
- その feature が「どの設定項目を表示するか」と、その設定値をどう更新するかを持つ。
- `useFeatureSettings` や feature 固有 hook を使って状態と副作用を扱う。
- 設定画面は `SettingsSection`、`Field`、`TextInput`、`Select`、`Button` を組み合わせ、共有UIを再実装しない。
- feature固有の構図、可視化、状態表現はfeature配下のCSSが所有し、可能な限りdesign tokenを参照する。
- overlay も可能な限り `OverlayFrame` / `OverlayCard` を使い、feature側のinline styleはユーザー設定由来の動的サイズなど最小限に限る。

## 新しい設定画面の作り方

1. 新規 feature は `npm run scaffold:feature <feature_name>` で作成する。
2. 生成された `*Settings.tsx` では `SettingsSection` を画面単位の外枠にする。
3. 各設定項目は `Field` で label、help text、error を表現し、入力部品には `TextInput` または `Select` を使う。
4. 実行ボタンは `Button` を使う。
5. feature 内で `form-control`、`form-group`、`form-label`、`primary-button`、`glass-panel` などの旧 global class を使わない。

## 直接定義を避けるもの

featureのReact/TypeScript内では以下を直接書かないでください。

- 見た目のための色コードや `rgba(...)`
- 見た目のためのinline style
- 旧global class

CSS内でも、共有可能な色・余白・影・角丸・blur・transitionはdesign tokenを優先します。feature固有の構図や動的可視化に必要な値まで無理に共有化せず、業務状態やfeature固有の文言をdesign layerへ入れないでください。

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
