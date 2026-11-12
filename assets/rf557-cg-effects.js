import * as THREE from 'three';
import {Field} from '../field.js?v=55.21';

if (!window.__rf557CGEff) {
 window.__rf557CGEff = true;
 const mobile=window.matchMedia?.('(pointer: coarse)').matches || /iPhone|iPad|Android/i.test(navigator.userAgent||'');
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const lifeProfile=()=>window.RF556Graphics?.profile?.()||'balanced';
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
