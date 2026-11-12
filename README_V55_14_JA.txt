Riftfall Arena V55.14 — 城内/合戦場・町の暮らし・スマホ音声停止・メニューBGM 更新パック
2026-11-12
対応サイト: https://www.kasai-solutions-inc.com/

【V55.14 に含まれる変更】
1. スマホのバックグラウンドBGMを停止
 - visibilitychange, pagehide, blur, freeze, beforeunload 時に登録済みHTMLMediaElementとWeb AudioContextを停止/休止。
 - 非表示中の遅延play()をブロック。画面復帰時のBGM重複を避ける。
 - 音量、音声、運営・運営長の権限や同期コードは変更しない。
2. メニューBGMをユーザー提供の aishiteirukara.mp3 に変更
 - assets/audio/aishiteirukara.mp3 を新規配置。
 - 既存のメニュー音源 title-theme.mp3 の読み込みを新曲へ転送する。
 - 現在のmain.jsではメニューと「物語導入」のBGMは同じプレーヤーを共有しているため、物語導入にもこの新曲が流れる。
 - 戦闘BGM、ボスBGM、フィールドBGMは変更しない。
3. 戦国時代の城内・合戦場を思わせるオリジナル3D戦闘装飾
 - 門、旗、柱、灯り等を追加。戦闘中の円形床・縁の表示を抑制。
 - 戦闘範囲/敵AI/通信/ランキング/無限天守HP持ち越しの仕様は変更しない。
4. ストーリーの町・建物に入る演出、生活家具、建物別の会話と調べられる小物
 - 町に生成される建物の入口、室内空間を展開。既存の4軒制限を外す。
 - 室内/屋外の切替演出、食卓・工房・本棚などの調べる動作、既存の隠し扉・宝箱を維持。
 - 10種類の家具・会話テーマ。100%異なる新規3D建築を建てる仕様ではない。
5. キャラクターの見た目を改善
 - 既存のスキン、GLB、骨格、モーション、固有外見の扱いを維持。輪郭が粗い装飾メッシュを平滑化。
 - 一般キャラクター100人の「全員が独立した新規GLB」ではなく、既存モデル＋外見バリエーション。
6. モジュール参照とUIの改善
 - ゲーム本体と外見・エフェクト・空間拡張で game.js のURLバージョンが違い、別のクラスにパッチされる問題を修正。
 - iPhone/Android画面の縦横・セーフエリア・テキスト表示を調整。
7. カスタムドメインのCloudflare CORS設定
 - server/wrangler.toml の ALLOWED_ORIGINS に www.kasai-solutions-inc.com を追加。
 - Workersへのデプロイが必要。既存秘密鍵、PEPPER、同期データ、Durable Objectsは変更しない。

【導入】
1. GitHubの公開中の全データをバックアップ。
2. このZIPの階層構造のまま、ルートに含まれるファイルを同名パスへ上書き・追加する。
   index.html / arkeia-ui.js / battle-crash-diagnostics.js / boss-abilities.js /
   character-variants.js / field.js / assets/... / server/wrangler.toml
   のみ（変更のないゲーム本体/モデルファイルは含まない）。
3. assets/audio/aishiteirukara.mp3 は assets/audio/ の中へアップロード。
4. GitHub PagesのActionsで公開反映を確認。
5. server/wrangler.toml を変更したため、Cloudflare WorkersのDeploy serverも成功させる。
6. キャッシュを無効化して再読み込みし、BGM変更・スマホのバックグラウンド停止をチェック。

【確認・注意】
- このZIPは変更ファイルのみ。GitHub上の全ファイルと置き換える「完全なゲーム一式ZIP」ではない。
- JS構文、Chromiumによる疑似音声/室内遷移テスト、10種類の画面幅・高さでのレイアウト検査を実施。
- 実際のiOS Safari/Android端末、実サーバー、オンライン4人戦、全100章の通し検証までは行っていない。
- 3DモデルやThree.jsの内部にはポリゴンが必須。見た目の角ばりを目立たなくすることが目的で、「ポリゴン完全ゼロ」にはできない。
- 継続的なBGMはページ非表示時に止めるが、音声停止を全機種で100%保証するものではない。
- 公開サイトへの直接コミットはこのZIPの生成とは別作業。まだGitHubに反映していない。
