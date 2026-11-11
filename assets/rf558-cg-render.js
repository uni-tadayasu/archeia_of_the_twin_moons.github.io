/* Riftfall Arena V55.8 — 512px high-quality painterly CGI VFX and world material pass.
 * Visual-only: no changes to attack damage, hit testing, animation, movement, online
 * packets, actor GLB meshes, CPU difficulty, economy, player files, or rank rules.
 * V55.6/V55.7 effects remain authoritative and run before this module. */
import * as THREE from 'three';
import {Battle} from '../game.js?v=rf553-chief-cpu-20261111';
import {Field} from '../field.js?v=rf-v9-2-20261109';
if(!window.__rf558CGRuntime){
 window.__rf558CGRuntime=true;
 const mobile=!!window.matchMedia?.('(pointer:coarse)').matches||/iPhone|iPad|Android/i.test(navigator.userAgent||'');
 const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 const texLoader=new THREE.TextureLoader();
 const textures=new Map();
 const battles=new WeakMap();
 const stats={created:0,disposed:0,skipped:0};
 function visualProfile(){
   const profile=window.RF556Graphics?.profile?.();
   return ['quality','balanced','economy'].includes(profile)?profile:'balanced';
 }
 function budget(){
   if(reduced||document.hidden||document.body?.classList.contains('rf558-no-effects')||visualProfile()==='economy')return 0;
   return mobile?6:visualProfile()==='quality'?15:10;
 }
 function texture(name){
  if(textures.has(name))return textures.get(name);
  const t=texLoader.load('assets/rf558/'+name+'.webp',undefined,undefined,()=>{ /* Decorative fallback: omit missing asset */ });
  t.colorSpace=THREE.SRGBColorSpace;
  t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;
  t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
  t.generateMipmaps=true;
  textures.set(name,t);
  return t;
 }
 function liveOf(b){
  let state=battles.get(b);
  if(!state){state={active:0,owned:new Set(),cleaned:false};battles.set(b,state);}
  return state;
 }
 function emit(b,position,{kind='luminous-flare',color=0xa9dfff,size=1.5,life=.48,rise=0,spin=0,flat=false}={}){
  if(!b?.fx || b.ended || !position || budget()<=0){stats.skipped++;return null;}
  const state=liveOf(b);
  if(state.cleaned||state.active>=budget()){stats.skipped++;return null;}
  const mat=new THREE.SpriteMaterial({map:texture(kind),color,transparent:true,opacity:.77,
   blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true,toneMapped:false});
  const sprite=new THREE.Sprite(mat);
  sprite.position.set(position.x||0,position.y||.2,position.z||0);
  sprite.scale.setScalar(Math.max(.08,size));
  sprite.userData.rf558Cosmetic=true;
  b.fx.add(sprite);state.active++;stats.created++;state.owned.add(sprite);
  let elapsed=0,finished=false;
  const stop=()=>{
   if(finished)return;finished=true;
   sprite.removeFromParent();mat.dispose();state.owned.delete(sprite);
   state.active=Math.max(0,state.active-1);stats.disposed++;
  };
  try{
   b.addEffect(dt=>{
    if(state.cleaned||b.ended){stop();return false;}
    const step=clamp(Number(dt)||0,0,.08);
    elapsed+=step;const f=clamp(elapsed/Math.max(.16,life),0,1);
    const growth=flat?1+.9*f:1+.36*f;
    sprite.scale.setScalar(Math.max(.01,size*growth));
    mat.opacity=.75*Math.pow(1-f,1.45);
    if(!flat)sprite.position.y+=step*rise;
    if(spin)sprite.material.rotation+=spin*step;
    if(f>=1){stop();return false;}return true;
   });
  }catch{stop();return null;}
  return sprite;
 }
 const previousCast=Battle.prototype.castFx;
 if(typeof previousCast==='function')Battle.prototype.castFx=function(f,c,spec){
  const result=previousCast.apply(this,arguments);
  if(budget()>0&&f?.pos){
   const p=new THREE.Vector3(f.pos.x,.16,f.pos.z);
   const shade=c??spec?.color??0x8ce2ff;
   emit(this,p,{kind:'arcane-ring',color:shade,size:clamp((spec?.radius||3)*.9,1.9,5.8),life:.72,flat:true});
   if(!mobile&&visualProfile()==='quality'&&spec?.kind==='judgment'){
    emit(this,new THREE.Vector3(p.x,2.05,p.z),{kind:'energy-slash',color:shade,size:3.4,life:.42,rise:.4,spin:-.8});
   }
  }
  return result;
 };
 const previousGrand=Battle.prototype.grandFx;
 if(typeof previousGrand==='function')Battle.prototype.grandFx=function(pos,elem,color,power){
  const result=previousGrand.apply(this,arguments);
  if(pos && budget()>0){
   const radius=clamp(Number(power)||1,.55,3.4);
   emit(this,new THREE.Vector3(pos.x,.21,pos.z),{kind:'arcane-ring',color:color||0xd7e8ff,size:3.8*radius,life:.9,flat:true});
   if(!mobile)emit(this,new THREE.Vector3(pos.x,pos.y+1.4,pos.z),{kind:'luminous-flare',color:color||0xe7f5ff,size:2.4*radius,life:.6,rise:.8});
  }
  return result;
 };
 const previousDispose=Battle.prototype.dispose;
 if(typeof previousDispose==='function')Battle.prototype.dispose=function(...args){
  const state=battles.get(this);
  if(state){state.cleaned=true;for(const object of state.owned){object.removeFromParent();object.material?.dispose();stats.disposed++;}
   state.owned.clear();state.active=0;battles.delete(this);}
  return previousDispose.apply(this,args);
 };
 // PBR material pass: only the field's generated environmental primitives,
 // applied after wilds are built and before player/GLB actors appear.
 const previousWilds=Field.prototype.buildWilds;
 if(typeof previousWilds==='function')Field.prototype.buildWilds=function(...args){
  const result=previousWilds.apply(this,args);
  if(visualProfile()==='economy')return result;
  try{
   let refined=0,visited=0;
   this.group?.traverse(o=>{
    if(visited>=3000)return;
    visited++;
    if(!o.isMesh||o.userData?.arkeiaModel||o.userData?.rf556Particle)return;
    const materials=Array.isArray(o.material)?o.material:[o.material];
    for(const material of materials){
     if(!material || material.userData?.rf558Refined || !material.isMeshStandardMaterial)continue;
     material.userData.rf558Refined=true;
     material.flatShading=false;
     // A readable painted-CG surface, avoiding plastic/metallic random primitives.
     material.roughness=clamp(Number(material.roughness)||.8,.60,.96);
     material.metalness=clamp(Number(material.metalness)||0,0,.17);
     material.needsUpdate=true;refined++;
    }
   });
   this.userData ||= {};
   this.userData.rf558RefinedMaterials=refined;
  }catch(e){console.warn('[Riftfall V55.8] Optional field shading skipped:',e?.message||String(e));}
  return result;
 };
 window.RF558VisualEngine={version:'55.8',stats:()=>({...stats,profile:visualProfile(),budget:budget()}),features:['procedural_CG_magic','smooth_world_materials','bounded_mobile_particles']};
}
