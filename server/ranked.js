import {
  RANK_TIERS, RANK_FIGHT_MS, BOT_WAIT_MS, BOT_RETRY_MS, BOT_CHANCE, BOT_DAILY_WINS,
  rankTier, pointsFor, withinRating, botStrength, newFight, cleanInput, emptyRankInput, stepFight
} from './ranked-rules.js';

export const RANK_PROTOCOL = 'riftfall-ranked-v1';
const QUEUE_TTL = 17000;
const MATCH_TTL = 12 * 60000;
const FIRST_MATCH_TTL = 350000;
const READY_MS = 100000;
const COUNTDOWN_MS = 3000;
const RESULT_MS = 24000;
const DISCONNECT_MS = 22000;
const DAY_MS = 86400000;
const sendJson = (payload, status=200) => Response.json(payload,{status});
const cursor = (sql,query,...args) => sql.exec(query,...args).toArray();
const first = (sql,query,...args) => cursor(sql,query,...args)[0];
const stubFor = (binding,name) => binding.get(binding.idFromName(name));
const safeId = id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);
const randomId = () => crypto.randomUUID().replaceAll('-','');
const ticket = () => randomId()+randomId().slice(0,16);
const hub = env => stubFor(env.RANK_HUB,'global-ranked-v1');
export const callRankHub = (env, action, data) => hub(env).fetch('https://ranked.internal/'+action,{
  method:'POST', body:JSON.stringify(data)
});
export const publicRankFighter = p => ({name:p.name, fighter:p.fighter, tier:rankTier(p.points), bot:!!p.bot});
function credentials(req) {
  const parts=(req.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(value=>value.trim());
  const match=parts.find(value=>/^rf-[a-f0-9]{48}$/.test(value));
  return parts.includes(RANK_PROTOCOL) && match ? match.slice(3) : null;
}
export async function openRankSocket(req, env, matchId) {
  if (!env.RANK_HUB || !env.RANK_DUEL) return sendJson({error:'rank_unavailable'},503);
  const origin=req.headers.get('Origin');
  const origins=(env.ALLOWED_ORIGINS||'').split(',').map(value=>value.trim());
  if (origin && !origins.includes(origin)) return sendJson({error:'rank_origin'},403);
  const key=credentials(req);
  if (req.headers.get('Upgrade')?.toLowerCase()!=='websocket' || !safeId(matchId) || !key) {
    return sendJson({error:'rank_socket'},400);
  }
  const auth=await callRankHub(env,'authorize',{matchId,key});
  if (!auth.ok) return sendJson({error:'rank_expired'},403);
  return stubFor(env.RANK_DUEL,matchId).fetch('https://ranked.internal/connect',{
    headers:{ Upgrade:'websocket', 'Sec-WebSocket-Protocol':RANK_PROTOCOL,
      'X-Ranked-Seat':encodeURIComponent(JSON.stringify(await auth.json())) }
  });
}

export class RankHub {
  constructor(ctx) {
    this.ctx=ctx;
    this.sql=ctx.storage.sql;
    this.lastCleanup=0;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS players (
        pid TEXT PRIMARY KEY, name TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0,
        peak INTEGER NOT NULL DEFAULT 0, wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0,
        botwins INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0,
        played INTEGER NOT NULL DEFAULT 0, botday INTEGER NOT NULL DEFAULT -1, bottoday INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS ranks_order ON players (points DESC,wins DESC,pid) WHERE played>0;
      CREATE TABLE IF NOT EXISTS queue (
        pid TEXT PRIMARY KEY, name TEXT NOT NULL, fighter TEXT NOT NULL, points INTEGER NOT NULL,
        speed REAL NOT NULL, reach REAL NOT NULL, since INTEGER NOT NULL,
        expires INTEGER NOT NULL, bot_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS queue_time ON queue (since);
      CREATE INDEX IF NOT EXISTS queue_expiry ON queue (expires);
      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY, roster TEXT NOT NULL, expires INTEGER NOT NULL, closed INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS match_expiry ON matches (expires);
      CREATE TABLE IF NOT EXISTS seats (pid TEXT PRIMARY KEY, match_id TEXT NOT NULL, ticket TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS seat_match ON seats (match_id);
      CREATE TABLE IF NOT EXISTS rounds (
        match_id TEXT NOT NULL, round INTEGER NOT NULL, at INTEGER NOT NULL, result TEXT NOT NULL,
        PRIMARY KEY(match_id, round)
      );
      CREATE INDEX IF NOT EXISTS round_time ON rounds (at);
      CREATE TABLE IF NOT EXISTS history (
        pid TEXT NOT NULL, match_id TEXT NOT NULL, round INTEGER NOT NULL, at INTEGER NOT NULL, opponent TEXT NOT NULL,
        bot INTEGER NOT NULL, outcome TEXT NOT NULL, change INTEGER NOT NULL, reason TEXT NOT NULL,
        PRIMARY KEY(pid,match_id,round)
      );
      CREATE INDEX IF NOT EXISTS history_recent ON history (pid,at DESC);
      CREATE INDEX IF NOT EXISTS history_time ON history (at);
    `);
  }

  player(pid) {
    return first(this.sql,'SELECT * FROM players WHERE pid=?',pid);
  }
  profile(row) {
    if (!row) return null;
    return {name:row.name,points:row.points,tier:rankTier(row.points),peak:row.peak,wins:row.wins,
      losses:row.losses,draws:row.draws,botWins:row.botwins,streak:row.streak,played:row.played};
  }
  cleanup(now) {
    this.sql.exec('DELETE FROM queue WHERE expires<=?',now);
    if (now-this.lastCleanup<60000) return;
    this.lastCleanup=now;
    this.sql.exec('DELETE FROM seats WHERE match_id IN (SELECT id FROM matches WHERE expires<=? OR closed=1)',now);
    this.sql.exec('DELETE FROM matches WHERE expires<=?',now-DAY_MS);
    this.sql.exec('DELETE FROM rounds WHERE at<?',now-7*DAY_MS);
    this.sql.exec('DELETE FROM history WHERE at<?',now-90*DAY_MS);
  }
  offer(pid,now) {
    const row=first(this.sql,`SELECT s.ticket,s.match_id,m.roster FROM seats s JOIN matches m
      ON m.id=s.match_id WHERE s.pid=? AND m.closed=0 AND m.expires>?`,pid,now);
    if (!row) return null;
    const players=JSON.parse(row.roster);
    return {state:'matched',id:row.match_id,ticket:row.ticket,
      seat:players.findIndex(p=>p.pid===pid),players:players.map(publicRankFighter)};
  }
  assign(a,b,now) {
    const id=randomId();
    const roster=[a,b].map(p=>({pid:p.pid,name:p.name,fighter:p.fighter,points:p.points,
      speed:p.speed,reach:p.reach,bot:!!p.bot,strength:p.strength||0}));
    this.sql.exec('INSERT INTO matches(id,roster,expires) VALUES(?,?,?)',id,JSON.stringify(roster),now+FIRST_MATCH_TTL);
    for (const player of roster) {
      if (player.bot) continue;
      this.sql.exec('INSERT OR REPLACE INTO seats(pid,match_id,ticket) VALUES(?,?,?)',player.pid,id,ticket());
      this.sql.exec('DELETE FROM queue WHERE pid=?',player.pid);
    }
  }
  queue(pid, now, newPlayer, botProfiles) {
    const assigned=this.offer(pid,now);
    if (assigned) return assigned;
    const sql=this.sql;
    let q=first(sql,'SELECT * FROM queue WHERE pid=?',pid);
    if (!q && newPlayer) {
      sql.exec(`INSERT INTO players(pid,name) VALUES(?,?) ON CONFLICT(pid) DO UPDATE SET name=excluded.name`,pid,newPlayer.name);
      q={...newPlayer,pid,points:this.player(pid).points,since:now,expires:now+QUEUE_TTL,bot_at:now+BOT_WAIT_MS};
      sql.exec('INSERT INTO queue VALUES(?,?,?,?,?,?,?,?,?)',pid,q.name,q.fighter,q.points,q.speed,q.reach,q.since,q.expires,q.bot_at);
    }
    if (!q) return {state:'idle'};
    sql.exec('UPDATE queue SET expires=? WHERE pid=?',now+QUEUE_TTL,pid);
    // Search the entire eligible rating range, retaining FIFO as the priority among eligible opponents.
    for (const rival of sql.exec('SELECT * FROM queue WHERE pid<>? ORDER BY since,pid',pid)) {
      if (!withinRating(q,rival,now)) continue;
      this.assign(rival,q,now);
      return this.offer(pid,now);
    }
    if (now>=q.bot_at) {
      sql.exec('UPDATE queue SET bot_at=? WHERE pid=?',now+BOT_RETRY_MS,pid);
      if (botProfiles?.length && Math.random()<BOT_CHANCE) {
        const pool=botProfiles.filter(p=>p.fighter!==q.fighter);
        const chosen=(pool.length?pool:botProfiles)[Math.floor(Math.random()*(pool.length||botProfiles.length))];
        const rank=this.player(pid);
        this.assign(q,{...chosen,pid:'BOT',name:'闘技場の指南役',points:q.points,bot:true,
          strength:botStrength(q.points,rank.wins+rank.botwins)},now);
        return this.offer(pid,now);
      }
    }
    return {state:'searching',waited:Math.max(0,Math.floor((now-q.since)/1000)),fighter:q.fighter};
  }
  board(pid) {
    const rows=cursor(this.sql,'SELECT * FROM players WHERE played>0 ORDER BY points DESC,wins DESC,pid LIMIT 50');
    const me=pid ? this.player(pid) : null;
    let place=null;
    let recent=[];
    if (me) {
      if (me.played) place=first(this.sql,`SELECT COUNT(*) AS n FROM players WHERE played>0 AND
        (points>? OR (points=? AND (wins>? OR (wins=? AND pid<?))))`,me.points,me.points,me.wins,me.wins,pid).n+1;
      recent=cursor(this.sql,'SELECT opponent,bot,outcome,change,reason,at FROM history WHERE pid=? ORDER BY at DESC,round DESC LIMIT 10',pid);
    }
    return {tiers:RANK_TIERS,top:rows.map((p,i)=>({...this.profile(p),place:i+1})),
      me:me?{...this.profile(me),place}:null,recent};
  }
  settle({matchId,round,winner,reason},now) {
    const sql=this.sql;
    if (!Number.isSafeInteger(round) || round<1 || ![0,1,null].includes(winner)) return null;
    const previous=first(sql,'SELECT result FROM rounds WHERE match_id=? AND round=?',matchId,round);
    if (previous) return JSON.parse(previous.result);
    const match=first(sql,'SELECT * FROM matches WHERE id=? AND closed=0',matchId);
    if (!match) return null;
    const roster=JSON.parse(match.roster);
    const ranks=roster.map(p=>p.bot?{points:p.points}:this.player(p.pid));
    if (ranks.some(p=>!p)) return null;
    const day=Math.floor(now/DAY_MS);
    const today=ranks[0].botday===day?ranks[0].bottoday:0;
    const changes=pointsFor(roster.map((p,i)=>({...p,points:ranks[i].points})),winner,reason,today);
    const done={winner,reason,points:[],before:[],change:changes};
    for (const [seat,p] of roster.entries()) {
      const rank=ranks[seat];
      done.before.push(rank.points);
      if (p.bot) { done.points.push(null);continue; }
      const next=rank.points+changes[seat];
      done.points.push(next);
      if (reason==='no_contest' || reason==='cancelled') continue;
      const won=winner===seat, lost=winner!==null&&!won, bot=roster[1-seat].bot;
      const streak=bot ? rank.streak : won ? rank.streak+1 : lost ? 0 : rank.streak;
      sql.exec(`UPDATE players SET points=?,peak=?,wins=wins+?,losses=losses+?,draws=draws+?,
        botwins=botwins+?,streak=?,played=played+1,botday=?,bottoday=? WHERE pid=?`,
        next,Math.max(rank.peak,next),+(!bot&&won),+(!bot&&lost),+(!bot&&winner===null),+(bot&&won),streak,
        day,todayFor(rank,day)+(bot&&changes[seat]>0?1:0),p.pid);
      sql.exec('INSERT INTO history VALUES(?,?,?,?,?,?,?,?,?)',p.pid,matchId,round,now,roster[1-seat].name,
        +bot,won?'win':lost?'loss':'draw',changes[seat],reason);
    }
    done.botLimit=roster[1].bot&&winner===0&&today>=BOT_DAILY_WINS;
    sql.exec('INSERT INTO rounds VALUES(?,?,?,?)',matchId,round,now,JSON.stringify(done));
    sql.exec('UPDATE matches SET expires=? WHERE id=?',now+MATCH_TTL,matchId);
    return done;
  }
  async fetch(req) {
    const action=new URL(req.url).pathname.slice(1);
    const body=await req.json();
    const now=Date.now();
    return this.ctx.storage.transactionSync(()=>{
      this.cleanup(now);
      const {pid,matchId,key}=body;
      switch(action) {
        case 'board': return sendJson(this.board(pid));
        case 'join':
        case 'status': return sendJson(this.queue(pid,now,action==='join'?body.player:null,body.bots));
        case 'cancel': {
          this.sql.exec('DELETE FROM queue WHERE pid=?',pid);
          return sendJson(this.offer(pid,now)||{state:'idle'});
        }
        case 'authorize': {
          const row=first(this.sql,`SELECT m.roster,s.pid FROM seats s JOIN matches m ON m.id=s.match_id
            WHERE s.match_id=? AND s.ticket=? AND m.closed=0 AND m.expires>?`,matchId,key,now);
          if (!row) return sendJson({error:'rank_expired'},403);
          const players=JSON.parse(row.roster);
          return sendJson({matchId,players,seat:players.findIndex(p=>p.pid===row.pid)});
        }
        case 'settle': {
          const result=this.settle(body,now);
          return result ? sendJson(result) : sendJson({error:'rank_missing'},404);
        }
        case 'close': {
          this.sql.exec('UPDATE matches SET closed=1 WHERE id=?',matchId);
          this.sql.exec('DELETE FROM seats WHERE match_id=?',matchId);
          return sendJson({ok:true});
        }
        default: return sendJson({error:'rank_unknown'},404);
      }
    });
  }
}
function todayFor(rank,day) { return rank.botday===day ? rank.bottoday : 0; }

export class RankDuel {
  constructor(ctx,env) {
    this.ctx=ctx;
    this.env=env;
    this.sockets=[null,null];
    this.input=[emptyRankInput(),emptyRankInput()];
    this.latest=0;
    this.lastSaved=0;
    this.nextRetry=0;
    this.timer=null;
    this.chain=Promise.resolve();
    this.ticking=false;
    this.ctx.blockConcurrencyWhile(async()=>{
      this.data=await this.ctx.storage.get('duel');
    });
  }
  serial(task) {
    const run=this.chain.then(task);
    this.chain=run.catch(error=>console.warn('[Ranked duel]',error?.message||'error'));
    return run;
  }
  async checkpoint() {
    this.lastSaved=Date.now();
    await this.ctx.storage.put('duel',this.data);
  }
  async alarmAt(when) {
    await this.ctx.storage.setAlarm(Math.max(Date.now()+1000,when));
  }
  connected(seat) { return !!this.data.players[seat].bot || !!this.sockets[seat]?.ws && this.sockets[seat].ws.readyState===1; }
  bothConnected() { return this.connected(0)&&this.connected(1); }
  detach(seat,client) {
    if (this.sockets[seat]!==client) return;
    this.sockets[seat]=null;
    this.input[seat]=emptyRankInput();
    if (!this.data || this.data.phase==='closed') return;
    this.data.lost[seat] ||= Date.now();
    if (!this.sockets.some(Boolean)) this.stopTicker();
    this.ctx.waitUntil(this.serial(async()=>{
      if (this.data.phase==='closed') return;
      await this.checkpoint();
      await this.alarmAt(Date.now()+DISCONNECT_MS+1000);
      this.broadcast();
    }));
  }
  startTicker() {
    if (this.timer) return;
    this.latest=Date.now();
    this.timer=setInterval(()=>{
      if (this.ticking) return;
      this.ticking=true;
      const work=this.serial(()=>this.advance(Date.now())).finally(()=>{this.ticking=false;});
      this.ctx.waitUntil(work.catch(()=>{}));
    },50);
  }
  stopTicker() {
    clearInterval(this.timer);this.timer=null;
  }
  async fetch(req) {
    if (new URL(req.url).pathname!=='/connect') return sendJson({error:'rank_unknown'},404);
    const raw=req.headers.get('X-Ranked-Seat');
    if (!raw || req.headers.get('Upgrade')?.toLowerCase()!=='websocket') return sendJson({error:'rank_socket'},400);
    const {matchId,players,seat}=JSON.parse(decodeURIComponent(raw));
    if (![0,1].includes(seat) || !safeId(matchId) || players?.length!==2 || players[seat].bot) return sendJson({error:'rank_socket'},400);
    return this.serial(async()=>{
      if (!this.data) {
        const now=Date.now();
        this.data={id:matchId,players,phase:'ready',round:1,deadline:now+READY_MS,
          ready:[false,!!players[1].bot],lost:[0,0],spent:[0,0],votes:[null,null],
          fight:newFight(),outcome:null,result:null,closeReason:null,hubClosed:false};
        await this.checkpoint();
        await this.alarmAt(now+READY_MS);
      }
      const d=this.data;
      if (d.id!==matchId || d.phase==='closed') return sendJson({error:'rank_expired'},410);
      const wsPair=new WebSocketPair();
      const ws=wsPair[1];
      ws.accept();
      const prior=this.sockets[seat];
      const client={ws,received:0,window:Date.now()};
      this.sockets[seat]=client;
      this.input[seat]=emptyRankInput();
      if (d.lost[seat] && d.phase==='fight') d.spent[seat]+=Date.now()-d.lost[seat];
      d.lost[seat]=0;
      if (prior) prior.ws.close(4001,'Reconnected');
      ws.addEventListener('message',event=>this.receive(seat,client,event.data));
      ws.addEventListener('close',()=>{
        this.detach(seat,client);
        if (ws.readyState===2) ws.close();
      });
      ws.addEventListener('error',()=>this.detach(seat,client));
      this.startTicker();
      this.broadcast();
      return new Response(null,{status:101,webSocket:wsPair[0],headers:{'Sec-WebSocket-Protocol':RANK_PROTOCOL}});
    });
  }
  receive(seat,client,raw) {
    if (this.sockets[seat]!==client || typeof raw!=='string' || raw.length>512) return;
    const now=Date.now();
    if (now-client.window>=1000) { client.received=0;client.window=now; }
    if (++client.received>38) return;
    let msg;
    try { msg=JSON.parse(raw); } catch { return; }
    if (!msg || msg.round!==this.data.round) return;
    if (msg.type==='input') {
      if (this.data.phase==='fight' && this.bothConnected()) this.input[seat]=cleanInput(msg,this.input[seat],this.data.fight.combatClock);
    } else if (['ready','retry','leave'].includes(msg.type)) {
      this.ctx.waitUntil(this.serial(async()=>{
        if (this.sockets[seat]!==client || msg.round!==this.data.round) return;
        const d=this.data;
        if (msg.type==='ready' && d.phase==='ready') {
          d.ready[seat]=true;
          if (d.ready.every(Boolean) && this.bothConnected()) this.countdown(false);
        } else if (msg.type==='retry' && d.phase==='result' && Date.now()<d.deadline) {
          d.votes[seat]=true;
          if (d.votes.every(Boolean) && this.bothConnected()) this.countdown(true);
        } else if (msg.type==='leave') {
          if (d.phase==='fight') await this.finish(1-seat,'retire',Date.now());
          else if (['ready','countdown','result'].includes(d.phase)) await this.close('declined');
        }
        if (d.phase!=='closed') { await this.checkpoint();this.broadcast(); }
      }).catch(()=>{}));
    }
  }
  countdown(rematch) {
    const d=this.data;
    if (rematch) d.round++;
    d.phase='countdown';
    d.deadline=Date.now()+COUNTDOWN_MS;
    d.fight=newFight();d.spent=[0,0];d.lost=[0,0];
    d.outcome=null;d.result=null;d.votes=[null,null];
    this.input=[emptyRankInput(),emptyRankInput()];
  }
  snapshot(now) {
    const d=this.data;
    return {
      type:'state', round:d.round, phase:d.phase, ready:d.ready, votes:d.votes, now, deadline:d.deadline,
      connected:[this.connected(0),this.connected(1)],
      timeLeft:Math.max(0,RANK_FIGHT_MS-d.fight.elapsed),
      fighters:d.fight.fighters.map(f=>({hp:f.hp,energy:f.energy,over:f.over,x:f.x,z:f.z,y:f.y,
        facing:f.facing,guard:f.guard,moving:f.moving})),
      bolts:d.fight.bolts.map(({id,seat,x,z})=>({id,seat,x,z})),events:d.fight.events,
      result:d.result, reason:d.closeReason
    };
  }
  broadcast(now=Date.now()) {
    if (!this.sockets.some(Boolean)) { this.data.fight.events=[];return; }
    const packet=JSON.stringify(this.snapshot(now));
    this.data.fight.events=[];
    for (const client of this.sockets) {
      if (client?.ws.readyState===1) {
        try { client.ws.send(packet); } catch { /* The socket close event handles reconnect. */ }
      }
    }
  }
  async finish(winner,reason,now) {
    const d=this.data;
    d.phase='settling';d.outcome={winner,reason};d.deadline=0;
    this.input=[emptyRankInput(),emptyRankInput()];
    this.nextRetry=0;
    await this.checkpoint();
    await this.settle(now);
  }
  async settle(now) {
    const d=this.data;
    if (now<this.nextRetry) return;
    this.nextRetry=now+1100;
    try {
      const answer=await callRankHub(this.env,'settle',{matchId:d.id,round:d.round,...d.outcome});
      if (!answer.ok) return;
      d.result=await answer.json();
      d.phase='result';d.deadline=Date.now()+RESULT_MS;d.votes=[null,!!d.players[1].bot||null];
      await this.checkpoint();
      await this.alarmAt(d.deadline+500);
    } catch { await this.alarmAt(now+1500); }
  }
  async close(reason) {
    const d=this.data;
    d.phase='closed';d.closeReason=reason;d.deadline=0;
    await this.checkpoint();
    await this.closeHub();
    this.broadcast();
    for (const client of this.sockets) if (client?.ws.readyState===1) client.ws.close(1000,'Match complete');
    this.sockets=[null,null];
    this.stopTicker();
  }
  async closeHub() {
    const d=this.data;
    if (!d.hubClosed) {
      try { d.hubClosed=(await callRankHub(this.env,'close',{matchId:d.id})).ok; } catch {}
      await this.checkpoint();
    }
    // Keep the closed marker until the old ticket has expired, so it cannot restart a duel.
    await this.alarmAt(Date.now()+(d.hubClosed?MATCH_TTL:3000));
  }
  async advance(now) {
    const d=this.data;
    if (!d) return;
    const delta=Math.min(100,Math.max(1,now-(this.latest||now-50)));
    this.latest=now;
    switch(d.phase) {
      case 'ready':
        if (now>=d.deadline) return this.close('not_ready');
        if (d.ready.every(Boolean) && this.bothConnected()) this.countdown(false);
        break;
      case 'countdown':
        if (!this.bothConnected()) {
          d.phase='ready';d.deadline=now+DISCONNECT_MS;await this.checkpoint();
        } else if (now>=d.deadline) { d.phase='fight';await this.checkpoint(); }
        break;
      case 'fight':
        if (!this.bothConnected()) {
          for (let i=0;i<2;i++) if (!this.connected(i)) d.lost[i] ||= now;
          this.input=[emptyRankInput(),emptyRankInput()];
          const overdue=d.lost.some((at,i)=>at && now-at+d.spent[i]>=DISCONNECT_MS);
          if (overdue) {
            const winner=this.connected(0)===this.connected(1)?null:this.connected(0)?0:1;
            return this.finish(winner,winner===null?'no_contest':'disconnect',now);
          }
        } else {
          const outcome=stepFight(d.fight,this.input,d.players,delta);
          if (outcome) return this.finish(outcome.winner,outcome.reason,now);
        }
        break;
      case 'settling':
        await this.settle(now);
        break;
      case 'result':
        if (now>=d.deadline) return this.close('expired');
        if (d.votes.every(Boolean) && this.bothConnected()) this.countdown(true);
        break;
      case 'closed': return;
    }
    this.broadcast(now);
    if (now-this.lastSaved>=2000) {
      await this.checkpoint();
      await this.alarmAt(now+DISCONNECT_MS+1200);
    }
  }
  async alarm() {
    await this.serial(async()=>{
      const d=this.data;
      if (!d) return;
      if (d.phase==='closed') {
        if (!d.hubClosed) await this.closeHub();
        else await this.ctx.storage.deleteAll();
        return;
      }
      await this.advance(Date.now());
      if (this.data.phase!=='closed') await this.alarmAt(Date.now()+3000);
    });
  }
}
