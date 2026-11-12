// The server advances ranked fights from player inputs, on its own clock.
export const RANK_TIERS = [
  ['bronze','ブロンズ',0], ['silver','シルバー',200], ['gold','ゴールド',500],
  ['platinum','プラチナ',900], ['master','マスター',1400]
];
export const RANK_FIGHT_MS = 150000;
export const RANK_RADIUS = 13;
export const BOT_WAIT_MS = 60000;
export const BOT_RETRY_MS = 30000;
export const BOT_CHANCE = .12;
export const BOT_DAILY_WINS = 3;
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

export function rankTier(points) {
  for (let index = RANK_TIERS.length - 1; index > 0; index -= 1) {
    const tier = RANK_TIERS[index];
    if (points >= tier[2]) return tier[0];
  }
  return RANK_TIERS[0][0];
}
export function pointsFor(players, winner, reason, earnedBotWins) {
  if (winner === null || reason === 'cancelled' || reason === 'no_contest') return [0,0];
  if (players[1].bot) return [winner === 0 && earnedBotWins < BOT_DAILY_WINS ? 8 : 0,0];
  const loser = 1 - winner;
  const spread = Math.round((players[loser].points - players[winner].points) / 60);
  const gain = clamp(25 + spread, 15, 36);
  const drop = Math.min(players[loser].points, clamp(9 - spread, 5, 16));
  return winner === 0 ? [gain,-drop] : [-drop,gain];
}
export function botStrength(points, wins) {
  return clamp(.25 + Math.sqrt(Math.max(0,points) / 1600) * .57 + Math.min(wins,24) * .004, .25, .94);
}
export function withinRating(a, b, now) {
  const wait = now - Math.min(a.since,b.since);
  if (wait >= BOT_WAIT_MS) return true;
  return Math.abs(a.points - b.points) <= 180 + Math.floor(Math.max(0,wait) / 15000) * 180;
}
export function cleanInput(raw, previous, now) {
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
export function newFight() {
  return { elapsed:0, fighters:[fighter(0),fighter(1)], bolts:[], events:[], nextBolt:1,
    botThink:0, botInput:{...EMPTY}, combatClock:0 };
}
export const emptyRankInput = () => ({...EMPTY});
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
export function stepFight(fight, inputs, profiles, elapsedMs = TICK_MS, random = Math.random) {
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
