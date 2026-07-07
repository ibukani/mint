# mint - 個人向け便利ツール・デスクトップアプリ

本アプリケーションは、Tauri 2 (Rust) + React 19 (TypeScript) + Vanilla CSS で構築された、デスクトップ常駐型の個人用便利ツール収集プラットフォームです。

## 機能の実装状況

- **時計オーバーレイ (Clock Overlay)**: **実装完了**。ショートカットキーでのトレイ表示、表示秒数 (`autoHideSeconds`) に応じた自動非表示、およびフォントサイズ変更に対応。
- **音声入力 (Voice to Text)**: **一部未実装 (プレースホルダー)**。設定 UI および OS セキュアストレージ (keyring) を利用した API キーの永続化保存は実装されていますが、実際のグローバルショートカットでのフックや録音・Whisper API 経由での文字起こし処理自体はプレースホルダーであり、未実装です。

## 主な機能（開発基盤）
- **システムトレイ常駐**: アプリ起動時にタスクバーのシステムトレイに常駐。
- **Discord風最小化**: ウィンドウの「×」ボタンを押した際、アプリプロセスを終了せず、トレイに非表示化。
- **型安全な設定管理**: 各機能（ツール）の設定データを、フロントエンドとバックエンドの双方で厳格に型定義し、ローカルの JSON ファイル (`settings.json`) に永続化。
- **グラスモルフィズムUI**: 美しい半透明ぼかし効果、グラデーション、および滑らかなマイクロアニメーションを採用したダークモードデザイン。

---

## 開発用アーキテクチャ設計

本プロジェクトは、コードの肥大化を防ぎ、コンパイル時のチェックを最大限活用するために **「静的フィーチャーモジュール（Feature-Module）アーキテクチャ」** を採用しています。

### ディレクトリ構成

#### フロントエンド (`src/`)
- `core/`: アプリケーションの基盤シェル（サイドバー、共通レイアウト、通知、設定コンテキスト）。
- `features/`: 独立した機能（ツール）モジュール。各機能ごとにディレクトリを完全に分離します。
  - `clock/`: 時計ツール
  - `v2t/`: 音声入力ツール

#### バックエンド (`src-tauri/src/`)
- `core/`: 設定の永続化処理、システムトレイの設定。
- `features/`: 各ツールの Rust 側コマンドの実装。

---

## 新しいツールの追加手順

新しい機能（例: `my_tool`）を実装する手順は以下の通りです。

### 1. フロントエンドの設定型定義を追加
`src/core/context/AppSettings.tsx`（または `src/features/types.ts` 等の共通定義）の `AppSettings` インターフェースに新しい機能の設定スキーマを追加します。

```typescript
export interface MyToolSettings {
  enabled: boolean;
  shortcut: string;
}

export interface AppSettings {
  // ... 既存の設定
  myTool: MyToolSettings;
}
```

### 2. バックエンド（Rust）の設定型定義を追加
`src-tauri/src/core/settings.rs` 内の `AppSettings` 構造体に型定義を追記します。これにより、自動的にローカルファイルのセーブ・ロード対象になります。

```rust
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct MyToolSettings {
    pub enabled: bool,
    pub shortcut: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default)]
pub struct AppSettings {
    // ... 既存の設定
    pub my_tool: MyToolSettings,
}
```

### 3. フロントエンドに機能ディレクトリを作成
`src/features/my_tool/` ディレクトリを作成し、設定UIやメインロジックを作成します。

```text
src/features/my_tool/
├── components/
│   └── MyToolSettings.tsx  # 設定画面のタブ内に表示するUI
└── types.ts
```

### 4. アプリシェルへの結合
- `src/App.tsx` の設定画面タブメニューに、作成した `MyToolSettings` を追加します。
- 必要に応じて、`tauri.conf.json` にサブウィンドウを追加し、`App.tsx` でウィンドウ表示の分岐を行います。
- 必要に応じて、`src-tauri/src/features/` に Rust のコマンドモジュールを作成し、`lib.rs` の `tauri::generate_handler!` に登録します。

---

## 開発およびビルドコマンド

パッケージのルートディレクトリで実行してください：

```bash
# 依存関係のインストール
npm install

# 開発用デスクトップアプリの起動（HMR有効）
npm run tauri -- dev

# フロントエンドの単体ビルドと型チェック
npm run build

# アプリのリリースビルド作成
npm run tauri -- build
```

---

## 開発ガイドライン (AI アシスタント向け)
AI アシスタントがコードを追加・修正する際は、ルートディレクトリの `.agents/AGENTS.md` に記載されているルールを厳格に遵守してください。
