/* RIFTFALL ARENA V55.7 — restrained painterly CGI magic and world atmosphere.
   Decorative only. Damage, hit tests, stamina, HP, online packets and models untouched.
   This module deliberately loads AFTER V55.6's existing engine extension. */
import './rf556-cg-engine.js?v=20261112-v556';
import * as THREE from 'three';
import {Battle} from '../game.js?v=rf553-chief-cpu-20261111';
import {Field} from '../field.js?v=rf-v9-2-20261109';

if (!window.__rf557CGEff) {
 window.__rf557CGEff = true;
 const mobile=window.matchMedia?.('(pointer: coarse)').matches || /iPhone|iPad|Android/i.test(navigator.userAgent||'');
 const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const lifeProfile=()=>window.RF556Graphics?.profile?.()||'balanced';
 const limits=()=>lifeProfile()==='economy'?0:mobile?11:27;
 const registry=new WeakMap();
 const sprites=new Map();
 const loader=new THREE.TextureLoader();
 function texture(name){
  if(!sprites.has(name)){
   const t=loader.load('assets/rf557/spell-'+name+'.webp',undefined,undefined,err=>{
    console.warn('[CG V55.7] optional FX texture unavailable:',name,err?.message||'download');
   });
   t.colorSpace=THREE.SRGBColorSpace;
   t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;
   sprites.set(name,t);
  }
  return sprites.get(name);
 }
 function stateOf(b){
  if(!registry.has(b))registry.set(b,{active:0,owned:new Set()});
  return registry.get(b);
 }
 function emit(b,position,color=0xaadfff,scale=1.2,life=.48,options={}){
  if(!b?.fx||b.ended||motion||limits()===0)return null;
  const state=stateOf(b);
  if(state.active>=limits())return null;
  const ring=options.ring===true;
  const mat=ring?
   new THREE.MeshBasicMaterial({map:texture('ring'),color,transparent:true,opacity:.72,
     blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true,side:THREE.DoubleSide}):
   new THREE.SpriteMaterial({map:texture('flare'),color,transparent:true,opacity:.86,
     blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true});
  const shape=ring?new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat):new THREE.Sprite(mat);
  shape.userData.rf557Decoration=true;
  if(ring){shape.rotation.x=-Math.PI/2;}
  shape.position.copy(position);
  shape.scale.setScalar(Math.max(.01,scale));
  b.fx.add(shape);state.owned.add(shape);state.active++;
  let t=0,cleaned=false;
  const clean=()=>{
   if(cleaned)return;cleaned=true;
   shape.removeFromParent();mat.dispose();if(ring)shape.geometry.dispose();
   state.owned.delete(shape);state.active=Math.max(0,state.active-1);
  };
  const interval=Math.max(.08,life);
  try{b.addEffect(dt=>{
   t+=Math.max(0,dt);let v=clamp(t/interval,0,1);
   const growth=ring?.75+v*1.65:.9+v*.7;
   const sc=Math.max(.01,scale*growth);
   shape.scale.set(sc,sc,sc);
   shape.material.opacity=(ring?.75:.83)*Math.pow(1-v,ring?1.25:1.5);
   if(!ring)shape.position.y+=dt*(options.rise??.72);
   if(v>=1){clean();return false;}
   return true;
  });}catch(e){clean();return null;}
  return shape;
 }
 // The original spell remains authoritative; these effects are always cosmetic.
 const previousCast=Battle.prototype.castFx;
 if(typeof previousCast==='function')Battle.prototype.castFx=function(f,color,spec){
  const result=previousCast.call(this,f,color,spec);
  if(limits()>0 && f?.pos && !this.ended){
   const c=color??0x9bc4ff,x=f.pos.x,z=f.pos.z;
   emit(this,new THREE.Vector3(x,.13,z),c,3.15,.67,{ring:true});
   emit(this,new THREE.Vector3(x,1.28,z),c,1.1,.44,{rise:.55});
   if(!mobile && lifeProfile()==='quality') {
    emit(this,new THREE.Vector3(x+.24,1.7,z-.15),0xf6fdff,.54,.37,{rise:1.1});
   }
  }
  return result;
 };
 const previousGrand=Battle.prototype.grandFx;
 if(typeof previousGrand==='function')Battle.prototype.grandFx=function(pos,elem,color,power){
  const result=previousGrand.apply(this,arguments);
  if(pos&&limits()>0){
   const f=clamp(Number(power)||1,.6,3);
   emit(this,new THREE.Vector3(pos.x,.13,pos.z),color||0xa9dfff,3.1*f,.85,{ring:true});
   if(!mobile)emit(this,new THREE.Vector3(pos.x,pos.y+1.4,pos.z),0xe2f9ff,1.2*f,.62,{rise:1.3});
  }
  return result;
 };
 const previousDispose=Battle.prototype.dispose;
 if(typeof previousDispose==='function')Battle.prototype.dispose=function(...args){
  const state=registry.get(this);
  if(state){for(const shape of state.owned){
   shape.removeFromParent();shape.material?.dispose();if(shape.isMesh)shape.geometry?.dispose();
  }state.owned.clear();state.active=0;registry.delete(this);}
  return previousDispose.apply(this,args);
 };

 // An illustrated sky is painted from the already-generated per-biome source.
 // No independent world/model content is fabricated; colors derive from the actual biome.
 const enhancedSkies=new Map();
 function enhanceSky(base,biome){
  const key=String(biome?.name||biome?.sky||'sky');
  if(enhancedSkies.has(key))return enhancedSkies.get(key);
  const width=mobile?640:1152,height=mobile?320:576;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const g=canvas.getContext('2d');
  if(!g)return null;
  if(base?.image)try{g.drawImage(base.image,0,0,width,height);}catch{}
  let seed=Array.from(key).reduce((a,c)=>(Math.imul(a^c.charCodeAt(0),16777619))>>>0,2166136261);
  const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // Atmospheric, layered distant cloud banks and moonlight bloom.
  const cloudN=mobile?17:28;
  for(let i=0;i<cloudN;i++){
   const x=rnd()*width,y=rnd()*height*.79;
   const rx=width*(.09+rnd()*.19),ry=height*(.055+rnd()*.12);
   g.save();g.translate(x,y);g.rotate((rnd()-.5)*.35);g.scale(1,ry/rx);
   const c=g.createRadialGradient(0,0,0,0,0,rx);
   const alpha=.028+rnd()*.065;
   c.addColorStop(0,`rgba(225,238,255,${alpha})`);
   c.addColorStop(.62,`rgba(165,201,245,${alpha*.42})`);
   c.addColorStop(1,'rgba(135,182,235,0)');
   g.fillStyle=c;g.beginPath();g.arc(0,0,rx,0,Math.PI*2);g.fill();g.restore();
  }
  // Distant luminosity behind the horizon, without hard-edged triangles.
  const mist=g.createLinearGradient(0,height*.38,0,height);
  mist.addColorStop(0,'rgba(111,153,210,0)');
  mist.addColorStop(.66,'rgba(148,177,224,.075)');
  mist.addColorStop(1,'rgba(25,58,103,.18)');
  g.fillStyle=mist;g.fillRect(0,0,width,height);
  if(!mobile){
   for(let i=0;i<32;i++){
    const x=rnd()*width,y=rnd()*height*.53,r=.5+rnd()*.8;
    g.fillStyle=`rgba(244,248,255,${.18+rnd()*.36})`;
    g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
   }
  }
  const t=new THREE.CanvasTexture(canvas);
  t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;
  enhancedSkies.set(key,t);return t;
 }
 const previousGround=Field.prototype.buildGround;
 if(typeof previousGround==='function')Field.prototype.buildGround=function(...args){
  const result=previousGround.apply(this,args);
  try{
   if(lifeProfile()!=='economy'){
    const old=this.scene.background;
    const enhanced=enhanceSky(old,this.B);
    if(enhanced)this.scene.background=enhanced;
   }
   // Smooth CG lighting treatment for ground only; the original collision plane remains.
   const floor=this.group.children.find(o=>o.isMesh&&o.geometry?.type==='PlaneGeometry'&&o.material?.map);
   if(floor?.material){
    floor.material.roughness=clamp(Number(floor.material.roughness)||.8,.58,.83);
    floor.material.metalness=.025;
    floor.material.needsUpdate=true;
   }
  }catch(e){console.warn('[CG V55.7] optional world styling skipped',e?.message||e);}
  return result;
 };
 // Preserve the built-in V55.6 field cleanup and background restoration.
 window.RF557ArtStatus={version:'V55.7',magic:'texture-sprites',world:'biome-atmosphere',quality:lifeProfile};
}
