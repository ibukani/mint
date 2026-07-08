## 概要
<!-- PRの目的と概要を簡潔に記載してください -->

## 変更内容
<!-- 具体的な変更内容を箇条書きで記載してください -->
- 

## アーキテクチャへの影響
<!-- 以下の項目について影響があるかチェックしてください -->
- [ ] Featureの追加・変更
- [ ] AppSettingsの変更
- [ ] Tauriコマンドの追加・変更
- [ ] Window Routeの追加・変更
- [ ] Placeholderの副作用制御 (OS登録回避)

## AI アシスタントへの指示・活用歴
<!-- AIエージェントに指示して開発を進めた場合、以下を埋めてください -->
- 使用した `.agents/skills` やプロンプト: 
- `npm run check` 等でエラーが出た場合の修正内容: 
- Feature state の変更理由 (implemented / partial / placeholder): 
- `docs/ai-quality-rubric.md` 上の未達項目または残存リスク: 

## 実行した検証コマンド
<!-- 以下のコマンドを実行し、パスしたことを確認してください -->
- [ ] `npm run check:quick` (fast TypeScript, Biome, script, AI context, Architecture Verify)
- [ ] `npm run check` (TypeScript, Biome, Vitest, AI context, Architecture Verify, Vite build)
- [ ] `npm run check:all` (full local release gate) ※Rust/Tauri環境がある場合
- [ ] `npm run test:scaffold` (Feature scaffolder smoke test) ※Scaffold変更がある場合
- [ ] `npm run check:tauri` (Rust/Cargo Verify) ※Rust環境がある場合

## スクリーンショット / UI影響
<!-- UIの変更がある場合はスクリーンショットを添付してください -->

## 未確認事項・残存リスク
<!-- AIが作業した場合など、人間のレビューアに特に確認してほしい事項があれば記載してください -->
- 
