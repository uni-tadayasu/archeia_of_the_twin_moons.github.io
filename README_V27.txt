Riftfall Arena V27 / 城崎三位 + 運営専用キャラの表示サイズ統一
これは元のゲームZIPとの差分です。各ファイルを同じ相対パスでGitHubへ適用してください。
server/worker.js はCloudflare Workersへデプロイしてください。
GLBはファイル内容を変更せずにコピーしました。
運営/運営長専用キャラはプレイヤーとして表示された際、通常キャラの代表的な大きさに調整します。ボスは対象外です。
歩行/走行/攻撃は元GLBのAnimationClip/ボーン/名前付き個別パーツを優先します。全身一体型の骨格なしGLBでは外形維持を優先し、全体モーションになります。
更新一覧:
 - data.js
 - main.js
 - server/worker.js
 - model-runtime.js
 - gaizorg-adventure.js
 - exact-model-portraits.js
 - index.html
 - kinosaki-motion.js
 - staff-character-scale.js
 - assets/portraits/kinosaki-sanmi.svg
 - assets/models/kinosaki-sanmi-original.glb
