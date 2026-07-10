# アップデーター運用

mint は Tauri updater を使い、GitHub Releases の `latest.json` から署名付き更新を取得します。

## 初回設定

1. 署名鍵を生成する。

   ```bash
   npm run tauri -- signer generate --write-keys ~/.tauri/mint.key
   ```

2. 生成された公開鍵を `src-tauri/tauri.conf.json` の `plugins.updater.pubkey` に設定する。
3. 秘密鍵の内容を GitHub Actions の `TAURI_SIGNING_PRIVATE_KEY` secret に登録する。
4. 鍵にパスワードを設定した場合は `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret も登録する。

このリポジトリには開発用に生成した公開鍵が設定されています。秘密鍵はリポジトリへ追加しないでください。鍵を紛失すると、既存インストールへ更新を配布できなくなります。

## リリース

リリース前に、以下の6か所のバージョンを同じ値へ更新します。

- `package.json`
- `package-lock.json`（ルートと `packages[""]`）
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock`

タグとの整合性はローカルでも確認できます。

```bash
npm run check:release-version -- v0.2.0
```

`v` で始まるタグを push すると、`.github/workflows/release.yml` が事前検証を行い、Windows x64・Linux x64・macOS Intel・macOS Apple Silicon の成果物と `latest.json` を生成して GitHub Release の draft を作成します。内容を確認して draft を公開すると、アプリの「更新を確認」から取得できます。

```bash
git tag v0.2.0
git push origin v0.2.0
```

更新ファイルは Tauri の署名検証を通過したものだけインストールされます。GitHub Actions の秘密鍵と `tauri.conf.json` の公開鍵は必ず同じ鍵ペアを使ってください。

## ブラウザでのUI確認

通常のブラウザ表示では「最新バージョン」の状態を返します。更新ありの表示、リリースノート、ダウンロード進捗、再起動フローは次のURLで確認できます。

```text
http://localhost:1420/?mockUpdate=available
```

macOS へ一般配布する場合は、Apple の署名証明書を設定するか、Tauri の案内に従って ad-hoc signing identity を設定してください。Windows のコード署名も、OSの警告を減らすため本番配布前に設定することを推奨します。
