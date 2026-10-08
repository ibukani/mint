# Mint 開発ガイド

全体のルールは [AGENTS.md](../AGENTS.md)。この文書はコマンドと検証範囲の入口です。必要な節・参照だけ利用してください。

## 作業別の参照

| 作業 | 参照 |
|---|---|
| 広い調査 | `npm run ai:context`（現在のfeature・settings・windows・IPC・skills・scripts） |
| feature/core境界、設定store、IPC/mock | [architecture.md](architecture.md) |
| UI/CSS、共通部品、動的表示の例外 | [design-architecture.md](design-architecture.md) |
| 永続設定の形式・互換性 | [migrations.md](migrations.md) |
| window追加、権限、高影響command | [security-capabilities.md](security-capabilities.md) |
| UI/desktop挙動の実機確認 | [manual-verification.md](manual-verification.md) |
| 完了時の証拠 | [ai-quality-rubric.md](ai-quality-rubric.md) |

作業固有の手順は `.agents/skills/` にあります。関連するスキルだけ読み、既に読んだ共通文書・コマンドを重複して読み直したり実行したりする必要はありません。

## 環境とコマンド

Node.jsは **22.13.0以上**（[package.json](../package.json)、`.nvmrc`、CIを同期）。Rust/TauriにはRust・Cargo・rustupと対象OSのビルド依存が必要です。WindowsはMSVC Build ToolsとWebView2、LinuxはWebKitGTK等の依存を使用します。CIのインストール手順は [.github/workflows/ci.yml](../.github/workflows/ci.yml)。

| コマンド | 用途 |
|---|---|
| `npm run dev` / `npm run preview` | ブラウザmockでの開発 / frontendビルドの表示 |
| `npm run build` | TypeScriptとViteビルド |
| `npm run tauri -- dev` / `npm run tauri -- build` | デスクトップ開発 / 配布ビルド |
| `npm run test -- <対象>` | Vitestの対象テスト。実装近傍に `*.test.ts` / `*.test.tsx` を置く |
| `npm run check:quick` | TypeScript、Biome、script構文、context/foundation/version、architecture。テスト・bundleは含まない |
| `npm run check` | quickの検査に、foundationの回帰テスト・Vitest・Viteビルドを加える |
| `npm run check:tauri` | Cargo format、Clippy（all-targets）、test、check |
| `npm run test:scaffold` | 隔離コピーでscaffold入力・初期配線・型・lint・architecture・bundleを検証 |
| `npm run check:all` | `check` → `test:scaffold` → `check:tauri` の全体ゲート |
| `npm run check:ai-foundation` / `npm run check:ai-context` | 指示・参照・skills・CI接続 / 生成contextの構造確認 |
| `npm run test:ai-foundation` | foundation検査の回帰テスト |
| `npm run test:e2e` | Windows実バイナリのsmoke。[実行条件](../e2e/README.md) |
| `npm run perf:report` | 性能の前後比較。[実行条件](../performance/README.md) |

Rustの狭いテストは、例として `cargo test --manifest-path src-tauri/Cargo.toml --lib core::migrations`。Cargo等を利用できない場合は実行できなかった検証と理由を報告します。

## 検証範囲

| 変更 | 検証の選び方 |
|---|---|
| 読み取り専用の調査・レビュー | 対象の現在の証拠を確認。コード動作の証明が必要な場合に関連テストを実行 |
| 指示・文書・skillのみ | 参照・metadata・関連コマンドを確認。foundation/contextを変更した場合はその検査と回帰テスト |
| frontendコード | 反復中はquick、動作に対応するVitest、引き渡し時にcheck。UI変更は下記の実機確認も必要 |
| Rustコード | 対象のRustテストとcheck:tauri。TS/IPC/mockに影響すればfrontend検証も追加 |
| settings/IPC契約 | 変更した名前・型・default・互換性・失敗動作をRustとTS/mockで検証 |
| scaffolder / scaffold検証スクリプト | test:scaffold。通常のfeature追加では生成差分とそのfeatureを検証し、scaffoldテストを別途重ねない |
| 広範な変更・リリース準備 | 環境が許す限りcheck:all。変更したdesktop動作、E2E、性能などの該当確認を加える |

親コマンドで検証した子コマンドは再実行不要です。失敗した場合は原因に対応する狭い検証から再確認し、追加変更や未解決の懸念がある場合に範囲を広げます。CSSのみの変更に実装をなぞる新規テストを追加せず、操作・状態・意味が変わる場合に重要な成功/失敗動作をテストします。

UI/desktop挙動を変更した場合は `npm run tauri -- dev` と [実機・スクリーンショット確認](manual-verification.md#ui変更時の必須確認) を実施します。未確認の実機動作を確認済みと扱わないでください。

## Scaffoldとブラウザmock

新規featureの初期配線は `npm run scaffold:feature <feature_name> [PascalComponentName]`。生成内容と追加実装の手順は [create-static-feature](../.agents/skills/create-static-feature/SKILL.md)。`--verbose` は生成ファイルの詳細が必要な場合に利用します。生成された配線はバージョン管理に含めます。

ブラウザでは `src/core/mocks/tauriMock.ts` がTauri APIを自動mock化し、設定保存はlocalStorageを使用します。`?label=<label>` でoverlayを表示でき、feature別 `*IpcMock.ts` のhandlerはVitestと共有します。環境固有の保存・遅延・表示のみ入口で注入します。

## 書式と引き渡し

既存のBiome / rustfmt設定を使用します。TypeScriptは2-space・double quotes・semicolons、React componentはPascalCase、hook/変数はcamelCase。Rustはrustfmt・snake_case。通常の変更でlint設定を再構成しません。

PRには目的・最終的な変更・実行した検証・未確認事項を記載し、UI変更には実機画像と確認条件を添えます。履歴に沿った簡潔なcommit件名を使用し、変更は目的に沿ってまとめます。ログは失敗箇所中心に要約し、`rtk` は利用可能な場合の任意補助です。architectureの成功詳細が必要な場合は `npm run verify:architecture:verbose` を使います。
