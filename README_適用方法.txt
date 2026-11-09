Riftfall Arena V17 骨格生成/固定7技/氷結ガード/クレイド軽量GLB
このZIPは変更されたファイルのみです。既存のゲームルートへ上書きしてください。
GLBの元データは変換・再圧縮していません。

更新：data.js
更新：main.js
更新：index.html
更新：net.js
更新：server/worker.js
更新：nepterion-fixed-seven.js
更新：character-motion.js
更新：nepterion-water.js
更新：assets/models/nepterion-chief.glb
更新：assets/models/kraid-lightweight.glb

【権限】一般プレイヤー・運営では使用不可。運営長(role=chief)のみ選択可。
Cloudflare Workersをご利用の場合、server/worker.jsをWorkerにも別途デプロイしてください。
ネプテリオンのガード入力で30秒の水魔法陣。押し直しで30秒更新、クールダウンなし。
魔法陣に触れた敵は水色になり、約2.6秒間氷結拘束。陣内は拘束を延長します。
クレイド・ネプテリオンの歩行・走行・攻撃・魔法動作。元GLBに骨格がなければゲーム内で13ボーン＋スキンウェイトを自動生成。
ネプテリオンは通常5技・奥義・秘奥義の合計7技。数字1〜7を固定し、K/U/H/Lは固定対応。ローテーションなし。
技、戦闘性能、ヒット判定、全モードは既存Battleの仕組みに統合。
クレイドのモデル参照先は assets/models/kraid-lightweight.glb です（選択した場合）。
モデル表示方向・アニメーションは元GLBに依存します。ソースモデルは加工していません。
戦闘軽量化：影・スプライト・AI・NPC骨格アニメの更新頻度と描画解像度を最適化（選択時のみ）。
実環境のFPS改善やオンライン対戦での見え方は未測定です。
公開したらブラウザでCtrl+Shift+Rを押して更新してください。