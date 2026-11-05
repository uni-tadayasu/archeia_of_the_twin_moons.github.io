// 署名鍵ペアとペッパーを作成する（手元のPCで1回だけ実行： node server/genkey.mjs  ※Node.js 20以上）
// 出力の「秘密鍵」と「PEPPER」は GitHub Secrets へ、「公開鍵」は config.js の SERVER_PUBKEY_JWK へ。
const c = globalThis.crypto;
const kp = await c.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const priv = await c.subtle.exportKey('jwk', kp.privateKey);
const pub = await c.subtle.exportKey('jwk', kp.publicKey);
const pepper = [...c.getRandomValues(new Uint8Array(32))].map((x) => x.toString(16).padStart(2, '0')).join('');
console.log('\n== SIGN_PRIVATE_JWK（GitHub Secret・絶対に公開しない）==\n' + JSON.stringify(priv));
console.log('\n== PEPPER（GitHub Secret・絶対に公開しない）==\n' + pepper);
console.log('\n== SERVER_PUBKEY_JWK（config.js に貼る・公開してよい）==\n' + JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }));
