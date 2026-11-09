// RF_AUTORIG_MOTION_V17 — Crimson/Kraid & Nepterion.
// On unrigged static GLBs, builds a real Three.js Skeleton/SkinnedMesh at runtime.
// Original GLB source bytes, original textures/materials and all saved data remain unchanged.
import * as THREE from 'three';

const SUBJECTS = new Set(['crimson', 'nepterion']);
const X_AXIS = new THREE.Vector3(1,0,0);
const Y_AXIS = new THREE.Vector3(0,1,0);
const Z_AXIS = new THREE.Vector3(0,0,1);
const tempQuat = new THREE.Quaternion();
const tempQuat2 = new THREE.Quaternion();
const clamp = (n,a,b)=>Math.min(b,Math.max(a,n));
const smooth = (x,a,b)=>{const t=clamp((x-a)/Math.max(1e-6,b-a),0,1);return t*t*(3-2*t);};
const cleanName = o => String(o?.name||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const clipFor = (clips,re)=>clips.find(c=>re.test((c.name||'').toLowerCase()))||null;

function findNamedBone(nodes, side, part){
  const sr=side==='left'?/left|(^|[^a-z])l(?=(?:arm|leg|hand|thigh|upper))/ : /right|(^|[^a-z])r(?=(?:arm|leg|hand|thigh|upper))/;
  const pr=part==='leg'?/upleg|upperleg|thigh|calf|leg/:part==='arm'?/upperarm|shoulder|arm/:/head|neck/;
  return nodes.find(n=>sr.test(cleanName(n)) && pr.test(cleanName(n)))||null;
}
function candidateRig(model, clips) {
  // Animated/imported skeletons take priority. Never add duplicate bones to them.
  if(clips.length) return false;
  let existing=false, meshCount=0, vertexCount=0;
  model.traverse(o=>{
    if(o.isSkinnedMesh || o.isBone) existing=true;
    if(o.isMesh && !o.isSkinnedMesh && o.geometry?.getAttribute('position')){
      meshCount++;vertexCount+=o.geometry.getAttribute('position').count;
    }
  });
  // Prevent a 2-million-vertex rig from exhausting a mobile browser's memory.
  return !existing && meshCount>0 && vertexCount>=12 && vertexCount<=500000;
}
function autoRig(model) {
  model.updateMatrixWorld(true);
  const invRoot = model.matrixWorld.clone().invert();
  const all=[]; const bounds = new THREE.Box3().makeEmpty();
  const samples=[];
  const transform=new THREE.Matrix4(), tmp=new THREE.Vector3();
  model.traverse(o=>{
    if(!o.isMesh || o.isSkinnedMesh || !o.geometry?.getAttribute('position'))return;
    const pos=o.geometry.getAttribute('position');
    if(!pos.count)return;
    transform.multiplyMatrices(invRoot,o.matrixWorld);
    o.geometry.computeBoundingBox();
    bounds.union(o.geometry.boundingBox.clone().applyMatrix4(transform));
    const stride=Math.max(1,Math.ceil(pos.count/450));
    for(let j=0;j<pos.count;j+=stride){
      tmp.fromBufferAttribute(pos,j).applyMatrix4(transform);
      if(Number.isFinite(tmp.x)&&Number.isFinite(tmp.y))samples.push([tmp.x,tmp.y]);
    }
    all.push({node:o,transform:transform.clone()});
  });
  if(!all.length||bounds.isEmpty()||samples.length<10)return null;
  // Robust body-width estimate excludes very wide swords and horns.
  const xs=samples.map(p=>p[0]).sort((a,b)=>a-b);
  const ys=samples.map(p=>p[1]).sort((a,b)=>a-b);
  const q=(a,p)=>a[Math.floor(clamp(p,0,1)*(a.length-1))];
  const minY=q(ys,.012), maxY=q(ys,.99);
  const h=maxY-minY, cx=(q(xs,.1)+q(xs,.9))*.5;
  const w=Math.max(0.001,q(xs,.91)-q(xs,.09));
  const cz=(bounds.min.z+bounds.max.z)*.5;
  if(h<.0001 || w<.0001 || h < w*.28)return null;
  const center=(y)=>minY+h*y;
  const joint={
    hips:[cx,center(.49),cz], spine:[cx,center(.71),cz], chest:[cx,center(.79),cz],
    neck:[cx,center(.87),cz], head:[cx,center(.93),cz],
    lArm:[cx-w*.29,center(.765),cz],lFore:[cx-w*.41,center(.62),cz],
    rArm:[cx+w*.29,center(.765),cz],rFore:[cx+w*.41,center(.62),cz],
    lLeg:[cx-w*.125,center(.46),cz],lShin:[cx-w*.125,center(.235),cz],
    rLeg:[cx+w*.125,center(.46),cz],rShin:[cx+w*.125,center(.235),cz]
  };
  const bones=[], named={};
  function bone(name,parent){
    const node=new THREE.Bone();node.name='RF_RIG_'+name;
    const v=joint[name];
    node.position.set(v[0],v[1],v[2]);
    if(parent){const p=joint[parent];node.position.sub(new THREE.Vector3(p[0],p[1],p[2]));named[parent].add(node);}
    else model.add(node);
    named[name]=node;bones.push(node);
  }
  bone('hips');bone('spine','hips');bone('chest','spine');bone('neck','chest');bone('head','neck');
  bone('lArm','chest');bone('lFore','lArm');bone('rArm','chest');bone('rFore','rArm');
  bone('lLeg','hips');bone('lShin','lLeg');bone('rLeg','hips');bone('rShin','rLeg');
  model.updateMatrixWorld(true);
  const skeleton=new THREE.Skeleton(bones);
  const index=Object.fromEntries(bones.map((b,i)=>[b.name.slice(7),i]));
  const geos=[];let moved=0;
  function chooseWeights(x,y){
    const yy=(y-minY)/h, xx=(x-cx)/w;
    const side=xx<0?'l':'r';
    const ax=Math.abs(xx);
    let result;
    if(yy<.51 && ax>.02){
      const bend=smooth(yy,.19,.32);
      const torso=smooth(yy,.45,.56)*.30;
      result=[[side+'Shin',(1-bend)*(1-torso)],[side+'Leg',bend*(1-torso)],['hips',torso]];
    }else if(yy>.53 && yy<.89 && ax>.235){
      const distal=smooth(ax,.32,.49)*(.45+.55*(1-smooth(yy,.75,.88)));
      const torso=(1-smooth(ax,.20,.32))*.36;
      result=[[side+'Fore',distal*(1-torso)],[side+'Arm',(1-distal)*(1-torso)],['chest',torso]];
    }else if(yy>.87){
      const head=smooth(yy,.85,.93);
      result=[['head',head],['neck',1-head]];
    }else if(yy>.70){
      const chest=smooth(yy,.68,.79);
      result=[['chest',chest],['spine',1-chest]];
    }else{
      const spine=smooth(yy,.46,.66);
      result=[['spine',spine],['hips',1-spine]];
    }
    const total=result.reduce((s,p)=>s+p[1],0)||1;
    return result.map(([n,v])=>[index[n],v/total]);
  }
  for(const entry of all){
    const old=entry.node;const pos=old.geometry.getAttribute('position');
    // Preserve paint, UV, normals, indices and vertex colors: only append skin weights.
    const geometry=old.geometry.clone();
    geometry.applyMatrix4(entry.transform);
    const positions=geometry.getAttribute('position');
    const count=positions.count;
    const skinIndex=new Uint16Array(count*4),skinWeight=new Float32Array(count*4);
    for(let i=0;i<count;i++){
      const weights=chooseWeights(positions.getX(i),positions.getY(i));
      for(let k=0;k<Math.min(4,weights.length);k++){
        skinIndex[i*4+k]=weights[k][0];skinWeight[i*4+k]=weights[k][1];
      }
    }
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));
    geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));
    const skinned=new THREE.SkinnedMesh(geometry,old.material);
    skinned.name=old.name||('RF_Skinned_'+moved);
    skinned.visible=old.visible;skinned.userData={...old.userData,rfRuntimeRig:true};
    skinned.renderOrder=old.renderOrder;
    skinned.castShadow=old.castShadow;skinned.receiveShadow=old.receiveShadow;
    skinned.frustumCulled=false;
    model.add(skinned);
    skinned.bind(skeleton);
    old.parent?.remove(old);
    geos.push(geometry);moved++;
  }
  return {skeleton,bones:named,geos,body:{h,w},meshes:moved};
}
function capture(f,gltf){
  const model=f.modelInstance?.model;if(!model)return;
  const clips=gltf?.animations||[];
  let built=null;
  if(candidateRig(model,clips)){
    try {built=autoRig(model);}
    catch(error){console.warn('[RF AUTO-RIG]',f.key,error?.message||error);}
  }
  const namedBones=[];
  model.traverse(o=>{if(o.isBone)namedBones.push(o);});
  const joints={};
  if(built){
    for(const key of Object.keys(built.bones))joints[key]=built.bones[key];
  }else{
    joints.lArm=findNamedBone(namedBones,'left','arm');
    joints.rArm=findNamedBone(namedBones,'right','arm');
    joints.lLeg=findNamedBone(namedBones,'left','leg');
    joints.rLeg=findNamedBone(namedBones,'right','leg');
    joints.head=namedBones.find(o=>/head|neck/i.test(o.name))||null;
  }
  const bases=Object.fromEntries(Object.entries(joints).filter(([,o])=>o).map(([k,o])=>[k,o.quaternion.clone()]));
  const walk=clipFor(clips,/walk|歩行/),run=clipFor(clips,/run|sprint|走行/);
  const attack=clipFor(clips,/attack|swing|slash|strike|punch|攻撃/);
  const cast=clipFor(clips,/cast|spell|chant|magic|魔法|詠唱/);
  f._rfMotionV17={model,joints,bases,autoRig:built,t:0,basePos:model.position.clone(),baseRot:model.rotation.clone(),
    clips:{walk,run,attack,cast},authoredMove:!!(walk||run),authoredAttack:!!attack,authoredCast:!!cast,
    manualBones:!clips.length, lastMode:'idle'};
  if(attack)f.clips['rf-attack']=attack;
  if(cast)f.clips['rf-cast']=cast;
  if(walk)f.clips.walk||=walk;
  if(run)f.clips.run||=run;
  if(built)console.info('[RF AUTO-RIG]',f.key,'real skeleton bones',built.skeleton.bones.length,'skinned meshes',built.meshes);
}
function setJoint(m,name,x=0,y=0,z=0){
  const bone=m.joints[name],base=m.bases[name];if(!bone||!base)return;
  bone.quaternion.copy(base);
  if(x){tempQuat.setFromAxisAngle(X_AXIS,x);bone.quaternion.multiply(tempQuat);}
  if(y){tempQuat.setFromAxisAngle(Y_AXIS,y);bone.quaternion.multiply(tempQuat);}
  if(z){tempQuat2.setFromAxisAngle(Z_AXIS,z);bone.quaternion.multiply(tempQuat2);}
}
function tickMotion(f,dt){
  const m=f._rfMotionV17;if(!m||f.dead)return;
  dt=clamp(Number(dt)||0,0,.05);m.t+=dt;
  const act=f.action?.type||'';
  const attacking=act==='light'||act==='dash';
  const casting=act==='chant'||act==='cast';
  const speed=Math.hypot(f.vel?.x||0,f.vel?.z||0);
  const moving=!!(f.moving||f.netMoving)&& (speed>.2||!!f.netMoving);
  const sprint=moving&&(speed>3.6||!!f.netMoving);
  const freq=sprint?10.5:6.8;
  const wave=Math.sin(m.t*freq), swing=moving?(sprint?.50:.29)*wave:0;
  const progress=clamp((f.action?.t||0)/Math.max(.1,f.action?.dur||.4),0,1);
  const strike=attacking?Math.sin(progress*Math.PI):0;
  const castLift=casting?(.22+.10*Math.sin(m.t*7)):0;
  if(m.manualBones){
    setJoint(m,'hips',0,moving?.02*wave:0,moving?.025*wave:0);
    setJoint(m,'spine',attacking?-.13*strike:0,attacking?.12*strike:0,0);
    setJoint(m,'chest',casting?-.10:0,attacking?-.19*strike:0,.012*wave);
    setJoint(m,'neck',moving?.025*wave:0,0,0);
    setJoint(m,'head',moving?-.025*wave:0,0,0);
    setJoint(m,'lLeg',swing+(attacking?.16:0));
    setJoint(m,'rLeg',-swing-(attacking?.10:0));
    setJoint(m,'lShin',-Math.max(0,-wave)*(sprint?.47:.24));
    setJoint(m,'rShin',-Math.max(0,wave)*(sprint?.47:.24));
    setJoint(m,'lArm',-swing*.75-castLift+strike*.42,0,casting?-.20:0);
    setJoint(m,'rArm',swing*.75-castLift-strike*.94,0,casting?.20:0);
    setJoint(m,'lFore',casting?-.55:attacking?-.15*strike:-.18);
    setJoint(m,'rFore',casting?-.55:attacking?-.80*strike:-.18);
  }
  // Small pelvis bounce is optional: limb skinning provides the actual animation.
  if(!m.authoredMove || !m.authoredAttack || !m.authoredCast){
    const bob=moving&&!m.authoredMove?(sprint?.028:.015)*Math.abs(wave):0;
    m.model.position.y=m.basePos.y+bob;
    m.model.rotation.y=m.baseRot.y+(attacking&&!m.authoredAttack?.035*strike:0);
  }
}
export function installActorMotion({Fighter,Battle}){
  if(!Fighter?.prototype||Fighter.prototype.__rfAutoRigMotionV17)return;
  Fighter.prototype.__rfAutoRigMotionV17=true;
  const build=Fighter.prototype.buildModel;
  Fighter.prototype.buildModel=function(gltf,...rest){
    const value=build.call(this,gltf,...rest);
    if(SUBJECTS.has(this.key))capture(this,gltf);
    return value;
  };
  const anim=Fighter.prototype.anim;
  Fighter.prototype.anim=function(name){
    const m=this._rfMotionV17;
    if(!m)return anim.call(this,name);
    const act=this.action?.type;
    if((act==='light'||act==='dash')&&m.clips.attack)return anim.call(this,'rf-attack');
    if((act==='cast'||act==='chant')&&m.clips.cast)return anim.call(this,'rf-cast');
    if(name==='run'&&m.clips.walk&&!m.clips.run)return anim.call(this,'walk');
    if(name==='run'&&m.clips.run)return anim.call(this,'run');
    return anim.call(this,name);
  };
  const update=Fighter.prototype.update;
  Fighter.prototype.update=function(dt,input){
    const val=update.call(this,dt,input);
    if(this._rfMotionV17)tickMotion(this,dt);
    return val;
  };
  if(Battle?.prototype && !Battle.prototype.__rfAutoRigDisposeV17){
    Battle.prototype.__rfAutoRigDisposeV17=true;
    const dispose=Battle.prototype.dispose;
    Battle.prototype.dispose=function(...args){
      for(const f of this.fighters||[]){
        const rig=f._rfMotionV17?.autoRig;
        if(rig){for(const geo of rig.geos)geo.dispose();rig.skeleton?.dispose?.();f._rfMotionV17.autoRig=null;}
      }
      return dispose.apply(this,args);
    };
  }
}
