# Mint 開発の完了条件

変更に適用する項目を現在の証拠で確認します。固定の採点や、実施した手順の数で完成度を判断しません。

| 適用条件 | 完了を裏付ける証拠 |
|---|---|
| すべての作業 | 依頼した範囲と結果が一致し、無関係な変更を保護している |
| feature追加・境界変更 | scaffold初期配線、静的登録、feature/core/design所有権、ports/types境界が整合する |
| settings / IPC変更 | TS/Rust/default/mockの契約、旧入力の互換性、重要な成功・失敗動作を検証した |
| 非同期処理・OS連携 | updaterが純粋、古い結果の上書きを防止、無効/placeholder guardと必要なwindow権限が機能する |
| コード・検証ツール変更 | [検証範囲](ai-development.md#検証範囲) に合う検査が通る。親コマンドの成功を子の証拠として利用できる |
| UI / desktop挙動変更 | [手動検証](manual-verification.md#ui変更時の必須確認) に従い、Tauri実機のサイズ・テーマ・操作・スクリーンショットを確認した |
| 文書・skill変更 | 参照先と実装が一致し、descriptionの発火条件と隣接する非対象作業を区別できる |
| 引き渡し | 検証結果・未実行項目と理由・既存の失敗・残存リスクが明記されている |

生成したfeatureの殻、renderのみのテスト、always-success mock、architecture検査の成功だけで依頼した動作の完成を宣言しません。

未確認の実機動作や失敗した適用ゲートは、完了証拠として扱いません。関連する失敗は修正・再確認し、環境や依頼範囲で実行できない検証は明示します。残存リスクは引き渡し報告またはPRに記録し、長期的な基盤リスクは [ai-foundation-audit.md](ai-foundation-audit.md) に記録します。
