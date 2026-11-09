Riftfall Arena V15 ネプテリオン実装＋クレイドモデル置換＋戦闘軽量化
このZIPは変更されたファイルのみです。既存のゲームルートへ上書きしてください。
GLBの元データは変換・再圧縮していません。

更新：data.js
更新：main.js
更新：model-runtime.js
更新：index.html
更新：game.js
更新：server/worker.js
更新：exact-model-portraits.js
更新：gaizorg-adventure.js
更新：nepterion-water.js
更新：assets/portraits/nepterion.svg
更新：assets/models/nepterion-chief.glb
更新：assets/models/kraid-lightweight.glb

【権限】一般プレイヤー・運営では使用不可。運営長(role=chief)のみ選択可。
Cloudflare Workersをご利用の場合、server/worker.jsをWorkerにも別途デプロイしてください。
技、戦闘性能、ヒット判定、全モードは既存Battleの仕組みに統合。
クレイドのモデル参照先は assets/models/kraid-lightweight.glb です（選択した場合）。
モデル表示方向・アニメーションは元GLBに依存します。ソースモデルは加工していません。
戦闘軽量化：影・スプライト・AI・NPC骨格アニメの更新頻度と描画解像度を最適化（選択時のみ）。
実環境のFPS改善やオンライン対戦での見え方は未測定です。
公開したらブラウザでCtrl+Shift+Rを押して更新してください。