# 双月のアルケイア — サーバー設定手順

このフォルダは **Cloudflare Workers** に別途デプロイするサーバーです（ゲーム本体のプレビューでは動きません）。
デプロイして `config.js` の `API_BASE` と `SERVER_PUBKEY_JWK` を設定すると、以下が有効になります。

- 運営・運営長の認証をサーバーで判定（キーのハッシュはサーバーの秘密変数のみ）
- 乱入はサーバー発行の署名付き許可証がないと相手端末が受け付けない
- 招待コードは Durable Object で **原子的に一度だけ** 使用可能
- 同期セーブ・招待コード・購入記録・ギルド・特別イベントはすべて Cloudflare の Durable Object に保存（InstantDB の管理トークン不要）
- Stripe の決済成功 Webhook を署名検証し、購入キャラを解放
- 強化・装備・キャラ使用権をサーバーが検証して署名 → 対戦相手はその値でダメージ・HPを上限チェック

## 1. 署名鍵を作る（1回だけ）

ブラウザのコンソールで実行：

```js
const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const priv = await crypto.subtle.exportKey('jwk', k.privateKey);
const pub = await crypto.subtle.exportKey('jwk', k.publicKey);
console.log('PRIVATE (secretへ):', JSON.stringify(priv));
console.log('PUBLIC (config.jsへ):', JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }));
```

## 2. 秘密変数を登録

```
cd server
npm install
npx wrangler secret put SIGN_PRIVATE_JWK        # 手順1の PRIVATE
npx wrangler secret put PEPPER                  # 長いランダム文字列
npx wrangler secret put OP_KEY_SHA256           # 運営キーの SHA-256
npx wrangler secret put CHIEF_KEY_SHA256        # 運営長キーの SHA-256
npx wrangler secret put STRIPE_WEBHOOK_SECRET   # whsec_...
```

`wrangler.toml` の `ALLOWED_ORIGINS`・`STRIPE_LINKS` を書き換えてから `npm run deploy`。
（GitHub の場合は `.github/workflows/deploy-server.yml` が自動で行います）

## 3. InstantDB について

InstantDB は新規登録を停止しています。サーバーは InstantDB を使わないため設定不要です。
`instant.perms.ts` は参考用に残しています（ゲームのリアルタイム通信は既存の App ID をそのまま使用）。

## 4. Stripe

- Webhook エンドポイント：`https://<worker>/stripe/webhook`、イベント `checkout.session.completed` と `checkout.session.async_payment_succeeded`
- ゲームは支払いリンクに `client_reference_id`（端末ごとの秘密の購入ID）を付けて開きます。
- 購入後、ショップの「購入を確認」でサーバーに問い合わせて解放されます。

## 5. ゲーム側

`config.js`：

```js
export const API_BASE = 'https://arkeia-api.<あなた>.workers.dev';
export const SERVER_PUBKEY_JWK = { kty: 'EC', crv: 'P-256', x: '...', y: '...' };
```

設定後は `OPERATOR_KEY_SHA256` / `CHIEF_KEY_SHA256` / `codeSha256` は使われません（空にして構いません）。

## 限界（正直な注意）

- 対戦はP2P（InstantDB rooms）のため、完全なサーバー権威型ではありません。各端末が受け取るダメージを、
  相手の署名付きプロフィール（サーバー検証済みの強化値）から計算した上限で切り詰めます。
- 灯晶（通貨）や物語の進行は端末内のままです。強化値は上限（UPG_CAP）内に収まることだけをサーバーが保証します。
