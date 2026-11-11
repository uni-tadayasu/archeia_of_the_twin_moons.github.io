/* Riftfall Arena V55.5 — non-faceted, cinematic CGI rendering layer.
   Adds soft particles, procedural atmosphere and smoother world materials.
   All collision/hit rules and character GLB meshes remain owned by the original engine.
   Note: WebGL still rasterizes triangles internally; this removes visible low-poly FX styling. */
import * as THREE from 'three';
import {Battle} from '../game.js?v=rf553-chief-cpu-20261111';
import {Field} from '../field.js?v=rf-v9-2-20261109';
if(!window.__rf555CGEngine){
 window.__rf555CGEngine=true;
 const mobile=matchMedia?.('(pointer:coarse)')?.matches||/Android|iPhone|iPad/i.test(navigator.userAgent);
 const maxSprites=mobile?20:35;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function makeTexture(type='flare'){
   const c=document.createElement('canvas');c.width=c.height=128;
   const x=c.getContext('2d');const W=c.width;
   const grad=x.createRadialGradient(64,64,0,64,64,62);
   if(type==='flare'){
    grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.12,'rgba(238,250,255,.88)');
    grad.addColorStop(.32,'rgba(154,210,255,.38)');grad.addColorStop(.65,'rgba(98,170,255,.12)');grad.addColorStop(1,'rgba(0,0,0,0)');
   }else{
    grad.addColorStop(0,'rgba(255,255,255,0)');grad.addColorStop(.54,'rgba(255,255,255,0)');
    grad.addColorStop(.68,'rgba(255,255,255,.7)');grad.addColorStop(.82,'rgba(165,223,255,.18)');grad.addColorStop(1,'rgba(0,0,0,0)');
   }
   x.fillStyle=grad;x.fillRect(0,0,W,W);
   const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
   tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;return tex;
 }
 const flare=makeTexture(),halo=makeTexture('ring');
 function pop(b,pos,color,scale=1,life=.36,{rise=0,spread=0,ring=false}={}){
   if(!b?.fx || b.fx.children.length>maxSprites+55)return;
   const mat=new THREE.SpriteMaterial({map:ring?halo:flare,color:new THREE.Color(color||0xb8eaff),transparent:true,
    opacity:ring?.6:.88,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending});
   const spr=new THREE.Sprite(mat);spr.position.copy(pos);spr.scale.setScalar(Math.max(.05,scale));
   b.fx.add(spr);let age=0;
   const dx=(Math.random()-.5)*spread,dz=(Math.random()-.5)*spread;
   b.addEffect(dt=>{
     age+=dt;const t=clamp(age/life,0,1);
     spr.scale.setScalar(scale*(.55+1.6*t));
     spr.position.y+=rise*dt;spr.position.x+=dx*dt;spr.position.z+=dz*dt;
     mat.opacity=(ring?.58:.84)*Math.pow(1-t,1.45);
     if(t>=1){b.fx.remove(spr);mat.dispose();return false;}
     return true;
   });
   return spr;
 }
 Battle.prototype.spark=function(pos,color,size){pop(this,pos,color,Math.max(.3,size*1.8),.24,{spread:1});};
 Battle.prototype.puff=function(pos,color,size){pop(this,pos,color,Math.max(.15,size*1.4),.4,{rise:.3,spread:1.5});};
 Battle.prototype.fx3d=function(pos,elem,power=1,color=0xffffff){
  const p=Math.max(.45,power);
  pop(this,pos,color,2.1*p,.44,{rise:.9});
  const count=mobile?4:8;
  for(let i=0;i<count;i++){
   const a=(Math.PI*2*i)/count+Math.random()*.3;
   const d=.25*p;
   const at=new THREE.Vector3(pos.x+Math.cos(a)*d,pos.y+(Math.random()-.5)*d,pos.z+Math.sin(a)*d);
   pop(this,at,i%3===0?0xffffff:color,(.42+Math.random()*.55)*p,.4+Math.random()*.2,{rise:.9,spread:4*p});
  }
  this.flashLight?.(pos,color,Math.min(1.1,p),.2);
 };
 Battle.prototype.grandFx=function(pos,elem,color,power=1){
   const p=clamp(power,.5,2.5);
   pop(this,new THREE.Vector3(pos.x,Math.max(0,pos.y)+.06,pos.z),color,2.5*p,.85,{ring:true});
   pop(this,new THREE.Vector3(pos.x,Math.max(0,pos.y)+1.2*p,pos.z),color,1.5*p,.8,{rise:1.8});
   const count=mobile?6:12;
   for(let i=0;i<count;i++){
    const a=Math.PI*2*i/count;
    pop(this,new THREE.Vector3(pos.x+Math.cos(a)*1.4*p,pos.y+.4+Math.random()*1.2,pos.z+Math.sin(a)*1.4*p),
     i%4===0?0xffffff:color,.65*p,.6+Math.random()*.35,{rise:1.2,spread:1.4});
   }
   this.flashLight?.(new THREE.Vector3(pos.x,pos.y+1,pos.z),color,1.1*p,.38);
 };
 // Some legacy VFX use primitive low-poly meshes (octahedra, tetrahedra, rocks).
 // Replace only cosmetic effect geometry, never fighters, environment or collision.
 const sphere=new THREE.SphereGeometry(1,16,12);
 const oldBattleUpdate=Battle.prototype.update;
 if(typeof oldBattleUpdate==='function'){
  Battle.prototype.update=function(...args){
    const result=oldBattleUpdate.apply(this,args);
    const t=performance.now();
    if(!this.fx || t-(this.__rf555LastSmooth||0)<125)return result;
    this.__rf555LastSmooth=t;
    this.fx.traverse(o=>{
     if(!o.isMesh||o.userData?.rf555Smooth)return;
     const geo=o.geometry?.type||'';
     if(!/^(OctahedronGeometry|DodecahedronGeometry|TetrahedronGeometry|IcosahedronGeometry)$/.test(geo))return;
     if(o.userData?.isRealModel)return;
     // Cosmetic meshes are faceted as originally authored; render smooth CG orbs instead.
     o.geometry=sphere;
     if(o.material){o.material.flatShading=false;o.material.needsUpdate=true;}
     o.userData.rf555Smooth=true;
    });
    return result;
  };
 }
 const oldWorldMaterial=Field.prototype.std;
 Field.prototype.std=function(color,extra={}){
  const mat=oldWorldMaterial.call(this,color,extra);
  mat.flatShading=false;
  if(mat.roughness>=.82)mat.roughness=.68;
  mat.metalness=Math.max(mat.metalness||0,.045);
  mat.envMapIntensity=Math.max(1.0,mat.envMapIntensity||1);
  return mat;
 };
 // Vegetation, flowers and field stones: smooth instanced meshes instead of faceted icosahedra.
 Field.prototype.dots=function(list,radius,colors,emissive=0){
  const count=Math.min(Array.isArray(list)?list.length:0,mobile?5500:12000);
  const geo=this.geo(new THREE.SphereGeometry(Math.max(.03,radius),8,6));
  const mat=this.std(0xffffff,{roughness:.65,emissive:0xffffff,emissiveIntensity:emissive});
  const im=new THREE.InstancedMesh(geo,mat,count);
  const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),size=new THREE.Vector3(),at=new THREE.Vector3(),col=new THREE.Color();
  for(let i=0;i<count;i++){
    const [x,y,z,k=1]=list[i];
    im.setMatrixAt(i,matrix.compose(at.set(x,y,z),quat,size.setScalar(k)));
    im.setColorAt(i,col.set(colors[i%colors.length]));
  }
  im.instanceMatrix.needsUpdate=true;
  if(im.instanceColor)im.instanceColor.needsUpdate=true;
  this.group.add(im);return im;
 };
 const atmospheres=new Map();
 function skyTexture(biome){
  const key=biome?.name||'twilight';if(atmospheres.has(key))return atmospheres.get(key);
  const canvas=document.createElement('canvas'),w=mobile?1024:1536,h=mobile?512:768;
  canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');
  const skyCol=new THREE.Color(biome?.sky||0x86a8df);
  const hex=n=>'#'+n.toString(16).padStart(6,'0');
  const top=new THREE.Color(0x061328).lerp(skyCol,.25),bottom=new THREE.Color(0x243e67).lerp(skyCol,.42);
  const gr=c.createLinearGradient(0,0,0,h);
  gr.addColorStop(0,hex(top.getHex()));gr.addColorStop(.55,hex(bottom.getHex()));gr.addColorStop(1,'#7985a7');
  c.fillStyle=gr;c.fillRect(0,0,w,h);
  let seed=[...key].reduce((n,v)=>Math.imul(n+v.charCodeAt(0),31)>>>0,5411);
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  // High dynamic range-style soft atmospheric layers and stars; no low-poly silhouette.
  for(let j=0;j<28;j++){
   const x=rand()*w,y=rand()*h*.72,r=(.05+rand()*.14)*w;
   const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,`rgba(210,225,255,${.03+rand()*.045})`);g.addColorStop(1,'rgba(210,225,255,0)');
   c.fillStyle=g;c.beginPath();c.ellipse(x,y,r,r*.3,rand(),0,Math.PI*2);c.fill();
  }
  for(let j=0;j<160;j++){
   c.globalAlpha=.19+rand()*.48;c.fillStyle='#f0f7ff';
   c.beginPath();c.arc(rand()*w,rand()*h*.65,rand()*1.2+.3,0,Math.PI*2);c.fill();
  }
  c.globalAlpha=1;
  for(const [x,y,r,alpha] of [[w*.22,h*.19,w*.08,.72],[w*.74,h*.3,w*.043,.4]]){
   const g=c.createRadialGradient(x,y,0,x,y,r*3);g.addColorStop(0,`rgba(224,236,255,${alpha})`);
   g.addColorStop(.3,'rgba(160,196,255,.16)');g.addColorStop(1,'rgba(150,190,255,0)');
   c.fillStyle=g;c.fillRect(x-3*r,y-3*r,6*r,6*r);
  }
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  atmospheres.set(key,tex);return tex;
 }
 const origGround=Field.prototype.buildGround;
 Field.prototype.buildGround=function(...args){
   const prev=this.scene.background,prevFog=this.scene.fog;
   const result=origGround.apply(this,args);
   const sky=skyTexture(this.B);
   this.scene.background=sky;
   this.scene.fog=new THREE.FogExp2(new THREE.Color(this.B?.sky||0x60769d).lerp(new THREE.Color(0x1e2c43),.45),.0075);
   this.__rf555SceneOriginal={prev,prevFog,sky};
   return result;
 };
 const origDispose=Field.prototype.dispose;
 Field.prototype.dispose=function(...args){
   const old=this.__rf555SceneOriginal;
   if(old){
     if(this.scene.background===old.sky)this.scene.background=old.prev;
     this.scene.fog=old.prevFog;
   }
   return origDispose.apply(this,args);
 };
}
