# main への自動取り込み

同じリポジトリの `codex/riftfall-*` ブランチから `main` 宛てに Pull Request を作成すると、`Riftfall Quality` が以下を実行します。

1. 提案されたマージ結果で `npm run check`・`npm test`・従来ゲームを起動する Chromium の `npm run test:browser` を実行。ブラウザテストの画像・診断結果は Actions の artifact に保存。
2. すべての成功後、テストしたブランチの SHA と現在の SHA が一致する場合に squash merge。
3. `main` を公開元とする GitHub Pages の再ビルドを明示的に要求。

この仕組みは GitHub のリポジトリ設定にある「Allow auto-merge」が無効でも動作します。PR の作成自体は自動化していません。下書き PR、外部 fork、対象外のブランチは自動マージしません。リポジトリの保護ルールは GitHub 側で適用されます。

実行中に `main` が更新された場合は取り込みを中止します。作業ブランチに最新の `main` を取り込んで push してください。新しい内容で検証が再実行されます。

GitHub Actions に `contents: write` と `pull-requests: write`、Pages 再ビルドには `pages: write` が必要です。組織などの上位設定で禁止されている場合は Actions のエラーを確認してください。Pages を今後カスタム Actions デプロイに変更する場合は、この再ビルドジョブも併せて変更してください。

テストジョブには読み取り権限だけを付与し、書き込み権限のあるマージ・Pages ジョブでは PR のコードを実行しません。自動マージ後の Pages ビルド要求成功は公開完了とは別です。最終的な公開状況は GitHub の Deployments または Pages で確認してください。

`server/` の Cloudflare Worker 配備は既存の `Deploy server` ワークフローで管理します。自動マージにより Worker も変更する場合は、このワークフローの手動実行または明示的な連携が別途必要です。
