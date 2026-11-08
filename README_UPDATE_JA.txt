Riftfall Arena V6 / 差分更新

魔王（運営長専用、光属性、究極光魔法）
通常斬りキー：虹色防御形態30秒、被ダメージ半減、被弾時カンカン音、ひるみ無効。
ガード：30秒自動回復、クールダウンなし、ビリビリ光オーラ、攻撃可能。
復活：HPが0のとき戦闘1回につき1度だけ50％抽選。
技：究極光魔法12種、眼光赤色レーザー、口卵術から追尾する緑分身4体（3回被弾で消滅、HP表示なし）。
H：HP完全回復。L：奥義、覚醒L：秘奥義。

緑のロードUIは起動時と3Dモデル読み込み中に表示。実際の完了件数で進むバーです。

更新ファイル：
index.html
main.js
game.js
data.js
model-runtime.js
server/worker.js
arkeia-ui.js
boss-abilities.js
exact-model-portraits.js
glb-portrait.js
gaizorg-adventure.js
field.js
maou-abilities.js
loading-screen.js
loading-screen.css
assets/portraits/maou-placeholder.svg
assets/models/maou-lord.glb

ゲームZIPのルートと同じ相対パスで上書きしてください。server/worker.js はCloudflare Workersにも別途デプロイしてください。
ユーザー提供の元モデルを再圧縮・再着色・変形していません。
オンラインのダメージ・蘇生の権限/同期は実プレイで要確認。
