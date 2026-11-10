Riftfall Arena V33 / キャラクター一括編集 大容量・分割保存対応

1. HTMLツールをChromeで開き、現在のゲームZIPを選択
2. 「差分ZIP生成」で更新されたファイルのみZIPを保存
3. GitHub Pagesへ main.js, index.html, character-editor.js を上書き
4. Cloudflare Workersへ server/worker.js をデプロイ
5. ゲームをCtrl+Shift+Rで再読み込み。運営長の編集画面で保存

変更概要
- アプリ固有の一括編集保存上限（142KB/150KB）を解消
- 48KiB目標の分割送信。保存中は未公開、全分割データ検証後に一括公開
- Durable Objectへのページ単位格納。旧保存データとの互換あり
- 競合時は版番号を比較しエラー表示
- 保存キャンセルや分割アップロード失敗時に古い公開データを維持
- 既存キャラクターモデル、権限、技、CG画像、BGMを変更しない

注意
- 実物の保存容量はCloudflareの契約・Durable Object・Workerの制限内です。真の無限容量ではありません。
- Cloudflare Workersの更新は必須です。従来のWorkerでは分割保存できません。
- 一括保存前には全データのバックアップを推奨します。
