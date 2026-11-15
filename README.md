# 双月のアルケイア — 従来版品質改善

物語・オンライン・イベント共闘・無限天守・拠点攻城戦などを備えた従来のゲームを公開トップに戻し、同じエンジンを磨く版です。公開先は https://www.kasai-solutions-inc.com/ です。

## 今回の方針

`index.html` と `classic.html` は同じ従来ゲームを起動します。既存の戦士・固有技・所有状態・灯晶・同期コード・運営権限・サーバーAPIを引き継ぎ、独立した新しいゲームへの移行は行いません。`arkeia-save-v1` を含む既存の保存キーを継続使用します。

前回の新エンジン版は `rebirth.html` と `rebirth/` に保存しています。その説明は [保存版の説明](docs/REBIRTH.md) にあります。新エンジン版の別セーブを、従来版の通貨や進行へ自動変換しません。

## 品質改善

- 従来のモード・キャラクター選択・戦闘HUD・設定画面をPCとスマートフォン向けに調整。
- Three.js 0.184.0、glTF/Draco/Meshoptの読み込みを同梱ファイルに統一。戦闘の起動に外部3DライブラリCDNを必要としません。
- 既存のCG背景、GLBモデルとモーション、カメラ操作を維持しながら描画の安定性を改善。
- 戦闘終了・召喚解除時のリソース回収、モデル読み込み失敗時の探索復帰を改善。

## 開発・確認

Node.js 22以上を使用します。

```sh
npm run dev
npm run check
npm test
npm ci --ignore-scripts
npx playwright install --with-deps chromium
npm run test:browser
```

`check` は従来版と保存している新エンジン版の構文・参照を確認します。標準のブラウザテストは従来版を起動し、メニュー・選択・実際の3D戦闘・タッチ操作を確認します。CIから本番APIへの操作は遮断し、オンライン経済・運営アカウントを変更しません。オンライン機能の本番接続確認とは別の検証です。

保存版のブラウザ検証は `npm run test:rebirth` で個別に実行できます。

## mainへの自動反映

同一リポジトリの `codex/riftfall-*` ブランチから `main` への非下書きPRを作成すると、`Riftfall Quality` が検証成功後に自動マージし、GitHub Pagesの再ビルドを要求します。PR作成そのものは自動化していません。詳細は [自動反映の説明](docs/AUTOMATION.md) を参照してください。

Three.jsはMIT Licenseです。`assets/vendor/three/LICENSE` を参照してください。
