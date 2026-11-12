/* RIFTFALL ARENA V55.6 — cinematic world and skill presentation.
   DOES NOT alter character meshes, hit boxes, net messages or damage rules.
   WebGL still uses triangles internally; this removes visibly faceted decoration. */
import * as THREE from 'three';
import {Battle} from '../game.js?v=55.20';
import {Field} from '../field.js?v=55.20';
if(!window.__rf556CGEngine){
 window.__rf556CGEngine=true;
 const mobile=!!matchMedia?.('(pointer:coarse)')?.matches||/iPhone|iPad|Android/i.test(navigator.userAgent);
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
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
 function capacity(){return window.RF556Graphics?.spriteLimit?.()||(mobile?17:38);}
 function allow(b){
  if(!b?.fx || b.ended)return false;
  const st=b.__rf6Particles||(b.__rf6Particles={count:0,last:performance.now(),active:0});
  const t=performance.now();if(t-st.last>1000){st.last=t;st.count=0;}
  const limit=capacity();
  if(st.count>=limit*2 || st.active>=limit)return false;
  st.count++;st.active++;return true;
 }
 function particle(b,pos,color=0xbbe8ff,size=1,life=.35,opts={}){
  if(!allow(b))return;
  const mat=new THREE.SpriteMaterial({map:tex(opts.kind||'flare'),color:new THREE.Color(color),transparent:true,
   opacity:opts.opacity??.85,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true});
  const p=new THREE.Sprite(mat);
  p.userData.rf556Particle=true;p.position.copy(pos);p.scale.setScalar(Math.max(.05,size));b.fx.add(p);
  const lifeSec=Math.max(.08,life);const dx=(Math.random()-.5)*(opts.spread||0),dz=(Math.random()-.5)*(opts.spread||0);
  const opacity=mat.opacity;let t=0;
  b.addEffect(dt=>{
   t+=dt;const u=clamp(t/lifeSec,0,1);
   p.scale.setScalar(Math.max(.002,size*((opts.kind==='smoke'?.8:.45)+(opts.grow||1.4)*u)));
   p.position.x+=dx*dt;p.position.y+=(opts.rise||.2)*dt;p.position.z+=dz*dt;
   mat.opacity=opacity*(1-u)*(1-u*.35);
   if(u>=1){b.fx.remove(p);mat.dispose();b.__rf6Particles.active=Math.max(0,b.__rf6Particles.active-1);return false;}
   return true;
  });
  return p;
 }
 function ring(b,pos,color,size,life=.6){
  if(!allow(b))return;
  const mat=new THREE.MeshBasicMaterial({map:tex('ring'),color,transparent:true,opacity:.8,
   side:THREE.DoubleSide,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending});
  const obj=new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat);obj.userData.rf556Particle=true;
  obj.rotation.x=-Math.PI/2;obj.position.copy(pos);obj.position.y=Math.max(.05,obj.position.y);
  b.fx.add(obj);let t=0;
  b.addEffect(dt=>{
   t+=dt;const q=clamp(t/life,0,1),s=size*(.4+q*1.85);obj.scale.set(s,s,s);mat.opacity=.8*Math.pow(1-q,1.5);
   if(q>=1){b.fx.remove(obj);obj.geometry.dispose();mat.dispose();b.__rf6Particles.active=Math.max(0,b.__rf6Particles.active-1);return false;}
   return true;
  });return obj;
 }
 // Classic faceted ornament meshes can be replaced independently; never modify
 // shared original geometry. The replacement is owned by its mesh and disposed by the base engine.
 const FACETS=/^(?:OctahedronGeometry|DodecahedronGeometry|TetrahedronGeometry|IcosahedronGeometry)$/;
 const oldUpdate=Battle.prototype.update;
 if(typeof oldUpdate==='function')Battle.prototype.update=function(...args){
  const result=oldUpdate.apply(this,args);
  if(this.fx){
   const now=performance.now();
   if(now-(this.__rf556SmoothAt||0)>160){
    this.__rf556SmoothAt=now;let budget=mobile?4:12;
    const owned=this.__rf556SmoothGeom||(this.__rf556SmoothGeom=new Map());
    const live=new Set();
    this.fx.traverse(o=>{
     if(o.isMesh && o.userData.rf556Smooth)live.add(o);
     if(budget<=0||!o.isMesh||o.userData.rf556Smooth||o.userData.rf556Particle||!FACETS.test(o.geometry?.type||''))return;
     const r=clamp(Number(o.geometry?.parameters?.radius)||1,.05,40);
     o.geometry=new THREE.SphereGeometry(r,mobile?12:20,mobile?8:14);
     owned.set(o,o.geometry);live.add(o);
     o.userData.rf556Smooth=true;budget--;
     if(o.material && !Array.isArray(o.material)){
      o.material.flatShading=false;o.material.needsUpdate=true;
     }
    });
    // Clean geometry for effects whose parent group has already left this.fx.
    // The original engine sometimes removes cosmetic objects without disposal.
    for(const [obj,geo] of owned){if(live.has(obj))continue;geo.dispose();owned.delete(obj);}
   }
  }
  return result;
 };
 Battle.prototype.spark=function(pos,color,size=1){
  particle(this,pos,color||0xbbeaff,Math.max(.28,size*2),.22,{spread:1.2,rise:.25});
  if(!mobile && size>.6)particle(this,pos,0xffffff,size*.72,.16,{rise:.15});
 };
 Battle.prototype.puff=function(pos,color,size=.3){
  particle(this,pos,color||0xffffff,Math.max(.18,size*1.4),.38,{kind:'smoke',rise:.45,spread:2});
 };
 Battle.prototype.fx3d=function(pos,elem,power=1,color=0xc9f2ff){
  const k=clamp(power,.4,2.5);
  particle(this,pos,color,1.4*k,.42,{rise:1.5,grow:1.6});
  const n=Math.min(mobile?4:9,Math.ceil(k*5));
  for(let i=0;i<n;i++){
   const a=(i+.2*Math.random())*Math.PI*2/n;
   particle(this,new THREE.Vector3(pos.x+Math.cos(a)*.55*k,pos.y+(Math.random()-.5),pos.z+Math.sin(a)*.55*k),
    i%4===0?0xffffff:color,.35*k,.3+Math.random()*.25,{spread:2.4,rise:1.5});
  }
  this.flashLight?.(pos,color,Math.min(1.1,k),.2);
 };
 Battle.prototype.grandFx=function(pos,elem,color=0xbbe9ff,power=1){
  const k=clamp(power,.45,2.5);
  ring(this,new THREE.Vector3(pos.x,.07,pos.z),color,3.2*k,.8);
  particle(this,new THREE.Vector3(pos.x,pos.y+1,pos.z),color,2*k,.76,{rise:1.3,grow:2.1});
  const n=mobile?6:12;
  for(let i=0;i<n;i++){
   const a=(i/n)*Math.PI*2,r=(.8+Math.random()*.9)*k;
   particle(this,new THREE.Vector3(pos.x+Math.cos(a)*r,pos.y+.4+Math.random()*1.2,pos.z+Math.sin(a)*r),
    i%4===0?0xffffff:color,.36*k,.55+Math.random()*.35,{rise:1.1,spread:1.2});
  }
  this.flashLight?.(new THREE.Vector3(pos.x,pos.y+1,pos.z),color,1.15*k,.35);
 };
 // All common casting animations gain a soft, color-matched CGI halo.
 const originalCastFx=Battle.prototype.castFx;
 if(typeof originalCastFx==='function')Battle.prototype.castFx=function(f,color,spec){
  const result=originalCastFx.call(this,f,color,spec);
  if(f?.pos)particle(this,new THREE.Vector3(f.pos.x,.9,f.pos.z),color,2.2,.5,{rise:1,grow:1.5});
  return result;
 };
 // All standard weapon/magic particles inherit a limited secondary glow.
 const originalFxPop=Battle.prototype.fxPop;
 if(typeof originalFxPop==='function')Battle.prototype.fxPop=function(pos,elem,slot,size,life,opts={}){
  const result=originalFxPop.call(this,pos,elem,slot,size,life,opts);
  if(result && !opts?.flat && life>.18 && Math.random()<(mobile?.08:.17)){
    const c=Array.isArray(this.fighters)&&this.fighters.length?0x9bd8ff:0xffffff;
    particle(this,pos,c,Math.max(.25,size*.36),Math.min(.46,life),{rise:.4,spread:1.5});
  }
  return result;
 };
 // Base engine disposal doesn't dispose detached, mid-animation VFX sprites.
 const prevDispose=Battle.prototype.dispose;
 if(typeof prevDispose==='function')Battle.prototype.dispose=function(...args){
  if(this.fx)this.fx.traverse(o=>{
   if(!o.userData?.rf556Particle)return;
   o.material?.dispose?.();if(o.isMesh)o.geometry?.dispose?.();
  });
  for(const geometry of this.__rf556SmoothGeom?.values?.()||[])geometry.dispose();
  this.__rf556SmoothGeom?.clear?.();
  return prevDispose.apply(this,args);
 };
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
