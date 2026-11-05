// 双月のアルケイア — 認証・検証サーバー（Cloudflare Workers）
// © KASAI SOLUTIONS INC.
// 役割：運営/運営長の認証、乱入許可、招待コードの原子的な一回使用、同期セーブの保護、
//       Stripe 決済通知の検証と購入キャラの解放、戦闘用ステータス（強化・装備・キャラ）の検証と署名。
// 署名は ECDSA P-256。クライアントは公開鍵（config.js の SERVER_PUBKEY_JWK）で検証します。
import { FIGHTERS, UPGRADES, UPG_CAP, WEAPONS, ARMORS, LB_MAX, lbMaxLv, lbMul, lbCost } from '../data.js';

const enc = new TextEncoder();
const HEX64 = /^[0-9a-f]{64}$/;
const DAY = 86400000;

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
    const [p, s] = tok.split('.');
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, (await keys(env)).pub, unb64u(s), enc.encode(p));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64u(p)));
    if (data.t !== type || !(data.exp > Date.now())) return null;
    return data;
  } catch {
    return null;
  }
}

// InstantDB 管理HTTP API（管理トークンはサーバーの秘密変数のみ。権限ルールを越えて読み書きできる）
const id = () => crypto.randomUUID();
function dbOf(env) {
  const call = async (path, body) => {
    const r = await fetch(`https://api.instantdb.com/admin/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.INSTANT_ADMIN_TOKEN}`, 'App-Id': env.INSTANT_APP_ID },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`instant ${path} ${r.status}`);
    return r.json();
  };
  const tx = new Proxy({}, { get: (_, ns) => new Proxy({}, { get: (_, eid) => ({ update: (attrs) => ['update', ns, eid, attrs] }) }) });
  return {
    tx,
    query: (q) => call('query', { query: q }),
    transact: (step) => call('transact', { steps: [step] })
  };
}

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
  if (!save || typeof save !== 'object') return false;
  const s = JSON.stringify(save);
  return s.length <= 200000;
}
// 資産総額：手持ち灯晶＋強化・限界突破・装備に注いだ灯晶（クライアントの価格規則と同じ）
function wealthOf(save) {
  let w = Math.max(0, Math.floor(+save?.shards || 0));
  for (const key of Object.keys(save?.upg || {})) {
    if (!FIGHTERS[key]) continue;
    const lb = Math.max(0, Math.min(LB_MAX, Math.floor(+save?.lb?.[key] || 0)));
    for (const u of UPGRADES) {
      const lv = Math.max(0, Math.min(lbMaxLv(lb), Math.floor(+save.upg[key]?.[u.id] || 0)));
      w += 20 * lv * (lv + 1); // 1段ごと (段)×40
    }
    for (let i = 0; i < lb; i++) w += lbCost(i);
  }
  const owned = new Set(Array.isArray(save?.owned) ? save.owned : []);
  for (const x of [...WEAPONS, ...ARMORS]) if (owned.has(x.id)) w += x.price || 0;
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
      const body = raw ? JSON.parse(raw) : {};
      switch (url.pathname) {
        case '/auth/key': return await authKey(req, env, H, body);
        case '/invite/issue': return await inviteIssue(req, env, H, body);
        case '/invite/redeem': return await inviteRedeem(req, env, H, body);
        case '/invade/ticket': return await invadeTicket(req, env, H, body);
        case '/sync/push': return await syncPush(req, env, H, body);
        case '/sync/pull': return await syncPull(req, env, H, body);
        case '/entitlements': return await entitlements(req, env, H, body);
        case '/profile': return await profile(req, env, H, body);
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
  const db = dbOf(env);
  await db.transact(db.tx.opinvites[id()].update({ h, used: false, at: Date.now() }));
  return json(H, { code });
}

// 招待コード：Durable Object（コードごとに1つ・直列実行）で一度だけ使用可能にする
async function inviteRedeem(req, env, H, { code }) {
  if (await limited(env, req, 'redeem', 8, 600000)) return json(H, { error: 'limit' }, 429);
  const c = String(code || '').toUpperCase();
  if (!/^OP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) return json(H, { error: 'bad' }, 400);
  const h = await hmacHex(env.PEPPER, 'invite:' + c);
  const stub = env.INVITE_LOCK.get(env.INVITE_LOCK.idFromName(h));
  const r = await stub.fetch('https://lock/', { method: 'POST', body: JSON.stringify({ h }) });
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
const FIRST_WEALTH_CAP = 300000;
async function syncPush(req, env, H, { code, data, base }) {
  if (await limited(env, req, 'sync', 40, 600000)) return json(H, { error: 'limit' }, 429);
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
  const stub = env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(h));
  const r = await stub.fetch('https://sync/', { method: 'POST', body: JSON.stringify({ h, data: parsed, base: Math.floor(+base || 0) }) });
  return json(H, await r.json(), r.status);
}
async function syncPull(req, env, H, { code }) {
  if (await limited(env, req, 'sync', 40, 600000)) return json(H, { error: 'limit' }, 429);
  const h = await syncKey(env, code);
  if (!h) return json(H, { error: 'bad' }, 400);
  const row = await syncRow(env, h);
  return json(H, { data: typeof row?.data === 'string' ? row.data : null, ver: row?.ver || 0 });
}
async function syncRow(env, h) {
  const res = await dbOf(env).query({ syncsaves: { $: { where: { h } } } });
  return res?.syncsaves?.[0] || null;
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
    if (s.payment_status === 'paid' && key && FIGHTERS[key] && /^[A-Za-z0-9_-]{16,64}$/.test(buyer)) {
      const db = dbOf(env);
      const dup = await db.query({ entitlements: { $: { where: { sid: s.id } } } });
      if (!dup?.entitlements?.length) {
        const b = await hmacHex(env.PEPPER, 'buyer:' + buyer);
        await db.transact(db.tx.entitlements[id()].update({ b, key, sid: s.id, at: Date.now() }));
      }
    }
  }
  return new Response('ok');
}
async function ownedKeys(env, buyer) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(buyer || ''))) return [];
  const b = await hmacHex(env.PEPPER, 'buyer:' + buyer);
  const res = await dbOf(env).query({ entitlements: { $: { where: { b } } } });
  return [...new Set((res?.entitlements || []).map((e) => e.key).filter((k) => FIGHTERS[k]))];
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
  if (!FIGHTERS[key] || !h) return json(H, { error: 'bad' }, 400);
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
  return json(H, { token: await sign(env, { t: 'prof', k: key, u, exp: Date.now() + 2 * 3600000 }) });
}

// ---------- Durable Objects ----------
export class InviteLock {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(req) {
    const { h } = await req.json();
    // DOは1インスタンスで直列実行 → 同時に2回使われても成功は1回だけ
    return this.state.blockConcurrencyWhile(async () => {
      if (await this.state.storage.get('used')) return new Response('used', { status: 409 });
      const db = dbOf(this.env);
      const res = await db.query({ opinvites: { $: { where: { h } } } });
      const row = res?.opinvites?.[0];
      if (!row || row.used) {
        await this.state.storage.put('used', true);
        return new Response('invalid', { status: 404 });
      }
      await this.state.storage.put('used', true);
      await db.transact(db.tx.opinvites[row.id].update({ used: true, usedAt: Date.now() }));
      return new Response('ok');
    });
  }
}
// 同期セーブの直列化：版番号の比較と資産の増え方の検証
export class SyncLock {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }
  async fetch(req) {
    const { h, data, base } = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const db = dbOf(this.env);
      const row = await syncRow(this.env, h);
      const ver = row?.ver || 0;
      if (row && base !== ver) {
        // 競合：別の端末が先に更新した → 最新を返し、端末側で合流させる
        return new Response(JSON.stringify({ conflict: true, data: row.data, ver }), { status: 409 });
      }
      const now = Date.now();
      const wealth = wealthOf(data);
      const allowed = row ? (row.wealth ?? wealth) + EARN_PER_HOUR * ((now - (row.at || now)) / 3600000) + EARN_SLACK : FIRST_WEALTH_CAP;
      if (wealth > allowed) return new Response(JSON.stringify({ error: 'wealth' }), { status: 422 });
      const nv = ver + 1;
      await db.transact(db.tx.syncsaves[row?.id || id()].update({ h, data: JSON.stringify(data), at: now, ver: nv, wealth }));
      return new Response(JSON.stringify({ ok: true, ver: nv }), { status: 200 });
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
