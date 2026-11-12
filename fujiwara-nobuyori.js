// RF_FUJIWARA_NOBUYORI_V35_CG_SAFE_MOTION 藤原信頼 – chief-exclusive curse fighter.
// Exact source geometry, materials and textures; procedural remeshing disabled.
import * as THREE from 'three';
import { createNobleMotion } from './noble-motion.js?v=rf-noble-motion-v35';
import { FUJIWARA_KEY as KEY, fujiwaraSprite, showFujiwaraSkull, clearFujiwaraSkull } from './assets/rf5529/fujiwara-cg.js?v=55.29';
import { createFujiwaraJudgmentCG, JUDGMENT_IMPACT, JUDGMENT_END } from './assets/rf5529/fujiwara-judgment.js?v=55.29';
const CURSE_TIME=30, CURSE_RADIUS=5.65;
const C=0xbc72ff;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const specFor=(name)=>({name,kind:'curse',elem:6,color:C,vivid:true});
const statusMark=specFor('呪印');
const statusBurn=specFor('鬼火');
function burnCG(target){if(target._fujBurnCG||!target.root)return;
  const s=fujiwaraSprite('orbs',2.2,2.2,.68);s.position.set(0,(target.def?.height||1.8)*.80,0);
  target.root.add(s);target._fujBurnCG=s;
}
function removeCharacterCG(target,field){const s=target[field];if(!s)return;s.material.dispose();s.removeFromParent();target[field]=null;}
function sealOn(caster){
  if(!caster?.battle || caster.dead)return;
  const b=caster.battle;
  let x=caster._fujSeal;
  if(!x){
    const sprite = fujiwaraSprite('seal', CURSE_RADIUS * 2, CURSE_RADIUS, .68);
    sprite.name = 'Fujiwara curse seal';
    sprite.material.depthTest = false;
    sprite.renderOrder = 4;
    sprite.position.set(caster.pos.x, .075, caster.pos.z);
    b.scene.add(sprite);
    x = caster._fujSeal = { sprite, expires: 0 };
  }
  x.expires=performance.now()/1000+CURSE_TIME;
  x.sprite.visible=true;
  caster.battle.ui?.popup?.(caster.pos,'呪い《行動封絶》 30秒','#d5a2ff');
  caster.battle.ui?.sfx?.('skill');
  if(!caster.remoteAuth && caster.netId && b.net) b.net.cast?.({id:caster.netId,slot:'seal',tx:caster.pos.x,tz:caster.pos.z,ry:caster.facing});
}
function bindChains(tgt){
  if(tgt._fujCross)return;
  const spr = fujiwaraSprite('chains', 3.7, 3.7, 1, false);
  spr.position.y = Math.max(1.25, (tgt.def?.height || 2) * .62);
  tgt.root.add(spr);
  tgt._fujCross = { spr, mat: spr.material };
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
  if(f.dead || f.battle?.ended || now>seal.expires){
    seal.sprite.removeFromParent();
    seal.sprite.material.dispose();
    f._fujSeal=null;
    return;
  }
  seal.sprite.position.set(f.pos.x,.075,f.pos.z);
  const camera = f.battle.camera?.position;
  if (camera) {
    const distance = camera.distanceTo(seal.sprite.position);
    const tilt = clamp((camera.y - seal.sprite.position.y) / Math.max(1, distance), .2, .65);
    seal.sprite.scale.y = CURSE_RADIUS * 2 * tilt;
  }
  seal.sprite.material.opacity=.62+.13*Math.sin(now*4);
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
  showFujiwaraSkull(target);
  if(target._fujStasis)releaseStasis(target,true);
  if(!visualOnly && !f.remoteAuth && f.netId && f.battle.net)f.battle.net.cast?.({id:f.netId,slot:'mark',tx:target.pos.x,tz:target.pos.z,ry:f.facing});
}
function tickMark(t){
  const now=performance.now()/1000,mark=t._fujMark;if(!mark)return;
  if(t.dead||now>mark.until+.25||mark.ticks>=5){t._fujMark=null;clearFujiwaraSkull(t);return;}
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
    const m=fujiwaraSprite('orbs',1.75);b.fx.add(m);
    const trails=[];
    for(let j=0;j<3;j++){const sp=fujiwaraSprite('orbs',.75-j*.14,.75-j*.14,.25-j*.05);b.fx.add(sp);trails.push(sp);}
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
// Project the beam direction into the camera plane; the hit sweep still uses world coordinates.
function eyeLaser(b,f){
  const root=new THREE.Group();b.fx.add(root);
  const beams=[fujiwaraSprite('beam',17,2.25,.9),fujiwaraSprite('beam',17,2.25,.9)];
  root.add(...beams);
  const direction=v3(), imageDirection=v3();
  let t=0;
  const visited=new Set();
  b.addEffect(dt=>{
    if(b.ended||f.dead){rf43Dispose(root);return false;}
    t+=Math.min(.07,Math.max(0,dt));
    const k=clamp(t/1.1,0,1),sweep=-.9+k*1.8;
    const yaw=f.facing+sweep;
    direction.set(Math.sin(yaw),0,Math.cos(yaw));
    imageDirection.copy(direction);
    if (b.camera?.matrixWorldInverse) imageDirection.transformDirection(b.camera.matrixWorldInverse);
    const width = 17 * Math.max(.08, Math.hypot(imageDirection.x,imageDirection.y));
    const rotation = Math.atan2(imageDirection.y,imageDirection.x);
    for (const [i,beam] of beams.entries()) {
      const side = i===0?-.34:.34;
      beam.position.set(f.pos.x + direction.x*8.5 + direction.z*side,
        f.y + Math.max(1.3,(f.def.height||2)*.74), f.pos.z + direction.z*8.5 - direction.x*side);
      beam.scale.x = width;
      beam.material.rotation = rotation;
      beam.material.opacity = .86 * (1-k);
    }
    for(const e of b.enemiesOf(f)){
      if(e.dead||visited.has(e))continue;
      const dx=e.pos.x-f.pos.x,dz=e.pos.z-f.pos.z,r=Math.hypot(dx,dz),a=Math.atan2(dx,dz);
      const diff=Math.atan2(Math.sin(a-yaw),Math.cos(a-yaw));
      if(r<17&&r>.1&&Math.abs(diff)<.16+(e.radius||.8)/Math.max(4,r)){
        visited.add(e);
        if(!f.remoteAuth)b.applyHit(f,e,Math.max(1650,Math.round(e.maxHp*.18)),.26,3,f.pos,specFor('呪いの光'));
        b.ui?.popup?.(e.pos,'呪光命中','#c276ff');
      }
    }
    if(k<1)return true;
    rf43Dispose(root);
    return false;
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
  if(f._fujSeal){f._fujSeal.sprite.removeFromParent();f._fujSeal.sprite.material.dispose();f._fujSeal=null;}
  if(f._fujCross){f._fujCross.spr.removeFromParent();f._fujCross.mat.dispose();f._fujCross=null;}
  clearFujiwaraSkull(f);removeCharacterCG(f,'_fujBurnCG');
  const rig=f._fujRig;try{rig?.dispose?.();}catch(e){console.warn("[藤原信頼 Motion cleanup]",e);} 
  f._fujRig=null;f._fujMark=null;f._fujBurn=null;f._fujStasis=null;f._rf43PendingLeech=null;
}
function updateTouchUI(f){
  if(typeof document==='undefined')return;
  const b=document.querySelector('#tbtns');if(!b)return;
  const active=!!f;
  if(b.dataset.fujiwara_nobuyori===String(active))return;b.dataset.fujiwara_nobuyori=String(active);
  const labels={guard:['呪い','構'],attack:['印','斬'],skill:['鬼火','技A'],skill2:['光','技B']};
  for(const [act,text] of Object.entries(labels)){const el=b.querySelector(`[data-act="${act}"]`);if(el)el.textContent=active?text[0]:text[1];}
}
// The special effects use painted images. Shared sprite geometry and textures stay cached.
function rf43Glow(size,color,opacity=.85){
  const sprite = fujiwaraSprite('glow',size,size,opacity);
  sprite.material.color.setHex(color);
  return sprite;
}
function rf43Dispose(root){
  root.traverse(object => { if (object.isSprite) object.material.dispose(); });
  root.removeFromParent();
}
function paintedImpact(b, position, color, size) {
  const root = new THREE.Group();
  root.position.copy(position);
  const flare = rf43Glow(size,color,.83);
  const halo = rf43Glow(size*1.9,color,.28);
  const sparks = Array.from({length:5}, (_,index) => rf43Glow(size*.16,index%2?color:0xffedc7,.72));
  root.add(halo,flare,...sparks);
  b.fx.add(root);
  let time = 0;
  b.addEffect(dt=>{
    time += Math.max(0,dt);
    const t = clamp(time/.54,0,1);
    flare.scale.setScalar(size*(.75+t*.65));
    flare.material.opacity = .83*(1-t)**2;
    halo.scale.setScalar(size*(1.35+t*1.8));
    halo.material.opacity = .28*(1-t);
    for (const [index,spark] of sparks.entries()) {
      const angle = index*2.4;
      spark.position.set(Math.cos(angle)*size*t*.64,t*(.5+index*.22),Math.sin(angle)*size*t*.64);
      spark.material.opacity = .72*(1-t);
    }
    if(t<1&&!b.ended)return true;
    rf43Dispose(root);
    return false;
  });
}
// Resolve a stable percentage of the target's MAXIMUM HP after the defender's
// normal damage modifiers. Guard/invincibility can still reduce or prevent a hit.
// The existing V41 1-100% setting is applied by Battle.applyHit only once.
function rf43PercentHit(b,caster,target,fraction,skillName){
  if(!b||!caster||!target||target.dead||b.ended||caster.remoteAuth)return 0;
  const maxHP=Math.max(1,Number(target.maxHp)||1);
  const attack=Math.max(.001,Number(caster.atkMul)||1);
  const defOriginal=Number(target.defMul);
  const defEffective=Number.isFinite(defOriginal)&&defOriginal>0?defOriginal:1;
  const curse=target.status?.curse?1.3:1;
  const awakened=target.awakened>0?.5:1;
  const blind=caster.status?.blind ? 0.6 : 1;
  // Compensate for power/armor so 50%/75% means the actual HP change on a
  // normally unguarded victim, rather than an arbitrary raw damage number.
  const input=Math.max(1,Math.round(maxHP*fraction/(attack*defEffective*curse*awakened*blind)));
  const before=Math.max(0,Number(target.hp)||0);
  // Some legacy full-limit-break saves have a negative defense multiplier.
  // Only for this single hit, avoid turning a damage ability into healing.
  if(!target.remoteAuth && !(defOriginal>0))target.defMul=1;
  try{
    b.applyHit(caster,target,input,.45,1.8,caster.pos,{name:skillName,kind:'curse',elem:6,color:0xffd7f0,vivid:true});
  }finally{
    if(!target.remoteAuth && !(defOriginal>0))target.defMul=defOriginal;
  }
  if(target.remoteAuth){
    // Await peer's HP report before awarding lifesteal; do not heal on
    // unconfirmed outgoing packets. Network play can have acknowledgement lag.
    if(fraction===.5){
      caster._rf43PendingLeech={target,before,until:performance.now()/1000+4,
        ceiling:Math.min(before,Math.round(maxHP*fraction)),done:false};
    }
    return 0;
  }
  return Math.max(0,before-Math.max(0,Number(target.hp)||0));
}
function rf43Heal(caster,amount,b){
  if(!caster||caster.dead||caster.remoteAuth||!(amount>0))return;
  const healed=Math.max(0,Math.min(Math.round(amount),caster.maxHp-caster.hp));
  if(healed<=0)return;
  caster.hp+=healed;
  b.ui?.popup?.(caster.pos,'吸収 +'+healed,'#9effcf');
  paintedImpact(b,caster.pos.clone().setY(1.6),0x75fff0,1.35);
}
function rf43PendingLifesteal(caster,b){
  const q=caster?._rf43PendingLeech;
  if(!q)return;
  if(caster.dead||!q.target?.remoteAuth||performance.now()/1000>q.until){caster._rf43PendingLeech=null;return;}
  if(!q.done&&q.target.hp<q.before){
    q.done=true;
    rf43Heal(caster,Math.min(q.ceiling,Math.max(0,q.before-q.target.hp)),b);
    caster._rf43PendingLeech=null;
  }
}
// The artwork runs on the existing ultimate's impact clock. Only the impact deals damage.
function curseSwordUltimate(b,caster){
  const target=b.nearestEnemy?.(caster);
  if(!target || target.dead)return;
  const artwork=createFujiwaraJudgmentCG(b,target);
  const cleanups=b._fujJudgmentCleanups ||= new Set();
  const finish=()=>{
    cleanups.delete(finish);
    artwork.dispose();
  };
  cleanups.add(finish);
  let elapsed=0, hit=false;
  b.addEffect(dt=>{
    if(!hit&&(b.ended||target.dead||caster.dead)){finish();return false;}
    elapsed+=clamp(dt,0,.075);
    artwork.update(elapsed);
    if(!hit&&elapsed>=JUDGMENT_IMPACT){
      hit=true;
      const name='呪いの剣';
      const dealt=rf43PercentHit(b,caster,target,.5,name);
      rf43Heal(caster,dealt,b);
      b.ui?.popup?.(target.pos,'呪いの剣・生命吸収','#d3d8ff');
      b.ui?.sfx?.('burst');
    }
    if(elapsed<JUDGMENT_END)return true;
    finish();
    return false;
  });
}
function rf43TotsukaSword(b,caster){
  const target=b.nearestEnemy?.(caster);if(!target||target.dead)return;
  const g=new THREE.Group();b.fx.add(g);
  const blade=fujiwaraSprite('sword',5.8,11.6,1,false);
  blade.name='Fujiwara Totsuka CG';
  blade.renderOrder=19;
  g.add(blade);
  const flare=rf43Glow(9.5,0xff7a1c,.48);flare.position.y=-1.2;g.add(flare);
  const hot=rf43Glow(5,0xffdda0,.65);hot.position.y=-3.8;g.add(hot);
  const trail=[];for(let i=0;i<11;i++){const s=rf43Glow(2.8+i*.18,i%2?0xffa020:0xff4207,.32);b.fx.add(s);trail.push(s);}
  let elapsed=0,hit=false;
  const clean=()=>{for(const s of trail){s.material.dispose();s.removeFromParent();}rf43Dispose(g);};
  b.ui?.popup?.(target.pos,'秘奥義・十拳剣','#ffb463');
  b.addEffect(dt=>{
    if(b.ended||target.dead){clean();return false;}
    elapsed+=clamp(dt,0,.075);
    const fall=clamp(elapsed/1.48,0,1);
    const accel=fall*fall*(3-2*fall);
    const x=target.pos.x,z=target.pos.z;
    g.position.set(x,24.4-(24.4-5.84)*accel,z);
    blade.material.rotation=.035*Math.sin(elapsed*4);
    flare.material.opacity=Math.max(.14,.38+(1-fall)*.2);
    hot.material.opacity=.55+.25*Math.sin(elapsed*17);
    for(let i=0;i<trail.length;i++){
      const t=trail[i];t.position.set(x+Math.sin(elapsed*9+i)*.36,g.position.y+3+i*.61,z+Math.cos(elapsed*10+i)*.36);
      t.material.opacity=Math.max(0,.5*(1-fall)*(1-i/(trail.length+2)));
    }
    if(fall<1)return true;
    if(!hit){
      hit=true;
      rf43PercentHit(b,caster,target,.75,'十拳剣');
      const impact=target.pos.clone().setY(.8);
      paintedImpact(b,impact,0xffa02f,5.5);
      b.ui?.popup?.(target.pos,'十拳剣・天降の一撃','#ffb048');
      b.ui?.flash?.();b.shake=Math.max(b.shake,.9);
    }
    if(elapsed<1.80){g.scale.setScalar(Math.max(.05,1-(elapsed-1.48)*2.9));return true;}
    clean();return false;
  });
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
      // V43: L/C and controller ultimate now stay on native over/hi; do not remap to skill2.
    }
    const out=baseUpdate.call(this,dt,inp);
    if(frozen&&wasPos){this.pos.copy(wasPos);this.vel.set(0,0,0);this.sync?.();}
    if(this.key===KEY){
      updateSeal(this,clamp(dt,0,.05));
      animateRig(this,clamp(dt,0,.05));
      rf43PendingLifesteal(this,this.battle);
    }
    tickMark(this);tickBurn(this);
    if(this._fujMarkCG)this._fujMarkCG.material.opacity=.94+.04*Math.sin(t*5);
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
      if(f?.key===KEY && result===true){
        // Only an accepted remote cast opens the existing hit/lifesteal window.
        if(f.remoteAuth && net && (slot==='over'||slot==='hi')){
          f._rf43UltimateWindow={slot,at:performance.now()/1000,used:false};
        }
        f._fujCastPulse=0.75;
        if(slot==='over') curseSwordUltimate(this,f);
        else if(slot==='hi') rf43TotsukaSword(this,f);
        else if(typeof slot==='string' && /^[sf][0-9]+$/.test(slot)){
          const index=Number(slot.slice(1));
          if(index===0)startOrbs(this,f);
          else if(index===1)eyeLaser(this,f);
        }
      }
      return result;
    };
    const baseRetire=proto.retireFighter;
    proto.retireFighter=function(f,...args){
      const retired=baseRetire.call(this,f,...args);
      if(retired)cleanup(f);
      return retired;
    };
    const baseDispose=proto.dispose;
    proto.dispose=function(...args){
      for(const clean of this._fujJudgmentCleanups||[])clean();
      for(const f of this.fighters||[])cleanup(f);
      return baseDispose.apply(this,args);
    };
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
