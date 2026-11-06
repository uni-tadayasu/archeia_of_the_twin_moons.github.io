ガイエン・元モデル忠実表示修正（進化前・進化後）

変更ファイル:
  index.html
  main.js
  game.js
  field.js
  model-runtime.js
  gaien-motion.js
  gaien-style.js

修正内容:
- GLBに収録された2048pxのWebPテクスチャを、ガイエンだけ上下反転せずに復元。
- ガイエンの元GLBの色・金属度・粗さを優先し、他キャラクターの材質設定は維持。
- マダラ模様の原因になり得る追加シェーダーや着色を撤去。
- 歩行中も頂点変形は行わず、モデル全体の小さな歩行揺れだけを使用。
- 変更したJavaScriptをブラウザーが確実に読み込むようキャッシュ識別子を更新。

上書き先: GitHub Pages / Rosebud のゲームフォルダー直下
既存の assets/models/flame-shell-king.glb / flame-shell-titan.glb は
削除しないでください。本ZIPには元モデルのデータ変更はありません。

検査: JavaScript構文、ZIP整合性、GLB内蔵テクスチャ情報を確認。
注意: 実際の公開サイトでの最終描画確認は未実施です。
      元GLBの形状自体の解像度を増やす修正ではありません。
