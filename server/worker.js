// 双月のアルケイア — 認証・検証サーバー（Cloudflare Workers）
// © KASAI SOLUTIONS INC.
// 役割：運営/運営長の認証、乱入許可、招待コードの原子的な一回使用、同期セーブの保護、
//       Stripe 決済通知の検証と購入キャラの解放、戦闘用ステータス（強化・装備・キャラ）の検証と署名。
// 署名は ECDSA P-256。クライアントは公開鍵（config.js の SERVER_PUBKEY_JWK）で検証します。
import { FIGHTERS, UPGRADES, UPG_CAP, WEAPONS, ARMORS, SUMMONS, LB_MAX, lbMaxLv, lbMul, lbCost } from '../data.js';

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
  // プレイヤーID(pid)は最初に使った同期コードに固定（他人のpidを名乗るセーブは拒否）
  const ppid = String(parsed.pid || '');
  if (PID_RE.test(ppid) && !(await bindPid(env, ppid, h))) return json(H, { error: 'pid' }, 403);
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
    if (s.payment_status === 'paid' && key && FIGHTERS[key] && /^[A-Za-z0-9_-]{16,64}$/.test(buyer)) {
      const first = await storeCall(env, 'sid:' + s.id, { op: 'once' });
      if (first.status === 200) {
        const b = await hmacHex(env.PEPPER, 'buyer:' + buyer);
        await storeCall(env, 'ent:' + b, { op: 'add', item: key });
      }
    }
  }
  return new Response('ok');
}
async function ownedKeys(env, buyer) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(buyer || ''))) return [];
  const b = await hmacHex(env.PEPPER, 'buyer:' + buyer);
  const r = await storeCall(env, 'ent:' + b, { op: 'get' });
  return [...new Set((Array.isArray(r.data?.v) ? r.data.v : []).filter((k) => FIGHTERS[k]))];
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
  if (!GID_RE.test(gid) || !(amt > 0 && amt <= 1e7)) return json(H, { error: 'bad' }, 400);
  const g = guildStub(env, gid);
  const chk = await doCall(g, { op: 'get', gid, me: { pid: me.pid, name: me.name } });
  if (chk.status !== 200 || !chk.data?.state?.member) return json(H, { error: 'denied' }, 403);
  const sync = env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(me.h));
  const sp = await sync.fetch('https://sync/', { method: 'POST', body: JSON.stringify({ op: 'spend', h: me.h, amt }) });
  const spent = await sp.json().catch(() => ({}));
  if (sp.status !== 200) return json(H, { error: spent.error || 'shards' }, sp.status === 402 ? 402 : 409);
  const d = await doCall(g, { op: 'donate', gid, me: { pid: me.pid, name: me.name }, amt });
  if (d.status !== 200) {
    await sync.fetch('https://sync/', { method: 'POST', body: JSON.stringify({ op: 'spend', h: me.h, amt: -amt }) });
    return json(H, { error: d.data?.error || 'denied' }, d.status);
  }
  await doCall(boardStub(env), { op: 'add', gid, gname: d.data.state.name, amt, members: d.data.state.donors.length });
  return json(H, { ok: true, ver: spent.ver, shards: spent.shards, total: d.data.mine, state: d.data.state });
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
    } else if (/^dm:[A-Za-z0-9]{1,24}:[A-Za-z0-9]{1,24}$/.test(c)) {
      const [, a, b] = c.split(':');
      if (me.pid !== a && me.pid !== b) return json(H, { error: 'denied' }, 403);
    } else return json(H, { error: 'bad' }, 400);
  }
  return json(H, { room: (await hmacHex(env.PEPPER, 'room:' + c)).slice(0, 40) });
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

// ---------- Durable Objects ----------
// pid ↔ 同期コードの固定（最初の1件だけ）
export class PidBind {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const { h } = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const cur = await this.state.storage.get('h');
      if (!cur) await this.state.storage.put('h', h);
      else if (cur !== h) return new Response('bound', { status: 409 });
      return new Response('ok');
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
    const member = !!g.members[pid];
    const myRank = member ? G_RANK[g.members[pid].role] : -1;
    const ban = g.bans[pid];
    return {
      gid: g.gid, name: g.name, master: g.master, ver: g.ver, member,
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
    const mine = g.members[me.pid];
    if (mine && mine.name !== me.name) mine.name = me.name;
    switch (b.op) {
      case 'get':
        return out({ state: this.view(g, me.pid) });
      case 'join': {
        if (g.bans[me.pid]) return out({ error: 'banned', state: this.view(g, me.pid) }, 403);
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
        await save();
        return out({ state: this.view(g, me.pid), heir: g.master });
      }
      case 'role': {
        const tgt = g.members[b.target];
        const role = b.role;
        if (!mine || !tgt || b.target === me.pid || !['master', 'sub', 'officer', 'member', 'kick'].includes(role)) return out({ error: 'denied' }, 403);
        const r = G_RANK[mine.role];
        const tr = G_RANK[tgt.role];
        const ok = r === 3 || (r === 2 && tr < 2 && ['officer', 'member', 'kick'].includes(role));
        if (!ok) return out({ error: 'denied' }, 403);
        if (role === 'kick') {
          g.bans[b.target] = { name: tgt.name, by: me.name, reason: b.reason || '', at: Date.now() };
          delete g.members[b.target];
        } else if (role === 'master') {
          mine.role = 'sub';
          tgt.role = 'master';
          g.master = b.target;
        } else tgt.role = role;
        await save();
        return out({ state: this.view(g, me.pid) });
      }
      case 'unban': {
        if (!mine || G_RANK[mine.role] < 2 || !g.bans[b.target]) return out({ error: 'denied' }, 403);
        delete g.bans[b.target];
        await save();
        return out({ state: this.view(g, me.pid) });
      }
      case 'donate': {
        if (!mine) return out({ error: 'denied' }, 403);
        const d = (g.donors[me.pid] ||= { name: me.name, total: 0 });
        d.name = me.name;
        d.total += Math.floor(+b.amt) || 0;
        await save();
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
      const m = (await this.state.storage.get('b')) || {};
      if (b.op === 'top') {
        const list = Object.entries(m).map(([gid, x]) => ({ gid, gname: x.gname, total: x.total, members: x.members })).filter((x) => x.total > 0).sort((a, c) => c.total - a.total).slice(0, 50);
        return new Response(JSON.stringify({ list }));
      }
      if (b.op === 'add') m[b.gid] = { gname: b.gname, total: (m[b.gid]?.total || 0) + b.amt, members: b.members };
      else if (b.op === 'name' && m[b.gid]) m[b.gid].gname = b.gname;
      else if (b.op === 'remove') delete m[b.gid];
      await this.state.storage.put('b', m);
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
    const { data, base, op, amt } = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const store = this.state.storage;
      const row = (await store.get('row')) || null;
      if (op === 'get') return new Response(JSON.stringify({ row }), { status: 200 });
      if (op === 'spend') {
        // サーバー側の通貨消費（寄付など）：残高確認と減算を同じ直列処理内で行う
        let s;
        try { s = JSON.parse(row?.data || 'null'); } catch { s = null; }
        if (!s) return new Response(JSON.stringify({ error: 'nosync' }), { status: 404 });
        const cur = Math.max(0, Math.floor(+s.shards || 0));
        const a = Math.floor(+amt) || 0;
        if (a > 0 && cur < a) return new Response(JSON.stringify({ error: 'shards' }), { status: 402 });
        s.shards = cur - a;
        const nv = (row.ver || 0) + 1;
        await store.put('row', { ...row, data: JSON.stringify(s), ver: nv, wealth: wealthOf(s) });
        return new Response(JSON.stringify({ ok: true, ver: nv, shards: s.shards }), { status: 200 });
      }
      const ver = row?.ver || 0;
      if (row && base !== ver) {
        // 競合：別の端末が先に更新した → 最新を返し、端末側で合流させる
        return new Response(JSON.stringify({ conflict: true, data: row.data, ver }), { status: 409 });
      }
      const now = Date.now();
      const wealth = wealthOf(data);
      const prevW = row ? (row.wealth ?? wealth) : 0;
      const hours = row ? Math.max(0, (now - (row.at || now)) / 3600000) : 0;
      // 時間あたりの上限＋資産に比例した余裕（後半の章ほど報酬が大きいため）
      const allowed = row ? prevW + (EARN_PER_HOUR + prevW * 0.1) * Math.max(hours, 0.25) + EARN_SLACK : FIRST_WEALTH_CAP;
      if (wealth > allowed) return new Response(JSON.stringify({ error: 'wealth' }), { status: 422 });
      const nv = ver + 1;
      await store.put('row', { data: JSON.stringify(data), at: now, ver: nv, wealth });
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
