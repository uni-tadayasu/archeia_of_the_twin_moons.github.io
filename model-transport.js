// RF_GRAND_FOUR_20261108 model-transport.js
// Arkeia: model file transport with explicit URL and HTTP diagnostics.
// Use the DOCUMENT location first, not import.meta.url, which can be rewritten
// to a transient blob:/CDN module by browser game hosts.
const DEFAULT_TIMEOUT_MS = 90000;

function asURL(value, base) {
  try { return new URL(value, base); } catch { return null; }
}

export function modelURLCandidates(path, moduleURL = null) {
  if (typeof path !== 'string' || !path.trim()) throw new Error('モデルのパスがありません');
  const candidates = [];
  const add = (candidate) => {
    if (!candidate || !['https:', 'http:', 'file:'].includes(candidate.protocol)) return;
    if (!candidates.some(c => c.href === candidate.href)) candidates.push(candidate);
  };
  const docURL = (typeof document !== 'undefined' && document.baseURI)
    || (typeof location !== 'undefined' && location.href) || null;
  if (docURL) add(asURL(path, docURL));
  if (moduleURL) add(asURL(path, moduleURL));
  if (!candidates.length) throw new Error('モデルの公開先URLを組み立てられません');
  return candidates;
}
function errText(err) { return err?.message || String(err); }

async function attemptFetch(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url.href, {
      signal: controller.signal, credentials: 'same-origin', cache: 'no-store', redirect: 'follow'
    });
    if (!response.ok) {
      const e = new Error(`HTTP ${response.status}`);
      e.httpStatus = response.status;
      throw e;
    }
    const buf = await response.arrayBuffer();
    if (buf.byteLength < 32) throw new Error(`GLBファイルが短すぎます (${buf.byteLength} bytes)`);
    return buf;
  } finally { clearTimeout(timer); }
}

// XHR can be useful on browser-hosted preview pages where window.fetch has
// been wrapped/restricted. It cannot bypass CORS or permissions.
function attemptXHR(url, timeoutMs) {
  if (typeof XMLHttpRequest === 'undefined') return Promise.reject(new Error('XHR未対応'));
  return new Promise((resolve, reject) => {
    const req = new XMLHttpRequest();
    req.open('GET', url.href, true);
    req.responseType = 'arraybuffer';
    req.timeout = timeoutMs;
    req.onload = () => {
      if (req.status < 200 || req.status >= 300) {
        const e = new Error(`HTTP ${req.status || 0}`);
        e.httpStatus = req.status || 0;
        reject(e);
      } else if (!req.response || req.response.byteLength < 32) {
        reject(new Error('GLBデータが空または不完全です'));
      } else resolve(req.response);
    };
    req.onerror = () => reject(new Error('ネットワーク/CORSによる取得失敗'));
    req.ontimeout = () => reject(new Error('通信タイムアウト'));
    req.onabort = () => reject(new Error('通信が中断されました'));
    try { req.send(); } catch (e) { reject(e); }
  });
}

export async function getModelBytes(path, moduleURL = null) {
  const candidates = modelURLCandidates(path, moduleURL);
  const errors = [];
  for (const url of candidates) {
    if (url.protocol === 'file:') {
      errors.push(`${url.href}：file://から直接開いたページでは3Dモデルを取得できません。GitHub PagesなどHTTPSで開いてください`);
      continue;
    }
    try { return await attemptFetch(url, DEFAULT_TIMEOUT_MS); }
    catch (error) {
      if (error?.httpStatus === 404 || error?.httpStatus === 403) {
        errors.push(`${url.href}：HTTP ${error.httpStatus}（公開先にモデルがない、または閲覧禁止）`);
        continue;
      }
      try { return await attemptXHR(url, 90000); }
      catch (xhrError) {
        errors.push(`${url.href}：fetch=${errText(error)} / XHR=${errText(xhrError)}`);
      }
    }
  }
  const message = `3Dモデルを取得できませんでした。${errors.join(' / ')}。公開したサイトから assets/models/ のGLB URLが開けるか確認してください。`;
  const finalError = new Error(message);
  finalError.assetURL = candidates[0]?.href || '';
  finalError.details = errors;
  throw finalError;
}
