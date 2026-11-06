Riftfall Arena — Cloudflare Workers修正

今回のエラー: existing Durable Objects depend on export class MailStore

前回の単一ファイル版には MailStore が欠落していました。
この版は添付された完成版の worker.js と data.js と appearance-data.js を１つにまとめ、
MailStoreを含む既存のDurable Objectクラス8件を維持しています。

手順:
1) Cloudflare Workers > 対象Worker (arkeia-api) > Edit code
2) 既存コードをバックアップ
3) このZIPのworker.jsの全文で置き換え
4) Deploy

wrangler.toml / Durable Object bindings / migrations / secrets を変更しないでください。
Cloudflareのエラー画面から delete-class / rename-class migration を実行しないでください。
本番環境へのデプロイと動作確認は未実施です。
