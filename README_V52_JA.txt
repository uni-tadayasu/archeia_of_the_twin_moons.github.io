Riftfall Arena V52 — 拠点機能・一部エラー対策 (2026-11-11)

【同梱ファイル】
server/worker.js
castle-realm-v50.js
README_V52_JA.txt

【修正点】
1. Worker の rf50View の重複 targetPid 定義を整理。
2. Cloudflare Workers で必要な LIMITER / PEPPER 未設定時も、拠点機能が castle_not_ready として安全に失敗するようにする。
3. 拠点画面を開く際、自動で未同期セーブを送信してから残高を読み込む。未同期の灯晶・進行をサーバーの値で上書きする事故を防止。
4. 購入・レベルアップ・攻城戦などで発生する一部のサーバーエラーをゲーム内で分かりやすい文言に変更。

【導入】
1. GitHub上の既存ファイルと、Cloudflare Worker の現在のコードを必ずバックアップしてください。
2. このZIPを解凍し、同名ファイルを上書きしてください。
3. GitHub Pagesの再公開後、server/worker.jsをCloudflare Workersへデプロイしてください。
4. 実際の灯晶を移す前に、テスト用の2アカウントで動作確認してください。

【重要】
構文検査と模擬ロジック検査はしていますが、Cloudflare本番環境のエラーログや操作再現がないため、すべての実行時エラーを解消したと保証するものではありません。
第1版ダンジョンは3Dで歩き回る方式ではなく、階層式の操作パネル方式です。
