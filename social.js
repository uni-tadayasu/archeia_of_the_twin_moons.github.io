// 交流機能：画面上部のお知らせテロップ・世界／ギルド／フレンドチャット・ギルド
import { connectSocial } from './net.js';

const CSS = `
#ticker{position:fixed;top:0;left:0;right:0;height:24px;z-index:60;overflow:hidden;pointer-events:none;
  background:linear-gradient(90deg,rgba(10,8,24,.88),rgba(30,18,50,.82),rgba(10,8,24,.88));border-bottom:1px solid rgba(214,180,106,.55);}
#ticker .tk-track{position:absolute;top:0;white-space:nowrap;line-height:24px;font-size:13px;color:#f4ead2;font-weight:700;will-change:transform;}
#ticker .tk-track b{color:#ffd36a;margin:0 .4em}
#ticker .tk-track span{margin-right:3.5em}
#chat-btn{position:fixed;right:10px;top:30px;z-index:61;border-radius:18px;border:1px solid #d6b46a;background:rgba(27,29,58,.85);color:#f4ead2;font-weight:800;padding:6px 12px;font-size:13px;cursor:pointer}
#chat-btn i{display:inline-block;min-width:16px;margin-left:4px;border-radius:8px;background:#e0103c;color:#fff;font-style:normal;font-size:11px;padding:0 4px}
#chat-btn i:empty{display:none}
#chat-panel{position:fixed;right:10px;top:64px;z-index:62;width:min(380px,94vw);height:min(470px,72vh);display:flex;flex-direction:column;
  background:rgba(14,14,34,.95);border:1px solid #d6b46a;border-radius:10px;color:#f4ead2;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.6)}
#chat-panel[hidden]{display:none}
#chat-panel .cp-tabs{display:flex;gap:2px;padding:6px 6px 0}
#chat-panel .cp-tabs button{flex:1;border:0;border-radius:6px 6px 0 0;padding:6px 2px;background:#262848;color:#cfc4a8;font-weight:700;cursor:pointer}
#chat-panel .cp-tabs button.on{background:#3b2f5e;color:#ffd36a}
#chat-panel .cp-head{display:flex;gap:6px;align-items:center;padding:6px 8px;border-bottom:1px solid #3a3560;flex-wrap:wrap}
#chat-panel .cp-head select,#chat-panel input{background:#1c1c3a;color:#f4ead2;border:1px solid #5a5080;border-radius:5px;padding:5px 6px;font-size:13px}
#chat-panel .cp-log{flex:1;overflow-y:auto;padding:6px 8px;display:flex;flex-direction:column;gap:3px}
#chat-panel .cp-log p{margin:0;word-break:break-all}
#chat-panel .cp-log p b{color:#9fd0ff;margin-right:4px}
#chat-panel .cp-log p.me b{color:#ffd36a}
#chat-panel .cp-log p.sys{color:#a99fc8;font-size:12px}
#chat-panel .cp-log small{color:#887fa8;margin-left:4px;font-size:10px}
#chat-panel form{display:flex;gap:4px;padding:6px;border-top:1px solid #3a3560}
#chat-panel form input{flex:1;min-width:0}
#chat-panel button.cp-b{border:1px solid #d6b46a;background:#2c2550;color:#f4ead2;border-radius:5px;padding:5px 9px;font-weight:700;cursor:pointer}
#chat-panel .cp-guild{padding:8px;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid #3a3560}
#chat-panel .cp-guild .row{display:flex;gap:4px;align-items:center;flex-wrap:wrap}
#chat-panel .cp-mem{color:#cfc4a8;font-size:12px}
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
 * opts: { save, persist, myName, sfx, baseNews: () => string[] }
 */
export function initSocial(opts) {
  if (S) return S.api;
  S = { opts, net: null, peers: {}, logs: { world: [], guild: [], friend: {} }, tab: 'world', dmPid: '', unread: 0, news: [], rate: [], lastFrom: new Map() };
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  buildTicker();
  buildChat();
  // 交流ルームへ接続（失敗しても本編は動く）
  connectSocial({
    onPeers: (p) => {
      S.peers = p;
      renderHead();
    },
    onChat: onChat,
    onNews: (n) => {
      if (n.from === S.net?.myId) return;
      pushNews(n.t);
    }
  }).then((n) => {
    S.net = n;
    publish();
    sys('world', '世界チャットにつながりました。');
  }).catch((err) => {
    console.warn(err);
    sys('world', 'チャットに接続できませんでした。');
  });
  S.api = {
    news: (t, broadcast = true) => {
      pushNews(t);
      if (broadcast) S.net?.news(clean(t, 80));
    },
    refresh: () => {
      publish();
      rebuildTicker();
    }
  };
  return S.api;
}

function publish() {
  const { save, myName } = S.opts;
  S.net?.publish({ pid: save.pid, name: myName(), gid: save.guild?.id || '', gname: save.guild?.name || '' });
}

// ---------- お知らせテロップ ----------
function buildTicker() {
  const t = el('div');
  t.id = 'ticker';
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
  const items = [...(S.opts.baseNews?.() || []), ...S.news.slice(-12)];
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

// ---------- チャット ----------
function buildChat() {
  const btn = el('button', null, '💬 チャット');
  btn.id = 'chat-btn';
  const badge = el('i');
  btn.append(badge);
  S.badge = badge;
  const panel = el('div');
  panel.id = 'chat-panel';
  panel.hidden = true;
  btn.addEventListener('click', () => {
    S.opts.sfx?.('ui');
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      S.unread = 0;
      badge.textContent = '';
      renderAll();
    }
  });
  const tabs = el('div', 'cp-tabs');
  for (const [k, n] of [['world', '世界'], ['guild', 'ギルド'], ['friend', 'フレンド']]) {
    const b = el('button', k === S.tab ? 'on' : '', n);
    b.dataset.tab = k;
    b.addEventListener('click', () => {
      S.tab = k;
      tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.tab === k));
      renderAll();
    });
    tabs.append(b);
  }
  const head = el('div', 'cp-head');
  const guild = el('div', 'cp-guild');
  const log = el('div', 'cp-log');
  const form = el('form');
  const inp = el('input');
  inp.maxLength = 120;
  inp.placeholder = 'メッセージ（120文字まで）';
  const send = el('button', 'cp-b', '送信');
  send.type = 'submit';
  form.append(inp, send);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sendChat(inp.value);
    inp.value = '';
  });
  // チャット入力中はゲームのキー操作に入力が流れないように
  for (const ev of ['keydown', 'keyup']) panel.addEventListener(ev, (e) => e.stopPropagation());
  panel.append(tabs, head, guild, log, form);
  document.body.append(btn, panel);
  Object.assign(S, { panel, head, guildBox: guild, log, inp });
}

function curChannel() {
  const { save } = S.opts;
  if (S.tab === 'world') return 'world';
  if (S.tab === 'guild') return save.guild ? 'g:' + save.guild.id : null;
  return S.dmPid ? dmCh(save.pid, S.dmPid) : null;
}
function sendChat(raw) {
  const t = clean(raw, 120);
  if (!t || !S.net) return;
  const ch = curChannel();
  if (!ch) return;
  // 連投対策：5秒に3件まで
  const now = Date.now();
  S.rate = S.rate.filter((x) => now - x < 5000);
  if (S.rate.length >= 3) {
    sys(S.tab, '送信が速すぎます。少し待ってください。');
    return;
  }
  S.rate.push(now);
  const { save, myName } = S.opts;
  const msg = { ch, t, pid: save.pid, name: myName(), gname: save.guild?.name || '' };
  S.net.chat(msg);
  onChat({ ...msg, from: S.net.myId, at: now, me: true });
}
function onChat(m) {
  const { save } = S.opts;
  if (!m.me && m.from === S.net?.myId) return;
  // 受信側の連投対策：同じ相手から5秒に4件まで
  if (!m.me) {
    const now = Date.now();
    const h = (S.lastFrom.get(m.from) || []).filter((x) => now - x < 5000);
    if (h.length >= 4) return;
    h.push(now);
    S.lastFrom.set(m.from, h);
  }
  let box;
  if (m.ch === 'world') box = S.logs.world;
  else if (m.ch.startsWith('g:')) {
    if (!save.guild || m.ch !== 'g:' + save.guild.id) return;
    box = S.logs.guild;
  } else {
    const [, a, b] = m.ch.split(':');
    if (a !== save.pid && b !== save.pid) return;
    const other = a === save.pid ? b : a;
    // フレンドからの個別メッセージだけ受け取る
    if (!save.friends.some((f) => f.pid === other)) return;
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
  if (S.panel && !S.panel.hidden) renderLog();
}

function renderAll() {
  renderHead();
  renderGuild();
  renderLog();
}
function onlineCount(filter) {
  return Object.values(S.peers).filter(filter).length;
}
function renderHead() {
  if (!S.head || S.panel.hidden) return;
  const { save } = S.opts;
  const h = S.head;
  h.replaceChildren();
  if (S.tab === 'world') {
    h.append(el('span', null, `世界チャット — 接続中 ${onlineCount(() => true)} 人`));
  } else if (S.tab === 'guild') {
    h.append(el('span', null, save.guild ? `ギルド「${save.guild.name}」 — オンライン ${onlineCount((p) => p.gid === save.guild.id)} 人` : 'ギルドに未所属'));
  } else {
    if (!save.friends.length) {
      h.append(el('span', null, 'フレンドがいません（世界の旅人パネルから申請できます）'));
      return;
    }
    const sel = el('select');
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
      renderLog();
    });
    h.append(el('span', null, '相手：'), sel);
  }
}
function renderGuild() {
  const g = S.guildBox;
  g.replaceChildren();
  g.hidden = S.tab !== 'guild';
  if (g.hidden) return;
  const { save, persist, sfx } = S.opts;
  if (save.guild) {
    const mem = Object.values(S.peers).filter((p) => p.gid === save.guild.id).map((p) => p.name);
    const row = el('div', 'row');
    row.append(el('span', null, `ギルドコード：${save.guild.id}`));
    const copy = el('button', 'cp-b', 'コピー');
    copy.type = 'button';
    copy.addEventListener('click', () => navigator.clipboard?.writeText(save.guild.id).catch(() => {}));
    const leave = el('button', 'cp-b', '脱退');
    leave.type = 'button';
    leave.addEventListener('click', () => {
      sfx?.('ui');
      S.api.news(`${S.opts.myName()} がギルド「${save.guild.name}」を去った`);
      save.guild = null;
      S.logs.guild = [];
      persist();
      publish();
      renderAll();
    });
    row.append(copy, leave);
    g.append(row, el('div', 'cp-mem', `オンラインの仲間：${mem.length ? mem.join('、') : 'なし'}`), el('div', 'cp-mem', 'コードを仲間に教えると、同じギルドに入れます。'));
    return;
  }
  const r1 = el('div', 'row');
  const nm = el('input');
  nm.maxLength = 16;
  nm.placeholder = '新しいギルド名';
  const mk = el('button', 'cp-b', '結成');
  mk.type = 'button';
  mk.addEventListener('click', () => {
    const name = clean(nm.value, 16);
    if (!name) return;
    sfx?.('burst');
    save.guild = { id: rid(), name };
    persist();
    publish();
    S.api.news(`${S.opts.myName()} がギルド「${name}」を結成した！`);
    renderAll();
  });
  r1.append(nm, mk);
  const r2 = el('div', 'row');
  const code = el('input');
  code.maxLength = 8;
  code.placeholder = 'ギルドコード（8文字）';
  const gname = el('input');
  gname.maxLength = 16;
  gname.placeholder = 'ギルド名（任意）';
  const join = el('button', 'cp-b', '加入');
  join.type = 'button';
  join.addEventListener('click', () => {
    const c = code.value.trim();
    if (!/^[A-Za-z0-9]{8}$/.test(c)) {
      sys('guild', 'ギルドコードは英数字8文字です。');
      renderLog();
      return;
    }
    // オンラインの仲間がいればそのギルド名を使う
    const known = Object.values(S.peers).find((p) => p.gid === c && p.gname)?.gname;
    const name = known || clean(gname.value, 16) || 'ギルド';
    sfx?.('burst');
    save.guild = { id: c, name };
    persist();
    publish();
    S.api.news(`${S.opts.myName()} がギルド「${name}」に加わった！`);
    renderAll();
  });
  r2.append(code, gname, join);
  g.append(el('div', 'cp-mem', 'ギルドを結成するか、仲間のコードで加入しましょう。'), r1, r2);
}
function renderLog() {
  if (!S.log || S.panel.hidden) return;
  const { save } = S.opts;
  let box = S.logs.world;
  if (S.tab === 'guild') box = S.logs.guild;
  else if (S.tab === 'friend') box = S.logs.friend[S.dmPid] || [];
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
  S.log.scrollTop = S.log.scrollHeight;
  const ch = curChannel();
  S.inp.disabled = !ch;
  S.inp.placeholder = ch ? 'メッセージ（120文字まで）' : S.tab === 'guild' ? 'ギルドに未所属です' : 'フレンドを選んでください';
}
