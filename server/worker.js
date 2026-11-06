// 双月のアルケイア — 認証・検証サーバー（Cloudflare Workers）
// © KASAI SOLUTIONS INC.
// 役割：運営/運営長の認証、乱入許可、招待コードの原子的な一回使用、同期セーブの保護、
//       Stripe 決済通知の検証と購入キャラの解放、戦闘用ステータス（強化・装備・キャラ）の検証と署名。
// 署名は ECDSA P-256。クライアントは公開鍵（config.js の SERVER_PUBKEY_JWK）で検証します。
import { FIGHTERS, UPGRADES, UPG_CAP, WEAPONS, ARMORS, SUMMONS, LB_MAX, lbMaxLv, lbMul, lbCost } from '../data.js';

const enc = new TextEncoder();
const HEX64 = /^[0-9a-f]{64}$/;
const DAY = 86400000;
const ownValue = (obj, key) => obj && Object.hasOwn(obj, key) ? obj[key] : undefined;

// 残高や集計と操作記録は同じトランザクションで確定する。
// 片方だけ保存して中断すると、再送時に二重反映するため分割しない。
async function writeTogether(storage, entries) {
  await storage.transaction(async (tx) => {
    for (const [key, value] of entries) await tx.put(key, value);
  });
}

// ---------- 共通 ----------
const b64u = (buf) => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function sha256(s) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

let KEYS = null;
async function keys(env) {
  if (KEYS) return KEYS;
  const jwk = JSON.parse(env.SIGN_PRIVATE_JWK);
  const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  KEYS = {
    priv: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']),
    pub: await crypto.subtle.importKey('jwk', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
  };
  return KEYS;
}
async function sign(env, payload) {
  const p = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, (await keys(env)).priv, enc.encode(p));
  return `${p}.${b64u(sig)}`;
}
async function verify(env, tok, type) {
  try {
    if (typeof tok !== 'string' || tok.length > 4000) return null;
    const parts = tok.split('.');
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
    const [p, s] = parts;
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, (await keys(env)).pub, unb64u(s), enc.encode(p));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64u(p)));
    if (data.t !== type || !(data.exp > Date.now())) return null;
    return data;
  } catch {
    return null;
  }
}

// 保存はすべて Cloudflare の Durable Object（InstantDB の管理トークンは不要）
const storeCall = (env, name, body) => doCall(env.STORE.get(env.STORE.idFromName(name)), body);

function cors(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allow = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': allow.includes(origin) ? origin : allow[0] || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
}
const json = (h, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// IP×用途ごとの回数制限（Durable Object で端末をまたいで正確に数える）
async function limited(env, req, bucket, max, windowMs) {
  const ip = req.headers.get('CF-Connecting-IP') || 'x';
  const stub = env.LIMITER.get(env.LIMITER.idFromName(`${bucket}:${ip}`));
  const r = await stub.fetch('https://rl/', { method: 'POST', body: JSON.stringify({ max, windowMs }) });
  return r.status === 429;
}

// ---------- セーブ検証（戦闘用ステータスの算出：クライアントの upgFor と同じ規則） ----------
function statsFor(save, key) {
  const out = { hp: 0, atk: 0, def: 0, flux: 0, over: 0 };
  const lb = Math.max(0, Math.min(LB_MAX, Math.floor(+save?.lb?.[key] || 0)));
  const up = save?.upg?.[key];
  if (up && typeof up === 'object') {
    for (const u of UPGRADES) {
      const lv = Math.max(0, Math.min(lbMaxLv(lb), Math.floor(+up[u.id] || 0)));
      out[u.stat] += lv * u.w * lbMul(lb);
    }
  }
  for (const s in out) out[s] = Math.min(UPG_CAP[s] * (1 + 0.6 * lb), out[s]);
  // 装備は「所持している」ものだけ
  const owned = new Set(Array.isArray(save?.owned) ? save.owned : []);
  const w = WEAPONS.find((x) => x.id === save?.equip?.[key] && owned.has(x.id));
  if (w) for (const s in w.bonus) out[s] += w.bonus[s];
  const a = ARMORS.find((x) => x.id === save?.armor?.[key] && owned.has(x.id));
  if (a) for (const s in a.bonus) out[s] += a.bonus[s];
  out.def = Math.min(18, out.def);
  for (const s in out) out[s] = +out[s].toFixed(2);
  return out;
}
function validateSaveShape(save) {
  if (!save || typeof save !== 'object' || Array.isArray(save)) return false;
  const s = JSON.stringify(save);
  return s.length <= 200000;
}
// 資産総額：手持ち灯晶＋強化・限界突破・装備に注いだ灯晶（クライアントの価格規則と同じ）
function wealthOf(save) {
  let w = Math.max(0, Math.floor(+save?.shards || 0));
  for (const key of Object.keys(save?.upg || {})) {
    if (!ownValue(FIGHTERS, key)) continue;
    const lb = Math.max(0, Math.min(LB_MAX, Math.floor(+save?.lb?.[key] || 0)));
    for (const u of UPGRADES) {
      const lv = Math.max(0, Math.min(lbMaxLv(lb), Math.floor(+save.upg[key]?.[u.id] || 0)));
      w += 20 * lv * (lv + 1); // 1段ごと (段)×40
    }
    for (let i = 0; i < lb; i++) w += lbCost(i);
  }
  const owned = new Set(Array.isArray(save?.owned) ? save.owned : []);
  for (const x of [...WEAPONS, ...ARMORS, ...SUMMONS]) if (owned.has(x.id)) w += x.price || 0;
  return w;
}
// 1時間に稼げる灯晶の上限（報酬の最大値から余裕を持って設定）
const EARN_PER_HOUR = 30000;
const EARN_SLACK = 5000;

// キャラ使用の可否：運営/運営長専用・購入キャラはサーバーで確認
const OP_ONLY = new Set(['seraphel']);
const CHIEF_ONLY = new Set(['chief', 'sovereign', 'sovereign2', 'bloodfiend']);

// ---------- ルート ----------
export default {
  async fetch(req, env) {
    const H = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/stripe/webhook') return await stripeWebhook(req, env);
      if (req.method !== 'POST') return json(H, { error: 'method' }, 405);
      const raw = await req.text();
      if (raw.length > 220000) return json(H, { error: 'too large' }, 413);
      let body;
      try { body = raw ? JSON.parse(raw) : {}; } catch { return json(H, { error: 'bad' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json(H, { error: 'bad' }, 400);
      switch (url.pathname) {
        case '/auth/key': return await authKey(req, env, H, body);
        case '/invite/issue': return await inviteIssue(req, env, H, body);
        case '/invite/redeem': return await inviteRedeem(req, env, H, body);
        case '/invade/ticket': return await invadeTicket(req, env, H, body);
        case '/sync/push': return await syncPush(req, env, H, body);
        case '/sync/pull': return await syncPull(req, env, H, body);
        case '/entitlements': return await entitlements(req, env, H, body);
        case '/profile': return await profile(req, env, H, body);
        case '/guild/create': return await guildRoute(req, env, H, body, 'create');
        case '/guild/get': return await guildRoute(req, env, H, body, 'get');
        case '/guild/join': return await guildRoute(req, env, H, body, 'join');
        case '/guild/leave': return await guildRoute(req, env, H, body, 'leave');
        case '/guild/role': return await guildRoute(req, env, H, body, 'role');
        case '/guild/unban': return await guildRoute(req, env, H, body, 'unban');
        case '/guild/donate': return await guildDonate(req, env, H, body);
        case '/guild/board': return await guildBoardRoute(req, env, H);
        case '/chat/room': return await chatRoom(req, env, H, body);
        case '/chief/sign': return await chiefSign(req, env, H, body);
        case '/chief/event': return await chiefEvent(req, env, H, body);
        case '/chief/current': return await chiefCurrent(req, env, H);
        case '/chief/mail/send': return await chiefMail(req, env, H, body, 'send');
        case '/chief/mail/history': return await chiefMail(req, env, H, body, 'history');
        case '/mail/list': return await playerMail(req, env, H, body, 'list');
        case '/mail/read': return await playerMail(req, env, H, body, 'read');
        case '/mail/claim': return await playerMail(req, env, H, body, 'claim');
        default: return json(H, { error: 'not found' }, 404);
      }
    } catch (err) {
      console.error(err);
      return json(H, { error: 'server' }, 500);
    }
  }
};

// 運営/運営長キー → 役割トークン（キーのハッシュはサーバーの秘密変数にだけ置く）
async function authKey(req, env, H, { key }) {
  if (await limited(env, req, 'auth', 5, 60000)) return json(H, { error: 'locked' }, 429);
  if (typeof key !== 'string' || key.length > 128) return json(H, { error: 'bad' }, 400);
  const h = await sha256(key);
  let r = null;
  if (safeEqual(h, env.CHIEF_KEY_SHA256)) r = 'chief';
  else if (safeEqual(h, env.OP_KEY_SHA256)) r = 'op';
  if (!r) return json(H, { error: 'denied' }, 403);
  return json(H, { token: await sign(env, { t: 'role', r, exp: Date.now() + 12 * 3600000 }) });
}

// 運営長だけが招待コードを発行（コードはサーバーで生成し、ハッシュのみ保存）
async function inviteIssue(req, env, H, { token }) {
  const role = await verify(env, token, 'role');
  if (role?.r !== 'chief') return json(H, { error: 'denied' }, 403);
  if (await limited(env, req, 'issue', 20, 3600000)) return json(H, { error: 'limit' }, 429);
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(12));
  const code = 'OP-' + [0, 1, 2].map((g) => [...b.slice(g * 4, g * 4 + 4)].map((x) => A[x % A.length]).join('')).join('-');
  const h = await hmacHex(env.PEPPER, 'invite:' + code);
  const stub = env.INVITE_LOCK.get(env.INVITE_LOCK.idFromName(h));
  const r = await stub.fetch('https://lock/', { method: 'POST', body: JSON.stringify({ op: 'issue' }) });
  if (r.status !== 200) return json(H, { error: 'server' }, 500);
  return json(H, { code });
}

// 招待コード：Durable Object（コードごとに1つ・直列実行）で一度だけ使用可能にする
async function inviteRedeem(req, env, H, { code }) {
  if (await limited(env, req, 'redeem', 8, 600000)) return json(H, { error: 'limit' }, 429);
  const c = String(code || '').toUpperCase();
  if (!/^OP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) return json(H, { error: 'bad' }, 400);
  const h = await hmacHex(env.PEPPER, 'invite:' + c);
  const stub = env.INVITE_LOCK.get(env.INVITE_LOCK.idFromName(h));
  const r = await stub.fetch('https://lock/', { method: 'POST', body: JSON.stringify({ op: 'redeem' }) });
  if (r.status !== 200) return json(H, { error: 'used or invalid' }, 403);
  return json(H, { token: await sign(env, { t: 'role', r: 'op', exp: Date.now() + 30 * DAY }) });
}

// 乱入：運営/運営長のみ。相手端末が検証する60秒限りの許可証を発行
async function invadeTicket(req, env, H, { token, from, to }) {
  const role = await verify(env, token, 'role');
  if (!role) return json(H, { error: 'denied' }, 403);
  if (typeof from !== 'string' || typeof to !== 'string' || from.length > 40 || to.length > 40) return json(H, { error: 'bad' }, 400);
  if (await limited(env, req, 'invade', 6, 60000)) return json(H, { error: 'limit' }, 429);
  return json(H, { ticket: await sign(env, { t: 'inv', r: role.r, from, to, exp: Date.now() + 60000 }) });
}

// 同期セーブ：コードはサーバーのペッパー付きHMACで鍵化。クライアントからDBへは直接触れない
async function syncKey(env, code) {
  const n = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return n.length === 12 ? hmacHex(env.PEPPER, 'sync:' + n) : null;
}
// 書き込みは同期コードごとの Durable Object で直列化し、版番号(ver)で競合を検出する
// 初回はサーバー導入前の進行分を含むため上限を大きく取る
const FIRST_WEALTH_CAP = 100000000;
async function syncPush(req, env, H, { code, data, base, wid }) {
  if (await limited(env, req, 'syncw', 120, 600000)) return json(H, { error: 'limit' }, 429);
  const h = await syncKey(env, code);
  if (!h || typeof data !== 'string' || data.length > 200000) return json(H, { error: 'bad' }, 400);
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch {
    return json(H, { error: 'bad' }, 400);
  }
  if (!validateSaveShape(parsed)) return json(H, { error: 'bad' }, 400);
  delete parsed.chars; // 購入キャラは決済記録からのみ復元する
  // プレイヤーID(pid)は最初に使った同期コードに固定（他人のpidを名乗るセーブは拒否）
  const ppid = String(parsed.pid || '');
  if (PID_RE.test(ppid) && !(await bindPid(env, ppid, h))) return json(H, { error: 'pid' }, 403);
  const stub = env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(h));
  const r = await stub.fetch('https://sync/', { method: 'POST', body: JSON.stringify({ h, data: parsed, base: Math.floor(+base || 0), wid: String(wid || '') }) });
  return json(H, await r.json(), r.status);
}
async function syncPull(req, env, H, { code }) {
  if (await limited(env, req, 'syncr', 120, 600000)) return json(H, { error: 'limit' }, 429);
  const h = await syncKey(env, code);
  if (!h) return json(H, { error: 'bad' }, 400);
  const row = await syncRow(env, h);
  return json(H, { data: typeof row?.data === 'string' ? row.data : null, ver: row?.ver || 0 });
}
async function syncRow(env, h) {
  const r = await doCall(env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(h)), { op: 'get' });
  return r.data?.row || null;
}

// Stripe：署名を検証し、支払い完了したセッションだけを購入記録にする
async function stripeWebhook(req, env) {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const body = await req.text();
  const sig = req.headers.get('Stripe-Signature') || '';
  const parts = Object.fromEntries(sig.split(',').map((kv) => kv.split('=')));
  const t = +parts.t;
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return new Response('stale', { status: 400 });
  const expect = await hmacHex(env.STRIPE_WEBHOOK_SECRET, `${t}.${body}`);
  const v1s = sig.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  if (!v1s.some((v) => safeEqual(v, expect))) return new Response('bad signature', { status: 400 });
  const ev = JSON.parse(body);
  if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
    const s = ev.data.object;
    const links = JSON.parse(env.STRIPE_LINKS || '{}'); // { "plink_xxx": "crimson" }
    const key = links[s.payment_link];
    const buyer = String(s.client_reference_id || '');
    if (s.payment_status === 'paid' && key && ownValue(FIGHTERS, key) && /^[A-Za-z0-9_-]{16,64}$/.test(buyer)) {
      // 先に購入権限を保存（追加は重複しても1件のまま＝再実行しても安全）。
      // 保存に失敗したら 500 を返し、Stripe の再送で同じ通知を最初からやり直す。
      const b = await hmacHex(env.PEPPER, 'buyer:' + buyer);
      const add = await storeCall(env, 'ent:' + b, { op: 'add', item: key });
      if (add.status !== 200) return new Response('retry', { status: 500 });
      // 権限保存が終わってから「処理済み」を記録
      await storeCall(env, 'sid:' + s.id, { op: 'once' });
    }
  }
  return new Response('ok');
}
async function ownedKeys(env, buyer) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(buyer || ''))) return [];
  const b = await hmacHex(env.PEPPER, 'buyer:' + buyer);
  const r = await storeCall(env, 'ent:' + b, { op: 'get' });
  return [...new Set((Array.isArray(r.data?.v) ? r.data.v : []).filter((k) => ownValue(FIGHTERS, k)))];
}
async function entitlements(req, env, H, { buyer }) {
  if (await limited(env, req, 'ent', 30, 600000)) return json(H, { error: 'limit' }, 429);
  const list = await ownedKeys(env, buyer);
  return json(H, { token: await sign(env, { t: 'ent', keys: list, exp: Date.now() + 7 * DAY }), keys: list });
}

// 戦闘プロフィール：キャラ使用権・強化・装備をサーバーで検証し、上限内の値だけを署名して返す
// 強化・装備はクライアント申告ではなく、サーバーに預けられ資産検証を通った同期セーブから算出する
async function profile(req, env, H, { code, key, role, buyer }) {
  if (await limited(env, req, 'prof', 60, 600000)) return json(H, { error: 'limit' }, 429);
  const h = await syncKey(env, code);
  if (!ownValue(FIGHTERS, key) || !h) return json(H, { error: 'bad' }, 400);
  const row = await syncRow(env, h);
  let save = null;
  try {
    save = row?.data ? JSON.parse(row.data) : null;
  } catch {
    save = null;
  }
  if (!save) save = {}; // 未登録なら強化なしとして署名
  const r = (await verify(env, role, 'role'))?.r || null;
  if (CHIEF_ONLY.has(key) && r !== 'chief') return json(H, { error: 'denied' }, 403);
  if (OP_ONLY.has(key) && !r) return json(H, { error: 'denied' }, 403);
  if (FIGHTERS[key].shop && !(await ownedKeys(env, buyer)).includes(key)) return json(H, { error: 'not purchased' }, 403);
  const u = statsFor(save, key);
  // 証明をプレイヤー(pid)に結びつける：同期コードに固定された pid だけを入れる
  const pid = String(save.pid || '');
  if (!PID_RE.test(pid) || !(await bindPid(env, pid, h))) return json(H, { error: 'nosync' }, 403);
  return json(H, { token: await sign(env, { t: 'prof', k: key, u, p: pid, exp: Date.now() + 2 * 3600000 }) });
}

// ---------- 本人確認（同期コード → サーバー保管セーブの pid。pid は同期コードに固定） ----------
const PID_RE = /^[A-Za-z0-9]{1,24}$/;
const GID_RE = /^[A-Za-z0-9]{8}$/;
const cleanTxt = (v, n) => [...String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim()].slice(0, n).join('');
async function bindPid(env, pid, h) {
  const stub = env.PID_BIND.get(env.PID_BIND.idFromName(pid));
  const r = await stub.fetch('https://bind/', { method: 'POST', body: JSON.stringify({ h }) });
  return r.status === 200;
}
async function whoAmI(env, code, name) {
  const h = await syncKey(env, code);
  if (!h) return null;
  const row = await syncRow(env, h);
  let s = null;
  try { s = row?.data ? JSON.parse(row.data) : null; } catch { s = null; }
  const pid = String(s?.pid || '');
  if (!PID_RE.test(pid) || !(await bindPid(env, pid, h))) return null;
  return { pid, h, name: cleanTxt(name, 12) || '旅人' };
}
const guildStub = (env, gid) => env.GUILD.get(env.GUILD.idFromName('g:' + gid));
const boardStub = (env) => env.GUILD_BOARD.get(env.GUILD_BOARD.idFromName('board'));
async function doCall(stub, body) {
  const r = await stub.fetch('https://do/', { method: 'POST', body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

// ギルド操作：権限・存在・除名履歴はすべてギルドごとの Durable Object（直列実行）で判定
async function guildRoute(req, env, H, body, op) {
  if (await limited(env, req, 'guild', 90, 600000)) return json(H, { error: 'limit' }, 429);
  const me = await whoAmI(env, body.code, body.name);
  if (!me) return json(H, { error: 'nosync' }, 403);
  let gid = String(body.gid || '');
  if (op === 'create') {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    gid = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => A[x % A.length]).join('');
  } else if (!GID_RE.test(gid)) return json(H, { error: 'bad' }, 400);
  const r = await doCall(guildStub(env, gid), {
    op, gid, me: { pid: me.pid, name: me.name },
    name: cleanTxt(body.gname, 16), target: String(body.target || ''), role: String(body.role || ''),
    heir: String(body.heir || ''), reason: cleanTxt(body.reason, 60)
  });
  if (r.data?.dissolved) await doCall(boardStub(env), { op: 'remove', gid });
  else if (op === 'create' && r.status === 200) await doCall(boardStub(env), { op: 'name', gid, gname: r.data.state?.name });
  return json(H, r.data, r.status);
}

// 寄付：同期セーブの灯晶を原子的に減らし、ギルドの累計に加算（失敗時は返金）
async function guildDonate(req, env, H, body) {
  if (await limited(env, req, 'donate', 20, 600000)) return json(H, { error: 'limit' }, 429);
  const me = await whoAmI(env, body.code, body.name);
  if (!me) return json(H, { error: 'nosync' }, 403);
  const gid = String(body.gid || '');
  const amt = Math.floor(+body.amount);
  // 寄付ごとの操作ID：端末が再送しても、各段階（減算・ギルド加算・ランキング）は一度しか反映しない
  const did = String(body.did || '');
  if (!GID_RE.test(gid) || !(amt > 0 && amt <= 1e7) || !/^[A-Za-z0-9_-]{12,40}$/.test(did)) return json(H, { error: 'bad' }, 400);
  const opKey = `don:${me.pid}:${did}`;
  const g = guildStub(env, gid);
  const sync = env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(me.h));
  const chk = await doCall(g, { op: 'get', gid, me: { pid: me.pid, name: me.name } });
  if (chk.status >= 500) return json(H, { error: 'server' }, 500);
  if (chk.status !== 200 || !chk.data?.state?.member) {
    // 減算後に脱退・除名されても、既存操作の結果確認・返金までは続ける。
    const prior = await doCall(sync, { op: 'spend-status', opId: opKey });
    if (prior.status !== 200) return json(H, { error: 'server' }, 500);
    if (!prior.data?.exists) return json(H, { error: 'denied' }, 403);
  }
  const sp = await sync.fetch('https://sync/', { method: 'POST', body: JSON.stringify({ op: 'spend', h: me.h, amt, gid, opId: opKey }) });
  const spent = await sp.json().catch(() => ({}));
  if (sp.status !== 200) return json(H, { error: spent.error || (sp.status >= 500 ? 'server' : 'shards') }, sp.status);
  const d = await doCall(g, { op: 'donate', gid, me: { pid: me.pid, name: me.name }, amt, opId: opKey, replayOnly: !!spent.legacy });
  // 旧版の減算記録にはギルド・金額がない。既に加算済みの結果確認だけ許し、新たな加算には使わない。
  if (spent.legacy) {
    if (d.status !== 200) return json(H, { error: d.status >= 500 ? 'server' : 'donation_legacy' }, d.status >= 500 ? 500 : 409);
    return json(H, { ok: true, dup: true, ver: spent.ver, shards: spent.shards, total: d.data.mine, state: d.data.state });
  }
  if (d.status !== 200) {
    // 5xx は加算の成否が不明なので同じIDで再送する。確定的な拒否だけ元の操作を返金済みにする。
    if (d.status >= 500) return json(H, { error: 'server' }, 500);
    const refund = await doCall(sync, { op: 'refund', gid, amt, opId: opKey });
    if (refund.status !== 200) return json(H, { error: 'server' }, 500);
    return json(H, { error: d.data?.error || 'denied' }, d.status);
  }
  const ranked = await doCall(boardStub(env), { op: 'add', gid, gname: d.data.state.name, amt, members: d.data.state.donors.length, opId: opKey });
  if (ranked.status !== 200) return json(H, { error: 'server' }, 500);
  return json(H, { ok: true, dup: !!spent.dup, ver: spent.ver, shards: spent.shards, total: d.data.mine, state: d.data.state });
}
async function guildBoardRoute(req, env, H) {
  if (await limited(env, req, 'board', 60, 600000)) return json(H, { error: 'limit' }, 429);
  const r = await doCall(boardStub(env), { op: 'top' });
  return json(H, r.data, r.status);
}

// チャンネル別ルーム：参加資格を確認した人にだけ、推測できないルーム名を渡す
async function chatRoom(req, env, H, { code, ch, token, name }) {
  if (await limited(env, req, 'room', 60, 600000)) return json(H, { error: 'limit' }, 429);
  const c = String(ch || '');
  let epoch = 0;
  if (c === 'staff') {
    const role = await verify(env, token, 'role');
    if (role?.r !== 'chief' && role?.r !== 'op') return json(H, { error: 'denied' }, 403);
  } else {
    const me = await whoAmI(env, code, name);
    if (!me) return json(H, { error: 'nosync' }, 403);
    if (c.startsWith('g:')) {
      const gid = c.slice(2);
      if (!GID_RE.test(gid)) return json(H, { error: 'bad' }, 400);
      const r = await doCall(guildStub(env, gid), { op: 'get', gid, me: { pid: me.pid, name: me.name } });
      if (!r.data?.state?.member) return json(H, { error: 'denied' }, 403);
      epoch = Math.max(0, Math.floor(+r.data.state.epoch || 0));
    } else if (/^dm:[A-Za-z0-9]{1,24}:[A-Za-z0-9]{1,24}$/.test(c)) {
      const [, a, b] = c.split(':');
      if (me.pid !== a && me.pid !== b) return json(H, { error: 'denied' }, 403);
    } else return json(H, { error: 'bad' }, 400);
  }
  // 運営会議は STAFF_EPOCH（秘密の環境変数）を変えると、全員のルーム名が切り替わる
  const salt = c === 'staff' ? String(env.STAFF_EPOCH || '0') : String(epoch);
  return json(H, { room: (await hmacHex(env.PEPPER, 'room:' + c + ':' + salt)).slice(0, 40), epoch });
}

// 運営長の公開署名：役職トークンそのものは配らず、内容(ハッシュ)に結びついた再利用不可の署名だけ渡す
async function chiefSign(req, env, H, { token, kind, h, at }) {
  if ((await verify(env, token, 'role'))?.r !== 'chief') return json(H, { error: 'denied' }, 403);
  if (await limited(env, req, 'csign', 60, 600000)) return json(H, { error: 'limit' }, 429);
  if (!['news', 'event'].includes(kind) || !HEX64.test(String(h)) || !(+at > 0 && +at <= Date.now() + 60000)) return json(H, { error: 'bad' }, 400);
  return json(H, { sig: await sign(env, { t: 'cpub', k: kind, h, at: +at, exp: Date.now() + 30 * DAY }) });
}
async function chiefEvent(req, env, H, { token, body, at }) {
  if ((await verify(env, token, 'role'))?.r !== 'chief') return json(H, { error: 'denied' }, 403);
  if (await limited(env, req, 'cevent', 20, 600000)) return json(H, { error: 'limit' }, 429);
  if (typeof body !== 'string' || body.length > 20000 || !(+at > 0 && +at <= Date.now() + 60000)) return json(H, { error: 'bad' }, 400);
  const sig = await sign(env, { t: 'cpub', k: 'event', h: await sha256(body), at: +at, exp: Date.now() + 30 * DAY });
  const r = await storeCall(env, 'chiefevent', { op: 'newer', v: { body, sig, at: +at } });
  return json(H, { ok: !!r.data?.ok, sig });
}
// 現在の運営長の特別イベント（誰でも取得可。受信側は sig を公開鍵で検証）
async function chiefCurrent(req, env, H) {
  if (await limited(env, req, 'ccur', 60, 600000)) return json(H, { error: 'limit' }, 429);
  const r = await storeCall(env, 'chiefevent', { op: 'get' });
  return json(H, { v: r.data?.v || null });
}

// ---------- 運営長のシステムメール・プレゼント ----------
// メール本文は MailStore、既読と受取記録は本人の SyncLock に保存する。
// 受取記録と灯晶・装備は同一トランザクションで確定するため、再送しても二重付与しない。
const MAIL_ID_RE = /^[0-9a-z]{10}_[0-9a-f]{32}$/;
const MAIL_REQUEST_RE = /^[A-Za-z0-9_-]{12,64}$/;
const MAIL_PAGE = 50;
const MAIL_MAX_SHARDS = 999999; // クライアントのセーブ上限と同じ。超過分を切り捨てない。
const MAIL_ITEM_IDS = new Set([...WEAPONS, ...ARMORS].map((x) => x.id));
const mailStub = (env) => env.MAIL_STORE.get(env.MAIL_STORE.idFromName('chief-mail-v1'));
const mailCursor = (value) => value == null || value === '' ? '' : typeof value === 'string' && MAIL_ID_RE.test(value) ? value : null;
function mailText(value, max) {
  if (typeof value !== 'string') return null;
  const s = value.replace(/\r\n?/g, '\n').normalize('NFC').trim();
  return s && [...s].length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s) ? s : null;
}
function mailGift(value) {
  if (value == null) return { shards: 0, items: [] };
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some((key) => !['shards', 'items'].includes(key))) return null;
  const shards = value.shards ?? 0, items = value.items ?? [];
  if (!Number.isSafeInteger(shards) || shards < 0 || shards > MAIL_MAX_SHARDS || !Array.isArray(items) || items.length > 10) return null;
  if (items.some((id) => typeof id !== 'string' || !MAIL_ITEM_IDS.has(id))) return null;
  return { shards, items: [...new Set(items)].sort() };
}
async function chiefMail(req, env, H, body, op) {
  if ((await verify(env, body.token, 'role'))?.r !== 'chief') return json(H, { error: 'denied' }, 403);
  if (!env.MAIL_STORE) return json(H, { error: 'mail_not_ready' }, 503);
  if (await limited(env, req, 'mail-' + op, op === 'send' ? 60 : 120, 3600000)) return json(H, { error: 'limit' }, 429);
  if (op === 'history') {
    const cursor = mailCursor(body.cursor);
    if (cursor === null) return json(H, { error: 'bad' }, 400);
    const r = await doCall(mailStub(env), { op, cursor });
    return json(H, r.data, r.status);
  }
  const requestId = body.requestId, recipient = body.recipient;
  const title = mailText(body.title, 80), text = mailText(body.body, 2000), gift = mailGift(body.gift);
  const expiresAt = body.expiresAt;
  if (typeof requestId !== 'string' || !MAIL_REQUEST_RE.test(requestId) ||
      typeof recipient !== 'string' || (recipient !== 'all' && !PID_RE.test(recipient)) ||
      !title || /\n/.test(title) || !text || !gift || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    return json(H, { error: 'bad' }, 400);
  }
  if (recipient !== 'all') {
    const found = await doCall(env.PID_BIND.get(env.PID_BIND.idFromName(recipient)), { op: 'lookup' });
    if (found.status !== 200) return json(H, { error: 'server' }, 500);
    if (!found.data?.registered) return json(H, { error: 'recipient_notfound' }, 404);
  }
  const message = { recipient, title, body: text, gift, expiresAt, kind: gift.shards || gift.items.length ? 'gift' : 'system', senderName: '運営長' };
  const digest = await sha256(JSON.stringify(message));
  const r = await doCall(mailStub(env), { op, requestId, digest, message });
  return json(H, r.data, r.status);
}
async function playerMail(req, env, H, body, op) {
  if (!env.MAIL_STORE) return json(H, { error: 'mail_not_ready' }, 503);
  if (await limited(env, req, 'mail-user', 240, 600000)) return json(H, { error: 'limit' }, 429);
  const me = await whoAmI(env, body.code);
  if (!me) return json(H, { error: 'nosync' }, 403);
  const sync = env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(me.h));
  if (op === 'list') {
    const cursor = mailCursor(body.cursor);
    if (cursor === null) return json(H, { error: 'bad' }, 400);
    const r = await doCall(mailStub(env), { op, pid: me.pid, cursor });
    if (r.status !== 200) return json(H, r.data, r.status);
    const messages = r.data.messages;
    const state = await doCall(sync, { op: 'mail-state', pid: me.pid, ids: messages.map((m) => m.id) });
    if (state.status !== 200) return json(H, state.data, state.status);
    const states = state.data.states || {};
    return json(H, { ...r.data, pid: me.pid, messages: messages.map((m) => ({ ...m, ...(states[m.id] || { readAt: 0, claimedAt: 0 }) })) });
  }
  if (typeof body.id !== 'string' || !MAIL_ID_RE.test(body.id)) return json(H, { error: 'bad' }, 400);
  const r = await doCall(mailStub(env), { op: 'get', pid: me.pid, id: body.id });
  if (r.status !== 200) return json(H, r.data, r.status);
  const result = await doCall(sync, { op: 'mail-' + op, pid: me.pid, mail: r.data.message });
  return json(H, result.data, result.status);
}

// ---------- Durable Objects ----------
// pid ↔ 同期コードの固定（最初の1件だけ）
export class PidBind {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const { h, op } = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const cur = await this.state.storage.get('h');
      if (op === 'lookup') return new Response(JSON.stringify({ registered: !!cur }));
      if (typeof h !== 'string' || !HEX64.test(h)) return new Response('bad', { status: 400 });
      if (!cur) await this.state.storage.put('h', h);
      else if (cur !== h) return new Response('bound', { status: 409 });
      return new Response('ok');
    });
  }
}
// 配信済みメールは1件ずつ保存。全員宛と個別宛の索引から50件ずつページ取得する。
// 送信IDと本文ハッシュも原子的に保存し、通信切断後の同じ送信を重複配信しない。
export class MailStore {
  constructor(state) { this.state = state; }
  async fetch(req) {
    const b = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const storage = this.state.storage;
      const out = (v, status = 200) => new Response(JSON.stringify(v), { status });
      const now = Date.now();
      const view = (m) => ({ ...m, expired: m.expiresAt <= now });
      if (b.op === 'send') {
        const prior = await storage.get('request:' + b.requestId);
        if (prior) {
          if (prior.digest !== b.digest) return out({ error: 'send_conflict' }, 409);
          const message = await storage.get('m:' + prior.id);
          if (!message) return out({ error: 'server' }, 500);
          return out({ ok: true, duplicate: true, id: message.id, message: view(message) });
        }
        if (!(b.message.expiresAt > now + 60000 && b.message.expiresAt <= now + 90 * DAY)) return out({ error: 'bad' }, 400);
        const id = now.toString(36).padStart(10, '0') + '_' + crypto.randomUUID().replace(/-/g, '');
        const message = { ...b.message, id, createdAt: now };
        const prefix = message.recipient === 'all' ? 'a:' : 'p:' + message.recipient + ':';
        await writeTogether(storage, [
          ['m:' + id, message], [prefix + id, id], ['request:' + b.requestId, { id, digest: b.digest }]
        ]);
        return out({ ok: true, duplicate: false, id, message: view(message) });
      }
      if (b.op === 'get') {
        const message = await storage.get('m:' + b.id);
        if (!message) return out({ error: 'notfound' }, 404);
        if (message.recipient !== 'all' && message.recipient !== b.pid) return out({ error: 'mail_recipient' }, 403);
        return out({ ok: true, message: view(message) });
      }
      if (b.op === 'list' || b.op === 'history') {
        const options = (prefix) => ({ prefix, reverse: true, limit: MAIL_PAGE + 1, ...(b.cursor ? { end: prefix + b.cursor } : {}) });
        let candidates;
        if (b.op === 'history') {
          candidates = [...(await storage.list(options('m:'))).values()];
        } else {
          const global = await storage.list(options('a:'));
          const personal = await storage.list(options('p:' + b.pid + ':'));
          const ids = [...new Set([...global.values(), ...personal.values()])];
          const rows = ids.length ? await storage.get(ids.map((id) => 'm:' + id)) : new Map();
          candidates = [...rows.values()].filter((m) => m.recipient === 'all' || m.recipient === b.pid);
        }
        candidates.sort((a, b) => a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
        const page = candidates.slice(0, MAIL_PAGE);
        return out({ ok: true, messages: page.map(view), nextCursor: candidates.length > MAIL_PAGE ? page.at(-1).id : null, serverTime: now });
      }
      return out({ error: 'bad' }, 400);
    });
  }
}
// ギルド1つ分の状態（メンバー・役職・除名履歴・寄付）
const G_RANK = { master: 3, sub: 2, officer: 1, member: 0 };
export class GuildLock {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const b = await req.json();
    return this.state.blockConcurrencyWhile(() => this.run(b));
  }
  view(g, pid) {
    const mine = ownValue(g.members, pid);
    const member = !!mine;
    const myRank = member ? G_RANK[mine.role] : -1;
    const ban = ownValue(g.bans, pid);
    return {
      gid: g.gid, name: g.name, master: g.master, ver: g.ver, member,
      // チャット鍵の世代：脱退・除名のたびに進み、抜けた人が持つ古いルーム名を無効にする
      epoch: member ? g.epoch || 0 : undefined,
      members: member ? Object.entries(g.members).map(([p, m]) => ({ pid: p, name: m.name, role: m.role })) : [],
      bans: myRank >= 2 ? Object.entries(g.bans).map(([p, x]) => ({ pid: p, name: x.name, by: x.by, reason: x.reason, at: x.at })) : [],
      donors: Object.entries(g.donors).map(([p, x]) => ({ pid: p, name: x.name, total: x.total })).filter((x) => x.total > 0).sort((a, c) => c.total - a.total).slice(0, 100),
      kicked: !member && ban ? { by: ban.by, reason: ban.reason, at: ban.at } : null
    };
  }
  async run(b) {
    const S = this.state.storage;
    const out = (body, status = 200) => new Response(JSON.stringify(body), { status });
    let g = await S.get('g');
    const me = b.me;
    const save = async () => { g.ver = (g.ver || 0) + 1; await S.put('g', g); };
    if (b.op === 'create') {
      if (g) return out({ error: 'exists' }, 409);
      if (!b.name) return out({ error: 'bad' }, 400);
      g = { gid: b.gid, name: b.name, master: me.pid, members: { [me.pid]: { name: me.name, role: 'master', at: Date.now() } }, bans: {}, donors: {}, ver: 0 };
      await save();
      return out({ state: this.view(g, me.pid) });
    }
    if (!g) return out({ error: 'notfound' }, 404);
    const mine = ownValue(g.members, me.pid);
    if (mine && mine.name !== me.name) mine.name = me.name;
    switch (b.op) {
      case 'get':
        return out({ state: this.view(g, me.pid) });
      case 'join': {
        if (ownValue(g.bans, me.pid)) return out({ error: 'banned', state: this.view(g, me.pid) }, 403);
        if (!mine) {
          if (Object.keys(g.members).length >= 100) return out({ error: 'full' }, 409);
          g.members[me.pid] = { name: me.name, role: 'member', at: Date.now() };
          await save();
        }
        return out({ state: this.view(g, me.pid) });
      }
      case 'leave': {
        if (!mine) return out({ state: this.view(g, me.pid) });
        const others = Object.keys(g.members).filter((p) => p !== me.pid);
        if (g.master === me.pid) {
          if (!others.length) {
            await S.deleteAll();
            return out({ dissolved: true });
          }
          if (!others.includes(b.heir)) return out({ error: 'heir' }, 400);
          g.master = b.heir;
          g.members[b.heir].role = 'master';
        }
        delete g.members[me.pid];
        g.epoch = (g.epoch || 0) + 1;
        await save();
        return out({ state: this.view(g, me.pid), heir: g.master });
      }
      case 'role': {
        const tgt = ownValue(g.members, b.target);
        const role = b.role;
        if (!mine || !tgt || b.target === me.pid || !['master', 'sub', 'officer', 'member', 'kick'].includes(role)) return out({ error: 'denied' }, 403);
        const r = G_RANK[mine.role];
        const tr = G_RANK[tgt.role];
        const ok = r === 3 || (r === 2 && tr < 2 && ['officer', 'member', 'kick'].includes(role));
        if (!ok) return out({ error: 'denied' }, 403);
        if (role === 'kick') {
          g.bans[b.target] = { name: tgt.name, by: me.name, reason: b.reason || '', at: Date.now() };
          delete g.members[b.target];
          g.epoch = (g.epoch || 0) + 1;
        } else if (role === 'master') {
          mine.role = 'sub';
          tgt.role = 'master';
          g.master = b.target;
        } else tgt.role = role;
        await save();
        return out({ state: this.view(g, me.pid) });
      }
      case 'unban': {
        if (!mine || G_RANK[mine.role] < 2 || !ownValue(g.bans, b.target)) return out({ error: 'denied' }, 403);
        delete g.bans[b.target];
        await save();
        return out({ state: this.view(g, me.pid) });
      }
      case 'donate': {
        const receiptKey = 'don:' + b.opId;
        const done = b.opId ? await S.get(receiptKey) : null;
        // 個別の操作記録は切り捨てない。古いIDでも再加算せず、旧版の記録も引き継ぐ。
        if (done && (done.pid !== me.pid || done.amt !== b.amt)) return out({ error: 'donation_mismatch' }, 409);
        if (done?.denied) return out({ error: 'denied' }, 403);
        if (done || (b.opId && Array.isArray(g.ops) && g.ops.includes(b.opId))) {
          return out({ state: this.view(g, me.pid), mine: ownValue(g.donors, me.pid)?.total || 0, dup: true });
        }
        if (b.replayOnly) return out({ error: 'donation_legacy' }, 409);
        if (!mine) {
          // 拒否も固定し、別の再送が返金と交差して後から加算されるのを防ぐ。
          await S.put(receiptKey, { pid: me.pid, amt: b.amt, denied: true });
          return out({ error: 'denied' }, 403);
        }
        const d = ownValue(g.donors, me.pid) || (g.donors[me.pid] = { name: me.name, total: 0 });
        d.name = me.name;
        d.total += Math.floor(+b.amt) || 0;
        g.ver = (g.ver || 0) + 1;
        await writeTogether(S, [['g', g], [receiptKey, { pid: me.pid, amt: b.amt }]]);
        return out({ state: this.view(g, me.pid), mine: d.total });
      }
      default:
        return out({ error: 'bad' }, 400);
    }
  }
}
// 全ギルドの寄付総額（サーバー側で集計し、上位だけ返す）
export class GuildBoard {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const b = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const storage = this.state.storage;
      const m = (await storage.get('b')) || {};
      if (b.op === 'top') {
        const list = Object.entries(m).map(([gid, x]) => ({ gid, gname: x.gname, total: x.total, members: x.members })).filter((x) => x.total > 0).sort((a, c) => c.total - a.total).slice(0, 50);
        return new Response(JSON.stringify({ list }));
      }
      if (b.op === 'add') {
        const receiptKey = 'don:' + b.opId;
        const done = b.opId ? await storage.get(receiptKey) : null;
        const oldOps = (await storage.get('ops')) || [];
        if (done && (done.gid !== b.gid || done.amt !== b.amt)) return new Response(JSON.stringify({ error: 'donation_mismatch' }), { status: 409 });
        if (done || (b.opId && oldOps.includes(b.opId))) return new Response(JSON.stringify({ ok: true, dup: true }));
        m[b.gid] = { gname: b.gname, total: (ownValue(m, b.gid)?.total || 0) + b.amt, members: b.members };
        await writeTogether(storage, [['b', m], [receiptKey, { gid: b.gid, amt: b.amt }]]);
        return new Response(JSON.stringify({ ok: true }));
      }
      else if (b.op === 'name' && ownValue(m, b.gid)) m[b.gid].gname = b.gname;
      else if (b.op === 'remove') delete m[b.gid];
      await storage.put('b', m);
      return new Response(JSON.stringify({ ok: true }));
    });
  }
}
// 招待コード1件（コードのハッシュごとに1インスタンス）。状態：未発行 → valid → used
export class InviteLock {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const { op } = await req.json();
    // DOは1インスタンスで直列実行 → 同時に2回使われても成功は1回だけ
    return this.state.blockConcurrencyWhile(async () => {
      const st = await this.state.storage.get('st');
      if (op === 'issue') {
        if (st) return new Response('exists', { status: 409 });
        await this.state.storage.put('st', 'valid');
        await this.state.storage.put('at', Date.now());
        return new Response('ok');
      }
      if (st !== 'valid') return new Response('used or invalid', { status: 409 });
      await this.state.storage.put('st', 'used');
      await this.state.storage.put('usedAt', Date.now());
      return new Response('ok');
    });
  }
}
// 汎用の小さな保存領域（購入記録・決済の重複防止・運営長の特別イベント）
export class Store {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const b = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const s = this.state.storage;
      const cur = await s.get('v');
      const out = (x, status = 200) => new Response(JSON.stringify(x), { status });
      switch (b.op) {
        case 'get':
          return out({ v: cur ?? null });
        case 'once': // 初回だけ成功（Stripe の同じ決済を二重に処理しない）
          if (cur) return out({ ok: false }, 409);
          await s.put('v', true);
          return out({ ok: true });
        case 'add': {
          const l = Array.isArray(cur) ? cur : [];
          if (!l.includes(b.item)) l.push(b.item);
          await s.put('v', l);
          return out({ v: l });
        }
        case 'newer': // 日時が新しい時だけ置き換える
          if (cur && +cur.at >= +b.v?.at) return out({ ok: false });
          await s.put('v', b.v);
          return out({ ok: true });
        default:
          return out({ error: 'bad' }, 400);
      }
    });
  }
}
// 同期セーブ（同期コードのハッシュごとに1インスタンス）：保存・版番号の比較・資産の増え方の検証
export class SyncLock {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const { data, base, op, amt, gid, opId, wid, pid, mail, ids } = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const store = this.state.storage;
      const row = (await store.get('row')) || null;
      const res = (x, status = 200) => new Response(JSON.stringify(x), { status });
      if (op === 'get') return res({ row });
      if (['mail-state', 'mail-read', 'mail-claim'].includes(op)) {
        let save;
        try { save = JSON.parse(row?.data || 'null'); } catch { save = null; }
        if (!save || typeof pid !== 'string' || save.pid !== pid || !PID_RE.test(pid)) return res({ error: 'nosync' }, 403);
        if (op === 'mail-state') {
          if (!Array.isArray(ids) || ids.length > MAIL_PAGE || ids.some((id) => typeof id !== 'string' || !MAIL_ID_RE.test(id))) return res({ error: 'bad' }, 400);
          const keys = ids.flatMap((id) => ['mail:read:' + id, 'mail:claim:' + id]);
          const saved = keys.length ? await store.get(keys) : new Map();
          return res({ ok: true, states: Object.fromEntries(ids.map((id) => [id, {
            readAt: saved.get('mail:read:' + id) || 0,
            claimedAt: saved.get('mail:claim:' + id)?.claimedAt || 0
          }])) });
        }
        if (!mail || !MAIL_ID_RE.test(String(mail.id || '')) || (mail.recipient !== 'all' && mail.recipient !== pid)) return res({ error: 'mail_recipient' }, 403);
        const readKey = 'mail:read:' + mail.id;
        const readAt = (await store.get(readKey)) || Date.now();
        if (op === 'mail-read') {
          await store.put(readKey, readAt);
          return res({ ok: true, id: mail.id, readAt });
        }
        const receiptKey = 'mail:claim:' + mail.id;
        const prior = await store.get(receiptKey);
        // 過去の残高ではなく最新セーブを返す。再送が遅れても、その後の消費や別の受取を戻さない。
        if (prior) return res({ ok: true, id: mail.id, pid, duplicate: true, receipt: prior, data: row.data, ver: row.ver, shards: save.shards });
        if (!(Number.isSafeInteger(mail.expiresAt) && mail.expiresAt > Date.now())) return res({ error: 'expired' }, 410);
        const gift = mailGift(mail.gift);
        if (!gift || (!gift.shards && !gift.items.length)) return res({ error: 'no_gift' }, 409);
        const current = save.shards;
        if (!Number.isSafeInteger(current) || current < 0) return res({ error: 'wealth' }, 422);
        if (current + gift.shards > MAIL_MAX_SHARDS) return res({ error: 'wallet_full' }, 409);
        const owned = new Set(Array.isArray(save.owned) ? save.owned : []);
        const awarded = gift.items.filter((id) => !owned.has(id));
        awarded.forEach((id) => owned.add(id));
        const now = Date.now(), ver = (row.ver || 0) + 1;
        save.shards = current + gift.shards;
        save.owned = [...owned];
        save.syncAt = now;
        const serialized = JSON.stringify(save);
        if (serialized.length > 200000) return res({ error: 'too large' }, 413);
        const receipt = { id: mail.id, shards: gift.shards, items: awarded, claimedAt: now, ver };
        await writeTogether(store, [
          ['row', { ...row, data: serialized, ver, wealth: wealthOf(save), wid: '' }],
          [receiptKey, receipt], [readKey, readAt]
        ]);
        return res({ ok: true, id: mail.id, pid, duplicate: false, receipt, data: serialized, ver, shards: save.shards });
      }
      if (op === 'spend-status') return res({ exists: typeof opId === 'string' && !!(await store.get('op:' + opId)) });
      if (op === 'spend' || op === 'refund') {
        // 操作IDは金額とギルドに固定し、返金も元の記録と一緒に確定する。
        const okId = typeof opId === 'string' && /^[A-Za-z0-9:_-]{8,80}$/.test(opId);
        const a = Math.floor(+amt);
        if (!okId || !GID_RE.test(String(gid || '')) || !Number.isSafeInteger(a) || a <= 0 || a > 1e7) return res({ error: 'bad' }, 400);
        const receiptKey = 'op:' + opId;
        const done = await store.get(receiptKey);
        if (done) {
          if (done.gid === undefined || done.amt === undefined) {
            // 旧版の返金記録も確認し、返金後の減算済み記録を再利用させない。
            if (await store.get('op:r:' + opId)) return res({ error: 'donation_refunded' }, 409);
            if (op === 'refund') return res({ error: 'donation_legacy' }, 409);
            return res({ ...done, dup: true, legacy: true });
          }
          if (done.gid !== gid || done.amt !== a) return res({ error: 'donation_mismatch' }, 409);
          if (op === 'spend') {
            if (done.refunded) return res({ error: 'donation_refunded' }, 409);
            return res({ ...done, dup: true });
          }
          if (done.refunded) return res({ ok: true, refunded: true, dup: true, ver: done.refundVer, shards: done.refundShards });
        }
        if (op === 'refund' && !done) return res({ error: 'bad' }, 409);
        let s;
        try { s = JSON.parse(row?.data || 'null'); } catch { s = null; }
        if (!s) return res({ error: 'nosync' }, 404);
        const cur = Math.max(0, Math.floor(+s.shards || 0));
        if (!Number.isSafeInteger(cur)) return res({ error: 'wealth' }, 422);
        if (op === 'spend' && cur < a) return res({ error: 'shards' }, 402);
        s.shards = op === 'refund' ? cur + a : cur - a;
        const nv = (row.ver || 0) + 1;
        const result = { ok: true, ver: nv, shards: s.shards, gid, amt: a, ...(op === 'refund' ? { refunded: true } : {}) };
        const receipt = op === 'refund' ? { ...done, refunded: true, refundVer: nv, refundShards: s.shards } : result;
        await writeTogether(store, [
          ['row', { ...row, data: JSON.stringify(s), ver: nv, wealth: wealthOf(s), wid: '' }],
          [receiptKey, receipt]
        ]);
        return res(result);
      }
      if (!validateSaveShape(data) || !Number.isSafeInteger(base) || base < 0) return res({ error: 'bad' }, 400);
      const ver = row?.ver || 0;
      const myWid = typeof wid === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(wid) ? wid : '';
      const payload = JSON.stringify(data);
      const digest = myWid ? await sha256(JSON.stringify([base, data])) : '';
      const writeKey = 'write:' + myWid;
      const applied = myWid ? await store.get(writeKey) : null;
      if (applied) {
        // 同じIDで内容を変えると、元の成功を別のデータへの成功と誤認するため拒否する。
        if (applied.digest !== digest) return res({ error: 'wid' }, 400);
        if (row && applied.ver === ver && row.wid === myWid) return res({ ok: true, ver, dup: true });
        // 寄付・他端末の保存などが後続した場合も、元の保存が反映済みだと伝える。
        return res({ conflict: true, data: row?.data || null, ver, wid: row?.wid || '', appliedWid: myWid }, 409);
      }
      if (row && myWid && row.wid === myWid) {
        // 旧版の最新書き込みにも内容チェックを行い、操作記録を補う。
        if (payload !== row.data || base !== ver - 1) return res({ error: 'wid' }, 400);
        await store.put(writeKey, { digest, ver });
        return res({ ok: true, ver, dup: true });
      }
      if (row && base !== ver) {
        // 競合：別の端末が先に更新した → 最新を返し、端末側で合流させる
        return res({ conflict: true, data: row.data, ver, wid: row.wid || '' }, 409);
      }
      const now = Date.now();
      const wealth = wealthOf(data);
      if (!Number.isFinite(wealth) || (!row && wealth > FIRST_WEALTH_CAP)) return res({ error: 'wealth' }, 422);
      let allow = EARN_SLACK;
      if (row) {
        // 許容量は「実際に経過した時間」だけ回復し、使った分は保存して持ち越す
        const prevW = row.wealth ?? wealth;
        const rate = EARN_PER_HOUR + prevW * 0.1; // 1時間あたりの回復量
        const hours = Math.max(0, (now - (row.at || now)) / 3600000);
        const credit = Math.min(rate * 6 + EARN_SLACK, (row.allow ?? EARN_SLACK) + rate * hours);
        const growth = wealth - prevW;
        if (growth > credit) return res({ error: 'wealth' }, 422);
        allow = credit - Math.max(0, growth);
      }
      const nv = ver + 1;
      const writes = [['row', { data: payload, at: now, ver: nv, wealth, allow, wid: myWid }]];
      if (myWid) writes.push([writeKey, { digest, ver: nv }]);
      await writeTogether(store, writes);
      return res({ ok: true, ver: nv });
    });
  }
}
export class Limiter {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const { max, windowMs } = await req.json();
    const now = Date.now();
    const list = ((await this.state.storage.get('t')) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return new Response('limit', { status: 429 });
    list.push(now);
    await this.state.storage.put('t', list);
    return new Response('ok');
  }
}
