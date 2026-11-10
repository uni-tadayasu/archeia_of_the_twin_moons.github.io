// RF_FUJIWARA_NOBUYORI_V35_CG_SAFE_MOTION 藤原信頼 – chief-exclusive curse fighter.
// Exact source geometry, materials and textures; procedural remeshing disabled.
import * as THREE from 'three';
import { createNobleMotion } from './noble-motion.js?v=rf-noble-motion-v35';
const KEY='fujiwara_nobuyori', CURSE_TIME=30, CURSE_RADIUS=5.65;
const PURPLE=0xaf5dff, C=0xbc72ff;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const specFor=(name)=>({name,kind:'curse',elem:6,color:C,vivid:true});
const statusMark=specFor('呪印');
const statusBurn=specFor('鬼火');
const animationNames={walk:/walk|walking|move|locomotion|歩行/i,run:/run|running|sprint|dash|jog|走行/i,attack:/attack|atk|hit|punch|swing|slash|strike|combat|攻撃/i,cast:/cast|spell|magic|chant|skill|詠唱/i};

function magicTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=768;
  const c=canvas.getContext('2d'),mid=384,R=365;
  c.clearRect(0,0,768,768);c.translate(mid,mid);
  const light=c.createRadialGradient(0,0,12,0,0,380);
  light.addColorStop(0,'rgba(233,189,255,.20)');light.addColorStop(.55,'rgba(130,40,255,.12)');light.addColorStop(.95,'rgba(63,10,124,.04)');light.addColorStop(1,'transparent');
  c.fillStyle=light;c.beginPath();c.arc(0,0,R,0,Math.PI*2);c.fill();
  const ring=(r,width,opacity=1)=>{c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.lineWidth=width;c.strokeStyle=`rgba(217,145,255,${opacity})`;c.shadowColor='#7d0dff';c.shadowBlur=14;c.stroke();c.shadowBlur=0;};
  [[345,6,.9],[328,1.5,.95],[305,3,.76],[268,2,.8],[245,1,.75],[208,4,.8],[176,2,.6],[125,3,.72],[80,2,.56]].forEach(x=>ring(...x));
  c.lineCap='round';
  const trace=(pts,width,alpha)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.strokeStyle=`rgba(218,174,255,${alpha})`;c.lineWidth=width;c.shadowBlur=10;c.shadowColor='#6f17ec';c.stroke();c.shadowBlur=0;};
  for(const n of [5,8,10]){
    const pts=Array.from({length:n},(_,i)=>{const a=(i*Math.PI*2/n)-Math.PI/2;return [Math.cos(a)*(n===5?270:n===8?310:182),Math.sin(a)*(n===5?270:n===8?310:182)];});
    trace(pts,2,n===8?.5:.78);
  }
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6;c.save();c.rotate(angle);
    c.strokeStyle='rgba(236,185,255,.94)';c.lineWidth=2.2;c.shadowColor='#b85bff';c.shadowBlur=11;
    c.beginPath();c.moveTo(0,-355);c.lineTo(-14,-317);c.lineTo(0,-282);c.lineTo(14,-317);c.closePath();c.stroke();
    c.beginPath();c.moveTo(0,-303);c.lineTo(0,-215);c.stroke();
    c.lineWidth=1.4;c.beginPath();c.arc(0,-237,13,0,Math.PI*2);c.stroke();
    c.restore();
  }
  c.shadowBlur=0;
  for(let i=0;i<8;i++){
    c.save();c.rotate(i*Math.PI/4);c.strokeStyle='rgba(239,219,255,.68)';c.lineWidth=2;
    c.beginPath();c.moveTo(-14,-118);c.lineTo(0,-152);c.lineTo(14,-118);c.lineTo(0,-95);c.closePath();c.stroke();
    c.restore();
  }
  for(let i=0;i<5;i++){
    c.save();c.rotate(i*Math.PI*2/5);c.beginPath();c.moveTo(0,-184);c.quadraticCurveTo(-100,-80,0,0);c.quadraticCurveTo(100,-80,0,-184);
    c.lineWidth=1.6;c.strokeStyle='rgba(214,133,255,.66)';c.stroke();c.restore();
  }
  c.fillStyle='rgba(245,212,255,.94)';c.shadowColor='#9b2dff';c.shadowBlur=30;
  c.beginPath();c.moveTo(0,-51);c.lineTo(17,-17);c.lineTo(51,0);c.lineTo(17,17);c.lineTo(0,51);c.lineTo(-17,17);c.lineTo(-51,0);c.lineTo(-17,-17);c.closePath();c.fill();
  c.shadowBlur=0;
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=2;return tex;
}
function chainTexture(){
  const can=document.createElement('canvas');can.width=can.height=512;const c=can.getContext('2d');
  const gradient=c.createRadialGradient(256,256,20,256,256,230);gradient.addColorStop(0,'rgba(100,18,148,.3)');gradient.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gradient;c.fillRect(0,0,512,512);
  for(const sign of [-1,1]){
    c.save();c.translate(256,256);c.rotate(sign*Math.PI/4);
    c.shadowBlur=11;c.shadowColor='#a652ff';
    for(let i=-6;i<=6;i++){
      const x=i*40;c.beginPath();c.ellipse(x,0,19,12,0,0,Math.PI*2);
      c.lineWidth=6;c.strokeStyle=i%2?'#9e78c6':'#dfc8fa';c.stroke();
      c.beginPath();c.ellipse(x,0,16,9,0,0,Math.PI*2);c.lineWidth=2;c.strokeStyle='#4b1e81';c.stroke();
    }c.restore();
  }
  const tex=new THREE.CanvasTexture(can);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
let common=null;
const FJ_CG={seal:'uda-seal-v26.webp',chains:'uda-chains-v26.webp',orbs:'uda-onibi-v26.webp',beam:'uda-eyebeam-v26.webp'};
const fujTextures=new Map();
function fujTex(k){if(fujTextures.has(k))return fujTextures.get(k);
  const tex=new THREE.TextureLoader().load(new URL('./assets/fx/'+FJ_CG[k],import.meta.url).href,undefined,undefined,
    e=>console.warn('[藤原信頼 CG]',k,'素材が読めません',e));
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=2;fujTextures.set(k,tex);return tex;
}
function commonAssets(){
  if(!common)common={seal:fujTex('seal'),chains:fujTex('chains'),orbs:fujTex('orbs'),beam:fujTex('beam')};
  return common;
}
function fujSprite(map,size=1,alpha=.9){
  const mat=new THREE.SpriteMaterial({map,transparent:true,opacity:alpha,depthWrite:false,depthTest:true,
    blending:THREE.AdditiveBlending,toneMapped:false});
  const spr=new THREE.Sprite(mat);spr.scale.setScalar(size);spr.renderOrder=16;return spr;
}
function markCG(target){if(target._fujMarkCG||!target.root)return;
  const s=fujSprite(commonAssets().seal,2.4,.78);s.position.set(0,(target.def?.height||1.8)*.62,0);
  target.root.add(s);target._fujMarkCG=s;
}
function burnCG(target){if(target._fujBurnCG||!target.root)return;
  const s=fujSprite(commonAssets().orbs,2.2,.68);s.position.set(0,(target.def?.height||1.8)*.80,0);
  target.root.add(s);target._fujBurnCG=s;
}
function removeCharacterCG(target,field){const s=target[field];if(!s)return;s.material.dispose();s.removeFromParent();target[field]=null;}
function sealOn(caster){
  if(!caster?.battle || caster.dead)return;
  const b=caster.battle;
  let x=caster._fujSeal;
  if(!x){
    const mat=new THREE.MeshBasicMaterial({map:commonAssets().seal,transparent:true,opacity:.87,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(CURSE_RADIUS*2,CURSE_RADIUS*2),mat);
    quad.rotation.x=-Math.PI/2;quad.renderOrder=5;b.fx.add(quad);
    x={quad,mat,expires:0,collided:new Set()};caster._fujSeal=x;
  }
  x.expires=performance.now()/1000+CURSE_TIME;
  x.quad.visible=true;
  caster.battle.ui?.popup?.(caster.pos,'呪い《行動封絶》 30秒','#d5a2ff');
  caster.battle.ui?.sfx?.('skill');
  if(!caster.remoteAuth && caster.netId && b.net) b.net.cast?.({id:caster.netId,slot:'seal',tx:caster.pos.x,tz:caster.pos.z,ry:caster.facing});
}
function bindChains(tgt){
  if(tgt._fujCross)return;
  const mat=new THREE.SpriteMaterial({map:commonAssets().chains,transparent:true,depthWrite:false,opacity:1});
  const spr=new THREE.Sprite(mat);spr.scale.set(3.7,3.7,1);spr.position.set(0,Math.max(1.25,(tgt.def?.height||2)*.62),0);
  tgt.root.add(spr);tgt._fujCross={spr,mat};
}
function releaseStasis(tgt,attacked=false){
  const old=tgt._fujStasis;if(!old)return;
  tgt._fujStasis=null;
  if(old.owner && attacked)tgt._fujNoRefreezeOwner=old.owner;
  if(tgt._fujCross){tgt._fujCross.spr.removeFromParent();tgt._fujCross.mat.dispose();tgt._fujCross=null;}
  tgt._fujHoldPos=null;
  if(attacked)tgt.battle?.ui?.popup?.(tgt.pos,'呪縛解除','#e9caff');
}
function applyStasis(owner,tgt,now){
  if(tgt.dead || tgt._fujNoRefreezeOwner===owner)return;
  if(tgt._fujStasis?.owner===owner){tgt._fujStasis.until=now+.22;return;}
  releaseStasis(tgt);
  tgt._fujStasis={owner,until:now+.22};
  tgt._fujHoldPos=tgt.pos.clone();tgt.vel?.set(0,0,0);tgt.action=null;tgt.chantToken=null;
  bindChains(tgt);
  tgt.battle?.ui?.popup?.(tgt.pos,'行動停止','#cb87ff');
}
function updateSeal(f,dt){
  const seal=f._fujSeal;if(!seal)return;
  const now=performance.now()/1000;
  if(!seal.quad)return;
  if(f.dead || f.battle?.ended || now>seal.expires){seal.quad.removeFromParent();seal.mat.dispose();seal.quad.geometry.dispose();f._fujSeal=null;return;}
  seal.quad.position.set(f.pos.x,.048,f.pos.z);
  seal.quad.rotation.z+=dt*.15;
  seal.quad.material.opacity=.64+.18*Math.sin(now*4);
  for(const t of f.battle.enemiesOf(f)){
    if(!t || t.dead)continue;
    const r=Math.hypot(t.pos.x-f.pos.x,t.pos.z-f.pos.z);
    if(r>CURSE_RADIUS+t.radius*.25){if(t._fujNoRefreezeOwner===f)t._fujNoRefreezeOwner=null;if(t._fujStasis?.owner===f)releaseStasis(t);continue;}
    applyStasis(f,t,now);
    // Online receiver sees the same visual via the signed/verified caster's seal event.
  }
}
function applyMark(f,target,visualOnly=false){
  if(!target || target.dead)return;
  const now=performance.now()/1000;
  if(!target._fujMark || target._fujMark.until<=now){target._fujMark={caster:f,until:now+5,next:now+1,ticks:0};}
  if(!visualOnly){f.battle?.ui?.popup?.(target.pos,'呪印　HP10%×5秒','#cc85ff');}
  markCG(target);
  if(target._fujStasis)releaseStasis(target,true);
  if(!visualOnly && !f.remoteAuth && f.netId && f.battle.net)f.battle.net.cast?.({id:f.netId,slot:'mark',tx:target.pos.x,tz:target.pos.z,ry:f.facing});
}
function tickMark(t){
  const now=performance.now()/1000,mark=t._fujMark;if(!mark)return;
  if(t.dead||now>mark.until+.25||mark.ticks>=5){t._fujMark=null;removeCharacterCG(t,"_fujMarkCG");return;}
  if(now<mark.next)return;
  mark.next+=1;mark.ticks++;
  if(mark.caster?.dead || mark.caster?.battle!==t.battle || mark.caster.remoteAuth)return;
  const damage=Math.max(1,Math.round(t.maxHp*.1));
  t.battle.applyHit(mark.caster,t,damage,0,0,t.pos,statusMark);
}
function addBurn(f,t){
  if(!t||t.dead)return;
  const now=performance.now()/1000;
  if(!t._fujBurn || t._fujBurn.until<=now)t._fujBurn={caster:f,until:now+10,next:now+1,ticks:0};
  burnCG(t);
  t.battle?.ui?.popup?.(t.pos,'鬼火・灼熱10秒','#ff9e60');
}
function tickBurn(t){
  const x=t._fujBurn,now=performance.now()/1000;if(!x)return;
  if(t.dead||now>x.until+.25||x.ticks>=10){t._fujBurn=null;removeCharacterCG(t,"_fujBurnCG");return;}
  if(now<x.next)return;
  x.next+=1;x.ticks++;
  if(x.caster?.dead || x.caster?.battle!==t.battle || x.caster.remoteAuth)return;
  // Ten seconds of burning, 1/15 of target max HP each second; does not stack.
  t.battle.applyHit(x.caster,t,Math.max(1,Math.round(t.maxHp/15)),0,0,t.pos,statusBurn);
}
// Two illustrated ghost-flames orbit in three dimensions before converging on the target.
// Only textured sprites are created; no remeshing/shader injection or GLB material changes.
function startOrbs(b,f){
  const target=b.nearestEnemy?.(f);if(!target)return;
  const orbs=[];
  for(let i=0;i<2;i++){
    const m=fujSprite(commonAssets().orbs,1.75,.9);b.fx.add(m);
    const trails=[];
    for(let j=0;j<3;j++){const sp=fujSprite(commonAssets().orbs,.75-j*.14,.25-j*.05);b.fx.add(sp);trails.push(sp);}
    orbs.push({m,trails,a:i*Math.PI,hist:[]});
  }
  let t=0,done=false;
  const clean=()=>{for(const o of orbs){o.m.removeFromParent();o.m.material.dispose();
    for(const trail of o.trails){trail.removeFromParent();trail.material.dispose();}}};
  b.addEffect(dt=>{
    t+=Math.min(.06,Math.max(0,dt));
    for(const o of orbs){
      const dest=target.dead?f.pos:target.pos;
      const a=o.a+t*11.4,rad=Math.max(.08,1.6*(1-t/1.9));
      const from=v3(f.pos.x+Math.cos(a)*rad,(f.def.height||2)*.6+.3*Math.cos(a*1.8),f.pos.z+Math.sin(a)*rad);
      const k=clamp((t-.22)/1.22,0,1);
      o.m.position.copy(from.lerp(v3(dest.x,(target.def?.height||2)*.64,dest.z),k));
      o.m.material.rotation+=dt*(o.a?-.8:.8);
      o.hist.unshift(o.m.position.clone());if(o.hist.length>7)o.hist.length=7;
      for(let j=0;j<o.trails.length;j++){
        const past=o.hist[Math.min(o.hist.length-1,(j+1)*2)];if(past)o.trails[j].position.copy(past);
        o.trails[j].material.opacity=.22-j*.045;
      }
    }
    if(t>=1.48||target.dead){
      if(!done&&!target.dead){done=true;
        if(!f.remoteAuth){b.applyHit(f,target,78,.16,1,f.pos,statusBurn);addBurn(f,target);}
        else addBurn(f,target);
      }
      clean();return false;
    }
    return true;
  });
}
// CGI illustrated twin-eye purple laser: two crossed textured light planes per ray.
function eyeLaser(b,f){
  const root=new THREE.Group();b.fx.add(root);
  const beamMat=commonAssets().beam,beams=[];
  for(let i=0;i<2;i++){
    const mat=new THREE.MeshBasicMaterial({map:beamMat,transparent:true,opacity:.93,depthWrite:false,
      side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
    const m=new THREE.Mesh(new THREE.PlaneGeometry(2.7,17),mat);
    m.rotation.x=-Math.PI/2;m.position.set((i?1:-1)*.34,-.10,8.3);root.add(m);beams.push(m);
    const glowMat=mat.clone();glowMat.opacity=.52;
    const v=new THREE.Mesh(new THREE.PlaneGeometry(17,2.5),glowMat);
    v.rotation.y=Math.PI/2;v.position.set((i?1:-1)*.34,0,8.3);root.add(v);beams.push(v);
  }
  let t=0;const visited=new Set();
  b.addEffect(dt=>{
    t+=Math.min(.07,Math.max(0,dt));const k=clamp(t/1.1,0,1),sweep=-.9+k*1.8;
    root.position.copy(f.pos).add(v3(0,Math.max(1.3,(f.def.height||2)*.74),0));
    root.rotation.set(0,f.facing+sweep,0);
    for(const e of b.enemiesOf(f)){
      if(e.dead||visited.has(e))continue;
      const dx=e.pos.x-f.pos.x,dz=e.pos.z-f.pos.z,r=Math.hypot(dx,dz),a=Math.atan2(dx,dz);
      const diff=Math.atan2(Math.sin(a-(f.facing+sweep)),Math.cos(a-(f.facing+sweep)));
      if(r<17&&r>.1&&Math.abs(diff)<.16+(e.radius||.8)/Math.max(4,r)){
        visited.add(e);if(!f.remoteAuth)b.applyHit(f,e,Math.max(1650,Math.round(e.maxHp*.18)),.26,3,f.pos,specFor('呪いの光'));
        b.ui?.popup?.(e.pos,'呪光命中','#c276ff');
      }
    }
    for(const m of beams)m.material.opacity=Math.max(0,.86*(1-k));
    if(k<1)return true;
    for(const m of beams){m.geometry.dispose();m.material.dispose();}root.removeFromParent();return false;
  });
}
// 20-bone automatic runtime rig. Does not alter or re-export the user's GLB.
// V21 EXACT GLB: never remesh, recalculate weights, or alter the original GLB scene.
// This fixes the distorted appearance caused by the old procedural 20-bone conversion.
// RF_UDAIJIN_MOTION_V22: runtime motion controller.
// Original GLB bytes, original mesh topology, UVs, textures and original bind pose are retained.
// Authored clips take precedence; named bones are posed when suitable. Otherwise lightweight
// named separate parts or whole-body transforms are used, leaving the source geometry intact.
const FJ_MOTION_KEYWORDS={
 idle:/idle|wait|stand|breath|ready|待機/i,
 walk:/walk|walking|move|locomotion|歩行/i,
 run:/run|running|sprint|dash|jog|走行/i,
 attack:/attack|atk|punch|swing|slash|strike|hit|combo|combat|攻撃/i,
 cast:/cast|spell|magic|chant|skill|詠唱|魔法/i
};
const fujAxisX=new THREE.Vector3(1,0,0),fujAxisY=new THREE.Vector3(0,1,0),fujAxisZ=new THREE.Vector3(0,0,1);
const fujTempQ=new THREE.Quaternion(),fujTempQ2=new THREE.Quaternion();
function fujClipMap(clips){
  const entries=Object.entries(FJ_MOTION_KEYWORDS);
  return Object.fromEntries(entries.map(([k,re])=>[k,clips.find(c=>re.test(c.name||''))||null]));
}
function fujNamedBones(model){
  const bones=[];model.traverse(o=>{if(o.isBone)bones.push(o);});
  const normalized=b=>String(b?.name||'').toLowerCase().replace(/mixamorig/g,'').replace(/[^a-z0-9]/g,'');
  const side=(name,p)=>p==='l'?/left|^l(?:arm|leg|thigh|hand|fore|foot|shin)/.test(name):/right|^r(?:arm|leg|thigh|hand|fore|foot|shin)/.test(name);
  const find=(p,re)=>bones.find(b=>side(normalized(b),p)&&re.test(normalized(b)))||null;
  const center=re=>bones.find(b=>re.test(normalized(b))&&!/left|right/.test(normalized(b)))||null;
  const mapped={
    hips:center(/hips|pelvis|hiproot/),spine:center(/spine|waist/),chest:center(/chest|spine2|spine3/),
    neck:center(/neck/),head:center(/head/),
    lArm:find('l',/upperarm|shoulder|leftarm$/),rArm:find('r',/upperarm|shoulder|rightarm$/),
    lFore:find('l',/forearm|lowerarm|elbow/),rFore:find('r',/forearm|lowerarm|elbow/),
    lHand:find('l',/hand|wrist/),rHand:find('r',/hand|wrist/),
    lThigh:find('l',/thigh|upleg|upperleg/),rThigh:find('r',/thigh|upleg|upperleg/),
    lShin:find('l',/calf|shin|lowerleg|knee/),rShin:find('r',/calf|shin|lowerleg|knee/),
    lFoot:find('l',/foot|ankle/),rFoot:find('r',/foot|ankle/)
  };
  // Avoid shoulder matching the forearm, and hip-mapping errors on generic bones.
  const filtered=Object.fromEntries(Object.entries(mapped).filter(([,v])=>v));
  return filtered;
}
function fujPoseNamedBones(controller,walk,run,attack,cast,time){
  const bones=controller.bones,bases=controller.bases;
  const stride=Math.sin(time*(run>walk?10.8:6.4));
  const move=walk*.33+run*.59;
  const sway=move*stride;
  const bend=attack;
  const pose=(name,x=0,y=0,z=0)=>{
    const bone=bones[name],base=bases[name];if(!bone||!base)return;
    bone.quaternion.copy(base);
    if(x)bone.quaternion.multiply(fujTempQ.setFromAxisAngle(fujAxisX,x));
    if(y)bone.quaternion.multiply(fujTempQ2.setFromAxisAngle(fujAxisY,y));
    if(z)bone.quaternion.multiply(fujTempQ.setFromAxisAngle(fujAxisZ,z));
  };
  pose('hips',.035*sway,0,.025*sway);
  pose('spine',-.12*bend-.035*cast,.06*bend);
  pose('chest',-.11*bend-.10*cast,-.035*sway);
  pose('neck',.014*stride);pose('head',-.025*sway+.07*cast);
  pose('lArm',-.7*sway-.43*cast+.17*bend,0,-.07*cast);
  pose('rArm',.7*sway-.43*cast-.94*bend,0,.07*cast);
  pose('lFore',-.17-.35*cast-.12*bend);
  pose('rFore',-.17-.35*cast-.60*bend);
  pose('lHand',.12*cast);pose('rHand',-.12*cast);
  pose('lThigh',sway);pose('rThigh',-sway);
  pose('lShin',-Math.max(0,-stride)*(walk*.23+run*.43));
  pose('rShin',-Math.max(0,stride)*(walk*.23+run*.43));
  pose('lFoot',Math.max(0,-stride)*.13*walk);
  pose('rFoot',Math.max(0,stride)*.13*walk);
}
// RF_UDAIJIN_VISIBLE_V24_MOTION: Never replace original GLB shader/material/vertex buffers.
// Some WebGL implementations can fail V22 shader compilation without a clear
// game exception. Geometry, PBR materials, UV textures and mesh hierarchy
// now remain untouched. Existing skeleton and authored clips are preferred.

// If the GLB is split into separately named limbs (but not skinned), animate those transforms.
// A single welded unrigged mesh cannot bend at knees/elbows without modifying its geometry.
function fujNamedLooseParts(model){
  const mapped={};const patterns={
    lArm:/^(?:left|l)(?:upper)?(?:arm|shoulder)/i,rArm:/^(?:right|r)(?:upper)?(?:arm|shoulder)/i,
    lFore:/^(?:left|l)(?:forearm|lowerarm|elbow)/i,rFore:/^(?:right|r)(?:forearm|lowerarm|elbow)/i,
    lLeg:/^(?:left|l)(?:leg|thigh|upperleg)/i,rLeg:/^(?:right|r)(?:leg|thigh|upperleg)/i,
    lCalf:/^(?:left|l)(?:calf|shin|lowerleg)/i,rCalf:/^(?:right|r)(?:calf|shin|lowerleg)/i,
    head:/^(?:head|neck)/i,torso:/^(?:torso|chest|body|spine)/i
  };
  model.traverse(o=>{if(o===model||o.isSkinnedMesh||o.isBone||!o.name)return;
    const name=o.name.toLowerCase().replace(/[_\s.:-]/g,'').replace(/mixamorig/g,'');
    for(const [k,re] of Object.entries(patterns)){if(!mapped[k]&&re.test(name)){mapped[k]=o;break;}}
  });
  return mapped;
}
function fujMotionController(model,clips=[]){
  return createNobleMotion(model,clips,{name:'藤原信頼'});
}
function attachRig(f,glb){
  const model=f.modelInstance?.model;
  if(!model)return;
  const clips=glb?.animations||[];
  const controller=fujMotionController(model,clips);
  f._fujRig=controller;
  if(controller){
    if(controller.clips.attack)f.clips.fujaAttack=controller.clips.attack;
    else if(controller.clips.cast)f.clips.fujaAttack=controller.clips.cast;
    if(controller.clips.cast)f.clips.fujaCast=controller.clips.cast;
    if(controller.clips.walk)f.clips.walk||=controller.clips.walk;
    if(controller.clips.run)f.clips.run||=controller.clips.run;
    else if(controller.clips.walk)f.clips.run||=controller.clips.walk;
    if(controller.clips.walk==null && controller.clips.run)f.clips.walk||=controller.clips.run;
    if(controller.clips.idle)f.clips.idle||=controller.clips.idle;
  }
  console.info('[藤原信頼 Motion V35 / Detailed Safe WalkRunAttack]',controller?.mode||'none', 'original model preserved');
}
function animateRig(f,dt){
  const controller=f._fujRig;
  if(!controller || f.dead)return;
  const speed=Math.hypot(f.vel?.x||0,f.vel?.z||0);
  const moving=!!(f.moving||f.netMoving||speed>0.18);
  const running=moving && (speed>5.25 || f.action?.type==='dash' || !!f._fujSprint);
  const pulse=Number(f._fujStrike)||0;
  const attackAction = f.action?.type==='light' || f.action?.type==='cast' && pulse>0.1;
  const attack=pulse>0?Math.sin(Math.PI*clamp(1-pulse/.62,0,1)):0;
  f._fujStrike=Math.max(0,pulse-dt);
  const casting=!!(f.action?.type==='chant'||f.action?.type==='cast'||f._fujCastPulse>0);
  f._fujCastPulse=Math.max(0,(f._fujCastPulse||0)-dt);
  controller.update(dt,{moving,running,attack:Math.max(attack, attackAction?0.65:0),cast:casting?1:0});
}
// Adventure rest area uses a separate instance, not a Fighter. Reuse the same material-safe Motion.
export function attachFujiwaraRestMotion(model,clips=[]){
  const controller=fujMotionController(model,clips);
  return controller?{
    update(dt,moving,running){controller.update(dt,{moving:!!moving,running:!!running,attack:0,cast:0});},
    dispose(){controller.dispose();}
  }:null;
}
function cleanup(f){
  if(f._fujSeal){f._fujSeal.quad.removeFromParent();f._fujSeal.quad.geometry.dispose();f._fujSeal.mat.dispose();f._fujSeal=null;}
  if(f._fujCross){f._fujCross.spr.removeFromParent();f._fujCross.mat.dispose();f._fujCross=null;}
  removeCharacterCG(f,'_fujMarkCG');removeCharacterCG(f,'_fujBurnCG');
  const rig=f._fujRig;try{rig?.dispose?.();}catch(e){console.warn("[藤原信頼 Motion cleanup]",e);} 
  f._fujRig=null;f._fujMark=null;f._fujBurn=null;f._fujStasis=null;
}
function updateTouchUI(f){
  if(typeof document==='undefined')return;
  const b=document.querySelector('#tbtns');if(!b)return;
  const active=!!f;
  if(b.dataset.fujiwara_nobuyori===String(active))return;b.dataset.fujiwara_nobuyori=String(active);
  const labels={guard:['呪い','構'],attack:['印','斬'],skill:['鬼火','技A'],skill2:['光','技B']};
  for(const [act,text] of Object.entries(labels)){const el=b.querySelector(`[data-act="${act}"]`);if(el)el.textContent=active?text[0]:text[1];}
}
export function installFujiwaraCombat({Fighter,Battle,state}){
  if(!Fighter?.prototype||Fighter.prototype.__fujiwara_nobuyoriCurseV24Motion)return;
  Fighter.prototype.__fujiwara_nobuyoriCurseV24Motion=true;
  const baseBuild=Fighter.prototype.buildModel;
  Fighter.prototype.buildModel=function(glb,...args){
    const out=baseBuild.call(this,glb,...args);
    if(this.key===KEY)try{attachRig(this,glb)}catch(e){console.warn('[藤原信頼 RIG]',e);}
    return out;
  };
  const baseAnim=Fighter.prototype.anim;
  Fighter.prototype.anim=function(mode){
    if(this.key===KEY && this._fujRig){
      const speed=Math.hypot(this.vel?.x||0,this.vel?.z||0);
      const rig=this._fujRig;
      if((this._fujStrike>0 || this.action?.type==='light') && (this.clips?.fujaAttack || rig?.clips?.attack)) mode=this.clips?.fujaAttack?'fujaAttack':'attack';
      else if((this.action?.type==='chant'||this.action?.type==='cast'||this._fujCastPulse>0) && (this.clips?.fujaCast || rig?.clips?.cast)) mode=this.clips?.fujaCast?'fujaCast':'cast';
      else if(mode==='run'){
        if(speed>=5.25 && (this.clips?.run || rig?.clips?.run)) mode='run';
        else if(this.clips?.walk || rig?.clips?.walk) mode='walk';
      } else if(mode==='idle' && speed>0.16){
        if(speed>=5.25 && (this.clips?.run || rig?.clips?.run)) mode='run';
        else if(this.clips?.walk || rig?.clips?.walk) mode='walk';
      }
    }
    return baseAnim.call(this,mode);
  };
  const baseUpdate=Fighter.prototype.update;
  Fighter.prototype.update=function(dt,input){
    const t=performance.now()/1000,st=this._fujStasis;
    const frozen=!!(st&&st.until>t&&!this.dead),wasPos=frozen?this.pos.clone():null;
    if(st&&!frozen)releaseStasis(this);
    const inp={...(input||{})};
    if(this.key===KEY && !inp.attack)this._fujAttackHeld=false;
    if(frozen){
      this.vel.set(0,0,0);this.action=null;this.chantToken=null;
      this.stun=Math.max(.1,this.stun||0);
      Object.assign(inp,{mx:0,mz:0,guard:false,attack:false,skill:false,skill2:false,heal:false,over:false,jump:false,skillIdx:null});
    }
    if(this.key===KEY){
      const g=!!inp.guard;
      if(g&&!this._fujGuardPressed)sealOn(this);
      this._fujGuardPressed=g;
      inp.guard=false;
      // Two spells remain fixed regardless of movement; no rotating spell pool.
      if(inp.skill||inp.skill2){inp.skillIdx=inp.skill2?1:0;inp.skill=false;inp.skill2=false;}
      // H / L can still trigger the same fixed spells, without adding a fifth move.
      if(inp.heal){inp.skillIdx=0;inp.heal=false;}
      if(inp.over){inp.skillIdx=1;inp.over=false;}
    }
    const out=baseUpdate.call(this,dt,inp);
    if(frozen&&wasPos){this.pos.copy(wasPos);this.vel.set(0,0,0);this.sync?.();}
    if(this.key===KEY){updateSeal(this,clamp(dt,0,.05));animateRig(this,clamp(dt,0,.05));}
    tickMark(this);tickBurn(this);
    if(this._fujMarkCG){this._fujMarkCG.material.rotation+=dt*.7;
      this._fujMarkCG.material.opacity=.72+.15*Math.sin(performance.now()*.005);}
    if(this._fujBurnCG){this._fujBurnCG.material.rotation-=dt*.9;
      this._fujBurnCG.material.opacity=.55+.22*Math.sin(performance.now()*.008);}
    return out;
  };
  const baseLight=Fighter.prototype.startLight;
  Fighter.prototype.startLight=function(...args){
    if(this.key!==KEY)return baseLight.apply(this,args);
    if(this._fujAttackHeld)return;
    this._fujAttackHeld=true;
    const target=this.battle?.nearestEnemy?.(this);
    this._fujStrike=.62;
    this.anim?.('fujaAttack');
    if(target){this.faceNearest?.(40);applyMark(this,target,!!this.remoteAuth);}
    return undefined; // no ordinary combo/swing, mark is the basic attack
  };
  const baseReceive=Fighter.prototype.receive;
  Fighter.prototype.receive=function(dmg,...args){
    if(this._fujStasis && dmg>0)releaseStasis(this,true);
    return baseReceive.call(this,dmg,...args);
  };
  if(Battle?.prototype){
    const proto=Battle.prototype;
    const baseCast=proto.cast;
    proto.cast=function(f,slot,net){
      if(f?.key===KEY && slot==='seal'){f._fujCastPulse=0.5;sealOn(f);return;}
      if(f?.key===KEY && slot==='mark'){f._fujStrike=.46;
        const target=this.enemiesOf(f).find(x=>!x.dead&&Math.hypot(x.pos.x-(net?.tx??0),x.pos.z-(net?.tz??0))<3)||this.nearestEnemy(f);
        if(target)applyMark(f,target,true);
        return;
      }
      return baseCast.call(this,f,slot,net);
    };
    const baseExecute=proto.executeCast;
    proto.executeCast=function(f,slot,net){
      const result=baseExecute.call(this,f,slot,net);
      if(f?.key===KEY){
        f._fujCastPulse=0.75;
        const index=Number(slot?.slice(1));
        if(index===0)startOrbs(this,f);
        else if(index===1 || slot==='over' || slot==='hi')eyeLaser(this,f);
      }
      return result;
    };
    const baseDispose=proto.dispose;
    proto.dispose=function(...args){for(const f of this.fighters||[])cleanup(f);return baseDispose.apply(this,args);};
  }
  if(typeof window!=='undefined'){
    window.__rfAttachFujiwaraRestMotion=attachFujiwaraRestMotion;
    window.__rfFujiwaraCurrent=()=>{const s=typeof state==='function'?state():state;return s?.battle?.fighters?.find(x=>x.key===KEY&&x.isPlayer&&!x.remoteAuth)||null;};
    // On mobile, preserve the existing buttons and touch handlers; only change labels for this fighter.
    setInterval(()=>{
      const f=window.__rfFujiwaraCurrent?.(); // optional host hook
      if(f)updateTouchUI(f);
      else{const active=document.querySelector('#hud-left .plate')?.textContent?.includes('藤原信頼');updateTouchUI(active?{}:null);}
    },600);
  }
}
