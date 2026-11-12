import * as THREE from 'three';
import {Field} from '../field.js?v=55.21';
if(!window.__rf556CGEngine){
 window.__rf556CGEngine=true;
 const mobile=!!matchMedia?.('(pointer:coarse)')?.matches||/iPhone|iPad|Android/i.test(navigator.userAgent);
 const sprites=new Map();
 function tex(kind){
  if(sprites.has(kind))return sprites.get(kind);
  const c=document.createElement('canvas');c.width=c.height=128;
  const g=c.getContext('2d');const r=60;
  const grad=g.createRadialGradient(64,64,0,64,64,r);
  if(kind==='ring'){
   grad.addColorStop(0,'rgba(255,255,255,0)');
   grad.addColorStop(.57,'rgba(255,255,255,0)');
   grad.addColorStop(.68,'rgba(255,255,255,.35)');
   grad.addColorStop(.73,'rgba(255,255,255,.95)');
   grad.addColorStop(.8,'rgba(255,255,255,.27)');
   grad.addColorStop(1,'rgba(255,255,255,0)');
  }else if(kind==='smoke'){
   grad.addColorStop(0,'rgba(255,255,255,.49)');
   grad.addColorStop(.27,'rgba(255,255,255,.29)');
   grad.addColorStop(.62,'rgba(255,255,255,.13)');
   grad.addColorStop(1,'rgba(255,255,255,0)');
  }else{
   grad.addColorStop(0,'rgba(255,255,255,1)');
   grad.addColorStop(.1,'rgba(255,255,255,.92)');
   grad.addColorStop(.26,'rgba(255,255,255,.5)');
   grad.addColorStop(.53,'rgba(255,255,255,.12)');
   grad.addColorStop(1,'rgba(255,255,255,0)');
  }
  g.fillStyle=grad;g.fillRect(0,0,128,128);
  const texture=new THREE.CanvasTexture(c);
  texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
  sprites.set(kind,texture);return texture;
 }
 const oldStd=Field.prototype.std;
 if(typeof oldStd==='function')Field.prototype.std=function(color,extra={}){
  const mat=oldStd.call(this,color,extra);
  mat.flatShading=false;
  if(Number(mat.roughness)>.83)mat.roughness=.72;
  mat.envMapIntensity=Math.max(1,mat.envMapIntensity||1);
  if(!mat.map)mat.metalness=Math.max(.02,mat.metalness||0);
  return mat;
 };
 // Smooth instanced foliage and boulders (the world originally uses 6-7 sided cones).
 // Instancing stays intact, and collision circles are not touched.
 const originalWilds=Field.prototype.buildWilds;
 if(typeof originalWilds==='function')Field.prototype.buildWilds=function(...args){
  const start=this.group.children.length;
  const result=originalWilds.apply(this,args);
  const meshes=this.group.children.slice(start);
  for(const obj of meshes){
   if(!obj.isInstancedMesh||!obj.geometry)continue;
   const geo=obj.geometry,p=geo.parameters||{};
   if(geo.type==='ConeGeometry'&&p.radialSegments<=7){
    // Tiny grass stays low geometry for performance; trees get higher smoothness.
    if(p.radius<=.25)continue;
    obj.geometry=this.geo(new THREE.ConeGeometry(p.radius,p.height,mobile?12:20,3));
   }else if(geo.type==='IcosahedronGeometry' || geo.type==='DodecahedronGeometry'){
    const r=Number(p.radius)||1;
    obj.geometry=this.geo(new THREE.SphereGeometry(r,mobile?12:18,mobile?8:12));
   }else if(geo.type==='CylinderGeometry' && (p.radialSegments||0)<=6 && p.height<3){
    obj.geometry=this.geo(new THREE.CylinderGeometry(p.radiusTop,p.radiusBottom,p.height,mobile?9:14));
   }
   if(obj.material){obj.material.flatShading=false;obj.material.needsUpdate=true;}
  }
  return result;
 };
 const priorDots=Field.prototype.dots;
 Field.prototype.dots=function(list,radius,colors,emissive=0){
  if(!Array.isArray(list)||!list.length)return priorDots.call(this,list,radius,colors,emissive);
  const im=priorDots.call(this,list,radius,colors,emissive);
  if(im?.geometry?.type==='IcosahedronGeometry')im.geometry=this.geo(new THREE.SphereGeometry(Math.max(.03,radius),mobile?9:14,mobile?7:10));
  return im;
 };
 // Texture-based, smooth glows for fireflies. Single material and texture reused per field.
 const originalParticles=Field.prototype.particles;
 if(typeof originalParticles==='function')Field.prototype.particles=function(...args){
  const v=originalParticles.apply(this,args);
  if(v?.pts?.material){v.pts.material.map=tex('flare');v.pts.material.alphaTest=.005;v.pts.material.needsUpdate=true;}
  return v;
 };
 // CG atmosphere has layered clouds and fog, but its image is cached per biome.
 const skies=new Map();
 function skyTexture(biome){
  const key=String(biome?.name||'night');if(skies.has(key))return skies.get(key);
  const w=mobile?1024:1536,h=mobile?512:768;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const g=canvas.getContext('2d'),sky=new THREE.Color(biome?.sky||0x679dcb);
  const asHex=c=>`#${c.getHexString()}`;
  const top=new THREE.Color(0x081226).lerp(sky,.23),horizon=new THREE.Color(0x163555).lerp(sky,.42);
  const gradient=g.createLinearGradient(0,0,0,h);
  gradient.addColorStop(0,asHex(top));gradient.addColorStop(.56,asHex(horizon));gradient.addColorStop(1,'#79859e');
  g.fillStyle=gradient;g.fillRect(0,0,w,h);
  let seed=[...key].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619)>>>0,2166136261);
  const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<40;i++){
   const x=rng()*w,y=rng()*h*.7,r=(.05+rng()*.14)*w;
   const cloud=g.createRadialGradient(x,y,0,x,y,r);
   cloud.addColorStop(0,`rgba(215,238,255,${.025+rng()*.06})`);
   cloud.addColorStop(1,'rgba(208,237,255,0)');
   g.fillStyle=cloud;g.beginPath();g.ellipse(x,y,r,r*.2+rng()*r*.18,rng()*.6,0,Math.PI*2);g.fill();
  }
  for(let i=0;i<140;i++){
   const x=rng()*w,y=rng()*h*.57,r=rng()*1.2+.25;
   g.globalAlpha=.15+rng()*.5;g.fillStyle='#f7f9ff';g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();
  }
  g.globalAlpha=1;
  const x=w*.75,y=h*.22,r=w*.055;
  const moon=g.createRadialGradient(x,y,0,x,y,r*3.5);
  moon.addColorStop(0,'rgba(241,251,255,.82)');moon.addColorStop(.16,'rgba(217,234,255,.53)');moon.addColorStop(.35,'rgba(154,188,255,.12)');moon.addColorStop(1,'rgba(154,188,255,0)');
  g.fillStyle=moon;g.fillRect(x-3.5*r,y-3.5*r,7*r,7*r);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;
  skies.set(key,t);return t;
 }
 const oldBuildGround=Field.prototype.buildGround;
 if(typeof oldBuildGround==='function')Field.prototype.buildGround=function(...args){
  const oldBackground=this.scene.background,oldFog=this.scene.fog;
  const result=oldBuildGround.apply(this,args);
  // Seamless, low-cost normal texture adds photographic ground micro-detail
  // without changing floor geometry, stage collisions or their UV mapping.
  if(!window.__rf556TerrainNormal){
    const t=new THREE.TextureLoader().load('assets/rf556/terrain-normal.webp',undefined,undefined,()=>{});
    t.wrapS=t.wrapT=THREE.RepeatWrapping;
    window.__rf556TerrainNormal=t;
  }
  const ground=this.group.children.find(o=>o.isMesh && o.geometry?.type==='PlaneGeometry' && o.material?.map);
  if(ground?.material && window.__rf556TerrainNormal){
    const m=ground.material;
    m.normalMap=window.__rf556TerrainNormal;
    m.normalScale?.set(.12,.12);
    m.normalMap.repeat.copy(m.map.repeat);
    m.roughness=Math.max(.66,Math.min(.91,Number(m.roughness)||.85));
    m.needsUpdate=true;
  }
  this.__rf556Env={background:oldBackground,fog:oldFog};
  this.scene.background=skyTexture(this.B);
  this.scene.fog=new THREE.FogExp2(new THREE.Color(this.B?.sky||0x7d9bc4).lerp(new THREE.Color(0x14243a),.54),.0065);
  return result;
 };
 const prevFieldDispose=Field.prototype.dispose;
 if(typeof prevFieldDispose==='function')Field.prototype.dispose=function(...args){
  if(this.__rf556Env){this.scene.background=this.__rf556Env.background;this.scene.fog=this.__rf556Env.fog;}
  return prevFieldDispose.apply(this,args);
 };
}
