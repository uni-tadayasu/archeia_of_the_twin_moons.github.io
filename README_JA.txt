双月のアルケイア / Riftfall Arena — V9.2 起動修正 + 一般キャラ大型化 + 一括強化

対象：V9.1のゲームZIP（現在のGitHub Pages 2026-11-09版）
現在の全ゲームZIPを本ツールへ入力すると、更新されたファイルだけのZIPを生成できます。
元のGLB / 音声 / 画像 / Cloudflare Worker / セーブファイルは修正しません。

■ 変更点
1. threeモジュール解決失敗：index.html の古い modulepreload を除去。
   importmap より前にモジュールが先読みされる不具合を解消。
2. キーがundefinedのときtoLowerCaseでクラッシュする問題の防止。
3. 一般プレイヤー使用可能キャラ（通常ROSTER・購入可能キャラ）の高さを1.3倍。
   運営長/運営専用・隠し召喚キャラのサイズは変更しません。
4. 強化画面の『強化』タブに一括強化ボタンを追加。現在の灯晶で
   各項目を低レベル順に上げ、必要額を確認してから一度に保存します。
   限界突破は自動で実行せず、既存の価格/上限/セーブ形式を保持します。
5. 動的import先のキャラ定義を同じバージョンに揃えて、戦闘/探索/画面で
   キャラサイズと技のデータが食い違わないよう調整。

■ 使用手順
1. riftfall_v92_update_builder.html をWindows Chromeで開く。
2. 現在のゲーム全ファイルを含むZIPを選ぶ。
3. 「更新されたファイルだけのZIPを作成」を押す。
4. ダウンロードした差分ZIPを解凍し、GitHubの同じ名前/パスのファイルを上書きする。
5. GitHub Pagesのデプロイ完了後、Shift+F5で再読み込みする。

■ 更新対象
index.html / arkeia-ui.js / data.js / main.js / game.js / field.js /
maou-abilities.js / boss-abilities.js / exact-model-portraits.js

注意：このファイルは実ゲームZIPそのものではありません。
HTMLツールが入力ZIPを読み込み、変更されたファイルを取り出して修正します。
V9.1以前の古いゲームZIPでは、構成が異なり一部修正できない可能性があります。
確認や警告が表示されたら、元ZIPへ勝手に書き戻すことはありません。
元のリポジトリに戻せるよう、GitHub上で変更前のコミットを控えてください。
