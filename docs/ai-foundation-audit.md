# Mint 開発基盤の監査記録

## 2026-10-08: 指示・Skillsの整理

対象はAGENTS.md 2本とSKILL.md 7本、およびそれらが参照する文書・検証ツール。モデル固有の指示は追加せず、既存7スキルとCodex表示metadataを保持しました。

判断の参考は [OpenAIの記事](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra) と [現行Skillsガイド](https://learn.chatgpt.com/docs/build-skills)。条件付きの参照、明確な発火条件、プロジェクト固有の制約を優先しています。

### 知識の保持先

| 知識 | 所有元 |
|---|---|
| デスクトップ専用、日本語、scaffold初期配線、短い不変条件 | [AGENTS.md](../AGENTS.md) |
| feature/core/design境界、型付きIPC、共有mock、ports/types、保存・非同期制御、OS副作用guard | [architecture.md](architecture.md)・[design-architecture.md](design-architecture.md) |
| Node/Rust環境、開発コマンド、Vitest配置、検証範囲、書式、PR情報 | [ai-development.md](ai-development.md) |
| settings envelope・v0→v1→v2・既存ユーザーonboarding・backup・未来version保護 | [migrations.md](migrations.md) |
| window別最小権限・高影響command・shortcut/autostartのRust所有 | [security-capabilities.md](security-capabilities.md) |
| 実機画像・サイズ・テーマ・focus・再確認・E2Eとの分担 | [manual-verification.md](manual-verification.md) |
| 適用条件付きの完了証拠・未確認事項・残存リスク | [ai-quality-rubric.md](ai-quality-rubric.md) |

共通文書の無条件再読、100点採点、検証コマンドの重複要求を整理しました。foundation検査は文書の固定文言照合から、ファイル・ローカル参照・skill発見metadata・Node/CI/ゲート接続の検査へ変更。scaffold smokeは使い捨てコピーで初期配線・型・lint・architecture・bundleを確認し、アプリ全体のVitestはcheckで一度実行します。

### 現在の検証証拠

| 検証 | 状態 |
|---|---|
| 修正前check:quick | manual-verificationの4つの固定文言がないため失敗 |
| foundation回帰テスト | 9件成功（文言変更許容、壊れた参照・metadata・ゲート・Node同期の検出） |
| skill YAML検証 | skill-creatorのquick_validate.pyで7件成功 |
| check:quick | 成功（foundation 184検査、architecture 323検査を含む） |
| test:scaffold | 成功（生成後337のarchitecture検査・型・lint・bundle、元ソース保持と一時コピー削除も確認） |
| check:all | 成功（foundation回帰9件、Vitest 87ファイル・491件、frontend bundle、scaffold、Rust format・Clippy・124テスト・check） |

Windows、Node 24.15.0、Cargo 1.95.0で実行。隔離コピーのVite buildはサンドボックス内のrealpath権限制限で一度失敗したため、通常権限でtest:scaffoldとcheck:allを確認しました。検証項目の省略や無効化はしていません。

### descriptionの適用範囲の点検

以下はdescriptionと本文の静的点検ケースです。各モデルの自動選択を実行評価した結果ではありません。

| スキル | 対象 | 隣接する非対象 |
|---|---|---|
| create-static-feature | 新しいfeature moduleを追加 | 既存featureの小さな修正 |
| add-tauri-command | IPCの引数・戻り値・command追加 | IPC契約が変わらないRust内部修正 |
| add-overlay-window | windowの追加・権限・起動・lifecycle変更 | 既存overlay内の色や文言の変更 |
| change-mint-ui | Reactの構造・style・操作変更 | READMEの誤字修正 |
| update-settings-schema | 永続settingsの型・default・互換性変更 | 既存設定値をUIで変更 |
| audit-feature | 指定feature/diffの読み取り専用レビュー | 通常の実装依頼を自動でレビュー専用作業に置換 |
| repair-after-review | 指定された指摘・再現可能な検証失敗の修復 | エラーメッセージの説明だけを求める依頼 |

## 残存リスク

- architecture/context抽出はregexベースで、型・文字列IPCや実動作の完全な保証ではありません。
- foundationのfrontmatter/UI検査は必須scalarの基本検査です。完全なYAML構文・descriptionの意味・リンク先の記述内容や見出しanchorを保証しません。
- 各モデルによるskill自動選択の実行evalは未実施。今後の誤発火・未発火を根拠にdescriptionを調整します。
- 今回は指示と検証ツールの変更で、デスクトップUI・実機スクリーンショット・E2Eは未検証。実機確認手順のサイズoverride経路もアプリでの実行確認は未実施です。
- tray・shortcut・windowのplatform差やOS連携は該当変更時に実機確認が必要です。
- resident CPU/RSSの既存証拠はLinux/WebKitGTK release環境での比較です。Windows/macOS、GPU、表示倍率、mode、実機の電力消費に一般化しません。
- Google Calendarの自動同期は5分の鮮度窓と選択fingerprintを使用し、明示sync/retryは即時。window再生成時の通信を抑える既存仕様を保持します。
