Riftfall Arena V36 / 藤原信頼 + 右大臣 / 歩行・走行・腕と脚・攻撃Motion強化

【導入】
・このツールで現在のゲームZIPと添付された traditional chinese official 3d model.glb を選び、変更ファイルZIPを生成してください。
・ZIPを展開し、GitHub Pagesの同じパスに上書きしてください。
・server/worker.js をCloudflare Workersへ再デプロイしてください。
・元GLBはバイナリを一切変更せず、assets/models/fujiwara-nobuyori-original.glb として収録します。
・右大臣モデルとその他の既存モデル・音楽はこのZIPに含めず変更しません。

【藤原信頼】
運営長専用/呪属性・非常に高い能力値。
Shift/I＝呪い: 行動停止と交差鎖。被弾した相手は解除。クールなし。
J＝呪印: ロックオン。敵の最大HPの10%を1秒毎に5回。クールなし（押しっぱなしは再発動を抑制）。
K＝鬼火: 2つの追尾火炎弾、10秒間毎秒HPの1/15ダメージ。
U＝呪いの光: 左から右への両目紫光線。
固定コマンドで使用。HとLはK/Uへの代替入力。

【すべてのモード】
・通常対戦、2人協力、オンライン対戦、オンライン協力、イベント、物語、フィールド、アドベンチャー、運営長の乱入で両キャラが選択可能。
・運営長以外は使用できません。オンライン使用時はWorkerが署名済み権限を検証します。
・乱入では署名付きプロフィールと公開presenceを先に送信し、相手画面にも同キャラを反映します。

【Motion】
元GLBのAnimationsを最優先。
命名された左右上腕・前腕・手首・肩・大腿・膝・足などのボーンを関節として動かします。
名前付きの独立したメッシュ/パーツがある場合は、外形を変えない一時的な関節グループを利用。
骨格のない一体型メッシュでは、原形・色を保つため全体Motionに切替。GLB本体の骨組み追加・再ウェイト付けは行いません。
本体を透明化させたGPU頂点シェーダー差替えは一切使用しません。

【注意】
新規キャラは運営長専用で、Workerのprofile認証でも制限します。
右大臣用FX画像 assets/fx/uda-*-v26.webp を共有するため、原本ZIPに存在することを確認してください。
キャラクター選択の肖像画像は暫定SVGです。3Dモデル本体の外観には影響しません。
新規GLBの骨格の有無はツール内で確認・表示します。別途3Dソフトで手動骨格設定が必要な場合があります。

【変更ファイル】
・data.js
・main.js
・game.js
・model-runtime.js
・gaizorg-adventure.js
・server/worker.js
・udaijin-curse.js
・fujiwara-nobuyori.js
・noble-motion.js
・assets/portraits/fujiwara-nobuyori.svg
・assets/models/fujiwara-nobuyori-original.glb
