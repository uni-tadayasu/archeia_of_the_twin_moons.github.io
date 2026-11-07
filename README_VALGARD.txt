ヴァルガルド氷属性／単一形態 更新差分 (2026-11-07)

1. このZIPの中身をゲームのルートに上書き／追加します。
2. 同じチャットにアップロードされた iron-warlord.glb を、ゲームの assets/models/ に置きます。
   ダウンロードしたiron-warlord.glbをINSTALL_MODEL.batと同じフォルダーに入れてBATを実行しても配置できます。
3. GitHub Pagesへフォルダー構成を保ったまま公開します。
4. オンラインで運営長キャラを認証するには、cloudflare_worker_optional.jsを既存Workerへ適用し再デプロイする必要があります。
   既存のCloudflare WorkerとDurable Objectをバックアップしてから行ってください。
5. Ctrl+Shift+Rで更新を確認してください。
6. 旧ガイエンの参照はコードから排除されています。公開先の古い画像・GLB・BGMは削除して構いません。
   ※ 削除候補: assets/models/flame-shell-king.glb / assets/models/flame-shell-titan.glb / assets/face-gaien.webp / assets/face-gaien2.webp / assets/audio/gaien-theme.mp3 / gaien-motion.js / gaien-style.js

新キャラ: 氷鋼覇王ヴァルガルド（運営長専用、進化なし）
技: 凍牙・氷鋼砕 / 白銀氷鎧突 / 零度氷槍陣 / 氷葬流星群
奥義: 極氷皇界《エターナル・ゼロ》
BGM: 以前のgaien-theme.mp3を同一バイトのvalgard-theme.mp3として収録。全世界の認証済み出現通知で優先再生。

注意: 本ZIPには新しい3Dモデル iron-warlord.glb の本体は含まれていません。
      元のアップロード済みGLBを別途配置する必要があります。
      選択画像は氷鋼の紋章で、実GLBの外観レンダリングではありません。
      サーバーと全オンラインクライアントの更新前はBGM同時切替できません。
