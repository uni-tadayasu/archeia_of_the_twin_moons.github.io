// サーバーAPIの呼び出しと、サーバー署名（ECDSA P-256）の検証
import { API_BASE, SERVER_PUBKEY_JWK } from './config.js';

export const apiEnabled = () => !!(API_BASE && SERVER_PUBKEY_JWK);

export async function api(path, body) {
  const r = await fetch(API_BASE.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
    credentials: 'omit'
  });
  let data = {};
  try {
    data = await r.json();
  } catch {
    /* 空応答 */
  }
  return { ok: r.ok, status: r.status, ...data };
}

let pubKey = null;
const cache = new Map();
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

/** 署名トークンを検証して中身を返す（種類・期限も確認）。不正なら null */
export async function verifyToken(tok, type) {
  if (!apiEnabled() || typeof tok !== 'string' || tok.length > 4000) return null;
  const hit = cache.get(tok);
  const now = Date.now();
  if (hit !== undefined) return hit && hit.t === type && hit.exp > now ? hit : null;
  try {
    pubKey ||= await crypto.subtle.importKey('jwk', SERVER_PUBKEY_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const [p, s] = tok.split('.');
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, unb64u(s), new TextEncoder().encode(p));
    const data = ok ? JSON.parse(new TextDecoder().decode(unb64u(p))) : null;
    if (cache.size > 300) cache.clear();
    cache.set(tok, data);
    return data && data.t === type && data.exp > now ? data : null;
  } catch {
    cache.set(tok, null);
    return null;
  }
}
