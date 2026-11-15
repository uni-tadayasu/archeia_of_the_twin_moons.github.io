import * as THREE from '../assets/vendor/three/three.module.min.js';

// Conservative runtime skinning for the three original meshes without authored
// bones. Paint, UVs, topology and bind-pose geometry remain unchanged.
const PREFIX='RebirthRig_';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=(n,a,b)=>{const t=clamp((n-a)/(b-a),0,1);return t*t*(3-2*t);};

export function createProceduralRig(model) {
  let existing=false;
  model.traverse(node=>{if(node.isBone||node.isSkinnedMesh)existing=true;});
  if(existing)return null;
  model.updateMatrixWorld(true);
  const rootInverse=model.matrixWorld.clone().invert();
  const bounds=new THREE.Box3().makeEmpty();const meshes=[];const samples=[];
  const point=new THREE.Vector3();
  model.traverse(node=>{
    const position=node.geometry?.getAttribute('position');
    if(!node.isMesh||!position||position.count<3)return;
    const matrix=new THREE.Matrix4().multiplyMatrices(rootInverse,node.matrixWorld);
    node.geometry.computeBoundingBox();bounds.union(node.geometry.boundingBox.clone().applyMatrix4(matrix));
    for(let i=0;i<position.count;i+=Math.max(1,Math.floor(position.count/600))){point.fromBufferAttribute(position,i).applyMatrix4(matrix);samples.push([point.x,point.y]);}
    meshes.push({node,matrix});
  });
  if(!meshes.length||bounds.isEmpty())return null;
  const h=bounds.max.y-bounds.min.y;if(h<.00001)return null;
  const xs=samples.map(p=>p[0]).sort((a,b)=>a-b);
  const quantile=p=>xs[Math.floor(p*(xs.length-1))];
  const cx=(quantile(.12)+quantile(.88))*.5;
  const width=Math.max(h*.2,quantile(.91)-quantile(.09));
  const cz=(bounds.min.z+bounds.max.z)*.5;
  const y=f=>bounds.min.y+h*f;
  const joints={
    hips:[cx,y(.49),cz],spine:[cx,y(.65),cz],chest:[cx,y(.77),cz],neck:[cx,y(.86),cz],head:[cx,y(.93),cz],
    leftArm:[cx-width*.29,y(.77),cz],leftForearm:[cx-width*.39,y(.60),cz],
    rightArm:[cx+width*.29,y(.77),cz],rightForearm:[cx+width*.39,y(.60),cz],
    leftLeg:[cx-width*.12,y(.47),cz],leftShin:[cx-width*.12,y(.24),cz],
    rightLeg:[cx+width*.12,y(.47),cz],rightShin:[cx+width*.12,y(.24),cz]
  };
  const bones=[],named={};
  const add=(name,parent)=>{const bone=new THREE.Bone();bone.name=PREFIX+name;bone.position.fromArray(joints[name]);if(parent){bone.position.sub(new THREE.Vector3().fromArray(joints[parent]));named[parent].add(bone);}else model.add(bone);named[name]=bone;bones.push(bone);};
  add('hips');add('spine','hips');add('chest','spine');add('neck','chest');add('head','neck');
  add('leftArm','chest');add('leftForearm','leftArm');add('rightArm','chest');add('rightForearm','rightArm');
  add('leftLeg','hips');add('leftShin','leftLeg');add('rightLeg','hips');add('rightShin','rightLeg');
  model.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);
  const indices=Object.fromEntries(bones.map((bone,i)=>[bone.name.slice(PREFIX.length),i]));
  const weightsFor=(x,yy)=>{
    const ry=(yy-bounds.min.y)/h,rx=(x-cx)/width,side=rx<0?'left':'right',ax=Math.abs(rx);
    if(ry<.51){const upper=smooth(ry,.18,.34),torso=smooth(ry,.43,.51)*.35;return [[side+'Shin',(1-upper)*(1-torso)],[side+'Leg',upper*(1-torso)],['hips',torso]];}
    if(ry>.52&&ry<.88&&ax>.24){const fore=smooth(ax,.30,.5)*(1-smooth(ry,.74,.88));const torso=(1-smooth(ax,.24,.37))*.42;return [[side+'Forearm',fore*(1-torso)],[side+'Arm',(1-fore)*(1-torso)],['chest',torso]];}
    if(ry>.85){const top=smooth(ry,.85,.93);return [['head',top],['neck',1-top]];}
    if(ry>.68){const top=smooth(ry,.68,.79);return [['chest',top],['spine',1-top]];}
    const top=smooth(ry,.49,.68);return [['spine',top],['hips',1-top]];
  };
  for(const {node,matrix}of meshes){
    const geometry=node.geometry.clone(),source=geometry.getAttribute('position');
    // Quantized glTF attributes must become float before baking their transforms.
    const positions=new Float32Array(source.count*3);
    for(let i=0;i<source.count;i++){positions[i*3]=source.getX(i);positions[i*3+1]=source.getY(i);positions[i*3+2]=source.getZ(i);}
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.applyMatrix4(matrix);
    const position=geometry.getAttribute('position');const skinIndex=new Uint16Array(position.count*4),skinWeight=new Float32Array(position.count*4);
    for(let i=0;i<position.count;i++){
      const weights=weightsFor(position.getX(i),position.getY(i));
      for(let j=0;j<weights.length;j++){skinIndex[i*4+j]=indices[weights[j][0]];skinWeight[i*4+j]=weights[j][1];}
    }
    geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));
    geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));
    const mesh=new THREE.SkinnedMesh(geometry,node.material);mesh.name=node.name;mesh.frustumCulled=false;mesh.userData={...node.userData,rebirthProceduralRig:true};
    model.add(mesh);model.updateMatrixWorld(true);mesh.bind(skeleton);node.removeFromParent();
    // The unrigged source geometry belongs to this newly loaded template only.
    node.geometry.dispose();
  }
  return {skeleton,bones:named};
}

export function captureProceduralRig(model) {
  const joints={};model.traverse(node=>{if(node.isBone&&node.name.startsWith(PREFIX))joints[node.name.slice(PREFIX.length)]=node;});
  if(!joints.hips)return null;
  return {joints,rest:Object.fromEntries(Object.entries(joints).map(([name,bone])=>[name,{rotation:bone.rotation.clone(),position:bone.position.clone()}])),time:0};
}
export function animateProceduralRig(rig,state,{dt=0,moving=false,actionTime=0}={}) {
  if(!rig)return;rig.time+=dt;
  for(const [name,bone]of Object.entries(rig.joints)){bone.rotation.copy(rig.rest[name].rotation);bone.position.copy(rig.rest[name].position);}
  const set=(name,x=0,y=0,z=0)=>{const bone=rig.joints[name];if(bone){bone.rotation.x+=x;bone.rotation.y+=y;bone.rotation.z+=z;}};
  const gait=moving?Math.sin(rig.time*9)*.26:0;
  set('leftLeg',gait);set('rightLeg',-gait);set('leftShin',Math.max(0,-gait)*.7);set('rightShin',Math.max(0,gait)*.7);
  set('leftArm',-gait*.65);set('rightArm',gait*.65);set('spine',0,Math.sin(rig.time*2)*.012);
  if(state==='attack'){const stroke=Math.sin(clamp(actionTime/.45,0,1)*Math.PI);set('rightArm',-.75-stroke*.55,.15,-.15);set('rightForearm',-.35);set('chest',0,-.25+stroke*.45);}
  if(state==='skill'||state==='ultimate'){set('leftArm',-.7,0,-.14);set('rightArm',-.7,0,.14);set('leftForearm',-.3);set('rightForearm',-.3);set('head',-.08);}
  if(state==='guard'){set('leftArm',-.6,0,.2);set('rightArm',-.5,0,-.2);set('leftForearm',-.65);set('rightForearm',-.65);set('spine',.08);}
  if(state==='hurt')set('spine',-.15,0,.07);
  if(state==='dodge'){set('hips',.16);set('leftLeg',-.35);set('rightLeg',.35);}
  if(state==='dead'){set('hips',.8,0,-.25);set('spine',.22);set('leftLeg',-.35);set('rightLeg',-.35);}
}
