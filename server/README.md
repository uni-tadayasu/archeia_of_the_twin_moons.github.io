# 双月のアルケイア — サーバー設定手順

このフォルダは **Cloudflare Workers** に別途デプロイするサーバーです（ゲーム本体のプレビューでは動きません）。
デプロイして `config.js` の `API_BASE` と `SERVER_PUBKEY_JWK` を設定すると、以下が有効になります。

- 運営・運営長の認証をサーバーで判定（キーのハッシュはサーバーの秘密変数のみ）
- 乱入はサーバー発行の署名付き許可証がないと相手端末が受け付けない
- 招待コードは Durable Object で **原子的に一度だけ** 使用可能
- 運営長からのプレゼント・システムメールを保存し、個別のプレイヤーIDまたは全員へ配信
- プレゼントの受取記録と灯晶・装備を同じトランザクションで保存し、通信再試行時の二重付与を防止
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

## 6. 今回の更新：プレゼント・システムメール

**ゲームのZIPを入れ替えるだけでは、公開済みサーバーに新しい機能は追加されません。**
この更新に含まれる `worker.js` と `wrangler.toml` を同じ Workers プロジェクトへデプロイしてください。
ビルド時に参照するルートの `data.js` と `appearance-data.js` も、このZIPに含まれる版を使ってください。
既存の秘密変数・署名鍵・同期データは引き継ぎます。署名鍵や `PEPPER` を作り直す必要はありません。

`wrangler.toml` に `MAIL_STORE` バインディングと `v4-mail` マイグレーションを追加しています。
既存の `v1`～`v3` マイグレーションは残したまま、次を実行します。

```text
cd server
npm install
npm run deploy
```

`ALLOWED_ORIGINS` には実際のプレイ画面のオリジン（`https://` とホスト名。パスを含めない）を、
必要なものだけカンマ区切りで設定します。GitHub Pages と Rosebud の両方で動かす場合は両方必要です。
Rosebud のプレビューが別ホストの iframe 内で動く場合、その iframe のオリジンも確認してください。
ブラウザに表示されたAPI接続エラーを消すために、無条件の `*` 許可へ変える必要はありません。

### 使える内容

- 送信できる人：サーバーで認証された **運営長のみ**。通常の運営・プレイヤーからの送信は拒否します。
- 宛先：登録済みのプレイヤーID、または全員。表示名が同じでもプレイヤーIDで区別します。
- 全員宛：受取期限内なら、配信後に同期登録したプレイヤーも受け取れます。
- 本文：件名80文字、本文2,000文字まで。HTMLとして実行せず、文章として表示します。
- 有効期限：送信時点から1分より後、最大90日先まで。
- プレゼント：灯晶0～999,999と、武器・防具を合計10種類まで。通貨または装備があればプレゼント扱いです。
- 有料キャラクター、運営権限、運営長専用キャラクター、召喚獣の権限は配布対象に含めません。
- 受取後の灯晶が999,999を超える場合は受取を保留します。超過分を切り捨てることはありません。
- 所持済みの装備は重複して増やしません。別の灯晶への自動換算も行いません。
- 個別宛の本文・既読・受取状態は、その同期コードに紐づく本人だけが取得できます。
- メールはサーバーに保存されるため、送信時に相手がログインしていなくても後から確認できます。

### API一覧（すべてPOST）

| パス | 主な入力 | 結果 |
|---|---|---|
| `/chief/mail/send` | `token`, `requestId`, `recipient`, `title`, `body`, `gift`, `expiresAt` | 確定した配信IDとメール。再送は同じ `requestId` を使用 |
| `/chief/mail/history` | `token`, 任意の `cursor` | 運営長専用の送信履歴。50件ずつ |
| `/mail/list` | `code`, 任意の `cursor` | 本人へのメール、既読・受取状態、次ページのカーソル |
| `/mail/read` | `code`, `id` | 既読日時を保存 |
| `/mail/claim` | `code`, `id` | 受取結果、最新版の同期セーブJSON `data` と版番号 `ver` |

`recipient` は `'all'` またはプレイヤーIDです。`gift` は `{ "shards": 500, "items": ["w0", "a0"] }`
の形で指定し、本文だけのメールでは省略できます。`expiresAt` はミリ秒のUNIX時刻です。
`requestId` は英数字・`_`・`-`の12～64文字。同じIDで異なる内容を送ると409になります。

受取時は本人の同期セーブと操作履歴を原子的に保存します。同じメールの受取を同時に実行しても付与は1回です。
通信が途切れた場合も同じメールIDで再試行できます。再試行の応答には、当時の残高ではなく**最新の同期セーブ**を返します。
既に受け取ったメールの結果確認は期限後も可能です。未受取の期限切れプレゼントは付与しません。
クライアントで送信失敗・サーバー未更新・未設定と表示された場合、送信完了や受取完了として扱いません。

## 限界（正直な注意）

- 対戦はP2P（InstantDB rooms）のため、完全なサーバー権威型ではありません。各端末が受け取るダメージを、
  相手の署名付きプロフィール（サーバー検証済みの強化値）から計算した上限で切り詰めます。
- 通常の戦闘報酬や物語の進行は端末内で算出し、同期時に資産の増え方を検証します。
  運営長のプレゼントはサーバー側で受取・加算します。通常の戦闘自体をサーバー側で再現するものではありません。
