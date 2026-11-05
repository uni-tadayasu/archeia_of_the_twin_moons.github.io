// 交流機能：画面上部のお知らせテロップ・世界／ギルド／フレンドチャット・ギルド
import { connectSocial, saveChiefEvent, loadChiefEvent, donateGuild, guildDonors, guildBoard } from './net.js';
// ---------- ギルド寄付とランキング ----------
function renderDonate(g) {
  const { save, persist, sfx, myName } = S.opts;
  const G = save.guild;
  const box = el('div');
  box.style.cssText = 'border-top:1px solid rgba(214,180,106,.35);margin-top:6px;padding-top:6px;display:grid;gap:4px';
  box.append(el('b', null, '灯晶の寄付'));
  const r = el('div', 'row');
  const inp = el('input');
  inp.type = 'number';
  inp.min = 1;
  inp.step = 100;
  inp.placeholder = `寄付額（手持ち ${save.shards}）`;
  inp.style.flex = '1';
  const btn = el('button', 'cp-b', '寄付');
  btn.type = 'button';
  const msg = el('div', 'cp-mem', '');
  btn.addEventListener('click', async () => {
    const amt = Math.floor(+inp.value);
    if (!(amt > 0)) { msg.textContent = '寄付額を入力してください。'; return; }
    if (amt > save.shards) { msg.textContent = '灯晶が足りません。'; return; }
    if (!confirm(`ギルド「${G.name}」に灯晶 ${amt} を寄付しますか？（戻せません）`)) return;
    btn.disabled = true;
    try {
      save.shards -= amt;
      persist();
      const total = await donateGuild(G.id, G.name, save.pid, myName(), amt);
      sfx?.('burst');
      msg.textContent = `寄付しました！あなたの累計：${total}`;
      if (amt >= 1000) S.api.news(`${myName()} がギルド「${G.name}」に灯晶 ${amt} を寄付した！`);
      inp.value = '';
      inp.placeholder = `寄付額（手持ち ${save.shards}）`;
      loadRanks(rankBox, S.rankView || 'member');
    } catch (err) {
      console.warn(err);
      save.shards += amt; // 失敗したら返す
      persist();
      msg.textContent = '寄付できませんでした（オンライン接続を確認してください）。';
    }
    btn.disabled = false;
  });
  r.append(inp, btn);
  box.append(r, msg);
  // ランキング（ギルド内／全ギルド）
  const tabs = el('div', 'row');
  for (const [k, n] of [['member', 'メンバー寄付ランキング'], ['guild', 'ギルドランキング']]) {
    const b = el('button', 'cp-b', n);
    b.type = 'button';
    if ((S.rankView || 'member') === k) b.style.outline = '1px solid #ffd36a';
    b.addEventListener('click', () => { S.rankView = k; renderAll(); });
    tabs.append(b);
  }
  const rankBox = el('div');
  rankBox.style.cssText = 'display:grid;gap:2px';
  box.append(tabs, rankBox);
  g.append(box);
  loadRanks(rankBox, S.rankView || 'member');
}
async function loadRanks(box, view) {
  const { save } = S.opts;
  box.replaceChildren(el('div', 'cp-mem', '読み込み中…'));
  try {
    const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}位`);
    if (view === 'guild') {
      const list = await guildBoard();
      box.replaceChildren();
      if (!list.length) box.append(el('div', 'cp-mem', 'まだ寄付したギルドはありません。'));
      list.forEach((x, i) => {
        const d = el('div', 'cp-mem', `${medal(i)}　${x.gname}　灯晶 ${x.total.toLocaleString()}（寄付者 ${x.members}人）`);
        if (x.gid === save.guild?.id) d.style.color = '#ffd36a';
        box.append(d);
      });
    } else {
      const list = await guildDonors(save.guild.id);
      box.replaceChildren();
      const sum = list.reduce((s, x) => s + x.total, 0);
      box.append(el('div', 'cp-mem', `ギルドの寄付総額：灯晶 ${sum.toLocaleString()}`));
      if (!list.length) box.append(el('div', 'cp-mem', 'まだ寄付した人はいません。最初の寄付者になろう！'));
      list.forEach((x, i) => {
        const d = el('div', 'cp-mem', `${medal(i)}　${x.name}　灯晶 ${x.total.toLocaleString()}`);
        if (x.pid === save.pid) d.style.color = '#ffd36a';
        box.append(d);
      });
    }
  } catch (err) {
    console.warn(err);
    box.replaceChildren(el('div', 'cp-mem', 'ランキングを読み込めませんでした。'));
  }
}
// DBに保存された特別イベントを取り込む（起動時・定期・タブ復帰時）
async function pullChiefEvent() {
  try {
    const n = await loadChiefEvent();
    if (!n || !(await S.opts.verifyChief?.(n.tk))) return;
    S.opts.onChiefEvent?.(n);
    rebuildTicker();
  } catch (err) {
    console.warn(err);
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
  S = { opts, net: null, peers: {}, logs: { world: [], guild: [], friend: {}, staff: [] }, tab: 'world', dmPid: '', unread: 0, news: [], rate: [], lastFrom: new Map() };
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  buildTicker();
  buildChat();
  // 交流ルームへ接続（失敗しても本編は動く）
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
  connectSocial({
    onPeers: (p) => {
      const before = new Set(Object.values(S.peers).map((x) => x.pid));
      S.peers = p;
      // 新しく来た旅人をお知らせ
      if (S.net && S.ready) {
        for (const x of Object.values(p)) {
          if (x.id !== S.net.myId && x.pid && !before.has(x.pid)) pushNews(`${x.name} が双月の世界に降り立った`);
        }
      }
      S.ready = true;
      syncGuildMaster();
      renderHead();
      if (!S.panel.hidden) renderGuild();
    },
    onChiefNews: async (n) => {
      if (n.from === S.net?.myId) return;
      if (S.chiefNews && n.at <= S.chiefNews.at) return;
      if (!(await S.opts.verifyChief?.(n.tk))) return;
      S.chiefNews = { list: n.list, at: n.at };
      localStorage.setItem('arkeia-chief-news', JSON.stringify(S.chiefNews));
      rebuildTicker();
    },
    onChiefEvent: async (n) => {
      if (n.from === S.net?.myId) return;
      if (!(await S.opts.verifyChief?.(n.tk))) return;
      S.opts.onChiefEvent?.(n);
      rebuildTicker();
    },
    onGuildRole: onGuildRole,
    onChat: onChat,
    onNews: (n) => {
      if (n.from === S.net?.myId) return;
      pushNews(n.t);
    }
  }).then((n) => {
    S.net = n;
    publish();
    broadcastChief();
    pullChiefEvent();
    setInterval(pullChiefEvent, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pullChiefEvent(); });
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
    sendEvent: () => {
      const own = S.opts.ownEvent?.();
      if (own && S.opts.isChief?.()) saveChiefEvent(own.ev, S.opts.roleToken?.() || '', own.at).catch((err) => console.warn(err));
      broadcastChief();
      rebuildTicker();
    },
    refresh: () => {
      publish();
      rebuildTicker();
    }
  };
  return S.api;
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
function broadcastChief() {
  if (!S?.net || !S.opts.isChief?.()) return;
  const list = S.chiefOwn;
  S.chiefNews = { list, at: Date.now() };
  localStorage.setItem('arkeia-chief-news', JSON.stringify(S.chiefNews));
  S.net.chiefNews(list, S.opts.roleToken?.() || '');
  const own = S.opts.ownEvent?.();
  if (own) S.net.chiefEvent(own.ev, S.opts.roleToken?.() || '', own.at);
}
function saveChiefOwn() {
  localStorage.setItem('arkeia-chief-own', JSON.stringify(S.chiefOwn));
  broadcastChief();
  rebuildTicker();
}

// ---------- ギルドの役職 ----------
export const GUILD_ROLES = { master: 'ギルドマスター', sub: 'サブマスター', officer: '幹部', member: 'メンバー' };
const RANK = { master: 3, sub: 2, officer: 1, member: 0 };
// 加入直後はマスターを知らないので、オンラインの仲間の申告から補う
function syncGuildMaster() {
  const g = S.opts.save.guild;
  if (!g || g.master) return;
  const m = Object.values(S.peers).find((p) => p.gid === g.id && p.gm)?.gm;
  if (m) {
    g.master = m;
    S.opts.persist();
    publish();
  }
}
function myRank() {
  const g = S.opts.save.guild;
  return g ? RANK[g.role] ?? 0 : -1;
}
function setRole(target, role) {
  const { save, myName } = S.opts;
  const g = save.guild;
  if (!g || !S.net) return;
  S.net.guildRole({ gid: g.id, pid: target.pid, role, by: save.pid, name: myName() });
  onGuildRole({ gid: g.id, pid: target.pid, role, by: save.pid, local: true, tname: target.name });
}
function onGuildRole(e) {
  const { save, persist, myName } = S.opts;
  const g = save.guild;
  if (!g || e.gid !== g.id) return;
  // 権限の確認：マスターは全て、サブマスターは幹部・メンバーの変更と除名のみ
  const byMaster = e.by === g.master;
  const byPeer = Object.values(S.peers).find((p) => p.pid === e.by && p.gid === g.id);
  const bySub = byPeer?.grole === 'sub';
  const tgtPeer = Object.values(S.peers).find((p) => p.pid === e.pid && p.gid === g.id);
  const tgtRank = e.pid === save.pid ? RANK[g.role] : RANK[tgtPeer?.grole] ?? 0;
  const ok = byMaster || (bySub && ['officer', 'member', 'kick'].includes(e.role) && tgtRank < 2);
  if (!ok) return;
  if (e.role === 'master') {
    // マスターの譲渡：旧マスターはサブマスターに
    if (save.pid === g.master && e.pid !== save.pid) g.role = 'sub';
    g.master = e.pid;
  }
  const label = e.role === 'kick' ? '除名' : GUILD_ROLES[e.role];
  const tname = e.tname || tgtPeer?.name || (e.pid === save.pid ? myName() : '仲間');
  if (e.pid === save.pid) {
    if (e.role === 'kick') {
      sys('guild', `ギルド「${g.name}」から除名されました。`);
      save.guild = null;
      S.logs.guild = [];
    } else {
      g.role = e.role;
      sys('guild', `あなたの役職が「${label}」になりました。`);
    }
  } else {
    sys('guild', `${tname} が「${label}」になりました。`);
  }
  persist();
  publish();
  if (!S.panel.hidden) renderAll();
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
  for (const [k, n] of [['world', '世界'], ['guild', 'ギルド'], ['friend', 'フレンド'], ['staff', '運営会議'], ['online', '接続一覧'], ['chief', 'お知らせ管理']]) {
    const b = el('button', k === S.tab ? 'on' : '', n);
    b.dataset.tab = k;
    if (k === 'online') S.onlineTab = b;
    if (k === 'chief') S.chiefTab = b;
    if (k === 'staff') S.staffTab = b;
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
  if (S.tab === 'staff') return isStaff() ? 'staff' : null;
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
  const msg = { ch, t, pid: save.pid, name: myName(), gname: ch === 'staff' ? (S.opts.isChief?.() ? '運営長' : '運営') : save.guild?.name || '' };
  if (ch === 'staff') msg.tk = S.opts.roleToken?.() || '';
  S.net.chat(msg);
  onChat({ ...msg, from: S.net.myId, at: now, me: true });
}
function onChat(m) {
  const { save } = S.opts;
  if (!m.me && m.from === S.net?.myId) return;
  // 受信側の連投対策：同じ相手から5秒に4件まで
  if (!m.me && !m.verified) {
    const now = Date.now();
    const h = (S.lastFrom.get(m.from) || []).filter((x) => now - x < 5000);
    if (h.length >= 4) return;
    h.push(now);
    S.lastFrom.set(m.from, h);
  }
  let box;
  if (m.ch === 'world') box = S.logs.world;
  else if (m.ch === 'staff') {
    // 運営会議：自分が運営長/運営で、送信者の役職トークンが確認できたものだけ
    if (!isStaff()) return;
    if (!m.me && !m.verified) {
      Promise.resolve(S.opts.verifyStaff?.(m.tk) ?? true).then((ok) => { if (ok) onChat({ ...m, verified: true, from: m.from + '' }); }).catch(() => {});
      return;
    }
    box = S.logs.staff;
  } else if (m.ch.startsWith('g:')) {
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
  const chief = !!S.opts.isChief?.();
  S.chiefTab.hidden = !chief;
  if (S.tab === 'chief' && !chief) S.tab = 'world';
  const staff = isStaff();
  S.staffTab.hidden = !staff;
  if (S.tab === 'staff' && !staff) S.tab = 'world';
  S.onlineTab.hidden = !staff;
  if (S.tab === 'online' && !staff) S.tab = 'world';
  S.panel.querySelectorAll('.cp-tabs button').forEach((x) => x.classList.toggle('on', x.dataset.tab === S.tab));
  const form = S.panel.querySelector('form');
  const noChat = S.tab === 'chief' || S.tab === 'online';
  form.hidden = noChat;
  S.log.hidden = noChat;
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
    up.addEventListener('click', () => {
      [S.chiefOwn[i - 1], S.chiefOwn[i]] = [S.chiefOwn[i], S.chiefOwn[i - 1]];
      saveChiefOwn();
      renderAll();
    });
    const del = el('button', 'cp-b', '削除');
    del.type = 'button';
    del.addEventListener('click', () => {
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
  clr.addEventListener('click', () => {
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
    const r = el('div', 'cp-mem', `● ${p.name}${p.me ? '（あなた）' : ''}${p.st ? '【運営】' : ''}${p.gname ? `　[${p.gname}]` : ''}${p.pid ? `　#${String(p.pid).slice(0, 6)}` : ''}`);
    g.append(r);
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
  const { save, persist, sfx } = S.opts;
  if (save.guild) {
    const G = save.guild;
    const row0 = el('div', 'row');
    row0.append(el('b', null, `「${G.name}」`), el('span', null, `あなたの役職：${GUILD_ROLES[G.role] || 'メンバー'}`));
    g.append(row0);
    // オンラインの仲間と役職（マスター・サブマスターは役職を変更できる）
    const mine = myRank();
    const mems = Object.values(S.peers).filter((p) => p.gid === G.id && p.pid !== save.pid);
    mems.sort((a, b) => (RANK[b.grole] ?? 0) - (RANK[a.grole] ?? 0));
    if (!mems.length) g.append(el('div', 'cp-mem', 'オンラインの仲間：なし'));
    for (const p of mems) {
      const r = el('div', 'row');
      const pr = p.pid === G.master ? 'master' : p.grole;
      r.append(el('span', 'cp-mem', `● ${p.name}［${GUILD_ROLES[pr] || 'メンバー'}］`));
      const canEdit = mine === 3 || (mine === 2 && (RANK[pr] ?? 0) < 2);
      if (canEdit && pr !== 'master') {
        const sel = el('select');
        const opts = mine === 3 ? ['sub', 'officer', 'member', 'master'] : ['officer', 'member'];
        for (const o of opts) {
          const op = el('option', null, o === 'master' ? 'マスターを譲る' : GUILD_ROLES[o]);
          op.value = o;
          sel.append(op);
        }
        sel.value = opts.includes(pr) ? pr : 'member';
        sel.addEventListener('change', () => {
          if (sel.value === 'master' && !confirm(`${p.name} にギルドマスターを譲りますか？`)) {
            sel.value = pr;
            return;
          }
          sfx?.('ui');
          setRole(p, sel.value);
        });
        const kick = el('button', 'cp-b', '除名');
        kick.type = 'button';
        kick.addEventListener('click', () => {
          if (confirm(`${p.name} をギルドから除名しますか？`)) setRole(p, 'kick');
        });
        r.append(sel, kick);
      }
      g.append(r);
    }
    const row = el('div', 'row');
    row.append(el('span', null, `ギルドコード：${save.guild.id}`));
    const copy = el('button', 'cp-b', 'コピー');
    copy.type = 'button';
    copy.addEventListener('click', () => navigator.clipboard?.writeText(save.guild.id).catch(() => {}));
    const leave = el('button', 'cp-b', '脱退');
    leave.type = 'button';
    leave.addEventListener('click', () => {
      sfx?.('ui');
      // マスターが抜ける時は、オンラインで最上位の仲間へ自動で譲る
      if (G.role === 'master' && mems[0]) S.net?.guildRole({ gid: G.id, pid: mems[0].pid, role: 'master', by: save.pid, name: S.opts.myName() });
      S.api.news(`${S.opts.myName()} がギルド「${save.guild.name}」を去った`);
      save.guild = null;
      S.logs.guild = [];
      persist();
      publish();
      renderAll();
    });
    row.append(copy, leave);
    g.append(row, el('div', 'cp-mem', '役職：ギルドマスター＞サブマスター＞幹部＞メンバー。コードを仲間に教えると、同じギルドに入れます。'));
    renderDonate(g);
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
    save.guild = { id: rid(), name, role: 'master', master: save.pid };
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
    const master = Object.values(S.peers).find((p) => p.gid === c && p.gm)?.gm || '';
    save.guild = { id: c, name, role: 'member', master };
    persist();
    publish();
    S.api.news(`${S.opts.myName()} がギルド「${name}」に加わった！`);
    renderAll();
  });
  r2.append(code, gname, join);
  g.append(el('div', 'cp-mem', 'ギルドを結成するか、仲間のコードで加入しましょう。'), r1, r2);
}
function renderLog() {
  if (!S.log || S.panel.hidden || S.tab === 'chief') return;
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
  S.log.scrollTop = S.log.scrollHeight;
  const ch = curChannel();
  S.inp.disabled = !ch;
  S.inp.placeholder = ch ? 'メッセージ（120文字まで）' : S.tab === 'guild' ? 'ギルドに未所属です' : 'フレンドを選んでください';
}
