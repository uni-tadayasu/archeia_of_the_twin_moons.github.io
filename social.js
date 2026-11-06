// 交流機能：画面上部のお知らせテロップ・世界／ギルド／フレンド／運営会議チャット・ギルド
// サーバー（config.js の API_BASE）設定時：ギルドの存在・役職・除名・寄付・チャンネル参加資格・運営長の署名はすべてサーバーで検証。
// 未設定時：端末内判定の簡易モード（改ざん耐性なし。寄付は不正防止のため停止）。
import { connectSocial, saveChiefEvent, loadChiefEvent, guildDonors, guildBoard, joinChannel } from './net.js';
import { apiEnabled, api, verifyToken } from './api.js';

const serverMode = () => apiEnabled();

// ---------- UI確認ダイアログ（ブラウザのconfirmは使わない） ----------
// 戻り値：通常は true/false。extra.select / extra.input を渡すと選択・入力値（キャンセル時は null）
let dlgSeq = 0;
function uiConfirm(text, okLabel = 'はい', danger = false, extra = {}) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const n = ++dlgSeq;
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(5,6,14,.72);display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:auto';
    const box = document.createElement('div');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', `uic-t${n}`);
    box.style.cssText = 'max-width:380px;width:100%;background:linear-gradient(#1b1830,#100e1e);border:1px solid rgba(214,180,106,.7);border-radius:12px;padding:18px;color:#f3ead2;font-size:15px;line-height:1.6;box-shadow:0 10px 40px rgba(0,0,0,.6);text-align:center';
    const p = document.createElement('div');
    p.id = `uic-t${n}`;
    p.textContent = text;
    p.style.cssText = 'margin-bottom:14px;white-space:pre-wrap';
    box.append(p);
    let field = null;
    const fs = 'width:100%;box-sizing:border-box;margin-bottom:14px;padding:8px;border-radius:6px;border:1px solid #5a5080;background:#1c1c3a;color:#f4ead2;font-size:15px';
    if (extra.select) {
      field = document.createElement('select');
      for (const [v, l] of extra.select) {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = l;
        field.append(o);
      }
    } else if (extra.input) {
      field = document.createElement('input');
      field.type = 'text';
      field.maxLength = extra.input.max || 60;
      field.placeholder = extra.input.placeholder || '';
    }
    if (field) {
      field.style.cssText = fs;
      field.setAttribute('aria-label', extra.label || extra.input?.placeholder || '選択');
      if (extra.label) {
        const lb = document.createElement('div');
        lb.textContent = extra.label;
        lb.style.cssText = 'text-align:left;font-size:13px;color:#cfc4a8;margin-bottom:4px';
        box.append(lb);
      }
      box.append(field);
    }
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;justify-content:center';
    const mk = (label, bg) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = `flex:1;padding:10px;border-radius:8px;border:1px solid rgba(214,180,106,.6);background:${bg};color:#fff;font-size:15px;cursor:pointer`;
      return b;
    };
    const no = mk('キャンセル', '#2a2740');
    const ok = mk(okLabel, danger ? '#8a2330' : '#7a5a1e');
    const result = (yes) => (field ? (yes ? field.value : null) : yes);
    let closed = false;
    const done = (v) => {
      if (closed) return;
      closed = true;
      ov.remove();
      window.removeEventListener('keydown', key, true);
      if (prev && prev.isConnected && typeof prev.focus === 'function') prev.focus();
      resolve(v);
    };
    const key = (e) => {
      e.stopPropagation(); // ゲームの操作に流さない（ボタン・入力の既定動作はそのまま）
      if (e.key === 'Escape') {
        e.preventDefault();
        done(result(false));
      } else if (e.key === 'Enter' && field && e.target === field && field.tagName === 'INPUT') {
        // 入力欄でのEnterだけ承認。ボタン上のEnterは、そのボタン自身の動作になる
        e.preventDefault();
        done(result(true));
      } else if (e.key === 'Tab') {
        // フォーカスをダイアログ内に閉じ込める
        const f = [field, no, ok].filter(Boolean);
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus();
      }
    };
    no.addEventListener('click', () => done(result(false)));
    ok.addEventListener('click', () => done(result(true)));
    ov.addEventListener('click', (e) => { if (e.target === ov) done(result(false)); });
    window.addEventListener('keydown', key, true);
    row.append(no, ok);
    box.append(row);
    ov.append(box);
    document.body.append(ov);
    // 初期フォーカスは入力欄、なければ常に「キャンセル」
    (field || no).focus();
  });
}
export { uiConfirm };

// ---------- エラー・通知 ----------
const ERR = {
  offline: 'オンラインに接続できていません。「再接続」を押してから再試行してください。',
  nosync: 'サーバーでの本人確認に「端末間同期」が必要です。同期コードを設定し、一度同期してから操作してください。',
  notfound: 'そのギルドは存在しません。コードを確認してください。',
  banned: 'このギルドから除名されているため加入できません。',
  denied: 'その操作の権限がありません。',
  heir: '後継者を選んでください。',
  full: 'ギルドが満員です（100人まで）。',
  shards: '灯晶が足りません。',
  limit: '操作が多すぎます。少し待ってから再試行してください。',
  net: 'サーバーに接続できませんでした。通信を確認して再試行してください。',
  transfer: '後継者側での譲渡完了を確認できませんでした。相手がオンラインか確認して再試行してください。',
  exists: '作成に失敗しました。もう一度お試しください。',
  pid: '本人確認に失敗しました。',
  sync: '寄付の前に記録を同期できませんでした。通信を確認し、しばらくしてから再試行してください。',
  storage: '寄付の確認情報を端末に保存できませんでした。ブラウザの保存設定や空き容量を確認してください。',
  donation_pending: '前回の寄付の処理結果を先に確認してください。',
  donation_mismatch: '前回の寄付と内容が一致しません。記録を同期し、残高を確認してから再試行してください。',
  donation_refunded: '前回の寄付は取り消され、返金されています。記録を同期して残高を確認してください。',
  donation_legacy: '以前の寄付結果を確認できません。記録を同期して残高を確認してください。',
  bad: '入力内容が正しくありません。',
  server: 'サーバーでエラーが発生しました。時間をおいて再試行してください。'
};
const err = (code) => Object.assign(new Error(code), { code });
const errMsg = (e) => ERR[e?.code] || ERR.server;
function gnote(t) {
  S.gnote = t;
  sys('guild', t);
  if (!S.panel.hidden) renderGuild();
}
function needOnline() {
  if (!S.net) throw err('offline');
}
// 二重操作防止：処理中は全てのギルド操作ボタンを無効化
async function busy(fn) {
  if (S.busy) return;
  S.busy = true;
  renderGuild();
  try {
    await fn();
  } catch (e) {
    console.warn(e);
    gnote(errMsg(e));
  } finally {
    S.busy = false;
    if (!S.panel.hidden) renderAll();
  }
}
function btn(label, fn, extraDisabled = false) {
  const b = el('button', 'cp-b', label);
  b.type = 'button';
  b.disabled = !!S.busy || extraDisabled;
  b.addEventListener('click', () => busy(fn));
  return b;
}
async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ---------- サーバーAPI（同期コードで本人確認） ----------
async function gapi(path, body = {}) {
  needOnline();
  const code = S.opts.syncCode?.() || '';
  if (code.length !== 12) throw err('nosync');
  let r;
  try {
    r = await api(path, { code, name: S.opts.myName(), ...body });
  } catch {
    throw err('net');
  }
  if (!r.ok) throw Object.assign(err(r.error || 'server'), { data: r });
  return r;
}

// ---------- ギルド寄付とランキング ----------
// 結果不明の寄付は再読み込み後も同じ操作として確認する。
// プレイヤーと同期コードで分け、別の記録の操作IDを再利用しない。
const donationIdentity = () => ({ pid: String(S.opts.save.pid || ''), code: String(S.opts.syncCode?.() || '').toUpperCase().replace(/[^A-Z0-9]/g, '') });
const donationStorageKey = (p) => `arkeia-guild-donation:${p.pid}:${p.code}`;
function pendingDonation() {
  const id = donationIdentity();
  if (!/^[A-Za-z0-9]{8,24}$/.test(id.pid) || id.code.length !== 12) return null;
  let p = S.pendingDon;
  try {
    p = JSON.parse(localStorage.getItem(donationStorageKey(id)) || 'null');
  } catch {}
  return p && p.pid === id.pid && p.code === id.code && /^[A-Za-z0-9]{8}$/.test(p.gid)
    && /^[A-Za-z0-9_-]{12,40}$/.test(p.did) && Number.isSafeInteger(p.amt) && p.amt > 0 && p.amt <= 1e7
    ? p : null;
}
function rememberDonation(p) {
  try { localStorage.setItem(donationStorageKey(p), JSON.stringify(p)); }
  catch { throw err('storage'); } // 保存できない時は送信しない
  S.pendingDon = p;
}
function forgetDonation(p) {
  if (S.pendingDon?.did === p.did) S.pendingDon = null;
  try {
    const key = donationStorageKey(p);
    const stored = JSON.parse(localStorage.getItem(key) || 'null');
    if (stored?.did === p.did) localStorage.removeItem(key);
  } catch (e) { console.warn(e); }
}
function renderDonate(g) {
  const { save } = S.opts;
  const G = save.guild;
  const box = el('div');
  box.style.cssText = 'border-top:1px solid rgba(214,180,106,.35);margin-top:6px;padding-top:6px;display:grid;gap:4px';
  box.append(el('b', null, '灯晶の寄付'));
  if (!serverMode()) {
    box.append(el('div', 'cp-mem', '寄付は不正防止のため、サーバー接続時のみ利用できます（現在はサーバー未設定）。'));
  } else {
    const pending = pendingDonation();
    if (pending) box.append(el('div', 'cp-note', `ギルド「${clean(pending.gname || pending.gid, 16)}」への灯晶 ${pending.amt.toLocaleString()} の寄付結果を確認してください。確認が済むまで、新しい寄付は行いません。`));
    const r = el('div', 'row');
    const inp = el('input');
    inp.type = 'number';
    inp.min = 1;
    inp.step = 100;
    inp.placeholder = `寄付額（手持ち ${save.shards}）`;
    inp.setAttribute('aria-label', '寄付額');
    inp.style.flex = '1';
    if (pending) { inp.value = String(pending.amt); inp.disabled = true; }
    const b = btn(pending ? '前回の結果を確認' : '寄付', async () => {
      const previous = pendingDonation();
      const amt = previous ? previous.amt : Math.floor(+inp.value);
      if (!(amt > 0)) throw err('bad');
      // 再送確認では、既に減算されている場合があるため現在の残高だけでは拒否しない。
      if (!previous && amt > save.shards) throw err('shards');
      needOnline();
      const gname = previous ? clean(previous.gname || previous.gid, 16) : G.name;
      const question = previous
        ? `ギルド「${gname}」への灯晶 ${amt.toLocaleString()} の寄付について、前回の処理結果を確認しますか？`
        : `ギルド「${gname}」に灯晶 ${amt.toLocaleString()} を寄付しますか？\n（取り消しできません）`;
      if (!(await uiConfirm(question, previous ? '結果を確認する' : '寄付する', !previous))) return;
      // 確認画面を開いている間に別タブで操作が始まった時も、そのIDを捨てない。
      const latest = pendingDonation();
      if (latest?.did !== previous?.did) throw err('donation_pending');
      let pd = previous;
      if (!pd) {
        const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        pd = { ...donationIdentity(), gid: G.id, gname: G.name, amt, did: [...crypto.getRandomValues(new Uint8Array(20))].map((x) => A[x % A.length]).join('') };
        rememberDonation(pd);
      }
      let res;
      try {
        const operation = () => gapi('/guild/donate', { gid: pd.gid, amount: pd.amt, did: pd.did });
        // 同期・寄付・残高の反映をmain側の同じ排他処理で行う。
        if (S.opts.runServerSpend) res = await S.opts.runServerSpend(amt, operation);
        else {
          res = await operation();
          S.opts.onServerSpend?.(amt, res.ver);
        }
      } catch (e) {
        // 確定的な拒否だけ解除。通信・混雑・同期失敗など結果不明の時は同じIDを残す。
        if (['bad', 'banned', 'denied', 'notfound', 'shards', 'nosync', 'pid', 'donation_mismatch', 'donation_refunded', 'donation_legacy'].includes(e?.code)) forgetDonation(pd);
        throw e;
      }
      forgetDonation(pd);
      if (res.state) applyState(res.state, true);
      S.opts.sfx?.('burst');
      if (amt >= 1000 && !previous) S.api.news(`${S.opts.myName()} がギルド「${gname}」に灯晶 ${amt} を寄付した！`);
      S.rankCache = null;
      gnote(`${previous ? '前回の寄付を確認しました。' : '寄付しました！'}あなたの累計：灯晶 ${(+res.total || 0).toLocaleString()}`);
    });
    r.append(inp, b);
    box.append(r);
  }
  const tabs = el('div', 'row');
  for (const [k, n] of [['member', 'メンバー寄付ランキング'], ['guild', 'ギルドランキング']]) {
    const t = el('button', 'cp-b', n);
    t.type = 'button';
    t.setAttribute('aria-pressed', String((S.rankView || 'member') === k));
    if ((S.rankView || 'member') === k) t.style.outline = '1px solid #ffd36a';
    t.addEventListener('click', () => { S.rankView = k; renderAll(); });
    tabs.append(t);
  }
  const rankBox = el('div');
  rankBox.style.cssText = 'display:grid;gap:2px';
  box.append(tabs, rankBox);
  g.append(box);
  loadRanks(rankBox, S.rankView || 'member');
}
// ランキングは60秒キャッシュ（仲間の出入りのたびに全件を取り直さない）
async function fetchRanks(view) {
  const { save } = S.opts;
  const key = view + ':' + (save.guild?.id || '');
  if (S.rankCache && S.rankCache.key === key && Date.now() - S.rankCache.at < 60000) return S.rankCache.list;
  let list;
  if (view === 'guild') {
    if (serverMode()) {
      const r = await api('/guild/board', {});
      if (!r.ok) throw err(r.error || 'server');
      list = Array.isArray(r.list) ? r.list : [];
    } else list = await guildBoard();
  } else if (serverMode()) {
    list = S.gstate?.gid === save.guild?.id ? S.gstate.donors || [] : [];
  } else list = await guildDonors(save.guild.id);
  S.rankCache = { key, at: Date.now(), list };
  return list;
}
async function loadRanks(box, view) {
  const { save } = S.opts;
  box.replaceChildren(el('div', 'cp-mem', '読み込み中…'));
  try {
    const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}位`);
    const list = await fetchRanks(view);
    box.replaceChildren();
    if (view === 'guild') {
      if (!list.length) box.append(el('div', 'cp-mem', 'まだ寄付したギルドはありません。'));
      list.forEach((x, i) => {
        const d = el('div', 'cp-mem', `${medal(i)}　${clean(x.gname, 16)}　灯晶 ${(+x.total || 0).toLocaleString()}（寄付者 ${+x.members || 0}人）`);
        if (x.gid === save.guild?.id) d.style.color = '#ffd36a';
        box.append(d);
      });
    } else {
      const sum = list.reduce((s, x) => s + (+x.total || 0), 0);
      box.append(el('div', 'cp-mem', `ギルドの寄付総額：灯晶 ${sum.toLocaleString()}`));
      if (!list.length) box.append(el('div', 'cp-mem', 'まだ寄付した人はいません。最初の寄付者になろう！'));
      list.forEach((x, i) => {
        const d = el('div', 'cp-mem', `${medal(i)}　${clean(x.name, 12)}　灯晶 ${(+x.total || 0).toLocaleString()}`);
        if (x.pid === save.pid) d.style.color = '#ffd36a';
        box.append(d);
      });
    }
  } catch (e) {
    console.warn(e);
    box.replaceChildren(el('div', 'cp-mem', 'ランキングを読み込めませんでした。'));
  }
}

// ---------- 運営長の公開署名（役職トークンは絶対に配信・保存しない） ----------
async function pubSig(kind, body, at) {
  if (!serverMode()) return '';
  const k = `${kind}|${at}|${body}`;
  if (S.sigCache.has(k)) return S.sigCache.get(k);
  const r = await api('/chief/sign', { token: S.opts.roleToken?.() || '', kind, h: await sha256hex(body), at });
  if (!r.ok || typeof r.sig !== 'string') throw err(r.error || 'server');
  if (S.sigCache.size > 20) S.sigCache.clear();
  S.sigCache.set(k, r.sig);
  return r.sig;
}
// 受信側：署名が「運営長のお知らせ／イベント」用で、内容ハッシュと日時が一致するかを確認
async function verifyPub(kind, n) {
  if (!serverMode()) return true; // サーバー未設定時は検証手段がない（簡易モード）
  const d = await verifyToken(n.sig, 'cpub').catch(() => null);
  return !!d && d.k === kind && d.at === n.at && d.h === (await sha256hex(n.body));
}
async function handleChiefEvent(n) {
  if (!n) return;
  let ev;
  try { ev = JSON.parse(n.body); } catch { return; }
  if (!(ev === null || (ev && typeof ev === 'object'))) return;
  if (!(await verifyPub('event', n))) return;
  S.opts.onChiefEvent?.({ ev, at: n.at });
  rebuildTicker();
}
async function pullChiefEvent() {
  try {
    if (serverMode()) {
      const r = await api('/chief/current', {});
      if (r.ok && r.v && typeof r.v.body === 'string') await handleChiefEvent({ body: r.v.body, sig: String(r.v.sig || ''), at: +r.v.at || 0 });
    } else await handleChiefEvent(await loadChiefEvent());
  } catch (e) {
    console.warn(e);
  }
}

const CSS = `
#ticker{position:fixed;top:env(safe-area-inset-top);left:0;right:0;height:24px;z-index:60;overflow:hidden;pointer-events:none;
  background:linear-gradient(90deg,rgba(10,8,24,.88),rgba(30,18,50,.82),rgba(10,8,24,.88));border-bottom:1px solid rgba(214,180,106,.55);}
#ticker .tk-track{position:absolute;top:0;white-space:nowrap;line-height:24px;font-size:13px;color:#f4ead2;font-weight:700;will-change:transform;}
#ticker .tk-track b{color:#ffd36a;margin:0 .4em}
#ticker .tk-track span{margin-right:3.5em}
#chat-btn{position:fixed;right:env(safe-area-inset-right);top:env(safe-area-inset-top);height:24px;z-index:61;border-radius:0 0 0 10px;border:1px solid #d6b46a;border-top:0;border-right:0;background:rgba(27,29,58,.96);color:#f4ead2;font-weight:800;padding:0 10px;font-size:12px;line-height:22px;cursor:pointer;white-space:nowrap}
#chat-btn i{display:inline-block;min-width:16px;margin-left:4px;border-radius:8px;background:#e0103c;color:#fff;font-style:normal;font-size:11px;padding:0 4px}
#chat-btn i:empty{display:none}
#chat-panel{position:fixed;right:max(6px,env(safe-area-inset-right));top:calc(30px + env(safe-area-inset-top));z-index:62;width:min(380px,calc(100vw - 12px));height:min(470px,calc(100dvh - 40px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));max-height:calc(100vh - 40px);display:flex;flex-direction:column;
  background:rgba(14,14,34,.95);border:1px solid #d6b46a;border-radius:10px;color:#f4ead2;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.6)}
#chat-panel[hidden],#chat-panel [hidden]{display:none!important}
#chat-panel .cp-tabs{display:flex;gap:2px;padding:6px 6px 0}
#chat-panel .cp-tabs button{flex:1;border:0;border-radius:6px 6px 0 0;padding:6px 2px;background:#262848;color:#cfc4a8;font-weight:700;cursor:pointer}
#chat-panel .cp-tabs button.on{background:#3b2f5e;color:#ffd36a}
#chat-panel .cp-head{display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #3a3560;flex-wrap:wrap}
#chat-panel .cp-head select,#chat-panel input,#chat-panel select{background:#1c1c3a;color:#f4ead2;border:1px solid #5a5080;border-radius:5px;padding:5px 6px;font-size:13px}
#chat-panel .cp-log{flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:3px}
#chat-panel .cp-log p{margin:0;word-break:break-all}
#chat-panel .cp-log p b{color:#9fd0ff;margin-right:4px}
#chat-panel .cp-log p.me b{color:#ffd36a}
#chat-panel .cp-log p.sys{color:#a99fc8;font-size:12px}
#chat-panel .cp-log small{color:#887fa8;margin-left:4px;font-size:10px}
#chat-panel form{display:flex;gap:4px;padding:6px;border-top:1px solid #3a3560}
#chat-panel form input{flex:1;min-width:0}
#chat-panel button.cp-b{border:1px solid #d6b46a;background:#2c2550;color:#f4ead2;border-radius:5px;padding:5px 9px;font-weight:700;cursor:pointer}
#chat-panel button.cp-b:disabled{opacity:.5;cursor:default}
#chat-panel .cp-guild{padding:8px;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid #3a3560}
#chat-panel .cp-guild .row{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
#chat-panel .cp-mem{color:#cfc4a8;font-size:12px}
#chat-panel .cp-note{color:#ffe3a0;font-size:12px;background:rgba(214,180,106,.12);border:1px solid rgba(214,180,106,.4);border-radius:6px;padding:4px 6px}
`;

const MAX_LOG = 80;
let S = null; // 状態

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const clean = (s, n) => [...String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim()].slice(0, n).join('');
const rid = () => {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return [...crypto.getRandomValues(new Uint8Array(8))].map((x) => A[x % A.length]).join('');
};
const dmCh = (a, b) => 'dm:' + [a, b].sort().join(':');

/**
 * opts: { save, persist, myName, sfx, baseNews, syncCode, runServerSpend, onServerSpend, roleToken, isChief, isOperator, onChiefEvent, ownEvent }
 */
export function initSocial(opts) {
  if (S) return S.api;
  S = { opts, net: null, peers: {}, logs: { world: [], guild: [], friend: {}, staff: [] }, tab: 'world', dmPid: '', unread: 0, news: [], rate: [], lastFrom: new Map(), rooms: new Map(), sigCache: new Map(), busy: false, gnote: '' };
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  buildTicker();
  buildChat();
  try {
    const c = JSON.parse(localStorage.getItem('arkeia-chief-news') || 'null');
    if (c && Array.isArray(c.list) && Date.now() - c.at < 7 * 86400000) S.chiefNews = c;
  } catch {}
  S.chiefOwn = (() => {
    try {
      const v = JSON.parse(localStorage.getItem('arkeia-chief-own') || '[]');
      return Array.isArray(v) ? v.slice(0, 10).map((x) => clean(x, 80)).filter(Boolean) : [];
    } catch {
      return [];
    }
  })();
  // 運営長がオンラインの間、お知らせを定期配信
  setInterval(() => broadcastChief(), 30000);
  // ギルド情報をサーバーから定期的に取り直す（オフライン中の役職変更・除名・譲渡も反映）
  setInterval(() => refreshGuild(), 120000);
  setInterval(pullChiefEvent, 60000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    pullChiefEvent();
    refreshGuild();
  });
  S.api = {
    news: (t, broadcast = true) => {
      pushNews(t);
      if (broadcast) S.net?.news(clean(t, 80));
    },
    sendEvent: async () => {
      const own = S.opts.ownEvent?.();
      if (own && S.opts.isChief?.()) {
        const body = JSON.stringify(own.ev);
        try {
          if (serverMode()) await api('/chief/event', { token: S.opts.roleToken?.() || '', body, at: own.at });
          else await saveChiefEvent(body, '', own.at);
        } catch (e) {
          console.warn(e);
        }
      }
      broadcastChief();
      rebuildTicker();
    },
    refresh: () => {
      publish();
      rebuildTicker();
    }
  };
  startConnect();
  return S.api;
}

// 交流ルームへ接続（失敗しても本編は動く。再接続ボタンから再試行できる）
function startConnect() {
  if (S.net || S.connecting) return;
  S.connecting = true;
  S.connErr = false;
  connectSocial({
    onPeers: (p) => {
      const before = new Set(Object.values(S.peers).map((x) => x.pid));
      S.peers = p;
      if (S.net && S.ready) {
        for (const x of Object.values(p)) {
          if (x.id !== S.net.myId && x.pid && !before.has(x.pid)) pushNews(`${x.name} が双月の世界に降り立った`);
        }
      }
      S.ready = true;
      syncGuildMaster();
      syncRooms();
      renderHead();
      // 入力中の欄があるときは描き直さない（入力内容が消えないように）
      if (!S.panel.hidden && !S.guildBox.contains(document.activeElement)) renderGuild();
    },
    onChiefNews: async (n) => {
      if (n.from === S.net?.myId) return;
      if (S.chiefNews && n.at <= S.chiefNews.at) return;
      let list;
      try { list = JSON.parse(n.body); } catch { return; }
      if (!Array.isArray(list)) return;
      if (!(await verifyPub('news', n))) return;
      list = list.slice(0, 10).map((x) => clean(x, 80)).filter(Boolean);
      S.chiefNews = { list, at: n.at, body: n.body };
      localStorage.setItem('arkeia-chief-news', JSON.stringify(S.chiefNews));
      rebuildTicker();
    },
    onChiefEvent: (n) => {
      if (n.from === S.net?.myId) return;
      handleChiefEvent(n);
    },
    onGuildRole,
    onChat,
    onNews: (n) => {
      if (n.from === S.net?.myId) return;
      pushNews(n.t);
    }
  }).then((n) => {
    S.net = n;
    S.connecting = false;
    publish();
    broadcastChief();
    pullChiefEvent();
    refreshGuild(true);
    syncRooms();
    sys('world', '世界チャットにつながりました。');
    if (!S.panel.hidden) renderAll();
  }).catch((e) => {
    console.warn(e);
    S.connecting = false;
    S.connErr = true;
    sys('world', 'チャットに接続できませんでした。ギルドタブの「再接続」から再試行できます。');
    if (!S.panel.hidden) renderAll();
  });
}

function isStaff() {
  return !!(S.opts.isChief?.() || S.opts.isOperator?.());
}
function publish() {
  const { save, myName } = S.opts;
  const g = save.guild;
  S.net?.publish({ pid: save.pid, name: myName(), gid: g?.id || '', gname: g?.name || '', grole: g?.role || 'member', gm: g?.master || '', st: isStaff() ? 1 : 0 });
}

// ---------- 運営長のお知らせ ----------
async function broadcastChief() {
  if (!S?.net || !S.opts.isChief?.()) return;
  const list = S.chiefOwn;
  const body = JSON.stringify(list);
  // 内容が変わった時だけ日時を更新（同じ内容の再配信は受信側で無視される）
  if (!S.chiefNews || S.chiefNews.body !== body) {
    S.chiefNews = { list, at: Date.now(), body };
    localStorage.setItem('arkeia-chief-news', JSON.stringify(S.chiefNews));
  }
  try {
    S.net.chiefNews(body, await pubSig('news', body, S.chiefNews.at), S.chiefNews.at);
  } catch (e) {
    console.warn(e);
  }
  const own = S.opts.ownEvent?.();
  if (own) {
    const eb = JSON.stringify(own.ev);
    try {
      S.net.chiefEvent(eb, await pubSig('event', eb, own.at), own.at);
    } catch (e) {
      console.warn(e);
    }
  }
}
function saveChiefOwn() {
  localStorage.setItem('arkeia-chief-own', JSON.stringify(S.chiefOwn));
  broadcastChief();
  rebuildTicker();
}

// ---------- ギルド：状態管理 ----------
export const GUILD_ROLES = { master: 'ギルドマスター', sub: 'サブマスター', officer: '幹部', member: 'メンバー' };
const RANK = { master: 3, sub: 2, officer: 1, member: 0 };
// 所属の変更は必ず日時つきで保存（端末間同期で古い情報に上書きされないように）
function setGuild(g) {
  const { save, persist } = S.opts;
  save.guild = g;
  save.guildAt = Date.now();
  if (g) save.guildNote = null;
  persist();
  publish();
  syncRooms();
}
function setGuildNote(t) {
  S.opts.save.guildNote = t;
  S.opts.persist();
}
// サーバーの正式なギルド状態を反映
function applyState(st, quiet = false) {
  const { save } = S.opts;
  if (!st || !save.guild || st.gid !== save.guild.id) return;
  if (!st.member) {
    const k = st.kicked;
    const t = k
      ? `ギルド「${clean(st.name, 16)}」から除名されました（実行：${clean(k.by, 12)}${k.reason ? `／理由：${clean(k.reason, 60)}` : ''}）。`
      : `ギルド「${clean(st.name, 16)}」の所属が解除されました。`;
    S.logs.guild = []; // ログを消した後に通知を残す
    S.gstate = null;
    setGuild(null);
    setGuildNote(t);
    sys('guild', t);
    return;
  }
  // チャット鍵の世代が変わった（誰かが脱退・除名された）→ 新しいルームに入り直す
  if (st.epoch !== undefined && S.gstate && S.gstate.gid === st.gid && S.gstate.epoch !== st.epoch) {
    const ch = 'g:' + st.gid;
    S.rooms?.get(ch)?.conn?.leave();
    S.rooms?.delete(ch);
    S.gstate = st;
    syncRooms();
  }
  S.gstate = st;
  S.rankCache = null;
  const me = st.members.find((m) => m.pid === save.pid);
  if (!me) return;
  const g = save.guild;
  if (g.role !== me.role || g.master !== st.master || g.name !== st.name) {
    if (!quiet && g.role !== me.role) sys('guild', `あなたの役職が「${GUILD_ROLES[me.role]}」になりました。`);
    setGuild({ ...g, name: clean(st.name, 16), role: me.role, master: st.master });
  }
}
let refreshTimer = 0;
function refreshGuild(now = false) {
  if (!S?.net || !serverMode() || !S.opts.save.guild) return;
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const G = S.opts.save.guild;
    if (!G) return;
    try {
      const r = await gapi('/guild/get', { gid: G.id });
      applyState(r.state);
    } catch (e) {
      if (e.code === 'notfound' && S.opts.save.guild?.id === G.id) {
        const t = `ギルド「${G.name}」は解散されました。`;
        S.logs.guild = [];
        setGuild(null);
        setGuildNote(t);
        sys('guild', t);
      } else console.warn(e);
    }
    if (!S.panel.hidden) renderAll();
  }, now ? 0 : 1500);
}
// 変更をほかの仲間に知らせる（中身は送らない。受信側はサーバーから取り直す）
function hint(gid) {
  S.net?.guildRole({ gid });
}
// 簡易モード（サーバー未設定）：加入直後はマスターを知らないので、オンラインの仲間の申告から補う
function syncGuildMaster() {
  if (serverMode()) return;
  const g = S.opts.save.guild;
  if (!g || g.master) return;
  const m = Object.values(S.peers).find((p) => p.gid === g.id && p.gm)?.gm;
  if (m) {
    setGuild({ ...g, master: m });
  }
}
function myRank() {
  const g = S.opts.save.guild;
  return g ? RANK[g.role] ?? 0 : -1;
}
// メンバー一覧：サーバー利用時はオフラインの人も含む正式名簿、簡易モードはオンラインの仲間のみ
function memberList() {
  const { save } = S.opts;
  const G = save.guild;
  if (!G) return [];
  const online = new Set(Object.values(S.peers).filter((p) => p.gid === G.id).map((p) => p.pid));
  let list;
  if (serverMode() && S.gstate?.gid === G.id) {
    list = S.gstate.members.filter((m) => m.pid !== save.pid).map((m) => ({ pid: m.pid, name: clean(m.name, 12), role: m.role, on: online.has(m.pid) }));
  } else {
    const seen = new Set();
    list = Object.values(S.peers)
      .filter((p) => p.gid === G.id && p.pid !== save.pid && !seen.has(p.pid) && seen.add(p.pid))
      .map((p) => ({ pid: p.pid, name: p.name, role: p.pid === G.master ? 'master' : p.grole, on: true }));
  }
  return list.sort((a, b) => (RANK[b.role] ?? 0) - (RANK[a.role] ?? 0) || b.on - a.on);
}
async function setRole(target, role, reason = '') {
  const { save, myName } = S.opts;
  const g = save.guild;
  needOnline();
  if (!g) return;
  const label = role === 'kick' ? '除名' : GUILD_ROLES[role];
  if (serverMode()) {
    const r = await gapi('/guild/role', { gid: g.id, target: target.pid, role, reason });
    if (r.state) applyState(r.state, true);
    hint(g.id);
  } else {
    S.net.guildRole({ gid: g.id, pid: target.pid, role, by: save.pid, name: myName() });
    onGuildRole({ gid: g.id, pid: target.pid, role, by: save.pid, local: true, tname: target.name });
  }
  S.opts.sfx?.('ui');
  gnote(role === 'kick' ? `${target.name} を除名しました。` : `${target.name} の役職を「${label}」に変更しました。`);
}
function onGuildRole(e) {
  const { save, persist, myName } = S.opts;
  const g = save.guild;
  if (!g || e.gid !== g.id) return;
  // サーバー利用時：通知は合図のみ。正式な状態をサーバーから取得する（偽の通知は無害）
  if (serverMode()) {
    refreshGuild();
    return;
  }
  if (e.hint || !e.role) return;
  // 簡易モード：端末内の確認のみ（改ざん耐性なし）
  const byMaster = e.by === g.master;
  const byPeer = Object.values(S.peers).find((p) => p.pid === e.by && p.gid === g.id);
  const bySub = byPeer?.grole === 'sub';
  const tgtPeer = Object.values(S.peers).find((p) => p.pid === e.pid && p.gid === g.id);
  const tgtRank = e.pid === save.pid ? RANK[g.role] : RANK[tgtPeer?.grole] ?? 0;
  const ok = byMaster || (bySub && ['officer', 'member', 'kick'].includes(e.role) && tgtRank < 2);
  if (!ok) return;
  if (e.role === 'master') {
    if (save.pid === g.master && e.pid !== save.pid) g.role = 'sub';
    g.master = e.pid;
  }
  const label = e.role === 'kick' ? '除名' : GUILD_ROLES[e.role];
  const tname = e.tname || tgtPeer?.name || (e.pid === save.pid ? myName() : '仲間');
  if (e.pid === save.pid) {
    if (e.role === 'kick') {
      const t = `ギルド「${g.name}」から除名されました。`;
      S.logs.guild = [];
      setGuild(null);
      setGuildNote(t);
      sys('guild', t);
    } else {
      setGuild({ ...g, role: e.role });
      sys('guild', `あなたの役職が「${label}」になりました。`);
    }
  } else {
    if (e.role === 'master') setGuild({ ...g });
    else persist();
    if (!e.local) sys('guild', `${tname} が「${label}」になりました。`);
  }
  publish();
  if (!S.panel.hidden) renderAll();
}
// 簡易モードの譲渡：後継者の端末が「自分がマスター」と名乗るまで待ってから脱退する
async function localTransfer(heir) {
  const { save, myName } = S.opts;
  const G = save.guild;
  S.net.guildRole({ gid: G.id, pid: heir, role: 'master', by: save.pid, name: myName() });
  const t0 = Date.now();
  while (Date.now() - t0 < 10000) {
    if (Object.values(S.peers).some((p) => p.pid === heir && p.gid === G.id && p.gm === heir)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw err('transfer');
}

// ---------- ギルド：操作 ----------
async function doLeave() {
  const { save, myName } = S.opts;
  const G = save.guild;
  if (!G) return;
  needOnline();
  const others = memberList();
  if (G.role === 'master' && others.length) {
    const heir = await uiConfirm(
      `ギルド「${G.name}」を脱退しますか？\nあなたはギルドマスターです。後継者を選んでください。\n譲渡の完了を確認してから脱退します。`,
      '譲渡して脱退', true,
      { select: others.map((p) => [p.pid, `${p.name}（${GUILD_ROLES[p.role] || 'メンバー'}${p.on ? '・オンライン' : ''}）`]), label: '後継のギルドマスター' }
    );
    if (!heir) return;
    if (serverMode()) {
      const r = await gapi('/guild/leave', { gid: G.id, heir });
      if (r.heir !== heir) throw err('server');
    } else await localTransfer(heir);
    const hn = others.find((p) => p.pid === heir)?.name || '後継者';
    S.api.news(`${myName()} がギルド「${G.name}」のマスターを ${hn} に譲り、ギルドを去った`);
  } else {
    const solo = G.role === 'master';
    const ok = await uiConfirm(
      solo ? `ギルド「${G.name}」を脱退しますか？\nほかにメンバーがいないため、ギルドは解散されます。` : `ギルド「${G.name}」を脱退しますか？`,
      solo ? '解散して脱退' : '脱退する', true
    );
    if (!ok) return;
    if (serverMode()) await gapi('/guild/leave', { gid: G.id });
    S.api.news(`${myName()} がギルド「${G.name}」を去った`);
  }
  hint(G.id);
  S.opts.sfx?.('ui');
  S.logs.guild = [];
  S.gstate = null;
  setGuild(null);
  gnote(`ギルド「${G.name}」を脱退しました。`);
}
async function doCreate(nameRaw) {
  const { save, myName } = S.opts;
  const name = clean(nameRaw, 16);
  if (!name) throw err('bad');
  needOnline();
  if (!(await uiConfirm(`ギルド「${name}」を結成しますか？\nあなたがギルドマスターになります。`, '結成する'))) return;
  let gid;
  if (serverMode()) {
    const r = await gapi('/guild/create', { gname: name });
    gid = r.state.gid;
    setGuild({ id: gid, name: clean(r.state.name, 16), role: 'master', master: save.pid });
    applyState(r.state, true);
  } else {
    gid = rid();
    setGuild({ id: gid, name, role: 'master', master: save.pid });
  }
  S.opts.sfx?.('burst');
  S.api.news(`${myName()} がギルド「${name}」を結成した！`);
  gnote(`ギルド「${name}」を結成しました！ギルドコード：${gid}`);
}
async function doJoin(codeRaw, nameRaw) {
  const { myName } = S.opts;
  const c = String(codeRaw || '').trim();
  if (!/^[A-Za-z0-9]{8}$/.test(c)) throw Object.assign(err('bad'), { code: 'bad' });
  needOnline();
  if (serverMode()) {
    // 実在確認（存在しない・除名済みならここで止める）
    const pre = await gapi('/guild/get', { gid: c });
    if (pre.state.kicked) throw err('banned');
    const gname = clean(pre.state.name, 16);
    if (!pre.state.member && !(await uiConfirm(`ギルド「${gname}」に加入しますか？`, '加入する'))) return;
    const r = await gapi('/guild/join', { gid: c });
    const me = r.state.members.find((m) => m.pid === S.opts.save.pid);
    setGuild({ id: c, name: gname, role: me?.role || 'member', master: r.state.master });
    applyState(r.state, true);
    hint(c);
    S.opts.sfx?.('burst');
    S.api.news(`${myName()} がギルド「${gname}」に加わった！`);
    gnote(`ギルド「${gname}」に加入しました！`);
    return;
  }
  const known = Object.values(S.peers).find((p) => p.gid === c && p.gname)?.gname;
  const name = known || clean(nameRaw, 16) || 'ギルド';
  const ok = await uiConfirm(
    `ギルド「${name}」（コード ${c}）に加入しますか？${known ? '' : '\n※サーバー未設定のため、ギルドの実在は確認できません。'}`,
    '加入する'
  );
  if (!ok) return;
  const master = Object.values(S.peers).find((p) => p.gid === c && p.gm)?.gm || '';
  setGuild({ id: c, name, role: 'member', master });
  S.opts.sfx?.('burst');
  S.api.news(`${myName()} がギルド「${name}」に加わった！`);
  gnote(`ギルド「${name}」に加入しました。`);
}

// ---------- お知らせテロップ ----------
function buildTicker() {
  const t = el('div');
  t.id = 'ticker';
  t.setAttribute('aria-hidden', 'true');
  const track = el('div', 'tk-track');
  t.append(track);
  document.body.append(t);
  S.track = track;
  S.x = window.innerWidth;
  rebuildTicker();
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    S.x -= dt * 80;
    const w = S.track.offsetWidth;
    if (S.x < -w) {
      S.x = window.innerWidth;
      rebuildTicker();
    }
    S.track.style.transform = `translateX(${S.x}px)`;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function rebuildTicker() {
  if (!S?.track) return;
  const chief = (S.chiefNews?.list || []).map((t) => `【運営長】${t}`);
  const items = [...chief, ...(S.opts.baseNews?.() || []), ...S.news.slice(-15)];
  S.track.replaceChildren();
  for (const s of items) {
    const sp = el('span');
    sp.append(el('b', null, '◆'), document.createTextNode(s));
    S.track.append(sp);
  }
}
function pushNews(t) {
  S.news.push(clean(t, 80));
  if (S.news.length > 30) S.news.shift();
}

// ---------- チャンネル別ルーム（ギルド・フレンド・運営会議） ----------
function wantedChannels() {
  const { save } = S.opts;
  const w = new Set();
  if (save.guild) w.add('g:' + save.guild.id);
  if (isStaff()) w.add('staff');
  const online = new Set(Object.values(S.peers).map((p) => p.pid));
  for (const f of save.friends || []) {
    if (online.has(f.pid) || (S.tab === 'friend' && f.pid === S.dmPid)) w.add(dmCh(save.pid, f.pid));
  }
  return w;
}
async function roomKey(ch) {
  if (serverMode()) {
    if (ch === 'staff') {
      const r = await api('/chat/room', { ch, token: S.opts.roleToken?.() || '' }).catch(() => ({ ok: false, error: 'net' }));
      if (!r.ok) throw err(r.error || 'server');
      return r.room;
    }
    return (await gapi('/chat/room', { ch })).room;
  }
  return (await sha256hex('arkeia-room:' + ch)).slice(0, 40);
}
function syncRooms() {
  if (!S?.net) return;
  const want = wantedChannels();
  const now = Date.now();
  for (const [ch, r] of S.rooms) {
    if (!want.has(ch) || (r.fail && now - r.at > 30000)) {
      r.conn?.leave();
      S.rooms.delete(ch);
    }
  }
  for (const ch of want) {
    if (S.rooms.has(ch)) continue;
    const r = { conn: null, fail: '', at: now };
    S.rooms.set(ch, r);
    roomKey(ch)
      .then((k) => joinChannel(k, ch, S.net.myId, onChat))
      .then((conn) => {
        if (S.rooms.get(ch) !== r) return conn.leave();
        r.conn = conn;
        if (!S.panel.hidden) renderLog();
      })
      .catch((e) => {
        console.warn(e);
        r.fail = errMsg(e);
        if (!S.panel.hidden) renderLog();
      });
  }
}

// ---------- チャット ----------
function buildChat() {
  const b = el('button', null, '💬 チャット');
  b.id = 'chat-btn';
  b.setAttribute('aria-expanded', 'false');
  const badge = el('i');
  b.append(badge);
  S.badge = badge;
  const panel = el('div');
  panel.id = 'chat-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'チャット');
  b.addEventListener('click', () => {
    S.opts.sfx?.('ui');
    panel.hidden = !panel.hidden;
    b.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) {
      S.unread = 0;
      badge.textContent = '';
      renderAll();
    }
  });
  const tabs = el('div', 'cp-tabs');
  tabs.setAttribute('role', 'tablist');
  for (const [k, n] of [['world', '世界'], ['guild', 'ギルド'], ['friend', 'フレンド'], ['staff', '運営会議'], ['online', '接続一覧'], ['chief', 'お知らせ管理']]) {
    const t = el('button', k === S.tab ? 'on' : '', n);
    t.type = 'button';
    t.setAttribute('role', 'tab');
    t.dataset.tab = k;
    if (k === 'online') S.onlineTab = t;
    if (k === 'chief') S.chiefTab = t;
    if (k === 'staff') S.staffTab = t;
    t.addEventListener('click', () => {
      S.tab = k;
      syncRooms();
      renderAll();
    });
    tabs.append(t);
  }
  const head = el('div', 'cp-head');
  const guild = el('div', 'cp-guild');
  const log = el('div', 'cp-log');
  log.setAttribute('aria-live', 'polite');
  const form = el('form');
  const inp = el('input');
  inp.maxLength = 120;
  inp.placeholder = 'メッセージ（120文字まで）';
  inp.setAttribute('aria-label', 'メッセージ');
  const send = el('button', 'cp-b', '送信');
  send.type = 'submit';
  form.append(inp, send);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (sendChat(inp.value)) inp.value = '';
  });
  for (const ev of ['keydown', 'keyup']) panel.addEventListener(ev, (e) => e.stopPropagation());
  panel.append(tabs, head, guild, log, form);
  document.body.append(b, panel);
  Object.assign(S, { panel, head, guildBox: guild, log, inp, form, send });
}

function curChannel() {
  const { save } = S.opts;
  if (S.tab === 'chief' || S.tab === 'online') return null; // 管理タブからは送信しない
  if (S.tab === 'world') return 'world';
  if (S.tab === 'guild') return save.guild ? 'g:' + save.guild.id : null;
  if (S.tab === 'staff') return isStaff() ? 'staff' : null;
  return S.dmPid && save.friends.some((f) => f.pid === S.dmPid) ? dmCh(save.pid, S.dmPid) : null;
}
function sendChat(raw) {
  const t = clean(raw, 120);
  if (!t) return false;
  if (!S.net) {
    sys(S.tab, ERR.offline);
    return false;
  }
  const ch = curChannel();
  if (!ch) return false;
  let room = null;
  if (ch !== 'world') {
    room = S.rooms.get(ch);
    if (!room?.conn) {
      sys(S.tab, room?.fail ? `このチャンネルに参加できません：${room.fail}` : '専用チャンネルに接続中です。少し待ってから送信してください。');
      syncRooms();
      return false;
    }
  }
  const now = Date.now();
  S.rate = S.rate.filter((x) => now - x < 5000);
  if (S.rate.length >= 3) {
    sys(S.tab, '送信が速すぎます。少し待ってください。');
    return false;
  }
  S.rate.push(now);
  const { save, myName } = S.opts;
  const msg = { ch, t, pid: save.pid, name: myName(), gname: ch === 'staff' ? (S.opts.isChief?.() ? '運営長' : '運営') : save.guild?.name || '' };
  if (room) room.conn.send(msg);
  else S.net.chat(msg);
  onChat({ ...msg, from: S.net.myId, at: now, me: true });
  return true;
}
function onChat(m) {
  const { save } = S.opts;
  if (!m.me && m.from === S.net?.myId) return;
  if (!m.me) {
    const now = Date.now();
    const h = (S.lastFrom.get(m.from) || []).filter((x) => now - x < 5000);
    if (h.length >= 4) return;
    h.push(now);
    S.lastFrom.set(m.from, h);
  }
  // m.ch は受信したルームで決まる（送信者の申告ではない）
  let box;
  if (m.ch === 'world') box = S.logs.world;
  else if (m.ch === 'staff') {
    if (!isStaff()) return;
    box = S.logs.staff;
  } else if (m.ch.startsWith('g:')) {
    if (!save.guild || m.ch !== 'g:' + save.guild.id) return;
    box = S.logs.guild;
  } else {
    const [, a, b] = m.ch.split(':');
    if (a !== save.pid && b !== save.pid) return;
    const other = a === save.pid ? b : a;
    if (!save.friends.some((f) => f.pid === other)) return;
    if (!m.me && m.pid !== other) return;
    box = S.logs.friend[other] ||= [];
  }
  box.push(m);
  if (box.length > MAX_LOG) box.shift();
  if (S.panel.hidden && !m.me) {
    S.unread++;
    S.badge.textContent = S.unread > 99 ? '99+' : String(S.unread);
  }
  if (!S.panel.hidden) renderLog();
}
function sys(tab, t) {
  const box = tab === 'friend' ? (S.logs.friend[S.dmPid] ||= []) : S.logs[tab] || S.logs.world;
  box.push({ sys: true, t, at: Date.now() });
  if (box.length > MAX_LOG) box.shift();
  if (S.panel && !S.panel.hidden) renderLog();
}

function renderAll() {
  const chief = !!S.opts.isChief?.();
  S.chiefTab.hidden = !chief;
  if (S.tab === 'chief' && !chief) S.tab = 'world';
  const staff = isStaff();
  S.staffTab.hidden = !staff;
  if (S.tab === 'staff' && !staff) S.tab = 'world';
  S.onlineTab.hidden = !staff;
  if (S.tab === 'online' && !staff) S.tab = 'world';
  S.panel.querySelectorAll('.cp-tabs button').forEach((x) => {
    x.classList.toggle('on', x.dataset.tab === S.tab);
    x.setAttribute('aria-selected', String(x.dataset.tab === S.tab));
  });
  const noChat = S.tab === 'chief' || S.tab === 'online';
  S.form.hidden = noChat;
  S.log.hidden = noChat;
  S.inp.disabled = noChat || !curChannel();
  S.send.disabled = S.inp.disabled;
  renderHead();
  renderGuild();
  renderLog();
}
// 運営長：お知らせ欄の管理（追加・削除・並べ替え）
function renderChief() {
  const g = S.guildBox;
  g.hidden = false;
  g.style.flex = '1';
  g.style.overflowY = 'auto';
  g.append(el('div', 'cp-mem', `画面上部のお知らせに【運営長】として流れます（最大10件・80文字）。運営長がオンラインの間、全員に配信されます。`));
  S.chiefOwn.forEach((t, i) => {
    const row = el('div', 'row');
    const inp = el('input');
    inp.value = t;
    inp.maxLength = 80;
    inp.style.flex = '1';
    inp.addEventListener('change', () => {
      const v = clean(inp.value, 80);
      if (v) S.chiefOwn[i] = v;
      else S.chiefOwn.splice(i, 1);
      saveChiefOwn();
      renderAll();
    });
    const up = el('button', 'cp-b', '↑');
    up.type = 'button';
    up.disabled = i === 0;
    up.setAttribute('aria-label', '上へ');
    up.addEventListener('click', () => {
      [S.chiefOwn[i - 1], S.chiefOwn[i]] = [S.chiefOwn[i], S.chiefOwn[i - 1]];
      saveChiefOwn();
      renderAll();
    });
    const del = el('button', 'cp-b', '削除');
    del.type = 'button';
    del.addEventListener('click', async () => {
      if (!(await uiConfirm(`このお知らせを削除しますか？\n「${t}」`, '削除する', true))) return;
      S.chiefOwn.splice(i, 1);
      saveChiefOwn();
      renderAll();
    });
    row.append(inp, up, del);
    g.append(row);
  });
  const row = el('div', 'row');
  const inp = el('input');
  inp.maxLength = 80;
  inp.placeholder = '新しいお知らせ';
  inp.style.flex = '1';
  const add = el('button', 'cp-b', '追加');
  add.type = 'button';
  add.disabled = S.chiefOwn.length >= 10;
  add.addEventListener('click', () => {
    const v = clean(inp.value, 80);
    if (!v || S.chiefOwn.length >= 10) return;
    S.chiefOwn.push(v);
    S.opts.sfx?.('ui');
    saveChiefOwn();
    renderAll();
  });
  const clr = el('button', 'cp-b', '全消去');
  clr.type = 'button';
  clr.addEventListener('click', async () => {
    if (!S.chiefOwn.length || !(await uiConfirm('お知らせをすべて消去しますか？', '全消去', true))) return;
    S.chiefOwn = [];
    saveChiefOwn();
    renderAll();
  });
  row.append(inp, add, clr);
  g.append(row);
}
// 運営長・運営：接続中のプレイヤー一覧
function renderOnline() {
  const g = S.guildBox;
  g.hidden = false;
  g.style.flex = '1';
  g.style.maxHeight = '';
  g.style.overflowY = 'auto';
  const { save, myName } = S.opts;
  const list = [{ name: myName(), pid: save.pid, gname: save.guild?.name || '', st: isStaff(), me: true }, ...Object.values(S.peers).filter((p) => p.id !== S.net?.myId)];
  const seen = new Set();
  const rows = list.filter((p) => { const k = p.pid || p.id; if (seen.has(k)) return false; seen.add(k); return true; });
  rows.sort((a, b) => (b.me - a.me) || (b.st - a.st) || String(a.name).localeCompare(String(b.name), 'ja'));
  g.append(el('div', 'cp-mem', `接続中 ${rows.length} 人（運営長・運営のみ閲覧可）`));
  for (const p of rows) {
    const row = el('div', 'row');
    row.append(el('div', 'cp-mem', `● ${p.name}${p.me ? '（あなた）' : ''}${p.st ? '【運営】' : ''}${p.gname ? `　[${p.gname}]` : ''}${p.pid ? `　ID: ${p.pid}` : ''}`));
    if (S.opts.isChief?.() && /^[a-z0-9]{8,24}$/.test(p.pid || '')) {
      const gift = el('button', 'cp-b', '贈る');
      gift.type = 'button';
      gift.setAttribute('aria-label', `${p.name}へプレゼントを送る`);
      gift.addEventListener('click', () => S.opts.openMailbox?.('gift', p.pid));
      const mail = el('button', 'cp-b', 'メール');
      mail.type = 'button';
      mail.setAttribute('aria-label', `${p.name}へシステムメールを送る`);
      mail.addEventListener('click', () => S.opts.openMailbox?.('system', p.pid));
      row.append(gift, mail);
    }
    g.append(row);
  }
}
function onlineCount(filter) {
  return Object.values(S.peers).filter(filter).length;
}
function renderHead() {
  if (!S.head || S.panel.hidden) return;
  const { save } = S.opts;
  const h = S.head;
  h.replaceChildren();
  if (S.tab === 'chief') {
    h.append(el('span', null, 'お知らせ管理（運営長専用）'));
  } else if (S.tab === 'online') {
    h.append(el('span', null, '接続中のプレイヤー（運営長・運営専用）'));
  } else if (S.tab === 'staff') {
    h.append(el('span', null, `運営会議（運営長・運営専用） — 参加中 ${onlineCount((p) => p.st)} 人`));
  } else if (S.tab === 'world') {
    h.append(el('span', null, `世界チャット — 接続中 ${onlineCount(() => true)} 人`));
  } else if (S.tab === 'guild') {
    h.append(el('span', null, save.guild ? `ギルド「${save.guild.name}」 — オンライン ${onlineCount((p) => p.gid === save.guild.id)} 人` : 'ギルドに未所属'));
  } else {
    if (!save.friends.length) {
      h.append(el('span', null, 'フレンドがいません（世界の旅人パネルから申請できます）'));
      return;
    }
    const sel = el('select');
    sel.setAttribute('aria-label', '相手');
    for (const f of save.friends) {
      const on = Object.values(S.peers).some((p) => p.pid === f.pid);
      const o = el('option', null, `${on ? '● ' : '○ '}${f.name}`);
      o.value = f.pid;
      sel.append(o);
    }
    if (!S.dmPid || !save.friends.some((f) => f.pid === S.dmPid)) S.dmPid = save.friends[0].pid;
    sel.value = S.dmPid;
    sel.addEventListener('change', () => {
      S.dmPid = sel.value;
      syncRooms();
      renderAll();
    });
    h.append(el('span', null, '相手：'), sel);
  }
}
function renderGuild() {
  const g = S.guildBox;
  if (!g) return;
  g.replaceChildren();
  g.style.flex = '';
  g.style.overflowY = '';
  g.style.maxHeight = '45%';
  g.style.overflow = 'auto';
  if (S.tab === 'chief') {
    g.style.maxHeight = '';
    renderChief();
    return;
  }
  if (S.tab === 'online') {
    renderOnline();
    return;
  }
  g.hidden = S.tab !== 'guild';
  if (g.hidden) return;
  const { save } = S.opts;
  // 接続状態・モード
  if (!S.net) {
    const r = el('div', 'row');
    r.append(el('span', 'cp-note', S.connecting ? 'オンラインに接続中です…' : 'オンラインに接続できていません。ギルド操作は接続後に行えます。'));
    if (!S.connecting) {
      const re = el('button', 'cp-b', '再接続');
      re.type = 'button';
      re.addEventListener('click', () => { startConnect(); renderGuild(); });
      r.append(re);
    }
    g.append(r);
  }
  if (!serverMode()) g.append(el('div', 'cp-mem', '※サーバー未設定のため簡易モードです（役職・加入は端末内の確認のみ）。'));
  if (S.gnote) {
    const n = el('div', 'cp-note', S.gnote);
    n.setAttribute('role', 'status');
    g.append(n);
  }
  if (S.busy) g.append(el('div', 'cp-mem', '処理中…'));
  if (save.guild) {
    const G = save.guild;
    const row0 = el('div', 'row');
    row0.append(el('b', null, `「${G.name}」`), el('span', null, `あなたの役職：${GUILD_ROLES[G.role] || 'メンバー'}`));
    g.append(row0);
    const mine = myRank();
    const mems = memberList();
    const full = serverMode() && S.gstate?.gid === G.id;
    g.append(el('div', 'cp-mem', full ? `メンバー ${mems.length + 1} 人（●オンライン ○オフライン）` : 'オンラインの仲間'));
    if (!mems.length) g.append(el('div', 'cp-mem', full ? 'ほかのメンバーはいません。' : 'オンラインの仲間：なし'));
    for (const p of mems) {
      const r = el('div', 'row');
      const pr = p.role;
      r.append(el('span', 'cp-mem', `${p.on ? '●' : '○'} ${p.name}［${GUILD_ROLES[pr] || 'メンバー'}］`));
      const canEdit = mine === 3 || (mine === 2 && (RANK[pr] ?? 0) < 2);
      if (canEdit && pr !== 'master') {
        const sel = el('select');
        sel.setAttribute('aria-label', `${p.name} の役職`);
        sel.disabled = !!S.busy;
        const opts = mine === 3 ? ['sub', 'officer', 'member', 'master'] : ['officer', 'member'];
        for (const o of opts) {
          const op = el('option', null, o === 'master' ? 'マスターを譲る' : GUILD_ROLES[o]);
          op.value = o;
          sel.append(op);
        }
        sel.value = opts.includes(pr) ? pr : 'member';
        sel.addEventListener('change', () => {
          const role = sel.value;
          sel.value = opts.includes(pr) ? pr : 'member'; // 確定するまで表示は元のまま
          if (role === pr) return;
          busy(async () => {
            const text = role === 'master'
              ? `${p.name} にギルドマスターを譲りますか？\nあなたはサブマスターになります。`
              : `${p.name} の役職を「${GUILD_ROLES[pr] || 'メンバー'}」から「${GUILD_ROLES[role]}」に変更しますか？`;
            if (!(await uiConfirm(text, role === 'master' ? '譲る' : '変更する', role === 'master'))) return;
            await setRole(p, role);
          });
        });
        const kick = btn('除名', async () => {
          const reason = await uiConfirm(`${p.name} をギルドから除名しますか？\n除名された人は、解除されるまで再加入できません。`, '除名する', true, { input: { placeholder: '除名の理由（任意・60文字まで）', max: 60 }, label: '理由' });
          if (reason === null) return;
          await setRole(p, 'kick', clean(reason, 60));
        });
        r.append(sel, kick);
      }
      g.append(r);
    }
    // 除名履歴（マスター・サブマスターのみ。解除すると再加入できる）
    if (full && mine >= 2 && S.gstate.bans?.length) {
      g.append(el('b', null, '除名履歴'));
      for (const x of S.gstate.bans) {
        const r = el('div', 'row');
        r.append(el('span', 'cp-mem', `${clean(x.name, 12)}（実行：${clean(x.by, 12)}${x.reason ? `／${clean(x.reason, 60)}` : ''}）`));
        r.append(btn('解除', async () => {
          if (!(await uiConfirm(`${clean(x.name, 12)} の除名を解除しますか？\n解除すると再加入できるようになります。`, '解除する'))) return;
          const res = await gapi('/guild/unban', { gid: G.id, target: x.pid });
          if (res.state) applyState(res.state, true);
          gnote(`${clean(x.name, 12)} の除名を解除しました。`);
        }));
        g.append(r);
      }
    }
    const row = el('div', 'row');
    row.append(el('span', null, `ギルドコード：${G.id}`));
    const copy = el('button', 'cp-b', 'コピー');
    copy.type = 'button';
    copy.addEventListener('click', () => {
      if (!navigator.clipboard?.writeText) {
        gnote(`コピーできませんでした。コード「${G.id}」を手動でコピーしてください。`);
        return;
      }
      navigator.clipboard.writeText(G.id).then(
        () => gnote(`ギルドコード「${G.id}」をコピーしました。`),
        () => gnote(`コピーできませんでした。コード「${G.id}」を手動でコピーしてください。`)
      );
    });
    row.append(copy, btn('脱退', doLeave));
    g.append(row, el('div', 'cp-mem', '役職：ギルドマスター＞サブマスター＞幹部＞メンバー。コードを仲間に教えると、同じギルドに入れます。'));
    renderDonate(g);
    return;
  }
  if (save.guildNote) {
    const r = el('div', 'row');
    r.append(el('span', 'cp-note', save.guildNote));
    const x = el('button', 'cp-b', '閉じる');
    x.type = 'button';
    x.addEventListener('click', () => { setGuildNote(null); renderGuild(); });
    r.append(x);
    g.append(r);
  }
  const r1 = el('div', 'row');
  const nm = el('input');
  nm.maxLength = 16;
  nm.placeholder = '新しいギルド名';
  nm.setAttribute('aria-label', '新しいギルド名');
  r1.append(nm, btn('結成', () => doCreate(nm.value), !S.net));
  const r2 = el('div', 'row');
  const code = el('input');
  code.maxLength = 8;
  code.placeholder = 'ギルドコード（8文字）';
  code.setAttribute('aria-label', 'ギルドコード');
  r2.append(code);
  let gname = null;
  if (!serverMode()) {
    gname = el('input');
    gname.maxLength = 16;
    gname.placeholder = 'ギルド名（任意）';
    gname.setAttribute('aria-label', 'ギルド名');
    r2.append(gname);
  }
  r2.append(btn('加入', async () => {
    if (!/^[A-Za-z0-9]{8}$/.test(code.value.trim())) {
      gnote('ギルドコードは英数字8文字です。');
      return;
    }
    await doJoin(code.value, gname?.value);
  }, !S.net));
  g.append(el('div', 'cp-mem', 'ギルドを結成するか、仲間のコードで加入しましょう。'), r1, r2);
}
function renderLog() {
  if (!S.log || S.panel.hidden || S.tab === 'chief' || S.tab === 'online') return;
  const { save } = S.opts;
  let box = S.logs.world;
  if (S.tab === 'guild') box = S.logs.guild;
  else if (S.tab === 'friend') box = S.logs.friend[S.dmPid] || [];
  else if (S.tab === 'staff') box = S.logs.staff;
  S.log.replaceChildren();
  if (S.tab === 'guild' && !save.guild) {
    S.log.append(el('p', 'sys', 'ギルドに入るとギルドチャットが使えます。'));
  }
  for (const m of box) {
    if (m.sys) {
      S.log.append(el('p', 'sys', m.t));
      continue;
    }
    const p = el('p', m.pid === save.pid ? 'me' : '');
    p.append(el('b', null, (m.gname && S.tab === 'world' ? `[${m.gname}]` : '') + m.name), document.createTextNode(m.t));
    const d = new Date(m.at);
    p.append(el('small', null, `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`));
    S.log.append(p);
  }
  const ch = curChannel();
  const room = ch && ch !== 'world' ? S.rooms.get(ch) : null;
  if (ch && ch !== 'world' && !room?.conn) S.log.append(el('p', 'sys', room?.fail ? `このチャンネルに参加できません：${room.fail}` : '専用チャンネルに接続中…'));
  S.log.scrollTop = S.log.scrollHeight;
  S.inp.disabled = !ch || !S.net;
  S.send.disabled = S.inp.disabled;
  S.inp.placeholder = !S.net ? 'オンラインに接続できていません' : ch ? 'メッセージ（120文字まで）' : S.tab === 'guild' ? 'ギルドに未所属です' : 'フレンドを選んでください';
}
