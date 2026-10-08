# Mint agent guide

- Mint は Tauri のデスクトップ専用アプリです。品質基準は設定画面の900×650・680×520、ライト/ダークテーマ、オーバーレイ実寸。既存の狭幅CSSは維持する。mainは現在リサイズ不可なので、サイズ別確認は `docs/manual-verification.md` の方法で行う。
- 人間向けの応答は、明示的に別言語を指定されない限り日本語で書く。
- 広い調査では `npm run ai:context` を使い、作業に合う `.agents/skills/*/SKILL.md` と必要な参照だけ読む。構成・境界は `docs/architecture.md`、UIは `docs/design-architecture.md`、永続設定の互換性は `docs/migrations.md`、window/権限は `docs/security-capabilities.md`、コマンドと検証範囲は `docs/ai-development.md` を参照する。
- UI/desktop挙動の変更は `npm run tauri -- dev` で実機確認し、対象画面のスクリーンショットを目視確認して不具合を修正・再確認する。サイズ・テーマ・画像・未確認事項を報告する。詳細は `docs/manual-verification.md`。ブラウザmockだけで実機確認済みとしない。
- 新規 feature の初期配線は手作業せず、`npm run scaffold:feature <feature_name> [PascalComponentName]` を使う。
- 静的feature境界、TypeScript/Rust/default/mockの同期、実用的なブラウザmockを守る。feature間と `core/actions` からのfeature参照は公開 `ports` / `types` に限定する。型なしIPC dispatcherや実行時のfeature plugin登録は導入しない。
- React state updaterは純粋に保つ。設定保存・競合制御は既存 `settingsStore.ts` を再利用し、無効・placeholder機能はshortcut登録などのOS副作用を起こさない。shortcut登録は `settings.active_shortcuts()` を使う。
- 変更範囲に合う検証を選ぶ。コードの反復には `npm run check:quick`、広範変更・リリース準備には環境が許す限り `npm run check:all`。包含する子コマンドは重複実行しない。詳細は `docs/ai-development.md`。
- 完了判断は `docs/ai-quality-rubric.md` の適用条件と現在の証拠に基づく。未実行項目・既存の失敗・残存リスクを明記する。
