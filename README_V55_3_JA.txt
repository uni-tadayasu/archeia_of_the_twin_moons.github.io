Riftfall Arena V55.3 統合更新版（運営長限定・CPU1〜100％）

変更内容
1. 攻城戦: 拠点名を初回建設時に設定、建設済み拠点はいつでも改名可能。1〜20文字。
2. 攻城戦: 5/10/20/50レベル・買える最大数の一括強化。Lv100まで。残高と価格はCloudflare Worker上で検証し1回の原子的処理で保存。固定段数で不足なら消費なし。
3. スマホ: 入力中に自動拡大する問題を防ぎ、キーボードを閉じた後の表示を回復。操作によるピンチズームは常時禁止しません。
4. CPU: 運営長だけが1〜100％で全体のCPU強さを変更。一般・運営は閲覧のみ。サーバー側で署名付き役職を検証。
   ・100％は従来と同じ強さ。HP・攻撃力・CPU AIの倍率を全モードのCPUキャラクターに適用。
   ・他プレイヤーの手動操作キャラは対象外。オンライン協力戦のAI、無限天守、イベント戦にも反映。
   ・攻城戦はWorker側で開始時の設定を記録し、戦闘中の表示・ダメージ・HPへ適用。
   ・無限天守の公式世界ランキングはCPU100％で開始・継続した記録のみ。1〜99％は練習扱い。
   ・運営長だけが設定を変更できるのはWorkerのPOST /settings/cpu で署名検証するためです。

ダウンロードする差分ZIPのファイル:
- main.js
- game.js
- rf-event-coop-v552.js
- castle-realm-v50.js
- server/worker.js
- index.html
- rf-mobile-input-v553.js（新規）
- README_V55_3_JA.txt

導入手順
1. 同梱の「Riftfall_V55_3_統合更新ZIP生成.html」をPCのChromeで開きます。
2. 「GitHubの最新版から生成」を選ぶと公開済みmainブランチの対象6ファイルを読み取り、自動で差分を作ります。
   失敗する場合は「手元の最新ゲームZIPから生成」を利用してください。V55.2適用済みソースが必要です。
3. 生成されたRiftfall_V55_3_..._CHANGED_ONLY.zipを展開し、その中の変更ファイルをリポジトリの同じ階層に上書き、追加してください。
4. Cloudflare Workersのserver/worker.jsを別途デプロイしてください。GitHub PagesへのアップロードだけではAPIは更新されません。
5. キャッシュ更新: PCはCtrl+Shift+R。スマホはタブを完全に閉じて開き直してください。

注意事項
- 既存モデル(GLB)、BGM、モーション、セーブデータ、V55.2追加モードは変更しません。
- GitHub自体への自動書き込みは行いません。
- 本番のCloudflare Durable Objects、4人同時接続、iOS/Android実機での統合動作は未検証です。
- Browser側CPU強さは、不正なコード改変を完全に防ぐサーバー権威方式ではありません。管理設定の変更権限はWorkerで保護されています。


SNSアイコン・OGP共有設定 (V55.3)
・SNS表示タイトル: 双月のアルケイア｜無料オンラインアクションRPG
・サイト概要: 双つの月が照らす幻想世界へ。個性豊かな戦士を育て、剣と魔法で壮大な冒険へ。物語、イベント戦、最大4人協力、無限天守に挑戦！PC・スマホ対応、インストール不要で無料プレイ。
・共有URL: https://uni-tadayasu.github.io/archeia_of_the_twin_moons.github.io/
・画像: assets/site-icon-512.png、assets/site-icon-192.png、assets/apple-touch-icon.png、favicon.ico
・manifest.webmanifest 更新済み。index.html 内のog:image、twitter:imageは公開URLからの絶対HTTPS URL。
・各SNSのキャッシュにより、投稿直後は古いプレビューが出ることがあります。
・公開URLが変わったら、この生成ツールでURLを修正してindex.htmlを生成し直してください。
