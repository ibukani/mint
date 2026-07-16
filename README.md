# mint - 個人向け便利ツール・デスクトップアプリ

本アプリケーションは、Tauri 2 (Rust) + React 19 (TypeScript) + Vanilla CSS で構築された、デスクトップ常駐型の個人用便利ツール収集プラットフォームです。

## 機能の実装状況（Feature States）
開発において、各機能は以下のいずれかの状態を持ちます。AIエージェントはこれらを意識し、不用意にプレースホルダー機能を呼び出さないようにしてください。

- **implemented**: 完全実装済み。UI、バックエンドロジック、およびモックがすべて連携して動作する状態。
- **partial**: 一部実装済み。特定のAPIや処理のみが実装され、残りは未完成の状態。
- **placeholder**: UIや設定保存などの側（ガワ）だけが実装されており、実際のコア処理が存在しない状態（将来の拡張用）。OSへの副作用（グローバルショートカット登録など）は無効化されます。
- **disabled**: 機能として存在しているが、一時的に無効化または使用不可とされている状態。

### 現在の機能一覧
- **時計オーバーレイ (Clock Overlay)**: **implemented**。ショートカットキーでのトレイ表示、自動非表示、フォントサイズ変更など。
- **カレンダー (Calendar)**: **implemented**。ローカル予定の管理とGoogle Calendarの複数予定表・双方向同期に対応。
- **ゲームランチャー (Game Launcher)**: **implemented**。インストールされているゲームの取得と起動に対応。
- **ファイルシェル (File Shelf)**: **implemented**。ファイル・フォルダの一時保管、クリップボードからの画像・URL・文章追加、検索、コピー、Explorerへの取り出しに対応。
- **クイックキャプチャー (Quick Capture)**: **implemented**。自動保存される下書き、タグ付きメモ、全文検索、Markdown書き出し、添付ファイル、バックアップ、クリップボードコピーに対応。
- **音声入力 (Voice to Text)**: **implemented**。音声ファイルの選択・貼り付け・ドラッグ＆ドロップ、マイクからの録音、APIキーの安全な保存、OpenAI互換APIでの文字起こしに対応しています。

## 主な機能（開発基盤）
- **システムトレイ常駐**: アプリ起動時にタスクバーのシステムトレイに常駐。
- **Discord風最小化**: ウィンドウの「×」ボタンを押した際、アプリプロセスを終了せず、トレイに非表示化。
- **機能管理ダッシュボード（型安全な設定管理）**: 各機能（ツール）の設定データを、フロントエンドとバックエンドの双方で厳格に型定義し、ローカルの JSON ファイル (`settings.json`) に永続化。
- **グラスモルフィズムUI**: 美しい半透明ぼかし効果、グラデーション、および滑らかなマイクロアニメーションを採用したダークモードデザイン。
- **システムテーマ追従**: ダーク、ライト、OS設定に合わせるシステムテーマを選択可能。

---

## 開発用アーキテクチャ設計

本プロジェクトは、コードの肥大化を防ぎ、コンパイル時のチェックを最大限活用するために **「静的フィーチャーモジュール（Feature-Module）アーキテクチャ」** を採用しています。

### ディレクトリ構成

#### フロントエンド (`src/`)
- `core/`: アプリケーションの基盤シェル（サイドバー、共通レイアウト、通知、ダッシュボード設定コンテキスト）。
- `features/`: 独立した機能（ツール）モジュール。各機能ごとにディレクトリを完全に分離します。
  - `clock/`: 時計ツール
  - `v2t/`: 音声入力ツール
  - `calendar/`: カレンダーとGoogle Calendar連携
  - `game_launcher/`: インストール済みゲームの検索・起動
  - `quick_capture/`: 下書き・メモ・バックアップ
  - `file_shelf/`: ファイル・クリップボードの一時保管

#### バックエンド (`src-tauri/src/`)
- `core/`: 設定の永続化処理、システムトレイの設定。
- `features/`: 各ツールの Rust 側コマンドの実装。

---

## 新しいツールの追加手順

新しい機能（例: `my_tool`）は、手作業ではなくスキャフォールドから追加します。

```bash
npm run scaffold:feature my_tool MyTool
```

生成後は、機能固有のUI、型、Rustコマンド、ウィンドウ定義を必要に応じて実装し、以下で構造の同期を確認してください。

```bash
npm run check:quick
```

詳細なAI向け手順は `docs/ai-development.md`、`docs/ai-quality-rubric.md`、`.agents/skills/create-static-feature/SKILL.md` を参照してください。

---

## 開発およびビルドコマンド

パッケージのルートディレクトリで実行してください：

Google Calendar連携を有効にするビルドでは、Google Cloud ConsoleでCalendar APIを有効化し、種類を「デスクトップアプリ」としたOAuthクライアントIDを指定します。クライアントシークレットは不要です。

```bash
export GOOGLE_CALENDAR_CLIENT_ID="<desktop OAuth client ID>"
```

```bash
# AI向けの低トークン概要を表示
npm run ai:context

# 依存関係のインストール
npm install

# 開発用デスクトップアプリの起動（HMR有効）
npm run tauri -- dev

# フロントエンドの単体ビルドと型チェック
npm run build

# アプリのリリースビルド作成
npm run tauri -- build

# AI主体開発向けの最終ローカル検証
npm run check:all
```

### GitHub Codespaces

リポジトリを Codespaces で開くと、`.devcontainer/devcontainer.json` により Node.js 22 系（npm 同梱）と Rust 開発環境が用意され、初回作成時に `npm ci` が実行されます。Vite の開発サーバーはポート 1420 に転送されます。

```bash
npm run dev
```

---

## 開発ガイドライン (AI アシスタント向け)
AI アシスタントがコードを追加・修正する際は、ルートディレクトリの `AGENTS.md` と `docs/ai-development.md` に記載されているルールを厳格に遵守してください。
