import * as THREE from 'three';
const KEYS = new Set(['gaizorg','gaizorg-boss','operator-gigantes']);
const FIRE = 0xff6824;
const PURPLE = 0xb45bff;
const GUARD_SLOT = 'gaiz_guard';
const ATTACK_SLOT = 'gaiz_attack';
const FLAME_SLOT = 's0';
const FIREBALL_SLOT = 's1';
const SEAL_URL = new URL('./assets/fx/gaizorg-fire-circle-v25.png', import.meta.url).href;
let sealTexture = null;
function isGaizorgKey(k){ return KEYS.has(k); }
function nowSec(){ return (performance?.now?.() || Date.now())/1000; }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function ensureTex(urlMaker){ if(!sealTexture){ sealTexture = new THREE.TextureLoader().load(SEAL_URL); sealTexture.colorSpace=THREE.SRGBColorSpace; } return sealTexture; }
function makeCanvasTex(kind){
  const c=document.createElement('canvas'); c.width=c.height=256; const g=c.getContext('2d');
  if(kind==='flame'){ const rg=g.createRadialGradient(128,170,16,128,128,116); rg.addColorStop(0,'rgba(255,255,255,0.95)'); rg.addColorStop(0.22,'rgba(255,245,180,0.95)'); rg.addColorStop(0.45,'rgba(255,132,0,0.95)'); rg.addColorStop(0.75,'rgba(255,50,0,0.8)'); rg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=rg; g.beginPath(); g.moveTo(128,16); g.quadraticCurveTo(180,92,194,154); g.quadraticCurveTo(202,228,128,242); g.quadraticCurveTo(54,228,62,154); g.quadraticCurveTo(76,92,128,16); g.fill(); }
  else if(kind==='purplePunch'){ g.fillStyle='rgba(164,84,255,0.96)'; g.strokeStyle='rgba(244,214,255,0.98)'; g.lineWidth=9; g.beginPath(); g.moveTo(56,160); g.lineTo(74,90); g.lineTo(112,56); g.lineTo(156,52); g.lineTo(196,74); g.lineTo(212,120); g.lineTo(204,172); g.lineTo(170,206); g.lineTo(112,214); g.lineTo(74,196); g.closePath(); g.fill(); g.stroke(); }
  else if(kind==='beam'){ const lg=g.createLinearGradient(0,128,256,128); lg.addColorStop(0,'rgba(255,255,255,0)'); lg.addColorStop(0.2,'rgba(255,210,120,0.95)'); lg.addColorStop(0.45,'rgba(255,255,255,1)'); lg.addColorStop(0.75,'rgba(255,110,30,0.95)'); lg.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle=lg; g.fillRect(0,98,256,60); }
  else if(kind==='nova'){ const rg=g.createRadialGradient(128,128,10,128,128,120); rg.addColorStop(0,'rgba(255,255,255,1)'); rg.addColorStop(0.18,'rgba(255,230,160,1)'); rg.addColorStop(0.44,'rgba(255,154,30,0.95)'); rg.addColorStop(0.78,'rgba(255,70,0,0.7)'); rg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle=rg; g.beginPath(); g.arc(128,128,118,0,Math.PI*2); g.fill(); }
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.needsUpdate=true; return t;
}
function sprite(tex, scale=2.2, color=0xffffff, opacity=1){
  const m = new THREE.SpriteMaterial({map:tex,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const s = new THREE.Sprite(m); s.scale.set(scale,scale,scale); s.renderOrder=15; return s;
}
function plane(tex, scale=2.2, color=0xffffff, opacity=1){
  const m = new THREE.MeshBasicMaterial({map:tex,color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
  const p = new THREE.Mesh(new THREE.PlaneGeometry(2,2), m); p.scale.set(scale,scale,scale); p.renderOrder=15; return p;
}
function enemies(owner, radius=999){
  const out=[], rr=radius*radius; for(const f of owner.battle?.fighters||[]){ if(f===owner||f.dead||f.team===owner.team) continue; const dx=f.pos.x-owner.pos.x,dz=f.pos.z-owner.pos.z; if(dx*dx+dz*dz<=rr) out.push(f); } return out;
}
function nearest(owner, radius=999){ let best=null, bd=radius*radius; for(const f of owner.battle?.fighters||[]){ if(f===owner||f.dead||f.team===owner.team) continue; const dx=f.pos.x-owner.pos.x,dz=f.pos.z-owner.pos.z,d=dx*dx+dz*dz; if(d<bd){bd=d; best=f;} } return best; }
function hit(owner, target, dmg, stun=0.12, kb=0.35){ if(!target||target.dead||target.team===owner.team) return; const dx=target.pos.x-owner.pos.x,dz=target.pos.z-owner.pos.z,m=Math.hypot(dx,dz)||1; target.receive?.(dmg,stun,dx/m*kb,dz/m*kb); }
function addBurn(owner, target, sec=5){ if(!target||target.dead) return; target._gaizBurn = { until: nowSec()+sec, next: nowSec()+1, source: owner, left: sec }; }
export function installGaizorgCombat({ Battle, Fighter, FIGHTERS }){
  if(!Battle?.prototype || !Fighter?.prototype || Battle.prototype.__rfGaizV25) return;
  Battle.prototype.__rfGaizV25 = true;
  for(const k of KEYS){ const s=FIGHTERS?.[k]; if(!s) continue; s.attribute='炎'; s.element=3; s.hp=Math.max(99999, Number(s.hp)||0, 62000); s.speed=8.2; s.power=1.0; s.armor=0.16; s.overGain=2.0; s.fluxMul=1.0; s.light={dmg:0,range:0,shots:0,color:FIRE}; s.skills=[{name:'火炎放射',kind:'projectile',cost:0,castTime:0.1,dmg:0},{name:'散華火炎弾',kind:'projectile',cost:0,castTime:0.1,dmg:0},{name:'予備',kind:'projectile',cost:0,castTime:0.1,dmg:0},{name:'予備2',kind:'projectile',cost:0,castTime:0.1,dmg:0},{name:'予備3',kind:'projectile',cost:0,castTime:0.1,dmg:0}]; s.over={name:'バーンストライク',kind:'projectile',cost:0,castTime:0.3,dmg:0}; s.hi={name:'エンシェントノヴァ',kind:'projectile',cost:0,castTime:0.45,dmg:0,hi:true}; delete s.pool; s.fixedSlots=true; }

  const oldApplyRed = Fighter.prototype.applyRed;
  Fighter.prototype.applyRed=function(){ if(isGaizorgKey(this.key)){ this.redMats=[]; return; } return oldApplyRed.call(this); };

  function startGuard(owner, sec=5){
    const b=owner.battle; if(!b?.fx) return;
    if(owner._gaizSeal?.group?.parent){ owner._gaizSeal.t = sec; return; }
    const g=new THREE.Group();
    const p=plane(ensureTex(), 6.7, 0xffffff, 0.9); p.rotation.x=-Math.PI/2; p.position.y=0.12; g.add(p); b.fx.add(g);
    owner._gaizSeal = {group:g,p,t:sec,rot:0}; b.ui?.popup?.(owner.pos,'炎陣・灼鎖結界','#ffbd74');
  }
  function tickGuard(owner, dt){ const st=owner._gaizSeal; if(!st) return; st.t-=dt; if(owner.dead||owner.battle?.ended||st.t<=0||!st.group.parent){ st.group.removeFromParent(); owner._gaizSeal=null; return; } st.rot+=dt*0.85; st.group.position.set(owner.pos.x,0.08,owner.pos.z); st.group.rotation.y=st.rot; st.p.material.opacity=0.82+0.12*Math.sin(st.rot*2.0); for(const e of enemies(owner,5.8)){ addBurn(owner,e,5); } }
  function doPunch(owner){ const b=owner.battle; if(!b?.fx) return; const t=nearest(owner,5.2); const sp=sprite(owner._gaizPunchTex ||= makeCanvasTex('purplePunch'), 3.5, 0xffffff, 0.94); sp.position.copy(owner.pos).add(new THREE.Vector3(0,2.2,0)); b.fx.add(sp); let time=0, done=false; b.addEffect?.((dt)=>{ time+=dt; const k=clamp(time/0.28,0,1); const tar=t?.pos||owner.pos; sp.position.set(owner.pos.x+(tar.x-owner.pos.x)*k*0.75, 2.2+Math.sin(k*mathPI)*0.55, owner.pos.z+(tar.z-owner.pos.z)*k*0.75); sp.scale.setScalar(3.2+k*1.2); sp.material.opacity=0.96*(1-k*0.35); if(!done && k>=0.78 && t){ hit(owner,t,780,0.18,0.55); done=true; } if(k>=1){ sp.removeFromParent(); sp.material.dispose(); return false; } return true; }); }
  const mathPI = Math.PI;
  function startFlamethrower(owner){ owner._gaizFlameHeld=true; }
  function tickFlamethrower(owner, dt){ if(!owner._gaizFlameHeld || owner.dead) return; if((owner.flux||0) <= 0){ owner._gaizFlameHeld=false; return; } owner.flux = Math.max(0,(owner.flux||0) - 18*dt); const b=owner.battle; if(!b?.fx) return; if(!owner._gaizFlameFx?.group?.parent){ const g=new THREE.Group(); const beam=plane(owner._gaizBeamTex ||= makeCanvasTex('beam'), 6.4, 0xffffff, 0.92); beam.position.y=2.7; g.add(beam); b.fx.add(g); owner._gaizFlameFx={group:g,beam,time:0,hitClock:0}; }
    const fx=owner._gaizFlameFx; fx.time+=dt; fx.hitClock+=dt; fx.group.position.copy(owner.pos); fx.beam.rotation.y=owner.facing||0; fx.beam.material.opacity=0.84+0.14*Math.sin(fx.time*10); if(fx.hitClock>=0.18){ fx.hitClock=0; for(const e of enemies(owner,11)){ const dx=e.pos.x-owner.pos.x,dz=e.pos.z-owner.pos.z; const ang=Math.atan2(dx,dz); let diff=Math.abs(((ang-(owner.facing||0)+Math.PI*3)%(Math.PI*2))-Math.PI); if(diff<0.36){ hit(owner,e,210,0.06,0.08); addBurn(owner,e,5); } } }
  }
  function stopFlamethrower(owner){ owner._gaizFlameHeld=false; if(owner._gaizFlameFx?.group){ owner._gaizFlameFx.group.removeFromParent(); owner._gaizFlameFx.beam.material.dispose(); owner._gaizFlameFx=null; } }
  function fireballs(owner){ const b=owner.battle; if(!b?.fx) return; const tex=owner._gaizFlameTex ||= makeCanvasTex('flame'); const g=new THREE.Group(); b.fx.add(g); const shots=[]; for(let i=0;i<16;i++){ const sp=sprite(tex,1.0+Math.random()*0.5,0xffffff,0.94); sp.position.set(owner.pos.x+(Math.random()*18-9), 6+Math.random()*4, owner.pos.z+(Math.random()*18-9)); g.add(sp); shots.push({sp,x:sp.position.x,z:sp.position.z,delay:i*0.05,done:false}); }
    let t=0; b.addEffect?.((dt)=>{ t+=dt; for(const s of shots){ if(s.done||t<s.delay) continue; const k=clamp((t-s.delay)/0.55,0,1); s.sp.position.y=8-k*8; s.sp.material.opacity=0.92*(1-k*0.25); if(k>=1){ s.done=true; for(const e of b.fighters||[]){ if(e===owner||e.dead||e.team===owner.team) continue; const dx=e.pos.x-s.x,dz=e.pos.z-s.z; if(dx*dx+dz*dz<=7.5){ hit(owner,e,530,0.1,0.15); addBurn(owner,e,5); } } s.sp.visible=false; } } if(shots.every(s=>s.done)){ g.removeFromParent(); for(const s of shots) s.sp.material.dispose(); return false; } return true; }); b.ui?.popup?.(owner.pos,'散華火炎弾','#ffbc85'); }
  function burnStrike(owner){ const b=owner.battle; if(!b?.fx) return; const target=nearest(owner,18); if(!target) return; const tex=owner._gaizNovaTex ||= makeCanvasTex('nova'); const slash=sprite(tex,4.8,0xffffff,0.94); b.fx.add(slash); let t=0, landed=false; b.addEffect?.((dt)=>{ t+=dt; const k=clamp(t/0.95,0,1); slash.position.set(target.pos.x, 7.2 - k*4.8, target.pos.z); slash.scale.setScalar(3.5 + k*4.2); slash.material.rotation += dt*3.0; if(!landed && k>=0.7){ landed=true; for(const e of enemies(owner,8.5)){ const dx=e.pos.x-target.pos.x,dz=e.pos.z-target.pos.z; if(dx*dx+dz*dz<=72){ hit(owner,e,2600,0.35,0.7); addBurn(owner,e,5); } } } if(k>=1){ slash.removeFromParent(); slash.material.dispose(); return false; } return true; }); b.ui?.popup?.(owner.pos,'バーンストライク','#ffd095'); }
  function ancientNova(owner){ const b=owner.battle; if(!b?.fx) return; const tex=owner._gaizNovaTex ||= makeCanvasTex('nova'); const nova=sprite(tex,3.5,0xffffff,0.98); b.fx.add(nova); let t=0, pulse=0; b.addEffect?.((dt)=>{ t+=dt; pulse+=dt; nova.position.set(owner.pos.x,2.5,owner.pos.z); nova.scale.setScalar(3.5+t*6.5); nova.material.rotation += dt*1.8; nova.material.opacity = 0.96*(1-clamp((t-1.3)/0.5,0,1)); if(pulse>=0.2){ pulse=0; const rr=5+t*5.5; for(const e of enemies(owner,rr)){ hit(owner,e,420,0.08,0.08); addBurn(owner,e,5); } } if(t>=1.8){ nova.removeFromParent(); nova.material.dispose(); return false; } return true; }); b.ui?.popup?.(owner.pos,'エンシェントノヴァ','#ffe5ab'); }

  const oldExecute = Battle.prototype.executeCast;
  Battle.prototype.executeCast=function(fighter,slot,networkCast){
    if(isGaizorgKey(fighter?.key) && !this.ended){
      if(slot===GUARD_SLOT){ startGuard(fighter,5); return; }
      if(slot===ATTACK_SLOT){ doPunch(fighter); return; }
      if(slot===FLAME_SLOT){ startFlamethrower(fighter); return; }
      if(slot===FIREBALL_SLOT){ fireballs(fighter); return; }
      if(slot==='over'){ burnStrike(fighter); fighter.over=0; return; }
      if(slot==='hi'){ ancientNova(fighter); fighter.over=0; return; }
    }
    return oldExecute.call(this,fighter,slot,networkCast);
  };

  const oldCast = Battle.prototype.cast;
  Battle.prototype.cast=function(fighter,slot,net){
    if(isGaizorgKey(fighter?.key) && !this.ended && !fighter.dead && (slot===GUARD_SLOT||slot===ATTACK_SLOT)){
      if(!net && !fighter.remoteAuth && this.net && fighter.netId){ this.net.cast({id:fighter.netId,slot,tx:fighter.pos.x,tz:fighter.pos.z,ry:fighter.facing}); }
      return oldCast.call(this,fighter,slot,true);
    }
    return oldCast.call(this,fighter,slot,net);
  };

  const oldStartOver = Fighter.prototype.startOver;
  Fighter.prototype.startOver=function(...args){ if(!isGaizorgKey(this.key)) return oldStartOver.apply(this,args); if(this.over<100||this.dead) return; const slot=this._rfGaizFinisher===5?'hi':'over'; if(slot==='hi' && this.awakened<=0){ this.battle?.ui?.popup?.(this.pos,'秘奥義は覚醒中のみ','#ffcf96'); return; } this.battle?.cast(this,slot); };

  const oldUpdate = Fighter.prototype.update;
  Fighter.prototype.update=function(dt,input){
    if(!isGaizorgKey(this.key)) return oldUpdate.call(this,dt,input);
    const next={...(input||{})}; const g=!!next.guard, a=!!next.attack;
    if(g && !this._gaizGPrev) this.battle?.cast(this,GUARD_SLOT);
    if(a && !this._gaizAPrev) this.battle?.cast(this,ATTACK_SLOT);
    this._gaizGPrev=g; this._gaizAPrev=a; next.guard=false; next.attack=false;
    const heldSkill = !!next.skill; const res = oldUpdate.call(this,dt,next); const sec=Math.max(0, Math.min(0.06, Number(dt)||0));
    if(heldSkill) startFlamethrower(this); else stopFlamethrower(this);
    tickFlamethrower(this,sec); tickGuard(this,sec);
    const tNow=nowSec();
    for(const e of this.battle?.fighters||[]){ const b=e._gaizBurn; if(b && b.until>tNow && b.left>0){ if(tNow>=b.next){ b.next+=1; b.left-=1; e.receive?.(Math.max(1,(e.maxHp||1000)/10), 0.04, 0, 0); } } else if(b){ e._gaizBurn=null; } }
    return res;
  };

  const oldDispose = Battle.prototype.dispose;
  Battle.prototype.dispose=function(...args){ for(const f of this.fighters||[]){ if(f._gaizSeal?.group) f._gaizSeal.group.removeFromParent(); stopFlamethrower(f); } return oldDispose.apply(this,args); };
}
