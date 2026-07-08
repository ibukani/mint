---
name: add-overlay-window
description: Complete checklist and procedure for creating and registering a custom overlay window in Tauri and routing it correctly in React.
---

# `add-overlay-window` Skill

このスキルは、Mint アプリケーションでショートカットキー等から呼び出される「オーバーレイウィンドウ」（サブウィンドウ）を新しく追加し、Tauri 設定および React のルーティングに正しく配線するための手順を案内します。

## 目的
- メインウィンドウとは別に表示される、半透明やボーダーレスな補助画面（例：時計、音声入力状態表示など）を作成する。
- Tauri のウィンドウ管理機能と React の静的ルーティングを安全に統合する。

---

## 触る可能性が高いファイル
- **オーバーレイ UI**: `src/features/<feature_name>/components/<PascalComponentName>Overlay.tsx`
- **ウィンドウルーティング**: [src/core/windowRoutes.ts](../../../src/core/windowRoutes.ts)
- **Tauri ウィンドウ構成**: [src-tauri/tauri.conf.json](../../../src-tauri/tauri.conf.json)
- **App Shell エントリ**: [src/App.tsx](../../../src/App.tsx)

---

## 守るべきアーキテクチャルール
1. **静的ルーティングマップ (`WINDOW_ROUTES`) の利用**: ウィンドウの表示切り替え（ルーティング）は、`WINDOW_ROUTES` オブジェクトで静的にマッピングされていなければなりません。動的インポートやランタイム探索は禁止です。
2. **モッククエリパラメータの対応**: ブラウザ単体での表示確認を可能にするため、`getCurrentWindow().label` を読み取る箇所は自動モック (`tauriMock.ts`) を介し、`?label=<label>` クエリパラメータでウィンドウの表示がシミュレートできなければなりません。

---

## 作業手順

### ステップ 1: オーバーレイコンポーネントを作成
機能フォルダ配下（例: `src/features/clock/components/ClockOverlay.tsx`）に、ウィンドウに表示するコンポーネントを作成します。

```tsx
import React from "react";

export const MyOverlay: React.FC = () => {
  return (
    <div className="glass-panel overlay-container">
      <h2>My Overlay Content</h2>
    </div>
  );
};
```

### ステップ 2: React 側の静的ルーティングに登録
[src/core/windowRoutes.ts](../../../src/core/windowRoutes.ts) を開き、ウィンドウラベルとコンポーネントのマッピングを追記します。

```typescript
import { MyOverlay } from "../features/my_feature/components/MyOverlay";

export const WINDOW_ROUTES: Record<string, React.FC> = {
  clock: ClockOverlay,
  my_overlay_label: MyOverlay, // 新規ウィンドウラベルとコンポーネントの紐付け
};
```

### ステップ 3: `tauri.conf.json` へウィンドウ定義を追加
[src-tauri/tauri.conf.json](../../../src-tauri/tauri.conf.json) の `app -> windows` 配下に、新しいウィンドウの設定を追加します。
オーバーレイウィンドウは、通常ボーダーレス、背景透過、常に最前面表示などの設定が必要です。

```json
{
  "label": "my_overlay_label",
  "title": "My Overlay",
  "width": 400,
  "height": 200,
  "resizable": false,
  "fullscreen": false,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "visible": false
}
```

### ステップ 4: ブラウザモック環境でのルーティング確認
ブラウザ単体で表示を確認するため、URLに `?label=my_overlay_label` を指定してアクセスします。
[App.tsx](../../../src/App.tsx) 内の以下のコードにより、クエリパラメータで指定されたラベルに一致するオーバーレイコンポーネントが表示されることを確認します。

```typescript
// App.tsx の routing 処理部分
if (label && label in WINDOW_ROUTES) {
  const OverlayComponent = WINDOW_ROUTES[label];
  return <OverlayComponent />;
}
```

---

## 完了条件 (DoD)
- [ ] `tauri.conf.json` にウィンドウが定義されている。
- [ ] `windowRoutes.ts` にウィンドウラベルとコンポーネントが静的登録されている。
- [ ] ブラウザの URL に `?label=<label>` を付与した際、対象のオーバーレイコンポーネントが正しく描画される。
- [ ] `npm run build` がエラーなく通る。
- [ ] `npm run verify:architecture` がパスする。

---

## 実行すべき検証
1. **静的検証**: `npm run verify:architecture`
2. **ブラウザ確認**: `npm run dev` 起動後、ブラウザで `http://localhost:5173/?label=my_overlay_label` を開き、意図したデザイン・UIが表示されることを確認。
3. **ビルド検証**: `npm run build`

---

## よくある失敗
- **透過設定 (`transparent`) の競合**: `tauri.conf.json` で `"transparent": true` に設定しているにもかかわらず、CSS側で `body` やルート要素に不透明な背景色 (`background: white` 等) を指定してしまい、背景が透過しない。
- **インポートの不整合**: `windowRoutes.ts` への追加の際にインポートエラーが発生し、ビルドエラーを起こす。
