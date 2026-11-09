import * as THREE from 'three';

const KEY = 'nepterion';
const GUARD_SLOT = 'nep_guard';
const BARRIER_SLOT = 's4';
const LASER_SLOT = 's0';
const RAIN_SLOT = 's1';
const HEAL_SLOT = 's2';
const WATER = 0x49d7ff;
const CYAN = new THREE.Color(0x8cecff);
const CYAN_EMISSIVE = new THREE.Color(0x46bde9);
const SEAL_URL = new URL('./assets/fx/nepterion-ice-circle-v24.png', import.meta.url).href;

let sealTexture = null;
function getSealTexture() {
  if (!sealTexture) {
    sealTexture = new THREE.TextureLoader().load(SEAL_URL);
    sealTexture.colorSpace = THREE.SRGBColorSpace;
    sealTexture.anisotropy = 2;
  }
  return sealTexture;
}

function clamp01(v){ return Math.max(0, Math.min(1, v)); }
function nowSec(){ return (performance?.now?.() || Date.now()) / 1000; }

function canvasTexture(kind='orb', colorA='#9ef5ff', colorB='#1f8dff') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0,0,256,256);
  if (kind === 'orb') {
    const rg = g.createRadialGradient(128,128,18,128,128,120);
    rg.addColorStop(0, 'rgba(255,255,255,0.98)');
    rg.addColorStop(0.2, colorA);
    rg.addColorStop(0.55, colorB);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.beginPath(); g.arc(128,128,118,0,Math.PI*2); g.fill();
  } else if (kind === 'ring') {
    g.strokeStyle = colorA; g.lineWidth = 14;
    g.globalAlpha = 0.95;
    g.beginPath(); g.arc(128,128,82,0,Math.PI*2); g.stroke();
    g.strokeStyle = colorB; g.lineWidth = 8;
    g.beginPath(); g.arc(128,128,104,0,Math.PI*2); g.stroke();
    g.globalAlpha = 0.58;
    for (let i=0;i<12;i++){ const a=i*Math.PI/6; g.beginPath(); g.arc(128+Math.cos(a)*98,128+Math.sin(a)*98,10,0,Math.PI*2); g.fillStyle=colorA; g.fill(); }
  } else if (kind === 'beam') {
    const lg = g.createLinearGradient(0,128,256,128);
    lg.addColorStop(0,'rgba(255,255,255,0)');
    lg.addColorStop(0.15,colorA);
    lg.addColorStop(0.45,'rgba(255,255,255,1)');
    lg.addColorStop(0.7,colorB);
    lg.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle = lg;
    g.fillRect(0,95,256,66);
  } else if (kind === 'punch') {
    g.fillStyle = colorB;
    g.strokeStyle = colorA;
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(52,164); g.lineTo(70,84); g.lineTo(106,56); g.lineTo(146,52); g.lineTo(188,68);
    g.lineTo(208,104); g.lineTo(212,150); g.lineTo(190,190); g.lineTo(148,212); g.lineTo(92,208); g.closePath();
    g.fill(); g.stroke();
  } else if (kind === 'drill') {
    g.fillStyle = colorB; g.strokeStyle = colorA; g.lineWidth = 9;
    g.beginPath(); g.moveTo(52,128); g.lineTo(198,48); g.lineTo(206,208); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#d6fbff'; g.lineWidth = 7;
    for (let i=0;i<6;i++){ g.beginPath(); g.moveTo(70+i*18,148-i*8); g.lineTo(176+i*3,88+i*12); g.stroke(); }
  } else if (kind === 'chain') {
    g.strokeStyle = colorA; g.lineWidth = 16; g.lineCap = 'round'; g.globalAlpha = .95;
    g.beginPath(); g.moveTo(40,40); g.lineTo(216,216); g.stroke();
    g.beginPath(); g.moveTo(216,40); g.lineTo(40,216); g.stroke();
    g.strokeStyle = colorB; g.lineWidth = 7;
    g.beginPath(); g.moveTo(40,40); g.lineTo(216,216); g.stroke();
    g.beginPath(); g.moveTo(216,40); g.lineTo(40,216); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function ensureTemp(obj, key, build) {
  if (!obj[key]) obj[key] = build();
  return obj[key];
}

function sprite(tex, scale=2.2, color=0xffffff, opacity=1) {
  const mat = new THREE.SpriteMaterial({ map: tex, color, transparent:true, opacity, depthWrite:false, depthTest:true, blending:THREE.AdditiveBlending, toneMapped:false });
  const sp = new THREE.Sprite(mat);
  sp.scale.setScalar(scale);
  sp.renderOrder = 15;
  return sp;
}
function plane(tex, scale=2.2, color=0xffffff, opacity=1) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), new THREE.MeshBasicMaterial({ map:tex, color, transparent:true, opacity, depthWrite:false, depthTest:true, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, toneMapped:false }));
  mesh.scale.setScalar(scale);
  mesh.renderOrder = 15;
  return mesh;
}

function nearestEnemy(owner, maxDist=999) {
  let best = null, bd = maxDist*maxDist;
  for (const f of owner.battle?.fighters || []) {
    if (f===owner || f.dead || f.team===owner.team) continue;
    const dx=f.pos.x-owner.pos.x, dz=f.pos.z-owner.pos.z, d=dx*dx+dz*dz;
    if (d<bd) { bd=d; best=f; }
  }
  return best;
}
function enemies(owner, radius=999) {
  const rr=radius*radius, out=[];
  for (const f of owner.battle?.fighters || []) {
    if (f===owner || f.dead || f.team===owner.team) continue;
    const dx=f.pos.x-owner.pos.x, dz=f.pos.z-owner.pos.z;
    if (dx*dx+dz*dz<=rr) out.push(f);
  }
  return out;
}
function damageEnemy(owner, enemy, dmg, stun=0.12, kb=0.4) {
  if (!enemy || enemy.dead || enemy.team===owner.team) return;
  const dx = enemy.pos.x - owner.pos.x, dz = enemy.pos.z - owner.pos.z;
  const mag = Math.hypot(dx,dz) || 1;
  enemy.receive?.(dmg, stun, dx/mag*kb, dz/mag*kb);
}
function tintFreeze(enemy) {
  if (enemy._nepIceTintSaved || !enemy.visual) return;
  const saved = [];
  const seen = new Set();
  enemy.visual.traverse(o => {
    if (!o.isMesh || !o.material) return;
    const arr = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of arr) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      saved.push({m, color:m.color?.clone?.(), emissive:m.emissive?.clone?.(), ei:m.emissiveIntensity});
      if (m.color) m.color.copy(CYAN);
      if (m.emissive) { m.emissive.copy(CYAN_EMISSIVE); m.emissiveIntensity = Math.max(0.15, m.emissiveIntensity || 0); }
    }
  });
  enemy._nepIceTintSaved = saved;
}
function restoreFreezeTint(enemy) {
  const saved = enemy._nepIceTintSaved;
  if (!saved) return;
  for (const e of saved) {
    if (e.color && e.m.color) e.m.color.copy(e.color);
    if (e.emissive && e.m.emissive) e.m.emissive.copy(e.emissive);
    if (e.ei != null) e.m.emissiveIntensity = e.ei;
  }
  enemy._nepIceTintSaved = null;
}
function attachChainFx(enemy) {
  if (!enemy.battle?.fx || enemy._nepChainFx?.parent) return;
  const sp = sprite(ensureTemp(window, '__rfChainTex', ()=>canvasTexture('chain','#cfffff','#6fc9ff')), 3.4, 0xffffff, 0.92);
  sp.position.set(0, 2.3, 0);
  enemy.visual?.add(sp);
  enemy._nepChainFx = sp;
}
function detachChainFx(enemy) {
  if (enemy._nepChainFx) {
    enemy._nepChainFx.material?.dispose?.();
    enemy._nepChainFx.removeFromParent();
    enemy._nepChainFx = null;
  }
}

export function installNepterionCombat({ Battle, Fighter, FIGHTERS }) {
  if (!Battle?.prototype || !Fighter?.prototype || Battle.prototype.__rfNepV24Installed) return;
  Battle.prototype.__rfNepV24Installed = true;

  const spec = FIGHTERS?.[KEY];
  if (spec) {
    spec.attribute = '水';
    spec.light = { dmg: 0, range: 0, shots: 0, color: 0x76eeff };
    spec.skills = [
      { name:'蒼眼凍条《フロスト・アイズ》', kind:'projectile', cost:0, castTime:0.2, dmg:0 },
      { name:'乱潮蒼弾《ブルー・スキャッター》', kind:'projectile', cost:0, castTime:0.2, dmg:0 },
      { name:'蒼海自癒《アクア・リジェネ》', kind:'heal', cost:0, castTime:0.2, heal:0 },
      { name:'予約枠', kind:'projectile', cost:0, castTime:0.2, dmg:0 },
      { name:'蒼海防環《アクア・ディフェンス・リング》', kind:'projectile', cost:0, castTime:0.2, dmg:0 },
    ];
    spec.over = { name:'剛海巨拳《タイタン・オーシャン・パンチ》', kind:'projectile', cost:0, castTime:0.45, dmg:0 };
    spec.hi = { name:'海皇穿滅《アビス・ドリル》', kind:'projectile', cost:0, castTime:0.6, dmg:0, hi:true };
    delete spec.pool;
    spec.fixedSlots = true;
  }

  const oldApplyRed = Fighter.prototype.applyRed;
  Fighter.prototype.applyRed = function() {
    if (this.key === KEY) { this.redMats = []; return; }
    return oldApplyRed.call(this);
  };

  const oldCast = Battle.prototype.cast;
  Battle.prototype.cast = function(fighter, slot, net) {
    if (fighter?.key === KEY && !fighter.dead && !this.ended && (slot === GUARD_SLOT || slot === BARRIER_SLOT)) {
      if (slot === GUARD_SLOT) {
        if (!net && !fighter.remoteAuth && this.net && fighter.netId) this.net.cast({ id:fighter.netId, slot, tx:fighter.pos.x, tz:fighter.pos.z, ry:fighter.facing });
      } else if (slot === BARRIER_SLOT) {
        if (!net && !fighter.remoteAuth && this.net && fighter.netId) this.net.cast({ id:fighter.netId, slot, tx:fighter.pos.x, tz:fighter.pos.z, ry:fighter.facing });
      }
    }
    return oldCast.call(this, fighter, slot, net);
  };

  function spawnGroundSeal(owner, seconds=20) {
    const battle = owner.battle;
    if (!battle?.fx) return;
    if (owner._nepIceField && owner._nepIceField.group?.parent) owner._nepIceField.t = seconds;
    else {
      const g = new THREE.Group();
      const art = plane(getSealTexture(), 7.2, 0xffffff, 0.88);
      art.rotation.x = -Math.PI/2;
      art.position.y = 0.11;
      g.add(art);
      battle.fx.add(g);
      owner._nepIceField = { group:g, art, t:seconds, spin:0 };
    }
    battle.ui?.popup?.(owner.pos, '氷結護陣・20秒', '#90f7ff');
  }

  function freezeEnemy(enemy, duration=1.25) {
    enemy.status ||= {};
    enemy.status.freeze = Math.max(enemy.status.freeze || 0, duration);
    enemy.stun = Math.max(enemy.stun || 0, duration);
    enemy._nepFrozenUntil = Math.max(enemy._nepFrozenUntil || 0, nowSec() + duration);
    enemy.vel?.set?.(0,0,0);
    tintFreeze(enemy);
    attachChainFx(enemy);
  }

  function tickIceField(owner, dt) {
    const field = owner._nepIceField;
    if (!field) return;
    if (owner.dead || owner.battle?.ended || !field.group.parent) {
      field.group.removeFromParent(); owner._nepIceField = null; return;
    }
    field.t -= dt;
    if (field.t <= 0) { field.group.removeFromParent(); owner._nepIceField = null; return; }
    field.spin += dt * 0.7;
    field.group.position.set(owner.pos.x, 0.06, owner.pos.z);
    field.group.rotation.y = field.spin;
    field.art.material.opacity = 0.80 + 0.12*Math.sin(field.spin*2.7);
    for (const e of enemies(owner, 6.1)) freezeEnemy(e, 1.35);
  }

  function activateDefense(owner, seconds=20) {
    owner._nepDefenseUntil = Math.max(owner._nepDefenseUntil || 0, nowSec() + seconds);
    const battle = owner.battle;
    if (!battle?.fx) return;
    if (owner._nepDefenseFx?.group?.parent) {
      owner._nepDefenseFx.t = seconds; 
    } else {
      const g = new THREE.Group();
      const tex = ensureTemp(window, '__rfNepRingTex', ()=>canvasTexture('ring','#c8f8ff','#1f87ff'));
      const a = sprite(tex, 2.8, 0xffffff, 0.9);
      const b = sprite(tex, 3.4, 0xbdefff, 0.7);
      g.add(a); g.add(b);
      owner.visual?.add(g);
      owner._nepDefenseFx = { group:g, a, b, t:seconds, rot:0 };
    }
    battle.ui?.popup?.(owner.pos, '防御力2倍・20秒', '#b9f6ff');
  }
  function tickDefense(owner, dt) {
    const fx = owner._nepDefenseFx;
    if (!fx) return;
    fx.t -= dt;
    if (owner.dead || fx.t <= 0 || owner._nepDefenseUntil <= nowSec()) {
      fx.group.removeFromParent(); owner._nepDefenseFx = null; return;
    }
    fx.rot += dt * 2.2;
    fx.group.position.set(0, 2.3 + Math.sin(fx.rot*2)*0.08, 0);
    fx.a.material.rotation += dt * 1.8;
    fx.b.material.rotation -= dt * 1.25;
    fx.a.scale.setScalar(2.7 + Math.sin(fx.rot*2.1)*0.15);
    fx.b.scale.setScalar(3.3 + Math.cos(fx.rot*1.7)*0.18);
  }

  function startAutoHeal(owner, seconds=20) {
    owner._nepHealUntil = Math.max(owner._nepHealUntil || 0, nowSec() + seconds);
    const battle = owner.battle;
    if (!battle?.fx) return;
    if (owner._nepHealFx?.group?.parent) {
      owner._nepHealFx.t = seconds;
    } else {
      const g = new THREE.Group();
      owner.visual?.add(g);
      const tex = ensureTemp(window, '__rfNepOrbTex', ()=>canvasTexture('orb','#d8ffff','#2d8dff'));
      const orbs = [];
      for (let i=0;i<6;i++) {
        const sp = sprite(tex, 0.8 + i*0.05, 0xffffff, 0.9);
        g.add(sp); orbs.push(sp);
      }
      owner._nepHealFx = { group:g, orbs, t:seconds, spin:0 };
    }
    battle.ui?.popup?.(owner.pos, '自動回復・20秒', '#a9f4ff');
  }
  function tickHeal(owner, dt) {
    const fx = owner._nepHealFx;
    if (!fx) return;
    fx.t -= dt;
    if (owner.dead || fx.t <= 0 || owner._nepHealUntil <= nowSec()) {
      fx.group.removeFromParent(); owner._nepHealFx = null; return;
    }
    owner.hp = Math.min(owner.maxHp, owner.hp + owner.maxHp * 0.018 * dt);
    fx.spin += dt * 2.4;
    fx.group.position.set(0, 1.6, 0);
    fx.orbs.forEach((sp,i)=>{
      const a = fx.spin + i*Math.PI*2/fx.orbs.length;
      sp.position.set(Math.cos(a)*1.1, Math.sin(a*1.8)*0.45, Math.sin(a)*1.1);
      sp.material.opacity = 0.68 + 0.22*Math.sin(a*2.2);
    });
  }

  function eyeLaser(owner) {
    const battle = owner.battle;
    if (!battle?.fx) return;
    const tex = ensureTemp(window, '__rfBeamTex', ()=>canvasTexture('beam','#c8ffff','#4cbcff'));
    const g = new THREE.Group();
    const beam = plane(tex, 11.0, 0xffffff, 0.88);
    beam.position.y = 2.45;
    beam.rotation.y = owner.facing || 0;
    g.add(beam);
    g.position.copy(owner.pos);
    battle.fx.add(g);
    let t = 0;
    const hit = new Set();
    battle.addEffect?.((dt)=>{
      t += dt;
      g.position.copy(owner.pos);
      beam.rotation.y = (owner.facing || 0) - 0.62 + clamp01(t/0.9) * 1.24;
      beam.material.opacity = 0.95 * (1 - clamp01((t-0.55)/0.35));
      for (const e of enemies(owner, 24)) {
        if (hit.has(e)) continue;
        const dx=e.pos.x-owner.pos.x, dz=e.pos.z-owner.pos.z;
        const a=Math.atan2(dx,dz);
        let diff = Math.abs(((a - beam.rotation.y + Math.PI*3)%(Math.PI*2))-Math.PI);
        if (diff < 0.28) { damageEnemy(owner,e,1550,0.28,0.45); hit.add(e); }
      }
      if (t >= 0.9) { g.removeFromParent(); beam.material.dispose(); return false; }
      return true;
    });
    battle.ui?.popup?.(owner.pos, '蒼眼凍条', '#aff7ff');
  }

  function randomBolts(owner) {
    const battle = owner.battle;
    if (!battle?.fx) return;
    const tex = ensureTemp(window, '__rfNepOrbTex', ()=>canvasTexture('orb','#d8ffff','#2d8dff'));
    const g = new THREE.Group();
    battle.fx.add(g);
    const waves = [];
    for (let i=0;i<18;i++) {
      const x = owner.pos.x + (Math.random()*18-9);
      const z = owner.pos.z + (Math.random()*18-9);
      const sp = sprite(tex, 1.0 + Math.random()*0.55, 0xffffff, 0.92);
      sp.position.set(x, 6 + Math.random()*4, z);
      g.add(sp);
      waves.push({sp,x,z,delay:i*0.05,done:false});
    }
    let t=0;
    battle.addEffect?.((dt)=>{
      t += dt;
      for (const w of waves) {
        if (w.done || t < w.delay) continue;
        const k = clamp01((t-w.delay)/0.55);
        w.sp.position.y = 8 - k*8;
        w.sp.scale.setScalar(1.0 + (1-k)*0.8);
        if (k >= 1) {
          w.done = true;
          for (const e of battle.fighters || []) {
            if (e===owner || e.dead || e.team===owner.team) continue;
            const dx=e.pos.x-w.x, dz=e.pos.z-w.z;
            if (dx*dx+dz*dz <= 6.8) damageEnemy(owner,e,680,0.11,0.20);
          }
          w.sp.visible = false;
        }
      }
      if (waves.every(w=>w.done)) {
        g.removeFromParent();
        for (const w of waves) w.sp.material.dispose();
        return false;
      }
      return true;
    });
    battle.ui?.popup?.(owner.pos, '乱潮蒼弾', '#8befff');
  }

  function giantPunch(owner) {
    const battle = owner.battle;
    if (!battle?.fx) return;
    const target = nearestEnemy(owner, 22);
    if (!target) return;
    const tex = ensureTemp(window, '__rfPunchTex', ()=>canvasTexture('punch','#d1f7ff','#3b92ff'));
    const sp = sprite(tex, 4.6, 0xffffff, 0.93);
    sp.position.copy(owner.pos).add(new THREE.Vector3(0,2.2,0));
    battle.fx.add(sp);
    const start = owner.pos.clone(); const end = target.pos.clone(); end.y = 2.1;
    let t=0, hit=false;
    battle.addEffect?.((dt)=>{
      t += dt;
      const k = clamp01(t/0.5);
      sp.position.set(start.x + (end.x-start.x)*k, 2.0 + Math.sin(k*Math.PI)*0.8, start.z + (end.z-start.z)*k);
      sp.scale.setScalar(4.6 + k*1.8);
      if (!hit && k >= 0.82) { damageEnemy(owner,target,4200,0.55,1.15); hit = true; }
      sp.material.opacity = 0.94 * (1-k*0.4);
      if (k >= 1) { sp.removeFromParent(); sp.material.dispose(); return false; }
      return true;
    });
    battle.ui?.popup?.(owner.pos, '剛海巨拳', '#c4f7ff');
  }

  function giantDrill(owner) {
    const battle = owner.battle;
    if (!battle?.fx) return;
    const target = nearestEnemy(owner, 24);
    if (!target) return;
    const tex = ensureTemp(window, '__rfDrillTex', ()=>canvasTexture('drill','#e5fdff','#4aaeff'));
    const sp = sprite(tex, 4.9, 0xffffff, 0.96);
    battle.fx.add(sp);
    let t=0, tick=0;
    battle.addEffect?.((dt)=>{
      t += dt; tick += dt;
      const end = target.pos.clone();
      sp.position.set(end.x, 2.2, end.z);
      sp.material.rotation += dt * 5.8;
      sp.scale.setScalar(4.9 + Math.sin(t*9)*0.2);
      while (tick >= 0.14) {
        tick -= 0.14;
        damageEnemy(owner, target, 580, 0.12, 0.12);
      }
      if (t >= 1.65) { sp.removeFromParent(); sp.material.dispose(); return false; }
      return true;
    });
    battle.ui?.popup?.(owner.pos, '海皇穿滅', '#ddfbff');
  }

  const oldExecute = Battle.prototype.executeCast;
  Battle.prototype.executeCast = function(fighter, slot, networkCast) {
    if (fighter?.key === KEY && !this.ended) {
      if (slot === GUARD_SLOT) { spawnGroundSeal(fighter, 20); return; }
      if (slot === BARRIER_SLOT) { activateDefense(fighter, 20); return; }
      if (slot === LASER_SLOT) { eyeLaser(fighter); return; }
      if (slot === RAIN_SLOT) { randomBolts(fighter); return; }
      if (slot === HEAL_SLOT) { startAutoHeal(fighter, 20); return; }
      if (slot === 'over') { giantPunch(fighter); fighter.over = 0; return; }
      if (slot === 'hi') { giantDrill(fighter); fighter.over = 0; return; }
    }
    return oldExecute.call(this, fighter, slot, networkCast);
  };

  const oldStartOver = Fighter.prototype.startOver;
  Fighter.prototype.startOver = function(...args) {
    if (this.key !== KEY) return oldStartOver.apply(this,args);
    if (this.over < 100 || this.dead) return;
    const slot = this._rfNepFinisher === 6 ? 'hi' : 'over';
    if (slot === 'hi' && this.awakened <= 0) { this.battle?.ui?.popup?.(this.pos, '秘奥義は覚醒中のみ', '#86eaff'); return; }
    this.battle?.cast(this, slot);
  };

  const oldReceive = Fighter.prototype.receive;
  Fighter.prototype.receive = function(damage, stun, kx, kz) {
    if (this.key === KEY && !this.dead) {
      if ((this._nepDefenseUntil || 0) > nowSec()) damage = (Number(damage) || 0) * 0.5;
    }
    const res = oldReceive.call(this, damage, stun, kx, kz);
    for (const e of this.battle?.fighters || []) {
      if (e._nepFrozenUntil && e._nepFrozenUntil <= nowSec()) {
        e._nepFrozenUntil = 0; restoreFreezeTint(e); detachChainFx(e);
      }
    }
    return res;
  };

  const oldUpdate = Fighter.prototype.update;
  Fighter.prototype.update = function(dt, input) {
    if (this.key !== KEY) return oldUpdate.call(this, dt, input);
    const next = { ...(input || {}) };
    const g = !!next.guard, a = !!next.attack;
    if (g && !this._nepGPrev) { this.battle?.cast(this, GUARD_SLOT); }
    if (a && !this._nepAPrev) { this.battle?.cast(this, BARRIER_SLOT); }
    this._nepGPrev = g; this._nepAPrev = a;
    next.guard = false; next.attack = false;
    const out = oldUpdate.call(this, dt, next);
    const sec = Math.max(0, Math.min(0.06, Number(dt) || 0));
    if (this._nepIceField) tickIceField(this, sec);
    if (this._nepDefenseFx) tickDefense(this, sec);
    if (this._nepHealFx) tickHeal(this, sec);
    for (const e of this.battle?.fighters || []) {
      if ((e._nepFrozenUntil || 0) > nowSec()) {
        freezeEnemy(e, 0.12);
      } else if (e._nepFrozenUntil) {
        e._nepFrozenUntil = 0;
        restoreFreezeTint(e);
        detachChainFx(e);
      }
    }
    return out;
  };

  const oldDispose = Battle.prototype.dispose;
  Battle.prototype.dispose = function(...args) {
    for (const f of this.fighters || []) {
      if (f._nepIceField?.group) f._nepIceField.group.removeFromParent();
      if (f._nepDefenseFx?.group) f._nepDefenseFx.group.removeFromParent();
      if (f._nepHealFx?.group) f._nepHealFx.group.removeFromParent();
      restoreFreezeTint(f); detachChainFx(f);
    }
    return oldDispose.apply(this, args);
  };
}
