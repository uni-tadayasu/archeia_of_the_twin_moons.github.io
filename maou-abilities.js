// RF_BATCH_SCALE_STARTUP_V92
// RF_BATTLE_FIX_V9_1_20261109
/** Riftfall Arena / 魔王 -- original light skills, no GLB mesh edits.
 * Installs gameplay logic onto the existing Battle / Fighter prototypes.
 * All cloned material changes affect only clones, never the user's source GLB.
 */
import * as THREE from 'three';
import { FIGHTERS } from './data.js?v=rf-v9-2-20261109';
import { instantiateModel, disposeModel, loadModel } from './model-runtime.js?v=rf-mobile-v7-20261109';
const KEY = 'maou';
const SHADE = 'maou_shade';
const BEAST_NAME = '魔卵獣ゼルグリム';
const BEAST_ASSET = 'assets/models/maou-egg-zelgrim.glb';
let beastAsset = null;
let beastLoading = null;
function readyBeast() {
  if (beastAsset) return Promise.resolve(beastAsset);
  if (!beastLoading) beastLoading = loadModel(BEAST_ASSET)
    .then(g => { beastAsset = g; return g; })
    .catch(err => {
      beastLoading = null; // A failed network request can be retried next battle.
      console.warn('[Zelgrim] モデル取得失敗', err);
      return null;
    });
  return beastLoading;
}

const GOLD = 0xffe290;
const CRIMSON = 0xff1238;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
const TAU = Math.PI * 2;
const LOW_MEMORY = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;

function createAura(f, type) {
  const attr = type === 'rainbow' ? '__maouRainbowAura' : '__maouRegenAura';
  if (f[attr]) return f[attr];
  const group = new THREE.Group();
  const owned = [];
  const color = type === 'rainbow' ? 0xffb8ee : 0xf8eab1;
  group.name = 'maou-' + type + '-aura';
  const radius = Math.max(.95, Number(f.def?.height || 3.7) * .48);
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.TorusGeometry(radius * (1 + i * .22), .025 + i * .008, 5, LOW_MEMORY ? 24 : 64);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .6 - i * .1,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = .05 + i * .08;
    group.add(ring); owned.push(geo, mat);
  }
  const lineGeo = new THREE.BufferGeometry();
  const coords = new Float32Array(8 * 6 * 2 * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(coords, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: type === 'rainbow' ? 0xc8edff : 0xfff2bb,
    transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending });
  const line = new THREE.LineSegments(lineGeo, lineMat);line.frustumCulled = false;
  group.add(line);owned.push(lineGeo, lineMat);
  f.root.add(group);
  return (f[attr] = {group, line, owned, t: 0, radius, type});
}
function stopAura(f, type) {
  const attr = type === 'rainbow' ? '__maouRainbowAura' : '__maouRegenAura';
  const aura = f[attr]; if (!aura) return;
  aura.group.removeFromParent();
  for (const o of aura.owned) o.dispose?.();
  f[attr] = null;
}
function updateAura(f, type, dt) {
  const state = createAura(f, type);state.t += dt;
  const {group, line, radius, t} = state;
  group.children.slice(0, 3).forEach((r,i) => {
    r.rotation.z += dt * (.5 + i * .22) * (i % 2 ? -1 : 1);
    if (type === 'rainbow') r.material.color.setHSL((t*.31+i/3)%1, 1, .67);
    else r.material.color.setHex(i%2?0x9ceeff:0xffe0a4);
    r.material.opacity = .42 + .2 * Math.sin(t*6+i*1.8);
  });
  const arr=line.geometry.attributes.position;
  const H = Math.max(1.8, Number(f.def?.height || 3.7));
  for(let k=0;k<8;k++) for(let j=0;j<6;j++) {
    const a = k*TAU/8+t*.85+j*.09;
    const y0 = H*(.12+j*.13), y1 = y0+H*.075;
    const r0=radius*(.78+.13*Math.sin(t*13+j*2+k));
    const s=(k*6+j)*2;
    arr.setXYZ(s, Math.cos(a)*r0, y0, Math.sin(a)*r0);
    arr.setXYZ(s+1, Math.cos(a+.18+.12*Math.sin(t*16+j))*r0, y1, Math.sin(a+.18)*r0);
  }
  arr.needsUpdate=true;
  if(type==='rainbow') line.material.color.setHSL((t*.27)%1,.95,.6);
  line.material.opacity=.55+.35*Math.abs(Math.sin(t*11));
}
function clangSound(f) {
  const now=performance.now();
  if (f.__maouClangAt && now-f.__maouClangAt<180) return;
  f.__maouClangAt=now;
  try {
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC) { f.battle?.ui?.sfx?.('guard');return; }
    const ctx=clangSound.ctx ||= new AC();
    if(ctx.state==='suspended') void ctx.resume();
    const t=ctx.currentTime, gain=ctx.createGain();
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.12,t+.006);
    gain.gain.exponentialRampToValueAtTime(.0001,t+.14);gain.connect(ctx.destination);
    for(const [freq,mul] of [[870,1],[1477,.27],[2310,.12]]) {
      const osc=ctx.createOscillator(),g=ctx.createGain();g.gain.value=mul;
      osc.type='sine';osc.frequency.value=freq;osc.connect(g);g.connect(gain);osc.start(t);osc.stop(t+.16);
    }
  } catch (_) { f.battle?.ui?.sfx?.('guard'); }
}
function guardStarted(f, remote=false) {
  f.maouGuardTime=30;
  createAura(f,'regen');
  if(!remote){
    f.battle?.ui?.popup?.(f.pos,'雷光再生陣：30秒・再使用待機なし','#edffbd');
    if(f.netId)f.battle?.net?.cast?.({id:f.netId,slot:'mg',tx:f.pos.x,tz:f.pos.z,ry:f.facing});
  }
}
function rainbowStarted(f, remote=false) {
  f.maouRainbowTime=30;
  f.stun=0;
  createAura(f,'rainbow');
  if(!remote){
    f.battle?.ui?.popup?.(f.pos,'虹光・金剛態：被ダメージ半減／完全耐性','#d1faff');
    if(f.netId)f.battle?.net?.cast?.({id:f.netId,slot:'mr',tx:f.pos.x,tz:f.pos.z,ry:f.facing});
  }
}
function actionVisual(battle,f,spec,slot) {
  if(!battle?.fxPop || !f?.pos)return;
  const p=f.pos.clone();p.y=.1;
  const enemy=battle.nearestEnemy?.(f);const target=enemy?.pos?.clone?.()||p.clone();target.y=.1;
  const big=slot==='over'||slot==='hi';
  battle.fxPop(p,5,4,big?10:6,.9,{flat:true,spin:2.4,grow:1.45,op:.9});
  battle.fxPop(target,5,8,big?12:7,1.1,{flat:true,spin:-2.2,grow:1.8,op:.75});
  battle.flashLight?.(target.clone().setY(1.3),spec.color||GOLD,big?2:.9,.35);
  if(big){battle.ui?.cutin?.(f,spec.name,slot==='hi'?'最上位秘奥義':'究極光魔法');battle.shake=Math.max(battle.shake||0,1.2);}
}
function eyeLaser(battle, f, spec, remote) {
  const light=new THREE.Group(); light.name='maou-red-eye-laser';
  const owned=[];const angle=f.facing||0;
  const forward=new THREE.Vector3(Math.sin(angle),0,Math.cos(angle));
  const right=new THREE.Vector3(Math.cos(angle),0,-Math.sin(angle));
  const height=(Number(f.def?.height)||3.7)*.78;
  const eyeWidth=(Number(f.def?.height)||3.7)*.062;
  // Paired eyes each fire a wide fan: central and six peripheral beams.
  for(const side of [-1,1])for(let k=-3;k<=3;k++){
    const a=angle+k*.17;
    const origin=f.pos.clone().addScaledVector(right,side*eyeWidth).add(new THREE.Vector3(0,height,0));
    const far=origin.clone().add(new THREE.Vector3(Math.sin(a)*19,-height*.28,Math.cos(a)*19));
    const dir=far.clone().sub(origin);const len=dir.length();
    const geo=new THREE.CylinderGeometry(k===0?.1:.055,k===0?.16:.075,len,7,1,true);
    const mat=new THREE.MeshBasicMaterial({color:k===0?0xfff4ed:CRIMSON,transparent:true,opacity:k===0?.9:.62,
      blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    const beam=new THREE.Mesh(geo,mat);
    beam.position.copy(origin).add(far).multiplyScalar(.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
    light.add(beam);owned.push(geo,mat);
  }
  battle.fx.add(light);
  battle.ui?.popup?.(f.pos,'滅界眼光《スカーレット・アポカリプス》','#ff3955');
  battle.ui?.sfx?.('burst');
  let elapsed=0,pulse=0,done=false;
  battle.addEffect(dt=>{
    elapsed+=dt;pulse-=dt;
    if(!remote && !f.remoteAuth && !f.dead && pulse<=0 && elapsed<.91){
      pulse=.22;
      const half=.54,r=19,base=Number(spec.dmg)||1450;
      for(const enemy of battle.enemiesOf(f)){
        if(enemy.dead)continue;
        const dx=enemy.pos.x-f.pos.x,dz=enemy.pos.z-f.pos.z;
        const dist=Math.hypot(dx,dz);if(dist>r+enemy.radius||dist<.001)continue;
        const a=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(a-angle),Math.cos(a-angle));
        if(Math.abs(diff)>half+(enemy.radius/dist))continue;
        battle.applyHit(f,enemy,base*.28,.15,1.7,f.pos,spec);
        battle.fxPop?.(enemy.pos.clone().setY(1.5),0,8,2.2,.3,{grow:1.6,op:.83});
      }
    }
    for(const obj of light.children){obj.material.opacity*=Math.max(.1,1-dt*(elapsed>.6?3:.7));}
    if(elapsed<1.08)return true;
    light.removeFromParent();owned.forEach(x=>x.dispose?.());done=true;return false;
  });
}
// V7.2: independent summon with a dedicated 73KB sculpted GLB.
// Never clone the original 20MB Maou mesh or skin. One asset is cached globally.
function createBeastVisual(shade) {
  if (!beastAsset?.scene) throw new Error('魔卵獣モデルの準備ができていません');
  const model = instantiateModel(beastAsset, shade.def.height * shade.scale, null);
  shade.modelInstance = model;
  shade.visual.add(model.wrapper);
  shade.mixer = null; // static 73KB mesh; animate small limb nodes, no skeleton update
  shade.valgardMotion = null;
  shade.clips = {};
  shade.gear = null;
  shade.ringMesh = new THREE.Group();
  shade.guardMesh = new THREE.Group();
  shade.guardMesh.visible = false;
  shade.root.add(shade.ringMesh, shade.guardMesh);
  const armL = model.model.getObjectByName('ZelgrimLeftArm');
  const armR = model.model.getObjectByName('ZelgrimRightArm');
  const legL = model.model.getObjectByName('ZelgrimLeftLeg');
  const legR = model.model.getObjectByName('ZelgrimRightLeg');
  const head = model.model.getObjectByName('ZelgrimHead');
  shade.__zelgrimMotion = { armL, armR, legL, legR, head, phase:0 };
}
// V7.3: Prebuild the complete tiny Fighter BEFORE gameplay and park it outside
// the fighters list. Egg-hatching never constructs a Fighter, Mesh or animation.
// The pool is per Battle and per Maou, so one Maou can have only one beast.
let ZelgrimFighterConstructor = null;
function prepareZelgrim(battle, owner) {
  if (!battle || !owner || owner.remoteAuth || battle.__zelgrimDisposed) return;
  const pool = (battle.__zelgrimPool ||= new Map());
  const pending = (battle.__zelgrimPreparing ||= new Set());
  if (pool.has(owner) || pending.has(owner)) return;
  pending.add(owner);
  const prepareOnIdle = () => {
    if (battle.__zelgrimDisposed || battle.ended || owner.dead) { pending.delete(owner); return; }
    void readyBeast().then(asset => {
    if (!asset?.scene || battle.__zelgrimDisposed || battle.ended || owner.dead) return;
    if (pool.has(owner) || !ZelgrimFighterConstructor) return;
    // This executes as part of pre-battle setup, NOT when the egg hatches.
    const beast = new ZelgrimFighterConstructor(battle, SHADE, {
      team: owner.team, cpu: .87, player: false, name: BEAST_NAME,
      pos: [0, 0], scale: .78, facing: 0
    });
    beast.maouOwner = owner;
    beast.maouShade = true;
    beast.maouShadeHits = 0;
    beast.__zelgrimDormant = true;
    beast.root.visible = false;
    beast.root.removeFromParent();
    // V7.4 CRITICAL FIX: updateHud() calls hudPlate.querySelector('b') on
    // every fighter. Older plain-object placeholders lacked querySelector(),
    // throwing a TypeError every frame immediately after hatching.
    // Detached DOM nodes satisfy all HUD interfaces without drawing an HP bar.
    beast.hudFill = document.createElement('u');
    beast.hudPlate = document.createElement('div');
    beast.hudPlate.hidden = true;
    beast.hudLabel = null;
    pool.set(owner, beast);
  }).catch(error => {
    console.warn('[Zelgrim] 戦闘前の待機モデル作成に失敗', error);
    }).finally(() => { pending.delete(owner); });
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(prepareOnIdle,{timeout:1800});
  else setTimeout(prepareOnIdle,350);
}
function activateZelgrim(battle, owner, at) {
  const beast = battle.__zelgrimPool?.get(owner);
  if (!beast || !beast.__zelgrimDormant || battle.ended || battle.__zelgrimDisposed || owner.dead) return false;
  if (battle.fighters.includes(beast)) return false;
  // ZERO GLB loading, ZERO model cloning and ZERO new Mesh here.
  beast.maouOwner = owner;
  beast.team = owner.team;
  beast.maouShadeHits = 0;
  beast.__maouRetiring = false;
  beast.__zelgrimDormant = false;
  beast.dead = false;
  beast.hp = beast.maxHp;
  beast.stun = 0;
  beast.inv = 0;
  beast.status = {};
  beast.action = null;
  beast.chantToken = null;
  beast.pos.copy(at);
  beast.netTarget.copy(at);
  beast.vel.set(0, 0, 0);
  beast.facing = owner.facing;
  beast.root.visible = true;
  battle.scene.add(beast.root);
  battle.fighters.push(beast);
  beast.sync();
  return true;
}
function retireBeast(beast) {
  if (!beast || beast.__maouRetiring || beast.__zelgrimDormant) return;
  beast.__maouRetiring = true;
  beast.dead = true;
  beast.hp = 0;
  beast.root.visible = false;
  const battle = beast.battle;
  const park = () => {
    const idx = battle?.fighters?.indexOf(beast) ?? -1;
    if (idx >= 0) battle.fighters.splice(idx, 1);
    beast.root.removeFromParent();
    // Retain model and materials for the NEXT egg; do not clone or dispose.
    beast.__zelgrimDormant = true;
    beast.__maouRetiring = false;
    beast.maouShadeHits = 0;
    beast.inv = 0;
    beast.action = null;
    return false;
  };
  // Remove only after the current battle iteration, never in a for-of update.
  if (battle?.addEffect && !battle.ended) battle.addEffect(park);
  else park();
}
function walkBeast(shade, dt) {
  const m = shade.__zelgrimMotion;
  if (!m) return;
  const moving = (shade.vel?.lengthSq?.() || 0) > .15;
  m.phase += Math.min(.04,Math.max(0,dt)) * (moving ? 9.5 : 1.5);
  const sway = moving ? Math.sin(m.phase) * .33 : Math.sin(m.phase) * .045;
  if (m.armL) m.armL.rotation.x = sway;
  if (m.armR) m.armR.rotation.x = -sway;
  if (m.legL) m.legL.rotation.x = -sway * .9;
  if (m.legR) m.legR.rotation.x = sway * .9;
  if (m.head) m.head.rotation.y = Math.sin(m.phase*.35) * .05;
}
function hatching(battle, f, spec, remote) {
  if (f.__maouEggPending || battle.fighters.some(a => a.key === SHADE && a.maouOwner === f && !a.dead)) {
    if (!remote) battle.ui?.popup?.(f.pos, BEAST_NAME + 'は1体まで', '#b4ffd1');
    return;
  }
  // Never prepare a model on this path. It is prebuilt when Maou joins a battle.
  f.__maouEggPending = true;
  const egg = new THREE.Mesh(
    new THREE.SphereGeometry(.33, 8, 5),
    new THREE.MeshBasicMaterial({color:0xd2c9a5})
  );
  const mouth = f.pos.clone().add(new THREE.Vector3(
    Math.sin(f.facing)*.22, Number(f.def?.height||3.7)*.67, Math.cos(f.facing)*.22
  ));
  const a=f.facing;
  const spawn=f.pos.clone().add(new THREE.Vector3(Math.sin(a)*2.1,0,Math.cos(a)*2.1));
  const end=spawn.clone().setY(.35);
  egg.scale.set(.85,1.25,.85);
  egg.position.copy(mouth);
  battle.fx.add(egg);
  let age=0;
  const clear=()=>{
    egg.removeFromParent(); egg.geometry.dispose(); egg.material.dispose();
    f.__maouEggPending=false;
  };
  battle.addEffect(dt=>{
    if (battle.ended || battle.__zelgrimDisposed || f.dead || f.transformed) {
      clear(); return false;
    }
    age += Math.min(.06, Math.max(0, Number(dt)||0));
    const k = clamp(age/.36,0,1);
    egg.position.copy(mouth).lerp(end,k);
    egg.position.y += Math.sin(k*Math.PI)*.65;
    egg.rotation.x += dt*4; egg.rotation.z += dt*3;
    if (k<1) return true;
    if (remote || f.remoteAuth) { clear(); return false; }
    // If pre-battle preparation is still pending, let the egg sit safely.
    // Time out instead of blocking the renderer or allocating new geometry.
    if (!battle.__zelgrimPool?.has(f)) {
      if (age<3.6) return true;
      battle.ui?.popup?.(f.pos,'召喚獣の事前準備が未完了です。再度お試しください','#ffcf9f');
      clear(); return false;
    }
    let ok=false;
    try {ok=activateZelgrim(battle,f,spawn);}
    catch(error) { console.warn('[Zelgrim activate]',error); }
    if (ok) {
      battle.spark?.(end.clone(),0xd5c58c,.40);
      battle.ui?.popup?.(f.pos,BEAST_NAME+' 誕生（耐久3撃）','#e1dfad');
    } else battle.ui?.popup?.(f.pos,'召喚できません（次の卵で再試行できます）','#ffcf9f');
    clear();
    return false;
  });
  battle.ui?.popup?.(f.pos,'口卵術《翠影孵化》：卵1個・'+BEAST_NAME+'1体（耐久3撃）','#b4ffd1');
}
function fullHeal(battle,f,remote){
  actionVisual(battle,f,{color:0xd8ffff,name:'無尽光輪《全生命復元》'},'s2');
  if(!remote&&!f.remoteAuth){
    f.hp=f.maxHp;f.stun=0;f.status={};
    battle.ui?.popup?.(f.pos,'HP完全回復','#baffdb');
  }
}
// RF_MAOU_V8: keep ONLY previous #3, #4, #5, plus guard/rainbow/revival.
// The server-side chief role and model URL remain unchanged.
function configureMaouV8() {
  const def = FIGHTERS[KEY];
  if (!def?.skills) return;
  const laser = def.skills.find(s => s.kind === 'maou_eye_laser');
  const egg = def.skills.find(s => s.kind === 'maou_egg');
  const heal = def.skills.find(s => s.kind === 'maou_fullheal');
  if (!laser || !egg || !heal) {
    console.warn('[Maou V8] Previous three skills not found; preserving character data.');
    return;
  }
  def.skills = [laser, egg, heal];
  def.pool = [0, 1]; // A/B buttons: laser and egg only. H: complete heal.
  def.light = {...def.light, dmg:0, rainbowGuard:true};
  def.over = {
    name:'終極螺旋穿光《アストラル・ピアサー》',
    kind:'maou_spiral_beam', elem:5, color:0xc7afff,
    cost:0, castTime:2.15, dmg:690, range:23,
    description:'光を一点へ収束し、白金と紫の二重螺旋光線で敵を貫くオリジナル奥義', vivid:true
  };
  def.hi = {
    name:'命脈簒奪《エクリプス・ドレイン》',
    kind:'maou_life_absorb', elem:5, color:0xf3b5ff,
    cost:0, castTime:2.65, dmg:210, radius:11.5,
    description:'前方・周囲の敵から生命力を吸収し、与えたダメージに応じてHPを回復する秘奥義',
    hi:true, vivid:true
  };
  def.revival = {...def.revival, chance:.5, repeatable:true};
  delete def.revival.maxActivations;
  def.__maouV8 = true;
}

// Track custom effect lifetimes so battle transitions cannot leave GPU objects behind.
function ownSpecialFx(battle, group, resources) {
  (battle.__maouV8Cleanups ||= new Set());
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    group.removeFromParent();
    for (const item of resources) item.dispose?.();
    battle.__maouV8Cleanups?.delete(cleanup);
  };
  battle.__maouV8Cleanups.add(cleanup);
  return cleanup;
}

// Concentrated dual-helix ray (original spell, not a reproduction of a show asset).
// Two narrow lightweight cylinders + two polylines: no expensive particles.
function spiralPiercingBeam(battle, caster, spec, remote = false) {
  const len = Math.max(8, Math.min(28, Number(spec.range) || 23));
  const group = new THREE.Group();
  group.name = 'maou-astral-spiral-ray';
  const owned = [];
  for (const [rad, color, opacity] of [[.31,0x6d42ff,.43],[.115,0xfffcdf,.95]]) {
    const geo = new THREE.CylinderGeometry(rad,rad,len,8,1,true);
    const mat = new THREE.MeshBasicMaterial({color,transparent:true,opacity,
      blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    const mesh = new THREE.Mesh(geo,mat);
    mesh.position.y=len/2;
    group.add(mesh);owned.push(geo,mat);
  }
  for (const phase of [0,Math.PI]) {
    const points=[];
    for(let i=0;i<=52;i++) {
      const k=i/52, angle=k*TAU*7+phase;
      const radius=.34 + .06*Math.sin(k*Math.PI);
      points.push(new THREE.Vector3(Math.cos(angle)*radius,k*len,Math.sin(angle)*radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({color:phase?0xffffff:0xc37bff,
      transparent:true,opacity:.88,blending:THREE.AdditiveBlending,depthWrite:false});
    group.add(new THREE.Line(geo,mat));owned.push(geo,mat);
  }
  battle.fx.add(group);
  const cleanup=ownSpecialFx(battle,group,owned);
  const up=new THREE.Vector3(0,1,0), dir=new THREE.Vector3();
  let age=0, pulse=0;
  battle.ui?.popup?.(caster.pos,spec.name,'#eac9ff');
  battle.addEffect(dt=>{
    if (battle.ended || battle.__zelgrimDisposed || caster.dead) {cleanup();return false;}
    const step=Math.min(.08,Math.max(0,Number(dt)||0));
    age+=step; pulse-=step;
    const face=Number(caster.facing)||0;
    const fx=Math.sin(face),fz=Math.cos(face);
    group.position.set(caster.pos.x+fx*.7, caster.y+(caster.def.height||3.7)*.67, caster.pos.z+fz*.7);
    dir.set(fx,.012,fz).normalize();group.quaternion.setFromUnitVectors(up,dir);
    group.rotateY(step*3.4); // moving visible spiral, beam direction unchanged
    const fade=age<.2?age/.2:Math.max(0,(1.9-age)/.4);
    for(const obj of group.children) obj.material.opacity=(obj.isLine?.88:obj.material.color.getHex()===0xfffcdf?.95:.43)*Math.max(0,Math.min(1,fade));
    if(!remote && !caster.remoteAuth && age>.12 && age<1.55 && pulse<=0){
      pulse=.16;
      for(const enemy of battle.enemiesOf(caster)) {
        if(enemy.dead)continue;
        const dx=enemy.pos.x-caster.pos.x,dz=enemy.pos.z-caster.pos.z;
        const along=dx*fx+dz*fz;
        const across=Math.abs(dx*fz-dz*fx);
        if(along<0 || along>len+enemy.radius || across>1.05+enemy.radius)continue;
        battle.applyHit(caster,enemy,Number(spec.dmg)||690,.12,2.5,caster.pos,spec);
      }
    }
    if(age<1.9) return true;
    cleanup();return false;
  });
}

// Life-steal is based on HP actually lost after armor and guard, rather than
// restoring an invented fixed amount. A remote-target hit is sent through the
// normal networking path; remote damage confirmation is not available here.
function lifeAbsorption(battle, caster, spec, remote = false) {
  const group = new THREE.Group();group.name='maou-eclipse-drain';
  const geo = new THREE.TorusGeometry(1,.035,5,32);
  const mat = new THREE.MeshBasicMaterial({color:0xe8adff,transparent:true,opacity:.7,
    blending:THREE.AdditiveBlending,depthWrite:false});
  const ring = new THREE.Mesh(geo,mat);
  ring.rotation.x=Math.PI/2;group.add(ring);
  battle.fx.add(group);
  const cleanup=ownSpecialFx(battle,group,[geo,mat]);
  const radius=Number(spec.radius)||11.5;
  let age=0,pulse=0,healed=0;
  battle.ui?.popup?.(caster.pos,spec.name,'#edbaff');
  battle.addEffect(dt=>{
    if(battle.ended || battle.__zelgrimDisposed || caster.dead){cleanup();return false;}
    const step=Math.min(.08,Math.max(0,Number(dt)||0));
    age+=step;pulse-=step;
    group.position.set(caster.pos.x,.12,caster.pos.z);
    const grow=Math.min(1,age/.45);ring.scale.setScalar(radius*grow);
    mat.opacity=Math.max(0,.66*(1-age/1.85));ring.rotation.z+=step*1.4;
    if(!remote && !caster.remoteAuth && age>.17 && age<1.48 && pulse<=0){
      pulse=.24;
      let gained=0;
      for(const foe of battle.enemiesOf(caster)) {
        if(foe.dead || foe.pos.distanceTo(caster.pos)>radius+foe.radius)continue;
        const before=Math.max(0,Number(foe.hp)||0);
        // Six measured pulses; each respects the existing hit/defense system.
        const power=Math.min(1200,(Number(spec.dmg)||210)+foe.maxHp*.013);
        battle.applyHit(caster,foe,power,.10,1.4,caster.pos,spec);
        const after=Math.max(0,Number(foe.hp)||0);
        if(!foe.remoteAuth) gained+=Math.max(0,before-after);
        else gained+=Math.max(0,Math.min(before,400,Math.round(power*(caster.atkMul||1)*(foe.defMul||1)))); // estimated online drain
      }
      if(gained>0) {
        const amount=Math.max(0,Math.min(caster.maxHp-caster.hp,Math.round(gained*1.25)));
        caster.hp+=amount;healed+=amount;
        if(amount)battle.ui?.popup?.(caster.pos,'+'+amount+' HP吸収','#c7ffdc');
      }
    }
    if(age<1.85)return true;
    cleanup();return false;
  });
}

function reviveIfEligible(f){
  if(f.key!==KEY)return false;
  // One 50% roll PER knockout. Never reroll every rendered frame after failure.
  // Once HP has returned above zero, a later knockout is eligible again.
  if(f.hp>0){f.__maouKOAttempted=false;return false;}
  if(f.__maouKOAttempted || f.battle?.ended)return false;
  f.__maouKOAttempted=true;
  if(Math.random()>=.5)return false;
  f.hp=f.maxHp;f.dead=false;f.stun=0;f.status={};f.action=null;f.chantToken=null;
  f.__maouKOAttempted=false; // success: can roll on a later genuine knockout
  f.inv=2.5;f.maouGuardTime=30;f.maouRainbowTime=30;
  f.visual.rotation.set(0,0,0);f.root.rotation.x=0;
  f.battle?.ui?.popup?.(f.pos,'魔王再誕！ 50%復活成功（回数制限なし）','#ffe9a4');
  f.battle?.ui?.flash?.();f.battle?.ui?.sfx?.('burst');
  return true;
}

export function installMaouCombat({Battle,Fighter}) {
  if(!Battle?.prototype||!Fighter?.prototype||Battle.prototype.__maouInstalled)return;
  Battle.prototype.__maouInstalled=true;
  configureMaouV8(); // use the live imported FIGHTERS object in every mode
  // Zelgrim is loaded only when Maou actually joins a battle.
  // No GLB decoded on the title menu.
  if (FIGHTERS[SHADE]) {
    FIGHTERS[SHADE].name = BEAST_NAME;
    FIGHTERS[SHADE].title = '魔王の魔卵から生まれる召喚獣';
    FIGHTERS[SHADE].model = BEAST_ASSET;
  }
  const eggSkill = FIGHTERS.maou?.skills?.find(s => s.kind === 'maou_egg');
  if (eggSkill) {
    eggSkill.count=1;
    eggSkill.description='口から卵1個を産み、魔卵獣ゼルグリムが1体孵化。自動追尾攻撃・3回被弾で消滅・HPバーなし';
  }
  const FU=Fighter.prototype.update, FL=Fighter.prototype.startLight, FR=Fighter.prototype.receive;
  const FS=Fighter.prototype.applyStatus, FT=Fighter.prototype.tickStatus;
  const FB=Fighter.prototype.buildModel, FSK=Fighter.prototype.startSkill;
  Fighter.prototype.startSkill=function(i,hold,follow){
    if(this.key===KEY && i===4 && !follow) i=2; // healing button stays functional
    return FSK.call(this,i,hold,follow);
  };
  const BA=Battle.prototype.add;
  const BE=Battle.prototype.executeCast, BC=Battle.prototype.cast;
  const BH=Battle.prototype.applyHit, BD=Battle.prototype.dispose;
  const BAI=Battle.prototype.aiInput;
  if(typeof BAI==='function') Battle.prototype.aiInput=function(f,dt){
    const input=BAI.call(this,f,dt);
    if(f?.key===KEY && input?.skillIdx===2 && f.hp>=f.maxHp*.7)delete input.skillIdx;
    return input;
  };
  // Intercept only this summon. The real player models are completely unchanged.
  Fighter.prototype.buildModel=function(gltf){
    if(this.key===SHADE){createBeastVisual(this);return;}
    return FB.call(this,gltf);
  };
  ZelgrimFighterConstructor = Fighter;
  Battle.prototype.add=function(key, options){
    const fighter=BA.call(this,key,options);
    if (key===KEY && !fighter.remoteAuth) prepareZelgrim(this,fighter);
    return fighter;
  };
  Fighter.prototype.update=function(dt,input){
    if(this.key===SHADE){
      if(this.__maouRetiring)return;
      if(!this.maouOwner || this.maouOwner.dead || this.maouOwner.transformed){
        retireBeast(this);return;
      }
      // A summon-side AI or animation error must NEVER abort the main
      // battle render/update loop on a low-memory mobile device.
      try {
        const result=FU.call(this,dt,input);
        if(this.dead){retireBeast(this);return result;}
        walkBeast(this,dt);
        return result;
      } catch(error) {
        console.error('[Zelgrim V7.4] 召喚獣を安全停止:',error);
        retireBeast(this);
        return;
      }
    }
    if(this.key!==KEY)return FU.call(this,dt,input);
    const inp={...(input||{})};const holdingGuard=!!inp.guard,holdingAttack=!!inp.attack;
    this.maouGuardTime=Math.max(0,(this.maouGuardTime||0)-dt);
    this.maouRainbowTime=Math.max(0,(this.maouRainbowTime||0)-dt);
    if(!this.dead && !this.remoteAuth){
      if(holdingGuard && (!this.maouGuardHeld || this.maouGuardTime<=0))guardStarted(this);
      if(holdingAttack && !this.maouAttackHeld)rainbowStarted(this);
      if(this.maouGuardTime>0)this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.033*dt);
    }
    this.maouGuardHeld=holdingGuard;this.maouAttackHeld=holdingAttack;
    if(this.maouGuardTime>0 && !this.dead)updateAura(this,'regen',dt);else stopAura(this,'regen');
    if(this.maouRainbowTime>0 && !this.dead)updateAura(this,'rainbow',dt);else stopAura(this,'rainbow');
    if(this.maouRainbowTime>0){this.stun=0;delete this.status.freeze;delete this.status.petrify;}
    // Attack/guard are stances; they must not steal K/U/L/H spell inputs.
    inp.attack=false;inp.guard=false;
    const result=FU.call(this,dt,inp);
    reviveIfEligible(this);return result;
  };
  Fighter.prototype.startLight=function(){
    if(this.key===KEY){rainbowStarted(this);return;}
    return FL.call(this);
  };
  Fighter.prototype.receive=function(damage,stun,kx,kz){
    if(this.key===SHADE){
      if(this.dead||this.inv>0)return 0;
      this.maouShadeHits=(this.maouShadeHits||0)+1;this.inv=.3;
      this.battle?.spark?.(this.pos.clone().setY(.8),0x43ff75,.8);
      if(this.maouShadeHits>=3){retireBeast(this);
        this.battle?.ui?.popup?.(this.pos,BEAST_NAME+' 消滅','#a8ffb4');}
      else this.battle?.ui?.popup?.(this.pos,`${BEAST_NAME} 被弾 ${this.maouShadeHits}/3`,'#a8ffb4');
      return 1;
    }
    if(this.key!==KEY)return FR.call(this,damage,stun,kx,kz);
    if(this.maouRainbowTime>0){damage*=.5;stun=0;kx=0;kz=0;this.stun=0;clangSound(this);}
    const r=FR.call(this,damage,stun,kx,kz);
    reviveIfEligible(this);return r;
  };
  Fighter.prototype.applyStatus=function(key){
    if(this.key===SHADE)return;
    if(this.key===KEY&&this.maouRainbowTime>0)return;
    return FS.call(this,key);
  };
  Fighter.prototype.tickStatus=function(dt){const x=FT.call(this,dt);if(this.key===KEY)reviveIfEligible(this);return x;};
  Battle.prototype.cast=function(f,slot,net){
    if(f?.key===KEY&&slot==='mg'){guardStarted(f,true);return;}
    if(f?.key===KEY&&slot==='mr'){rainbowStarted(f,true);return;}
    return BC.call(this,f,slot,net);
  };
  Battle.prototype.executeCast=function(f,slot,net){
    const key=f?.key;
    if(key!==KEY)return BE.call(this,f,slot,net);
    const idx=Math.max(0,Math.min((f.def.skills?.length||1)-1,+slot.slice(1)||0));
    const spec=slot==='over'?f.def.over:slot==='hi'?f.def.hi:
      slot[0]==='f'?null:f.def.skills[idx];
    const previous=f.netCastAt;
    const out=BE.call(this,f,slot,net);
    if(net&&f.remoteAuth&&previous===f.netCastAt)return out;
    if(!spec||slot[0]==='f')return out;
    if(spec.kind==='maou_eye_laser')eyeLaser(this,f,spec,!!f.remoteAuth);
    else if(spec.kind==='maou_egg')hatching(this,f,spec,!!f.remoteAuth);
    else if(spec.kind==='maou_fullheal')fullHeal(this,f,!!f.remoteAuth);
    else if(spec.kind==='maou_spiral_beam')spiralPiercingBeam(this,f,spec,!!f.remoteAuth);
    else if(spec.kind==='maou_life_absorb')lifeAbsorption(this,f,spec,!!f.remoteAuth);
    else actionVisual(this,f,spec,slot);
    return out;
  };
  Battle.prototype.applyHit=function(att,tgt,...rest){
    if(att?.key===SHADE&&att.maouOwner&&!att.maouOwner.dead) return BH.call(this,att.maouOwner,tgt,...rest);
    return BH.call(this,att,tgt,...rest);
  };
  Battle.prototype.dispose=function(){
    for(const cleanup of this.__maouV8Cleanups||[])cleanup();
    this.__maouV8Cleanups?.clear();
    this.__zelgrimDisposed=true;
    for(const f of this.fighters||[]){
      stopAura(f,'rainbow');stopAura(f,'regen');
    }
    // Dormant reservations are not in Battle.fighters and must be released here.
    for (const beast of this.__zelgrimPool?.values?.() || []) {
      if(this.fighters?.includes(beast)) continue; // original dispose handles live beasts
      beast.root.removeFromParent();
      if(beast.modelInstance){
        disposeModel(beast.modelInstance,beast.mixer);
        beast.modelInstance=null;
      }
    }
    this.__zelgrimPool?.clear();
    this.__zelgrimPreparing?.clear();
    return BD.call(this);
  };
}
