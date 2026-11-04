// 運営キー設定。平文キーは置かず、SHA-256ハッシュのみを保持する。
// 変更手順: ブラウザのコンソールで  await ArkeiaOps.hash('新しいキー')  を実行し、
// 出力された文字列を下の値に貼り替える。（初期キーは "abc" — 必ず変更すること）
export const OPERATOR_KEY_SHA256 = 'tadayasu-uni-1996-01-28';
// 運営長キー（運営キーとは別物）。運営長は運営招待コードを発行でき、ルミナリアを使える。
// 初期キーは "password" — 必ず変更すること（変更手順は運営キーと同じ）
export const CHIEF_KEY_SHA256 = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8';
export const MAX_KEY_ATTEMPTS = 5;
export const LOCKOUT_MS = 30000;

// ショップ（課金）設定。url に購入ページのリンクを入れると「購入する」ボタンが開きます。
// codeSha256 は購入者に渡す解放コードのSHA-256（ArkeiaOps.hash('コード') で作成）。空なら入力は受け付けません。
export const SHOP_ITEMS = [
  { key: 'crimson', price: 'Stripeで購入', url: 'https://buy.stripe.com/fZu14o6UI4FHfZ1gD49MY02', codeSha256: '' }
];
