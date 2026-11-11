Riftfall Arena V55.1 — 攻城戦全キャラクター検索・イベント戦BGM

変更：
・攻城戦の出撃キャラ・領主の一覧に全キャラクターを表示し、使用権限別に選択を制御。
・名前・ニックネーム・属性から検索可能。未購入や運営権限がないものは非選択。
・攻城戦のBGMはイベント戦と同じ assets/audio/event-theme.mp3 を使用。
・襲撃開始、途中から再開でイベント曲に切り替え、勝敗確定・退出ではタイトル曲に戻す。
・既存の音源再生を流用。音量/ミュート/専用曲の優先順位を維持。曲ファイルの複製はなし。

対象5ファイル：castle-realm-v50.js, assets/rf-character-library-v53.js, server/worker.js, main.js, index.html
導入：ゲームをバックアップした後、更新ファイルを相対パスを保持して上書き。GitHub Pagesに反映。
server/worker.jsをCloudflare Workersにデプロイしてください。

この更新は元モデル・モーション・セーブやBGM音源そのものを書き換えません。
Cloudflare本番での実際の購入権限・決済処理は未検証です。運用前に2アカウントで確認してください。
