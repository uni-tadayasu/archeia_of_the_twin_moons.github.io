Riftfall Arena V42 / 起動クラッシュ修正（変更ファイルのみ）

【原因】
V41が main.js の上部で installFujiwaraChief(..., save, ...) を呼び出していたため、
後方で宣言される const save が初期化前に参照される状態でした。
そこで main.js の評価が中断されると、すでに登録されていた右大臣と藤原信頼の
600ms タイマーが未初期化 const state を読み、以下のエラーを繰り返します。
"Uncaught ReferenceError: Cannot access 'state' before initialization"

【修正】
・藤原信頼V41の強さ1〜100%と強化・限界突破設定を維持。
・右大臣、藤原信頼、ネプテリオンの導入処理を save / state / roleState 定義後へ移動。
・モデル、Motion、BGM、他のキャラクターのファイルは変更しません。
・2026年11月10日添付の全データZIPを基準に作成しました。
・以前のV41差分ZIPが上書きしてしまった宇邇宮忠靖親王のキャラ選択・乱入設定を保持。
・main.js のキャッシュ回避のため index.html の参照バージョンも更新。

【適用】
GitHub Pagesのゲームリポジトリ直下へ、以下をそのまま上書きしてください。
  index.html
  main.js
  fujiwara-chief-v39.js
既存の assets/ と server/worker.js は変更不要です。
反映後はCtrl+Shift+Rで強制リロード、またはシークレットウィンドウで確認してください。

【制限】
JavaScript構文・差分整合性は検証済みですが、実際の公開先でのWebGL起動、
オンラインプレイの全機能まで動作保証するものではありません。
