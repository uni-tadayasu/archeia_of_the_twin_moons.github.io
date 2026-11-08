/**
 * Riftfall 2026-11-08: preserve the exact uploaded GLB meshes/materials.
 * Auto-rig unskinned models at runtime; animate existing real skeletons in-place.
 * Shared by Valgard, the OP-only Gigantes, Gaizorg and the chief-only Valdarion.
 */
import * as THREE from 'three';
const SPECIAL = new Set(['valgard','operator_gigantes','gaizorg','valdarion']);
const X = new THREE.Vector3(1,0,0), Y = new THREE.Vector3(0,1,0), Z = new THREE.Vector3(0,0,1);
const tempQ = new THREE.Quaternion();
const clamp = (v,a,b)=>Math.min(b,Math.max(a,v));
const names = {
  hips:[/hips|pelvis|root.*joint|腰|hip/i],
  spine:[/spine|lowerbody|waist|胴/i], chest:[/chest|upperbody|spine2|torso|胸/i],
  head:[/head|neck|helmet|頭|首/i],
  leftArm:[/left.*(arm|shoulder)|arm.*[._ -]?l\b|\bl[_-]?arm|左腕/i],
  rightArm:[/right.*(arm|shoulder)|arm.*[._ -]?r\b|\br[_-]?arm|右腕/i],
  leftForearm:[/left.*(forearm|elbow)|forearm.*[._ -]?l\b|左肘/i],
  rightForearm:[/right.*(forearm|elbow)|forearm.*[._ -]?r\b|右肘/i],
  leftLeg:[/left.*(upleg|thigh|leg)|thigh.*[._ -]?l\b|左足/i],
  rightLeg:[/right.*(upleg|thigh|leg)|thigh.*[._ -]?r\b|右足/i],
  leftShin:[/left.*(shin|calf|knee)|shin.*[._ -]?l\b|左膝/i],
  rightShin:[/right.*(shin|calf|knee)|shin.*[._ -]?r\b|右膝/i],
};
function discoverExisting(model) {
  let selected = null;
  model.traverse(o => { if (!selected && o.isSkinnedMesh && o.skeleton?.bones?.length) selected = o.skeleton; });
  if (!selected) return null;
  const bones = selected.bones;
  const found={};
  for(const [key,match] of Object.entries(names)) found[key]=bones.find(b=>match.some(re=>re.test(b.name)))||null;
  return {found,count:bones.length,synthetic:false};
}
/**
 * Attach a 19-joint THREE.Skeleton to an unrigged uploaded GLB without changing
 * vertex colors, texture UVs, material definitions or the original source file.
 * Uses smooth approximate skin weights based on the mesh's real vertices.
 * Fused armored shells may deform less naturally than an authored Blender rig.
 */
function createRuntimeSkin(model) {
  model.updateMatrixWorld(true);
  const inverse = model.matrixWorld.clone().invert();
  const sources=[];
  const bounds=new THREE.Box3();
  model.traverse(o=>{
    if (!o.isMesh || o.isSkinnedMesh || !o.geometry?.attributes?.position) return;
    const local = inverse.clone().multiply(o.matrixWorld);
    o.geometry.computeBoundingBox();
    if (!o.geometry.boundingBox) return;
    const b=o.geometry.boundingBox.clone().applyMatrix4(local);
    if (!Number.isFinite(b.min.x) || !Number.isFinite(b.max.y)) return;
    bounds.union(b);
    sources.push({object:o,local});
  });
  if(!sources.length || bounds.isEmpty())return null;
  const sz=bounds.getSize(new THREE.Vector3()), c=bounds.getCenter(new THREE.Vector3());
  const height=Math.max(.001,sz.y), width=Math.max(.001,sz.x), depth=Math.max(.001,sz.z);
  const create=(name,parent,x,y,z)=>{
    const bone=new THREE.Bone();bone.name='RF_'+name;bone.position.set(x,y,z);
    parent.add(bone);return bone;
  };
  const root=create('Root',model,c.x,bounds.min.y,c.z);
  const hips=create('Hips',root,0,height*.48,0);
  const spine=create('Spine',hips,0,height*.10,0);
  const chest=create('Chest',spine,0,height*.13,0);
  const neck=create('Neck',chest,0,height*.08,0);
  const head=create('Head',neck,0,height*.075,0);
  const leftArm=create('LeftUpperArm',chest,-width*.205,height*.028,0);
  const leftForearm=create('LeftForearm',leftArm,-width*.14,-height*.13,0);
  const leftHand=create('LeftHand',leftForearm,-width*.075,-height*.095,0);
  const rightArm=create('RightUpperArm',chest,width*.205,height*.028,0);
  const rightForearm=create('RightForearm',rightArm,width*.14,-height*.13,0);
  const rightHand=create('RightHand',rightForearm,width*.075,-height*.095,0);
  const leftLeg=create('LeftUpLeg',hips,-width*.105,-height*.10,0);
  const leftShin=create('LeftShin',leftLeg,0,-height*.18,0);
  const leftFoot=create('LeftFoot',leftShin,0,-height*.15,depth*.07);
  const rightLeg=create('RightUpLeg',hips,width*.105,-height*.10,0);
  const rightShin=create('RightShin',rightLeg,0,-height*.18,0);
  const rightFoot=create('RightFoot',rightShin,0,-height*.15,depth*.07);
  const back=create('BackPack',chest,0,height*.015,-depth*.12);
  const bones=[root,hips,spine,chest,neck,head,leftArm,leftForearm,leftHand,rightArm,rightForearm,rightHand,leftLeg,leftShin,leftFoot,rightLeg,rightShin,rightFoot,back];
  const found={hips,spine,chest,head,leftArm,rightArm,leftForearm,rightForearm,leftLeg,rightLeg,leftShin,rightShin,leftHand,rightHand,back};
  model.updateMatrixWorld(true);
  const skeleton=new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  let vertexCount=0,skinCount=0;
  for(const {object,local} of sources){
    try{
      const geometry=object.geometry.clone();
      geometry.applyMatrix4(local);
      const positions=geometry.getAttribute('position');
      if (!positions?.count) continue;
      const joints=new Uint16Array(positions.count*4);
      const weights=new Float32Array(positions.count*4);
      // Mapping by normalized coordinates, interpolating upper/lower limbs.
      for(let i=0;i<positions.count;i++){
        const x=(positions.getX(i)-c.x)/width;
        const y=(positions.getY(i)-bounds.min.y)/height;
        const z=(positions.getZ(i)-c.z)/depth;
        let a=3,b=2,t=0.72;
        const farBack=z<-.28 && y>.48;
        if(farBack){a=18;b=3;t=.62;}
        else if(y<.47){
          if(Math.abs(x)<.052){a=1;b=12;t=.75;}
          else {
            const l=x<0; const lower=clamp((.33-y)/.20,0,1);
            a=l?(lower>0.5?13:12):(lower>0.5?16:15);
            b=l?(lower>0.5?12:13):(lower>0.5?15:16);
            t=Math.max(.53,Math.abs(lower-.5)*.9+.55);
          }
        }else if(y>.61 && Math.abs(x)>.19 && Math.abs(z)<.40){
          const l=x<0,far=clamp((Math.abs(x)-.23)/.20,0,1);
          a=l?(far>.55?7:6):(far>.55?10:9);
          b=l?(far>.55?6:3):(far>.55?9:3);
          t=.55+.34*far;
        }else if(y>.84){a=5;b=4;t=clamp((y-.78)/.15,.48,.93);}
        else if(y<.58){a=1;b=2;t=clamp((.66-y)*3,.55,.93);}
        else {a=3;b=2;t=.75;}
        joints.set([a,b,0,0],i*4);
        weights.set([t,1-t,0,0],i*4);
      }
      geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(joints,4));
      geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
      const skinned=new THREE.SkinnedMesh(geometry,object.material);
      skinned.name='RiftfallSkin_'+object.name;
      skinned.castShadow=true;skinned.receiveShadow=object.receiveShadow;
      skinned.frustumCulled=false;
      object.parent?.remove(object); // Original geometry remains untouched in GLTF cache.
      model.add(skinned);
      model.updateMatrixWorld(true);
      skinned.bind(skeleton,skinned.matrixWorld.clone());
      vertexCount+=positions.count;skinCount++;
    }catch(err){console.warn('[Riftfall auto-rig] mesh skipped',object.name,err);}
  }
  if(!skinCount){root.removeFromParent();return null;}
  const info={found,count:bones.length,synthetic:true,vertexCount};
  model.userData.riftfallAutoRig=info;
  return info;
}
function controller(model,rig,key){
  const found=rig.found;
  const tracked=[...new Set(Object.values(found).filter(Boolean))];
  const original=new Map(tracked.map(b=>[b,b.quaternion.clone()]));
  const restPosition=model.position.clone(),restRotation=model.rotation.clone();
  let phase=0, weight=0, attack=0, attackKind='';
  const add=(b,axis,angle)=>{if(!b||!angle)return;tempQ.setFromAxisAngle(axis,angle);b.quaternion.multiply(tempQ);};
  const fx={
    triggerAttack(slot){attack=1.0;attackKind=String(slot||'cast');},
    update(delta,moving,action=null){
      const dt=clamp(+delta||0,0,.1);
      const movingNow=!!moving;
      const running=moving==='run';
      const target=movingNow?1:0;
      weight+=(target-weight)*(1-Math.exp(-10*dt));
      if(weight>.006) phase=(phase+dt*(running?11.6:7.2))%(Math.PI*2);
      attack=Math.max(0,attack-dt*2.4);
      if(action?.type==='cast'||action?.type==='light'||action?.type==='dash'||action?.type==='chant'){
        attack=Math.max(attack,action.type==='chant'?.3:.62);
        attackKind=action.type;
      }
      const p=Math.sin(phase), walk=Math.max(0,weight),armS=p*walk;
      const strike=Math.sin(Math.PI*clamp(attack,0,1));
      if(rig.synthetic||!model.userData.valgardAnimatedRig)for(const [b,q] of original)b.quaternion.copy(q);
      add(found.leftLeg,X,-p*(running?.58:.37)*walk);
      add(found.rightLeg,X,p*(running?.58:.37)*walk);
      add(found.leftShin,X,Math.max(0,p)*.38*walk);
      add(found.rightShin,X,Math.max(0,-p)*.38*walk);
      add(found.leftArm,X,armS*.36-strike*.22);
      add(found.rightArm,X,-armS*.36-strike*.86);
      add(found.leftForearm,X,strike*.23);
      add(found.rightForearm,X,-strike*.36);
      add(found.chest,Y,p*.042*walk);
      add(found.spine,Z,p*.027*walk);
      if(found.head)add(found.head,Y,p*.016*walk);
      if(found.back)add(found.back,X,Math.sin(phase*.5)*.045*walk);
      // Apply a tiny body bounce to keep heavy feet grounded; no replacement geometry.
      const bob=walk*(running?.055:.036)*Math.abs(p);
      model.position.set(restPosition.x,restPosition.y+bob,restPosition.z);
      model.rotation.set(restRotation.x,restRotation.y,restRotation.z+(walk*p*.012));
    },
    stop(){
      for(const [b,q]of original)b.quaternion.copy(q);
      model.position.copy(restPosition);model.rotation.copy(restRotation);phase=weight=attack=0;
    },
    rigInfo(){return {jointCount:rig.count,synthetic:rig.synthetic,vertexCount:rig.vertexCount??null,key};}
  };
  model.userData.riftfallRigController=fx;
  return fx;
}
/** Kept under the existing export name so game.js and field.js need no rewrite. */
export function attachValgardMotion(model,key){
  if(!model||!SPECIAL.has(key))return null;
  const rig=discoverExisting(model)||createRuntimeSkin(model);
  if(!rig){console.warn('[Riftfall] no skinnable mesh for',key);return null;}
  return controller(model,rig,key);
}
