/* Riftfall Arena V11: model transport, Kraid/Crimson model redirect.
 * Keep all existing model formats (direct GLB, optional legacy split files).
 * Upload your own GLB to assets/models/kraid-lightweight.glb (binary not included).
 */
const DEFAULT_TIMEOUT_MS = 90000;
const KRAID_ORIGINAL = /(^|\/)crimson-swordsman\.glb(?=([?#]|$))/i;
function kraidPath(path) {
  return typeof path === 'string' ? path.replace(KRAID_ORIGINAL, '$1kraid-lightweight.glb') : path;
}
function asURL(value, base) { try { return new URL(value, base); } catch { return null; } }
export function modelURLCandidates(path, moduleURL = null) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('モデルのパスがありません');
  const selected = kraidPath(path);
  const results = [];
  const add = url => {
    if (!url || !['https:', 'http:', 'file:'].includes(url.protocol)) return;
    if (!results.some(u => u.href === url.href)) results.push(url);
  };
  const base = (typeof document !== 'undefined' && document.baseURI) ||
    (typeof location !== 'undefined' && location.href) || null;
  if (base) add(asURL(selected, base));
  if (moduleURL) add(asURL(selected, moduleURL));
  if (!results.length) throw new Error('モデルの公開先URLを組み立てられません');
  return results;
}
function textOf(error) { return error?.message || String(error); }
function isValidGLB(buffer) {
  if (!buffer || buffer.byteLength < 28) return false;
  const v = new DataView(buffer);
  return v.getUint32(0, true) === 0x46546c67
    && v.getUint32(4, true) === 2
    && v.getUint32(8, true) === buffer.byteLength
    && v.getUint32(16, true) === 0x4e4f534a;
}
async function attemptFetch(url, timeout = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url.href, {
      signal: controller.signal,
      credentials: 'same-origin', cache: 'default', redirect: 'follow'
    });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.httpStatus = response.status;
      throw error;
    }
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength < 32) throw new Error('モデルデータが短すぎます');
    return bytes;
  } finally { clearTimeout(timeoutId); }
}
function attemptXHR(url, timeoutMs) {
  if (typeof XMLHttpRequest === 'undefined') return Promise.reject(new Error('XHR未対応'));
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open('GET', url.href, true); req.responseType = 'arraybuffer'; req.timeout = timeoutMs;
    req.onload = () => req.status >= 200 && req.status < 300 && req.response?.byteLength >= 32
      ? resolve(req.response) : reject(new Error(`HTTP ${req.status || 0}`));
    req.onerror = () => reject(new Error('ネットワークエラー'));
    req.ontimeout = () => reject(new Error('通信タイムアウト'));
    req.onabort = () => reject(new Error('通信中断'));
    try { req.send(); } catch (error) { reject(error); }
  });
}
async function legacyParts(path, moduleURL = null) {
  const candidate = modelURLCandidates(path, moduleURL)[0];
  const url = new URL(candidate.href.split(/[?#]/)[0] + '.parts.json');
  let response;
  try { response = await fetch(url.href, { cache: 'default' }); } catch { return null; }
  if (!response.ok) return null;
  const manifest = await response.json();
  if (!Number.isSafeInteger(manifest?.byteLength) || manifest.byteLength < 28 ||
      !Array.isArray(manifest.parts) || manifest.parts.length < 2 || manifest.parts.length > 30) {
    throw new Error('旧分割GLBのマニフェストが不正です');
  }
  const combined = new Uint8Array(manifest.byteLength);
  let offset = 0;
  for (const name of manifest.parts) {
    if (typeof name !== 'string' || !/^[a-z0-9._-]+\.bin$/i.test(name)) throw new Error('分割パスが不正です');
    const partUrl = new URL(name, url);
    const data = await attemptFetch(partUrl);
    if (offset + data.byteLength > combined.length) throw new Error('GLBの結合サイズが不正です');
    combined.set(new Uint8Array(data), offset);
    offset += data.byteLength;
  }
  if (offset !== combined.byteLength || !isValidGLB(combined.buffer)) throw new Error('GLBの結合結果が不正です');
  return combined.buffer;
}
export async function getModelBytes(path, moduleURL = null) {
  const candidates = modelURLCandidates(path, moduleURL);
  const glb = /\.glb(?:[?#]|$)/i.test(String(path));
  const errors = [];
  for (const url of candidates) {
    if (url.protocol === 'file:') {
      errors.push('file:// ではモデルを取得できません。HTTPSで開いてください');
      continue;
    }
    try {
      const bytes = await attemptFetch(url);
      if (glb && !isValidGLB(bytes)) throw new Error('GLBの形式または長さが不正です');
      return bytes;
    } catch (error) {
      errors.push(`${url.pathname} : ${textOf(error)}`);
      if (error?.httpStatus !== 404 && error?.httpStatus !== 403) {
        try {
          const bytes = await attemptXHR(url, 30000);
          if (glb && !isValidGLB(bytes)) throw new Error('GLBの形式が不正です');
          return bytes;
        } catch (xhrError) { errors.push(`XHR: ${textOf(xhrError)}`); }
      }
    }
  }
  if (glb) {
    const oldParts = await legacyParts(path, moduleURL);
    if (oldParts) return oldParts;
  }
  const failure = new Error(`3Dモデルを取得できませんでした。${errors.join(' / ')}`);
  failure.assetURL = candidates[0]?.href || '';
  failure.details = errors;
  throw failure;
}
