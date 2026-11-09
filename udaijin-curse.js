// RF_UDAIJIN_MOTION_V22 右大臣 – chief-exclusive curse fighter.
// Exact source geometry, materials and textures; procedural remeshing disabled.
import * as THREE from 'three';
const KEY='udaijin', CURSE_TIME=30, CURSE_RADIUS=5.65;
const PURPLE=0xaf5dff, C=0xbc72ff;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const specFor=(name)=>({name,kind:'curse',elem:6,color:C,vivid:true});
const statusMark=specFor('呪印');
const statusBurn=specFor('おにび');
const animationNames={walk:/walk|歩行/i,run:/run|sprint|走行/i,attack:/attack|hit|punch|swing|攻撃/i,cast:/cast|spell|magic|詠唱/i};

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
function commonAssets(){
  if(!common)common={seal:magicTexture(),chains:chainTexture(),pSphere:new THREE.SphereGeometry(.2,9,7),pBeam:new THREE.CylinderGeometry(.08,.16,1,7)};
  return common;
}
function sealOn(caster){
  if(!caster?.battle || caster.dead)return;
  const b=caster.battle;
  let x=caster._udaSeal;
  if(!x){
    const mat=new THREE.MeshBasicMaterial({map:commonAssets().seal,transparent:true,opacity:.87,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(CURSE_RADIUS*2,CURSE_RADIUS*2),mat);
    quad.rotation.x=-Math.PI/2;quad.renderOrder=5;b.fx.add(quad);
    x={quad,mat,expires:0,collided:new Set()};caster._udaSeal=x;
  }
  x.expires=performance.now()/1000+CURSE_TIME;
  x.quad.visible=true;
  caster.battle.ui?.popup?.(caster.pos,'呪術結界《行動封絶》 30秒','#d5a2ff');
  caster.battle.ui?.sfx?.('skill');
  if(!caster.remoteAuth && caster.netId && b.net) b.net.cast?.({id:caster.netId,slot:'seal',tx:caster.pos.x,tz:caster.pos.z,ry:caster.facing});
}
function bindChains(tgt){
  if(tgt._udaCross)return;
  const mat=new THREE.SpriteMaterial({map:commonAssets().chains,transparent:true,depthWrite:false,opacity:1});
  const spr=new THREE.Sprite(mat);spr.scale.set(3.7,3.7,1);spr.position.set(0,Math.max(1.25,(tgt.def?.height||2)*.62),0);
  tgt.root.add(spr);tgt._udaCross={spr,mat};
}
function releaseStasis(tgt,attacked=false){
  const old=tgt._udaStasis;if(!old)return;
  tgt._udaStasis=null;
  if(old.owner && attacked)tgt._udaNoRefreezeOwner=old.owner;
  if(tgt._udaCross){tgt._udaCross.spr.removeFromParent();tgt._udaCross.mat.dispose();tgt._udaCross=null;}
  tgt._udaHoldPos=null;
  if(attacked)tgt.battle?.ui?.popup?.(tgt.pos,'呪縛解除','#e9caff');
}
function applyStasis(owner,tgt,now){
  if(tgt.dead || tgt._udaNoRefreezeOwner===owner)return;
  if(tgt._udaStasis?.owner===owner){tgt._udaStasis.until=now+.22;return;}
  releaseStasis(tgt);
  tgt._udaStasis={owner,until:now+.22};
  tgt._udaHoldPos=tgt.pos.clone();tgt.vel?.set(0,0,0);tgt.action=null;tgt.chantToken=null;
  bindChains(tgt);
  tgt.battle?.ui?.popup?.(tgt.pos,'行動停止','#cb87ff');
}
function updateSeal(f,dt){
  const seal=f._udaSeal;if(!seal)return;
  const now=performance.now()/1000;
  if(!seal.quad)return;
  if(f.dead || f.battle?.ended || now>seal.expires){seal.quad.removeFromParent();seal.mat.dispose();seal.quad.geometry.dispose();f._udaSeal=null;return;}
  seal.quad.position.set(f.pos.x,.048,f.pos.z);
  seal.quad.rotation.z+=dt*.15;
  seal.quad.material.opacity=.64+.18*Math.sin(now*4);
  for(const t of f.battle.enemiesOf(f)){
    if(!t || t.dead)continue;
    const r=Math.hypot(t.pos.x-f.pos.x,t.pos.z-f.pos.z);
    if(r>CURSE_RADIUS+t.radius*.25){if(t._udaNoRefreezeOwner===f)t._udaNoRefreezeOwner=null;if(t._udaStasis?.owner===f)releaseStasis(t);continue;}
    applyStasis(f,t,now);
    // Online receiver sees the same visual via the signed/verified caster's seal event.
  }
}
function applyMark(f,target,visualOnly=false){
  if(!target || target.dead)return;
  const now=performance.now()/1000;
  if(!target._udaMark || target._udaMark.until<=now){target._udaMark={caster:f,until:now+5,next:now+1,ticks:0};}
  if(!visualOnly){f.battle?.ui?.popup?.(target.pos,'呪印　HP10%×5秒','#cc85ff');}
  if(target._udaStasis)releaseStasis(target,true);
  if(!visualOnly && !f.remoteAuth && f.netId && f.battle.net)f.battle.net.cast?.({id:f.netId,slot:'mark',tx:target.pos.x,tz:target.pos.z,ry:f.facing});
}
function tickMark(t){
  const now=performance.now()/1000,mark=t._udaMark;if(!mark)return;
  if(t.dead||now>mark.until+.25||mark.ticks>=5){t._udaMark=null;return;}
  if(now<mark.next)return;
  mark.next+=1;mark.ticks++;
  if(mark.caster?.dead || mark.caster?.battle!==t.battle || mark.caster.remoteAuth)return;
  const damage=Math.max(1,Math.round(t.maxHp*.1));
  t.battle.applyHit(mark.caster,t,damage,0,0,t.pos,statusMark);
}
function addBurn(f,t){
  if(!t||t.dead)return;
  const now=performance.now()/1000;
  if(!t._udaBurn || t._udaBurn.until<=now)t._udaBurn={caster:f,until:now+10,next:now+1,ticks:0};
  t.battle?.ui?.popup?.(t.pos,'鬼火・灼熱10秒','#ff9e60');
}
function tickBurn(t){
  const x=t._udaBurn,now=performance.now()/1000;if(!x)return;
  if(t.dead||now>x.until+.25||x.ticks>=10){t._udaBurn=null;return;}
  if(now<x.next)return;
  x.next+=1;x.ticks++;
  if(x.caster?.dead || x.caster?.battle!==t.battle || x.caster.remoteAuth)return;
  // Ten seconds of burning, total about 1/15 max HP; no stacking.
  t.battle.applyHit(x.caster,t,Math.max(1,Math.round(t.maxHp/150)),0,0,t.pos,statusBurn);
}
function startOrbs(b,f){
  const target=b.nearestEnemy?.(f);
  if(!target)return;
  const geo=commonAssets().pSphere,orbs=[];
  for(let i=0;i<2;i++){
    const mat=new THREE.MeshBasicMaterial({color:i?0xef5aff:0xff742a,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending});
    const m=new THREE.Mesh(geo,mat);b.fx.add(m);orbs.push({m,mat,a:i*Math.PI});
  }
  let timer=0;
  b.addEffect(dt=>{
    timer+=dt;
    for(const o of orbs){
      const dest=target.dead ? f.pos : target.pos;
      const phase=o.a+timer*12;
      const p=o.m.position;
      const radius=Math.max(.15,1.4*(1-timer/2.45));
      const lift=1.6+.22*Math.sin(phase*1.5);
      const spiral=v3(f.pos.x+Math.cos(phase)*radius,lift,f.pos.z+Math.sin(phase)*radius);
      const seek=clamp((timer-.3)/1.25,0,1);
      p.copy(spiral.lerp(v3(dest.x,lift,dest.z),seek));
      o.m.scale.setScalar(.9+.15*Math.sin(timer*14));
    }
    if(timer>=1.58 || target.dead){
      if(!target.dead&&!f.remoteAuth){
        b.applyHit(f,target,78,.16,1,f.pos,statusBurn);
        addBurn(f,target);
      } else if(!target.dead) addBurn(f,target);
      for(const o of orbs){o.m.removeFromParent();o.mat.dispose();}
      return false;
    }
    return true;
  });
}
function eyeLaser(b,f){
  const root=new THREE.Group();b.fx.add(root);
  const beams=[];
  for(let i=0;i<2;i++){
    const mat=new THREE.MeshBasicMaterial({color:i?0xe9aaff:0x9b3aff,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending});
    const geo=new THREE.CylinderGeometry(.16,.24,17,9,1,true);
    const beam=new THREE.Mesh(geo,mat);beam.rotation.x=Math.PI/2;beam.position.set((i?1:-1)*.35,0,8.4);root.add(beam);beams.push({mat,geo});
  }
  let elapsed=0;const hit=new Set();
  b.addEffect(dt=>{
    elapsed+=dt;
    const phase=clamp(elapsed/1.15,0,1),sweep=-.88+phase*1.76;
    root.position.copy(f.pos).add(v3(0,Math.max(1.3,(f.def.height||2)*.74),0));
    root.rotation.set(0,f.facing+sweep,0);
    for(const e of b.enemiesOf(f)){
      if(e.dead||hit.has(e))continue;
      const dx=e.pos.x-f.pos.x,dz=e.pos.z-f.pos.z,r=Math.hypot(dx,dz);
      const a=Math.atan2(dx,dz);const diff=Math.atan2(Math.sin(a-(f.facing+sweep)),Math.cos(a-(f.facing+sweep)));
      if(r<16 && r>0.1 && Math.abs(diff)<.115+(e.radius||.8)/Math.max(3,r)){
        hit.add(e);
        if(!f.remoteAuth)b.applyHit(f,e,510,.48,4,f.pos,specFor('呪いの光'));
        b.ui?.popup?.(e.pos,'呪光命中','#c276ff');
      }
    }
    for(const x of beams)x.mat.opacity=Math.max(0,.72*(1-phase));
    if(phase<1)return true;
    for(const x of beams){x.geo.dispose();x.mat.dispose();}root.removeFromParent();return false;
  });
}
// 20-bone automatic runtime rig. Does not alter or re-export the user's GLB.
// V21 EXACT GLB: never remesh, recalculate weights, or alter the original GLB scene.
// This fixes the distorted appearance caused by the old procedural 20-bone conversion.
// RF_UDAIJIN_MOTION_V22: runtime motion controller.
// Original GLB bytes, original mesh topology, UVs, textures and original bind pose are retained.
// Authored clips take precedence; named bones are posed when suitable. Otherwise lightweight
// GPU vertex motions imitate articulated joints, leaving the source geometry intact.
const UD_MOTION_KEYWORDS={
 idle:/idle|wait|stand|待機/i,
 walk:/walk|walking|歩行/i,
 run:/run|running|sprint|走行/i,
 attack:/attack|punch|swing|slash|strike|hit|攻撃/i,
 cast:/cast|spell|magic|chant|詠唱|魔法/i
};
const udAxisX=new THREE.Vector3(1,0,0),udAxisY=new THREE.Vector3(0,1,0),udAxisZ=new THREE.Vector3(0,0,1);
const udTempQ=new THREE.Quaternion(),udTempQ2=new THREE.Quaternion();
function udClipMap(clips){
  const entries=Object.entries(UD_MOTION_KEYWORDS);
  return Object.fromEntries(entries.map(([k,re])=>[k,clips.find(c=>re.test(c.name||''))||null]));
}
function udNamedBones(model){
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
function udPoseNamedBones(controller,walk,run,attack,cast,time){
  const bones=controller.bones,bases=controller.bases;
  const stride=Math.sin(time*(run>walk?10.8:6.4));
  const move=walk*.33+run*.59;
  const sway=move*stride;
  const bend=attack;
  const pose=(name,x=0,y=0,z=0)=>{
    const bone=bones[name],base=bases[name];if(!bone||!base)return;
    bone.quaternion.copy(base);
    if(x)bone.quaternion.multiply(udTempQ.setFromAxisAngle(udAxisX,x));
    if(y)bone.quaternion.multiply(udTempQ2.setFromAxisAngle(udAxisY,y));
    if(z)bone.quaternion.multiply(udTempQ.setFromAxisAngle(udAxisZ,z));
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
const UD_VERTEX_FUNCTIONS=`
uniform mat4 udaToModel;
uniform mat4 udaFromModel;
uniform vec4 udaBounds; // centerX, minY, height, width
uniform float udaDepthCenter;
uniform vec4 udaMotion; // clock, walk strength, run strength, strike strength
uniform float udaCastStrength;
float udaSmooth(float low,float high,float x){float t=clamp((x-low)/max(.000001,high-low),0.,1.);return t*t*(3.-2.*t);}
vec3 udaRotateX(vec3 v,vec3 c,float a){float co=cos(a),si=sin(a);vec3 q=v-c;return c+vec3(q.x,co*q.y-si*q.z,si*q.y+co*q.z);}
vec3 udaRotateY(vec3 v,vec3 c,float a){float co=cos(a),si=sin(a);vec3 q=v-c;return c+vec3(co*q.x+si*q.z,q.y,-si*q.x+co*q.z);}
vec3 udaBend(vec3 v){
 float h=max(.000001,udaBounds.z),w=max(.000001,udaBounds.w);
 float yy=(v.y-udaBounds.y)/h;
 float xx=(v.x-udaBounds.x)/w;
 float ax=abs(xx),side=xx<0.0?-1.0:1.0;
 float run=udaMotion.z,walk=udaMotion.y,atk=udaMotion.w,cast=udaCastStrength;
 float wave=sin(udaMotion.x*(run>walk?10.7:6.3));
 float move=(walk*.34+run*.58)*wave;
 // Arms: shoulder rotation + forearm flex, softly connected to the torso.
 float am=udaSmooth(.17,.29,ax)*udaSmooth(.51,.65,yy)*(1.-udaSmooth(.89,.98,yy));
 float elbow=am*udaSmooth(.31,.46,ax)*(1.-udaSmooth(.69,.79,yy));
 vec3 shoulder=vec3(udaBounds.x+side*w*.28,udaBounds.y+h*.765,udaDepthCenter);
 float armAngle= -side*move*.77-cast*.46+(side>0.0?-.93:.22)*atk;
 vec3 arm=udaRotateX(v,shoulder,armAngle);
 v=mix(v,arm,am*.86);
 vec3 elbowP=vec3(udaBounds.x+side*w*.39,udaBounds.y+h*.615,udaDepthCenter);
 v=mix(v,udaRotateX(v,elbowP,-.24*elbow-.40*cast*elbow-.44*atk*elbow),min(.78,elbow));
 // Legs and knees: separate opposite stride and bending for walk versus run.
 float lm=(1.-udaSmooth(.47,.56,yy))*udaSmooth(.025,.115,ax)*(1.-udaSmooth(.44,.55,ax));
 float lower=lm*(1.-udaSmooth(.20,.35,yy));
 vec3 hip=vec3(udaBounds.x+side*w*.13,udaBounds.y+h*.49,udaDepthCenter);
 v=mix(v,udaRotateX(v,hip,side*move*.84),lm*.83);
 vec3 knee=vec3(udaBounds.x+side*w*.14,udaBounds.y+h*.25,udaDepthCenter);
 float flex=-max(0.,side*wave)*(.23*walk+.44*run);
 v=mix(v,udaRotateX(v,knee,flex),lower*.74);
 // Upper body turn on striking; soft idle breathing.
 float torso=udaSmooth(.48,.68,yy)*(1.-udaSmooth(.85,.97,yy))*(1.-udaSmooth(.24,.46,ax));
 v=mix(v,udaRotateY(v,vec3(udaBounds.x,udaBounds.y+h*.70,udaDepthCenter),-.11*atk),torso*.70);
 v.y+=h*.0028*sin(udaMotion.x*2.2)*torso;
 return v;
}
`;
const UD_VERTEX_BEGIN=`#include <begin_vertex>
vec3 udaModelPoint=(udaToModel*vec4(transformed,1.0)).xyz;
udaModelPoint=udaBend(udaModelPoint);
transformed=(udaFromModel*vec4(udaModelPoint,1.0)).xyz;`;
function udGpuController(model){
  model.updateMatrixWorld(true);
  const inv=model.matrixWorld.clone().invert();
  const entries=[],bounds=new THREE.Box3();
  const samples=[];
  model.traverse(mesh=>{
    if(!mesh.isMesh || mesh.isSkinnedMesh || !mesh.geometry?.getAttribute?.('position'))return;
    if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
    if(!mesh.geometry.boundingBox)return;
    const toModel=inv.clone().multiply(mesh.matrixWorld);
    const bb=mesh.geometry.boundingBox.clone().applyMatrix4(toModel);
    if(!Number.isFinite(bb.min.y))return;
    bounds.union(bb);
    const p=mesh.geometry.getAttribute('position'),stride=Math.max(1,Math.ceil(p.count/350));
    const temp=new THREE.Vector3();
    for(let i=0;i<p.count;i+=stride){temp.fromBufferAttribute(p,i).applyMatrix4(toModel);if(Number.isFinite(temp.x)&&Number.isFinite(temp.y))samples.push([temp.x,temp.y]);}
    entries.push({mesh,toModel,fromModel:toModel.clone().invert()});
  });
  if(!entries.length||samples.length<8)return null;
  const xs=samples.map(p=>p[0]).sort((a,b)=>a-b);
  const ys=samples.map(p=>p[1]).sort((a,b)=>a-b);
  const q=(arr,v)=>arr[Math.min(arr.length-1,Math.max(0,Math.floor((arr.length-1)*v)))];
  const minY=q(ys,.01),maxY=q(ys,.99),height=maxY-minY;
  const width=Math.max(1e-6,q(xs,.95)-q(xs,.05));
  const midX=(q(xs,.05)+q(xs,.95))*.5;
  if(!(height>0 && width>0) || height<width*.55 || height < (bounds.max.z-bounds.min.z)*.50){
    console.info('[右大臣 Motion] 3D座標軸が標準と異なるため、形状優先の全体Motionに切替');return null;
  }
  const pose=new THREE.Vector4(),cast={value:0};
  const dim=new THREE.Vector4(midX,minY,height,width);
  const saved=[];
  for(const {mesh,toModel,fromModel} of entries){
    const originals=mesh.material;
    const materials=Array.isArray(originals)?originals:[originals];
    let installed=false;
    const clones=materials.map(mat=>{
      if(!mat?.clone || mat.isShaderMaterial || mat.isRawShaderMaterial)return mat;
      const clone=mat.clone(),prior=mat.onBeforeCompile;
      const oldKey=typeof mat.customProgramCacheKey==='function'?mat.customProgramCacheKey.bind(mat):()=>'plain';
      clone.onBeforeCompile=function(shader,renderer){
        if(typeof prior==='function')prior.call(this,shader,renderer);
        if(!shader.vertexShader.includes('#include <begin_vertex>')||!shader.vertexShader.includes('#include <common>'))return;
        shader.uniforms.udaToModel={value:toModel};
        shader.uniforms.udaFromModel={value:fromModel};
        shader.uniforms.udaBounds={value:dim};
        shader.uniforms.udaDepthCenter={value:(bounds.min.z+bounds.max.z)*.5};
        shader.uniforms.udaMotion={value:pose};
        shader.uniforms.udaCastStrength=cast;
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+UD_VERTEX_FUNCTIONS);
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',UD_VERTEX_BEGIN);
      };
      clone.customProgramCacheKey=()=>String(oldKey())+'-rf-uda-v22';
      clone.needsUpdate=true;
      installed=true;
      return clone;
    });
    if(installed){mesh.material=Array.isArray(originals)?clones:clones[0];saved.push({mesh,originals,clones});}
  }
  if(!saved.length)return null;
  return {
    mode:'shader',time:0,model,baseY:model.position.y,
    update(dt,p){
      this.time+=dt;
      pose.set(this.time,p.walk,p.run,p.attack);
      cast.value=p.cast;
      model.position.y=this.baseY+(p.walk*.008+p.run*.022)*Math.abs(Math.sin(this.time*8));
    },
    dispose(){
      model.position.y=this.baseY;
      for(const rec of saved){
        if(rec.mesh.isMesh)rec.mesh.material=rec.originals;
        for(const m of rec.clones)if(m && !(Array.isArray(rec.originals)?rec.originals.includes(m):rec.originals===m))m.dispose();
      }
    }
  };
}
function udMotionController(model,clips=[]){
  if(!model)return null;
  const names=udClipMap(clips);
  const bones=udNamedBones(model),usableBones=Number(!!bones.lArm)+Number(!!bones.rArm)+Number(!!bones.lThigh)+Number(!!bones.rThigh);
    let underlying=null,mode='whole';
  if(usableBones>=3){
    const bases=Object.fromEntries(Object.entries(bones).map(([k,v])=>[k,v.quaternion.clone()]));
    underlying={mode:'bones',bones,bases,model,baseY:model.position.y,
      update(dt,p){udPoseNamedBones(this,p.walk,p.run,p.attack,p.cast,p.time);},
      dispose(){for(const [k,b] of Object.entries(bones))b.quaternion.copy(bases[k]);}
    };mode='bones';
  }else if(!names.walk&&!names.run&&!names.attack&&!names.cast){
    underlying=udGpuController(model);if(underlying)mode='shader';
  }
  if(!underlying){
    const base=model.position.clone(),baseRY=model.rotation.y;
    underlying={mode:'whole',update(dt,p){
      model.position.y=base.y+(p.walk*.009+p.run*.023)*Math.abs(Math.sin(p.time*9));
      model.rotation.y=baseRY-.12*p.attack*Math.sin(Math.min(1,p.attack)*Math.PI*.5);
    },dispose(){model.position.copy(base);model.rotation.y=baseRY;}};
  }
  const state={model,mode,clips:names,time:0,walk:0,run:0,attack:0,cast:0};
  const blend=(old,value,dt,rate)=>old+(value-old)*(1-Math.exp(-rate*dt));
  return {
    ...state,
    update(dt,{moving=false,running=false,attack=0,cast=0}={}){
      dt=clamp(+dt||0,0,.05);this.time+=dt;
      this.walk=blend(this.walk,moving&&!running?1:0,dt,9);
      this.run=blend(this.run,moving&&running?1:0,dt,10);
      this.attack=blend(this.attack,attack,dt,16);
      this.cast=blend(this.cast,cast,dt,8);
      const playingAuthored=(this.walk>0.5&&!!names.walk)||(this.run>0.5&&!!names.run)||(this.attack>0.5&&!!names.attack)||(this.cast>0.5&&!!names.cast)||((this.walk+this.run+this.attack+this.cast)<.1&&!!names.idle);
      // Authored animation is never warped by a second procedural animation.
      if(playingAuthored && mode==='bones')return;
      underlying.update(dt,{time:this.time,walk:this.walk,run:this.run,attack:this.attack,cast:this.cast});
    },
    dispose(){underlying.dispose();}
  };
}
function attachRig(f,glb){
  const model=f.modelInstance?.model;
  if(!model)return;
  const clips=glb?.animations||[];
  const controller=udMotionController(model,clips);
  f._udaRig=controller;
  if(controller){
    if(controller.clips.attack)f.clips.udaAttack=controller.clips.attack;
    if(controller.clips.cast)f.clips.udaCast=controller.clips.cast;
    if(controller.clips.walk)f.clips.walk||=controller.clips.walk;
    if(controller.clips.run)f.clips.run||=controller.clips.run;
    if(controller.clips.idle)f.clips.idle||=controller.clips.idle;
  }
  console.info('[右大臣 Motion V22]',controller?.mode||'none', 'original model preserved');
}
function animateRig(f,dt){
  const controller=f._udaRig;
  if(!controller || f.dead)return;
  const moving=!!(f.moving||f.netMoving);
  const speed=Math.hypot(f.vel?.x||0,f.vel?.z||0);
  const running=moving && (speed>6.2 || f.action?.type==='dash' || !!f._udaSprint);
  const pulse=Number(f._udaStrike)||0;
  const attack=pulse>0?Math.sin(Math.PI*clamp(1-pulse/.46,0,1)):0;
  f._udaStrike=Math.max(0,pulse-dt);
  const casting=!!(f.action?.type==='chant'||f.action?.type==='cast'||f._udaCastPulse>0);
  f._udaCastPulse=Math.max(0,(f._udaCastPulse||0)-dt);
  controller.update(dt,{moving,running,attack,cast:casting?1:0});
}
// Adventure rest area uses a separate instance, not a Fighter. Reuse the same material-safe Motion.
export function attachUdaijinRestMotion(model,clips=[]){
  const controller=udMotionController(model,clips);
  return controller?{
    update(dt,moving,running){controller.update(dt,{moving:!!moving,running:!!running,attack:0,cast:0});},
    dispose(){controller.dispose();}
  }:null;
}
function cleanup(f){
  if(f._udaSeal){f._udaSeal.quad.removeFromParent();f._udaSeal.quad.geometry.dispose();f._udaSeal.mat.dispose();f._udaSeal=null;}
  if(f._udaCross){f._udaCross.spr.removeFromParent();f._udaCross.mat.dispose();f._udaCross=null;}
  const rig=f._udaRig;try{rig?.dispose?.();}catch(e){console.warn("[右大臣 Motion cleanup]",e);} 
  f._udaRig=null;f._udaMark=null;f._udaBurn=null;f._udaStasis=null;
}
function updateTouchUI(f){
  if(typeof document==='undefined')return;
  const b=document.querySelector('#tbtns');if(!b)return;
  const active=!!f;
  if(b.dataset.udaijin===String(active))return;b.dataset.udaijin=String(active);
  const labels={guard:['呪','構'],attack:['印','斬'],skill:['鬼','技A'],skill2:['光','技B']};
  for(const [act,text] of Object.entries(labels)){const el=b.querySelector(`[data-act="${act}"]`);if(el)el.textContent=active?text[0]:text[1];}
}
export function installUdaijinCombat({Fighter,Battle,state}){
  if(!Fighter?.prototype||Fighter.prototype.__udaijinCurseV22)return;
  Fighter.prototype.__udaijinCurseV22=true;
  const baseBuild=Fighter.prototype.buildModel;
  Fighter.prototype.buildModel=function(glb,...args){
    const out=baseBuild.call(this,glb,...args);
    if(this.key===KEY)try{attachRig(this,glb)}catch(e){console.warn('[右大臣 RIG]',e);}
    return out;
  };
  const baseAnim=Fighter.prototype.anim;
  Fighter.prototype.anim=function(mode){
    if(this.key===KEY && this._udaRig){
      if(this._udaStrike>0 && this.clips?.udaAttack)mode='udaAttack';
      else if((this.action?.type==='chant'||this.action?.type==='cast'||this._udaCastPulse>0) && this.clips?.udaCast)mode='udaCast';
      else if(mode==='run' && this.clips?.walk && Math.hypot(this.vel?.x||0,this.vel?.z||0)<6.2)mode='walk';
    }
    return baseAnim.call(this,mode);
  };
  const baseUpdate=Fighter.prototype.update;
  Fighter.prototype.update=function(dt,input){
    const t=performance.now()/1000,st=this._udaStasis;
    const frozen=!!(st&&st.until>t&&!this.dead),wasPos=frozen?this.pos.clone():null;
    if(st&&!frozen)releaseStasis(this);
    const inp={...(input||{})};
    if(frozen){
      this.vel.set(0,0,0);this.action=null;this.chantToken=null;
      this.stun=Math.max(.1,this.stun||0);
      Object.assign(inp,{mx:0,mz:0,guard:false,attack:false,skill:false,skill2:false,heal:false,over:false,jump:false,skillIdx:null});
    }
    if(this.key===KEY){
      const g=!!inp.guard;
      if(g&&!this._udaGuardPressed)sealOn(this);
      this._udaGuardPressed=g;
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
    return out;
  };
  const baseLight=Fighter.prototype.startLight;
  Fighter.prototype.startLight=function(...args){
    if(this.key!==KEY)return baseLight.apply(this,args);
    const target=this.battle?.nearestEnemy?.(this);
    this._udaStrike=.46;
    this.anim?.('udaAttack');
    if(target){this.faceNearest?.(40);applyMark(this,target,!!this.remoteAuth);}
    return undefined; // no ordinary combo/swing, mark is the basic attack
  };
  const baseReceive=Fighter.prototype.receive;
  Fighter.prototype.receive=function(dmg,...args){
    if(this._udaStasis && dmg>0)releaseStasis(this,true);
    return baseReceive.call(this,dmg,...args);
  };
  if(Battle?.prototype){
    const proto=Battle.prototype;
    const baseCast=proto.cast;
    proto.cast=function(f,slot,net){
      if(f?.key===KEY && slot==='seal'){f._udaCastPulse=0.5;sealOn(f);return;}
      if(f?.key===KEY && slot==='mark'){f._udaStrike=.46;
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
        f._udaCastPulse=0.75;
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
    window.__rfAttachUdaijinRestMotion=attachUdaijinRestMotion;
    window.__rfUdaijinCurrent=()=>{const s=typeof state==='function'?state():state;return s?.battle?.fighters?.find(x=>x.key===KEY&&x.isPlayer&&!x.remoteAuth)||null;};
    // On mobile, preserve the existing buttons and touch handlers; only change labels for this fighter.
    setInterval(()=>{
      const f=window.__rfUdaijinCurrent?.(); // optional host hook
      if(f)updateTouchUI(f);
      else{const active=document.querySelector('#hud-left .plate')?.textContent?.includes('右大臣');updateTouchUI(active?{}:null);}
    },600);
  }
}
