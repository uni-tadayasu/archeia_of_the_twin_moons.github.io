Riftfall Arena キャラクター編集 V29 — 保存ボタン不具合修正／確認UI
V28が導入済みのゲーム向けに、character-editor.js と character-editor.css だけを更新してください。
既存の小数値で保存イベントが開始しない不具合を修正。
保存・初期化は独自のゲーム内確認画面を表示。入力エラー、サーバー保存中、結果を可視化。
注意: GitHub Pagesのキャッシュにより旧ファイルが残る場合があります。
index.htmlではなく既存のmain.jsがcharacter-editor.jsをバージョン付きで読み込んでいる場合、読み込みURLの ?v= を v29 に更新すると確実です。
