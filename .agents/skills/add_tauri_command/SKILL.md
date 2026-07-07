---
name: add-tauri-command
description: Safe, type-safe guide to adding a new Tauri backend command and registering it correctly in both Rust and TypeScript sides, including mocks.
---

# `add-tauri-command` Skill

このスキルは、Mint アプリケーションに新しい Tauri コマンド (IPCコマンド) を追加し、フロントエンドとバックエンド間で安全かつ型安全に通信できるようにする手順を案内します。

## 目的
- バックエンド (Rust) で実行する処理を定義し、フロントエンドから呼べるようにする。
- 動的なディスパッチや汎用ペイロード (e.g. `serde_json::Value`) を排除し、厳密な静的型付けによる通信を実現する。

---

## 触る可能性が高いファイル
- **バックエンドの実装**: [src-tauri/src/features/<feature_name>.rs](file:///c:/Users/ibueb/Projects/mint/src-tauri/src/features/) (例)
- **Tauri コマンド登録**: [src-tauri/src/lib.rs](file:///c:/Users/ibueb/Projects/mint/src-tauri/src/lib.rs)
- **自動モック定義**: [src/core/mocks/tauriMock.ts](file:///c:/Users/ibueb/Projects/mint/src/core/mocks/tauriMock.ts)
- **フロントエンドの呼び出し部**: `src/features/<feature_name>/hooks/` または `components/`

---

## 守るべきアーキテクチャルール
1. **静的コマンド定義の徹底**: すべての Tauri コマンドは、Rust 側で個別の `#[tauri::command]` アノテーションを持つ関数として静的に定義してください。
2. **`serde_json::Value` の禁止**: 引数や戻り値に `serde_json::Value` のような汎用型を使用することは禁止です。必ず具体的な Rust 構造体（`Serialize`/`Deserialize`を実装したもの）または基本データ型を使用してください。
3. **Mockの必須実装**: フロントエンドがブラウザでテストできるよう、必ず `tauriMock.ts` 内に同名のコマンド用モック関数を実装してください。単に `Promise.resolve()` を返すだけの空実装は禁止です。

---

## 作業手順

### ステップ 1: Rust バックエンドでコマンド関数を定義
対象の機能モジュールファイル（例: `src-tauri/src/features/clock.rs`）に、コマンドハンドラ関数を追加します。

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct MyCommandResponse {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub fn my_feature_command(payload: String) -> Result<MyCommandResponse, String> {
    // 実際のビジネスロジックを実装
    if payload.is_empty() {
        return Err("Payload cannot be empty".to_string());
    }
    
    Ok(MyCommandResponse {
        success: true,
        message: format!("Received: {}", payload),
    })
}
```

### ステップ 2: `src-tauri/src/lib.rs` へコマンドを登録
`tauri::generate_handler!` 内に、定義したコマンドを追加します。

```rust
        .invoke_handler(tauri::generate_handler![
            core::settings::load_settings,
            core::settings::save_settings,
            core::settings::load_api_key,
            core::settings::save_api_key,
            features::clock::clock_command, // 既存
            features::my_feature::my_feature_command, // 新規追加
        ])
```

### ステップ 3: フロントエンドモック環境への配線
[tauriMock.ts](file:///c:/Users/ibueb/Projects/mint/src/core/mocks/tauriMock.ts) を開き、`mockInvoke` の分岐に新コマンドを追加します。
ブラウザ上での検証が可能なように、ダミー値を返す、または `localStorage` などの状態を変更するシミュレーションロジックを記述します。

```typescript
// tauriMock.ts 内の invoke マップ
const mockInvokes: Record<string, (args: any) => any> = {
  // ...
  "my_feature_command": (args: { payload: string }) => {
    if (!args.payload) {
      throw new Error("Payload cannot be empty");
    }
    return {
      success: true,
      message: `[MOCK] Received: ${args.payload}`
    };
  }
};
```

### ステップ 4: フロントエンドからコマンドの呼び出し
`@tauri-apps/api/core` の `invoke` を使ってコマンドを呼び出します（本プロジェクトでのインポート元やラップ関数がある場合はそれに従います）。

```typescript
import { invoke } from "@tauri-apps/api/core";

const callMyCommand = async (text: string) => {
  try {
    const response = await invoke<{ success: boolean; message: string }>("my_feature_command", {
      payload: text
    });
    console.log(response.message);
  } catch (error) {
    console.error("Command failed:", error);
  }
};
```

---

## 完了条件 (DoD)
- [ ] Rust コマンドが `lib.rs` に登録され、コンパイルが通る。
- [ ] フロントエンドモックに同名コマンドが登録され、ブラウザ起動時にもクラッシュせずモックの動作が確認できる。
- [ ] コマンドの引数・戻り値の型定義が TypeScript と Rust で不整合なく同期している。
- [ ] `npm run verify:architecture` でエラーが出ない。
- [ ] `npm run test` がパスする。

---

## 実行すべき検証
1. **Rustコンパイル検証**: `cargo check` または `cargo test` を実行。
2. **アーキテクチャ検証**: `npm run verify:architecture`
3. **動作確認**: フロントエンドの単体テスト、またはブラウザモック上で期待通りのダミーデータが返却されることの確認。

---

## よくある失敗
- **引数の名前の不一致**: Rust側では `snake_case` (例: `user_id`) で引数を定義しているが、TypeScript 側で `camelCase` (例: `userId`) で渡している場合、シリアライズエラーで呼び出しに失敗します。
- **Mockの登録漏れ**: 新しいコマンドを Rust にだけ追加し、`tauriMock.ts` に追加し忘れたため、ブラウザ開発環境や Vitest テストで "Unsupported mock command" エラーが発生する。
- **`serde_json::Value` の乱用**: 「引数の型定義が面倒」という理由で `payload: serde_json::Value` とし、コンパイル時のチェックを放棄する。
