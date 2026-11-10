// RF_NOBLE_MOTION_V35 — detailed safe motion for 右大臣 and 藤原信頼.
// NEVER changes model geometry, skin weights, normals, textures, materials or GLSL.
// Uses native glTF clips, existing named skeleton joints, or separate named limb objects.
// A welded mesh without rigging can only receive non-destructive whole-body movement.
import * as THREE from 'three';

const X = new THREE.Vector3(1,0,0), Y = new THREE.Vector3(0,1,0), Z = new THREE.Vector3(0,0,1);
const q = new THREE.Quaternion();
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const masks = {
  idle:/idle|wait|stand|breath|rest|待機/i,
  walk:/walk|walking|locomotion|stride|歩行/i,
  run:/run|running|sprint|jog|走行/i,
  attack:/attack|punch|strike|slash|swing|hit|atk|攻撃/i,
  cast:/cast|magic|spell|chant|skill|詠唱|魔法/i
};
const charParts={
  hips:/hip|pelvis|root|waist|腰|骨盤/i,
  spine:/spine|waist|belly|脊椎|胴/i,
  chest:/chest|upperbody|thorax|胸|上体/i,
  neck:/neck|首/i,
  head:/head|face|頭|顔/i,
  shoulder:/shoulder|clavicle|鎖骨|肩/i,
  arm:/upperarm|arm|humerus|上腕|腕|袖/i,
  forearm:/forearm|lowerarm|elbow|前腕|肘/i,
  hand:/hand|wrist|palm|手首|手/i,
  thigh:/thigh|upperleg|upleg|femur|腿|太もも/i,
  shin:/calf|shin|lowerleg|knee|脛|膝/i,
  foot:/foot|ankle|toe|足首|足/i
};
const joints=['hips','spine','chest','neck','head',
  'lShoulder','rShoulder','lArm','rArm','lForearm','rForearm','lHand','rHand',
  'lThigh','rThigh','lShin','rShin','lFoot','rFoot'];
function shortName(name){return String(name||'').toLowerCase().replace(/mixamorig|armature|bip00?\d+|j_bip_/g,'');}
function whichSide(name){
  const n=shortName(name),flat=n.replace(/[^a-z\d一-龯ぁ-んァ-ン]/g,'');
  if(/left|左/.test(n)||/(?:^|[_.\s-])l(?=$|[_.\s-])/.test(n)||/^l(?:upper|lower|arm|fore|hand|thigh|leg|shin|foot|shoulder)/.test(flat)||/(?:arm|forearm|hand|leg|thigh|shin|foot|shoulder)l$/.test(flat))return'l';
  if(/right|右/.test(n)||/(?:^|[_.\s-])r(?=$|[_.\s-])/.test(n)||/^r(?:upper|lower|arm|fore|hand|thigh|leg|shin|foot|shoulder)/.test(flat)||/(?:arm|forearm|hand|leg|thigh|shin|foot|shoulder)r$/.test(flat))return'r';
  return '';
}
function partRole(o){
  const n=shortName(o.name),s=whichSide(n);
  let kind='';
  // Order matters: forearm must not be mistaken for an upper arm.
  for(const k of ['forearm','shin','foot','hand','thigh','shoulder','arm','neck','head','chest','spine','hips']){
    if(charParts[k].test(n)){kind=k;break;}
  }
  if(!kind)return '';
  if(['forearm','shin','foot','hand','thigh','shoulder','arm'].includes(kind)&&!s)return '';
  const alias={shoulder:'Shoulder',arm:'Arm',forearm:'Forearm',hand:'Hand',thigh:'Thigh',shin:'Shin',foot:'Foot'};
  return s? s+alias[kind]:kind;
}
function pickNames(model,predicate){const out=[];model?.traverse?.(o=>{if(predicate(o))out.push(o);});return out;}
function clipMap(clips){
  const entries=Array.isArray(clips)?clips:[];
  const out={};for(const [k,re]of Object.entries(masks))out[k]=entries.find(c=>re.test(c?.name||''))||null;
  if(!out.run)out.run=out.walk;
  if(!out.walk)out.walk=out.run;
  if(!out.attack)out.attack=out.cast;
  return out;
}
function collectBones(model){
  const out={};
  for(const b of pickNames(model,o=>o.isBone)){
    const role=partRole(b);
    if(role&&!out[role])out[role]=b;
  }
  return out;
}
function collectLoose(model){
  const out={};
  model.traverse(o=>{
    if(o===model||o.isBone||o.isSkinnedMesh||!o.name)return;
    if(o.parent?.isBone||o.parent?.isSkinnedMesh)return;
    const role=partRole(o);
    if(!role||out[role])return;
    // Do not use an unstructured root/parent group as a limb.
    let ancestor=o.parent;
    while(ancestor&&ancestor!==model){if(ancestor.isSkinnedMesh||ancestor.isBone)return;ancestor=ancestor.parent;}
    out[role]=o;
  });
  return out;
}
function enoughLimbs(parts){
  const hasArm=!!parts.lArm||!!parts.rArm;
  const hasLeg=!!parts.lThigh||!!parts.rThigh;
  return (hasArm&&hasLeg)||(['lArm','rArm','lThigh','rThigh'].filter(x=>parts[x]).length>=3);
}
function pivotLooseParts(parts){
  const pivots={},memory=[];
  const chosen=new Set();
  const preferred=['lShoulder','rShoulder','lArm','rArm','lForearm','rForearm','lHand','rHand','lThigh','rThigh','lShin','rShin','lFoot','rFoot','head','chest'];
  for(const role of preferred){
    const part=parts[role];if(!part||chosen.has(part)||!part.parent)continue;
    chosen.add(part);
    const originalParent=part.parent;
    const originalPos=part.position.clone(),originalRot=part.quaternion.clone(),originalScale=part.scale.clone();
    const b=new THREE.Box3().setFromObject(part);
    if(b.isEmpty())continue;
    const center=b.getCenter(new THREE.Vector3());
    const pivotWorld=center.clone();
    if(role==='head')pivotWorld.y=b.min.y;
    else if(/Arm|Forearm|Hand|Thigh|Shin|Foot/.test(role))pivotWorld.y=b.max.y;
    originalParent.updateWorldMatrix(true,false);
    const pivotLocal=originalParent.worldToLocal(pivotWorld);
    const grp=new THREE.Group();grp.name='__rfNobleJoint_'+role;grp.position.copy(pivotLocal);
    originalParent.add(grp);grp.attach(part);
    pivots[role]={grp,origin:grp.quaternion.clone()};
    memory.push({part,originalParent,originalPos,originalRot,originalScale,grp});
  }
  return{
    joints:pivots,
    dispose(){for(const item of memory.reverse()){
      const {part,originalParent,originalPos,originalRot,originalScale,grp}=item;
      grp.quaternion.identity();originalParent.attach(part);
      part.position.copy(originalPos);part.quaternion.copy(originalRot);part.scale.copy(originalScale);
      grp.removeFromParent();
    }}
  };
}
function makePose(joints,withBones){
  const entries={};for(const [key,value]of Object.entries(joints)){
    const node=withBones?value:value.grp;
    if(node)entries[key]={node,base:node.quaternion.clone()};
  }
  return function(p){
    const ph=p.time*(p.run>p.walk?11.8:7.1);
    const si=Math.sin(ph), co=Math.cos(ph), m=p.walk*.42+p.run*.78;
    const l=si*m,r=-si*m;
    const strike=p.attack,chant=p.cast;
    const def={
      hips:[-.045*m*co,0,.045*m*si],spine:[.09*strike-.02*chant,.04*m*si,.03*m*co],
      chest:[.15*strike-.065*chant,.07*strike,.02*m*si],neck:[-.02*si*m,0,0],head:[-.04*si*m-.09*chant,.02*m*co,0],
      lShoulder:[.13*l,0,-.05*m],rShoulder:[.13*r,0,.05*m],
      lArm:[-.9*l-.50*chant-.21*strike,0,-.09*chant],
      rArm:[-.9*r-.45*chant-1.3*strike,-.17*strike,.1*chant],
      lForearm:[-.08-.31*chant-.20*strike,0,-.08*strike],
      rForearm:[-.08-.34*chant-.70*strike,.08*strike,0],
      lHand:[-.15*strike,0,.11*chant],rHand:[-.25*strike,0,-.11*chant],
      lThigh:[l*.98,0,0],rThigh:[r*.98,0,0],
      lShin:[-Math.max(0,-si)*(.30*p.walk+.60*p.run),0,0],
      rShin:[-Math.max(0,si)*(.30*p.walk+.60*p.run),0,0],
      lFoot:[.19*Math.max(0,-si)*m,0,0],rFoot:[.19*Math.max(0,si)*m,0,0]
    };
    for(const [key,angles]of Object.entries(def)){
      const j=entries[key];if(!j)continue;
      const [a,b,c]=angles;
      j.node.quaternion.copy(j.base);
      if(a)j.node.quaternion.multiply(q.setFromAxisAngle(X,a));
      if(b)j.node.quaternion.multiply(q.setFromAxisAngle(Y,b));
      if(c)j.node.quaternion.multiply(q.setFromAxisAngle(Z,c));
    }
  };
}
function makeWholePose(model){
  const pos=model.position.clone(),rot=model.quaternion.clone();
  const euler=new THREE.Euler();
  return{
    update(p){
      const m=p.walk+p.run,ph=p.time*(p.run>p.walk?11.5:7.6),step=Math.sin(ph);
      const jab=p.attack;
      model.position.copy(pos);model.position.y += (.02*p.walk+.055*p.run)*Math.abs(step);
      model.position.z += jab*.12;
      euler.set((.028*p.walk+.075*p.run)*Math.abs(step)+jab*.14-p.cast*.04,
        .025*m*step-jab*.14,
        .03*m*Math.cos(ph)+.025*p.cast);
      model.quaternion.copy(rot).multiply(q.setFromEuler(euler));
    },
    dispose(){model.position.copy(pos);model.quaternion.copy(rot);}
  };
}
export function createNobleMotion(model,clips=[],options={}){
  if(!model)return null;
  const found=clipMap(clips);
  const bones=collectBones(model);
  const boneCount=['lArm','rArm','lThigh','rThigh'].filter(x=>bones[x]).length;
  let mode='',pose=null,cleanup=()=>{};
  if(enoughLimbs(bones)&&boneCount>=3){
    mode='bones';pose=makePose(bones,true);
    const bases=Object.fromEntries(Object.entries(bones).map(([k,v])=>[k,v.quaternion.clone()]));
    cleanup=()=>{for(const [k,b]of Object.entries(bones))b.quaternion.copy(bases[k]);};
  }else{
    const loose=collectLoose(model);
    if(enoughLimbs(loose)){
      const pivots=pivotLooseParts(loose);
      if(Object.keys(pivots.joints).length>=3){
        mode='loose-pivots';pose=makePose(pivots.joints,false);cleanup=()=>pivots.dispose();
      }else pivots.dispose();
    }
  }
  if(!pose){
    mode='whole';const whole=makeWholePose(model);pose=p=>whole.update(p);cleanup=()=>whole.dispose();
  }
  const ctrl={mode,clips:found,time:0,walk:0,run:0,attack:0,cast:0,manualPulses:0};
  const smooth=(a,b,dt,n)=>a+(b-a)*(1-Math.exp(-n*dt));
  ctrl.update=function(dt,{moving=false,running=false,attack=0,cast=0}={}){
    const d=clamp(Number(dt)||0,0,.07);if(!d)return;
    this.time+=d;
    this.walk=smooth(this.walk,moving&&!running?1:0,d,11);
    this.run=smooth(this.run,moving&&running?1:0,d,13);
    this.attack=smooth(this.attack,clamp(attack,0,1),d,17);
    this.cast=smooth(this.cast,clamp(cast,0,1),d,9);
    const chosen=this.attack>.28?'attack':this.cast>.25?'cast':this.run>.33?'run':this.walk>.28?'walk':'idle';
    // Native animation clips always take precedence for the active gesture.
    if(found[chosen])return;
    pose({time:this.time,walk:this.walk,run:this.run,attack:this.attack,cast:this.cast});
  };
  ctrl.dispose=cleanup;
  console.info('[Noble Motion V35]',options.name||'',mode,'native clips:',Object.entries(found).filter(([,v])=>!!v).map(([k])=>k).join(','));
  return ctrl;
}
