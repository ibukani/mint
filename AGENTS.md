# Mint agent guide

- 人間向けの応答は、明示的に別言語を指定されない限り日本語で書く。
- 変更前に `docs/ai-development.md` を読み、広い調査の前に `npm run ai:context` を実行する。UI変更では `docs/design-architecture.md` も読む。
- 新規 feature の初期配線は手作業せず、`npm run scaffold:feature <feature_name> [PascalComponentName]` を使う。
- 静的 feature-module 境界、TypeScript/Rust/mock の型同期、実用的なブラウザ mock、placeholder の OS 副作用禁止を守る。
- 作業に合う `.agents/skills/*/SKILL.md` があれば先に読む。スキル一覧は `npm run ai:context` に表示される。
- 反復中は `npm run check:quick`、引き渡し前は環境が許す限り `npm run check:all` を実行する。UI/desktop挙動は `docs/manual-verification.md` の該当項目も確認する。
- 完了判断は `docs/ai-quality-rubric.md` の適用項目ごとに、現在のコマンド出力・テスト・実動作を証拠にする。未実行項目と残存リスクは明記する。
