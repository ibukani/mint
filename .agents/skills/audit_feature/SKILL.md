---
name: audit-feature
description: Guide to auditing an existing or newly added feature for architectural compliance, settings alignment, test presence, and code safety.
---

# `audit-feature` Skill

このスキルは、新規または既存の機能モジュール（フィーチャー）が、プロジェクトの設計原則およびガイドライン（静的フィーチャーアーキテクチャ）に完全に準拠しているかを客観的かつ厳格に監査（監査・レビュー）するための手順です。

## 目的
- 機能追加時またはリファクタリング時に、設計逸脱（Drift）が発生していないか検出する。
- 静的検証スクリプトでは検知できない、`as any` の残存や不完全なモック実装などを人為的（AI Agent側）に検知する。

---

## 触る可能性が高いファイル
- **すべてのフィーチャーモジュール**: `src/features/` 配下
- **設定スキーマ**: [AppSettings.tsx](file:///c:/Users/ibueb/Projects/mint/src/core/context/AppSettings.tsx) および [settings.rs](file:///c:/Users/ibueb/Projects/mint/src-tauri/src/core/settings.rs)
- **テストコード**: `src/**/*.test.ts` または `src/**/*.test.tsx`
- **検証スクリプト**: [verify-architecture.js](file:///c:/Users/ibueb/Projects/mint/scripts/verify-architecture.js)

---

## 守るべきアーキテクチャルール
1. **検証結果の保証**: 「確認済み」と宣言する前に、必ず検証コマンドを実行しなければなりません。
2. **型安全の厳守**: `as any` や `any` のキャストが残存していないか、`types.ts` と `AppSettings` の連携で型エラーが握りつぶされていないか確認します。
3. **完全な同期の確認**: フロントエンド設定、バックエンド設定、ブラウザモック設定が同期されていること。

---

## 作業手順

### ステップ 1: 自動アーキテクチャ検証の実行
まず、設計整合性検証スクリプトを実行し、機械的な不整合がないか確認します。
```bash
npm run verify:architecture
```
(Windows PowerShell環境で制限が出る場合は `powershell -ExecutionPolicy Bypass -Command "npm run verify:architecture"` を実行してください)

### ステップ 2: 静的な型宣言と型キャストのチェック
対象フィーチャーの `src/features/<feature_name>/` 配下のソースコードを目視確認し、以下を監査します。
- `as any` が使われていないか？ (特に `AppSettings` の更新ロジックなど)
- Reactコンポーネントが `React.FC` などの型定義で正しく宣言されているか？
- `types.ts` で定義された型が `AppSettings.tsx` でインポートされているか？

### ステップ 3: 設定の同期チェック
- [AppSettings.tsx](file:///c:/Users/ibueb/Projects/mint/src/core/context/AppSettings.tsx) のプロパティ名 (例: `myTool`)
- [settings.rs](file:///c:/Users/ibueb/Projects/mint/src-tauri/src/core/settings.rs) のプロパティ名 (例: `my_tool`)
- [tauriMock.ts](file:///c:/Users/ibueb/Projects/mint/src/core/mocks/tauriMock.ts) のデフォルト設定値オブジェクト
これらがスペルミスなく、すべて同じ意味・デフォルト値で揃っていることを確認します。

### ステップ 4: ブラウザモックの配線チェック
- 追加されたすべての Tauri コマンドについて、[tauriMock.ts](file:///c:/Users/ibueb/Projects/mint/src/core/mocks/tauriMock.ts) にダミー挙動が実装されているか。
- 単に `Promise.resolve()` を返すだけの「空モック」になっておらず、状態の変更やモックらしい挙動を再現しているか。

### ステップ 5: テストコードの監査
- 対象フィーチャーの近く（例: `src/features/<feature_name>/components/`）に `*.test.tsx` または `*.test.ts` が存在するか。
- テスト内でモックが正しく使われ、かつテストが実際にパスしているか。

---

## 完了条件 (DoD)
- [ ] 自動検証コマンド (`verify:architecture`) が 0 エラーでパスする。
- [ ] 対象フィーチャー内に `as any` や `any` が使用されていない。
- [ ] テストファイルが存在し、`npm run test` ですべて成功する。
- [ ] モックが完全に実装され、ブラウザ開発環境で動作可能である。

---

## 実行すべき検証
1. `npm run verify:architecture`
2. `npm run test`
3. `npm run build`

---

## よくある失敗
- **verify:architecture のパスだけで満足する**: 機械的な検証はパスしたものの、実際のUIコンポーネントコードに `as any` が大量に残っているのを見逃してしまう。
- **モックの手抜き見逃し**: コマンド呼び出しのモックが空実装になっているため、ブラウザ単体で起動した際に設定値の読み書きがモックに反映されない。
- **テストの放置**: テストコードが書かれていない、あるいはアサートが不十分（単にレンダリングするだけで挙動の検証がない）であることを見落とす。
