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
export async function syncPush(h, json) {
  if (!HEX64.test(h) || typeof json !== 'string' || json.length > 200000) throw new Error('bad data');
  const { db, id } = await getDb();
  const row = await findOne('syncsaves', h);
  await db.transact(db.tx.syncsaves[row?.id || id()].update({ h, data: json, at: Date.now() }));
}
export async function syncPull(h) {
  if (!HEX64.test(h)) return null;
  const row = await findOne('syncsaves', h);
  return typeof row?.data === 'string' && row.data.length <= 200000 ? row.data : null;
}

// ---- 交流用の常設ルーム（チャット・お知らせ・ギルド） ----
const CH_RE = /^(world|g:[A-Za-z0-9]{8}|dm:[A-Za-z0-9]{1,24}:[A-Za-z0-9]{1,24})$/;
const txt = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').slice(0, n);
export async function connectSocial(handlers) {
  const { db, id } = await getDb();
  const myId = id();
  const room = db.joinRoom('arkeia', 'social-global');
  room.subscribePresence({}, (data) => {
    const peers = {};
    for (const p of Object.values(data.peers || {})) {
      if (!p || typeof p !== 'object') continue;
      const s = { id: str(p.id, 40), pid: str(p.pid, 24), name: str(p.name, 12) || '旅人', gid: /^[A-Za-z0-9]{8}$/.test(p.gid) ? p.gid : '', gname: txt(p.gname, 16), grole: ['master', 'sub', 'officer', 'member'].includes(p.grole) ? p.grole : 'member', gm: str(p.gm, 24) };
      if (s.id) peers[s.id] = s;
    }
    handlers.onPeers?.(peers);
  });
  room.subscribeTopic('chat', (e) => {
    if (!e || typeof e !== 'object' || !CH_RE.test(e.ch)) return;
    const t = txt(e.t, 120).trim();
    if (!t) return;
    handlers.onChat?.({ ch: e.ch, t, from: str(e.from, 40), pid: str(e.pid, 24), name: str(e.name, 12) || '旅人', gname: txt(e.gname, 16), at: Date.now() });
  });
  room.subscribeTopic('news', (e) => {
    if (!e || typeof e !== 'object') return;
    if (e.kind === 'chief') {
      // 運営長のお知らせ一覧（最大10件）
      const list = Array.isArray(e.list) ? e.list.slice(0, 10).map((x) => txt(x, 80).trim()).filter(Boolean) : [];
      handlers.onChiefNews?.({ list, tk: typeof e.tk === 'string' && e.tk.length < 1500 ? e.tk : '', at: num(e.at, 1e13), from: str(e.from, 40) });
      return;
    }
    if (e.kind === 'cevent') {
      // 運営長の特別イベント（中身は受信側で sanitizeEvent・役職トークンで検証）
      if (e.ev === null || (e.ev && typeof e.ev === 'object')) handlers.onChiefEvent?.({ ev: e.ev, tk: typeof e.tk === 'string' && e.tk.length < 1500 ? e.tk : '', at: num(e.at, 1e13), from: str(e.from, 40) });
      return;
    }
    const t = txt(e.t, 80).trim();
    if (t) handlers.onNews?.({ t, from: str(e.from, 40) });
  });
  // ギルドの役職変更（ギルドマスターのみ有効。受信側で検証）
  room.subscribeTopic('grole', (e) => {
    if (!e || typeof e !== 'object' || !/^[A-Za-z0-9]{8}$/.test(e.gid)) return;
    const role = ['master', 'sub', 'officer', 'member', 'kick'].includes(e.role) ? e.role : null;
    if (role) handlers.onGuildRole?.({ gid: e.gid, pid: str(e.pid, 24), role, by: str(e.by, 24), name: txt(e.name, 16) });
  });
  return {
    myId,
    publish: (s) => room.publishPresence({ ...s, id: myId }),
    chat: (e) => room.publishTopic('chat', { ...e, from: myId }),
    news: (t) => room.publishTopic('news', { t, from: myId }),
    chiefNews: (list, tk) => room.publishTopic('news', { kind: 'chief', list, tk, at: Date.now(), from: myId }),
    chiefEvent: (ev, tk, at) => room.publishTopic('news', { kind: 'cevent', ev, tk, at, from: myId }),
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
