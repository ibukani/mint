---
name: update-settings-schema
description: Step-by-step instructions for safely updating and expanding the AppSettings schema across TypeScript, Rust, and mock environments.
---

# `update-settings-schema` Skill

このスキルは、アプリケーション全体で共有されるユーザー設定スキーマ（`AppSettings`）を、フロントエンドとバックエンドで矛盾なく安全に更新・拡張するための手順を案内します。

## 目的
- アプリケーション全体の設定項目を追加、更新、削除する。
- TypeScript の型定義、Rust のシリアライズ/デシリアライズ用構造体、およびブラウザ/テスト用モックの3者を完全に同期させる。

---

## 触る可能性が高いファイル
- **フロントエンド設定定義**: [AppSettings.tsx](../../../src/core/context/AppSettings.tsx)
- **バックエンド設定定義**: [settings.rs](../../../src-tauri/src/core/settings.rs)
- **自動モック初期値**: [tauriMock.ts](../../../src/core/mocks/tauriMock.ts) および [vitestSetup.ts](../../../src/core/mocks/vitestSetup.ts)
- **フィーチャー固有の型**: `src/features/<feature_name>/types.ts`

---

## 守るべきアーキテクチャルール
1. **3点同期の維持**: 設定を追加する場合、必ず **TypeScriptのインターフェース**、**Rustの構造体**、および**Mockの初期値オブジェクト** の3箇所すべてを同時に変更してください。
2. **命名規則の遵守**: 
   - フロントエンド（TypeScript）: `camelCase` (例: `voiceToText`)
   - バックエンド（Rust）: `snake_case` (例: `voice_to_text`)
   - Rust 側の構造体アトリビュートには `#[serde(rename_all = "camelCase")]` が指定されており、JSON シリアライズ時に `camelCase` に変換されることを確認してください。
3. **`as any` 型キャストの禁止**: 型定義の追記が面倒という理由で `updateSettings` の呼び出し時に `as any` を用いて型チェックをすり抜けることは禁止です。

---

## 作業手順

### ステップ 1: フロントエンドの型定義を更新
対象フィーチャーの `types.ts` に設定項目を追加し、[AppSettings.tsx](../../../src/core/context/AppSettings.tsx) の `AppSettings` インターフェースを更新します。

```typescript
// AppSettings.tsx
export interface AppSettings {
  theme: "dark" | "light";
  clock: ClockSettings;
  voiceToText: VoiceToTextSettings;
  myNewFeature: MyNewFeatureSettings; // 新規追加 (camelCase)
}
```

### ステップ 2: バックエンド (Rust) の構造体を更新
[settings.rs](../../../src-tauri/src/core/settings.rs) を開き、設定構造体にフィールドを追加し、`Default` 実装も更新します。

```rust
// settings.rs
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct AppSettings {
    pub theme: String,
    pub clock: ClockSettings,
    #[serde(rename = "voiceToText")]
    pub voice_to_text: VoiceToTextSettings,
    #[serde(rename = "myNewFeature")]
    pub my_new_feature: MyNewFeatureSettings, // 新規追加 (snake_case + serdeリネーム指定)
}
```

### ステップ 3: モックのデフォルト値を更新
[tauriMock.ts](../../../src/core/mocks/tauriMock.ts) と [vitestSetup.ts](../../../src/core/mocks/vitestSetup.ts) の `defaultSettings` 定数に、追加した項目のデフォルト値を追記します。

```typescript
export const defaultSettings: AppSettings = {
  theme: "dark",
  clock: { enabled: false, shortcut: "Ctrl+Alt+C" },
  voiceToText: { enabled: false, shortcut: "Ctrl+Alt+V" },
  myNewFeature: { enabled: false, shortcut: "Ctrl+Alt+N" }, // 新規追加 (デフォルト値)
};
```

### ステップ 4: アーキテクチャ検証の実行
変更が正しく認識され、不整合がないことを検証します。
```bash
npm run verify:architecture
```

---

## 完了条件 (DoD)
- [ ] TypeScript, Rust, Mock 全ての設定定義に不整合がない。
- [ ] `npm run verify:architecture` がパスする。
- [ ] `npm run test` および `npm run build` がパスする。
- [ ] 新規項目を利用するコードから `as any` キャストが排除されている。

---

## 実行すべき検証
- `npm run verify:architecture`
- `npm run test`
- `npm run build`

---

## よくある失敗
- **Rust 側の `Default` 実装漏れ**: `settings.rs` の `AppSettings` にフィールドを追加したものの、`Default` 実装（あるいは各設定の初期値）に追記し忘れ、コンパイルエラーが発生する。
- **Mock の同期漏れ**: フロントエンドと Rust は合わせたが、`tauriMock.ts` に追加し忘れたため、ブラウザ起動時に設定オブジェクトが不完全になり、UI がクラッシュする。
- **`camelCase` と `snake_case` のスペルミス**: フロントエンドとバックエンドでスペルや大文字小文字が微妙にズレてしまい、自動検証スクリプトでエラーになる。
