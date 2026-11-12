// RF553_CASTLE_NAME_BULK_MOBILE_20261111
// RF552_server_worker.js_PATCHED_20261111
// RF54_FIX_20261111
// RF_GRAND_FOUR_20261108 server/worker.js
// Riftfall Arena Cloudflare Worker — runtime/preview guard update (2026-11-06).
// Worker entry point. Ranked rooms use dedicated Durable Object namespaces.
// Original sources: appearance-data.js, data.js, server/worker.js

// Standalone Cloudflare Worker. Ranked modules are included below.
const { callRankHub, openRankSocket, RankHub, RankDuel } = (() => {
  // server/ranked-rules.js
  const {
    RANK_TIERS, RANK_FIGHT_MS, BOT_WAIT_MS, BOT_RETRY_MS, BOT_CHANCE, BOT_DAILY_WINS,
    rankTier, pointsFor, withinRating, botStrength, newFight, cleanInput, emptyRankInput, stepFight
  } = (() => {
    // The server advances ranked fights from player inputs, on its own clock.
    const RANK_TIERS = [
      ['bronze','ブロンズ',0], ['silver','シルバー',200], ['gold','ゴールド',500],
      ['platinum','プラチナ',900], ['master','マスター',1400]
    ];
    const RANK_FIGHT_MS = 150000;
    const RANK_RADIUS = 13;
    const BOT_WAIT_MS = 60000;
    const BOT_RETRY_MS = 30000;
    const BOT_CHANCE = .12;
    const BOT_DAILY_WINS = 3;
    const TICK_MS = 50;
    const INPUT_MAX_AGE = 450;
    const MOVES = {
      light: { cost:0, windup:140, recovery:230, damage:55 },
      dash:  { cost:25, windup:250, recovery:400, damage:110, range:5.6 },
      bolt:  { cost:29, windup:360, recovery:380, damage:105, speed:17 },
      over:  { cost:0, windup:690, recovery:600, damage:240, range:6.4 },
      heal:  { cost:48, windup:750, recovery:440, heal:105 }
    };
    const EMPTY = Object.freeze({ mx:0, mz:0, guard:false, seq:-1, at:0, edges:0 });
    const ALL_EDGES = 63;
    const maxHp = 1000;
    const clamp = (value, min, max) => Math.min(max, Math.max(min,value));
    const number = value => typeof value === 'number' && Number.isFinite(value) ? value : 0;

    function rankTier(points) {
      for (let index = RANK_TIERS.length - 1; index > 0; index -= 1) {
        const tier = RANK_TIERS[index];
        if (points >= tier[2]) return tier[0];
      }
      return RANK_TIERS[0][0];
    }
    function pointsFor(players, winner, reason, earnedBotWins) {
      if (winner === null || reason === 'cancelled' || reason === 'no_contest') return [0,0];
      if (players[1].bot) return [winner === 0 && earnedBotWins < BOT_DAILY_WINS ? 8 : 0,0];
      const loser = 1 - winner;
      const spread = Math.round((players[loser].points - players[winner].points) / 60);
      const gain = clamp(25 + spread, 15, 36);
      const drop = Math.min(players[loser].points, clamp(9 - spread, 5, 16));
      return winner === 0 ? [gain,-drop] : [-drop,gain];
    }
    function botStrength(points, wins) {
      return clamp(.25 + Math.sqrt(Math.max(0,points) / 1600) * .57 + Math.min(wins,24) * .004, .25, .94);
    }
    function withinRating(a, b, now) {
      const wait = now - Math.min(a.since,b.since);
      if (wait >= BOT_WAIT_MS) return true;
      return Math.abs(a.points - b.points) <= 180 + Math.floor(Math.max(0,wait) / 15000) * 180;
    }
    function cleanInput(raw, previous, now) {
      if (!Number.isSafeInteger(raw.seq) || raw.seq < 0 || raw.seq <= previous.seq) return previous;
      const x = clamp(number(raw.mx), -1, 1), z = clamp(number(raw.mz), -1, 1);
      const length = Math.max(1, Math.hypot(x,z));
      return {
        seq:raw.seq, at:now, mx:x/length, mz:z/length, guard:raw.guard === true,
        edges: previous.edges | (Number.isSafeInteger(raw.edges) ? raw.edges & ALL_EDGES : 0)
      };
    }
    function fighter(seat) {
      return { hp:maxHp, x:seat === 0 ? -4 : 4, z:0, y:0, vy:0, energy:55, over:0,
        facing:seat === 0 ? Math.PI/2 : -Math.PI/2, guard:false, moving:false, busyUntil:0,
        stunUntil:0, healAfter:0, lightStep:0, lightAfter:0, action:null };
    }
    function newFight() {
      return { elapsed:0, fighters:[fighter(0),fighter(1)], bolts:[], events:[], nextBolt:1,
        botThink:0, botInput:{...EMPTY}, combatClock:0 };
    }
    const emptyRankInput = () => ({...EMPTY});
    function event(fight, kind, seat, detail={}) { fight.events.push({kind, seat, ...detail}); }
    function face(actor, target) { actor.facing = Math.atan2(target.x - actor.x,target.z - actor.z); }
    function position(actor) {
      const dist = Math.hypot(actor.x,actor.z);
      if (dist > RANK_RADIUS) { actor.x *= RANK_RADIUS/dist; actor.z *= RANK_RADIUS/dist; }
    }
    function hit(fight, seat, base, piercing=false) {
      const a = fight.fighters[seat], b = fight.fighters[1-seat];
      const defended = b.guard && b.energy >= 8;
      const damage = Math.min(b.hp, Math.round(base * (defended ? (piercing ? .57 : .28) : 1)));
      if (defended) b.energy = Math.max(0,b.energy-8);
      b.hp -= damage;
      a.over = Math.min(100,a.over + damage * .11 + 7);
      b.over = Math.min(100,b.over + damage * .14 + 5);
      if (!defended && base >= 105 && b.busyUntil <= fight.combatClock) b.stunUntil = fight.combatClock + 180;
      event(fight,'hit',1-seat,{damage,guard:defended});
    }
    function startMove(fight, seat, kind, now) {
      const a = fight.fighters[seat], b = fight.fighters[1-seat], move = MOVES[kind];
      if (a.energy < move.cost || (kind === 'over' && a.over < 100) ||
          (kind === 'heal' && (now < a.healAfter || a.hp >= maxHp))) return false;
      a.energy -= move.cost;
      if (kind === 'over') a.over = 0;
      if (kind === 'heal') a.healAfter = now + 12000;
      else face(a,b);
      if (kind === 'light') {
        a.lightStep = now <= a.lightAfter ? (a.lightStep + 1) % 3 : 0;
        a.lightAfter = now + 840;
      }
      a.action = {kind, at:now+move.windup, step:a.lightStep};
      a.busyUntil = now + move.windup + move.recovery;
      a.guard = false;
      event(fight,'move',seat,{move:kind, step:a.lightStep, duration:move.windup + move.recovery});
      return true;
    }
    function resolveMove(fight, seat, action, profiles) {
      const a = fight.fighters[seat], b = fight.fighters[1-seat], move = MOVES[action.kind];
      const dx=b.x-a.x, dz=b.z-a.z, dist=Math.hypot(dx,dz);
      const fx=Math.sin(a.facing), fz=Math.cos(a.facing);
      const aligned = dist < .9 || (dx*fx+dz*fz) >= dist * .63;
      if (action.kind === 'heal') {
        const healed = Math.min(move.heal,maxHp-a.hp);
        a.hp += healed; event(fight,'heal',seat,{healed}); return;
      }
      if (action.kind === 'bolt') {
        fight.bolts.push({ id:fight.nextBolt++, seat, x:a.x+fx*.6, z:a.z+fz*.6,
          vx:fx*move.speed, vz:fz*move.speed, until:fight.combatClock+780 });
        return;
      }
      if (action.kind === 'dash') {
        const travel=aligned?clamp(dist-1.2,0,4.4):2.1;
        a.x += fx*travel; a.z += fz*travel; position(a);
      }
      const reach = move.range ?? profiles[seat].reach;
      if (dist <= reach && (aligned || action.kind === 'over') && (b.y < .85 || action.kind === 'over')) {
        const damage = move.damage + (action.kind === 'light' ? action.step * 11 : 0);
        hit(fight,seat,damage,action.kind === 'over');
      }
    }
    function advanceBolts(fight, dt, now) {
      fight.bolts = fight.bolts.filter(bolt => {
        if (bolt.until <= now) return false;
        const target = fight.fighters[1-bolt.seat];
        const dx=bolt.vx*dt,dz=bolt.vz*dt;
        const denom=dx*dx+dz*dz;
        const t=denom ? clamp(((target.x-bolt.x)*dx+(target.z-bolt.z)*dz)/denom,0,1) : 0;
        if (target.y < 1.02 && Math.hypot(target.x-bolt.x-dx*t,target.z-bolt.z-dz*t)<.82) {
          hit(fight,bolt.seat,MOVES.bolt.damage); return false;
        }
        bolt.x+=dx;bolt.z+=dz;
        return Math.hypot(bolt.x,bolt.z) <= RANK_RADIUS+1;
      });
    }
    function botCommand(fight, strength, now, random) {
      const bot=fight.fighters[1], target=fight.fighters[0];
      const x=target.x-bot.x,z=target.z-bot.z,d=Math.max(.01,Math.hypot(x,z));
      const previous=fight.botInput;
      if (now < fight.botThink) return {...previous, edges:0, at:now};
      fight.botThink = now + 100 + (1-strength)*260 + random()*150;
      const forward = d>2.05 ? 1 : .12;
      const side = (random()-.5) * (.55+strength);
      const guard = target.action?.at>now+30 && d<6.7 && random()<(.14+strength*.66) && bot.energy>=9;
      let edges=0;
      if (!guard && bot.busyUntil<=now) {
        const chance=random();
        if (bot.hp<405 && bot.energy>=48 && d>3.8 && chance<strength*.5) edges=16;
        else if (bot.over>=100 && d<6 && chance<.62) edges=8;
        else if (d<2.3 && chance<.43+strength*.53) edges=1;
        else if (d<5.3 && d>2.4 && chance<.20+strength*.44) edges=2;
        else if (d<11.8 && chance<.14+strength*.4) edges=4;
        else if (target.action?.kind==='bolt' && chance<strength*.4) edges=32;
      }
      fight.botInput={mx:(x*forward-z*side)/d,mz:(z*forward+x*side)/d,guard,edges,at:now,seq:0};
      return {...fight.botInput};
    }
    function stepFight(fight, inputs, profiles, elapsedMs = TICK_MS, random = Math.random) {
      const ms = clamp(elapsedMs,1,100);
      const dt=ms/1000;
      fight.combatClock+=ms;
      fight.elapsed+=ms;
      const now=fight.combatClock;
      const actual=[inputs[0],profiles[1].bot ? botCommand(fight,profiles[1].strength,now,random) : inputs[1]];
      for (let i=0;i<2;i++) {
        const a=fight.fighters[i], b=fight.fighters[1-i];
        const raw=actual[i]||EMPTY;
        const input=now-raw.at>INPUT_MAX_AGE ? EMPTY : raw;
        const edges=input.edges;
        if (raw!==EMPTY) raw.edges=0;
        const free=a.busyUntil<=now && a.stunUntil<=now;
        a.guard=free && input.guard && a.y<.2 && a.energy>=8;
        a.moving=false;
        a.energy=Math.min(100,a.energy+dt*(a.guard?3:14));
        a.over=Math.min(100,a.over+dt*.9);
        if (free && !a.guard) {
          if (edges&32 && a.y===0) a.vy=5.8;
          const started=(edges&8 && startMove(fight,i,'over',now)) ||
            (edges&16 && startMove(fight,i,'heal',now)) || (edges&2 && startMove(fight,i,'dash',now)) ||
            (edges&4 && startMove(fight,i,'bolt',now)) || (edges&1 && startMove(fight,i,'light',now));
          const len=Math.hypot(input.mx,input.mz);
          if (!started && len>.11) {
            a.x+=input.mx*profiles[i].speed*dt;a.z+=input.mz*profiles[i].speed*dt;
            a.facing=Math.atan2(input.mx,input.mz);a.moving=true;
          }
        } else if (a.guard) face(a,b);
        if (a.vy!==0 || a.y>0) {
          a.vy-=19*dt;a.y=Math.max(0,a.y+a.vy*dt);
          if (!a.y) a.vy=0;
        }
        position(a);
      }
      for (let i=0;i<2;i++) {
        const a=fight.fighters[i];
        if (a.action && a.action.at <= now) {
          const action=a.action;
          a.action=null;
          resolveMove(fight,i,action,profiles);
        }
      }
      advanceBolts(fight,dt,now);
      if (fight.fighters.some(a => a.hp === 0) || fight.elapsed >= RANK_FIGHT_MS) {
        const [a,b]=fight.fighters;
        return { winner:a.hp===b.hp?null:a.hp>b.hp?0:1, reason:a.hp&&b.hp?'time':'ko' };
      }
      return null;
    }
    return {
      RANK_TIERS, RANK_FIGHT_MS, BOT_WAIT_MS, BOT_RETRY_MS, BOT_CHANCE, BOT_DAILY_WINS,
      rankTier, pointsFor, withinRating, botStrength, newFight, cleanInput, emptyRankInput, stepFight
    };
  })();

  // server/ranked.js
  const RANK_PROTOCOL = 'riftfall-ranked-v1';
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
  const callRankHub = (env, action, data) => hub(env).fetch('https://ranked.internal/'+action,{
    method:'POST', body:JSON.stringify(data)
  });
  const publicRankFighter = p => ({name:p.name, fighter:p.fighter, tier:rankTier(p.points), bot:!!p.bot});
  function credentials(req) {
    const parts=(req.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(value=>value.trim());
    const match=parts.find(value=>/^rf-[a-f0-9]{48}$/.test(value));
    return parts.includes(RANK_PROTOCOL) && match ? match.slice(3) : null;
  }
  async function openRankSocket(req, env, matchId) {
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

  class RankHub {
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

  class RankDuel {
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
  return { callRankHub, openRankSocket, RankHub, RankDuel };
})();
export { RankHub, RankDuel };

// 神属性の天子はクライアントと同じ定義で扱う。
const { TENSHI_KEY, DIVINE_ELEMENT, tenshiDefinition } = (()=>{
// Shared between the game and Worker permission checks.
const TENSHI_KEY = 'tenshi';
const DIVINE_ELEMENT = 10;
const art = (name, kind, divine, properties) => ({
  name, kind, divine, elem:DIVINE_ELEMENT, vivid:true, ...properties
});
function tenshiDefinition() {
  return {
    name:'天子', title:'双月の天儀を司る者',
    model:'assets/models/tenshi.glb', face:'assets/portraits/tenshi.webp',
    attribute:'神', element:DIVINE_ELEMENT, tint:null, color:0xf4d694,
    height:1.79, hp:1180, speed:6.15, power:1.03, armor:.94,
    overGain:1.08, fluxMul:1.06, locked:true, special:'chief', fixedSlots:true,
    light:{name:'日輪連掌',range:2.28,dmg:43,color:0xffd490,elem:DIVINE_ELEMENT},
    skills:[
      art('暁光の矢','projectile','arrow',{cost:17,castTime:.42,dmg:68,count:1,speed:25,radius:.57,visual:'orb',color:0xffd398}),
      art('星踏み','dash','step',{cost:20,castTime:.37,dmg:99,speed:19,dur:.29,color:0xc7e8ff}),
      art('神紋・星環','tenshi_seal','seal',{cost:25,castTime:.74,dmg:124,radius:3.3,reach:9,delay:.49,color:0xe8c8fb}),
      art('月弧の返し','projectile','moon',{cost:27,castTime:.55,dmg:51,count:3,spreadAng:.13,speed:19,radius:.65,visual:'crescent',color:0xb9e0ff}),
      art('晨光の祈り','heal','mercy',{cost:32,castTime:.75,heal:135,radius:4.5,color:0xb9e9c9})
    ],
    over:art('皇天・暁界','tenshi_seal','dawn',{cost:0,castTime:1.23,dmg:252,radius:5.25,reach:9.3,delay:.62,color:0xffd891}),
    hi:art('双月神楽・天照','tenshi_seal','eclipse',{cost:0,castTime:1.62,dmg:209,echo:136,radius:5.65,reach:9.3,delay:.64,color:0xd4e4ff,hi:true})
  };
}
return {TENSHI_KEY,DIVINE_ELEMENT,tenshiDefinition};
})();

// 外見の設計値。描画ライブラリ・DOMに依存しないのでサーバーからも読み込める。
// 同じ素体を使っていた二人目以降だけに、体形・髪・頭飾り・衣装・得物を割り当てる。
const PALETTES = [
  [0x6c2935, 0xc19b53, 0x2c1924, 0xead6b5],
  [0x273b64, 0xb7c9d4, 0x182235, 0xd4b489],
  [0x436253, 0xc5a868, 0x273628, 0xe8d6b0],
  [0x5a3a6b, 0xc4adb9, 0x211a34, 0xe4bdae],
  [0x9a5837, 0xe2be78, 0x3c2924, 0xb8c5d1],
  [0x65758b, 0xd2cbbb, 0x293341, 0xf3e5c6],
  [0x81734c, 0xc5b592, 0x333624, 0xbfd4cb],
  [0x476d7b, 0xbed8d3, 0x22313d, 0xdec6ab],
  [0x5e4240, 0xbb8d67, 0x271d24, 0xddd7c5],
  [0x4d436c, 0xbcad73, 0x211d38, 0xccc4df],
  [0xa17e42, 0xe4cf92, 0x483727, 0xbfd1d1],
  [0x5a6a3d, 0xc8b983, 0x282f26, 0xdfc3ac],
  [0x855769, 0xd4bac7, 0x372733, 0xf0d9bd],
  [0x346465, 0xbbc9ae, 0x233b3a, 0xe0c5a0],
  [0x53515a, 0xc8b786, 0x27232c, 0xc6d5df]
];
const HEAD_NAMES = ['羽飾り兜', '枝角冠', '高僧帽', '獣耳フード', '広つば帽', '双結い髪', '双角兜', '三日月冠', '波紋の冠', '長い結い髪', '鉄面', '翼飾り冠', '尖りフード', '巻き布と面布', '長い横髪', '光輪冠', '工房の眼鏡', '鱗の冠', '王冠と編み髪'];
const COAT_NAMES = ['重ね胸甲', '二重法衣', '片肩の外套', '毛皮の肩掛け', '札甲', '長裾の上衣', '骨の胸甲', '結び布', '翼襟の礼装', '薬瓶の革鎧', '大肩甲', '菱紋の胴衣'];
function hash(s) {
  let n = 2166136261;
  for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
const fraction = (seed, offset) => ((seed >>> offset) & 255) / 255;

/** Gives duplicate-derived fighters their own stable, geometry-changing identity. */
function assignUniqueAppearances(fighters) {
  const firstByModel = new Map();
  const counts = new Map();
  const originals = [];
  const changed = [];
  for (const [id, fighter] of Object.entries(fighters)) {
    const model = fighter.model;
    if (!firstByModel.has(model)) {
      firstByModel.set(model, { id, family: firstByModel.size });
      originals.push(id);
      continue;
    }
    const source = firstByModel.get(model);
    const ordinal = counts.get(model) || 0;
    counts.set(model, ordinal + 1);
    const seed = hash(`riftfall-appearance-v1:${id}`);
    const palette = PALETTES[(ordinal * 7 + source.family * 3) % PALETTES.length];
    const head = (ordinal + source.family * 3) % HEAD_NAMES.length;
    const coat = (ordinal * 7 + source.family * 5) % COAT_NAMES.length;
    fighter.appearance = {
      version: 1, id, source: source.id, family: source.family, ordinal, seed,
      head, coat, back: (ordinal * 5 + source.family * 2) % 9,
      weapon: (source.family * 2 + ordinal) % 10,
      crest: 3 + ((ordinal + source.family) % 5),
      trim: (ordinal * 3 + source.family) % 6,
      colors: palette.slice(),
      // Head / shoulder / waist changes alter real vertices, not merely material hue.
      shape: [
        +(0.88 + fraction(seed, 0) * 0.26).toFixed(4),
        +(0.91 + fraction(seed, 8) * 0.22).toFixed(4),
        +(0.86 + fraction(seed, 16) * 0.31).toFixed(4),
        +(0.88 + fraction(seed, 24) * 0.28).toFixed(4),
        +(0.92 + (ordinal % 7) * 0.025).toFixed(4)
      ],
      label: `${HEAD_NAMES[head]}・${COAT_NAMES[coat]}`,
      modelIdentity: `generated:${id}:v1`
    };
    fighter.face = `assets/portraits/${id}.webp?v=20261106-illustrated1`;
    delete fighter.faceHue;
    changed.push(id);
  }
  return Object.freeze({ originals: Object.freeze(originals), changed: Object.freeze(changed) });
}




// 戦士データ。skills[0]=技A（立ち）, [1]=技A（移動中）, [2]=技B（立ち）, [3]=技B（移動中）
const FIGHTERS = {
  rowen: {
    name: 'ロウエン', title: '灰燼の渡り剣士', model: 'assets/models/hero-swordsman.glb',
    color: 0xffb347, height: 1.8, hp: 1000, speed: 6.2, overGain: 1, light: { dmg: 38, range: 2.1 },
    skills: [
      { name: '焔牙・昇', cost: 18, kind: 'shockwave', dmg: 70, radius: 2.8, color: 0xff9a4a },
      { name: '燕翔閃', cost: 22, kind: 'dash', dmg: 90, speed: 18, dur: 0.32, color: 0xffd27a },
      { name: '双燕', cost: 20, kind: 'projectile', visual: 'crescent', count: 2, spreadAng: 0.18, dmg: 50, speed: 18, radius: 0.5, color: 0xffc070 },
      { name: '灰舞', cost: 28, kind: 'rain', visual: 'blade', count: 6, spread: 1.6, radius: 1.3, dmg: 40, delay: 0.15, interval: 0.06, color: 0xff8a3d }
    ],
    over: { name: '灰燼百華', kind: 'rain', visual: 'blade', count: 16, spread: 3, radius: 1.6, dmg: 55, delay: 0.3, interval: 0.07, color: 0xff8a3d }
  },
  minase: {
    name: 'ミナセ', title: '霜を綴る織り手', model: 'assets/models/mage-weaver.glb',
    color: 0x8fd8ff, height: 1.65, hp: 850, speed: 5.6, overGain: 1.1, light: { dmg: 30, range: 1.9 },
    skills: [
      { name: '氷花連弾', cost: 20, kind: 'projectile', visual: 'ice', count: 3, spreadAng: 0.25, dmg: 55, speed: 16, radius: 0.6, color: 0x9fe8ff },
      { name: '霜柱', cost: 24, kind: 'rain', visual: 'crystal', count: 4, spread: 2, radius: 1.4, dmg: 60, delay: 0.4, interval: 0.1, color: 0xbff0ff },
      { name: '雪華陣', cost: 22, kind: 'shockwave', dmg: 65, radius: 4, color: 0xd8f6ff },
      { name: '凍て星', cost: 32, kind: 'rain', visual: 'meteor', count: 1, spread: 0, radius: 2.6, dmg: 130, delay: 0.7, interval: 0, color: 0x7fc8ff }
    ],
    over: { name: '蒼穹の落涙', kind: 'rain', visual: 'meteor', count: 8, spread: 3.5, radius: 2.2, dmg: 85, delay: 0.8, interval: 0.16, color: 0x6fb6ff }
  },
  garou: {
    name: 'ガロウ', title: '砂嵐の斧鬼', model: 'assets/models/brute-axe.glb',
    color: 0xd2603a, height: 2.0, hp: 1250, speed: 5.0, overGain: 0.9, light: { dmg: 52, range: 2.3 },
    skills: [
      { name: '地裂轟', cost: 25, kind: 'shockwave', dmg: 80, radius: 5, color: 0xffa060 },
      { name: '猛進斧', cost: 22, kind: 'dash', dmg: 95, speed: 14, dur: 0.4, color: 0xff7040 },
      { name: '投げ大斧', cost: 20, kind: 'projectile', visual: 'axe', count: 1, spreadAng: 0, dmg: 100, speed: 12, radius: 0.9, color: 0xe08050 },
      { name: '砂竜巻', cost: 30, kind: 'rain', visual: 'blade', count: 8, spread: 2.2, radius: 1.5, dmg: 45, delay: 0.3, interval: 0.08, color: 0xe8c080 }
    ],
    over: { name: '砕界の牙', kind: 'shockwave', dmg: 150, radius: 9, color: 0xff5a2a, double: true }
  },
  tsubaki: {
    name: 'ツバキ', title: '朧を渡る双刃', model: 'assets/models/shinobi-twin.glb',
    color: 0xd8405a, height: 1.6, hp: 820, speed: 7.2, overGain: 1.2, light: { dmg: 28, range: 1.8 },
    skills: [
      { name: '苦無五連', cost: 18, kind: 'projectile', visual: 'kunai', count: 5, spreadAng: 0.16, dmg: 28, speed: 22, radius: 0.35, color: 0xff7a90 },
      { name: '影走り', cost: 16, kind: 'dash', dmg: 70, speed: 24, dur: 0.24, color: 0xb03050 },
      { name: '霞斬', cost: 20, kind: 'shockwave', dmg: 60, radius: 2.6, color: 0xff98b0 },
      { name: '落葉', cost: 26, kind: 'rain', visual: 'blade', count: 9, spread: 2, radius: 1.1, dmg: 32, delay: 0.2, interval: 0.05, color: 0xff5070 }
    ],
    over: { name: '千影朧月', kind: 'rain', visual: 'blade', count: 26, spread: 3, radius: 1.2, dmg: 34, delay: 0.25, interval: 0.04, color: 0xff3a60 }
  },
  harlan: {
    name: 'ハーラン', title: '錆びぬ誓いの老騎士', model: 'assets/models/old-knight.glb',
    color: 0x7aa0d8, height: 1.85, hp: 1350, speed: 5.0, overGain: 0.9, light: { dmg: 46, range: 2.4 },
    skills: [
      { name: '盾鳴り', cost: 18, kind: 'shockwave', dmg: 55, radius: 3.2, color: 0xa8c8ff },
      { name: '突撃槍', cost: 22, kind: 'dash', dmg: 100, speed: 16, dur: 0.36, color: 0xc8d8ff },
      { name: '鉄壁の祈り', cost: 30, kind: 'heal', heal: 160, radius: 4, color: 0x9dffb0 },
      { name: '槍雨', cost: 28, kind: 'rain', visual: 'spear', count: 7, spread: 2.4, radius: 1.3, dmg: 50, delay: 0.4, interval: 0.07, color: 0xd8e4ff }
    ],
    over: { name: '老兵の凱歌', kind: 'rain', visual: 'spear', count: 16, spread: 3.2, radius: 1.5, dmg: 55, delay: 0.5, interval: 0.06, color: 0x9ec0ff }
  },
  pip: {
    name: 'ピップ', title: 'すす汚れの錬金見習い', model: 'assets/models/alchemist-boy.glb',
    color: 0x9be36a, height: 1.3, hp: 780, speed: 6.0, overGain: 1.15, light: { dmg: 26, range: 1.7 },
    skills: [
      { name: '火薬瓶', cost: 16, kind: 'projectile', visual: 'bomb', count: 1, spreadAng: 0, dmg: 70, speed: 13, radius: 0.8, color: 0xffb040 },
      { name: '連鎖爆薬', cost: 24, kind: 'rain', visual: 'meteor', count: 4, spread: 2.2, radius: 1.6, dmg: 50, delay: 0.5, interval: 0.15, color: 0xffa030 },
      { name: '薬草調合', cost: 28, kind: 'heal', heal: 140, radius: 5, color: 0x9dffb0 },
      { name: '煙玉ぽん', cost: 18, kind: 'shockwave', dmg: 45, radius: 3.5, color: 0xc8f0a0 }
    ],
    over: { name: '大釜のかんしゃく', kind: 'rain', visual: 'meteor', count: 11, spread: 3.8, radius: 2, dmg: 70, delay: 0.6, interval: 0.12, color: 0x9bff5a }
  },
  velka: {
    name: 'ヴェルカ', title: '森番の弓手', model: 'assets/models/ranger-archer.glb',
    color: 0x6fcf7f, height: 1.75, hp: 880, speed: 6.4, overGain: 1.05, light: { dmg: 32, range: 2.0 },
    skills: [
      { name: '三つ矢', cost: 16, kind: 'projectile', visual: 'arrow', count: 3, spreadAng: 0.12, dmg: 40, speed: 24, radius: 0.4, color: 0xb8ff9a },
      { name: '風翔', cost: 14, kind: 'dash', dmg: 50, speed: 20, dur: 0.25, color: 0x9affc0 },
      { name: '貫き矢', cost: 22, kind: 'projectile', visual: 'arrow', count: 1, spreadAng: 0, dmg: 110, speed: 30, radius: 0.5, color: 0xf0ffb0 },
      { name: '星降り矢', cost: 28, kind: 'rain', visual: 'spear', count: 9, spread: 2.6, radius: 1.2, dmg: 42, delay: 0.45, interval: 0.06, color: 0xc8ffb0 }
    ],
    over: { name: '天弓・百雨', kind: 'rain', visual: 'spear', count: 24, spread: 3.6, radius: 1.2, dmg: 38, delay: 0.5, interval: 0.04, color: 0x8affa0 }
  },
  osric: {
    name: 'オズリック', title: '黒鋼の流れ傭兵', model: 'assets/models/dark-mercenary.glb',
    color: 0x9a6adf, height: 1.95, hp: 1150, speed: 5.4, overGain: 1, light: { dmg: 50, range: 2.4 },
    skills: [
      { name: '虚空斬', cost: 24, kind: 'shockwave', dmg: 95, radius: 4.5, color: 0xb080ff },
      { name: '黒刃突', cost: 22, kind: 'dash', dmg: 105, speed: 17, dur: 0.33, color: 0x7a40d0 },
      { name: '黒炎弾', cost: 20, kind: 'projectile', visual: 'flame', count: 2, spreadAng: 0.3, dmg: 60, speed: 15, radius: 0.7, color: 0xa060ff },
      { name: '断罪の刃', cost: 32, kind: 'rain', visual: 'sword', count: 3, spread: 1.2, radius: 2, dmg: 90, delay: 0.5, interval: 0.15, color: 0xc090ff }
    ],
    over: { name: '冥夜崩し', kind: 'judgment', visual: 'pillar', count: 6, spread: 4, radius: 2, dmg: 60, delay: 0.7, interval: 0.12, finalDmg: 200, finalRadius: 5.5, color: 0x9a50ff }
  },
  noa: {
    name: 'ノア', title: '鐘を抱く巡礼者', model: 'assets/models/bell-priestess.glb',
    color: 0xf2f0c8, height: 1.6, hp: 800, speed: 5.6, overGain: 1.2, light: { dmg: 26, range: 1.9 },
    skills: [
      { name: '癒しの鈴', cost: 26, kind: 'heal', heal: 180, radius: 6, color: 0x9dffb0 },
      { name: '聖鈴弾', cost: 16, kind: 'projectile', visual: 'orb', count: 3, spreadAng: 0.2, dmg: 38, speed: 15, radius: 0.5, color: 0xfff8c0 },
      { name: '光輪', cost: 20, kind: 'shockwave', dmg: 60, radius: 4, color: 0xfff4b0 },
      { name: '祝福の灯柱', cost: 28, kind: 'rain', visual: 'pillar', count: 5, spread: 2.5, radius: 1.4, dmg: 55, delay: 0.5, interval: 0.1, color: 0xfffad0 }
    ],
    over: { name: '鐘楼の奇跡', kind: 'heal', heal: 450, radius: 12, color: 0xc8ffd0 }
  },
  kurouga: {
    name: 'クロウガ', title: '月吠えの獣戦士', model: 'assets/models/wolf-warrior.glb',
    color: 0x9fb2d8, height: 1.9, hp: 1100, speed: 6.6, overGain: 1.05, light: { dmg: 40, range: 1.9 },
    skills: [
      { name: '遠吠え', cost: 20, kind: 'shockwave', dmg: 60, radius: 3.6, color: 0xc8d8ff },
      { name: '裂爪', cost: 18, kind: 'dash', dmg: 85, speed: 20, dur: 0.28, color: 0xd8e4ff },
      { name: '牙投げ', cost: 18, kind: 'projectile', visual: 'kunai', count: 3, spreadAng: 0.2, dmg: 40, speed: 20, radius: 0.45, color: 0xeef4ff },
      { name: '狩りの月', cost: 28, kind: 'rain', visual: 'blade', count: 7, spread: 2, radius: 1.3, dmg: 42, delay: 0.2, interval: 0.06, color: 0xb0c8ff }
    ],
    over: { name: '銀狼月牙', kind: 'rain', visual: 'blade', count: 20, spread: 3, radius: 1.4, dmg: 40, delay: 0.3, interval: 0.05, color: 0xe0ecff }
  },
  rinfa: {
    name: 'リンファ', title: '拳で祈る修行僧', model: 'assets/models/monk-brawler.glb',
    color: 0xff7a3a, height: 1.65, hp: 950, speed: 6.8, overGain: 1.1, light: { dmg: 34, range: 1.7 },
    skills: [
      { name: '炎拳弾', cost: 16, kind: 'projectile', visual: 'flame', count: 1, spreadAng: 0, dmg: 75, speed: 18, radius: 0.7, color: 0xff8a40 },
      { name: '縮地', cost: 14, kind: 'dash', dmg: 60, speed: 22, dur: 0.22, color: 0xffb070 },
      { name: '旋風脚', cost: 20, kind: 'shockwave', dmg: 70, radius: 3, color: 0xffa060 },
      { name: '百烈天衝', cost: 28, kind: 'rain', visual: 'pillar', count: 3, spread: 1.2, radius: 1.5, dmg: 70, delay: 0.3, interval: 0.12, color: 0xff6a2a }
    ],
    over: { name: '紅蓮昇華', kind: 'judgment', visual: 'pillar', count: 5, spread: 2.5, radius: 1.8, dmg: 60, delay: 0.5, interval: 0.1, finalDmg: 180, finalRadius: 4.5, color: 0xff5020 }
  },
  igna: {
    name: 'イグナ', title: '竜鱗の跳槍騎', model: 'assets/models/dragoon-lancer.glb',
    color: 0x3ac0a0, height: 1.8, hp: 1050, speed: 6.0, overGain: 1, light: { dmg: 42, range: 2.6 },
    skills: [
      { name: '跳槍', cost: 22, kind: 'rain', visual: 'spear', count: 1, spread: 0, radius: 2.4, dmg: 120, delay: 0.55, interval: 0, color: 0x6affd0 },
      { name: '疾槍', cost: 20, kind: 'dash', dmg: 90, speed: 19, dur: 0.3, color: 0x8affe0 },
      { name: '薙ぎ払い', cost: 20, kind: 'shockwave', dmg: 70, radius: 3.2, color: 0x5ae0b0 },
      { name: '竜鱗弾', cost: 20, kind: 'projectile', visual: 'ice', count: 3, spreadAng: 0.22, dmg: 45, speed: 17, radius: 0.55, color: 0x7affd8 }
    ],
    over: { name: '天墜竜槍', kind: 'rain', visual: 'spear', count: 12, spread: 3.2, radius: 1.8, dmg: 65, delay: 0.6, interval: 0.08, color: 0x40ffc0 }
  },
  petra: {
    name: 'ペトラ', title: 'ぜんまい仕掛けの人形師', model: 'assets/models/clockwork-puppeteer.glb',
    color: 0xe0b050, height: 1.5, hp: 880, speed: 5.8, overGain: 1.15, light: { dmg: 28, range: 1.9 },
    skills: [
      { name: '歯車弾', cost: 16, kind: 'projectile', visual: 'axe', count: 2, spreadAng: 0.25, dmg: 45, speed: 15, radius: 0.6, color: 0xffd070 },
      { name: '糸繰り', cost: 16, kind: 'dash', dmg: 60, speed: 18, dur: 0.28, color: 0xfff0b0 },
      { name: '人形の舞', cost: 28, kind: 'rain', visual: 'sword', count: 5, spread: 2.4, radius: 1.4, dmg: 55, delay: 0.4, interval: 0.1, color: 0xffc860 },
      { name: '発条炸裂', cost: 22, kind: 'shockwave', dmg: 70, radius: 4, color: 0xffb040 }
    ],
    over: { name: '大劇場・終幕', kind: 'rain', visual: 'sword', count: 14, spread: 3.5, radius: 1.6, dmg: 55, delay: 0.5, interval: 0.08, color: 0xffe080 }
  },
  seraphel: {
    name: 'セラフェル', title: '終天の裁定者', model: 'assets/models/verdict-maiden-v2.glb',
    color: 0x6aa8ff, height: 1.85, hp: 2200, speed: 6.0, overGain: 1.6, locked: true, light: { dmg: 48, range: 2.4 },
    skills: [
      { name: '光槍連星《ルクス・カスケード》', cost: 30, kind: 'rain', visual: 'spear', count: 18, spread: 4, radius: 1.3, dmg: 40, delay: 0.5, interval: 0.05, color: 0xfff6c8 },
      { name: '天秤の刃', cost: 20, kind: 'dash', dmg: 110, speed: 20, dur: 0.3, color: 0xfff0a0 },
      { name: '審問光弾', cost: 22, kind: 'projectile', visual: 'feather', count: 5, spreadAng: 0.22, dmg: 45, speed: 17, radius: 0.6, color: 0xfffbd8 },
      { name: '白翼陣', cost: 26, kind: 'shockwave', dmg: 90, radius: 6, color: 0xffffff }
    ],
    over: { name: '千重審判《ミリアド・ヴァーディクト》', kind: 'judgment', visual: 'pillar', count: 12, spread: 6, radius: 2.4, dmg: 70, delay: 1.0, interval: 0.12, finalDmg: 260, finalRadius: 7, color: 0xfff1a0 }
  }
};

const ROSTER = ['rowen', 'minase', 'garou', 'tsubaki', 'harlan', 'pip', 'velka', 'osric', 'noa', 'kurouga', 'rinfa', 'igna', 'petra'];
const BASE_KEYS = ROSTER.slice();
for (const k of [...BASE_KEYS, 'seraphel']) FIGHTERS[k].face = `assets/face-${k}.webp`;
FIGHTERS.uninomiya = {
  name: '宇邇宮', title: '雅を極めし白粉の公達', model: 'assets/models/uninomiya.glb', face: 'assets/face-uninomiya.webp',
  color: 0xb8b0a0, height: 1.75, hp: 1150, speed: 5.8, overGain: 1.2,
  // 通常攻撃：天叢雲の太刀で周囲を薙ぐ回転斬り
  light: { dmg: 40, range: 2.4, spin: true, color: 0x40c8ff },
  skills: [
    // 光の槍を天から降らせる
    { name: '煌槍・天降り', cost: 22, kind: 'rain', visual: 'spear', count: 9, spread: 2.6, radius: 1.3, dmg: 46, delay: 0.35, interval: 0.06, elem: 5, color: 0xffd040, vivid: true },
    // 雷をまとった神威の刃を敵頭上へ三度落とす
    { name: '神威雷刃', cost: 24, kind: 'rain', visual: 'bolt', count: 3, spread: 0.8, radius: 1.8, dmg: 72, delay: 0.3, interval: 0.18, elem: 2, color: 0xfff020, vivid: true },
    // 三つの雷光球が連なって走る
    { name: '三華雷閃', cost: 20, kind: 'projectile', visual: 'spark', count: 3, spreadAng: 0.0, chain: 0.12, dmg: 48, speed: 19, radius: 0.7, elem: 2, color: 0x80e0ff, vivid: true },
    { name: '公達の摺り足', cost: 16, kind: 'dash', dmg: 80, speed: 18, dur: 0.3, elem: 3, color: 0x60ffc0, vivid: true }
  ],
  // 天を裂く巨大な雷の剣が落ち、紫電の柱が乱れ立つ
  over: { name: '天譴大雷剣・憤怒の審', kind: 'judgment', visual: 'bolt', finalVisual: 'bigsword', count: 8, spread: 3.8, radius: 1.8, dmg: 55, delay: 0.6, interval: 0.09, finalDmg: 240, finalRadius: 6, elem: 2, color: 0xb070ff, vivid: true }
};
ROSTER.push('uninomiya');
// セラフェル：裁定者の5つの大技（通常攻撃は赤い光線弾の連射）
Object.assign(FIGHTERS.seraphel, {
  light: { dmg: 16, range: 2.4, shots: 4, color: 0xff1a2a },
  skills: [
    // 太古の星を灼熱とともに落とす
    { name: '太古星焔《アルカ・ノヴァ》', cost: 30, kind: 'rain', visual: 'nova', count: 1, spread: 0, radius: 4.2, dmg: 190, delay: 0.9, interval: 0, elem: 0, color: 0xff5010, vivid: true },
    // 闇の重力で敵を引き寄せ、圧し潰して爆ぜる
    { name: '終圧崩界《インプロード・フィン》', cost: 28, kind: 'implode', dmg: 150, radius: 6, elem: 6, color: 0x9a20ff, vivid: true },
    // 刃のような暴風が渦巻いて吹き荒れる
    { name: '戦慄の大旋嵐《テラー・テンペスト》', cost: 28, kind: 'rain', visual: 'tornado', count: 5, spread: 3.2, radius: 2, dmg: 55, delay: 0.3, interval: 0.14, elem: 3, color: 0x30ffb0, vivid: true },
    // 神裁の雷刃
    { name: '神裁雷刃《セイクリッド・エッジ》', cost: 24, kind: 'rain', visual: 'bolt', count: 4, spread: 1, radius: 1.8, dmg: 62, delay: 0.3, interval: 0.14, elem: 2, color: 0xffe830, vivid: true }
  ],
  // 天から聖なる光の奔流が降り注ぎ、すべてを浄め消し去る
  over: { name: '大浄滅《グラン・パージ》', kind: 'judgment', visual: 'pillar', count: 12, spread: 6, radius: 2.4, dmg: 70, delay: 1.0, interval: 0.1, finalDmg: 280, finalRadius: 7.5, elem: 5, color: 0xffc030, vivid: true }
});

// 運営長専用：白耀の天后ルミナリア（運営の鍵でのみ使える、全戦士中ずば抜けた最強）
FIGHTERS.chief = {
  name: 'ルミナリア', title: '白耀の天后（運営長）', model: 'assets/models/chief-empress.glb', face: 'assets/face-chief.webp',
  color: 0xfff4d0, height: 1.85, hp: 1500, speed: 6, overGain: 1.5, locked: true, special: 'chief',
  light: { dmg: 22, range: 2.6, shots: 5, color: 0xffd040 },
  skills: [
    { name: '天后の鳳翼《フェニクス・ロア》', cost: 24, kind: 'rain', visual: 'nova', count: 3, spread: 2.5, radius: 3.6, dmg: 160, delay: 0.6, interval: 0.2, elem: 0, color: 0xff7020, vivid: true },
    { name: '白耀天輪', cost: 22, kind: 'shockwave', dmg: 170, radius: 8, elem: 5, color: 0xffe060, vivid: true },
    { name: '天裁雷雨《ディヴァイン・ストーム》', cost: 24, kind: 'rain', visual: 'bolt', count: 7, spread: 3, radius: 2, dmg: 70, delay: 0.25, interval: 0.08, elem: 2, color: 0xfff030, vivid: true },
    { name: '袖下の深淵', cost: 26, kind: 'implode', dmg: 180, radius: 7, elem: 6, color: 0xb040ff, vivid: true }
  ],
  over: { name: '天地開闢・白耀の御宣', kind: 'judgment', visual: 'pillar', finalVisual: 'bigsword', count: 16, spread: 7, radius: 2.6, dmg: 90, delay: 0.8, interval: 0.07, finalDmg: 400, finalRadius: 9, elem: 5, color: 0xffd860, vivid: true }
};
// ショップ（課金）で解放：紅外套の剣士クレイド
FIGHTERS.crimson = {
  name: 'クレイド', title: '紅外套の流浪剣士', model: 'assets/models/crimson-swordsman.glb', face: 'assets/face-crimson.webp',
  color: 0xe04a28, height: 1.75, hp: 1150, speed: 6.6, overGain: 1.15, shop: true,
  light: { dmg: 44, range: 2.2 },
  skills: [
    { name: '魔神閃', cost: 16, kind: 'projectile', dmg: 70, speed: 18, radius: 0.8, count: 1, spreadAng: 0, elem: 3, color: 0x40ffc0, vivid: true },
    { name: '紅蓮翔斬', cost: 20, kind: 'dash', dmg: 105, speed: 20, dur: 0.3, elem: 0, color: 0xff4010, vivid: true },
    { name: '獅吼烈破', cost: 22, kind: 'shockwave', dmg: 110, radius: 5, elem: 5, color: 0xffc040, vivid: true },
    { name: '天落雷斬', cost: 24, kind: 'rain', visual: 'bolt', count: 3, spread: 1, radius: 1.8, dmg: 60, delay: 0.3, interval: 0.15, elem: 2, color: 0xfff040, vivid: true }
  ],
  over: { name: '冥空紅蓮斬', kind: 'judgment', visual: 'pillar', count: 8, spread: 4, radius: 2, dmg: 60, delay: 0.6, interval: 0.1, finalDmg: 260, finalRadius: 6, elem: 0, color: 0xff3010, vivid: true }
};
// 運営長専用：冥紫の魔后ヴェスペラ（第一形態）→ 体力半分で第二形態「緋髪の深淵后」へ戦闘中に変身
FIGHTERS.sovereign = {
  name: 'ヴェスペラ', title: '冥紫の魔后（運営長・第一形態）', model: 'assets/models/void-sovereign-f1.glb', face: 'assets/face-sovereign.webp',
  color: 0x9a40ff, height: 1.8, hp: 1600, speed: 6.4, overGain: 1.6, locked: true, special: 'chief', form2: 'sovereign2',
  light: { dmg: 30, range: 2.6, shots: 6, color: 0xb050ff },
  skills: [
    { name: '冥鎖刃《ノクス・チェイン》', cost: 20, kind: 'projectile', dmg: 150, speed: 22, radius: 1.1, count: 1, spreadAng: 0, elem: 6, color: 0xa040ff, vivid: true },
    { name: '紫影閃舞', cost: 20, kind: 'dash', dmg: 170, speed: 24, dur: 0.32, elem: 6, color: 0xc060ff, vivid: true },
    { name: '冥雷葬列', cost: 24, kind: 'rain', visual: 'bolt', count: 9, spread: 3.2, radius: 2.1, dmg: 80, delay: 0.25, interval: 0.07, elem: 2, color: 0xd070ff, vivid: true },
    { name: '虚空の檻', cost: 26, kind: 'implode', dmg: 220, radius: 7.5, elem: 6, color: 0x8020ff, vivid: true }
  ],
  over: { name: '終夜・冥紫天蓋', kind: 'judgment', visual: 'pillar', finalVisual: 'bigsword', count: 18, spread: 7, radius: 2.6, dmg: 100, delay: 0.7, interval: 0.06, finalDmg: 460, finalRadius: 9.5, elem: 6, color: 0xa040ff, vivid: true }
};
FIGHTERS.sovereign2 = {
  name: 'ヴェスペラ', title: '緋髪の深淵后（運営長・第二形態）', model: 'assets/models/void-sovereign-f2.glb', face: 'assets/face-sovereign2.webp',
  color: 0xff3050, height: 2.15, hp: 2400, speed: 6.8, overGain: 2, locked: true, special: 'chief', hidden: true,
  light: { dmg: 34, range: 2.8, shots: 8, color: 0xff3060 },
  skills: [
    { name: '緋天冠刃《クラウン・レイ》', cost: 18, kind: 'projectile', dmg: 190, speed: 26, radius: 1.3, count: 1, spreadAng: 0, elem: 9, color: 0xff2040, vivid: true },
    { name: '深淵環《アビス・ヘイロー》', cost: 22, kind: 'shockwave', dmg: 240, radius: 9, elem: 6, color: 0xc040ff, vivid: true },
    { name: '血紅流星雨', cost: 24, kind: 'rain', visual: 'nova', count: 6, spread: 3.5, radius: 3.2, dmg: 150, delay: 0.5, interval: 0.12, elem: 0, color: 0xff3020, vivid: true },
    { name: '冥后の抱擁', cost: 26, kind: 'implode', dmg: 280, radius: 8.5, elem: 9, color: 0xff2060, vivid: true }
  ],
  over: { name: '深淵開闢・緋紫の終焉', kind: 'judgment', visual: 'pillar', finalVisual: 'bigsword', count: 24, spread: 8, radius: 2.8, dmg: 120, delay: 0.7, interval: 0.05, finalDmg: 650, finalRadius: 11, elem: 9, color: 0xff2050, vivid: true }
};
// 新氷属性運営長キャラ（ゲーム本体のデータと一致）
FIGHTERS.valgard = {
  name: 'ヴァルガルド', title: '氷鋼の覇王（運営長専用）',
  model: 'assets/models/iron-warlord.glb', face: 'assets/face-valgard.webp',
  color: 0x8cdcff, height: 2.06, hp: 1850, speed: 5.8, overGain: 1.65,
  locked: true, special: 'chief',
  light: { dmg: 66, range: 2.6, color: 0xb8efff },
  skills: [
    { name: '凍牙・氷鋼砕', cost: 21, kind: 'shockwave', dmg: 160, radius: 6.3, elem: 1, color: 0x89e7ff, vivid: true },
    { name: '白銀氷鎧突', cost: 19, kind: 'dash', dmg: 145, speed: 19, dur: 0.34, elem: 1, color: 0xb4efff, vivid: true },
    { name: '第九位氷晶術《グレイシャル・ランス》', cost: 29, castTime: 1.65, kind: 'projectile', visual: 'ice', count: 8, spreadAng: 0.20, dmg: 82, speed: 23, radius: 0.75, elem: 1, color: 0x64d5ff, vivid: true },
    { name: '禁呪《絶対氷葬界》', cost: 36, castTime: 1.85, kind: 'judgment', visual: 'crystal', finalVisual: 'pillar', count: 10, spread: 4.8, radius: 2.1, dmg: 105, delay: 0.55, interval: 0.10, finalDmg: 370, finalRadius: 7.8, elem: 1, color: 0xc6f4ff, vivid: true }
  ],
  over: { name: '終極氷皇術《エターナル・ゼロ》', castTime: 2.45, kind: 'judgment', visual: 'crystal', finalVisual: 'pillar', count: 16, spread: 7.2, radius: 2.5, dmg: 108, delay: 0.7, interval: 0.08, finalDmg: 520, finalRadius: 9.1, elem: 1, color: 0x70ddff, vivid: true }
};
// 運営長だけが灯晶で購入できる特別キャラ：血魔ザルグレイヴ（血属性）
const BLOODFIEND_PRICE = 50000;
FIGHTERS.bloodfiend = {
  name: 'ザルグレイヴ', title: '紅翼の血魔（運営長・灯晶限定）', model: 'assets/models/blood-fiend-v2.glb', face: 'assets/face-bloodfiend-v2.webp',
  color: 0xc8102e, height: 1.95, hp: 1500, speed: 6.6, overGain: 1.5, locked: true, special: 'chief', shardPrice: BLOODFIEND_PRICE,
  light: { dmg: 30, range: 2.6, shots: 5, color: 0xe0103c },
  skills: [
    { name: '血爪閃《クリムゾン・クロウ》', cost: 18, kind: 'projectile', visual: 'crescent', count: 3, spreadAng: 0.2, dmg: 120, speed: 22, radius: 1, elem: 9, color: 0xe0103c, vivid: true },
    { name: '紅翼急襲', cost: 20, kind: 'dash', dmg: 170, speed: 25, dur: 0.32, elem: 9, color: 0xff2040, vivid: true },
    { name: '鮮血千本槍', cost: 24, kind: 'rain', visual: 'spear', count: 12, spread: 3.6, radius: 1.8, dmg: 90, delay: 0.3, interval: 0.05, elem: 9, color: 0xc8102e, vivid: true },
    { name: '血界・吸命陣', cost: 26, kind: 'implode', dmg: 230, radius: 8, elem: 9, color: 0x9a0020, vivid: true }
  ],
  over: { name: '紅月葬送・血華の宴', kind: 'judgment', visual: 'pillar', finalVisual: 'bigsword', count: 18, spread: 7, radius: 2.6, dmg: 100, delay: 0.7, interval: 0.06, finalDmg: 480, finalRadius: 9.5, elem: 9, color: 0xe0103c, vivid: true }
};
// 通常プレイヤーがパーティーに入れられない特別枠
const SPECIAL_KEYS = ['seraphel', 'chief', 'crimson', 'sovereign', 'bloodfiend', 'operator_gigantes', 'maou'];

// ---------- 決定的な乱数（毎回同じ内容を生成する） ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOf = (r, arr) => arr[Math.floor(r() * arr.length)];
function shiftHex(hex, dh, ds = 0, dl = 0) {
  let r = ((hex >> 16) & 255) / 255, g = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0, l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  h = (((h + dh) % 1) + 1) % 1;
  s = Math.max(0, Math.min(1, s + ds));
  l = Math.max(0.05, Math.min(0.95, l + dl));
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round((l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

// ---------- 技の書：100種 ----------
// 属性：st=状態異常キー, sn=表示名, sc=表示色
const ELEMS = [
  { n: '炎', c: 0xff4a12, p: 'flame', st: 'burn', sn: '火傷' },
  { n: '氷', c: 0x30d0ff, p: 'ice', st: 'freeze', sn: '凍結' },
  { n: '雷', c: 0xffe010, p: 'orb', st: 'para', sn: '麻痺' },
  { n: '風', c: 0x20f0a0, p: 'feather', st: 'slow', sn: '鈍足' },
  { n: '地', c: 0xc0701c, p: 'axe', st: 'petrify', sn: '石化' },
  { n: '光', c: 0xffb820, p: 'orb', st: 'blind', sn: '眩惑' },
  { n: '闇', c: 0x8a1cff, p: 'flame', st: 'curse', sn: '呪い' },
  { n: '水', c: 0x1a60ff, p: 'orb', st: 'silence', sn: '封技' },
  { n: '毒', c: 0x90e010, p: 'feather', st: 'poison', sn: '毒' },
  { n: '血', c: 0xe0103c, p: 'kunai', st: 'bleed', sn: '出血' }
];
const ELEM_HINT = [/[焔炎火紅灰燼爆薬釜]/, /[氷霜雪凍冷蒼]/, /[雷鳴電神]/, /[風翔嵐燕旋矢]/, /[地砂岩石砕鉄盾斧発条歯車]/, /[光聖鈴輪祝白天星翼]/, /[闇黒冥虚影夜断]/, /[水雨涙流]/, /[毒煙薬草花]/, /[血牙爪刃斬裂槍]/];
function hashStr(s) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return h >>> 0;
}
// 名前付きの技に属性・色・形・音を振る（未指定のもの）
function finalizeSkill(s, fallbackElem) {
  if (s.elem == null) {
    const i = ELEM_HINT.findIndex((re) => re.test(s.name));
    s.elem = i >= 0 ? i : fallbackElem;
  }
  const h = hashStr(s.name);
  s.shape ??= h % 100;
  s.snd ??= (h >>> 8) % 100;
  if (s.kind === 'heal') s.color = 0x30ff70;
  else if (!s.vivid) s.color = shiftHex(ELEMS[s.elem].c, (((h >>> 4) % 9) - 4) * 0.02, 0, (((h >>> 12) % 5) - 2) * 0.05);
  s.vivid = true;
  return s;
}
const FORMS = [
  (e) => ({ name: e.n + '牙衝', cost: 20, kind: 'shockwave', dmg: 70, radius: 3.2 }),
  (e) => ({ name: e.n + '迅閃', cost: 18, kind: 'dash', dmg: 85, speed: 19, dur: 0.3 }),
  (e) => ({ name: e.n + '連弾', cost: 18, kind: 'projectile', visual: e.p, count: 3, spreadAng: 0.2, dmg: 42, speed: 17, radius: 0.55 }),
  (e) => ({ name: e.n + '刃雨', cost: 26, kind: 'rain', visual: 'blade', count: 7, spread: 2.2, radius: 1.3, dmg: 42, delay: 0.25, interval: 0.06 }),
  (e) => ({ name: e.n + '落星', cost: 30, kind: 'rain', visual: 'meteor', count: 3, spread: 2.2, radius: 1.8, dmg: 70, delay: 0.55, interval: 0.15 }),
  (e) => ({ name: e.n + '天柱', cost: 26, kind: 'rain', visual: 'pillar', count: 4, spread: 2.4, radius: 1.4, dmg: 55, delay: 0.45, interval: 0.1 }),
  (e) => ({ name: e.n + '月刃', cost: 20, kind: 'projectile', visual: 'crescent', count: 2, spreadAng: 0.16, dmg: 52, speed: 18, radius: 0.55 }),
  (e) => ({ name: e.n + '大輪陣', cost: 26, kind: 'shockwave', dmg: 85, radius: 5 }),
  (e) => ({ name: e.n + '槍雨', cost: 26, kind: 'rain', visual: 'spear', count: 7, spread: 2.4, radius: 1.3, dmg: 48, delay: 0.4, interval: 0.07 }),
  (e) => ['光', '水'].includes(e.n)
    ? { name: e.n + '癒結', cost: 28, kind: 'heal', heal: 150, radius: 5 }
    : { name: e.n + '晶棘', cost: 24, kind: 'rain', visual: 'crystal', count: 4, spread: 2, radius: 1.4, dmg: 58, delay: 0.4, interval: 0.1 }
];
const SKILLS = [];
ELEMS.forEach((e, ei) => FORMS.forEach((fm, fi) => {
  const s = { ...fm(e), color: shiftHex(e.c, (fi - 4.5) * 0.022, 0, ((fi % 3) - 1) * 0.07), elem: ei, shape: ei * 10 + fi, snd: ei * 10 + fi, vivid: true };
  if (s.kind === 'heal') s.color = 0x30ff70;
  SKILLS.push(s);
}));
// 名前付き戦士（基本13体・宇邇宮・セラフェル）の技を仕上げる
Object.values(FIGHTERS).forEach((f, fi) => {
  f.skills.forEach((s) => finalizeSkill(s, fi % 10));
  finalizeSkill(f.over, fi % 10);
});
const OVER_WORDS = ['百華', '天墜', '終焉', '神鳴', '大輪', '万象'];
function makeOver(r, e) {
  const kind = r();
  const name = e.n + pickOf(r, OVER_WORDS) + '・極';
  const o = makeOver0(r, e, kind, name);
  o.elem = ELEMS.indexOf(e);
  return finalizeSkill(o, o.elem);
}
function makeOver0(r, e, kind, name) {
  if (kind < 0.35) return { name, kind: 'rain', visual: pickOf(r, ['blade', 'spear', 'sword']), count: 16, spread: 3.2, radius: 1.5, dmg: 52, delay: 0.4, interval: 0.06, color: e.c };
  if (kind < 0.6) return { name, kind: 'rain', visual: 'meteor', count: 9, spread: 3.6, radius: 2, dmg: 75, delay: 0.6, interval: 0.13, color: e.c };
  if (kind < 0.85) return { name, kind: 'judgment', visual: 'pillar', count: 6, spread: 3.5, radius: 1.9, dmg: 58, delay: 0.6, interval: 0.11, finalDmg: 190, finalRadius: 5, color: e.c };
  return { name, kind: 'shockwave', dmg: 150, radius: 8.5, double: true, color: e.c };
}

// ---------- 追加の戦士：合計100体 ----------
const BASE_ROLE = ['剣士', '術士', '斧使い', '忍び', '騎士', '錬金術師', '弓手', '傭兵', '巫女', '獣戦士', '拳士', '槍騎士', '人形師'];
const EPITHETS = ['流れ星の', '霧雨の', '鉄錆の', '白夜の', '夕凪の', '砂紋の', '月下の', '雷鳴の', '花冷えの', '灰色の', '星読みの', '真鍮の', '琥珀の', '朝凪の', '宵闇の', '渡り鳥の', '風見の', '雪割りの', '紅蓮の', '翡翠の'];
const SY1 = ['ア', 'カ', 'サ', 'タ', 'ナ', 'ハ', 'マ', 'ラ', 'ヴァ', 'ゼ', 'リ', 'ミ', 'ユ', 'ク', 'シ', 'ト', 'ノ', 'フ', 'ル', 'セ', 'エ', 'オ'];
const SY2 = ['ル', 'リ', 'ナ', 'ロ', 'ズ', 'ヤ', 'ミ', 'レ', 'ガ', 'ディ', 'キ', 'サ'];
const SY3 = ['ン', 'ア', 'ス', 'オ', 'ラ', 'ト', 'ヴ', 'エ', 'ル', 'カ'];
const usedNames = new Set(Object.values(FIGHTERS).map((f) => f.name));
function freshName(r) {
  for (let i = 0; i < 200; i++) {
    const n = pickOf(r, SY1) + pickOf(r, SY2) + pickOf(r, SY3);
    if (!usedNames.has(n)) {
      usedNames.add(n);
      return n;
    }
  }
  return 'ナナシ' + usedNames.size;
}
function genFighter(r, bi, extra) {
  const base = FIGHTERS[BASE_KEYS[bi]];
  const e = ELEMS[Math.floor(r() * ELEMS.length)];
  const pool = SKILLS.filter((s) => s.elem === ELEMS.indexOf(e) || r() < 0.08);
  const picks = [];
  while (picks.length < 4) {
    const s = pickOf(r, pool);
    if (!picks.includes(s)) picks.push(s);
  }
  return {
    name: freshName(r), title: pickOf(r, EPITHETS) + BASE_ROLE[bi], model: base.model, face: base.face, faceHue: Math.round(r() * 300 + 30),
    color: e.c, tint: shiftHex(e.c, 0, -0.2, -0.1), height: base.height * (0.92 + r() * 0.16),
    hp: Math.round(base.hp * (0.9 + r() * 0.2)), speed: +(base.speed * (0.93 + r() * 0.14)).toFixed(2),
    overGain: base.overGain, light: { ...base.light },
    skills: picks.map((s) => ({ ...s })), over: makeOver(r, e), ...extra
  };
}
{
  const r = rng(2024);
  for (let i = 0; ROSTER.length < 100; i++) {
    const k = 'g' + i;
    FIGHTERS[k] = genFighter(r, i % BASE_KEYS.length, {});
    ROSTER.push(k);
  }
}

// ---------- 敵キャラ：100体（選択不可、物語と共闘戦に登場） ----------
const FOE_PRE = ['朽ちた', '狂える', '影の', '砂喰いの', '氷棺の', '錆鉄の', '夜啼きの', '偽りの', '呪われし', '黄昏の'];
const FOE_KIND = ['亡霊剣士', '魔女', '鬼', '刺客', '黒騎士', '小鬼', '狩人', '傀儡兵', '堕ちた巫女', '人狼', '破戒僧', '竜騎兵', 'からくり'];
const ENEMY_ROSTER = [];
{
  const r = rng(666);
  for (let i = 0; i < 100; i++) {
    const bi = i % BASE_KEYS.length;
    const pre = FOE_PRE[Math.floor(i / BASE_KEYS.length + i) % FOE_PRE.length];
    const f = genFighter(r, bi, { enemy: true });
    f.name = pre + FOE_KIND[bi];
    if (ENEMY_ROSTER.some((k) => FIGHTERS[k].name === f.name)) f.name += '・' + '壱弐参肆伍陸漆捌玖'[i % 9];
    f.title = '灯を喰らう者';
    f.tint = shiftHex(f.color, 0, -0.3, -0.35);
    f.hp = Math.round(f.hp * 0.8);
    FIGHTERS['m' + i] = f;
    ENEMY_ROSTER.push('m' + i);
  }
}

// seg=床の多角形の辺数, pshape=柱の形, cshape=浮遊石の形
const STAGES = [
  { id: 'moon', name: '双月の闘技場', sky: 'assets/twin-moon-sky.webp', floor: 0xffffff, seg: 64, rim: 0xc9a65a, pillar: 0x8c8aa0, pshape: 'cyl', crystal: 0x9fe8ff, cshape: 'oct', fog: 0x2a2850, hemi: 0xcfd8ff, sun: 0xfff0d8 },
  { id: 'desert', name: '砂塵の古円', sky: 'assets/desert-dusk-sky.webp', floor: 0xf2c88a, seg: 8, rim: 0xb07a3a, pillar: 0xb08050, pshape: 'box', crystal: 0xffa040, cshape: 'ico', fog: 0x9a5a3a, hemi: 0xffd8b0, sun: 0xffb070 },
  { id: 'frost', name: '霜の書架', sky: 'assets/frost-aurora-sky.webp', floor: 0xbfe6ff, seg: 6, rim: 0xe0f4ff, pillar: 0xdff4ff, pshape: 'spire', crystal: 0x8fe0ff, cshape: 'oct', fog: 0x4a6a8a, hemi: 0xc8f0ff, sun: 0xd8f0ff },
  { id: 'bamboo', name: '鳴かぬ竹林', sky: 'assets/bamboo-night-sky.webp', floor: 0xa8d090, seg: 12, rim: 0x6a9a4a, pillar: 0x5a9a4a, pshape: 'bamboo', crystal: 0xc8ff8a, cshape: 'ico', fog: 0x1f3a2a, hemi: 0xb8e8c8, sun: 0xe8f8d0 },
  { id: 'heaven', name: '天秤の間', sky: 'assets/heaven-scale-sky.webp', floor: 0xfff2cc, seg: 4, rim: 0xffe08a, pillar: 0xfff8e0, pshape: 'cyl', crystal: 0xfff1a0, cshape: 'torus', fog: 0xd8c08a, hemi: 0xfff4d8, sun: 0xffffff },
  { id: 'ember', name: '燠火の祭壇', sky: 'assets/desert-dusk-sky.webp', floor: 0xff9a7a, seg: 5, rim: 0xff5a2a, pillar: 0x5a2a2a, pshape: 'spire', crystal: 0xff5a2a, cshape: 'ico', fog: 0x4a1a1a, hemi: 0xffb0a0, sun: 0xff8050 },
  { id: 'void', name: '月影の回廊', sky: 'assets/twin-moon-sky.webp', floor: 0x9a8acc, seg: 10, rim: 0xc090ff, pillar: 0x4a3a6a, pshape: 'box', crystal: 0xc090ff, cshape: 'torus', fog: 0x1a1030, hemi: 0xb8a8ff, sun: 0xd8c8ff }
];

// ---------- 音楽：100曲（Web Audioで生成） ----------
const BGM_A = ['暁', '黄昏', '月影', '嵐', '星屑', '灯火', '雪解け', '砂塵', '深淵', '凱旋'];
const BGM_B = ['の行進', 'の舞曲', 'の円舞', 'の鼓動', 'の追想', 'の戦歌', 'の祈り', 'の疾走', 'の残響', 'の序曲'];
const BGM = [];
for (let i = 0; i < 100; i++) {
  // テンポは136〜175で散らし、10曲に3曲は壮大編成（金管・聖歌隊）に
  BGM.push({ name: BGM_A[i % 10] + BGM_B[Math.floor(i / 10)], seed: 1000 + i * 7919, bpm: 136 + ((i * 17) % 40), epic: i % 10 < 3 });
}
// 頂上決戦の専用曲（1=運営長ルミナリアの乱入、2=ヴェスペラ戦）
const APEX_BGM = {
  1: { name: '裁定の双月 — 天穹を裂く者', seed: 777001, bpm: 176, apex: 1 },
  2: { name: '冥紫の深淵后 — 緋き終焉', seed: 777777, bpm: 168, apex: 2 }
};

// ---------- ステージ：合計100 ----------
{
  const PLACE_A = ['蒼き', '紅の', '白銀の', '黒曜の', '黄金の', '朽ちた', '逆さの', '眠れる', '歌う', '沈む'];
  const PLACE_B = ['湖畔', '神殿', '砦', '峡谷', '雲海', '墓所', '花園', '鉱山', '港', '回廊'];
  const SKIES = ['assets/twin-moon-sky.webp', 'assets/desert-dusk-sky.webp', 'assets/frost-aurora-sky.webp', 'assets/bamboo-night-sky.webp', 'assets/heaven-scale-sky.webp'];
  const r = rng(777);
  const base = STAGES.slice();
  STAGES.forEach((s, i) => (s.bgm = i));
  let n = 0;
  while (STAGES.length < 100) {
    const b = base[n % base.length];
    const dh = r() * 0.8 - 0.4;
    const name = PLACE_A[n % 10] + PLACE_B[Math.floor(n / 10) % 10];
    STAGES.push({
      ...b, id: 's' + STAGES.length, name, sky: SKIES[Math.floor(r() * SKIES.length)],
      floor: shiftHex(b.floor === 0xffffff ? 0xd8d0ff : b.floor, dh), rim: shiftHex(b.rim, dh), pillar: shiftHex(b.pillar, dh),
      crystal: shiftHex(b.crystal, dh), fog: shiftHex(b.fog, dh), hemi: shiftHex(b.hemi, dh * 0.5), sun: shiftHex(b.sun, dh * 0.3),
      seg: pickOf(r, [3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 64]), pshape: pickOf(r, ['cyl', 'box', 'spire', 'bamboo']),
      cshape: pickOf(r, ['oct', 'ico', 'torus']), bgm: STAGES.length
    });
    n++;
  }
}

// ---------- 強化：100種（各5段） ----------
const MAX_LV = 5;
const UPG_STATS = [
  { id: 'hp', noun: '器', what: '体力の上限', per: 8, sign: '+' },
  { id: 'atk', noun: '刃', what: '与える傷', per: 6, sign: '+' },
  { id: 'def', noun: '鎧', what: '受ける傷', per: 5, sign: '−' },
  { id: 'flux', noun: '灯', what: '灯力の戻り', per: 12, sign: '+' },
  { id: 'over', noun: '火', what: '奥義の溜まり', per: 10, sign: '+' }
];
const UPG_PRE = ['若葉の', '鉄の', '銀の', '金の', '星の', '月の', '竜の', '古の', '祈りの', '嵐の', '焔の', '氷の', '雷の', '風の', '大地の', '深海の', '天空の', '夜明けの', '黄昏の', '永劫の'];
const FIRST_LABEL = { hp: '生命の器', atk: '刃の冴え', def: '鎧の芯', flux: '灯の巡り', over: '昂りの火' };
const UPGRADES = [];
UPG_PRE.forEach((pre, pi) => UPG_STATS.forEach((s) => {
  const w = pi === 0 ? 1 : 0.25;
  const pct = +(s.per * w).toFixed(2);
  UPGRADES.push({ id: pi === 0 ? s.id : s.id + pi, stat: s.id, w, pct, what: s.what, sign: s.sign, label: pi === 0 ? FIRST_LABEL[s.id] : pre + s.noun, desc: `${s.what} ${s.sign}${pct}%／段` });
}));
// 詠唱短縮：既存100種に加える独立強化。1段につき3％、最大45％短縮。
// 旧セーブに cast がなくても0段として扱うため、既存の進行を壊さない。
UPGRADES.push({ id: 'cast', stat: 'cast', w: 1, pct: 3, what: '技・奥義・秘奥義の詠唱時間', sign: '−', label: '詠唱の研鑽', name: '詠唱の研鑽', desc: '1段につき詠唱を3％短縮（最大45％）' });
// ---------- 限界突破：全強化を極めると解放。上限段+5、各強化の効果+20%（1回ごと） ----------
const LB_MAX = 10;
const LB_STEP = 5;
const lbMaxLv = (lb) => MAX_LV + LB_STEP * lb;
const lbMul = (lb) => 1 + 0.2 * lb;
const lbCost = (lb) => 5000 * (lb + 1);
// ---------- 武器・装備：100種 ----------
const WEP_TYPES = ['剣', '杖', '大斧', '双刃', '槍', '弓', '錬金瓶', '拳甲', '聖鈴', '雅扇'];
const WEP_TIER = ['木の', '鉄の', '鋼の', '銀の', '霊銀の', '竜骨の', '月光の', '天星の', '灯脈の', '双月の'];
const WEP_FOCUS = [['atk'], ['flux', 'over'], ['atk', 'hp'], ['atk', 'over'], ['atk', 'def'], ['atk', 'flux'], ['flux', 'hp'], ['atk', 'def'], ['hp', 'def'], ['over', 'flux']];
const WEAPONS = [];
WEP_TIER.forEach((tier, ti) => WEP_TYPES.forEach((type, yi) => {
  const pow = 1 + ti * 1.1;
  const bonus = {};
  WEP_FOCUS[yi].forEach((s, j) => (bonus[s] = +(pow * (j ? 0.6 : 1)).toFixed(1)));
  WEAPONS.push({ id: 'w' + (ti * 10 + yi), name: tier + type, bonus, price: 30 + ti * ti * 25 + ti * 30 });
}));
// ---------- 防具：100種（装備すると戦闘・ワールドで見た目に反映） ----------
const ARM_TYPES = ['軽鎧', '重鎧', '法衣', '外套', '胸当て', '肩鎧', '竜鱗鎧', '聖衣', '影装束', '王冠鎧'];
const ARM_FOCUS = [['def', 'hp'], ['def'], ['flux', 'def'], ['hp', 'over'], ['def', 'atk'], ['def', 'hp'], ['hp', 'def'], ['over', 'flux'], ['atk', 'over'], ['def', 'over']];
const ARMORS = [];
WEP_TIER.forEach((tier, ti) => ARM_TYPES.forEach((type, yi) => {
  const pow = 0.8 + ti * 1.0;
  const bonus = {};
  ARM_FOCUS[yi].forEach((s, j) => (bonus[s] = +(pow * (j ? 0.6 : 1)).toFixed(1)));
  ARMORS.push({ id: 'a' + (ti * 10 + yi), name: tier + type, bonus, price: 25 + ti * ti * 22 + ti * 28 });
}));
// ---------- 至宝（最高額の装備） ----------
WEAPONS.push({ id: 'w100', name: '草薙の剣', bonus: { atk: 16, over: 9, flux: 6 }, price: 150000, relic: true, desc: '大蛇を討った英雄が尾より得たと伝わる黄金の神剣' });
ARMORS.push({ id: 'a100', name: '草薙の盾', bonus: { def: 16, hp: 12, over: 5 }, price: 150000, relic: true, desc: '紅玉と黄金で鍛えられた、災いを退ける神盾' });
// ---------- 召喚獣（運営長・ザルグレイヴ専用。通常攻撃の代わりに発動） ----------
// HPは使い手の最大HPの60%。倒されるまで使い手の前方に居続け、前からの攻撃を受け止める（倒されると15秒後に再召喚可）
const SUMMONS = [
  { id: 's0', name: 'ヤマタノオロチ', fighter: 'bloodfiend', chief: true, price: 300000, desc: '八つ首の災竜。前方に居座り、通常攻撃の代わりに一斉に噛みつく。前からの攻撃を受け止める' },
  { id: 's1', name: 'スサノオ', fighter: 'crimson', price: 200000, desc: '翠雷をまとう鎧の荒神。前方に立ちはだかり、通常攻撃の代わりに剛腕で薙ぎ払う。前からの攻撃を受け止める' }
];
const STAT_LABEL = { hp: '体力', atk: '攻撃', def: '守り', flux: '灯力', over: '奥義' };

// 強化の合計上限（段換算）
const UPG_CAP = { hp: 25, atk: 25, def: 14, flux: 25, over: 20, cast: 15 };

const STORY_BASE = [
  {
    title: '一の灯　砂の街道', stage: 'desert',
    before: [
      ['ロウエン', '灯脈の光が、また一本消えた。双つの月が重なる夜まで、あと七日しかない。'],
      ['ガロウ', 'その腰の灯石、置いていけ。砂漠じゃ光は水より高く売れるんだ。'],
      ['ロウエン', '悪いな。これは売り物じゃない。']
    ],
    enemies: [{ k: 'garou' }],
    after: [['ガロウ', '……ちっ。北の書架へ行くなら、霜の魔女に気をつけな。']]
  },
  {
    title: '二の灯　霜の書架', stage: 'frost',
    before: [
      ['ミナセ', '灯脈を盗んでいるのはあなたね。灯石の匂いがする。'],
      ['ロウエン', '逆だよ。取り返しに来たんだ。……話、聞いてくれないよな。'],
      ['ミナセ', '腕で語って。嘘をつく剣は、氷に映るから。']
    ],
    enemies: [{ k: 'minase' }],
    after: [['ミナセ', '映らなかった。……ごめんなさい。私も行く。東の竹林で、灯を狩る忍びを見たの。']]
  },
  {
    title: '三の灯　鳴かぬ竹林', stage: 'bamboo',
    before: [
      ['ツバキ', '依頼主の名は言えない。けど、その灯石は持ち帰る約束なの。'],
      ['ミナセ', '約束で人を斬るの？'],
      ['ツバキ', '斬らずに済むなら、それが一番。——構えて。']
    ],
    ally: 'minase',
    enemies: [{ k: 'tsubaki' }],
    after: [['ツバキ', '依頼主は「白い翼の使い」。……もう、あの人の仕事はしない。']]
  },
  {
    title: '四の灯　錆びた砦', stage: 'moon',
    before: [
      ['ハーラン', '若いの。この砦を越えたければ、老いぼれの槍をくぐってゆけ。'],
      ['ロウエン', '退いてくれ。あんたと戦う理由がない。'],
      ['ハーラン', '理由なら作ってやろう。覚悟の重さを見せてみよ。']
    ],
    ally: 'minase',
    enemies: [{ k: 'harlan' }],
    after: [['ハーラン', '……良い目だ。この先の工房に、灯脈を詰めた瓶を造る子供がおる。叱ってやってくれ。']]
  },
  {
    title: '五の灯　すす煙の工房', stage: 'ember',
    before: [
      ['ピップ', 'わ、わあ！来ないで！これ、ヴェルカ姉ちゃんが守ってくれるんだから！'],
      ['ヴェルカ', '子供に手を出すなら、森番の矢が黙ってない。'],
      ['ミナセ', '誤解よ……って言っても、もう遅いみたい。']
    ],
    ally: 'minase',
    enemies: [{ k: 'pip' }, { k: 'velka', hpMul: 0.8 }],
    after: [
      ['ピップ', '灯を瓶に詰めたら、白い羽の人がお菓子くれるって……ごめんなさい。'],
      ['ヴェルカ', 'その羽の主、黒い傭兵を雇って塔の門を守らせてる。']
    ]
  },
  {
    title: '六の灯　黒鋼の門', stage: 'void',
    before: [
      ['オズリック', '金はもらった。門は通さない。それだけの話だ。'],
      ['ロウエン', '雇い主が世界の半分を消そうとしてても、か。'],
      ['オズリック', '……なら、俺を倒して証明しろ。']
    ],
    ally: 'minase',
    enemies: [{ k: 'osric' }],
    after: [['オズリック', '報酬は返しておく。塔の中には、鐘を鳴らす巡礼者が囚われている。']]
  },
  {
    title: '七の灯　写し身の回廊', stage: 'void',
    before: [
      ['影写しのロウエン', 'おまえが諦めた道を、俺は全部歩いてきた。'],
      ['ノア', '（遠くで鐘の音）……影は、光を借りて立っているだけです！'],
      ['ミナセ', '二人なら崩せる！']
    ],
    ally: 'minase',
    enemies: [
      { k: 'rowen', tint: 0x2a1f44, name: '影写しのロウエン' },
      { k: 'osric', tint: 0x3b2f66, name: '虚ろの黒騎', hpMul: 0.7 }
    ],
    after: [['ノア', 'ありがとう。鐘で道を照らします。上へ——天秤の間へ。']]
  },
  {
    title: '終の灯　双月の天秤', stage: 'heaven',
    boss: true,
    before: [
      ['セラフェル', '二つの世界は、どちらか一つしか灯せない。私はそれを量り続けてきた。'],
      ['ロウエン', 'だったら天秤ごと壊す。両方灯す方法を、俺たちが探す。'],
      ['セラフェル', 'では裁こう。千の光で。']
    ],
    ally: 'noa',
    enemies: [{ k: 'seraphel', hpMul: 1.3 }],
    after: [
      ['セラフェル', '……天秤が、傾かない。おかしな者たちだ。'],
      ['ミナセ', '灯脈が戻っていく。どちらの空にも。'],
      ['ロウエン', '旅はここからだな。——みんな、ありがとう。']
    ]
  }
];

// ---------- 長編「双月のアルケイア」全十部・百章 ----------
const ARCS = [
  {
    part: '第一部　灯脈の旅立ち', ally: 'minase', stages: ['heaven'],
    titles: ['砂の街道', '霜の書架', '鳴かぬ竹林', '錆びた砦', 'すす煙の工房', '黒鋼の門', '写し身の回廊', '鐘の巡礼者', '白い羽の手紙', '天秤の間・扉前'],
    boss: { k: 'seraphel', name: 'セラフェルの幻影', tint: 0x8090c0, hpMul: 0.55 },
    close: [['セラフェルの幻影', 'まだ量るに足りぬ。世界を巡り、灯の重さを知ってから来るがいい。'], ['ロウエン', '……いいだろう。全部見てきてやる。'], ['ミナセ', '九つの地に、天秤の秘密が散らばっている。ノアの鐘がそう告げてる。']]
  },
  {
    part: '第二部　砂海の王冠', ally: 'minase', stages: ['desert', 'ember'],
    intro: [['ミナセ', '灯脈の乱れは天秤の間だけじゃなかった。南の砂海で、灯を喰う王が目覚めたって。'], ['ロウエン', 'セラフェルは「片方しか灯せない」と言った。その理由が、どこかに埋まってる気がする。'], ['ミナセ', 'なら掘り返しましょう。砂の底まで。']],
    titles: ['蜃気楼の隊商', '塩の井戸', '骨の市場', '砂鯨の背', '盗賊王の手紙', '沈んだ鐘楼', '熱風の審問', '砂時計の墓', '王冠の影', '砂王ザハル'],
    boss: { k: 'garou', name: '砂王ザハル', tint: 0xd8b040, hpMul: 1.6 },
    close: [['砂王ザハル', '王冠は……灯を守るための枷だった。外せば、砂海は灯を飲み干す……'], ['ロウエン', 'だったら別の方法で守る。王冠じゃなく、人の手で。']]
  },
  {
    part: '第三部　霜天の書', ally: 'noa', stages: ['frost'],
    intro: [['ノア', '鐘が北で鳴いています。書架の奥に、天秤を造った人の記録があるはず。'], ['ロウエン', 'ミナセの故郷か。'], ['ミナセ', '私も知らない階層があるの。……少し怖い。']],
    titles: ['凍てた写本', '白い司書', '閉ざされた閲覧室', '雪狼の群れ', '禁書の頁', '氷河の礼拝堂', '吹雪の証言', '星図の欠片', '書架の最奥', '氷書官グレイシア'],
    boss: { k: 'minase', name: '氷書官グレイシア', tint: 0x4060a0, hpMul: 1.7 },
    close: [['氷書官グレイシア', '天秤を造ったのは、二つの世界の王たち自身。灯を分け合えず、争いを量りに委ねたのよ。'], ['ノア', 'なら、量りを捨てる勇気も、人にはあるはずです。']]
  },
  {
    part: '第四部　竹影の誓約', ally: 'tsubaki', stages: ['bamboo', 'void'],
    intro: [['ツバキ', '私を育てた里が、白い翼の使いと手を結んだ。けじめは私がつける。'], ['ロウエン', '一人で背負うな。灯を返す旅は、みんなの旅だ。'], ['ツバキ', '……変な人。でも、ありがとう。']],
    titles: ['鳴かぬ笛', '隠れ里の門', '九つの影', '月見の宴', '裏切りの苦無', '竹の迷宮', '師の墓標', '霧の決闘場', '影頭の屋敷', '影頭ムラクモ'],
    boss: { k: 'kurouga', name: '影頭ムラクモ', tint: 0x302040, hpMul: 1.7 },
    close: [['影頭ムラクモ', '里を守るため、片方の世界を売った。それが影の務めだ。'], ['ツバキ', '影は光の隣でしか立てない。——師匠の言葉よ。']]
  },
  {
    part: '第五部　錆鉄の行軍', ally: 'harlan', stages: ['moon', 'ember', 'desert'],
    intro: [['ハーラン', 'かつての戦友が、灯脈を砲弾に変えておる。老いぼれにも、やり残しがあってな。'], ['ロウエン', '手を貸すよ、ハーラン。'], ['ハーラン', 'ふん。若いのに借りを作るとはな。']],
    titles: ['錆びた軍旗', '老兵の帰還', '鉄の橋', '補給線の夜', '機械仕掛けの歩兵', '燃える穀倉', '捕虜の歌', '城壁の亀裂', '将軍の天幕', '鉄将ヴォルグ'],
    boss: { k: 'osric', name: '鉄将ヴォルグ', tint: 0x8a4a2a, hpMul: 1.8 },
    close: [['鉄将ヴォルグ', '勝てば片方の空は守れた。……お前は、両方を選ぶのか。'], ['ハーラン', '選ぶのではない。背負うのだ。わしらの時代にできなかったことを。']]
  },
  {
    part: '第六部　すす煙の発明', ally: 'pip', stages: ['ember', 'moon'],
    intro: [['ピップ', 'ぼく、灯を瓶に詰める方法を考えたんだ。今度は「増やす」方法！'], ['ペトラ', 'その理論、私の師が盗んだものと同じ……。'], ['ロウエン', '増やせるなら、天秤なんていらなくなるな。']],
    titles: ['爆ぜる煙突', '歯車の街', '盗まれた設計図', 'ぜんまい人形の反乱', '錬金ギルドの査問', '硝子の温室', '灯の蒸留塔', '地下の溶鉱炉', '師匠の工房', '大錬師アルケム'],
    boss: { k: 'petra', name: '大錬師アルケム', tint: 0x6a5a2a, hpMul: 1.8 },
    close: [['大錬師アルケム', '灯を増やせば、世界は灯に溺れる。量りが必要なのだよ！'], ['ピップ', 'じゃあ、ぼくが量りより賢い器を作る！']]
  },
  {
    part: '第七部　月吠えの荒野', ally: 'kurouga', stages: ['moon', 'frost', 'bamboo'],
    intro: [['クロウガ', '月が欠けるたび、群れが灯を食い荒らす。長の目が濁ったんだ。'], ['ロウエン', '長と話はできないのか。'], ['クロウガ', '牙でしか話さない奴だ。だから俺が牙で話す。']],
    titles: ['銀の足跡', '狩り場の掟', '灯を咥えた狼', '荒野の焚き火', '月蝕の遠吠え', '群れの裏切り者', '渓谷の吊り橋', '古き獣の祠', '双月の丘', '群れの長フェンリス'],
    boss: { k: 'kurouga', name: '群れの長フェンリス', tint: 0x202838, hpMul: 1.9 },
    close: [['群れの長フェンリス', '……月の声が、二つに割れていた。どちらに吠えればよかったのだ。'], ['クロウガ', '両方さ。俺たちは二つの月の下で生まれたんだから。']]
  },
  {
    part: '第八部　燠火の祭典', ally: 'rinfa', stages: ['ember'],
    intro: [['リンファ', '燠火の寺では、灯を炎として祀っています。けれど最近、祀りが生贄に変わったと。'], ['イグナ', '竜の血を引く者として、見過ごせない。'], ['ロウエン', '行こう。燃やすべきなのは、人じゃない。']],
    titles: ['火渡りの儀', '赤い経文', '灰の巡礼', '燃えない寺', '竜の鱗', '炎舞の祭', '十の試練', '溶岩の回廊', '火口の祭壇', '炎の神官イフラ'],
    boss: { k: 'rinfa', name: '炎の神官イフラ', tint: 0x802010, hpMul: 1.9 },
    close: [['炎の神官イフラ', '炎は捧げねば消える。消えれば寺も、民も……'], ['リンファ', '祈りは奪うものではなく、分け合うもの。拳で教えました。']]
  },
  {
    part: '第九部　月影の深層', ally: 'osric', stages: ['void', 'heaven'],
    intro: [['オズリック', '回廊の底で、俺たちの写し身が軍を成している。セラフェルの裁きの残り滓だ。'], ['ロウエン', '俺の影は、一度倒したはずだ。'], ['オズリック', '影は何度でも生まれる。お前が迷うたびにな。']],
    titles: ['鏡の門', '偽りの記憶', '二人目のミナセ', '名を失った街', '逆さの空', '写し身の軍勢', '影の玉座', '光を借りる者', '虚ろの天秤', '写し身の王'],
    boss: { k: 'rowen', name: '写し身の王', tint: 0x1a1030, hpMul: 2.0 },
    close: [['写し身の王', 'おまえが迷いを捨てるなら、俺も消えよう。'], ['ロウエン', '捨てないさ。迷ったまま、それでも進む。それが俺だ。']]
  },
  {
    part: '第十部　双月の天秤', ally: 'noa', stages: ['heaven'],
    intro: [['ノア', 'すべての灯脈が、天秤の間へ流れ込み始めました。セラフェルが最後の裁きを始めるつもりです。'], ['ミナセ', '今度こそ、天秤ごと。'], ['ロウエン', 'ああ。九つの地で知った灯の重さ、全部持っていく。']],
    titles: ['天への階', '九人の証人', '量られた街', '白翼の騎士団', '天秤の皿', '失われた片割れ', '鐘の約束', '灯脈の源', '裁きの前夜', '双月の天秤']
  }
];
// ---------- ボス：全25体（各部の主＋中ボス15体＋ラスボス・セラフェル） ----------
// 専用の戦士データを作り、属性ごとに固有の技と奥義を持たせる
const BOSS_ROSTER = [];
function makeBoss(spec, i) {
  const base = FIGHTERS[spec.k];
  const r = rng(9000 + i * 17);
  const e = ELEMS[spec.elem];
  const pool = SKILLS.filter((s) => s.elem === spec.elem && s.kind !== 'heal');
  const picks = [];
  while (picks.length < 4) {
    const s = pickOf(r, pool);
    if (!picks.includes(s) || picks.length >= pool.length) picks.push(s);
  }
  const over = makeOver(r, e);
  over.name = spec.over;
  over.dmg = Math.round((over.dmg || 0) * 1.15);
  if (over.finalDmg) over.finalDmg = Math.round(over.finalDmg * 1.15);
  const key = 'boss' + i;
  FIGHTERS[key] = {
    ...base, name: spec.name, title: spec.title, color: e.c, tint: spec.tint, enemy: true, locked: true,
    hp: Math.round(base.hp * 1.15), overGain: base.overGain * 1.3,
    light: { ...base.light, dmg: Math.round(base.light.dmg * 1.2) },
    skills: picks.map((s) => ({ ...s })), over
  };
  BOSS_ROSTER.push(key);
  return { k: key, name: spec.name, tint: spec.tint, hpMul: spec.hpMul, scale: spec.scale || 1.2 };
}
// 各部の主（第二〜九部）
const PART_BOSSES = [
  null,
  { k: 'garou', name: '砂王ザハル', title: '砂海を統べる王', elem: 4, tint: 0xd8b040, hpMul: 1.6, over: '砂冠崩落・王墓' },
  { k: 'minase', name: '氷書官グレイシア', title: '禁書を守る司書長', elem: 1, tint: 0x4060a0, hpMul: 1.7, over: '永久凍書・白頁' },
  { k: 'kurouga', name: '影頭ムラクモ', title: '隠れ里の頭領', elem: 6, tint: 0x302040, hpMul: 1.7, over: '影喰い九尾陣' },
  { k: 'osric', name: '鉄将ヴォルグ', title: '錆鉄軍の総大将', elem: 9, tint: 0x8a4a2a, hpMul: 1.8, over: '鉄血大行軍' },
  { k: 'petra', name: '大錬師アルケム', title: '錬金ギルドの長', elem: 8, tint: 0x6a5a2a, hpMul: 1.8, over: '大釜の禁薬・万毒' },
  { k: 'kurouga', name: '群れの長フェンリス', title: '月吠えの古狼', elem: 3, tint: 0x202838, hpMul: 1.9, over: '双月嵐牙' },
  { k: 'rinfa', name: '炎の神官イフラ', title: '燠火寺の大神官', elem: 0, tint: 0x802010, hpMul: 1.9, over: '劫火曼荼羅' },
  { k: 'rowen', name: '写し身の王', title: '影写しの軍勢の主', elem: 6, tint: 0x1a1030, hpMul: 2.0, over: '虚像千刃・鏡界' }
];
// 中ボス：各部の第五章（10体）＋第二〜六部の第八章（5体）
const MID_BOSSES = {
  '0-7': { k: 'harlan', name: '錆びた番兵長ガルド', title: '砦に囚われた騎士', elem: 4, tint: 0x6a6050, hpMul: 1.3, over: '錆盾の大崩し' },
  '1-4': { k: 'tsubaki', name: '砂刃の盗賊カシム', title: '骨の市場の顔役', elem: 9, tint: 0xa07040, hpMul: 1.4, over: '砂塵千刃' },
  '1-7': { k: 'noa', name: '砂時計の巫女セト', title: '時を量る墓守', elem: 5, tint: 0xc0a060, hpMul: 1.5, over: '砂刻の審判' },
  '2-4': { k: 'velka', name: '雪狼使いヘルガ', title: '白き狩人', elem: 1, tint: 0x8090b0, hpMul: 1.5, over: '吹雪狩り・千本矢' },
  '2-7': { k: 'pip', name: '星図の書記ロルフ', title: '頁を喰らう学徒', elem: 7, tint: 0x406080, hpMul: 1.5, over: '星降る禁頁' },
  '3-4': { k: 'tsubaki', name: '宴の刺客サザナミ', title: '月見の宴の影', elem: 7, tint: 0x203048, hpMul: 1.6, over: '月下水影斬' },
  '3-7': { k: 'harlan', name: '霧の剣聖オボロ', title: '師を斬った者', elem: 3, tint: 0x506070, hpMul: 1.6, over: '霧散・無影剣' },
  '4-4': { k: 'petra', name: '機巧兵団長ギア', title: '鋼の歩兵の指揮官', elem: 2, tint: 0x605848, hpMul: 1.6, over: '機巧雷撃砲' },
  '4-7': { k: 'garou', name: '城壁の巨人ゴウザン', title: '割れぬ壁', elem: 4, tint: 0x504030, hpMul: 1.8, scale: 1.4, over: '大地震・城崩し' },
  '5-4': { k: 'igna', name: '査問官ヴィトリオ', title: '錬金ギルドの処刑人', elem: 8, tint: 0x507030, hpMul: 1.7, over: '硝子毒槍陣' },
  '5-7': { k: 'garou', name: '溶鉱炉の主バルカ', title: '地下の鍛冶王', elem: 0, tint: 0x803010, hpMul: 1.8, scale: 1.35, over: '溶鉄の大瀑布' },
  '6-4': { k: 'kurouga', name: '月蝕のスコル', title: '月を喰らう狼', elem: 6, tint: 0x181828, hpMul: 1.8, over: '月蝕牙' },
  '7-4': { k: 'igna', name: '炎竜騎ザラム', title: '竜鱗の祭司', elem: 0, tint: 0x902818, hpMul: 1.9, over: '竜炎天墜' },
  '8-4': { k: 'minase', name: '逆さ空の魔女ユラ', title: '偽りのミナセ', elem: 7, tint: 0x281848, hpMul: 1.9, over: '逆巻く涙の空' },
  '9-4': { k: 'harlan', name: '白翼騎士団長アウレル', title: '天秤の守護騎士', elem: 5, tint: 0xc8c0a0, hpMul: 2.0, over: '白翼聖騎行' }
};
const PART_BOSS_SPEC = PART_BOSSES.map((s, i) => (s ? makeBoss(s, i) : null));
const MID_BOSS_SPEC = {};
Object.entries(MID_BOSSES).forEach(([key, s], i) => {
  MID_BOSS_SPEC[key] = makeBoss(s, 20 + i);
});
const NAME_OF = (k) => FIGHTERS[k]?.name || k;
const TAUNTS = [
  'ここから先は通さぬ。灯の匂いがする者は、すべて敵だ。', 'お前たちの噂は聞いている。天秤に逆らう愚か者ども。',
  '灯を置いていけ。そうすれば命までは取らない。', '主の命だ。恨むなら、自分の歩いた道を恨め。',
  '今宵は月がよく見える。斬り合うには、いい夜だ。', 'この地の灯は、もう我らのものだ。',
  '量りの外に立つ者は、ここで消える定めだ。', '腹が減った……灯を、灯をよこせ……'
];
const HERO_LINES = [
  (t) => `「${t}」……ここにも灯の欠片が残っているはずだ。`, () => '退いてくれ。俺たちは奪いに来たんじゃない。',
  () => '話しても無駄みたいだな。——構えろ。', () => '灯脈がまた細くなってる。急ごう。',
  (t) => `${t}か。噂よりずっと静かだな……静かすぎる。`, () => '何度でも言う。灯は、誰か一人のものじゃない。'
];
const ALLY_LINES = ['気をつけて。この気配、ただの番人じゃない。', '後ろは任せて。あなたは前だけ見て。', '灯が泣いてる……早く返してあげないと。', '数が多い。囲まれる前に崩しましょう。', '大丈夫、今日の私は調子がいいの。'];
const AFTER_LINES = [
  (e) => [e, '……強いな。先へ進め。だが、その先はもっと暗いぞ。'], (e) => [e, '主は……この先で待っている。'],
  (e, a) => [a, '灯がひとつ、空へ帰っていく。'], (e, a, p) => ['ロウエン', `次へ行こう。${p}の奥へ。`],
  (e) => [e, '光が……あたたかい。こんなもの、忘れていた。']
];
const KANJI = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const chapNo = (n) => {
  const t = Math.floor(n / 10), o = n % 10;
  return n === 100 ? '百' : (t > 1 ? KANJI[t] : '') + (t ? '十' : '') + KANJI[o];
};
const STORY = [];
{
  const r = rng(4242);
  ARCS.forEach((arc, ai) => {
    const place = arc.part.split('　')[1];
    arc.titles.forEach((title, ci) => {
      const no = ai * 10 + ci + 1;
      const head = `第${chapNo(no)}章　${title}`;
      // 第一部の1〜7章と最終章は原典の物語をそのまま使う
      if (ai === 0 && ci < 7) {
        STORY.push({ ...STORY_BASE[ci], title: head, part: arc.part });
        return;
      }
      if (no === 100) {
        STORY.push({ ...STORY_BASE[7], title: head, part: arc.part });
        return;
      }
      const stage = ci % 3 === 2 && ai > 0 ? 's' + (7 + ((ai * 10 + ci) * 13) % 93) : pickOf(r, arc.stages);
      const isBoss = ci === 9 && arc.boss;
      const mid = MID_BOSS_SPEC[ai + '-' + ci];
      const lvl = 0.75 + ai * 0.08;
      // 通常敵にはボス専用の名前・色・拡大率がないため、それらは任意項目とする。
      /** @type {Array<{k: string, hpMul?: number, name?: string, tint?: number, scale?: number}>} */
      let enemies;
      if (isBoss) {
        enemies = [{ ...(PART_BOSS_SPEC[ai] || arc.boss) }];
        if (ai > 1) enemies.push({ k: pickOf(r, ENEMY_ROSTER), hpMul: lvl * 0.6 });
      } else if (mid) {
        enemies = [{ ...mid }];
      } else {
        const cnt = Math.min(3, 1 + Math.floor(ci / 4) + (ai > 5 ? 1 : 0));
        enemies = Array.from({ length: cnt }, () => ({ k: pickOf(r, ENEMY_ROSTER), hpMul: +(lvl * (cnt > 1 ? 0.75 : 1.1)).toFixed(2) }));
      }
      const en = enemies[0].name || NAME_OF(enemies[0].k);
      const an = NAME_OF(arc.ally);
      let before;
      if (ci === 0 && arc.intro) {
        before = [...arc.intro, [en, pickOf(r, TAUNTS)]];
      } else if (isBoss) {
        before = [[en, 'よく来た。九つの章を越えてきた足音は、遠くからでも聞こえていた。'], ['ロウエン', `${place}の灯、返してもらう。`], [an, pickOf(r, ALLY_LINES)]];
      } else if (mid) {
        before = [[en, `我は${FIGHTERS[mid.k].title}、${en}。この先へは一歩も通さぬ。`], ['ロウエン', '強い灯の気配……こいつ、ただの番人じゃない。'], [an, pickOf(r, ALLY_LINES)]];
      } else {
        before = [['ロウエン', pickOf(r, HERO_LINES)(title)], [en, pickOf(r, TAUNTS)], [an, pickOf(r, ALLY_LINES)]];
      }
      const after = isBoss ? arc.close : mid ? [[en, 'ぐ……主よ、お許しを……'], ['ロウエン', `${place}の灯、ひとつ取り戻した。`]] : [pickOf(r, AFTER_LINES)(en, an, place)];
      STORY.push({ title: head, part: arc.part, stage, ally: arc.ally, enemies, before, after, boss: !!(isBoss || mid) });
    });
  });
}
// ---- 各章を1〜3話に：話の合間の会話（第2話・第3話の前） ----
{
  const EP2 = [
    (a, p) => [['ロウエン', '……まだ終わりじゃない。気配がもうひとつ近づいてくる。'], [a, `${p}の灯を狙う群れが、残っていたみたい。`]],
    (a) => [[a, '待って、足音が増えてる！'], ['ロウエン', '休む暇はなさそうだな。構えろ！']],
    (a, p) => [['謎の声', `${p}の灯は渡さぬ……我らが主のために。`], ['ロウエン', '主？　誰のことだ。答えてもらうぞ！']],
    (a) => [[a, '空気が変わった……今度のは手ごわいよ。'], ['ロウエン', '背中は任せた。一気に行く！']]
  ];
  const EP3 = [
    (a, p) => [['ロウエン', 'これで最後だ。この地の影を、ここで断つ！'], [a, `${p}に灯を還そう。全部、終わらせて。`]],
    (a) => [['影の声', '……よくぞここまで。だが、最後の番人が貴様らを待つ。'], [a, '最後の番人……！　ロウエン、気をつけて。']],
    (a) => [[a, '灯が震えてる……決着の時みたい。'], ['ロウエン', 'ああ。三度目の正直だ。']]
  ];
  STORY.forEach((ch, n) => {
    ch.eps = 1 + (n % 3 === 1 ? 1 : n % 3 === 2 ? 2 : 0) + (ch.boss && n % 3 === 0 ? 1 : 0);
    ch.eps = Math.min(3, ch.eps);
    const an = NAME_OF(ch.ally || 'minase');
    const place = (ch.part || '').split('　')[1] || 'この地';
    ch.epLines = [];
    if (ch.eps >= 2) ch.epLines.push(EP2[n % EP2.length](an, place));
    if (ch.eps >= 3) ch.epLines.push(EP3[n % EP3.length](an, place));
  });
}

// ---- 最強格：宇邇宮とセラフェルを全戦士（ボス含む）の頂点に据える ----
{
  const others = Object.entries(FIGHTERS).filter(([k]) => k !== 'uninomiya' && k !== 'seraphel' && k !== 'chief' && k !== 'sovereign' && k !== 'sovereign2' && k !== 'bloodfiend').map(([, f]) => f);
  const top = (fn) => Math.max(...others.map((f) => fn(f) || 0));
  const maxHp = top((f) => f.hp), maxSpd = top((f) => f.speed), maxOg = top((f) => f.overGain);
  const maxLight = top((f) => f.light?.dmg * (f.light?.shots || 1));
  const maxPow = top((f) => f.power), maxArm = Math.min(1, ...others.map((f) => f.armor || 1));
  for (const k of ['seraphel', 'uninomiya']) {
    const f = FIGHTERS[k];
    const lead = k === 'seraphel' ? 1.12 : 1.1;
    f.hp = Math.round(Math.max(f.hp, maxHp) * lead);
    f.speed = +(Math.max(f.speed, maxSpd) * 1.05).toFixed(2);
    f.overGain = +(Math.max(f.overGain, maxOg) * 1.1).toFixed(2);
    if (f.light) f.light.dmg = Math.max(f.light.dmg, Math.ceil((maxLight * 1.1) / (f.light.shots || 1)));
    f.power = Math.max(1, maxPow) * 1.35 * (k === 'seraphel' ? 1.05 : 1);
    f.armor = maxArm * 0.7;
    f.fluxMul = 1.4;
  }
  // 運営長はさらにその上をずば抜ける
  const s = FIGHTERS.seraphel, c = FIGHTERS.chief;
  c.hp = Math.round(s.hp * 1.5);
  c.speed = +(s.speed * 1.08).toFixed(2);
  c.overGain = +(s.overGain * 1.3).toFixed(2);
  c.light.dmg = Math.ceil((s.light.dmg * (s.light.shots || 1) * 1.4) / c.light.shots);
  c.power = s.power * 1.6;
  c.armor = s.armor * 0.6;
  c.fluxMul = 2;
  // ヴェスペラはルミナリアのさらに上（第二形態はもう一段上）
  const v1 = FIGHTERS.sovereign, v2 = FIGHTERS.sovereign2;
  v1.hp = Math.round(c.hp * 1.25); v1.speed = +(c.speed * 1.05).toFixed(2); v1.overGain = +(c.overGain * 1.15).toFixed(2);
  v1.light.dmg = Math.ceil((c.light.dmg * c.light.shots * 1.3) / v1.light.shots);
  v1.power = c.power * 1.3; v1.armor = c.armor * 0.8; v1.fluxMul = 2.4;
  v2.hp = Math.round(c.hp * 1.6); v2.speed = +(c.speed * 1.12).toFixed(2); v2.overGain = +(c.overGain * 1.4).toFixed(2);
  v2.light.dmg = Math.ceil((c.light.dmg * c.light.shots * 1.7) / v2.light.shots);
  v2.power = c.power * 1.7; v2.armor = c.armor * 0.6; v2.fluxMul = 3;
  // ザルグレイヴはルミナリアと同格
  const bf = FIGHTERS.bloodfiend;
  bf.hp = Math.round(c.hp * 1.05); bf.speed = +(c.speed * 1.04).toFixed(2); bf.overGain = c.overGain;
  bf.light.dmg = Math.ceil((c.light.dmg * c.light.shots * 1.05) / bf.light.shots);
  bf.power = c.power * 1.05; bf.armor = c.armor; bf.fluxMul = 2;
}

// ---- 週替わりイベント（ボーナスステージ）：日本時間の月曜0時に切り替わる ----
// foes: 'mob'=魔物 / 'boss'=ボス / 'roster'=戦士 / 'mirror'=自分の写し / キー名
const EVENTS = [
  { name: '魔物の大行進', desc: '弱めの魔物が6体押し寄せる。まとめて薙ぎ払え！', foes: [['mob', 6]], hp: 0.45, atk: 0.7, ally: 0, first: 600, reward: 120, stage: 2 },
  { name: '巨影の襲来', desc: '巨大化したボスが1体。体力3倍の大物を討て！', foes: [['boss', 1]], hp: 3, atk: 1, scale: 1.6, ally: 1, first: 800, reward: 150, stage: 4 },
  { name: '灯晶の雨', desc: '相棒と二人で魔物3体に挑む。報酬がいつもの3倍！', foes: [['mob', 3]], hp: 0.8, atk: 0.8, ally: 1, first: 500, reward: 180, stage: 1 },
  { name: '天秤の試練', desc: '最強格セラフェルとの一騎打ち。勝てば大量の灯晶！', foes: [['seraphel', 1]], hp: 1, atk: 1, ally: 0, first: 1200, reward: 200, stage: 5 },
  { name: '双月の鏡', desc: '自分と同じ戦士の写しが2体。己を越えよ！', foes: [['mirror', 2]], hp: 0.9, atk: 0.9, ally: 0, first: 700, reward: 140, stage: 3 },
  { name: '包囲突破', desc: 'たった一人で戦士4体に囲まれる。生き残れ！', foes: [['roster', 4]], hp: 0.6, atk: 0.75, ally: 0, first: 900, reward: 170, stage: 0 },
  { name: '連合討伐戦', desc: '相棒2人とボス2体の大乱戦！', foes: [['boss', 2]], hp: 1.4, atk: 0.9, scale: 1.25, ally: 2, first: 1000, reward: 180, stage: 6 },
  { name: '血月の夜', desc: '血に飢えた戦士3体。攻撃は激しいが体力は低い。', foes: [['roster', 3]], hp: 0.5, atk: 1.4, ally: 0, first: 800, reward: 160, stage: 7 }
];
const WEEK_MS = 7 * 24 * 3600 * 1000;
// 1970-01-05(月) 0:00 JST を起点にした週番号
function eventWeek(now = Date.now()) {
  return Math.floor((now + 9 * 3600 * 1000 - 4 * 24 * 3600 * 1000) / WEEK_MS);
}
// ---- 運営長が作る特別イベント（受信データもここで検証） ----
const EV_FOE_KINDS = { mob: '魔物', boss: 'ボス', roster: '戦士', mirror: '自分の写し' };
const evNum = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
function sanitizeEvent(e, fighters) {
  if (!e || typeof e !== 'object') return null;
  const t = (v, n) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
  const name = t(e.name, 24);
  if (!name) return null;
  const foes = (Array.isArray(e.foes) ? e.foes : []).slice(0, 4)
    .map((f) => Array.isArray(f) ? [String(f[0]), Math.round(evNum(f[1], 1, 8, 1))] : null)
    .filter((f) => f && (EV_FOE_KINDS[f[0]] || fighters?.[f[0]]));
  if (!foes.length || foes.reduce((s, f) => s + f[1], 0) > 10) return null;
  const at = Math.round(evNum(e.at, 0, 1e13, 0)), ends = Math.round(evNum(e.ends, 0, 1e13, 0));
  if (!at || ends <= at || ends - at > 31 * 86400000) return null;
  return {
    custom: true, name, desc: t(e.desc, 80), foes,
    hp: evNum(e.hp, 0.2, 10, 1), atk: evNum(e.atk, 0.2, 5, 1), scale: evNum(e.scale, 0.6, 2.5, 1),
    ally: Math.round(evNum(e.ally, 0, 3, 0)), first: Math.round(evNum(e.first, 0, 20000, 500)),
    reward: Math.round(evNum(e.reward, 0, 5000, 100)), stage: Math.round(evNum(e.stage, 0, 20, 0)), at, ends
  };
}
function currentEvent(now = Date.now()) {
  const w = eventWeek(now);
  const ends = (w + 1) * WEEK_MS - 9 * 3600 * 1000 + 4 * 24 * 3600 * 1000;
  return { week: w, ev: EVENTS[((w % EVENTS.length) + EVENTS.length) % EVENTS.length], ends };
}

// ---- 全戦士共通の回復技（skills[4]。H キー／「癒」ボタン） ----
const HEAL_SLOT = 4;
// 各戦士の技を共通の形で扱い、技ごとの差分から巨大な共用体型を作らない。
// name・kindは必須。他の技パラメーターは実際の値をそのまま保持する。
/** @type {Array<[string, {hp: number, skills: Array<{name: string, kind: string, [field: string]: unknown}>}]>} */
const healTargets = Object.entries(FIGHTERS);
for (const [k, f] of healTargets) {
  if (!f.skills || f.skills.length > HEAL_SLOT) continue;
  while (f.skills.length < HEAL_SLOT) f.skills.push({ ...f.skills[0] });
  const v = k === 'sovereign' || k === 'sovereign2';
  f.skills.push(finalizeSkill({
    name: v ? '冥后の再誕《リザレクト・ノクス》' : '癒しの灯',
    cost: v ? 22 : 30, kind: 'heal', heal: Math.round((f.hp || 300) * (v ? 0.3 : 0.2)), radius: v ? 9 : 5, elem: v ? 5 : 7, vivid: true
  }, 7));
}

// ---- ヴェスペラ：全10属性の最上級技（skills[5..14]）。技ボタンを押すたびに順に繰り出す ----
{
  const TOP = [
    { name: '劫焔煉獄《インフェルノ・クラウン》', kind: 'rain', visual: 'meteor', count: 9, spread: 3.6, radius: 2.6, dmg: 150, delay: 0.5, interval: 0.08 },
    { name: '永劫氷葬《アブソリュート・ゼロ》', kind: 'implode', dmg: 260, radius: 9 },
    { name: '神鳴万雷《ディヴァイン・ボルト》', kind: 'rain', visual: 'bolt', count: 12, spread: 4, radius: 2.2, dmg: 110, delay: 0.25, interval: 0.05 },
    { name: '天嵐神威《テンペスト・ロード》', kind: 'shockwave', dmg: 250, radius: 10, double: true },
    { name: '大地崩壊《ガイア・ブレイカー》', kind: 'rain', visual: 'crystal', count: 10, spread: 3.8, radius: 2.4, dmg: 130, delay: 0.4, interval: 0.07 },
    { name: '聖天裁光《ジャッジメント・レイ》', kind: 'rain', visual: 'pillar', count: 10, spread: 4, radius: 2.3, dmg: 135, delay: 0.4, interval: 0.06 },
    { name: '冥獄終夜《エターナル・ナイト》', kind: 'implode', dmg: 290, radius: 9.5 },
    { name: '蒼海大渦《リヴァイアサン・タイド》', kind: 'projectile', visual: 'orb', count: 5, spreadAng: 0.22, dmg: 160, speed: 24, radius: 1.3 },
    { name: '万毒腐界《ヴェノム・パンデミア》', kind: 'rain', visual: 'nova', count: 7, spread: 4, radius: 3, dmg: 140, delay: 0.45, interval: 0.1 },
    { name: '血華千刃《ブラッド・サウザンド》', kind: 'rain', visual: 'blade', count: 14, spread: 4, radius: 1.8, dmg: 105, delay: 0.25, interval: 0.04 }
  ];
  // 配列の1列目はキャラID、2列目は数値倍率。文字列と数値を混同させない。
  /** @type {Array<[string, number]>} */
  const topSkillTargets = [['sovereign', 1], ['sovereign2', 1.25]];
  for (const [key, mul] of topSkillTargets) {
    const f = FIGHTERS[key];
    TOP.forEach((t, ei) => {
      f.skills.push(finalizeSkill({ ...t, dmg: Math.round(t.dmg * mul), cost: 24, elem: ei, color: ELEMS[ei].c, vivid: true }, ei));
    });
    f.pool = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  }
}

// 元から固有だった20人は維持。素体・顔絵を使い回していた209人だけを固有化。
const CHARACTER_APPEARANCES = assignUniqueAppearances(FIGHTERS);


// 双月のアルケイア — 認証・検証サーバー（Cloudflare Workers）
// © KASAI SOLUTIONS INC.
// 役割：運営/運営長の認証、乱入許可、招待コードの原子的な一回使用、同期セーブの保護、
//       Stripe 決済通知の検証と購入キャラの解放、戦闘用ステータス（強化・装備・キャラ）の検証と署名。
// 署名は ECDSA P-256。クライアントは公開鍵（config.js の SERVER_PUBKEY_JWK）で検証します。


const enc = new TextEncoder();
const HEX64 = /^[0-9a-f]{64}$/;
const DAY = 86400000;
const ownValue = (obj, key) => obj && Object.hasOwn(obj, key) ? obj[key] : undefined;

// 残高や集計と操作記録は同じトランザクションで確定する。
// 片方だけ保存して中断すると、再送時に二重反映するため分割しない。
async function writeTogether(storage, entries) {
  await storage.transaction(async (tx) => {
    for (const [key, value] of entries) await tx.put(key, value);
  });
}

// ---------- 共通 ----------
const b64u = (buf) => {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
async function sha256(s) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

let KEYS = null;
async function keys(env) {
  if (KEYS) return KEYS;
  const jwk = JSON.parse(env.SIGN_PRIVATE_JWK);
  const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
  KEYS = {
    priv: await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']),
    pub: await crypto.subtle.importKey('jwk', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
  };
  return KEYS;
}
async function sign(env, payload) {
  const p = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, (await keys(env)).priv, enc.encode(p));
  return `${p}.${b64u(sig)}`;
}
async function verify(env, tok, type) {
  try {
    if (typeof tok !== 'string' || tok.length > 4000) return null;
    const parts = tok.split('.');
    if (parts.length !== 2 || !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))) return null;
    const [p, s] = parts;
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, (await keys(env)).pub, unb64u(s), enc.encode(p));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(unb64u(p)));
    if (data.t !== type || !(data.exp > Date.now())) return null;
    return data;
  } catch {
    return null;
  }
}

// 保存はすべて Cloudflare の Durable Object（InstantDB の管理トークンは不要）
const storeCall = (env, name, body) => doCall(env.STORE.get(env.STORE.idFromName(name)), body);

function cors(env, req) {
  const origin = req.headers.get('Origin') || '';
  const allow = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': allow.includes(origin) ? origin : allow[0] || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
}
const json = (h, body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// IP×用途ごとの回数制限（Durable Object で端末をまたいで正確に数える）
async function limited(env, req, bucket, max, windowMs) {
  const ip = req.headers.get('CF-Connecting-IP') || 'x';
  const stub = env.LIMITER.get(env.LIMITER.idFromName(`${bucket}:${ip}`));
  const r = await stub.fetch('https://rl/', { method: 'POST', body: JSON.stringify({ max, windowMs }) });
  return r.status === 429;
}

// ---------- セーブ検証（戦闘用ステータスの算出：クライアントの upgFor と同じ規則） ----------
function statsFor(save, key) {
  const out = { hp: 0, atk: 0, def: 0, flux: 0, over: 0, cast: 0 };
  const lb = Math.max(0, Math.min(LB_MAX, Math.floor(+save?.lb?.[key] || 0)));
  const up = save?.upg?.[key];
  if (up && typeof up === 'object') {
    for (const u of UPGRADES) {
      const lv = Math.max(0, Math.min(lbMaxLv(lb), Math.floor(+up[u.id] || 0)));
      out[u.stat] += lv * u.w * lbMul(lb);
    }
  }
  for (const s in out) out[s] = Math.min(UPG_CAP[s] * (1 + 0.6 * lb), out[s]);
  // 装備は「所持している」ものだけ
  const owned = new Set(Array.isArray(save?.owned) ? save.owned : []);
  const w = WEAPONS.find((x) => x.id === save?.equip?.[key] && owned.has(x.id));
  if (w) for (const s in w.bonus) out[s] += w.bonus[s];
  const a = ARMORS.find((x) => x.id === save?.armor?.[key] && owned.has(x.id));
  if (a) for (const s in a.bonus) out[s] += a.bonus[s];
  out.def = Math.min(18, out.def);
  for (const s in out) out[s] = +out[s].toFixed(2);
  return out;
}
function validateSaveShape(save) {
  if (!save || typeof save !== 'object' || Array.isArray(save)) return false;
  const s = JSON.stringify(save);
  return s.length <= 200000;
}
// 資産総額：手持ち灯晶＋強化・限界突破・装備に注いだ灯晶（クライアントの価格規則と同じ）
function wealthOf(save) {
  let w = Math.max(0, Math.floor(+save?.shards || 0));
  for (const key of Object.keys(save?.upg || {})) {
    if (!ownValue(FIGHTERS, key)) continue;
    const lb = Math.max(0, Math.min(LB_MAX, Math.floor(+save?.lb?.[key] || 0)));
    for (const u of UPGRADES) {
      const lv = Math.max(0, Math.min(lbMaxLv(lb), Math.floor(+save.upg[key]?.[u.id] || 0)));
      w += 20 * lv * (lv + 1); // 1段ごと (段)×40
    }
    for (let i = 0; i < lb; i++) w += lbCost(i);
  }
  const owned = new Set(Array.isArray(save?.owned) ? save.owned : []);
  for (const x of [...WEAPONS, ...ARMORS, ...SUMMONS]) if (owned.has(x.id)) w += x.price || 0;
  return w;
}
// 1時間に稼げる灯晶の上限（報酬の最大値から余裕を持って設定）
const EARN_PER_HOUR = 30000;
const EARN_SLACK = 5000;

// キャラ使用の可否：運営/運営長専用・購入キャラはサーバーで確認
// Operator and chief share these playable fighter privileges, but the
// chief's mailbox, world-BGM signatures and Valgard remain chief-only.
const OP_ONLY = new Set(['seraphel', 'chief', 'sovereign', 'sovereign2', 'bloodfiend']);

// GAIZORG-ADVENTURE-INSTALLED-v20261108b
// 運営長だけが使用できる大型・炎属性キャラクター。通常戦闘と探索に共通。
// このキーはオンライン対戦・協力でも既存の役職検証の対象にする。
FIGHTERS.gaizorg = {
  name:'ガイゾルグ',title:'熔殻の超甲獣（運営長専用）',
  model:'assets/models/gaizorg-boss.glb',face:'assets/portraits/gaizorg.webp',
  color:0xff7434,tint:null,height:4.25,hp:6000,speed:4.85,overGain:1.30,
  locked:true,special:'chief',power:1.25,armor:.86,
  light:{dmg:230,range:3.8,color:0xffb052},
  skills:[
    {name:'獄炎の息吹《ヴォルカニック・ブレス》',kind:'projectile',visual:'fire',
     elem:0,color:0xff792b,damageType:'fire',cost:24,castTime:.65,count:6,spreadAng:.075,chain:.075,dmg:105,speed:22,radius:1.25,vivid:true},
    {name:'剛爪破砕《タイタン・クロウ》',kind:'dash',elem:0,color:0xffaa58,
     cost:21,speed:13,dur:.42,dmg:450,stun:.85,kb:12,vivid:true},
    {name:'灼星火球《マグマ・スフィア》',kind:'projectile',visual:'orb',elem:0,
     color:0xff7629,cost:26,castTime:.78,count:3,spreadAng:.13,chain:.10,dmg:250,speed:24,radius:1.3,vivid:true},
    {name:'太古炎天術《紅星終焉》',kind:'judgment',visual:'meteor',finalVisual:'pillar',elem:0,
     color:0xff6222,cost:46,castTime:2.65,count:12,spread:4.6,radius:2.3,
     dmg:230,delay:.52,interval:.10,finalDmg:1000,finalRadius:8.5,vivid:true},
    {name:'熔命の再生',kind:'heal',elem:0,color:0xffd287,cost:32,heal:950,radius:5.2,vivid:true}
  ],
  over:{name:'終極火界《地心ノヴァ》',kind:'judgment',visual:'meteor',
    finalVisual:'nova',elem:0,color:0xffb03f,cost:0,castTime:2.95,count:15,
    spread:6,radius:2.9,dmg:260,delay:.55,interval:.08,finalDmg:1500,finalRadius:10.0,vivid:true}
};

// RF_OPERATOR_GIGANTES_20261108: Separate from the chief-only Valgard.
FIGHTERS.operator_gigantes = {
  name: '機神ギガンテス', title: '終焉機神（運営専用・運営長不可）',
  model: 'assets/models/operator-gigantes.glb',
  face: 'assets/portraits/operator-gigantes.webp',
  color: 0xb584ff, tint: null, height: 4.85, hp: 4400,
  speed: 5.2, overGain: 1.38, locked: true, special: 'operator',
  light: { dmg: 182, range: 3.7, color: 0xf09bff },
  skills: [
    { name: '破壊光線《デストラクション・レイ》', kind: 'projectile', visual: 'orb', count: 1,
      dmg: 460, speed: 35, radius: 1.8, cost: 24, castTime: 0.66, elem: 8, color: 0xd86aff, vivid: true },
    { name: '機神光剣《ビームサーベル》', kind: 'dash', dmg: 490,
      speed: 20.5, dur: 0.48, cost: 22, elem: 8, color: 0xfe8cff, vivid: true },
    { name: '追尾砲陣《ファンネル》', kind: 'rain', visual: 'bolt',
      count: 12, spread: 4.8, radius: 1.4, dmg: 125, delay: 0.35, interval: 0.08,
      cost: 26, elem: 8, color: 0xcd8aff, vivid: true },
    { name: '星葬砲雨《フルバースト》', kind: 'judgment', visual: 'pillar', finalVisual: 'nova',
      count: 10, spread: 4.6, radius: 2.0, dmg: 225, delay: 0.4,
      interval: 0.07, finalDmg: 760, finalRadius: 7.6,
      cost: 42, castTime: 1.7, elem: 8, color: 0xf4a1ff, vivid: true },
    { name: '機神装甲・自己修復', kind: 'heal', heal: 850, radius: 5,
      cost: 30, elem: 8, color: 0xbafff0, vivid: true }
  ],
  over: { name: '最終殲滅《オメガ・バスター》', kind: 'judgment', visual: 'pillar',
    finalVisual: 'nova', count: 17, spread: 6.4, radius: 2.7,
    dmg: 245, delay: 0.55, interval: 0.06, finalDmg: 1700, finalRadius: 10.4,
    castTime: 2.3, elem: 8, color: 0xf4c5ff, vivid: true }
};

const OP_EXCLUSIVE = new Set(['operator_gigantes']);
// RF_VALDARION_CHIEF_20261108: Genuine model path; source GLB is not modified.
FIGHTERS.valdarion = {
  name: '虚無機神ヴァルダリオン', title: '無の尊座・至高位機神（運営長専用）',
  model: 'assets/models/valdarion.glb', face: 'assets/portraits/valdarion.webp',
  attribute: '無', nullElement: true,
  color: 0xc6b5ff, tint: null, height: 3.95, hp: 7800, speed: 5.7,
  overGain: 1.48, locked: true, special: 'chief', power: 1.4, armor: .72,
  light: {dmg: 230, range: 3.4, color: 0xe6d5ff},
  guardArt: {name: '絶対護装《無傷の煌鎧》', duration: 30, damageMultiplier: .5,
    staggerImmune: true, knockbackImmune: true, continueAttacking: true, cooldown: 75},
  skills: [
    {name:'虚無光砲《アビス・ゼロ》', kind:'projectile', visual:'orb', count:5, spreadAng:.10, chain:.06,
      dmg:180, speed:30, radius:1.15, cost:27, castTime:.8, elem:6, nullElement:true, color:0xc5a7ff, vivid:true},
    {name:'零界断刀《ゼロ・エクスカリオン》',kind:'dash',dmg:520,speed:25,dur:.42,
      cost:25,castTime:.68,elem:6,nullElement:true,color:0xf8efff,vivid:true},
    {name:'無限裂界《ノヴァ・ファンネル》',kind:'rain',visual:'crystal',count:15,spread:5.0,
      radius:1.75,dmg:160,delay:.35,interval:.065,cost:32,elem:6,nullElement:true,color:0xbb98ff,vivid:true},
    {name:'現実歪曲《リアリティ・リライト》',kind:'judgment',visual:'nova',finalVisual:'pillar',
      count:13,spread:6,radius:2.3,dmg:230,delay:.5,interval:.065,finalDmg:870,finalRadius:8.8,
      cost:42,castTime:2,elem:6,nullElement:true,color:0xf5e2ff,vivid:true},
    {name:'虚空再編《無の復元》',kind:'heal',heal:1100,radius:5.7,cost:30,
      elem:6,nullElement:true,color:0xc4eaff,vivid:true}
  ],
  hi: {name:'超越禁呪《原初の空白》',kind:'judgment',visual:'pillar',finalVisual:'nova',
    count:17,spread:6.5,radius:2.5,dmg:250,delay:.55,interval:.05,finalDmg:1300,finalRadius:10,
    castTime:3.15,elem:6,nullElement:true,color:0xebddff,vivid:true},
  over: {name:'無限終焉《エターナル・ヌル》',kind:'judgment',visual:'nova',finalVisual:'pillar',
    count:20,spread:7,radius:2.7,dmg:280,delay:.55,interval:.055,finalDmg:1700,finalRadius:11,
    castTime:2.65,elem:6,nullElement:true,color:0xf5e4ff,vivid:true}
};

// RF_CHIEF_BOSS_STATS_20261108
(()=>{const fire=0xff612a,ember=0xffba55,voidC=0xbda0ff;
if (FIGHTERS.gaizorg) {
  Object.assign(FIGHTERS.gaizorg, {
    name:'ガイゾルグ', title:'炎獄超甲獣・運営長専用',attribute:'炎',
    color:fire,tint:null,height:4.35,hp:14800,speed:5.65,
    power:1.65,armor:0.47,overGain:1.75,fluxMul:2.25,
    permanentSuperArmor:true,staggerImmune:true,knockbackImmune:true,
    ringArt:{name:'炎獄魔法陣《灼魂の焔界》',duration:30,radius:6.1,burnSeconds:10,attackMultiplier:0.5,cooldown:0},
    light:{dmg:290,range:4.1,color:0xffd58c,claws:true},
    skills:[
      {name:'爆炎散華《ヴォルカニック・バラージ》',kind:'projectile',visual:'fire',count:9,spreadAng:.12,chain:.045,dmg:140,speed:24,radius:.86,cost:22,castTime:.55,elem:0,color:0xff7b30,vivid:true},
      {name:'熔爪断撃《タイタン・クロウ》',kind:'dash',dmg:420,speed:23,dur:.38,stun:.62,kb:7,cost:18,castTime:.48,elem:0,color:0xffc269,vivid:true},
      {name:'灼星火球《マグマ・スフィア》',kind:'projectile',visual:'orb',count:5,spreadAng:.16,dmg:210,speed:22,radius:1.15,cost:25,castTime:.85,elem:0,color:0xff4e19,vivid:true},
      {name:'連続火炎放射《インフェルノ・ブレス》',kind:'projectile',visual:'fire',count:3,spreadAng:.12,dmg:110,speed:28,radius:.68,cost:12,castTime:.38,elem:0,color:0xffa12e,holdToChannel:true,vivid:true},
      {name:'灼魂再生《マグマ・リバイブ》',kind:'heal',heal:1500,radius:5.5,cost:30,elem:0,color:0xffcf93,vivid:true}
    ],
    over:{name:'炎獄天墜《スカーレット・インパクト》',kind:'judgment',visual:'meteor',finalVisual:'pillar',count:12,spread:5.3,radius:2.5,dmg:285,delay:.38,interval:.075,finalDmg:1550,finalRadius:9.6,castTime:2.3,elem:0,color:0xff6a29,vivid:true},
    hi:{name:'太古禁呪《原初火界・ノヴァ》',kind:'judgment',visual:'meteor',finalVisual:'nova',count:17,spread:7,radius:2.7,dmg:330,delay:.45,interval:.06,finalDmg:2300,finalRadius:11.3,castTime:3.2,elem:0,color:0xffc35e,hi:true,vivid:true}
  });
}
if (FIGHTERS.valdarion) {
  Object.assign(FIGHTERS.valdarion, {
    name:'虚無機神ヴァルダリオン',title:'無の最高神・運営長専用',attribute:'無',nullElement:true,
    color:0xcbbaff,tint:null,height:4.25,hp:19500,speed:6.65,
    power:1.9,armor:0.36,fluxMul:2.6,overGain:1.9,
    permanentSuperArmor:true,staggerImmune:true,knockbackImmune:true,
    guardArt:{name:'絶対零域《無限封界》',duration:30,radius:6.4,immobilizeUntilHit:true},
    light:{dmg:310,range:3.7,color:0xf0ddff,shadowClones:4},
    skills:[
      {name:'虚無の終光《アビス・ゼロ》',kind:'projectile',visual:'orb',count:6,spreadAng:.13,chain:.045,dmg:195,speed:29,radius:1,cost:24,castTime:.55,elem:6,color:0xcbadff,nullElement:true,vivid:true},
      {name:'絶界断刀《ゼロ・エクスカリオン》',kind:'dash',dmg:520,speed:28,dur:.39,cost:24,elem:6,color:0xe5d8ff,nullElement:true,vivid:true},
      {name:'四重虚空《クアドラ・ネメシス》',kind:'rain',visual:'crystal',count:14,spread:4.7,radius:2,dmg:240,delay:.24,interval:.065,cost:32,elem:6,color:0xb389ff,nullElement:true,vivid:true},
      {name:'因果消去《リアリティ・オーバーライト》',kind:'judgment',visual:'nova',finalVisual:'pillar',count:16,spread:6.4,radius:2.4,dmg:300,delay:.42,interval:.065,finalDmg:1750,finalRadius:10.2,cost:39,castTime:2.3,elem:6,color:0xe9d6ff,nullElement:true,vivid:true},
      {name:'無限再誕《ヌル・リジェネシス》',kind:'heal',heal:2200,radius:5.5,cost:30,elem:6,color:0xc4e8ff,nullElement:true,vivid:true}
    ],
    over:{name:'世界断章《エターナル・ヌル》',kind:'judgment',visual:'nova',finalVisual:'pillar',count:19,spread:7,radius:2.8,dmg:360,delay:.38,interval:.055,finalDmg:2500,finalRadius:11.3,castTime:2.7,elem:6,color:0xf3e5ff,nullElement:true,vivid:true},
    hi:{name:'至高禁呪《原初の空白》',kind:'judgment',visual:'pillar',finalVisual:'nova',count:23,spread:7.5,radius:3.1,dmg:400,delay:.4,interval:.05,finalDmg:3200,finalRadius:12,castTime:3.05,elem:6,color:0xffffff,nullElement:true,hi:true,vivid:true}
  });
}


})();
// RF_MAOU_V6
// Riftfall V6: 新キャラ『魔王』。モデルはユーザー提供の軽量版GLBをそのまま参照。
// バランス制限ループの後で実行するので、数値が他キャラの上限に再制限されない。
FIGHTERS.maou = {
  name:'魔王', title:'虹雷と無限光を統べる究極魔王（運営長専用）',
  model:'assets/models/maou-lord.glb', face:'assets/portraits/maou-placeholder.svg',
  color:0xffdff8, tint:null, height:4.18, hp:36000, speed:8.2,
  power:2.9, armor:0.30, fluxMul:3.25, overGain:2.8,
  locked:true, special:'chief', attribute:'光', supreme:true,
  light:{dmg:0,range:4,color:0xffeeff, rainbowGuard:true},
  regenGuard:{duration:30,cooldown:0,healFractionPerSecond:.033},
  rainbowArmor:{duration:30,damageMultiplier:.5,staggerImmune:true,canCast:true},
  revival:{chance:.5,maxActivations:1},
  skills:[
    {name:'神光星槍《アーク・レギオン》',kind:'projectile',visual:'spear',elem:5,color:0xfff1b2,cost:18,castTime:.48,count:10,spreadAng:.10,chain:.035,dmg:250,speed:33,radius:1.2,vivid:true},
    {name:'超天照断《セレスティアル・エッジ》',kind:'dash',elem:5,color:0xffe3a5,cost:20,speed:32,dur:.45,dmg:1150,stun:.8,kb:10,vivid:true},
    {name:'滅界眼光《スカーレット・アポカリプス》',kind:'maou_eye_laser',elem:5,color:0xff334d,cost:31,castTime:.75,dmg:1450,radius:20,vivid:true},
    {name:'口卵術《翠影孵化》',kind:'maou_egg',elem:5,color:0xa4ffa2,cost:28,castTime:1.05,dmg:0,count:4,vivid:true,description:'口から産んだ卵が緑の分身4体に孵化。自動追尾攻撃・3回被弾で消滅・HPバーなし'},
    {name:'無尽光輪《全生命復元》',kind:'maou_fullheal',elem:5,color:0xffffff,cost:30,castTime:1.2,dmg:0,heal:36000,vivid:true,description:'魔王自身のHPを最大まで完全回復'},
    {name:'恒星破断《ヘヴン・カタストロフ》',kind:'judgment',visual:'pillar',finalVisual:'nova',elem:5,color:0xffed91,cost:38,castTime:2.15,count:20,spread:7,radius:2.6,dmg:420,delay:.4,interval:.065,finalDmg:2100,finalRadius:11,vivid:true},
    {name:'万象虹皇《プリズム・テンペスト》',kind:'rain',visual:'bolt',elem:5,color:0xe2b3ff,cost:26,castTime:1.45,count:17,spread:5.5,radius:2.3,dmg:300,delay:.25,interval:.07,vivid:true},
    {name:'輝天追星《スーパーノヴァ・ハント》',kind:'projectile',visual:'orb',elem:5,color:0xb2fcff,cost:24,castTime:.68,count:15,spreadAng:.1,chain:.045,dmg:280,speed:31,radius:1.5,vivid:true},
    {name:'無窮雷獄《エターナル・ヴォルト》',kind:'shockwave',elem:5,color:0xe9e6ff,cost:27,castTime:.92,dmg:1500,radius:10.5,double:true,vivid:true},
    {name:'無限天柱《アルティメット・カノン》',kind:'judgment',visual:'pillar',finalVisual:'nova',elem:5,color:0xffffff,cost:45,castTime:2.2,count:16,spread:6,radius:2.5,dmg:520,delay:.4,interval:.06,finalDmg:3200,finalRadius:12.2,vivid:true},
    {name:'時空星彩《ゼニス・エクリプス》',kind:'implode',elem:5,color:0xfbc4ff,cost:32,castTime:1.4,dmg:1800,radius:11,vivid:true},
    {name:'審判極星《デウス・レイジ》',kind:'rain',visual:'meteor',elem:5,color:0xffefaa,cost:40,castTime:2.15,count:22,spread:7.4,radius:2.6,dmg:470,delay:.34,interval:.055,vivid:true}
  ],
  // K/Uキーの技選択はローテーション。Hキーは固定の完全回復技。
  pool:[0,1,2,3,5,6,7,8,9,10,11],
  over:{name:'終極極光《アポカリプス・オメガ》',kind:'judgment',visual:'nova',finalVisual:'pillar',elem:5,color:0xffe5a2,cost:0,castTime:2.5,count:25,spread:8,radius:3,dmg:630,delay:.48,interval:.052,finalDmg:3900,finalRadius:12.4,vivid:true},
  hi:{name:'創世絶光《エンドレス・セラフィム》',kind:'judgment',visual:'pillar',finalVisual:'nova',elem:5,color:0xffffff,cost:0,castTime:3.4,count:28,spread:8.6,radius:3.1,dmg:740,delay:.44,interval:.05,finalDmg:4900,finalRadius:13.5,vivid:true,hi:true}
};
FIGHTERS.maou_shade = {
  name:'翠影の分身',title:'魔王の緑影（召喚専用）',model:'assets/models/maou-lord.glb',
  face:'assets/portraits/maou-placeholder.svg',hidden:true,locked:true,special:'chief',
  color:0x57f483, tint:null,height:2.55,hp:3,speed:7.6,power:0.65,armor:1,
  overGain:0,light:{dmg:120,range:2.5,color:0x6aff86},
  skills:[{name:'影光刺',kind:'dash',elem:5,color:0x7bff9f,dmg:110,cost:5,speed:16,dur:.25}],
  over:{name:'影光閃',kind:'shockwave',elem:5,color:0x7bff9f,dmg:130,radius:3,cost:0}
};

const CHIEF_ONLY = new Set([TENSHI_KEY,'valgard', 'gaizorg', 'valdarion', 'valgard2', 'maou', 'maou_shade']);

// ---------- ルート ----------
export default {
  async fetch(req, env = {}) {
    // Keep the complete request entry point inside the try/catch. Cloudflare
    // quick-edit previews can invoke the Worker without production bindings.
    // A missing binding must produce a controlled JSON error, not HTTP 1101.
    let H = { 'Access-Control-Allow-Origin': 'null' };
    try {
      env = env || {};
      H = cors(env, req);
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: H });
      const url = new URL(req.url);
      // GET health check needs no secrets or Durable Object bindings.
      // This confirms script startup only; it does not test gameplay storage.
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
        return json(H, {
          ok: true,
          service: 'riftfall-arena-api',
          check: 'worker-runtime',
          version: '55.24'
        });
      }
      if (url.pathname.startsWith('/rank/socket/')) return await openRankSocket(req,env,url.pathname.slice('/rank/socket/'.length));
      if (url.pathname === '/stripe/webhook') return await stripeWebhook(req, env);
      if (req.method !== 'POST') return json(H, { error: 'method' }, 405);
      const raw = await req.text();
      if (raw.length > 220000) return json(H, { error: 'too large' }, 413);
      let body;
      try { body = raw ? JSON.parse(raw) : {}; } catch { return json(H, { error: 'bad' }, 400); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json(H, { error: 'bad' }, 400);
      switch (url.pathname) {
        case '/rank/session': return await rankedRoute(req,env,H,body,'session');
        case '/rank/board': return await rankedRoute(req,env,H,body,'board');
        case '/rank/join': return await rankedRoute(req,env,H,body,'join');
        case '/rank/status': return await rankedRoute(req,env,H,body,'status');
        case '/rank/cancel': return await rankedRoute(req,env,H,body,'cancel');
        case '/auth/key': return await authKey(req, env, H, body);
        case '/invite/issue': return await inviteIssue(req, env, H, body);
        case '/invite/redeem': return await inviteRedeem(req, env, H, body);
        case '/invade/ticket': return await invadeTicket(req, env, H, body);
        case '/sync/push': return await syncPush(req, env, H, body);
        case '/sync/pull': return await syncPull(req, env, H, body);
        case '/entitlements': return await entitlements(req, env, H, body);
        case '/profile': return await profile(req, env, H, body);
        case '/minamoto/buy': return await rf48BuyMinamoto(req, env, H, body);
        case '/guild/create': return await guildRoute(req, env, H, body, 'create');
        case '/guild/get': return await guildRoute(req, env, H, body, 'get');
        case '/guild/join': return await guildRoute(req, env, H, body, 'join');
        case '/guild/leave': return await guildRoute(req, env, H, body, 'leave');
        case '/guild/role': return await guildRoute(req, env, H, body, 'role');
        case '/guild/unban': return await guildRoute(req, env, H, body, 'unban');
        case '/guild/donate': return await guildDonate(req, env, H, body);
        case '/guild/board': return await guildBoardRoute(req, env, H);
        case '/chat/room': return await chatRoom(req, env, H, body);
        case '/activity/ping': return await rfActivityPing(req, env, H, body);
        case '/activity/list': return await rfActivityList(req, env, H, body);
        case '/characters/overrides': return await rfChiefCharacterEditor(req, env, H, body, 'get');
        case '/chief/characters/chunk': return await rfChiefCharacterEditorWriteV33(req, env, H, body, 'chunk');
        case '/chief/characters/commit': return await rfChiefCharacterEditorWriteV33(req, env, H, body, 'commit');
        case '/chief/characters/save': return await rfChiefCharacterEditor(req, env, H, body, 'save');
        case '/chief/sign': return await chiefSign(req, env, H, body);
        case '/chief/event': return await chiefEvent(req, env, H, body);
        case '/chief/current': return await chiefCurrent(req, env, H);
        // RF553_CHIEF_GLOBAL_CPU_20261111: a public read, chief-token-gated global edit.
        case '/settings/cpu': return await rf553CpuRoute(req,env,H,body);
        case '/chief/mail/send': return await chiefMail(req, env, H, body, 'send');
        case '/chief/mail/history': return await chiefMail(req, env, H, body, 'history');
        // RF552_INFINITY_SERVER_RANKING: authenticated server-timed runs.
        case '/infinite/start': return await rf552InfiniteRoute(req,env,H,body,'start');
        case '/infinite/progress': return await rf552InfiniteRoute(req,env,H,body,'progress');
        case '/infinite/finish': return await rf552InfiniteRoute(req,env,H,body,'finish');
        case '/infinite/board': return await rf552InfiniteRoute(req,env,H,body,'board');
        case '/castle/boss': return await rf50Route(req,env,H,body,'boss');
        case '/castle/raid/arena': return await rf50Route(req,env,H,body,'raid/arena');
        case '/castle/raid/leave': return await rf50Route(req,env,H,body,'raid/leave');
        case '/castle/self': return await rf50Route(req,env,H,body,'self');
        case '/castle/create': return await rf50Route(req,env,H,body,'create');
        case '/castle/level': return await rf50Route(req,env,H,body,'level');
        case '/castle/level-bulk': return await rf50Route(req,env,H,body,'level-bulk');
        case '/castle/name': return await rf50Route(req,env,H,body,'name');
        case '/castle/lord': return await rf50Route(req,env,H,body,'lord');
        case '/castle/list': return await rf50Route(req,env,H,body,'list');
        case '/castle/raid/start': return await rf50Route(req,env,H,body,'raid/start');
        case '/castle/raid/current': return await rf50Route(req,env,H,body,'raid/current');
        case '/castle/raid/act': return await rf50Route(req,env,H,body,'raid/act');
        case '/castle/raid/claim': return await rf50Route(req,env,H,body,'raid/claim');
        case '/mail/list': return await playerMail(req, env, H, body, 'list');
        case '/mail/read': return await playerMail(req, env, H, body, 'read');
        case '/mail/claim': return await playerMail(req, env, H, body, 'claim');
        default: return json(H, { error: 'not found' }, 404);
      }
    } catch (err) {
      // Detailed failure stays in Worker logs, not in public API responses.
      console.error('[Riftfall Arena API] request error:', err?.stack || String(err));
      return json(H, { error: 'server' }, 500);
    }
  }
};

// 運営/運営長キー → 役割トークン（キーのハッシュはサーバーの秘密変数にだけ置く）
// RF_CHIEF_CHAR_EDITOR_V31_ALL_RANDOM_SLOTS — secure server-side persistence of character overrides.
// Role authentication is enforced here, not by visibility of the client UI.
const RF_CHARACTER_EDITOR_STORE = 'chief-character-overrides-v28';
const RF_CHARACTER_STATS = Object.freeze({
  hp: [1,200000], speed:[0.1,30],power:[0.1,20],armor:[0.01,5],
  height:[0.1,12],overGain:[0.1,12],fluxMul:[0.1,12]
});
const RF_CHARACTER_TEXT = Object.freeze({name:40,title:90,attribute:16});
const RF_CHARACTER_SKILL_KIND = new Set(['projectile','shockwave','dash','rain','judgment','implode','heal']);
const RF_CHARACTER_SKILL_MODE = new Set(['fixed','sequence']);
const RF_CHARACTER_SKILL_VISUAL = new Set(['orb','spear','laser','meteor','blade','sword','nova','pillar','bigsword','bolt']);
const RF_CHARACTER_MAX_SLOTS = 24;
const RF_CHARACTER_SKILL_NUM = Object.freeze({
  dmg:[0,100000],cost:[0,100],radius:[0,100],castTime:[0,30],
  speed:[1,150],dur:[0.05,10],count:[1,24],spread:[0,40],spreadAng:[0,3.14],
  delay:[0,10],interval:[0.01,3],heal:[0,100000],finalDmg:[0,100000],finalRadius:[0.1,100], elem:[0,DIVINE_ELEMENT],color:[0,16777215],shape:[0,99],stun:[0,5],kb:[0,30],chain:[0,1],trail:[0.01,1]
});
function rfCharPlain(v){return v && typeof v==='object' && !Array.isArray(v);}
function rfCharParseSkill(v,actual){
  if(!rfCharPlain(v)||!rfCharPlain(actual))return null;
  const cleaned=Object.create(null);
  for(const [k,x] of Object.entries(v)){
    if(k==='name' && typeof x==='string'&&x.trim().length>0&&[...x.trim()].length<=42)cleaned.name=x.trim();
    else if(k==='kind'&&typeof x==='string'&&(RF_CHARACTER_SKILL_KIND.has(x)||x===actual.kind))cleaned.kind=x;
    else if(k==='visual'&&typeof x==='string'&&(RF_CHARACTER_SKILL_VISUAL.has(x)||x===actual.visual))cleaned.visual=x;
    else if(k==='double'&&typeof x==='boolean')cleaned.double=x;
    else if(Object.prototype.hasOwnProperty.call(RF_CHARACTER_SKILL_NUM,k)){
      const [min,max]=RF_CHARACTER_SKILL_NUM[k];
      if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)return null;
      cleaned[k]=x;
    }else return null;
  }
  return cleaned;
}
function rfCharParseOverrides(input){
  if(!rfCharPlain(input))return null;
  const list=Object.entries(input);
  if(list.length>300)return null;
  const clean=Object.create(null);
  for(const [key,obj] of list){
    if(!/^[a-zA-Z0-9_]{1,40}$/.test(key)||!Object.prototype.hasOwnProperty.call(FIGHTERS,key)||!rfCharPlain(obj))return null;
    const entry=Object.create(null),def=FIGHTERS[key];
    for(const [k,v] of Object.entries(obj)){
      if(Object.prototype.hasOwnProperty.call(RF_CHARACTER_STATS,k)){
        const [min,max]=RF_CHARACTER_STATS[k];
        if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)return null;
        entry[k]=v;
      } else if(Object.prototype.hasOwnProperty.call(RF_CHARACTER_TEXT,k)){
        if(typeof v!=='string'||![...v.trim()].length||[...v.trim()].length>RF_CHARACTER_TEXT[k])return null;
        entry[k]=v.trim();
      } else if(k==='skillCount'){
        if(!Number.isInteger(v)||v<1||v>RF_CHARACTER_MAX_SLOTS)return null;
        entry.skillCount=v;
      } else if(k==='skillMode'){
        if(typeof v!=='string'||!RF_CHARACTER_SKILL_MODE.has(v))return null;
        entry.skillMode=v;
      } else if(k==='skills'){
        if(!Array.isArray(v)||v.length>RF_CHARACTER_MAX_SLOTS)return null;
        const slots=[];
        for(let i=0;i<v.length;i++){
          if(v[i]===null){slots.push(null);continue;}
          const s=rfCharParseSkill(v[i],def.skills?.[i]||{});if(!s)return null;slots.push(s);
        }
        entry.skills=slots;
      } else if(k==='over'||k==='hi'){
        const s=rfCharParseSkill(v,def[k]||{});if(!s)return null;entry[k]=s;
      } else return null;
    }
    const cnt=entry.skillCount??(def.skills?.length||0);
    if(entry.skills?.length>cnt)return null;
    if(cnt>(def.skills?.length||0)){
      for(let i=def.skills.length;i<cnt;i++){
        const s=entry.skills?.[i];
        if(!rfCharPlain(s)||!RF_CHARACTER_SKILL_KIND.has(s.kind)||typeof s.name!=='string'||!s.name.trim())return null;
        // A newly added slot must have a usable spell configuration.
        if(s.kind==='projectile'&&(typeof s.speed!=='number'||typeof s.radius!=='number'))return null;
        if((s.kind==='rain'||s.kind==='judgment')&&(!Number.isInteger(s.count)||!Number.isFinite(s.interval)))return null;
      }
    }
    clean[key]=entry;
  }
  return clean;
}
async function rfChiefCharacterEditor(req,env,H,body,mode){
  if(mode==='get')return rfChiefCharacterEditorReadV33(req,env,H,body);
  if(!env.STORE)return json(H,{error:'storage_unavailable'},503);
  if(mode==='save'){
    const role=await verify(env,body.token,'role');
    if(role?.r!=='chief')return json(H,{error:'denied'},403);
    if(await limited(env,req,'chief-editor-save',35,600000))return json(H,{error:'limit'},429);
    const data=rfCharParseOverrides(body.overrides);
    if(!data)return json(H,{error:'invalid_character_values'},400);
    if(JSON.stringify(data).length>150000)return json(H,{error:'too_large'},413);
    const current=await storeCall(env,RF_CHARACTER_EDITOR_STORE,{op:'get'});
    if(current.status!==200)return json(H,{error:'storage_failed'},503);
    const prior=current.data?.v;
    const rev=Number(prior?.rev)||0;
    if(!Number.isSafeInteger(body.revision)||body.revision!==rev)return json(H,{error:'stale',revision:rev},409);
    const next={at:Math.max(Date.now(),(Number(prior?.at)||0)+1),rev:rev+1,overrides:data};
    const stored=await storeCall(env,RF_CHARACTER_EDITOR_STORE,{op:'newer',v:next});
    if(stored.status!==200||!stored.data?.ok)return json(H,{error:'stale'},409);
    return json(H,{ok:true,revision:next.rev,updatedAt:next.at});
  }
  if(await limited(env,req,'chief-editor-read',90,60000))return json(H,{error:'limit'},429);
  const latest=await storeCall(env,RF_CHARACTER_EDITOR_STORE,{op:'get'});
  if(latest.status!==200)return json(H,{error:'storage_failed'},503);
  const v=latest.data?.v;
  return json(H,{ok:true,revision:Number(v?.rev)||0,updatedAt:Number(v?.at)||0,overrides:v?.overrides||{}});
}

// RF_CHIEF_CHAR_EDITOR_V33_CHUNKED_SAVES
// Immutable snapshot chunks plus one atomic Durable Object metadata commit.
// The old single-document edits are still readable. Chunk size is intentionally bounded
// per REQUEST; there is no application-level cap on the TOTAL number of chunks.
const RF_CHAR_BATCH_PREFIX='chief-character-overrides-batch-v33:';
const RF_CHAR_BATCH_RE=/^[0-9a-f]{32}$/;
function rfCharV33BatchName(batchId){return RF_CHAR_BATCH_PREFIX+batchId;}
function rfCharV33BatchParams(body){
  return body&&RF_CHAR_BATCH_RE.test(String(body.batchId||'')) &&
    Number.isSafeInteger(body.revision)&&body.revision>=0 &&
    Number.isSafeInteger(body.total)&&body.total>=1 &&
    Number.isSafeInteger(body.index??0)&&(body.index??0)>=0&&(body.index??0)<body.total;
}
async function rfChiefCharacterEditorReadV33(req,env,H,body){
  if(!env.STORE)return json(H,{error:'storage_unavailable'},503);
  if(await limited(env,req,'chief-editor-read-v33',2000,60000))return json(H,{error:'limit'},429);
  const current=await storeCall(env,RF_CHARACTER_EDITOR_STORE,{op:'get'});
  if(current.status!==200)return json(H,{error:'storage_failed'},503);
  const v=current.data?.v||{},rev=Number(v.rev)||0;
  if(body.revision!==undefined&&body.revision!==null&&body.revision!==rev)return json(H,{error:'stale',revision:rev},409);
  if(!v.ref||!Number.isSafeInteger(v.chunks))return json(H,{ok:true,revision:rev,updatedAt:Number(v.at)||0,overrides:v.overrides||{},nextPage:null});
  // V33 clients ALWAYS send page. For older browser tabs, allow whole-map reads
  // only when small enough so they do not silently display a partial snapshot.
  if(body.page===undefined||body.page===null){
    if(v.chunks>8)return json(H,{error:'upgrade_required'},426);
    const all=Object.create(null);
    for(let i=0;i<v.chunks;i++){
      const p=await storeCall(env,rfCharV33BatchName(v.ref),{op:'rf-chunk-get',index:i});
      if(p.status!==200||!p.data?.ok)return json(H,{error:'storage_failed'},503);
      Object.assign(all,p.data.overrides);
    }
    return json(H,{ok:true,revision:rev,updatedAt:Number(v.at)||0,overrides:all,nextPage:null});
  }
  const page=body.page;
  if(!Number.isSafeInteger(page)||page<0||page>=v.chunks)return json(H,{error:'bad_page'},400);
  const result=await storeCall(env,rfCharV33BatchName(v.ref),{op:'rf-chunk-get',index:page});
  if(result.status!==200||!result.data?.ok)return json(H,{error:'storage_failed'},503);
  return json(H,{ok:true,revision:rev,updatedAt:Number(v.at)||0,
    overrides:result.data.overrides||{},nextPage:page+1<v.chunks?page+1:null,totalPages:v.chunks});
}
async function rfChiefCharacterEditorWriteV33(req,env,H,body,mode){
  if(!env.STORE)return json(H,{error:'storage_unavailable'},503);
  if((await verify(env,body.token,'role'))?.r!=='chief')return json(H,{error:'denied'},403);
  if(!rfCharV33BatchParams(body))return json(H,{error:'bad_batch'},400);
  if(mode==='chunk'){
    if(await limited(env,req,'chief-editor-chunk',2400,600000))return json(H,{error:'limit'},429);
    const clean=rfCharParseOverrides(body.overrides);
    if(!clean)return json(H,{error:'invalid_character_values'},400);
    // Each chunk fits comfortably below the 220 KB outer JSON request ceiling.
    if(new TextEncoder().encode(JSON.stringify(clean)).byteLength>62000)return json(H,{error:'chunk_too_large'},413);
    const r=await storeCall(env,rfCharV33BatchName(body.batchId),{
      op:'rf-chunk-put',index:body.index,total:body.total,revision:body.revision,overrides:clean
    });
    if(r.status!==200||!r.data?.ok)return json(H,{error:r.data?.error||'storage_failed'},r.status===409?409:503);
    return json(H,{ok:true,index:body.index,total:body.total});
  }
  if(mode==='commit'){
    if(await limited(env,req,'chief-editor-commit',60,600000))return json(H,{error:'limit'},429);
    const batch=rfCharV33BatchName(body.batchId);
    const ready=await storeCall(env,batch,{op:'rf-ready',revision:body.revision,total:body.total});
    if(ready.status!==200||!ready.data?.ok)return json(H,{error:ready.data?.error||'incomplete'},409);
    // Revision CAS is performed inside the central Durable Object; all readers
    // see either the complete old snapshot OR the complete new snapshot.
    const published=await storeCall(env,RF_CHARACTER_EDITOR_STORE,{
      op:'rf-revision-cas',revision:body.revision,ref:body.batchId,total:body.total
    });
    if(published.status!==200||!published.data?.ok)return json(H,{error:published.data?.error||'stale'},409);
    const oldRef=published.data.previousRef;
    if(typeof oldRef==='string'&&RF_CHAR_BATCH_RE.test(oldRef)&&oldRef!==body.batchId){
      // Give readers already loading the old version time to finish.
      try{await storeCall(env,rfCharV33BatchName(oldRef),{op:'rf-schedule-expiry',ms:30*60*1000});}catch{}
    }
    return json(H,{ok:true,revision:published.data.revision,updatedAt:published.data.updatedAt,parts:body.total});
  }
  return json(H,{error:'bad'},400);
}

async function authKey(req, env, H, { key }) {
  if (await limited(env, req, 'auth', 5, 60000)) return json(H, { error: 'locked' }, 429);
  if (typeof key !== 'string' || key.length > 128) return json(H, { error: 'bad' }, 400);
  const h = await sha256(key);
  let r = null;
  if (safeEqual(h, env.CHIEF_KEY_SHA256)) r = 'chief';
  else if (safeEqual(h, env.OP_KEY_SHA256)) r = 'op';
  if (!r) return json(H, { error: 'denied' }, 403);
  return json(H, { token: await sign(env, { t: 'role', r, exp: Date.now() + 12 * 3600000 }) });
}

// 運営長だけが招待コードを発行（コードはサーバーで生成し、ハッシュのみ保存）
async function inviteIssue(req, env, H, { token }) {
  const role = await verify(env, token, 'role');
  if (role?.r !== 'chief') return json(H, { error: 'denied' }, 403);
  if (await limited(env, req, 'issue', 20, 3600000)) return json(H, { error: 'limit' }, 429);
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(12));
  const code = 'OP-' + [0, 1, 2].map((g) => [...b.slice(g * 4, g * 4 + 4)].map((x) => A[x % A.length]).join('')).join('-');
  const h = await hmacHex(env.PEPPER, 'invite:' + code);
  const stub = env.INVITE_LOCK.get(env.INVITE_LOCK.idFromName(h));
  const r = await stub.fetch('https://lock/', { method: 'POST', body: JSON.stringify({ op: 'issue' }) });
  if (r.status !== 200) return json(H, { error: 'server' }, 500);
  return json(H, { code });
}

// 招待コード：Durable Object（コードごとに1つ・直列実行）で一度だけ使用可能にする
async function inviteRedeem(req, env, H, { code }) {
  if (await limited(env, req, 'redeem', 8, 600000)) return json(H, { error: 'limit' }, 429);
  const c = String(code || '').toUpperCase();
  if (!/^OP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) return json(H, { error: 'bad' }, 400);
  const h = await hmacHex(env.PEPPER, 'invite:' + c);
  const stub = env.INVITE_LOCK.get(env.INVITE_LOCK.idFromName(h));
  const r = await stub.fetch('https://lock/', { method: 'POST', body: JSON.stringify({ op: 'redeem' }) });
  if (r.status !== 200) return json(H, { error: 'used or invalid' }, 403);
  return json(H, { token: await sign(env, { t: 'role', r: 'op', exp: Date.now() + 30 * DAY }) });
}

// 乱入：運営/運営長のみ。相手端末が検証する60秒限りの許可証を発行
async function invadeTicket(req, env, H, { token, from, to }) {
  const role = await verify(env, token, 'role');
  if (!role) return json(H, { error: 'denied' }, 403);
  if (typeof from !== 'string' || typeof to !== 'string' || from.length > 40 || to.length > 40) return json(H, { error: 'bad' }, 400);
  if (await limited(env, req, 'invade', 6, 60000)) return json(H, { error: 'limit' }, 429);
  return json(H, { ticket: await sign(env, { t: 'inv', r: role.r, from, to, exp: Date.now() + 60000 }) });
}

// 同期セーブ：コードはサーバーのペッパー付きHMACで鍵化。クライアントからDBへは直接触れない
async function syncKey(env, code) {
  const n = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return n.length === 12 ? hmacHex(env.PEPPER, 'sync:' + n) : null;
}
// 書き込みは同期コードごとの Durable Object で直列化し、版番号(ver)で競合を検出する
// 初回はサーバー導入前の進行分を含むため上限を大きく取る
const FIRST_WEALTH_CAP = 100000000;
async function syncPush(req, env, H, { code, data, base, wid }) {
  if (await limited(env, req, 'syncw', 120, 600000)) return json(H, { error: 'limit' }, 429);
  const h = await syncKey(env, code);
  if (!h || typeof data !== 'string' || data.length > 200000) return json(H, { error: 'bad' }, 400);
  let parsed;
  try {
    parsed = JSON.parse(data);
  } catch {
    return json(H, { error: 'bad' }, 400);
  }
  if (!validateSaveShape(parsed)) return json(H, { error: 'bad' }, 400);
  delete parsed.chars; // 購入キャラは決済記録からのみ復元する
  // プレイヤーID(pid)は最初に使った同期コードに固定（他人のpidを名乗るセーブは拒否）
  const ppid = String(parsed.pid || '');
  if (PID_RE.test(ppid) && !(await bindPid(env, ppid, h))) return json(H, { error: 'pid' }, 403);
  const stub = env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(h));
  const r = await stub.fetch('https://sync/', { method: 'POST', body: JSON.stringify({ h, data: parsed, base: Math.floor(+base || 0), wid: String(wid || '') }) });
  return json(H, await r.json(), r.status);
}
async function syncPull(req, env, H, { code }) {
  if (await limited(env, req, 'syncr', 120, 600000)) return json(H, { error: 'limit' }, 429);
  const h = await syncKey(env, code);
  if (!h) return json(H, { error: 'bad' }, 400);
  const row = await syncRow(env, h);
  return json(H, { data: typeof row?.data === 'string' ? row.data : null, ver: row?.ver || 0 });
}
async function syncRow(env, h) {
  const r = await doCall(env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(h)), { op: 'get' });
  return r.data?.row || null;
}

// Stripe：署名を検証し、支払い完了したセッションだけを購入記録にする
async function stripeWebhook(req, env) {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const body = await req.text();
  const sig = req.headers.get('Stripe-Signature') || '';
  const parts = Object.fromEntries(sig.split(',').map((kv) => kv.split('=')));
  const t = +parts.t;
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return new Response('stale', { status: 400 });
  const expect = await hmacHex(env.STRIPE_WEBHOOK_SECRET, `${t}.${body}`);
  const v1s = sig.split(',').filter((kv) => kv.startsWith('v1=')).map((kv) => kv.slice(3));
  if (!v1s.some((v) => safeEqual(v, expect))) return new Response('bad signature', { status: 400 });
  const ev = JSON.parse(body);
  if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
    const s = ev.data.object;
    const links = JSON.parse(env.STRIPE_LINKS || '{}'); // { "plink_xxx": "crimson" }
    const key = links[s.payment_link];
    const buyer = String(s.client_reference_id || '');
    if (s.payment_status === 'paid' && key && ownValue(FIGHTERS, key) && /^[A-Za-z0-9_-]{16,64}$/.test(buyer)) {
      // 先に購入権限を保存（追加は重複しても1件のまま＝再実行しても安全）。
      // 保存に失敗したら 500 を返し、Stripe の再送で同じ通知を最初からやり直す。
      const b = await hmacHex(env.PEPPER, 'buyer:' + buyer);
      const add = await storeCall(env, 'ent:' + b, { op: 'add', item: key });
      if (add.status !== 200) return new Response('retry', { status: 500 });
      // 権限保存が終わってから「処理済み」を記録
      await storeCall(env, 'sid:' + s.id, { op: 'once' });
    }
  }
  return new Response('ok');
}
async function ownedKeys(env, buyer) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(String(buyer || ''))) return [];
  const b = await hmacHex(env.PEPPER, 'buyer:' + buyer);
  const r = await storeCall(env, 'ent:' + b, { op: 'get' });
  return [...new Set((Array.isArray(r.data?.v) ? r.data.v : []).filter((k) => ownValue(FIGHTERS, k)))];
}
async function entitlements(req, env, H, { buyer }) {
  if (await limited(env, req, 'ent', 30, 600000)) return json(H, { error: 'limit' }, 429);
  const list = await ownedKeys(env, buyer);
  return json(H, { token: await sign(env, { t: 'ent', keys: list, exp: Date.now() + 7 * DAY }), keys: list });
}

// 戦闘プロフィール：キャラ使用権・強化・装備をサーバーで検証し、上限内の値だけを署名して返す
// 強化・装備はクライアント申告ではなく、サーバーに預けられ資産検証を通った同期セーブから算出する
async function profile(req, env, H, { code, key, role, buyer }) {
  if (await limited(env, req, 'prof', 60, 600000)) return json(H, { error: 'limit' }, 429);
  const h = await syncKey(env, code);
  if (!ownValue(FIGHTERS, key) || !h) return json(H, { error: 'bad' }, 400);
  const row = await syncRow(env, h);
  let save = null;
  try {
    save = row?.data ? JSON.parse(row.data) : null;
  } catch {
    save = null;
  }
  if (!save) save = {}; // 未登録なら強化なしとして署名
  const r = (await verify(env, role, 'role'))?.r || null;
  if (OP_EXCLUSIVE.has(key) && r !== 'op') return json(H, { error: 'denied' }, 403);
  if (key === 'maou_shade') return json(H, {error:'denied'}, 403);
  if (CHIEF_ONLY.has(key) && r !== 'chief') return json(H, { error: 'denied' }, 403);
  if (OP_ONLY.has(key) && !r) return json(H, { error: 'denied' }, 403);
  if(key==='minamoto_yoritomo'){
    const check=await doCall(env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(h)),{op:'minamoto-owned'});
    if(!check.data?.owned)return json(H,{error:'not purchased'},403);
  }
  if (FIGHTERS[key].shop && key !== 'minamoto_yoritomo' && !(await ownedKeys(env, buyer)).includes(key)) return json(H, { error: 'not purchased' }, 403);
  const u = statsFor(save, key);
  // 証明をプレイヤー(pid)に結びつける：同期コードに固定された pid だけを入れる
  const pid = String(save.pid || '');
  if (!PID_RE.test(pid) || !(await bindPid(env, pid, h))) return json(H, { error: 'nosync' }, 403);
  return json(H, { token: await sign(env, { t: 'prof', k: key, u, p: pid, exp: Date.now() + 2 * 3600000 }) });
}

// ---------- 本人確認（同期コード → サーバー保管セーブの pid。pid は同期コードに固定） ----------
const PID_RE = /^[A-Za-z0-9]{1,24}$/;
const GID_RE = /^[A-Za-z0-9]{8}$/;
const cleanTxt = (v, n) => [...String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim()].slice(0, n).join('');
async function bindPid(env, pid, h) {
  const stub = env.PID_BIND.get(env.PID_BIND.idFromName(pid));
  const r = await stub.fetch('https://bind/', { method: 'POST', body: JSON.stringify({ h }) });
  return r.status === 200;
}
async function whoAmI(env, code, name) {
  const h = await syncKey(env, code);
  if (!h) return null;
  const row = await syncRow(env, h);
  let s = null;
  try { s = row?.data ? JSON.parse(row.data) : null; } catch { s = null; }
  const pid = String(s?.pid || '');
  if (!PID_RE.test(pid) || !(await bindPid(env, pid, h))) return null;
  return { pid, h, name: cleanTxt(name, 12) || '旅人' };
}
// Ranked points belong to the verified sync player and are independent of save edits.
let rankedFighters;
function rankedPool(role) {
  if (!rankedFighters) {
    const regular = new Map(), chief = new Map(), op = new Map();
    const keys = new Set([...ROSTER, ...CHIEF_ONLY, ...OP_ONLY, ...OP_EXCLUSIVE]);
    for (const fighter of keys) {
      const def = ownValue(FIGHTERS, fighter);
      if (!def?.model || def.hidden || def.enemy || def.shop) continue;
      const profile = {
        fighter,
        speed: Math.max(5.35, Math.min(6.35, Number(def.speed) || 5.9)),
        reach: Math.max(1.9, Math.min(2.65, Number(def.light?.range) || 2.1))
      };
      if (CHIEF_ONLY.has(fighter)) chief.set(fighter, profile);
      else if (OP_ONLY.has(fighter) || OP_EXCLUSIVE.has(fighter)) op.set(fighter, profile);
      else if (!def.special && !def.locked && !def.shardPrice) regular.set(fighter, profile);
    }
    rankedFighters = {
      regular,
      chief: new Map([...regular, ...chief]),
      op: new Map([...regular, ...op])
    };
  }
  return role === 'chief' ? rankedFighters.chief : role === 'op' ? rankedFighters.op : rankedFighters.regular;
}
async function rankedRoute(req,env,H,body,action) {
  if (!env.RANK_HUB || !env.RANK_DUEL || !env.LIMITER) return json(H,{error:'rank_unavailable'},503);
  const rate=action==='session'?30:action==='status'?420:100;
  if (await limited(env,req,'rank:'+action,rate,60000)) return json(H,{error:'limit'},429);
  if (action==='session') {
    if (!env.SYNC_LOCK || !env.PID_BIND || !env.PEPPER || !env.SIGN_PRIVATE_JWK) return json(H,{error:'rank_unavailable'},503);
    const me=await whoAmI(env,body.code,body.name);
    if (!me) return json(H,{error:'nosync'},403);
    const name=me.name.replace(/\p{Cf}/gu,'').trim() || '旅人';
    const auth = await verify(env, body.role, 'role');
    const role = auth?.r === 'chief' || auth?.r === 'op' ? auth.r : null;
    const expires = Math.min(Date.now() + 4 * 3600000, role ? auth.exp : Infinity);
    const fighters = [...rankedPool(role).keys()];
    const token = await sign(env, { t:'rank', p:me.pid, n:name, r:role, chief:role === 'chief', exp:expires });
    return json(H, { token, expires, fighters });
  }
  const credential=body.token ? await verify(env,body.token,'rank') : null;
  const pid=credential && PID_RE.test(credential.p) ? credential.p : null;
  if ((!pid && action!=='board') || (body.token && !pid)) return json(H,{error:'rank_session'},401);
  const data={pid};
  if (action==='join') {
    // V55.23 rank sessions carried a signed chief flag.
    const role = credential.r ?? (credential.chief === true ? 'chief' : null);
    const profile = rankedPool(role).get(body.fighter);
    if (!profile) return json(H,{error:'rank_fighter'},400);
    data.player={...profile,name:credential.n};
  }
  if (action==='join' || action==='status') data.bots=[...rankedPool().values()].slice(0,13);
  const response=await callRankHub(env,action,data);
  return json(H,await response.json(),response.status);
}

const guildStub = (env, gid) => env.GUILD.get(env.GUILD.idFromName('g:' + gid));
const boardStub = (env) => env.GUILD_BOARD.get(env.GUILD_BOARD.idFromName('board'));
async function doCall(stub, body) {
  const r = await stub.fetch('https://do/', { method: 'POST', body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

// ギルド操作：権限・存在・除名履歴はすべてギルドごとの Durable Object（直列実行）で判定
async function guildRoute(req, env, H, body, op) {
  if (await limited(env, req, 'guild', 90, 600000)) return json(H, { error: 'limit' }, 429);
  const me = await whoAmI(env, body.code, body.name);
  if (!me) return json(H, { error: 'nosync' }, 403);
  let gid = String(body.gid || '');
  if (op === 'create') {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    gid = [...crypto.getRandomValues(new Uint8Array(8))].map((x) => A[x % A.length]).join('');
  } else if (!GID_RE.test(gid)) return json(H, { error: 'bad' }, 400);
  const r = await doCall(guildStub(env, gid), {
    op, gid, me: { pid: me.pid, name: me.name },
    name: cleanTxt(body.gname, 16), target: String(body.target || ''), role: String(body.role || ''),
    heir: String(body.heir || ''), reason: cleanTxt(body.reason, 60)
  });
  if (r.data?.dissolved) await doCall(boardStub(env), { op: 'remove', gid });
  else if (op === 'create' && r.status === 200) await doCall(boardStub(env), { op: 'name', gid, gname: r.data.state?.name });
  return json(H, r.data, r.status);
}

// 寄付：同期セーブの灯晶を原子的に減らし、ギルドの累計に加算（失敗時は返金）
async function guildDonate(req, env, H, body) {
  if (await limited(env, req, 'donate', 20, 600000)) return json(H, { error: 'limit' }, 429);
  const me = await whoAmI(env, body.code, body.name);
  if (!me) return json(H, { error: 'nosync' }, 403);
  const gid = String(body.gid || '');
  const amt = Math.floor(+body.amount);
  // 寄付ごとの操作ID：端末が再送しても、各段階（減算・ギルド加算・ランキング）は一度しか反映しない
  const did = String(body.did || '');
  if (!GID_RE.test(gid) || !(amt > 0 && amt <= 1e7) || !/^[A-Za-z0-9_-]{12,40}$/.test(did)) return json(H, { error: 'bad' }, 400);
  const opKey = `don:${me.pid}:${did}`;
  const g = guildStub(env, gid);
  const sync = env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(me.h));
  const chk = await doCall(g, { op: 'get', gid, me: { pid: me.pid, name: me.name } });
  if (chk.status >= 500) return json(H, { error: 'server' }, 500);
  if (chk.status !== 200 || !chk.data?.state?.member) {
    // 減算後に脱退・除名されても、既存操作の結果確認・返金までは続ける。
    const prior = await doCall(sync, { op: 'spend-status', opId: opKey });
    if (prior.status !== 200) return json(H, { error: 'server' }, 500);
    if (!prior.data?.exists) return json(H, { error: 'denied' }, 403);
  }
  const sp = await sync.fetch('https://sync/', { method: 'POST', body: JSON.stringify({ op: 'spend', h: me.h, amt, gid, opId: opKey }) });
  const spent = await sp.json().catch(() => ({}));
  if (sp.status !== 200) return json(H, { error: spent.error || (sp.status >= 500 ? 'server' : 'shards') }, sp.status);
  const d = await doCall(g, { op: 'donate', gid, me: { pid: me.pid, name: me.name }, amt, opId: opKey, replayOnly: !!spent.legacy });
  // 旧版の減算記録にはギルド・金額がない。既に加算済みの結果確認だけ許し、新たな加算には使わない。
  if (spent.legacy) {
    if (d.status !== 200) return json(H, { error: d.status >= 500 ? 'server' : 'donation_legacy' }, d.status >= 500 ? 500 : 409);
    return json(H, { ok: true, dup: true, ver: spent.ver, shards: spent.shards, total: d.data.mine, state: d.data.state });
  }
  if (d.status !== 200) {
    // 5xx は加算の成否が不明なので同じIDで再送する。確定的な拒否だけ元の操作を返金済みにする。
    if (d.status >= 500) return json(H, { error: 'server' }, 500);
    const refund = await doCall(sync, { op: 'refund', gid, amt, opId: opKey });
    if (refund.status !== 200) return json(H, { error: 'server' }, 500);
    return json(H, { error: d.data?.error || 'denied' }, d.status);
  }
  const ranked = await doCall(boardStub(env), { op: 'add', gid, gname: d.data.state.name, amt, members: d.data.state.donors.length, opId: opKey });
  if (ranked.status !== 200) return json(H, { error: 'server' }, 500);
  return json(H, { ok: true, dup: !!spent.dup, ver: spent.ver, shards: spent.shards, total: d.data.mine, state: d.data.state });
}

// RF552_INFINITY_SERVER_RANKING_20261111
// Leaderboards require an existing bound sync-code identity; timestamps are server-owned.
// Combat is computed client-side, so server timing and sequential-floor checks
// reduce but cannot eliminate forged gameplay. This is a casual leaderboard.
// RF553_CHIEF_GLOBAL_CPU_20261111
async function rf553CpuGet(env){
 if(!env.STORE)return {ok:false,percent:100,updatedAt:0};
 const r=await storeCall(env,'rf553-cpu-global-20261111',{op:'cpu-get'});
 return r.status===200&&r.data?.ok?r.data:{ok:false,percent:100,updatedAt:0};
}
async function rf553CpuRoute(req,env,H,body){
 if(!env.STORE)return json(H,{error:'settings_unavailable'},503);
 if(body.action==='get'){
  if(await limited(env,req,'cpu-get',120,600000))return json(H,{error:'limit'},429);
  const r=await rf553CpuGet(env);
  return json(H,r,r.ok?200:503);
 }
 if(body.action!=='set')return json(H,{error:'bad'},400);
 const role=await verify(env,body.token,'role');
 if(role?.r!=='chief')return json(H,{error:'forbidden'},403);
 if(!Number.isSafeInteger(body.percent)||body.percent<1||body.percent>100)return json(H,{error:'bad_percent'},400);
 if(await limited(env,req,'cpu-set',30,600000))return json(H,{error:'limit'},429);
 const result=await storeCall(env,'rf553-cpu-global-20261111',{op:'cpu-set',percent:body.percent});
 return json(H,result.data,result.status);
}
async function rf552InfiniteRoute(req,env,H,body,op){
  if(!env.STORE)return json(H,{error:'leaderboard_unavailable'},503);
  if(await limited(env,req,'infinite-'+op,op==='board'?90:120,600000))return json(H,{error:'limit'},429);
  if(op==='board'){
    const r=await storeCall(env,'rf552-infinite-global',{op:'inf-board'});
    return json(H,r.data,r.status);
  }
  const me=await whoAmI(env,body.code,body.name);
  if(!me)return json(H,{error:'nosync',hint:'同期コードの登録が必要です'},403);
  const difficulty=await rf553CpuGet(env);
  if(!difficulty.ok)return json(H,{error:'settings_unavailable'},503);
  const r=await storeCall(env,'rf552-infinite-global',{
    op:'inf-'+op,pid:me.pid,name:cleanTxt(body.name,12),
    fighter:cleanTxt(body.fighter,32),runId:String(body.runId||''),floor:body.floor,
    cpuPercent:difficulty.percent
  });
  return json(H,r.data,r.status);
}

async function guildBoardRoute(req, env, H) {
  if (await limited(env, req, 'board', 60, 600000)) return json(H, { error: 'limit' }, 429);
  const r = await doCall(boardStub(env), { op: 'top' });
  return json(H, r.data, r.status);
}


// RF_ACTIVITY_24H_V18 — Country from trusted Cloudflare CF metadata; never record IP.
async function rfActivityPing(req, env, H, {code, name, shareRegion}) {
  if (await limited(env, req, 'activity-ping', 60, 600000)) return json(H,{error:'limit'},429);
  const me = await whoAmI(env, code, name);
  if (!me) return json(H,{error:'nosync'},403);
  const candidate = String(req.cf?.country || '').toUpperCase();
  const country = /^[A-Z]{2}$/.test(candidate) ? candidate : 'ZZ';
  // Store region and city only with explicit visitor consent. Never persist IP/GPS.
  const consent=shareRegion===true;
  const region=consent?cleanTxt(req.cf?.region||'',56):'';
  const regionCode=consent?cleanTxt(req.cf?.regionCode||'',16):'';
  const city=consent?cleanTxt(req.cf?.city||'',56):'';
  const r = await storeCall(env, 'chat-activity-v18', {op:'activity-ping', pid:me.pid, name:me.name, country,consent,region,regionCode,city});
  return json(H, r.data, r.status);
}
async function rfActivityList(req, env, H, {token}) {
  const role = await verify(env, token, 'role');
  if (role?.r !== 'chief' && role?.r !== 'op') return json(H,{error:'denied'},403);
  if (await limited(env, req, 'activity-list', 60, 600000)) return json(H,{error:'limit'},429);
  const r = await storeCall(env, 'chat-activity-v18', {op:'activity-list'});
  if (r.status !== 200) return json(H,{error:'server'},500);
  return json(H,{ok:true,users:r.data?.users || [],serverTime:Date.now()});
}

// チャンネル別ルーム：参加資格を確認した人にだけ、推測できないルーム名を渡す
async function chatRoom(req, env, H, { code, ch, token, name }) {
  if (await limited(env, req, 'room', 60, 600000)) return json(H, { error: 'limit' }, 429);
  const c = String(ch || '');
  let epoch = 0;
  if (c === 'staff') {
    const role = await verify(env, token, 'role');
    if (role?.r !== 'chief' && role?.r !== 'op') return json(H, { error: 'denied' }, 403);
  } else {
    const me = await whoAmI(env, code, name);
    if (!me) return json(H, { error: 'nosync' }, 403);
    if (c.startsWith('g:')) {
      const gid = c.slice(2);
      if (!GID_RE.test(gid)) return json(H, { error: 'bad' }, 400);
      const r = await doCall(guildStub(env, gid), { op: 'get', gid, me: { pid: me.pid, name: me.name } });
      if (!r.data?.state?.member) return json(H, { error: 'denied' }, 403);
      epoch = Math.max(0, Math.floor(+r.data.state.epoch || 0));
    } else if (/^dm:[A-Za-z0-9]{1,24}:[A-Za-z0-9]{1,24}$/.test(c)) {
      const [, a, b] = c.split(':');
      if (me.pid !== a && me.pid !== b) return json(H, { error: 'denied' }, 403);
    } else return json(H, { error: 'bad' }, 400);
  }
  // 運営会議は STAFF_EPOCH（秘密の環境変数）を変えると、全員のルーム名が切り替わる
  const salt = c === 'staff' ? String(env.STAFF_EPOCH || '0') : String(epoch);
  return json(H, { room: (await hmacHex(env.PEPPER, 'room:' + c + ':' + salt)).slice(0, 40), epoch });
}

// 運営長の公開署名：役職トークンそのものは配らず、内容(ハッシュ)に結びついた再利用不可の署名だけ渡す
async function chiefSign(req, env, H, { token, kind, h, at }) {
  if ((await verify(env, token, 'role'))?.r !== 'chief') return json(H, { error: 'denied' }, 403);
  if (await limited(env, req, 'csign', 60, 600000)) return json(H, { error: 'limit' }, 429);
  if (!['news', 'event'].includes(kind) || !HEX64.test(String(h)) || !(+at > 0 && +at <= Date.now() + 60000)) return json(H, { error: 'bad' }, 400);
  return json(H, { sig: await sign(env, { t: 'cpub', k: kind, h, at: +at, exp: Date.now() + 30 * DAY }) });
}
async function chiefEvent(req, env, H, { token, body, at }) {
  if ((await verify(env, token, 'role'))?.r !== 'chief') return json(H, { error: 'denied' }, 403);
  if (await limited(env, req, 'cevent', 20, 600000)) return json(H, { error: 'limit' }, 429);
  if (typeof body !== 'string' || body.length > 20000 || !(+at > 0 && +at <= Date.now() + 60000)) return json(H, { error: 'bad' }, 400);
  const sig = await sign(env, { t: 'cpub', k: 'event', h: await sha256(body), at: +at, exp: Date.now() + 30 * DAY });
  const r = await storeCall(env, 'chiefevent', { op: 'newer', v: { body, sig, at: +at } });
  return json(H, { ok: !!r.data?.ok, sig });
}
// 現在の運営長の特別イベント（誰でも取得可。受信側は sig を公開鍵で検証）
async function chiefCurrent(req, env, H) {
  if (await limited(env, req, 'ccur', 60, 600000)) return json(H, { error: 'limit' }, 429);
  const r = await storeCall(env, 'chiefevent', { op: 'get' });
  return json(H, { v: r.data?.v || null });
}

// ---------- 運営長のシステムメール・プレゼント ----------
// メール本文は MailStore、既読と受取記録は本人の SyncLock に保存する。
// 受取記録と灯晶・装備は同一トランザクションで確定するため、再送しても二重付与しない。
const MAIL_ID_RE = /^[0-9a-z]{10}_[0-9a-f]{32}$/;
const MAIL_REQUEST_RE = /^[A-Za-z0-9_-]{12,64}$/;
const MAIL_PAGE = 50;
const MAIL_MAX_SHARDS = 999999; // クライアントのセーブ上限と同じ。超過分を切り捨てない。
const MAIL_GROUP_MAX = 40;
// group recipient list is validated by a chief role token before storing; each player
// can only access messages explicitly indexed to their bound player ID.
function mailAllowed(message, pid) {
  return !!message && (message.recipient === 'all' || message.recipient === pid ||
    (message.recipient === 'group' && Array.isArray(message.recipients) && message.recipients.includes(pid)));
}

const MAIL_ITEM_IDS = new Set([...WEAPONS, ...ARMORS].map((x) => x.id));
const mailStub = (env) => env.MAIL_STORE.get(env.MAIL_STORE.idFromName('chief-mail-v1'));
const mailCursor = (value) => value == null || value === '' ? '' : typeof value === 'string' && MAIL_ID_RE.test(value) ? value : null;
function mailText(value, max) {
  if (typeof value !== 'string') return null;
  const s = value.replace(/\r\n?/g, '\n').normalize('NFC').trim();
  return s && [...s].length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s) ? s : null;
}
function mailGift(value) {
  if (value == null) return { shards: 0, items: [] };
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some((key) => !['shards', 'items'].includes(key))) return null;
  const shards = value.shards ?? 0, items = value.items ?? [];
  if (!Number.isSafeInteger(shards) || shards < 0 || shards > MAIL_MAX_SHARDS || !Array.isArray(items) || items.length > 10) return null;
  if (items.some((id) => typeof id !== 'string' || !MAIL_ITEM_IDS.has(id))) return null;
  return { shards, items: [...new Set(items)].sort() };
}
async function chiefMail(req, env, H, body, op) {
  if ((await verify(env, body.token, 'role'))?.r !== 'chief') return json(H, { error: 'denied' }, 403);
  if (!env.MAIL_STORE) return json(H, { error: 'mail_not_ready' }, 503);
  if (await limited(env, req, 'mail-' + op, op === 'send' ? 60 : 120, 3600000)) return json(H, { error: 'limit' }, 429);
  if (op === 'history') {
    const cursor = mailCursor(body.cursor);
    if (cursor === null) return json(H, { error: 'bad' }, 400);
    const r = await doCall(mailStub(env), { op, cursor });
    return json(H, r.data, r.status);
  }
  const requestId = body.requestId, recipient = body.recipient;
  const title = mailText(body.title, 80), text = mailText(body.body, 2000), gift = mailGift(body.gift);
  const expiresAt = body.expiresAt;
  const recipients = recipient === 'group' && Array.isArray(body.recipients) ? [...new Set(body.recipients)].sort() : [];
  if (typeof requestId !== 'string' || !MAIL_REQUEST_RE.test(requestId) ||
      typeof recipient !== 'string' || !(
        recipient === 'all' || recipient === 'group' || PID_RE.test(recipient)
      ) || (recipient === 'group' && (
        !Array.isArray(body.recipients) || !recipients.length || recipients.length > MAIL_GROUP_MAX ||
        body.recipients.length > MAIL_GROUP_MAX || recipients.some(id => typeof id !== 'string' || !PID_RE.test(id))
      )) || (recipient !== 'group' && body.recipients != null) ||
      !title || /\n/.test(title) || !text || !gift || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    return json(H, { error: 'bad' }, 400);
  }
  const targets = recipient === 'all' ? [] : recipient === 'group' ? recipients : [recipient];
  if (targets.length) {
    const found = await Promise.all(targets.map(pid =>
      doCall(env.PID_BIND.get(env.PID_BIND.idFromName(pid)), { op: 'lookup' }).then(r => ({ pid, ...r }))
    ));
    if (found.some(r => r.status !== 200)) return json(H, { error: 'server' }, 500);
    const missing = found.find(r => !r.data?.registered);
    if (missing) return json(H, { error: 'recipient_notfound', recipient: missing.pid }, 404);
  }
  const message = { recipient, ...(recipient === 'group' ? { recipients } : {}), title, body: text, gift, expiresAt, kind: gift.shards || gift.items.length ? 'gift' : 'system', senderName: '運営長' };
  const digest = await sha256(JSON.stringify(message));
  const r = await doCall(mailStub(env), { op, requestId, digest, message });
  return json(H, r.data, r.status);
}
async function playerMail(req, env, H, body, op) {
  if (!env.MAIL_STORE) return json(H, { error: 'mail_not_ready' }, 503);
  if (await limited(env, req, 'mail-user', 240, 600000)) return json(H, { error: 'limit' }, 429);
  const me = await whoAmI(env, body.code);
  if (!me) return json(H, { error: 'nosync' }, 403);
  const sync = env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(me.h));
  if (op === 'list') {
    const cursor = mailCursor(body.cursor);
    if (cursor === null) return json(H, { error: 'bad' }, 400);
    const r = await doCall(mailStub(env), { op, pid: me.pid, cursor });
    if (r.status !== 200) return json(H, r.data, r.status);
    const messages = r.data.messages;
    const state = await doCall(sync, { op: 'mail-state', pid: me.pid, ids: messages.map((m) => m.id) });
    if (state.status !== 200) return json(H, state.data, state.status);
    const states = state.data.states || {};
    return json(H, { ...r.data, pid: me.pid, messages: messages.map((m) => ({ ...m, ...(states[m.id] || { readAt: 0, claimedAt: 0 }) })) });
  }
  if (typeof body.id !== 'string' || !MAIL_ID_RE.test(body.id)) return json(H, { error: 'bad' }, 400);
  const r = await doCall(mailStub(env), { op: 'get', pid: me.pid, id: body.id });
  if (r.status !== 200) return json(H, r.data, r.status);
  const result = await doCall(sync, { op: 'mail-' + op, pid: me.pid, mail: r.data.message });
  return json(H, result.data, result.status);
}

// ---------- Durable Objects ----------
// pid ↔ 同期コードの固定（最初の1件だけ）
export class PidBind {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const { h, op } = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const cur = await this.state.storage.get('h');
      if (op === 'lookup') return new Response(JSON.stringify({ registered: !!cur }));
      if (typeof h !== 'string' || !HEX64.test(h)) return new Response('bad', { status: 400 });
      if (!cur) await this.state.storage.put('h', h);
      else if (cur !== h) return new Response('bound', { status: 409 });
      return new Response('ok');
    });
  }
}
// 配信済みメールは1件ずつ保存。全員宛と個別宛の索引から50件ずつページ取得する。
// 送信IDと本文ハッシュも原子的に保存し、通信切断後の同じ送信を重複配信しない。
export class MailStore {
  constructor(state) { this.state = state; }
  async fetch(req) {
    const b = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const storage = this.state.storage;
      const out = (v, status = 200) => new Response(JSON.stringify(v), { status });
      const now = Date.now();
      const view = (m, forPlayer = false) => {
        const safe = { ...m, expired: m.expiresAt <= now };
        if (forPlayer) delete safe.recipients; // group members' IDs are not exposed to other players
        return safe;
      };
      if(typeof b.op==='string'&&b.op.startsWith('castle-'))return rf50CastleHub(storage,b,now,out);
      if (b.op === 'send') {
        const prior = await storage.get('request:' + b.requestId);
        if (prior) {
          if (prior.digest !== b.digest) return out({ error: 'send_conflict' }, 409);
          const message = await storage.get('m:' + prior.id);
          if (!message) return out({ error: 'server' }, 500);
          return out({ ok: true, duplicate: true, id: message.id, message: view(message) });
        }
        if (!(b.message.expiresAt > now + 60000 && b.message.expiresAt <= now + 90 * DAY)) return out({ error: 'bad' }, 400);
        const id = now.toString(36).padStart(10, '0') + '_' + crypto.randomUUID().replace(/-/g, '');
        const message = { ...b.message, id, createdAt: now };
        const indexKeys = message.recipient === 'all' ? ['a:' + id]
          : (message.recipient === 'group' ? message.recipients : [message.recipient]).map(pid => 'p:' + pid + ':' + id);
        await writeTogether(storage, [
          ['m:' + id, message], ...indexKeys.map(key => [key, id]), ['request:' + b.requestId, { id, digest: b.digest }]
        ]);
        return out({ ok: true, duplicate: false, id, message: view(message) });
      }
      if (b.op === 'get') {
        const message = await storage.get('m:' + b.id);
        if (!message) return out({ error: 'notfound' }, 404);
        if (!mailAllowed(message, b.pid)) return out({ error: 'mail_recipient' }, 403);
        return out({ ok: true, message: view(message) });
      }
      if (b.op === 'list' || b.op === 'history') {
        const options = (prefix) => ({ prefix, reverse: true, limit: MAIL_PAGE + 1, ...(b.cursor ? { end: prefix + b.cursor } : {}) });
        let candidates;
        if (b.op === 'history') {
          candidates = [...(await storage.list(options('m:'))).values()];
        } else {
          const global = await storage.list(options('a:'));
          const personal = await storage.list(options('p:' + b.pid + ':'));
          const ids = [...new Set([...global.values(), ...personal.values()])];
          const rows = ids.length ? await storage.get(ids.map((id) => 'm:' + id)) : new Map();
          candidates = [...rows.values()].filter((m) => mailAllowed(m, b.pid));
        }
        candidates.sort((a, b) => a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
        const page = candidates.slice(0, MAIL_PAGE);
        return out({ ok: true, messages: page.map(m => view(m, b.op === 'list')), nextCursor: candidates.length > MAIL_PAGE ? page.at(-1).id : null, serverTime: now });
      }
      return out({ error: 'bad' }, 400);
    });
  }
}
// ギルド1つ分の状態（メンバー・役職・除名履歴・寄付）
const G_RANK = { master: 3, sub: 2, officer: 1, member: 0 };
export class GuildLock {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const b = await req.json();
    return this.state.blockConcurrencyWhile(() => this.run(b));
  }
  view(g, pid) {
    const mine = ownValue(g.members, pid);
    const member = !!mine;
    const myRank = member ? G_RANK[mine.role] : -1;
    const ban = ownValue(g.bans, pid);
    return {
      gid: g.gid, name: g.name, master: g.master, ver: g.ver, member,
      // チャット鍵の世代：脱退・除名のたびに進み、抜けた人が持つ古いルーム名を無効にする
      epoch: member ? g.epoch || 0 : undefined,
      members: member ? Object.entries(g.members).map(([p, m]) => ({ pid: p, name: m.name, role: m.role })) : [],
      bans: myRank >= 2 ? Object.entries(g.bans).map(([p, x]) => ({ pid: p, name: x.name, by: x.by, reason: x.reason, at: x.at })) : [],
      donors: Object.entries(g.donors).map(([p, x]) => ({ pid: p, name: x.name, total: x.total })).filter((x) => x.total > 0).sort((a, c) => c.total - a.total).slice(0, 100),
      kicked: !member && ban ? { by: ban.by, reason: ban.reason, at: ban.at } : null
    };
  }
  async run(b) {
    const S = this.state.storage;
    const out = (body, status = 200) => new Response(JSON.stringify(body), { status });
    let g = await S.get('g');
    const me = b.me;
    const save = async () => { g.ver = (g.ver || 0) + 1; await S.put('g', g); };
    if (b.op === 'create') {
      if (g) return out({ error: 'exists' }, 409);
      if (!b.name) return out({ error: 'bad' }, 400);
      g = { gid: b.gid, name: b.name, master: me.pid, members: { [me.pid]: { name: me.name, role: 'master', at: Date.now() } }, bans: {}, donors: {}, ver: 0 };
      await save();
      return out({ state: this.view(g, me.pid) });
    }
    if (!g) return out({ error: 'notfound' }, 404);
    const mine = ownValue(g.members, me.pid);
    if (mine && mine.name !== me.name) mine.name = me.name;
    switch (b.op) {
      case 'get':
        return out({ state: this.view(g, me.pid) });
      case 'join': {
        if (ownValue(g.bans, me.pid)) return out({ error: 'banned', state: this.view(g, me.pid) }, 403);
        if (!mine) {
          if (Object.keys(g.members).length >= 100) return out({ error: 'full' }, 409);
          g.members[me.pid] = { name: me.name, role: 'member', at: Date.now() };
          await save();
        }
        return out({ state: this.view(g, me.pid) });
      }
      case 'leave': {
        if (!mine) return out({ state: this.view(g, me.pid) });
        const others = Object.keys(g.members).filter((p) => p !== me.pid);
        if (g.master === me.pid) {
          if (!others.length) {
            await S.deleteAll();
            return out({ dissolved: true });
          }
          if (!others.includes(b.heir)) return out({ error: 'heir' }, 400);
          g.master = b.heir;
          g.members[b.heir].role = 'master';
        }
        delete g.members[me.pid];
        g.epoch = (g.epoch || 0) + 1;
        await save();
        return out({ state: this.view(g, me.pid), heir: g.master });
      }
      case 'role': {
        const tgt = ownValue(g.members, b.target);
        const role = b.role;
        if (!mine || !tgt || b.target === me.pid || !['master', 'sub', 'officer', 'member', 'kick'].includes(role)) return out({ error: 'denied' }, 403);
        const r = G_RANK[mine.role];
        const tr = G_RANK[tgt.role];
        const ok = r === 3 || (r === 2 && tr < 2 && ['officer', 'member', 'kick'].includes(role));
        if (!ok) return out({ error: 'denied' }, 403);
        if (role === 'kick') {
          g.bans[b.target] = { name: tgt.name, by: me.name, reason: b.reason || '', at: Date.now() };
          delete g.members[b.target];
          g.epoch = (g.epoch || 0) + 1;
        } else if (role === 'master') {
          mine.role = 'sub';
          tgt.role = 'master';
          g.master = b.target;
        } else tgt.role = role;
        await save();
        return out({ state: this.view(g, me.pid) });
      }
      case 'unban': {
        if (!mine || G_RANK[mine.role] < 2 || !ownValue(g.bans, b.target)) return out({ error: 'denied' }, 403);
        delete g.bans[b.target];
        await save();
        return out({ state: this.view(g, me.pid) });
      }
      case 'donate': {
        const receiptKey = 'don:' + b.opId;
        const done = b.opId ? await S.get(receiptKey) : null;
        // 個別の操作記録は切り捨てない。古いIDでも再加算せず、旧版の記録も引き継ぐ。
        if (done && (done.pid !== me.pid || done.amt !== b.amt)) return out({ error: 'donation_mismatch' }, 409);
        if (done?.denied) return out({ error: 'denied' }, 403);
        if (done || (b.opId && Array.isArray(g.ops) && g.ops.includes(b.opId))) {
          return out({ state: this.view(g, me.pid), mine: ownValue(g.donors, me.pid)?.total || 0, dup: true });
        }
        if (b.replayOnly) return out({ error: 'donation_legacy' }, 409);
        if (!mine) {
          // 拒否も固定し、別の再送が返金と交差して後から加算されるのを防ぐ。
          await S.put(receiptKey, { pid: me.pid, amt: b.amt, denied: true });
          return out({ error: 'denied' }, 403);
        }
        const d = ownValue(g.donors, me.pid) || (g.donors[me.pid] = { name: me.name, total: 0 });
        d.name = me.name;
        d.total += Math.floor(+b.amt) || 0;
        g.ver = (g.ver || 0) + 1;
        await writeTogether(S, [['g', g], [receiptKey, { pid: me.pid, amt: b.amt }]]);
        return out({ state: this.view(g, me.pid), mine: d.total });
      }
      default:
        return out({ error: 'bad' }, 400);
    }
  }
}
// 全ギルドの寄付総額（サーバー側で集計し、上位だけ返す）
export class GuildBoard {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const b = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const storage = this.state.storage;
      const m = (await storage.get('b')) || {};
      if (b.op === 'top') {
        const list = Object.entries(m).map(([gid, x]) => ({ gid, gname: x.gname, total: x.total, members: x.members })).filter((x) => x.total > 0).sort((a, c) => c.total - a.total).slice(0, 50);
        return new Response(JSON.stringify({ list }));
      }
      if (b.op === 'add') {
        const receiptKey = 'don:' + b.opId;
        const done = b.opId ? await storage.get(receiptKey) : null;
        const oldOps = (await storage.get('ops')) || [];
        if (done && (done.gid !== b.gid || done.amt !== b.amt)) return new Response(JSON.stringify({ error: 'donation_mismatch' }), { status: 409 });
        if (done || (b.opId && oldOps.includes(b.opId))) return new Response(JSON.stringify({ ok: true, dup: true }));
        m[b.gid] = { gname: b.gname, total: (ownValue(m, b.gid)?.total || 0) + b.amt, members: b.members };
        await writeTogether(storage, [['b', m], [receiptKey, { gid: b.gid, amt: b.amt }]]);
        return new Response(JSON.stringify({ ok: true }));
      }
      else if (b.op === 'name' && ownValue(m, b.gid)) m[b.gid].gname = b.gname;
      else if (b.op === 'remove') delete m[b.gid];
      await storage.put('b', m);
      return new Response(JSON.stringify({ ok: true }));
    });
  }
}
// 招待コード1件（コードのハッシュごとに1インスタンス）。状態：未発行 → valid → used
export class InviteLock {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const { op } = await req.json();
    // DOは1インスタンスで直列実行 → 同時に2回使われても成功は1回だけ
    return this.state.blockConcurrencyWhile(async () => {
      const st = await this.state.storage.get('st');
      if (op === 'issue') {
        if (st) return new Response('exists', { status: 409 });
        await this.state.storage.put('st', 'valid');
        await this.state.storage.put('at', Date.now());
        return new Response('ok');
      }
      if (st !== 'valid') return new Response('used or invalid', { status: 409 });
      await this.state.storage.put('st', 'used');
      await this.state.storage.put('usedAt', Date.now());
      return new Response('ok');
    });
  }
}
// 汎用の小さな保存領域（購入記録・決済の重複防止・運営長の特別イベント）
export class Store {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const b = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const s = this.state.storage;
      const cur = await s.get('v');
      const out = (x, status = 200) => new Response(JSON.stringify(x), { status });
      switch (b.op) {
        case 'rf-chunk-put': {
          if(!Number.isSafeInteger(b.index)||b.index<0||!Number.isSafeInteger(b.total)||b.total<1||b.index>=b.total||
             !Number.isSafeInteger(b.revision)||b.revision<0||!b.overrides||typeof b.overrides!=='object')return out({error:'bad'},400);
          const meta=await s.get('rf:meta');
          if(meta&&(meta.sealed||meta.total!==b.total||meta.revision!==b.revision))return out({error:'batch_conflict'},409);
          const current=meta||{total:b.total,revision:b.revision,sealed:false,nextIndex:0};
          const nextIndex=current.nextIndex||0;
          // Sequential writes make commit verification O(1), regardless of snapshot size.
          if(b.index>nextIndex)return out({error:'out_of_order'},409);
          const path='rf:part:'+b.index;
          if(b.index<nextIndex){
            const prev=await s.get(path);
            return prev&&JSON.stringify(prev)===JSON.stringify(b.overrides)?out({ok:true,duplicate:true}):out({error:'chunk_conflict'},409);
          }
          const prev=await s.get(path);
          if(prev&&JSON.stringify(prev)!==JSON.stringify(b.overrides))return out({error:'chunk_conflict'},409);
          if(!prev)await s.put(path,b.overrides);
          await s.put('rf:meta',{...current,nextIndex:b.index+1});
          return out({ok:true});
        }
        case 'rf-ready': {
          const meta=await s.get('rf:meta');
          if(!meta||meta.total!==b.total||meta.revision!==b.revision)return out({error:'batch_conflict'},409);
          if(meta.nextIndex!==meta.total)return out({error:'incomplete'},409);
          if(!meta.sealed)await s.put('rf:meta',{...meta,sealed:true});
          return out({ok:true,total:meta.total});
        }
        case 'rf-chunk-get': {
          const meta=await s.get('rf:meta');
          if(!meta?.sealed||!Number.isSafeInteger(b.index)||b.index<0||b.index>=meta.total)return out({error:'missing'},404);
          const data=await s.get('rf:part:'+b.index);
          return data?out({ok:true,overrides:data}):out({error:'missing'},404);
        }
        case 'rf-revision-cas': {
          const last=Number(cur?.rev)||0;
          if(last!==b.revision)return out({error:'stale',revision:last},409);
          if(!/^[0-9a-f]{32}$/.test(String(b.ref||''))||!Number.isSafeInteger(b.total)||b.total<1)return out({error:'bad'},400);
          const timestamp=Math.max(Date.now(),(Number(cur?.at)||0)+1);
          await s.put('v',{rev:last+1,at:timestamp,ref:b.ref,chunks:b.total});
          return out({ok:true,revision:last+1,updatedAt:timestamp,previousRef:cur?.ref||null});
        }
        case 'rf-schedule-expiry': {
          const meta=await s.get('rf:meta');if(!meta?.sealed)return out({error:'bad'},409);
          const when=Date.now()+Math.max(60000,Math.min(86400000,Number(b.ms)||1800000));
          await s.put('rf:expires',when);await s.setAlarm(when);
          return out({ok:true});
        }
        case 'cpu-get': {
          const value=Number(cur?.percent);
          const percent=Number.isSafeInteger(value)&&value>=1&&value<=100?value:100;
          return out({ok:true,percent,updatedAt:Number(cur?.updatedAt)||0});
        }
        case 'cpu-set': {
          if(!Number.isSafeInteger(b.percent)||b.percent<1||b.percent>100)return out({error:'bad_percent'},400);
          const next={percent:b.percent,updatedAt:Date.now()};
          await s.put('v',next);
          return out({ok:true,...next});
        }
        case 'get':
          return out({ v: cur ?? null });
        case 'activity-ping': {
          const now=Date.now(),cut=now-86400000;
          const rows=(Array.isArray(cur)?cur:[]).filter(p=>p && /^[A-Za-z0-9]{1,24}$/.test(String(p.pid||'')) && Number(p.lastAt)>cut);
          const pid=String(b.pid||'');
          if (!/^[A-Za-z0-9]{1,24}$/.test(pid)) return out({error:'bad'},400);
          const name=String(b.name||'旅人').slice(0,12).replace(/[\u0000-\u001f<>]/g,'');
          const country=/^[A-Z]{2}$/.test(b.country)?b.country:'ZZ';
          const prior=rows.find(x=>x.pid===pid);
          // Withdrawn consent removes the previously recorded city on the next ping.
          const location=b.consent===true?{consent:true,region:String(b.region||'').slice(0,56),regionCode:String(b.regionCode||'').slice(0,16),city:String(b.city||'').slice(0,56)}:{consent:false,region:'',regionCode:'',city:''};
          if(prior)Object.assign(prior,{name,country,lastAt:now},location);
          else rows.push({pid,name,country,firstAt:now,lastAt:now,...location});
          rows.sort((a,b)=>b.lastAt-a.lastAt);
          if(rows.length>500)rows.length=500;
          await s.put('v',rows);
          await s.setAlarm(now+3600000);
          return out({ok:true});
        }
        case 'activity-list': {
          const now=Date.now(),cut=now-86400000;
          const rows=(Array.isArray(cur)?cur:[]).filter(p=>p && Number(p.lastAt)>cut).slice(0,500);
          if(rows.length !== (Array.isArray(cur)?cur.length:0))await s.put('v',rows);
          return out({ok:true,users:rows});
        }

        case 'inf-start': {
          const pid=String(b.pid||'');
          if(!/^[A-Za-z0-9]{1,24}$/.test(pid))return out({error:'bad'},400);
          const now=Date.now(),runId=crypto.randomUUID();
          const session={runId,pid,name:String(b.name||'旅人').slice(0,12),fighter:String(b.fighter||'').slice(0,32),startedAt:now,lastAt:now,completedFloor:0,
            cpuPercent:Number.isSafeInteger(b.cpuPercent)?b.cpuPercent:100,rankable:b.cpuPercent===100};
          await s.put('inf:run:'+pid,session);
          return out({ok:true,runId,startedAt:now});
        }
        case 'inf-progress': {
          const pid=String(b.pid||'');const session=await s.get('inf:run:'+pid);
          if(!session||session.runId!==b.runId||!Number.isSafeInteger(b.floor)||b.floor!==session.completedFloor+1)return out({error:'stale_floor'},409);
          const now=Date.now();
          if(now-session.startedAt>12*3600000)return out({error:'expired'},409);
          // At least one real second per cleared floor, including transitions.
          if(now-session.startedAt<b.floor*1000)return out({error:'too_fast'},429);
          session.completedFloor=b.floor;session.lastAt=now;
          if(b.cpuPercent!==session.cpuPercent||b.cpuPercent!==100)session.rankable=false;
          await s.put('inf:run:'+pid,session);
          return out({ok:true,completedFloor:b.floor});
        }
        case 'inf-finish': {
          const pid=String(b.pid||''),session=await s.get('inf:run:'+pid);
          if(!session||session.runId!==b.runId)return out({error:'no_run'},409);
          const now=Date.now(),timeMs=Math.max(1000,now-session.startedAt);
          const completedFloor=session.completedFloor;
          await s.delete('inf:run:'+pid);
          if(!completedFloor)return out({ok:true,recorded:false});
          if(session.rankable===false||session.cpuPercent!==100||b.cpuPercent!==100)
            return out({ok:true,recorded:false,reason:'cpu_difficulty_practice',cpuPercent:session.cpuPercent});
          const item={pid,name:session.name||'旅人',fighter:session.fighter||'',floor:completedFloor,timeMs,at:now};
          const old=await s.get('inf:board');const rows=Array.isArray(old)?old.filter(x=>x&&x.pid!==pid):[];
          const prior=Array.isArray(old)?old.find(x=>x?.pid===pid):null;
          const best=prior&&(
            prior.floor>item.floor||(prior.floor===item.floor&&prior.timeMs<=item.timeMs)
          )?prior:item;
          rows.push(best);
          rows.sort((a,b)=>b.floor-a.floor||a.timeMs-b.timeMs||a.at-b.at);
          if(rows.length>100)rows.length=100;
          await s.put('inf:board',rows);
          return out({ok:true,recorded:true,rank:rows.findIndex(r=>r.pid===pid)+1,best});
        }
        case 'inf-board': {
          const rows=await s.get('inf:board');
          return out({ok:true,rows:(Array.isArray(rows)?rows:[]).slice(0,100).map((r)=>({name:r.name,floor:r.floor,timeMs:r.timeMs,at:r.at}))});
        }
        case 'once': // 初回だけ成功（Stripe の同じ決済を二重に処理しない）
          if (cur) return out({ ok: false }, 409);
          await s.put('v', true);
          return out({ ok: true });
        case 'add': {
          const l = Array.isArray(cur) ? cur : [];
          if (!l.includes(b.item)) l.push(b.item);
          await s.put('v', l);
          return out({ v: l });
        }
        case 'newer': // 日時が新しい時だけ置き換える
          if (cur && +cur.at >= +b.v?.at) return out({ ok: false });
          await s.put('v', b.v);
          return out({ ok: true });
        default:
          return out({ error: 'bad' }, 400);
      }
    });
  }
  async alarm() {
    const store=this.state.storage;
    const expiry=await store.get('rf:expires');
    if(Number(expiry)>0){
      if(Date.now()>=Number(expiry))await store.deleteAll();
      else await store.setAlarm(Number(expiry));
      return;
    }
    const rows=await store.get('v');
    if(!Array.isArray(rows)||!rows.every(x=>x&&typeof x.pid==='string'&&typeof x.lastAt==='number'))return;
    const recent=rows.filter(x=>x.lastAt>Date.now()-86400000);
    if(recent.length){await store.put('v',recent);await store.setAlarm(Date.now()+3600000);}
    else await store.delete('v');
  }

}
// 同期セーブ（同期コードのハッシュごとに1インスタンス）：保存・版番号の比較・資産の増え方の検証
export class SyncLock {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const { data, base, op, amt, gid, opId, wid, pid, mail, ids, style, lord, raidId, amount, castleName, count, maxAffordable, floor, boss } = await req.json();
    return this.state.blockConcurrencyWhile(async () => {
      const store = this.state.storage;
      const row = (await store.get('row')) || null;
      const res = (x, status = 200) => new Response(JSON.stringify(x), { status });
      if (op === 'get') return res({ row });
      if(typeof op==='string'&&op.startsWith('castle-'))return rf50Wallet(store,row,res,{op,pid,style,lord,raidId,amount,castleName,count,maxAffordable,floor,boss});
            // RF48: purchase and debit are a single durable-object transaction.
            if(op==='minamoto-owned')return res({owned:!!(await store.get('purchase:minamoto_yoritomo'))});
            if(op==='minamoto-buy'){
              let sv;try{sv=JSON.parse(row?.data||'null');}catch{sv=null;}
              if(!sv||!PID_RE.test(String(pid||''))||sv.pid!==pid)return res({error:'nosync'},403);
              if(await store.get('purchase:minamoto_yoritomo'))return res({ok:true,already:true,data:row.data,ver:row.ver,shards:sv.shards});
              if(!Number.isSafeInteger(sv.shards)||sv.shards<0)return res({error:'bad_balance'},422);
              if(sv.shards<100000)return res({error:'shards'},402);
              sv.shards-=100000;
              sv.gemChars=[...new Set([...(Array.isArray(sv.gemChars)?sv.gemChars:[]),'minamoto_yoritomo'])];
              const ver=(row.ver||0)+1,now=Date.now(),serialized=JSON.stringify(sv);
              if(serialized.length>200000)return res({error:'size'},413);
              await writeTogether(store,[
                ['row',{...row,data:serialized,ver,at:now,wealth:wealthOf(sv),wid:''}],
                ['purchase:minamoto_yoritomo',{at:now,pid,paid:100000,ver}]
              ]);
              return res({ok:true,data:serialized,ver,shards:sv.shards});
            }
      if (['mail-state', 'mail-read', 'mail-claim'].includes(op)) {
        let save;
        try { save = JSON.parse(row?.data || 'null'); } catch { save = null; }
        if (!save || typeof pid !== 'string' || save.pid !== pid || !PID_RE.test(pid)) return res({ error: 'nosync' }, 403);
        if (op === 'mail-state') {
          if (!Array.isArray(ids) || ids.length > MAIL_PAGE || ids.some((id) => typeof id !== 'string' || !MAIL_ID_RE.test(id))) return res({ error: 'bad' }, 400);
          const keys = ids.flatMap((id) => ['mail:read:' + id, 'mail:claim:' + id]);
          const saved = keys.length ? await store.get(keys) : new Map();
          return res({ ok: true, states: Object.fromEntries(ids.map((id) => [id, {
            readAt: saved.get('mail:read:' + id) || 0,
            claimedAt: saved.get('mail:claim:' + id)?.claimedAt || 0
          }])) });
        }
        if (!mail || !MAIL_ID_RE.test(String(mail.id || '')) || !mailAllowed(mail, pid)) return res({ error: 'mail_recipient' }, 403);
        const readKey = 'mail:read:' + mail.id;
        const readAt = (await store.get(readKey)) || Date.now();
        if (op === 'mail-read') {
          await store.put(readKey, readAt);
          return res({ ok: true, id: mail.id, readAt });
        }
        const receiptKey = 'mail:claim:' + mail.id;
        const prior = await store.get(receiptKey);
        // 過去の残高ではなく最新セーブを返す。再送が遅れても、その後の消費や別の受取を戻さない。
        if (prior) return res({ ok: true, id: mail.id, pid, duplicate: true, receipt: prior, data: row.data, ver: row.ver, shards: save.shards });
        if (!(Number.isSafeInteger(mail.expiresAt) && mail.expiresAt > Date.now())) return res({ error: 'expired' }, 410);
        const gift = mailGift(mail.gift);
        if (!gift || (!gift.shards && !gift.items.length)) return res({ error: 'no_gift' }, 409);
        const current = save.shards;
        if (!Number.isSafeInteger(current) || current < 0) return res({ error: 'wealth' }, 422);
        if (current + gift.shards > MAIL_MAX_SHARDS) return res({ error: 'wallet_full' }, 409);
        const owned = new Set(Array.isArray(save.owned) ? save.owned : []);
        const awarded = gift.items.filter((id) => !owned.has(id));
        awarded.forEach((id) => owned.add(id));
        const now = Date.now(), ver = (row.ver || 0) + 1;
        save.shards = current + gift.shards;
        save.owned = [...owned];
        save.syncAt = now;
        const serialized = JSON.stringify(save);
        if (serialized.length > 200000) return res({ error: 'too large' }, 413);
        const receipt = { id: mail.id, shards: gift.shards, items: awarded, claimedAt: now, ver };
        await writeTogether(store, [
          ['row', { ...row, data: serialized, ver, wealth: wealthOf(save), wid: '' }],
          [receiptKey, receipt], [readKey, readAt]
        ]);
        return res({ ok: true, id: mail.id, pid, duplicate: false, receipt, data: serialized, ver, shards: save.shards });
      }
      if (op === 'spend-status') return res({ exists: typeof opId === 'string' && !!(await store.get('op:' + opId)) });
      if (op === 'spend' || op === 'refund') {
        // 操作IDは金額とギルドに固定し、返金も元の記録と一緒に確定する。
        const okId = typeof opId === 'string' && /^[A-Za-z0-9:_-]{8,80}$/.test(opId);
        const a = Math.floor(+amt);
        if (!okId || !GID_RE.test(String(gid || '')) || !Number.isSafeInteger(a) || a <= 0 || a > 1e7) return res({ error: 'bad' }, 400);
        const receiptKey = 'op:' + opId;
        const done = await store.get(receiptKey);
        if (done) {
          if (done.gid === undefined || done.amt === undefined) {
            // 旧版の返金記録も確認し、返金後の減算済み記録を再利用させない。
            if (await store.get('op:r:' + opId)) return res({ error: 'donation_refunded' }, 409);
            if (op === 'refund') return res({ error: 'donation_legacy' }, 409);
            return res({ ...done, dup: true, legacy: true });
          }
          if (done.gid !== gid || done.amt !== a) return res({ error: 'donation_mismatch' }, 409);
          if (op === 'spend') {
            if (done.refunded) return res({ error: 'donation_refunded' }, 409);
            return res({ ...done, dup: true });
          }
          if (done.refunded) return res({ ok: true, refunded: true, dup: true, ver: done.refundVer, shards: done.refundShards });
        }
        if (op === 'refund' && !done) return res({ error: 'bad' }, 409);
        let s;
        try { s = JSON.parse(row?.data || 'null'); } catch { s = null; }
        if (!s) return res({ error: 'nosync' }, 404);
        const cur = Math.max(0, Math.floor(+s.shards || 0));
        if (!Number.isSafeInteger(cur)) return res({ error: 'wealth' }, 422);
        if (op === 'spend' && cur < a) return res({ error: 'shards' }, 402);
        s.shards = op === 'refund' ? cur + a : cur - a;
        const nv = (row.ver || 0) + 1;
        const result = { ok: true, ver: nv, shards: s.shards, gid, amt: a, ...(op === 'refund' ? { refunded: true } : {}) };
        const receipt = op === 'refund' ? { ...done, refunded: true, refundVer: nv, refundShards: s.shards } : result;
        await writeTogether(store, [
          ['row', { ...row, data: JSON.stringify(s), ver: nv, wealth: wealthOf(s), wid: '' }],
          [receiptKey, receipt]
        ]);
        return res(result);
      }
      if (!validateSaveShape(data) || !Number.isSafeInteger(base) || base < 0) return res({ error: 'bad' }, 400);
      const ver = row?.ver || 0;
      const myWid = typeof wid === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(wid) ? wid : '';
            // RF48: restore purchased status exclusively from server receipt.
      if(data&&typeof data==='object'&&!Array.isArray(data)){
        const owned=!!(await store.get('purchase:minamoto_yoritomo'));
        const prev=Array.isArray(data.gemChars)?data.gemChars:[];
        const keep=prev.filter(k=>k!=='minamoto_yoritomo');
        data.gemChars=owned?[...new Set([...keep,'minamoto_yoritomo'])]:keep;
      }
      const payload = JSON.stringify(data);
      const digest = myWid ? await sha256(JSON.stringify([base, data])) : '';
      const writeKey = 'write:' + myWid;
      const applied = myWid ? await store.get(writeKey) : null;
      if (applied) {
        // 同じIDで内容を変えると、元の成功を別のデータへの成功と誤認するため拒否する。
        if (applied.digest !== digest) return res({ error: 'wid' }, 400);
        if (row && applied.ver === ver && row.wid === myWid) return res({ ok: true, ver, dup: true });
        // 寄付・他端末の保存などが後続した場合も、元の保存が反映済みだと伝える。
        return res({ conflict: true, data: row?.data || null, ver, wid: row?.wid || '', appliedWid: myWid }, 409);
      }
      if (row && myWid && row.wid === myWid) {
        // 旧版の最新書き込みにも内容チェックを行い、操作記録を補う。
        if (payload !== row.data || base !== ver - 1) return res({ error: 'wid' }, 400);
        await store.put(writeKey, { digest, ver });
        return res({ ok: true, ver, dup: true });
      }
      if (row && base !== ver) {
        // 競合：別の端末が先に更新した → 最新を返し、端末側で合流させる
        return res({ conflict: true, data: row.data, ver, wid: row.wid || '' }, 409);
      }
      const now = Date.now();
      const wealth = wealthOf(data);
      if (!Number.isFinite(wealth) || (!row && wealth > FIRST_WEALTH_CAP)) return res({ error: 'wealth' }, 422);
      let allow = EARN_SLACK;
      if (row) {
        // 許容量は「実際に経過した時間」だけ回復し、使った分は保存して持ち越す
        const prevW = row.wealth ?? wealth;
        const rate = EARN_PER_HOUR + prevW * 0.1; // 1時間あたりの回復量
        const hours = Math.max(0, (now - (row.at || now)) / 3600000);
        const credit = Math.min(rate * 6 + EARN_SLACK, (row.allow ?? EARN_SLACK) + rate * hours);
        const growth = wealth - prevW;
        if (growth > credit) return res({ error: 'wealth' }, 422);
        allow = credit - Math.max(0, growth);
      }
      const nv = ver + 1;
      // セーブ本体と再送判定用記録は値の形が異なるが、同じトランザクションで保存する。
      /** @type {Array<[string, unknown]>} */
      const writes = [['row', { data: payload, at: now, ver: nv, wealth, allow, wid: myWid }]];
      if (myWid) writes.push([writeKey, { digest, ver: nv }]);
      await writeTogether(store, writes);
      return res({ ok: true, ver: nv });
    });
  }
}
export class Limiter {
  constructor(state) {
    this.state = state;
  }
  async fetch(req) {
    const { max, windowMs } = await req.json();
    const now = Date.now();
    const list = ((await this.state.storage.get('t')) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return new Response('limit', { status: 429 });
    list.push(now);
    await this.state.storage.put('t', list);
    return new Response('ok');
  }
}

// RF_VALGARD2_SERVER_20261108
if(FIGHTERS.valgard){const base=FIGHTERS.valgard;base.form2='valgard2';FIGHTERS.valgard2={...base,name:'ヴァルガルド・第二形態',model:'assets/models/iron-warlord-f2.glb',form2:null,hidden:true,locked:true,special:'chief',skills:base.skills,over:base.over}}

// RF_NEPT_V1_DEFINITION - new original chief-only water sovereign.
FIGHTERS.nepterion = {
  name: '蒼海神皇ネプテリオン', title: '全海域を統べる原初水神（運営長専用）',
  model: 'assets/models/nepterion-chief.glb',
  face: 'assets/portraits/nepterion.svg',
  color: 0x35cfff, tint: null, attribute: '水', element: 7,
  height: 4.65, hp: 52000, speed: 9.3, overGain: 3.4,
  power: 3.65, armor: 0.22, fluxMul: 3.9, supreme: true,
  locked: true, special: 'chief',
  light: { dmg: 185, range: 4.4, shots: 5, color: 0x6bf0ff },
  skills: [
    {name:'蒼帝海刃《アクア・レギオン》',kind:'projectile',visual:'spear',cost:12,castTime:0.35,count:8,spreadAng:0.12,chain:0.035,dmg:320,speed:34,radius:1.22,elem:7,color:0x55e9ff,vivid:true},
    {name:'蒼潮瞬穿《タイダル・ブレイカー》',kind:'dash',cost:13,castTime:0.26,dmg:1320,speed:32,dur:0.48,elem:7,color:0x27baff,vivid:true},
    {name:'海神圧界《アビス・インパクト》',kind:'shockwave',cost:18,castTime:0.80,dmg:1680,radius:10.6,elem:7,color:0x4be8ff,vivid:true},
    {name:'零式禁水呪《深淵千海葬》',kind:'judgment',visual:'pillar',finalVisual:'nova',cost:28,castTime:1.85,count:10,spread:6.3,radius:2.65,dmg:960,delay:0.38,interval:0.075,finalDmg:3300,finalRadius:11.8,elem:7,color:0x75f9ff,vivid:true},
    {name:'聖潮再生《エターナル・オーシャン》',kind:'heal',cost:10,castTime:0.60,heal:999999,radius:13.0,elem:7,color:0xa6fcff,vivid:true},
    {name:'蒼龍水星《レヴィアサン・レイン》',kind:'rain',visual:'meteor',cost:20,castTime:1.25,count:9,spread:5.5,radius:2.6,dmg:870,delay:0.35,interval:0.07,elem:7,color:0x2acbff,vivid:true},
    {name:'原海収束《タイダル・シンギュラリティ》',kind:'implode',cost:18,castTime:1.05,dmg:1950,radius:11.2,elem:7,color:0x365dff,vivid:true},
    {name:'滄天砲《ネプトゥーン・カノン》',kind:'projectile',visual:'orb',cost:16,castTime:0.55,count:10,spreadAng:0.11,chain:0.035,dmg:500,speed:37,radius:1.6,elem:7,color:0x86efff,vivid:true},
    {name:'双極海神輪《二重大潮》',kind:'shockwave',cost:22,castTime:1.20,dmg:1850,radius:11.4,double:true,elem:7,color:0x58dfff,vivid:true},
    {name:'大禁呪《青き終海の審判》',kind:'judgment',visual:'nova',finalVisual:'pillar',cost:32,castTime:2.15,count:10,spread:6.7,radius:2.65,dmg:1250,delay:0.42,interval:0.072,finalDmg:3950,finalRadius:12.2,elem:7,color:0x87feff,vivid:true},
    {name:'万潮滅界《オメガ・ディルーヴィオ》',kind:'rain',visual:'pillar',cost:27,castTime:1.9,count:10,spread:6.9,radius:2.7,dmg:1060,delay:0.34,interval:0.07,elem:7,color:0x55baff,vivid:true}
  ],
  // K/U buttons cycle spells; H uses the dedicated complete recovery at skill[4].
  pool: [0,1,2,3,5,6,7,8,9,10],
  over: {name:'神海終極魔法《ワールド・オーシャン》',kind:'judgment',visual:'nova',finalVisual:'pillar',cost:0,castTime:2.45,count:11,spread:7.1,radius:2.85,dmg:1420,delay:0.4,interval:0.065,finalDmg:4900,finalRadius:12.6,elem:7,color:0x9bfaff,vivid:true},
  hi: {name:'超越創世水魔法《エターナル・アビス・ゼロ》',kind:'judgment',visual:'pillar',finalVisual:'nova',cost:0,castTime:3.15,count:12,spread:7.5,radius:3.0,dmg:1790,delay:0.35,interval:0.058,finalDmg:6900,finalRadius:13.0,elem:7,color:0xc1fdff,vivid:true,hi:true}
};

CHIEF_ONLY.add('nepterion');

// RF_NEPT_SEVEN_FIXED_DATA_V17
FIGHTERS.nepterion.skills = FIGHTERS.nepterion.skills.slice(0,5);
delete FIGHTERS.nepterion.pool;

// RF_UDAIJIN_V20_BEGIN
// 運営長専用・呪属性：既存キャラクターの仕様や数値を変更しない。
FIGHTERS.udaijin = {
  name:'右大臣',title:'禍呪の右大臣（運営長専用）',
  model:'assets/models/udaijin-exact-v21.glb',face:"assets/portraits/udaijin.png",
  attribute:'呪',color:0xb76aff,tint:null,height:2.25,hp:2650,speed:5.45,
  overGain:1.1,power:1.18,armor:.90,fluxMul:1.2,
  locked:true,special:'chief',fixedSlots:true,curseExclusive:true,
  light:{name:'呪印',dmg:0,range:16,color:0xc175ff},
  // I/Shift=呪い、J/Z=呪印、K/X=おにび、U/V=呪いの光。位置・順番による変化なし。
  skills:[
    {name:'おにび',kind:'udaijin_onibi',elem:0,color:0xff824f,cost:17,castTime:.52,dmg:78,count:2,vivid:true},
    {name:'呪いの光',kind:'udaijin_eyes',elem:6,color:0xb65aff,cost:33,castTime:1.10,dmg:510,vivid:true}
  ],
  // 奥義キーは同じ光線。別の固有魔法を増やさない。
  over:{name:'呪いの光',kind:'udaijin_eyes',elem:6,color:0xb65aff,cost:0,castTime:1.10,dmg:510,vivid:true},
  hi:{name:'呪いの光',kind:'udaijin_eyes',elem:6,color:0xb65aff,cost:0,castTime:1.10,dmg:510,vivid:true}
};
// RF_UDAIJIN_V20_END

CHIEF_ONLY.add('udaijin');

// RF_KINOSAKI_V27_CHARACTER
FIGHTERS.kinosaki_sanmi = {
  name:'城崎三位', title:'翠嵐を司る公卿（運営長専用）',
  model:'assets/models/kinosaki-sanmi-original.glb', face:'assets/portraits/kinosaki-sanmi.svg',
  attribute:'風', color:0x78d4aa, tint:null, height:3.55, hp:1300, speed:5.85,
  power:1.04, armor:0.94, fluxMul:1.08, overGain:1.16,
  locked:true, special:'chief',
  light:{dmg:41,range:2.8,color:0xb8fadd},
  skills:[
    {name:'翠嵐刃《ふうじん》',kind:'projectile',visual:'crescent',cost:19,castTime:.38,count:3,spreadAng:.12,dmg:64,speed:23,radius:.75,elem:3,color:0x84efd2,vivid:true},
    {name:'疾風翔破《はやて》',kind:'dash',cost:22,castTime:.24,dmg:115,speed:21,dur:.38,elem:3,color:0xa6ffd5,vivid:true},
    {name:'旋風大陣《碧の結界》',kind:'shockwave',cost:26,castTime:.70,dmg:115,radius:5.2,elem:3,color:0x68d9b7,vivid:true},
    {name:'鎌鼬嵐舞《千風花》',kind:'rain',visual:'blade',count:9,spread:4,radius:1.55,dmg:54,delay:.35,interval:.08,cost:29,castTime:.90,elem:3,color:0x5be6c9,vivid:true},
    {name:'風神の息吹《清風癒》',kind:'heal',heal:310,radius:5.6,cost:28,castTime:.75,elem:3,color:0xb7ffeb,vivid:true}
  ],
  over:{name:'奥義《天嵐滅刃》',kind:'judgment',visual:'blade',finalVisual:'nova',count:10,spread:4.8,radius:1.8,dmg:75,delay:.48,interval:.095,finalDmg:370,finalRadius:7.5,castTime:1.75,elem:3,color:0x9ef7d1,vivid:true},
  hi:{name:'秘奥義《九霄神風》',kind:'judgment',visual:'sword',finalVisual:'nova',count:12,spread:5.2,radius:2,dmg:88,delay:.48,interval:.085,finalDmg:530,finalRadius:8.1,castTime:2.45,elem:3,color:0xe1fff0,vivid:true,hi:true}
};
CHIEF_ONLY.add('kinosaki_sanmi');

// RF_FUJIWARA_NOBUYORI_V36 — 運営長専用・呪属性。添付GLBを無加工で使用。
FIGHTERS.fujiwara_nobuyori = {
  name:'藤原信頼', title:'禍呪の公卿（運営長専用）',
  model:'assets/models/fujiwara-nobuyori-original.glb',
  face:'assets/portraits/fujiwara-nobuyori.svg',
  color:0xbd7bff, tint:null, attribute:'呪', element:6,
  height:3.55, hp:120000, speed:6.75, power:2.2, armor:.26,
  fluxMul:2.1, overGain:1.8, locked:true, special:'chief',
  fixedSlots:true, curseExclusive:true,
  light:{name:'呪印',dmg:0,range:24,color:0xca85ff},
  skills:[
    {name:'鬼火',kind:'projectile',visual:'orb',cost:16,castTime:0.42,count:1,dmg:0,speed:22,radius:.35,elem:6,color:0xff9565,vivid:true},
    {name:'呪いの光',kind:'projectile',visual:'laser',cost:24,castTime:0.65,count:1,dmg:0,speed:25,radius:.4,elem:6,color:0xc77aff,vivid:true}
  ],
  over:{name:'怪しい光',kind:'rf_fujiwara_rainbow',cost:0,castTime:1.15,dmg:0,radius:0,elem:6,color:0xfadfff,vivid:true},
  hi:{name:'十拳剣',kind:'rf_fujiwara_totsuka',cost:0,castTime:1.8,dmg:0,radius:0,elem:6,color:0xff9f36,vivid:true,hi:true}
};

// RF_FUJIWARA_AUTH_V36: Cloudflare Worker accepts this model only for chief.
CHIEF_ONLY.add('fujiwara_nobuyori');

FIGHTERS.uninomiya_tadayasu={name:'宇邇宮忠靖親王',title:'無窮の親王（運営長専用）',model:'assets/models/uninomiya-tadayasu-rigged.glb',face:'assets/face-uninomiya.webp',color:0xffffff,tint:null,attribute:'無',element:0,height:3.7,hp:250000,speed:8.5,power:3.9,armor:.12,fluxMul:3,overGain:2.3,locked:true,special:'chief',fixedSlots:true,light:{name:'虚空断',kind:'slash',dmg:16000,range:8,color:0xffffff},skills:[{name:'無明天衝',kind:'projectile',cost:15,castTime:.25,count:5,dmg:28000,speed:35,radius:.7,elem:0,color:0xffffff},{name:'因果封絶',kind:'shockwave',cost:25,castTime:.5,dmg:49000,radius:8,elem:0,color:0xffffff},{name:'時界停止',kind:'shockwave',cost:35,castTime:.7,dmg:58000,radius:12,elem:0,color:0xffffff},{name:'万象砕滅',kind:'projectile',cost:48,castTime:1,count:12,dmg:90000,speed:42,radius:1,elem:0,color:0xffffff}],over:{name:'王命・天地崩解',kind:'shockwave',cost:0,castTime:1.2,dmg:160000,radius:18,elem:0,color:0xffffff},hi:{name:'終極秘奥義・零界帰滅',kind:'shockwave',cost:0,castTime:2.2,dmg:300000,radius:28,elem:0,color:0xffffff,hi:true}};
CHIEF_ONLY.add("uninomiya_tadayasu");


FIGHTERS.minamoto_yoritomo={
 name:'源頼朝',title:'蒼潮の征夷大将軍（灯晶10万）',
 model:'assets/models/minamoto-yoritomo.glb',face:'assets/portraits/minamoto-yoritomo.svg',
 color:0x5fdcff,tint:null,attribute:'水',element:7,
 height:3.55,hp:18000,speed:7.3,power:2.65,armor:.38,fluxMul:2.6,overGain:2.2,
 fixedSlots:true,shop:true,locked:true,shardPrice:100000,
 light:{name:'水陣刀・青嵐斬',dmg:280,range:3.8,color:0x6bdfff},
 skills:[
  {name:'蒼龍水牙',kind:'projectile',visual:'orb',cost:16,castTime:.38,count:6,spreadAng:.10,chain:.045,dmg:530,speed:31,radius:1.06,elem:7,color:0x34baff,vivid:true},
  {name:'潮影瞬閃',kind:'dash',cost:21,castTime:.3,dmg:1400,speed:30,dur:.48,elem:7,color:0x36e0ff,vivid:true},
  {name:'八重潮波陣',kind:'shockwave',cost:26,castTime:.75,dmg:1850,radius:9.6,elem:7,color:0x44d6ff,vivid:true},
  {name:'天雨千波槍',kind:'rain',visual:'spear',cost:32,castTime:1.15,count:14,spread:4.8,radius:1.7,dmg:380,delay:.38,interval:.065,elem:7,color:0x69eaff,vivid:true}
 ],
 over:{name:'征夷水神陣・蒼海制圧',kind:'judgment',visual:'pillar',finalVisual:'nova',count:16,spread:5.6,radius:2.3,dmg:650,delay:.55,interval:.08,finalDmg:2800,finalRadius:10.4,cost:0,castTime:2,elem:7,color:0x65eaff,vivid:true},
 hi:{name:'秘奥義・大海龍王断',kind:'judgment',visual:'pillar',finalVisual:'bigsword',count:22,spread:7,radius:2.7,dmg:810,delay:.58,interval:.07,finalDmg:5200,finalRadius:13.2,cost:0,castTime:2.7,elem:7,color:0xb5faff,vivid:true,hi:true}
};
// RF48_WORKER_MINAMOTO
async function rf48BuyMinamoto(req,env,H,{code,pid}){
 if(await limited(env,req,'minamoto-buy',10,60000))return json(H,{error:'limit'},429);
 const h=await syncKey(env,code);
 if(!h||!PID_RE.test(String(pid||''))||!(await bindPid(env,pid,h)))return json(H,{error:'nosync'},403);
 const r=await doCall(env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(h)),{op:'minamoto-buy',pid});
 return json(H,r.data,r.status);
}


// RF50_CASTLE_REALM_20261111 - authenticated, server-owned castle data
const RF50_LIMIT=999999;
const RF50_FLOORS=lv=>Math.min(10,1+Math.floor(lv/10));
const RF50_TIER=lv=>Math.floor(lv/10);
const RF50_COST=lv=>500+350*lv;
// RF553_CASTLE_NAME_BULK_MOBILE_20261111 — validate before publishing a visible base name.
function rf553Name(v){
 if(typeof v!=='string')return '';
 const name=v.trim().replace(/\s+/g,' ');
 return Array.from(name).length>0&&Array.from(name).length<=20&&/^[\p{L}\p{N}々ー・＿_\- ]+$/u.test(name)?name:'';
}
const RF50_MONSTERS=['影狼','甲冑兵','朧蜘蛛','双月ゴーレム','霧の術師','鋼牙獣','魔晶騎士','深淵の番兵','古代石像','結界守護者'];
function rf50Save(row){try{return JSON.parse(row?.data||'null')}catch{return null}}
function rf55Plan(plan){
 return Array.from({length:10},(_,i)=>{
  const key=Array.isArray(plan)?plan[i]:null,def=typeof key==='string'?ownValue(FIGHTERS,key):null;
  return def&&!def.hidden&&!def.enemy?key:null;
 });
}
const rf55Revision=c=>Number.isSafeInteger(c?.revision)?c.revision:0;
const rf55Defenders=['m3','m13','m23','m33','m43','m53','m63','m73','m83','m93'];
async function rf55Release(storage,r,paid=false){
 await storage.transaction(async tx=>{
  await tx.put('castle:raid:'+r.id,r);
  if(await tx.get('castle:active:'+r.attackerPid)===r.id)await tx.delete('castle:active:'+r.attackerPid);
  if((await tx.get('castle:underattack:'+r.targetPid))?.id===r.id)await tx.delete('castle:underattack:'+r.targetPid);
  if(paid){
   await tx.delete('castle:pending:'+r.attackerPid+':'+r.id);
   await tx.delete('castle:pending:'+r.targetPid+':'+r.id);
  }
 });
}
function rf50Castle(c){return c?{name:rf553Name(c.name)||'',style:c.style,level:c.level,lord:c.lord,createdAt:c.createdAt,shieldUntil:c.shieldUntil||0,bossPlan:rf55Plan(c.bossPlan),revision:rf55Revision(c),floors:RF50_FLOORS(c.level),appearanceTier:RF50_TIER(c.level),nextCost:c.level<100?RF50_COST(c.level):0}:null}
function rf50View(r){
 if(!r)return null;
 const index=(r.floor+r.castleLevel)%RF50_MONSTERS.length;
 const assigned=r.bossPlan?.[r.floor-1];
 const final=r.floor===r.floors;
 return {enemyKey:assigned||(final?r.lord:rf55Defenders[index]),
  combat:r.combat||'commands',hero:r.hero,paid:!!r.paidAt,id:r.id,status:r.status,targetPid:r.targetPid,floor:r.floor,floors:r.floors,castleLevel:r.castleLevel,style:r.style,lord:r.lord,cpuPercent:r.cpuPercent??100,enemyAttack:rf50EnemyAttack(r),defenseFactor:rf50EnemyDefense(r),enemyName:assigned?FIGHTERS[assigned].name:final?r.lordName:RF50_MONSTERS[index],attackerHp:r.hp,maxHp:r.maxHp,enemyHp:r.enemyHp,maxEnemyHp:r.maxEnemyHp,charge:r.charge,healsLeft:r.healsLeft,turn:r.turn,lastLog:r.lastLog,expiresAt:r.expiresAt,winAt:r.winAt||0}}
// RF50_FLOOR_BALANCE_V2 / each floor raises enemy HP, attack and defense
function rf50FloorRank(r){const depth=Math.max(0,r.floor-1);return {depth,progress:depth/Math.max(1,r.floors-1),boss:r.floor===r.floors}}
function rf50Enemy(r){const {depth,progress,boss}=rf50FloorRank(r);const pct=Math.min(100,Math.max(1,Number(r.cpuPercent??100)))/100;
  return Math.round((300+Math.max(1,r.castleLevel)*25)*(1+.13*depth)*(1+.08*progress)*(boss?1.28:1)*(.22+.78*pct))}
function rf50EnemyAttack(r){const {depth,progress,boss}=rf50FloorRank(r);const pct=Math.min(100,Math.max(1,Number(r.cpuPercent??100)))/100;
  return Math.round((24+Math.max(1,r.castleLevel)*1.35+r.floor*3)*(1+.07*depth)*(1+.05*progress)*(boss?1.16:1)*(.12+.88*pct))}
function rf50EnemyDefense(r){return 1+.018*Math.max(0,r.floor-1)}
async function rf50Wallet(storage,row,res,b){
 const now=Date.now(),s=rf50Save(row),pid=b.pid,op=b.op;
 if(!s||!PID_RE.test(String(pid||''))||s.pid!==pid)return res({error:'nosync'},403);
 const balance=s.shards;
 if(!Number.isSafeInteger(balance)||balance<0||balance>RF50_LIMIT)return res({error:'bad_balance'},422);
 const old=await storage.get('castle:home'),revision=rf55Revision(old)+1;
 if(op==='castle-self')return res({ok:true,castle:rf50Castle(old),shards:balance,ver:row.ver||0,data:row.data});
 if(op==='castle-create'){
  if(old)return res({error:'already_exists'},409);
  if(!['wa','west'].includes(b.style)||!ownValue(FIGHTERS,b.lord))return res({error:'bad'},400);
  const castleName=b.castleName===undefined?'双月の拠点':rf553Name(b.castleName);
  if(!castleName)return res({error:'invalid_castle_name'},400);
  const castle={name:castleName,style:b.style,level:1,lord:b.lord,revision,createdAt:now,shieldUntil:now+24*3600000};
  await storage.put('castle:home',castle);
  return res({ok:true,castle:rf50Castle(castle),shards:balance,ver:row.ver||0,data:row.data});
 }
 if(op==='castle-lord'){
  if(!old||!ownValue(FIGHTERS,b.lord))return res({error:'bad'},400);
  const updated={...old,lord:b.lord,revision};
  await storage.put('castle:home',updated);
  return res({ok:true,castle:rf50Castle(updated),shards:balance,ver:row.ver||0,data:row.data});
 }
 if(op==='castle-boss'){
  if(!old)return res({error:'no_castle'},404);
  if(!Number.isInteger(b.floor)||b.floor<1||b.floor>10)return res({error:'invalid_floor'},400);
  if(b.boss!==null&&!rf55Plan([b.boss])[0])return res({error:'fighter_locked'},403);
  const bossPlan=rf55Plan(old.bossPlan);bossPlan[b.floor-1]=b.boss;
  const castle={...old,bossPlan,revision};
  await storage.put('castle:home',castle);
  return res({ok:true,castle:rf50Castle(castle)});
 }
 if(op==='castle-name'){
  if(!old)return res({error:'no_castle'},404);
  const name=rf553Name(b.castleName);
  if(!name)return res({error:'invalid_castle_name'},400);
  const castle={...old,name,revision};await storage.put('castle:home',castle);
  return res({ok:true,castle:rf50Castle(castle),shards:balance,ver:row.ver||0,data:row.data});
 }
 if(op==='castle-level-bulk'){
  if(!old)return res({error:'no_castle'},404);
  if(old.level>=100)return res({error:'level_max'},409);
  const isMax=b.maxAffordable===true;
  if(!isMax&&(!Number.isSafeInteger(b.count)||b.count<1||b.count>99))return res({error:'invalid_count'},400);
  const steps=isMax?100-old.level:b.count;
  if(old.level+steps>100)return res({error:'level_max'},409);
  let cost=0,applied=0;
  for(let lv=old.level;lv<old.level+steps;lv++){
   const next=RF50_COST(lv);
   if(cost+next>balance){
    if(isMax)break;
    return res({error:'shards',required:cost+next,available:balance},402);
   }
   cost+=next;applied++;
  }
  if(applied===0)return res({error:'shards',available:balance},402);
  s.shards=balance-cost;
  const upgraded={...old,level:old.level+applied,revision},ver=(row.ver||0)+1;
  const data=JSON.stringify(s);if(data.length>200000)return res({error:'size'},413);
  await writeTogether(storage,[['row',{...row,data,ver,at:now,wealth:wealthOf(s),wid:''}],['castle:home',upgraded]]);
  return res({ok:true,castle:rf50Castle(upgraded),shards:s.shards,ver,cost,applied,data});
 }
 if(op==='castle-level'){
  if(!old)return res({error:'no_castle'},404);
  if(old.level>=100)return res({error:'level_max'},409);
  const cost=RF50_COST(old.level);
  if(balance<cost)return res({error:'shards',cost},402);
  s.shards-=cost;
  const upgraded={...old,level:old.level+1,revision},ver=(row.ver||0)+1;
  const data=JSON.stringify(s);if(data.length>200000)return res({error:'size'},413);
  await writeTogether(storage,[['row',{...row,data,ver,at:now,wealth:wealthOf(s),wid:''}],['castle:home',upgraded]]);
  return res({ok:true,castle:rf50Castle(upgraded),shards:s.shards,ver,cost,data});
 }
 if(op==='castle-shield'){
  if(!old||!/^[a-f0-9-]{36}$/i.test(String(b.raidId||'')))return res({error:'bad'},400);
  const key='castle:shield:'+b.raidId;
  if(await storage.get(key))return res({ok:true,already:true,castle:rf50Castle(old)});
  const castle={...old,revision,shieldUntil:Math.max(old.shieldUntil||0,now+12*3600000)};
  await writeTogether(storage,[['castle:home',castle],[key,{at:now}]]);
  return res({ok:true,castle:rf50Castle(castle)});
 }
 if(op==='castle-debit'){
  if(!/^[a-f0-9-]{36}$/i.test(String(b.raidId||'')))return res({error:'bad'},400);
  const key='castle:debit:'+b.raidId,prev=await storage.get(key);
  if(prev)return res({ok:true,...prev,already:true});
  const amount=Math.floor(balance/10);s.shards=balance-amount;
  const ver=(row.ver||0)+1,receipt={raidId:b.raidId,amount,shards:s.shards,ver,pid};
  await writeTogether(storage,[['row',{...row,data:JSON.stringify(s),ver,at:now,wealth:wealthOf(s),wid:''}],[key,receipt]]);
  return res({ok:true,...receipt});
 }
 if(op==='castle-credit'){
  if(!/^[a-f0-9-]{36}$/i.test(String(b.raidId||''))||!Number.isSafeInteger(b.amount)||b.amount<0||b.amount>100000)return res({error:'bad'},400);
  const key='castle:credit:'+b.raidId,prev=await storage.get(key);
  if(prev)return res({ok:true,...prev,already:true,shards:balance,ver:row.ver||0,data:row.data});
  const credit=Math.min(b.amount,RF50_LIMIT-balance),pending=b.amount-credit;
  s.shards=balance+credit;
  const ver=(row.ver||0)+1,receipt={raidId:b.raidId,amount:b.amount,credited:credit,pending,shards:s.shards,ver,pid};
  const data=JSON.stringify(s);
  const writes=[['row',{...row,data,ver,at:now,wealth:wealthOf(s),wid:''}],[key,receipt]];
  if(pending>0)writes.push(['castle:loot:'+b.raidId,pending]);
  await writeTogether(storage,writes);
  return res({ok:true,...receipt,data});
 }

 if(op==='castle-loot-collect'){
  // Pagination also clears legacy zero records that previously hid unclaimed prizes.
  const positive=[],trash=[];
  let cursor='',more=false;
  for(let page=0;page<20;page++){
    const entries=[...(await storage.list({prefix:'castle:loot:',limit:500,...(cursor?{startAfter:cursor}:{})})).entries()];
    if(!entries.length){more=false;break;}
    for(const [key,value] of entries){
      const n=Number(value);
      if(!Number.isSafeInteger(n)||n<=0)trash.push(key);
      else positive.push([key,n]);
    }
    cursor=entries[entries.length-1][0];
    more=entries.length===500;
    if(!more)break;
  }
  let room=RF50_LIMIT-balance,collected=0,pending=0;
  const keep=[];
  for(const [key,value] of positive){
    const payout=Math.min(room,value);
    if(payout>0){room-=payout;collected+=payout;}
    const rest=value-payout;
    if(rest>0){pending+=rest;if(payout>0)keep.push([key,rest]);}
    else trash.push(key);
  }
  if(collected||trash.length||keep.length){
    if(collected)s.shards=balance+collected;
    const ver=(row.ver||0)+(collected?1:0),data=JSON.stringify(s);
    await storage.transaction(async tx=>{
      if(collected)await tx.put('row',{...row,data,ver,at:now,wealth:wealthOf(s),wid:''});
      for(const key of trash)await tx.delete(key);
      for(const [key,v] of keep)await tx.put(key,v);
    });
    return res({ok:true,shards:s.shards,ver,data,collected,pending,morePending:more});
  }
  return res({ok:true,shards:balance,ver:row.ver||0,data:row.data,collected:0,pending,morePending:more});
 }
 return res({error:'bad'},400);
}
async function rf50CastleHub(storage,b,now,out){
 if(b.op==='castle-publish'){
  const c=b.castle;
  if(!PID_RE.test(String(b.pid||''))||!c||!['wa','west'].includes(c.style)||!Number.isInteger(c.level)||c.level<1||c.level>100||typeof b.h!=='string'||!HEX64.test(b.h))return out({error:'bad'},400);
  const key='castle:fort:'+b.pid,current=await storage.get(key);
  if(rf55Revision(c)<rf55Revision(current))return out({ok:true});
  await storage.put(key,{pid:b.pid,bossPlan:rf55Plan(c.bossPlan),revision:rf55Revision(c),name:rf553Name(c.name)||String(b.name||'旅人').slice(0,12),h:b.h,style:c.style,level:c.level,lord:c.lord,lordName:b.lordName||c.lord,createdAt:c.createdAt||now,shieldUntil:Math.max(c.shieldUntil||0,current?.shieldUntil||0)});
  return out({ok:true});
 }
 if(b.op==='castle-pending'){
  if(!PID_RE.test(String(b.pid||'')))return out({error:'bad'},400);
  const items=await storage.list({prefix:'castle:pending:'+b.pid+':',limit:5});
  return out({ok:true,raids:[...items.values()]});
 }
 if(b.op==='castle-directory'){
  const all=await storage.list({prefix:'castle:fort:',limit:500});
  const castles=[...all.values()].filter(v=>v.pid!==b.pid).map(v=>({pid:v.pid,name:v.name,style:v.style,level:v.level,lord:v.lord,floors:RF50_FLOORS(v.level),appearanceTier:RF50_TIER(v.level),protected:(v.shieldUntil||0)>now})).sort((a,c)=>c.level-a.level).slice(0,40);
  return out({ok:true,castles});
 }
 if(b.op==='castle-start'){
  if(!PID_RE.test(String(b.pid||''))||!PID_RE.test(String(b.targetPid||''))||b.pid===b.targetPid)return out({error:'bad'},400);
  const defender=await storage.get('castle:fort:'+b.targetPid);
  if(!defender)return out({error:'not_found'},404);
  if((defender.shieldUntil||0)>now)return out({error:'shield'},409);
  if((await storage.get('castle:cool:'+b.pid+':'+b.targetPid)||0)>now)return out({error:'cooldown'},429);
  const activeId=await storage.get('castle:active:'+b.pid);
  const activeRaid=activeId?await storage.get('castle:raid:'+activeId):null;
  if(activeRaid&&activeRaid.expiresAt>now&&['active','won'].includes(activeRaid.status))return out({error:'already_active'},409);
  const claimed=await storage.get('castle:underattack:'+b.targetPid);
  if(claimed?.expiresAt>now)return out({error:'under_attack'},409);
  const id=crypto.randomUUID(),hp=Math.min(12000,Math.max(650,Math.round(+b.stats?.hp||1500)));
  const raid={id,attackerPid:b.pid,attackerH:b.h,attackerName:String(b.name||'旅人').slice(0,12),targetPid:defender.pid,targetH:defender.h,targetName:defender.name,
  cpuPercent:Number.isSafeInteger(b.cpuPercent)&&b.cpuPercent>=1&&b.cpuPercent<=100?b.cpuPercent:100,
  castleLevel:defender.level,style:defender.style,lord:defender.lord,lordName:defender.lordName,hero:b.fighter,status:'active',floor:1,floors:RF50_FLOORS(defender.level),
  bossPlan:rf55Plan(defender.bossPlan),combat:b.combat==='action'?'action':'commands',
  maxHp:hp,hp,power:Math.max(.8,Math.min(5,+b.stats?.power||1)),charge:0,healsLeft:1,turn:0,guard:false,lastAt:0,lastLog:'防衛ダンジョンへ侵入しました',createdAt:now,expiresAt:now+25*60000};
  raid.enemyHp=rf50Enemy(raid);raid.maxEnemyHp=raid.enemyHp;
  await writeTogether(storage,[['castle:raid:'+id,raid],['castle:active:'+b.pid,id],['castle:underattack:'+b.targetPid,{id,expiresAt:raid.expiresAt}],['castle:cool:'+b.pid+':'+b.targetPid,now+24*3600000]]);
  return out({ok:true,raid:rf50View(raid)});
 }
 if(['castle-current','castle-act','castle-payinfo','castle-finalize','castle-leave'].includes(b.op)){
  const id=b.raidId||(await storage.get('castle:active:'+b.pid));
  const r=id?await storage.get('castle:raid:'+id):null;
  if(!r||r.attackerPid!==b.pid)return out({error:'not_found'},404);
  if(r.expiresAt<now&&r.status==='active'){
   r.status='expired';r.lastLog='制限時間が終了しました';
   await rf55Release(storage,r);
  }
  if(b.op==='castle-current')return out({ok:true,raid:rf50View(r)});
  if(b.op==='castle-leave'){
   if(r.status==='active'){
    r.status='retreated';r.lastLog='拠点から撤退しました';
    await rf55Release(storage,r);
   }
   return out({ok:true,raid:rf50View(r)});
  }
  if(b.op==='castle-payinfo'){
   if(r.status!=='won')return out({error:'not_won'},409);
   return out({ok:true,id:r.id,attackerPid:r.attackerPid,attackerH:r.attackerH,attackerName:r.attackerName,targetPid:r.targetPid,targetH:r.targetH,targetName:r.targetName,winAt:r.winAt});
  }
  if(b.op==='castle-finalize'){
   if(r.status!=='won')return out({error:'not_won'},409);
   r.paidAt=r.paidAt||now;
   await rf55Release(storage,r,true);
   const defender=await storage.get('castle:fort:'+r.targetPid);
   if(defender)await storage.put('castle:fort:'+r.targetPid,{...defender,shieldUntil:Math.max(defender.shieldUntil||0,now+12*3600000)});
   return out({ok:true,raid:rf50View(r)});
  }
  if(r.status!=='active')return out({error:'not_active',raid:rf50View(r)},409);
  const realtime=r.combat==='action';
  if(realtime&&(b.floor!==r.floor||b.turn!==r.turn))return out({error:'stale_raid',raid:rf50View(r)},409);
  if(now-r.lastAt<(realtime?700:450))return out({error:'too_fast',raid:rf50View(r)},429);
  const action=b.action;
  if(!['attack','skill','guard','heal','over'].includes(action)&&!(realtime&&action==='counter'))return out({error:'bad'},400);
  let damage=0;
  if(action==='attack')damage=Math.round(105+40*r.power);
  if(action==='skill'){
   if(realtime&&now-(r.lastSkillAt||0)<1450)return out({error:'skill_cooldown',raid:rf50View(r)},429);
   if(realtime)r.lastSkillAt=now;
   damage=Math.round(210+67*r.power);
  }
  if(action==='over'){
   if(r.charge<100)return out({error:'not_ready',raid:rf50View(r)},409);
   damage=Math.round(520+155*r.power);r.charge=0;
  }
  if(action==='heal'){
   if(r.healsLeft<=0)return out({error:'no_heal',raid:rf50View(r)},409);
   r.hp=Math.min(r.maxHp,r.hp+Math.floor(r.maxHp*.32));r.healsLeft--;
  }
  damage=Math.max(0,Math.round(damage/rf50EnemyDefense(r)));
  r.turn++;r.lastAt=now;r.enemyHp=Math.max(0,r.enemyHp-damage);
  r.charge=Math.min(100,r.charge+(action==='attack'?23:action==='skill'?30:action==='guard'?17:action==='heal'?14:0));
  if(r.enemyHp===0){
   if(r.floor>=r.floors){r.status='won';r.winAt=now;r.lastLog='最上階の防衛ボスを撃破！ 攻城戦勝利';}
   else {r.floor++;r.enemyHp=rf50Enemy(r);r.maxEnemyHp=r.enemyHp;r.healsLeft=1;r.hp=Math.min(r.maxHp,r.hp+Math.round(r.maxHp*.12));r.lastLog='階層突破！第'+r.floor+'階層へ';}
  }else{
   const incoming=Math.round(rf50EnemyAttack(r)*(action==='guard'?.4:action==='counter'?.55:1));
   r.hp=Math.max(0,r.hp-incoming);
   r.lastLog=action==='guard'?'防御成功：被害 '+incoming:action==='heal'?'回復しました。反撃 '+incoming:action==='counter'?'防衛ボスの攻撃：被害 '+incoming:'与ダメージ '+damage+'、反撃 '+incoming;
   if(r.hp===0||(!realtime&&r.turn>=240)){r.status='lost';r.lastLog='攻略失敗。防衛軍の勝利';}
  }
  if(r.status==='lost')await rf55Release(storage,r);
  else if(r.status==='won')await writeTogether(storage,[
    ['castle:raid:'+id,r],
    ['castle:pending:'+r.attackerPid+':'+id,{id,attackerPid:r.attackerPid}],
    ['castle:pending:'+r.targetPid+':'+id,{id,attackerPid:r.attackerPid}]
  ]);
  else await storage.put('castle:raid:'+id,r);
  return out({ok:true,raid:rf50View(r)});
 }
 return out({error:'bad'},400);
}
async function rf50Notice(env,pid,raidId,kind,title,body,at){
 if(!env.MAIL_STORE||!PID_RE.test(String(pid||'')))return {status:503,data:{error:'mail_not_ready'}};
 const message={recipient:pid,title,body,gift:{shards:0,items:[]},expiresAt:(at||Date.now())+30*DAY,kind:'system',senderName:'拠点管理局'};
 const requestId='castle_'+kind+'_'+raidId,digest=await sha256(JSON.stringify(message));
 return doCall(mailStub(env),{op:'send',requestId,digest,message});
}
async function rf50Settle(env,pid,raidId){
 const hub=mailStub(env),info=await doCall(hub,{op:'castle-payinfo',pid,raidId});
 if(info.status!==200)return info;
 const r=info.data;
 const from=env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(r.targetH)),to=env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(r.attackerH));
 const debit=await doCall(from,{op:'castle-debit',pid:r.targetPid,raidId});
 if(debit.status!==200)return debit;
 const credit=await doCall(to,{op:'castle-credit',pid:r.attackerPid,raidId,amount:debit.data.amount});
 if(credit.status!==200)return credit;
 const shield=await doCall(from,{op:'castle-shield',pid:r.targetPid,raidId});
 if(shield.status!==200)return shield;
 const n=await Promise.all([
  rf50Notice(env,r.targetPid,raidId,'defense','【拠点防衛】攻城戦の結果',r.attackerName+' に城を攻略されました。灯晶 '+debit.data.amount+' が移動し、12時間の防衛保護が開始されました。',r.winAt),
  rf50Notice(env,r.attackerPid,raidId,'victory','【攻城戦勝利】灯晶獲得',r.targetName+' の最上階を攻略し、灯晶 '+debit.data.amount+' を獲得しました。',r.winAt)
 ]);
 if(n.some(x=>x.status!==200))return {status:503,data:{error:'mail_retry',amount:debit.data.amount}};
 const done=await doCall(hub,{op:'castle-finalize',pid,raidId});
 return {status:done.status,data:{ok:done.status===200,amount:debit.data.amount,credited:credit.data.credited,pending:credit.data.pending,shards:credit.data.shards,ver:credit.data.ver,data:credit.data.data}};
}
async function rf50Route(req,env,H,body,action){
 if(!env.SYNC_LOCK||!env.MAIL_STORE||!env.PID_BIND||!env.LIMITER||!env.PEPPER)return json(H,{error:'castle_not_ready'},503);
 if(await limited(env,req,'castle-'+action,90,60000))return json(H,{error:'limit'},429);
 const me=await whoAmI(env,body.code,body.name);
 if(!me)return json(H,{error:'nosync'},403);
 const sync=env.SYNC_LOCK.get(env.SYNC_LOCK.idFromName(me.h)),hub=mailStub(env);
 async function fighterStats(key){
  if(typeof key!=='string')return null;
  const row=await syncRow(env,me.h),sv=rf50Save(row),def=ownValue(FIGHTERS,key);
  if(!sv||!def||def.hidden||def.enemy)return null;
  const role=(await verify(env,body.token,'role'))?.r||null;
  // RF55_CASTLE_CHARACTER_SEARCH_20261111 — match normal select permissions without making chief-only assets public.
  if(CHIEF_ONLY.has(key)&&role!=='chief')return null;
  if(def.special==='chief'&&!role)return null;
  if((OP_EXCLUSIVE.has(key)||def.special==='operator')&&role!=='op')return null;
  if(OP_ONLY.has(key)&&!role)return null;
  if(key==='minamoto_yoritomo'){
    const receipt=await doCall(sync,{op:'minamoto-owned'});
    if(receipt.status!==200||!receipt.data?.owned)return null;
  }else if(def.shop){
    const owned=await ownedKeys(env,sv.buyId);
    if(!owned.includes(key))return null;
  }else if(def.shardPrice&&!def.special){
    if(!Array.isArray(sv.gemChars)||!sv.gemChars.includes(key))return null;
  }else if(!ROSTER.includes(key)&&key!=='uninomiya'&&!def.special&&!role)return null;
  const u=statsFor(sv,key);
  return {hp:Math.round((def.hp||1000)*(1+.08*(u.hp||0))),power:(def.power||1)*(1+.06*(u.atk||0))};
 }
 const name=cleanTxt(body.name||me.name,12);
 if(['self','create','level','level-bulk','name','lord','boss'].includes(action)){
  if(action==='self'){
    const queue=await doCall(hub,{op:'castle-pending',pid:me.pid});
    if(queue.status===200)for(const task of queue.data?.raids||[]){
      if(task&&PID_RE.test(String(task.attackerPid||''))&&/^[a-f0-9-]{36}$/i.test(String(task.id||''))){
        try{await rf50Settle(env,task.attackerPid,task.id)}
        catch(e){console.warn('[castle recovery]',e?.message||String(e))}
      }
    }
  }
  if((action==='create'||action==='lord')&&!await fighterStats(body.lord))return json(H,{error:'fighter_locked'},403);
  if(action==='boss'){
   if(!Number.isInteger(body.floor)||body.floor<1||body.floor>10)return json(H,{error:'invalid_floor'},400);
   if(body.boss!==null&&!await fighterStats(body.boss))return json(H,{error:'fighter_locked'},403);
  }
  const op={boss:'castle-boss',self:'castle-self',create:'castle-create',level:'castle-level','level-bulk':'castle-level-bulk',name:'castle-name',lord:'castle-lord'}[action];
  const r=await doCall(sync,{op,pid:me.pid,style:body.style,lord:body.lord,castleName:body.castleName,count:body.count,maxAffordable:body.maxAffordable,floor:body.floor,boss:body.boss});
  if(r.status!==200)return json(H,r.data,r.status);
  if(r.data.castle){
   const lordName=FIGHTERS[r.data.castle.lord]?.name||r.data.castle.lord;
   const published=await doCall(hub,{op:'castle-publish',pid:me.pid,h:me.h,name,castle:r.data.castle,lordName});
   if(action==='boss'&&published.status!==200)return json(H,{error:'castle_publish_pending'},503);
  }
  if(action==='self'){
   const loot=await doCall(sync,{op:'castle-loot-collect',pid:me.pid});
   if(loot.status===200)return json(H,{...r.data,shards:loot.data.shards,ver:loot.data.ver,data:loot.data.data,pendingLoot:loot.data.pending,morePending:loot.data.morePending,collectedLoot:loot.data.collected});
  }
  return json(H,r.data,r.status);
 }
 if(action==='list'){
  const r=await doCall(hub,{op:'castle-directory',pid:me.pid});return json(H,r.data,r.status);
 }
 if(action==='raid/start'||action==='raid/arena'){
  if(!PID_RE.test(String(body.targetPid||'')))return json(H,{error:'bad'},400);
  const stats=await fighterStats(body.fighter);if(!stats)return json(H,{error:'fighter_locked'},403);
  const globalCpu=await rf553CpuGet(env);
  if(!globalCpu.ok)return json(H,{error:'settings_unavailable'},503);
  const result=await doCall(hub,{op:'castle-start',pid:me.pid,h:me.h,name,targetPid:body.targetPid,fighter:body.fighter,stats,cpuPercent:globalCpu.percent,combat:action==='raid/arena'?'action':'commands'});
  if(result.status===200){
   await rf50Notice(env,body.targetPid,result.data.raid.id,'warning','【拠点襲撃】侵入者を検知',name+' があなたの城へ侵入しました。防衛ダンジョンを守備します。',Date.now());
  }
  return json(H,result.data,result.status);
 }
 if(['raid/current','raid/act','raid/leave'].includes(action)){
  const op={'raid/current':'castle-current','raid/act':'castle-act','raid/leave':'castle-leave'}[action];
  const r=await doCall(hub,{op,pid:me.pid,raidId:body.raidId,action:body.action,floor:body.floor,turn:body.turn});
  if(r.status!==200)return json(H,r.data,r.status);
  if(action==='raid/act'&&r.data.raid.status==='won'){
   const settled=await rf50Settle(env,me.pid,r.data.raid.id);
   if(settled.status===200)return json(H,{...r.data,result:settled.data});
   return json(H,{...r.data,settlementPending:true,settlementError:settled.data?.error||'retry'});
  }
  if(action==='raid/act'&&r.data.raid.status==='lost'){
   await rf50Notice(env,r.data.raid.targetPid||body.targetPid,r.data.raid.id,'defended','【拠点防衛】防衛成功',name+' を防衛ダンジョンで撃退しました。灯晶は移動していません。',Date.now());
  }
  return json(H,r.data,r.status);
 }
 if(action==='raid/claim'){
  const r=await rf50Settle(env,me.pid,body.raidId);return json(H,r.data,r.status);
 }
 return json(H,{error:'not_found'},404);
}

FIGHTERS[TENSHI_KEY]=tenshiDefinition();
