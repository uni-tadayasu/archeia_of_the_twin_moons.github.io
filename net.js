// InstantDB はオンラインモード選択時にのみ動的読み込み（初期ロード軽量化）
let dbPromise = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = Promise.all([
      import('@instantdb/core'),
      import('./instant_db_config.js')
    ]).then(([lib, cfg]) => ({ db: lib.init({ appId: cfg.INSTANT_DB_APP_ID }), id: lib.id }));
  }
  return dbPromise;
}

const num = (v, lim = 1e5) => (Number.isFinite(+v) ? Math.max(-lim, Math.min(lim, +v)) : 0);
const str = (v, n = 16) => String(v ?? '').replace(/[<>&"']/g, '').slice(0, n);

export function sanitizePresence(p) {
  if (!p || typeof p !== 'object') {
    return null;
  }
  return {
    id: str(p.id, 40), name: str(p.name, 12) || '旅人', fk: str(p.fk, 12), mode: str(p.mode, 12),
    x: num(p.x, 50), z: num(p.z, 50), ry: num(p.ry, 10), hp: num(p.hp, 99999), mv: !!p.mv, ready: !!p.ready,
    role: str(p.role, 8), ch: Math.floor(num(p.ch, 99)), ib: !!p.ib,
    pid: str(p.pid, 24), fx: num(p.fx, 700), fz: num(p.fz, 700),
    gw: /^w\d{1,2}$/.test(p.gw) ? p.gw : '', ga: /^a\d{1,2}$/.test(p.ga) ? p.ga : '',
    // サーバー署名の戦闘プロフィール（受信側で検証）
    prof: typeof p.prof === 'string' && /^[A-Za-z0-9_\-.]{20,1500}$/.test(p.prof) ? p.prof : ''
  };
}

// ---- 保存データ操作（招待コード・端末間同期）。値はすべてハッシュ化して保存する ----
const HEX64 = /^[0-9a-f]{64}$/;
async function findOne(ns, h) {
  const { db } = await getDb();
  const res = await db.queryOnce({ [ns]: { $: { where: { h } } } });
  return res?.data?.[ns]?.[0] || null;
}
// 運営長が発行：1回限りの運営招待コード（ハッシュのみ保存）
export async function issueInvite(h) {
  if (!HEX64.test(h)) throw new Error('bad hash');
  const { db, id } = await getDb();
  await db.transact(db.tx.opinvites[id()].update({ h, used: false, at: Date.now() }));
}
// 招待コードを使う：未使用なら使用済みにして true
export async function redeemInvite(h) {
  if (!HEX64.test(h)) return false;
  const row = await findOne('opinvites', h);
  if (!row || row.used) return false;
  const { db } = await getDb();
  await db.transact(db.tx.opinvites[row.id].update({ used: true, usedAt: Date.now() }));
  return true;
}
// 端末間同期：同期コードのハッシュをキーに、セーブデータ(JSON文字列)を置く
// 版番号(ver)で競合を検出：手元の版と違えば最新を返して端末側で合流させる
export async function syncPush(h, json, base = 0) {
  if (!HEX64.test(h) || typeof json !== 'string' || json.length > 200000) throw new Error('bad data');
  const { db, id } = await getDb();
  const row = await findOne('syncsaves', h);
  const ver = +row?.ver || 0;
  if (row && ver !== base) return { conflict: true, data: typeof row.data === 'string' ? row.data : '{}', ver };
  await db.transact(db.tx.syncsaves[row?.id || id()].update({ h, data: json, at: Date.now(), ver: ver + 1 }));
  return { ok: true, ver: ver + 1 };
}
export async function syncPullV(h) {
  if (!HEX64.test(h)) return { data: null, ver: 0 };
  const row = await findOne('syncsaves', h);
  return { data: typeof row?.data === 'string' && row.data.length <= 200000 ? row.data : null, ver: +row?.ver || 0 };
}

// ---- 運営長の特別イベント（DBに保存し、後から来た人・他端末も読めるようにする） ----
// サーバー未設定時のみ端末から書き込む（役職トークンは保存しない。sig は内容に結びついた公開署名）
export async function saveChiefEvent(body, sig, at) {
  const { db, id } = await getDb();
  const row = await findOne('chiefevents', 'current');
  if (row && +row.at >= at) return false;
  await db.transact(db.tx.chiefevents[row?.id || id()].update({ h: 'current', ev: String(body), sig: String(sig || ''), at }));
  return true;
}
export async function loadChiefEvent() {
  const row = await findOne('chiefevents', 'current');
  if (!row || typeof row.ev !== 'string' || row.ev.length > 20000) return null;
  return { body: row.ev, sig: typeof row.sig === 'string' && row.sig.length < 1500 ? row.sig : '', at: num(row.at, 1e13), from: '' };
}

// ---- ギルド寄付ランキング（サーバー未設定時の読み取り専用。書き込みはサーバーのみ） ----
const GID_RE = /^[A-Za-z0-9]{8}$/;
const donRow = (r) => ({ gid: String(r.gid || ''), gname: txt(r.gname, 16) || 'ギルド', pid: str(r.pid, 24), name: txt(r.name, 12) || '旅人', total: Math.max(0, Math.min(1e12, Math.floor(+r.total || 0))) });
// ギルド内のメンバー寄付ランキング
export async function guildDonors(gid) {
  if (!GID_RE.test(gid)) return [];
  const { db } = await getDb();
  const res = await db.queryOnce({ guilddonations: { $: { where: { gid } } } });
  return (res?.data?.guilddonations || []).map(donRow).filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
}
// 全ギルドの寄付総額ランキング
export async function guildBoard() {
  const { db } = await getDb();
  const res = await db.queryOnce({ guilddonations: {} });
  const m = new Map();
  for (const r of (res?.data?.guilddonations || []).map(donRow)) {
    if (!GID_RE.test(r.gid) || r.total <= 0) continue;
    const g = m.get(r.gid) || { gid: r.gid, gname: r.gname, total: 0, members: 0 };
    g.total += r.total;
    g.members++;
    if (r.gname) g.gname = r.gname;
    m.set(r.gid, g);
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, 50);
}

// ---- 交流用の常設ルーム（チャット・お知らせ・ギルド） ----
const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').slice(0, n);
function chatMsg(e, ch) {
  const t = txt(e.t, 120).trim();
  if (!t) return null;
  return { ch, t, from: str(e.from, 40), pid: str(e.pid, 24), name: str(e.name, 12) || '旅人', gname: txt(e.gname, 16), at: Date.now() };
}
// チャンネル専用ルーム：ルーム名は参加資格を確認したサーバーが渡す（サーバー未設定時は端末で導出）
// 受信メッセージのチャンネルは、送信者の申告ではなく「どのルームで受けたか」で決める
export async function joinChannel(roomKey, ch, myId, onChat) {
  if (!/^[0-9a-f]{16,64}$/.test(roomKey)) throw new Error('bad room');
  const { db } = await getDb();
  const room = db.joinRoom('arkeia', 'ch-' + roomKey);
  room.subscribeTopic('chat', (e) => {
    if (!e || typeof e !== 'object') return;
    const m = chatMsg(e, ch);
    if (m) onChat(m);
  });
  return {
    send: (e) => room.publishTopic('chat', { t: e.t, pid: e.pid, name: e.name, gname: e.gname, from: myId }),
    leave: () => {
      try {
        room.leaveRoom?.();
      } catch (err) {
        console.warn(err);
      }
    }
  };
}
export async function connectSocial(handlers) {
  const { db, id } = await getDb();
  const myId = id();
  const room = db.joinRoom('arkeia', 'social-global');
  room.subscribePresence({}, (data) => {
    const peers = {};
    for (const p of Object.values(data.peers || {})) {
      if (!p || typeof p !== 'object') continue;
      const s = { id: str(p.id, 40), pid: str(p.pid, 24), name: str(p.name, 12) || '旅人', gid: /^[A-Za-z0-9]{8}$/.test(p.gid) ? p.gid : '', gname: txt(p.gname, 16), grole: ['master', 'sub', 'officer', 'member'].includes(p.grole) ? p.grole : 'member', gm: str(p.gm, 24), st: p.st === 1 };
      if (s.id) peers[s.id] = s;
    }
    handlers.onPeers?.(peers);
  });
  // 共有ルームで扱うのは世界チャットだけ（ギルド・フレンド・運営会議は joinChannel の専用ルーム）
  room.subscribeTopic('chat', (e) => {
    if (!e || typeof e !== 'object' || e.ch !== 'world') return;
    const m = chatMsg(e, 'world');
    if (m) handlers.onChat?.(m);
  });
  const sigOf = (v) => (typeof v === 'string' && v.length < 1500 ? v : '');
  const bodyOf = (v, n) => (typeof v === 'string' && v.length <= n ? v : null);
  room.subscribeTopic('news', (e) => {
    if (!e || typeof e !== 'object') return;
    if (e.kind === 'chief' || e.kind === 'cevent') {
      // 運営長のお知らせ／特別イベント：本文(JSON文字列)と、その内容に結びついた公開署名
      const body = bodyOf(e.body, e.kind === 'chief' ? 2000 : 20000);
      if (body == null) return;
      const n = { body, sig: sigOf(e.sig), at: num(e.at, 1e13), from: str(e.from, 40) };
      if (e.kind === 'chief') handlers.onChiefNews?.(n);
      else handlers.onChiefEvent?.(n);
      return;
    }
    const t = txt(e.t, 80).trim();
    if (t) handlers.onNews?.({ t, from: str(e.from, 40) });
  });
  // ギルドの変更通知。サーバー利用時は「再取得の合図」だけで、中身は信用しない
  room.subscribeTopic('grole', (e) => {
    if (!e || typeof e !== 'object' || !/^[A-Za-z0-9]{8}$/.test(e.gid)) return;
    const role = ['master', 'sub', 'officer', 'member', 'kick'].includes(e.role) ? e.role : null;
    handlers.onGuildRole?.({ gid: e.gid, pid: str(e.pid, 24), role, by: str(e.by, 24), name: txt(e.name, 16), hint: !role });
  });
  return {
    myId,
    publish: (s) => room.publishPresence({ ...s, id: myId }),
    chat: (e) => room.publishTopic('chat', { ...e, ch: 'world', from: myId }),
    news: (t) => room.publishTopic('news', { t, from: myId }),
    chiefNews: (body, sig, at) => room.publishTopic('news', { kind: 'chief', body, sig, at, from: myId }),
    chiefEvent: (body, sig, at) => room.publishTopic('news', { kind: 'cevent', body, sig, at, from: myId }),
    guildRole: (e) => room.publishTopic('grole', e),
    leave: () => {
      try {
        room.leaveRoom?.();
      } catch (err) {
        console.warn(err);
      }
    }
  };
}

export async function connect(mode, roomCode, handlers) {
  const { db, id } = await getDb();
  const myId = id();
  const room = db.joinRoom('arkeia', `${mode}-${roomCode}`);
  room.subscribePresence({}, (data) => {
    const peers = {};
    for (const p of Object.values(data.peers || {})) {
      const s = sanitizePresence(p);
      if (s && s.id) {
        peers[s.id] = s;
      }
    }
    handlers.onPeers(peers);
  });
  room.subscribeTopic('cast', (e) => {
    if (e && typeof e === 'object') {
      handlers.onCast({ id: str(e.id, 40), slot: typeof e.slot === 'string' && (/^[sf]\d{1,2}$/.test(e.slot) || e.slot === 'over' || e.slot === 'hi') ? e.slot : 's0', tx: num(e.tx, 50), tz: num(e.tz, 50), ry: num(e.ry, 10) });
    }
  });
  room.subscribeTopic('hit', (e) => {
    if (e && typeof e === 'object') {
      handlers.onHit({ from: str(e.from, 40), to: str(e.to, 40), dmg: Math.min(400, Math.abs(num(e.dmg))), stun: Math.min(1, Math.abs(num(e.stun))), kx: num(e.kx, 12), kz: num(e.kz, 12), st: ['burn', 'freeze', 'para', 'slow', 'petrify', 'blind', 'curse', 'silence', 'poison', 'bleed'].includes(e.st) ? e.st : null });
    }
  });
  room.subscribeTopic('boss', (e) => {
    if (e && typeof e === 'object') {
      handlers.onBoss({ x: num(e.x, 50), z: num(e.z, 50), ry: num(e.ry, 10), hp: num(e.hp, 99999), mv: !!e.mv });
    }
  });
  room.subscribeTopic('invade', (e) => {
    if (e && typeof e === 'object') {
      handlers.onInvade?.({ to: str(e.to, 40), from: str(e.from, 40), name: str(e.name, 12) || '運営', tk: typeof e.tk === 'string' && e.tk.length < 1500 ? e.tk : '' });
    }
  });
  // 旅人どうしの申請（決闘・フレンド）
  const REQ = ['duel', 'duelok', 'dueldeny', 'friend', 'friendok', 'frienddeny'];
  room.subscribeTopic('req', (e) => {
    if (e && typeof e === 'object' && REQ.includes(e.kind)) {
      handlers.onReq?.({ kind: e.kind, to: str(e.to, 40), from: str(e.from, 40), pid: str(e.pid, 24), name: str(e.name, 12) || '旅人', fk: str(e.fk, 12) });
    }
  });
  return {
    myId,
    req: (e) => room.publishTopic('req', { ...e, from: myId }),
    invade: (e) => room.publishTopic('invade', e),
    publish: (s) => room.publishPresence({ ...s, id: myId }),
    cast: (e) => room.publishTopic('cast', e),
    hit: (e) => room.publishTopic('hit', { ...e, from: myId }),
    boss: (e) => room.publishTopic('boss', e),
    leave: () => {
      try {
        room.leaveRoom?.();
      } catch (err) {
        console.warn(err);
      }
    }
  };
}
