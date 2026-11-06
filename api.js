// サーバーAPIの呼び出しと、サーバー署名（ECDSA P-256）の検証
import { API_BASE, SERVER_PUBKEY_JWK } from './config.js';

export const apiEnabled = () => !!(API_BASE && SERVER_PUBKEY_JWK);

export async function api(path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const r = await fetch(API_BASE.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      credentials: 'omit',
      signal: controller.signal
    });
    let data = {};
    try {
      data = await r.json();
    } catch (err) {
      if (controller.signal.aborted || r.ok) throw err;
      /* 空応答 */
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      if (r.ok) throw new Error('Invalid server response');
      data = {};
    }
    // An error response cannot become a successful save because its JSON body
    // contains an unrelated `ok` or `status` field. A 200 response may still
    // explicitly report an application-level refusal with ok:false.
    return { ...data, ok: r.ok && data.ok !== false, status: r.status };
  } finally {
    clearTimeout(timeout);
  }
}

let pubKey = null;
const cache = new Map();
const TOKEN_FORMAT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
function rememberToken(tok, data) {
  if (!cache.has(tok) && cache.size >= 300) cache.delete(cache.keys().next().value);
  cache.set(tok, data);
}
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** 署名トークンを検証して中身を返す（種類・期限も確認）。不正なら null */
export async function verifyToken(tok, type) {
  if (!apiEnabled() || typeof tok !== 'string' || tok.length > 4000 || !TOKEN_FORMAT.test(tok)) return null;
  const hit = cache.get(tok);
  const now = Date.now();
  if (hit !== undefined) return hit && hit.t === type && hit.exp > now ? hit : null;
  try {
    pubKey ||= await crypto.subtle.importKey('jwk', SERVER_PUBKEY_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const [p, s] = tok.split('.');
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, unb64u(s), new TextEncoder().encode(p));
    const value = ok ? JSON.parse(new TextDecoder().decode(unb64u(p))) : null;
    const data = value && typeof value === 'object' && !Array.isArray(value)
      && typeof value.t === 'string' && Number.isSafeInteger(value.exp) ? value : null;
    rememberToken(tok, data);
    return data && data.t === type && data.exp > now ? data : null;
  } catch {
    rememberToken(tok, null);
    return null;
  }
}
