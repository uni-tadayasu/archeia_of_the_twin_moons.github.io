// RF_NEPTERION_OCEAN_V26 — CG-painted water spell overhaul.
// Original GLB geometry, rig, materials and textures are never modified.
import * as THREE from 'three';
import { FIGHTERS } from './data.js?v=rf-v9-2-20261109';
const KEY='nepterion', COLOR=0x69ddff, elem=7, PI=Math.PI;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const clock=()=>performance.now()/1000;
const MAPS={
  seal:'nep-ice-seal-v26.webp',shield:'nep-aegis-v26.webp',
  beam:'nep-eye-beam-v26.webp',stars:'nep-stars-v26.webp',
  punch:'nep-punch-v26.webp',drill:'nep-drill-v26.webp',heal:'nep-heal-v26.webp'
};
const textureCache=new Map();
const sharedQuad=new THREE.PlaneGeometry(1,1);
function texture(key){
  if(textureCache.has(key))return textureCache.get(key);
  const t=new THREE.TextureLoader().load(new URL('./assets/fx/'+MAPS[key],import.meta.url).href,undefined,undefined,
    e=>console.warn('[NEPTERION CG]',key,'画像が読めません',e));
  t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=2;
  textureCache.set(key,t);return t;
}
function fxmat(key,opacity=0.9,color=0xffffff){
  return new THREE.MeshBasicMaterial({map:texture(key),color,transparent:true,opacity,depthWrite:false,
    depthTest:true,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
}
function group(b){const g=new THREE.Group();b.fx.add(g);(b._rfNepGroups||=new Set()).add(g);return g;}
function endgroup(b,g){if(!g)return;g.removeFromParent();g.traverse(o=>{if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});b._rfNepGroups?.delete(g);}
function imagePlane(key,w,h=w,opacity=.9){const m=new THREE.Mesh(sharedQuad,fxmat(key,opacity));m.scale.set(w,h,1);m.renderOrder=15;return m;}
function imageSprite(key,w,h=w,opacity=.9){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:texture(key),transparent:true,opacity,depthWrite:false,
  depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false}));m.scale.set(w,h,1);m.renderOrder=15;return m;}
function effect(b,g,duration,update){let t=0; b.addEffect?.(dt=>{if(b.ended){endgroup(b,g);return false;}t+=Math.max(0,Math.min(.08,dt||0));update(t,dt||0);if(t>=duration){endgroup(b,g);return false;}return true;});}
function enemies(f,radius=100){const o=[],r2=radius*radius;for(const e of f.battle.fighters||[]){if(e===f||e.dead||e.team===f.team)continue;const dx=e.pos.x-f.pos.x,dz=e.pos.z-f.pos.z;if(dx*dx+dz*dz<=r2)o.push(e);}return o;}
function nearest(f,radius=100){let e=null,d=radius*radius;for(const x of enemies(f,radius)){const dx=x.pos.x-f.pos.x,dz=x.pos.z-f.pos.z;const s=dx*dx+dz*dz;if(s<d){d=s;e=x;}}return e;}
const spell=(name,cost,dmg,castTime,color=COLOR)=>({name,kind:'projectile',cost,dmg,castTime,elem,color,vivid:true});
const SKILLS=[
  spell('蒼眼双流《ネレイド・レーザー》',18,90,.40),
  spell('氷河星群《コールド・シャワー》',15,30,.42),
  spell('命潮再生《アクア・リヴァイヴ》',15,0,.32),
  spell('大海嘯《タイダル・アルケー》',23,160,.75),
  spell('万象水護《アビス・バリア》',20,0,.33),
  spell('深淵渦葬《マエルストロム》',27,65,.95),
  spell('蒼龍水槍《ネプトゥーン・ランス》',21,32,.62),
  spell('絶対氷縛《フロスト・プリズン》',24,92,.77),
  spell('氷晶星雨《グレイシャル・レイン》',25,46,.85),
  spell('海皇天瀑《アクア・ジャッジメント》',31,180,1.25),
  spell('水神裂界《アビス・ブレイカー》',33,275,1.30),
  spell('万海終式《オーシャン・リゾナンス》',37,62,1.55)
];
export const NEPTERION_V26_SPELLS=SKILLS;
function installStats(def){
  if(!def)return;
  // Baseline is the ordinary roster (roughly 1000-1500 HP, speed ~6, power ~1),
  // NOT the historical 52000 HP / 3.65x damage version.
  Object.assign(def,{attribute:'水',hp:1250,speed:5.9,power:1.02,armor:.96,overGain:1.09,fluxMul:1.08,
    light:{dmg:55,range:3.1,color:COLOR},skills:SKILLS.map(x=>({...x})),
    over:spell('覇海終極《アクア・カタストロフ》',0,430,1.85),
    hi:{...spell('創世絶海《エターナル・アビス》',0,120,2.85),hi:true},
    fixedSlots:true});delete def.pool;
}
function announce(b,f,text,slot){
  if(slot==='hi'){b.ui?.cutin?.(f,text,'秘奥義');b.ui?.banner?.(f,text);b.slowmo=Math.max(b.slowmo||0,.55);}
  else if(slot==='over'){b.ui?.banner?.(f,text);b.slowmo=Math.max(b.slowmo||0,.3);}
  else b.ui?.callout?.(f,text);
  b.ui?.sfx?.('skill');
}
function hit(b,f,e,dmg,stun=.15,kb=1.5){
  if(f.remoteAuth||e.dead)return;
  // Existing validation & online hit transport, never write another player's HP directly.
  b.applyHit?.(f,e,dmg,stun,kb,f.pos,{name:'海皇水術',kind:'projectile',elem,color:COLOR});
}
// Tint frozen opponents without changing GLB source or accidentally coloring shared materials.
function frostTint(e){
  if(e._rfNepFrostMats)return;
  const rows=[];e.visual?.traverse(o=>{if(!o.isMesh||!o.material)return;
    const old=o.material;
    const clones=(Array.isArray(old)?old:[old]).map(src=>{const m=src.clone();m.color?.setHex?.(0x8eeeff);
      if(m.emissive){m.emissive.setHex(0x298bcd);m.emissiveIntensity=Math.max(.22,m.emissiveIntensity||0);}return m;});
    o.material=Array.isArray(old)?clones:clones[0];rows.push({o,old,clones});
  });e._rfNepFrostMats=rows;
}
function restoreFrost(e){
  for(const r of e._rfNepFrostMats||[]){r.o.material=r.old;for(const m of r.clones)m.dispose();}
  e._rfNepFrostMats=null;
}
function freeze(b,e,duration=1.4){
  if(e.dead)return;
  e._rfNepFreezeUntil=Math.max(e._rfNepFreezeUntil||0,clock()+duration);
  if(!e.remoteAuth){e.status||={};e.status.freeze=Math.max(e.status.freeze||0,duration);
    e.stun=Math.max(e.stun||0,duration);e.vel?.set?.(0,0,0);}
  frostTint(e);
}
function groundField(f,seconds=20){
  const b=f.battle;let x=f._rfNepField;
  if(x?.g?.parent){x.end=clock()+seconds;return;}
  const g=group(b),m=imagePlane('seal',10.4,10.4,.9);m.rotation.x=-PI/2;
  m.position.y=.08;g.add(m);x={g,m,end:clock()+seconds,phase:0};f._rfNepField=x;
  b.ui?.popup?.(f.pos,'氷界魔法陣｜20秒・再使用制限なし','#8feaff');
}
function tickField(f,dt){const x=f._rfNepField;if(!x)return;
  if(f.dead||f.battle.ended||clock()>x.end){endgroup(f.battle,x.g);f._rfNepField=null;return;}
  x.phase+=dt*.5;x.g.position.set(f.pos.x,0,f.pos.z);x.g.rotation.y=x.phase;
  x.m.material.opacity=.72+.17*Math.sin(x.phase*3.6);
  for(const e of enemies(f,4.7))freeze(f.battle,e,1.15);
}
function shield(f){let x=f._rfNepShield;
  if(x?.g?.parent){x.until=clock()+20;return;}
  const g=new THREE.Group(),a=imageSprite('shield',3.7,3.7,.82),c=imageSprite('shield',3.15,3.15,.66);
  f.visual?.add(g);g.add(a,c);x={g,a,c,until:clock()+20,phase:0};f._rfNepShield=x;
  f.battle.ui?.popup?.(f.pos,'蒼氷護環：防御2倍・20秒','#b6faff');
}
function tickShield(f,dt){const x=f._rfNepShield;if(!x)return;
  if(f.dead||clock()>x.until){x.g.removeFromParent();x.a.material.dispose();x.c.material.dispose();f._rfNepShield=null;return;}
  x.phase+=dt*1.7;x.g.position.y=(f.def.height||2)*.5;
  x.a.material.rotation=x.phase;x.c.material.rotation=-x.phase*.8;
  x.a.scale.setScalar(3.5+.13*Math.sin(x.phase*2));x.c.scale.setScalar(3.0+.13*Math.cos(x.phase*2));
}
function regen(f){let x=f._rfNepRegen;
  if(x?.g?.parent){x.until=clock()+20;return;}
  const g=new THREE.Group(),balls=[];f.visual?.add(g);
  for(let i=0;i<5;i++){const s=imageSprite('heal',1.1,1.1,.8);g.add(s);balls.push(s);}
  x={g,balls,until:clock()+20,phase:0};f._rfNepRegen=x;
  f.battle.ui?.popup?.(f.pos,'命潮再生・20秒','#a4f9ff');
}
function tickRegen(f,dt){const x=f._rfNepRegen;if(!x)return;
  if(f.dead||clock()>x.until){x.g.removeFromParent();for(const s of x.balls)s.material.dispose();f._rfNepRegen=null;return;}
  f.hp=Math.min(f.maxHp,f.hp+f.maxHp*.009*dt);x.phase+=dt*2.6;x.g.position.y=1.5;
  x.balls.forEach((s,i)=>{const a=x.phase+i*PI*2/5;s.position.set(Math.sin(a)*1.25,Math.cos(a*1.5)*.5,Math.cos(a)*1.25);});
}
function waterSlash(f){const b=f.battle,t=nearest(f,4.8),g=group(b),sp=imageSprite('stars',3.2,2.6,.85);
  g.add(sp);g.position.copy(f.pos).add(new THREE.Vector3(0,1.8,1.3));
  effect(b,g,.26,(tt)=>{const k=tt/.26;sp.material.rotation=k*1.7;sp.material.opacity=.85*(1-k);
    g.position.set(f.pos.x+Math.sin(f.facing)*1.8,1.8,f.pos.z+Math.cos(f.facing)*1.8);});
  if(t)hit(b,f,t,55,.12,1);
}
function twinEyeBeam(f,dmg){const b=f.battle,g=group(b),a=imagePlane('beam',12,4,.87),c=imagePlane('beam',12,4,.72);
  g.add(a,c);a.rotation.x=-PI/2;c.rotation.y=PI/2;
  a.position.set(-.18,1.1,6);c.position.set(.18,1.3,6);
  const visited=new Set();effect(b,g,.85,(t,dt)=>{
    const phase=clamp(t/.85,0,1),angle=f.facing-.65+phase*1.3;
    g.position.set(f.pos.x,1.4,f.pos.z);g.rotation.y=angle;
    a.material.opacity=c.material.opacity=Math.max(0,.86*(1-phase*.7));
    for(const e of enemies(f,12.5)){
      if(visited.has(e))continue;const dx=e.pos.x-f.pos.x,dz=e.pos.z-f.pos.z;
      const diff=Math.atan2(Math.sin(Math.atan2(dx,dz)-angle),Math.cos(Math.atan2(dx,dz)-angle));
      if(Math.abs(diff)<.22){visited.add(e);hit(b,f,e,dmg,.17,1.6);}
    }
  });
}
function rainOrbs(f,n,rad,dmg,kind='stars'){
  const b=f.battle,g=group(b),arr=[];const target=nearest(f,15)?.pos||f.pos;
  for(let i=0;i<n;i++){
    const sp=imageSprite(kind,.95+Math.random()*.5,1.0+Math.random()*.5,.85);
    const theta=Math.random()*2*PI,r=Math.sqrt(Math.random())*rad;
    const x=target.x+Math.cos(theta)*r,z=target.z+Math.sin(theta)*r;
    sp.position.set(x,7+Math.random()*2.5,z);g.add(sp);arr.push({sp,x,z,d:i*.055,hit:false});
  }
  effect(b,g,1.95,(t)=>{for(const x of arr){const p=clamp((t-x.d)/.52,0,1);if(t<x.d){x.sp.visible=false;continue;}
    x.sp.visible=p<1;x.sp.position.y=8*(1-p)+.2;x.sp.material.opacity=.9*(1-p*.2);
    if(p>=1&&!x.hit){x.hit=true;for(const e of enemies(f,20)){
      const dx=e.pos.x-x.x,dz=e.pos.z-x.z;if(dx*dx+dz*dz<3.1)hit(b,f,e,dmg,.10,.45);
    }}
  }});
}
function wave(f,dmg,scale=1){const b=f.battle,g=group(b),pic=imageSprite('stars',10*scale,4.5*scale,.92);
  g.add(pic);const hitOnce=new Set();effect(b,g,1.05,(t)=>{
    const progress=clamp(t/1.05,0,1),distance=1+progress*11*scale;
    g.position.set(f.pos.x+Math.sin(f.facing)*distance,1.4,f.pos.z+Math.cos(f.facing)*distance);
    pic.material.opacity=.92*(1-progress);pic.scale.set(8*scale,4.4*scale*(1+progress),1);
    for(const e of enemies(f,15*scale)){
      if(hitOnce.has(e))continue;const dx=e.pos.x-g.position.x,dz=e.pos.z-g.position.z;
      if(dx*dx+dz*dz<(3.6*scale)**2){hitOnce.add(e);hit(b,f,e,dmg,.3,2.6);}
    }
  });
}
function whirlpool(f,dmg,pulses=4){const b=f.battle,g=group(b),sp=imagePlane('seal',8,8,.82);
  sp.rotation.x=-PI/2;g.add(sp);const target=nearest(f,12)?.pos||f.pos;
  g.position.set(target.x,0,target.z);let count=0;
  effect(b,g,2.2,(t)=>{sp.material.opacity=.75*(1-t/2.8);g.rotation.y=t*1.7;
    const ticks=Math.min(pulses,Math.floor(t/.45));if(ticks>count){count=ticks;
      for(const e of enemies(f,16)){const dx=e.pos.x-g.position.x,dz=e.pos.z-g.position.z;if(dx*dx+dz*dz<20)hit(b,f,e,dmg,.15,1.1);}
    }
  });
}
function spearVolley(f,dmg){const b=f.battle,g=group(b),sp=[];const target=nearest(f,13);
  for(let i=0;i<6;i++){
    const pic=imageSprite('drill',2.2,1.65,.86);g.add(pic);sp.push(pic);
  }
  let hitOnce=false;effect(b,g,1.35,(t)=>{g.position.copy(f.pos);
    sp.forEach((pic,i)=>{const a=2*PI*i/6+t*4.2;const progress=clamp((t-.36)/.7,0,1);
      const dest=target?.pos||new THREE.Vector3(f.pos.x+Math.sin(f.facing)*8,0,f.pos.z+Math.cos(f.facing)*8);
      pic.position.set(Math.cos(a)*(1-progress)*2.2+(dest.x-f.pos.x)*progress,1.7+Math.sin(a)*.55,
        Math.sin(a)*(1-progress)*2.2+(dest.z-f.pos.z)*progress);pic.material.rotation=a;
    });
    if(t>.9&&!hitOnce){hitOnce=true;if(target)for(let i=0;i<3;i++)hit(b,f,target,dmg,.10,.6);}
  });
}
function prison(f,dmg){const b=f.battle,t=nearest(f,12);if(!t)return;freeze(b,t,2.5);
  const g=group(b),sp=imageSprite('seal',4.2,4.2,.9);g.add(sp);
  effect(b,g,1.3,(tt)=>{g.position.set(t.pos.x,2,t.pos.z);sp.material.rotation+=.05;sp.material.opacity=.9*(1-tt/1.3);});
  hit(b,f,t,dmg,.25,.3);
}
function judgment(f,dmg){const b=f.battle,g=group(b),target=nearest(f,16)?.pos||f.pos;
  const sp=imageSprite('beam',6.8,9.5,.86);g.add(sp);g.position.set(target.x,4,target.z);
  let hitDone=false;effect(b,g,1.45,(t)=>{sp.material.opacity=.9*(1-clamp((t-1)/.45,0,1));
    sp.scale.set(4.2+Math.sin(t*17)*.4,11.6,1);
    if(t>.55&&!hitDone){hitDone=true;for(const e of enemies(f,16)){
      const dx=e.pos.x-target.x,dz=e.pos.z-target.z;if(dx*dx+dz*dz<22)hit(b,f,e,dmg,.45,3);
    }}
  });
}
function punch(f,dmg){const b=f.battle,tgt=nearest(f,18);const g=group(b),pic=imageSprite('punch',4.5,3.8,.95);g.add(pic);
  const dest=tgt?.pos||new THREE.Vector3(f.pos.x+Math.sin(f.facing)*6,0,f.pos.z+Math.cos(f.facing)*6);
  let done=false;effect(b,g,.85,(t)=>{const k=clamp(t/.85,0,1),ease=k*k*(3-2*k);
    g.position.set(f.pos.x+(dest.x-f.pos.x)*ease,2+Math.sin(k*PI)*.8,f.pos.z+(dest.z-f.pos.z)*ease);
    pic.scale.set(3.5+4.0*k,3+2.0*k,1);pic.material.opacity=.95*(1-.9*k);
    if(!done&&k>.73){done=true;for(const e of enemies(f,18)){
      const dx=e.pos.x-dest.x,dz=e.pos.z-dest.z;if(dx*dx+dz*dz<13)hit(b,f,e,dmg,.55,4.0);
    }}
  });
}
function drill(f,dmg,ticks=6){const b=f.battle,tgt=nearest(f,18);const g=group(b),pic=imageSprite('drill',6.8,4.2,.94);g.add(pic);
  let done=0;effect(b,g,2.2,(t)=>{const end=tgt?.pos||new THREE.Vector3(f.pos.x+Math.sin(f.facing)*7,0,f.pos.z+Math.cos(f.facing)*7);
    g.position.set(end.x,2.1,end.z);pic.material.rotation+=.045;pic.material.opacity=.92*(1-clamp((t-1.65)/.55,0,1));
    pic.scale.set(5.8+Math.sin(t*15)*.6,4.5+Math.cos(t*13)*.25,1);
    const k=Math.min(ticks,Math.floor(t/.25));if(k>done){done=k;if(tgt)hit(b,f,tgt,dmg,.1,0.5);}
  });
}
function castArt(f,slot,net){const b=f.battle;
  if(!b?.fx || b.ended)return;
  if(slot==='s12'){waterSlash(f);return;}
  const i=slot==='over'?12:slot==='hi'?13:parseInt(String(slot).slice(1),10);
  const s=i>=12?(i===12?f.def.over:f.def.hi):i===-1?null:f.def.skills?.[i];
  if(i!==12&&i!==13&&!(i>=0&&i<=11))return;
  announce(b,f,s?.name||'蒼海魔法',slot);
  if(!net&&!f.remoteAuth&&b.net&&f.netId){const target=nearest(f,15)?.pos||f.pos;
    b.net.cast({id:f.netId,slot,tx:target.x,tz:target.z,ry:f.facing});}
  if(!f.remoteAuth)f.action={type:'cast',t:0,dur:.38};
  const dmg=s?.dmg||0;
  if(i===0)twinEyeBeam(f,dmg);
  else if(i===1)rainOrbs(f,10,6,dmg);
  else if(i===2)regen(f);
  else if(i===3)wave(f,dmg,1);
  else if(i===4)shield(f);
  else if(i===5)whirlpool(f,dmg,4);
  else if(i===6)spearVolley(f,dmg);
  else if(i===7)prison(f,dmg);
  else if(i===8)rainOrbs(f,12,7,dmg);
  else if(i===9)judgment(f,dmg);
  else if(i===10)punch(f,dmg);
  else if(i===11)drill(f,dmg,6);
  else if(i===12)punch(f,dmg);
  else if(i===13)drill(f,dmg,7);
}
function cleanup(f){
  if(f._rfNepField){endgroup(f.battle,f._rfNepField.g);f._rfNepField=null;}
  for(const key of ['_rfNepShield','_rfNepRegen']){
    const x=f[key];if(!x)continue;x.g.removeFromParent();for(const child of x.g.children)child.material?.dispose?.();f[key]=null;
  }
  restoreFrost(f);f._rfNepFreezeUntil=0;
}
export function installNepterionCombat({Battle,Fighter}){
  if(!Battle?.prototype||!Fighter?.prototype||Battle.prototype.__rfNepV26)return;
  Battle.prototype.__rfNepV26=true;
  installStats(FIGHTERS[KEY]);
  const oldApplyRed=Fighter.prototype.applyRed;
  Fighter.prototype.applyRed=function(){if(this.key===KEY){this.redMats=[];return;}return oldApplyRed.call(this);};
  const oldBattleCast=Battle.prototype.cast;
  Battle.prototype.cast=function(f,slot,net){
    if(f?.key===KEY&&slot==='nep_guard'&&!f.dead&&!this.ended){
      groundField(f);if(!net&&!f.remoteAuth&&this.net&&f.netId)this.net.cast({id:f.netId,slot,tx:f.pos.x,tz:f.pos.z,ry:f.facing});return;
    }
    return oldBattleCast.call(this,f,slot,net);
  };
  const oldExecute=Battle.prototype.executeCast;
  Battle.prototype.executeCast=function(f,slot,net){
    if(f?.key!==KEY || this.ended)return oldExecute.call(this,f,slot,net);
    if(slot==='nep_guard'){groundField(f);return;}
    castArt(f,slot,net);
  };
  const oldLight=Fighter.prototype.startLight;
  Fighter.prototype.startLight=function(...args){
    if(this.key!==KEY)return oldLight.apply(this,args);
    if(this.dead||this.action||this.stun>0)return;
    this.faceNearest(5);waterSlash(this);
    if(!this.remoteAuth&&this.netId&&this.battle.net)this.battle.net.cast({id:this.netId,slot:'s12',tx:this.pos.x,tz:this.pos.z,ry:this.facing});
    this.action={type:'cast',t:0,dur:.25};
  };
  const oldUpdate=Fighter.prototype.update;
  Fighter.prototype.update=function(dt,input){
    const raw={...(input||{})};
    if(this.key===KEY&&!this.remoteAuth&&!this.dead){
      const down=!!raw.guard;
      if(down&&!this._rfNepGuardDown)this.battle.cast(this,'nep_guard');
      this._rfNepGuardDown=down;raw.guard=false;
    }
    const out=oldUpdate.call(this,dt,raw);
    const sec=clamp(+dt||0,0,.08);
    if(this.key===KEY&&!this.dead){tickField(this,sec);tickShield(this,sec);tickRegen(this,sec);}
    if(this._rfNepFreezeUntil && clock()>this._rfNepFreezeUntil){restoreFrost(this);this._rfNepFreezeUntil=0;}
    return out;
  };
  const oldReceive=Fighter.prototype.receive;
  Fighter.prototype.receive=function(dmg,stun,kx,kz){
    if(this.key===KEY && this._rfNepShield?.until>clock())dmg=Math.max(0,(+dmg||0))*.5;
    return oldReceive.call(this,dmg,stun,kx,kz);
  };
  const oldOver=Fighter.prototype.startOver;
  Fighter.prototype.startOver=function(...args){
    if(this.key!==KEY)return oldOver.apply(this,args);
    const slot=this._rfNepFinisher==='hi'?'hi':'over';
    if(this.over<100||this.dead)return;
    if(slot==='hi'&&this.awakened<=0){this.battle.ui?.popup?.(this.pos,'秘奥義は覚醒中のみ','#90eaff');return;}
    this.over=0;this.faceNearest(15);this.battle.cast(this,slot);
  };
  const oldDispose=Battle.prototype.dispose;
  Battle.prototype.dispose=function(...args){
    for(const f of this.fighters||[])cleanup(f);
    for(const g of [...(this._rfNepGroups||[])])endgroup(this,g);
    this._rfNepGroups?.clear();return oldDispose.apply(this,args);
  };
}
