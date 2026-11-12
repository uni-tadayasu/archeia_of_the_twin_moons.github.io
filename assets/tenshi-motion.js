import * as THREE from 'three';

// Joint positions in the attached GLB's own coordinate system. Its bind pose faces +Z.
const joints = [
  ['Root',null,0,0,0], ['Hips','Root',0,.493,-.010],
  ['Spine','Hips',0,.625,-.005], ['Chest','Spine',0,.739,.003],
  ['Neck','Chest',0,.827,.007], ['Head','Neck',0,.875,.009],
  ...[1,-1].flatMap((s,i)=>{
    const p=i?'R':'L';
    return [
      [p+'Shoulder','Chest',s*.090,.776,.002], [p+'Arm',p+'Shoulder',s*.116,.747,.006],
      [p+'Elbow',p+'Arm',s*.140,.612,.015], [p+'Wrist',p+'Elbow',s*.148,.489,.028],
      [p+'Thigh','Hips',s*.043,.487,-.007], [p+'Knee',p+'Thigh',s*.048,.252,-.018],
      [p+'Ankle',p+'Knee',s*.052,.060,-.030], [p+'Toe',p+'Ankle',s*.052,.025,.039],
      [p+'Tail','Hips',s*.066,.467,-.065]
    ];
  })
];
const index = Object.fromEntries(joints.map((j,i)=>[j[0],i]));
const smooth = (value, low, high) => THREE.MathUtils.smoothstep(value,low,high);
const radians = THREE.MathUtils.degToRad;

function weightsFor(position) {
  const ids=new Uint16Array(position.count*4), weights=new Float32Array(position.count*4);
  const candidates=new Float32Array(joints.length);
  const topIds=new Uint16Array(4), topWeights=new Float32Array(4);
  for(let i=0;i<position.count;i++){
    candidates.fill(0);
    const x=position.getX(i), y=position.getY(i), z=position.getZ(i);
    const side=x<0?'R':'L', abs=Math.abs(x);
    const armLimit=.091 + .023*smooth(.75-y,0,.20);
    const arm=smooth(abs,armLimit,armLimit+.019)*smooth(y,.355,.417)*(1-smooth(y,.787,.833))*smooth(z,-.099,-.055);
    const low=1-smooth(y,.425,.543);
    const tail=low*(1-arm)*smooth(-z,.048,.082)*smooth(y,.255,.323)*smooth(abs,.028,.060);
    const leg=low*(1-arm)-tail;
    const trunk=Math.max(0,1-arm-tail-leg);

    const head=smooth(y,.841,.879), neck=smooth(y,.795,.841);
    const chest=smooth(y,.666,.758), spine=smooth(y,.498,.632);
    candidates[index.Head]=trunk*head;
    candidates[index.Neck]=trunk*neck*(1-head);
    candidates[index.Chest]=trunk*chest*(1-neck);
    candidates[index.Spine]=trunk*spine*(1-chest);
    candidates[index.Hips]=trunk*(1-spine);
    const elbow=1-smooth(y,.571,.652), hand=1-smooth(y,.477,.520);
    const shoulder=smooth(y,.725,.795)*(1-smooth(abs,.107,.127))*.64;
    candidates[index[side+'Shoulder']]=arm*shoulder;
    candidates[index[side+'Arm']]=arm*(1-shoulder)*(1-elbow);
    candidates[index[side+'Elbow']]=arm*(1-shoulder)*elbow*(1-hand);
    candidates[index[side+'Wrist']]=arm*(1-shoulder)*hand;
    const knee=1-smooth(y,.213,.291), ankle=1-smooth(y,.046,.083);
    const toe=(1-smooth(y,.029,.056))*smooth(z,.026,.067);
    const split=smooth(x,-.022,.022);
    for (const [p,share] of [['L',split],['R',1-split]]) {
      const limb=leg*share;
      candidates[index[p+'Thigh']]=limb*(1-knee);
      candidates[index[p+'Knee']]=limb*knee*(1-ankle);
      candidates[index[p+'Ankle']]=limb*ankle*(1-toe);
      candidates[index[p+'Toe']]=limb*toe;
      candidates[index[p+'Tail']]=tail*share;
    }

    topIds.fill(0);topWeights.fill(0);
    for(let j=1;j<candidates.length;j++){
      const value=candidates[j];
      if(value<=topWeights[3])continue;
      let k=3;
      while(k>0&&value>topWeights[k-1]){
        topWeights[k]=topWeights[k-1];topIds[k]=topIds[k-1];k--;
      }
      topWeights[k]=value;topIds[k]=j;
    }
    const sum=topWeights[0]+topWeights[1]+topWeights[2]+topWeights[3];
    for(let j=0;j<4;j++){
      ids[i*4+j]=sum?topIds[j]:index.Hips;
      weights[i*4+j]=sum?topWeights[j]/sum:j===0?1:0;
    }
  }
  return {ids,weights};
}

function clip(name,duration,frames) {
  const tracks=[], euler=new THREE.Euler(), rotation=new THREE.Quaternion();
  const times=frames.map(([t])=>t*duration);
  const used=new Set(frames.flatMap(([,pose])=>Object.keys(pose)));
  for(const bone of used){
    if(bone==='lift')continue;
    const values=[];
    for(const [,pose] of frames){
      const [x=0,y=0,z=0]=pose[bone]||[];
      rotation.setFromEuler(euler.set(radians(x),radians(y),radians(z),'XYZ'));
      values.push(rotation.x,rotation.y,rotation.z,rotation.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack('tenshi'+bone+'.quaternion',times,values));
  }
  if(used.has('lift')){
    tracks.push(new THREE.VectorKeyframeTrack('tenshiHips.position',times,
      frames.flatMap(([,p])=>[0,.493+(p.lift||0),-.010])));
  }
  return new THREE.AnimationClip(name,duration,tracks);
}

function gait(running) {
  const a=running?39:23, b=running?35:16, knee=running?63:32, arm=running?28:13;
  const lean=running?11:3, rise=running?.018:.007;
  const pose=(left, right, kL, kR, aL, aR, rotate, lift)=>({
    lift, Hips:[lean*.3,rotate*.7,rotate*.15], Spine:[lean,-rotate,.5], Head:[-lean*.48,0,0],
    LThigh:[left,0,-2], RThigh:[right,0,2], LKnee:[kL], RKnee:[kR],
    LAnkle:[-kL*.18],RAnkle:[-kR*.18], LToe:[-6],RToe:[-6],
    LArm:[aL,0,4],RArm:[aR,0,-4],LElbow:[-b],RElbow:[-b],
    LTail:[left*.35,0,-2],RTail:[right*.35,0,2]
  });
  const start=pose(-a,a*.62,7,knee*.66,arm,-arm,5,0);
  return clip(running?'Run':'Walk',running?.68:1.02,[
    [0,start],[.24,pose(-a*.24,a*.19,4,knee,arm*.25,-arm*.25,1,rise)],
    [.5,pose(a*.62,-a,knee*.66,7,-arm,arm,-5,0)],
    [.74,pose(a*.19,-a*.24,knee,4,-arm*.25,arm*.25,-1,rise)],
    [1,start]
  ]);
}

function authoredClips(){
  const arms=(l,r,le,re,spin=0,lean=0)=>({
    LArm:[l,0,8], RArm:[r,0,-8], LElbow:[le], RElbow:[re],
    Chest:[lean,spin,0], Head:[-lean*.55,-spin*.34,0],
    LTail:[-lean*.7,-spin*.15,0], RTail:[-lean*.7,-spin*.15,0]
  });
  const ready=arms(-13,-17,-22,-30,0,3);
  const gather=arms(-29,-32,-65,-63,0,2);
  const guard={...arms(-39,-41,-94,-92,-6,12),lift:-.026,LThigh:[-14],RThigh:[-12],LKnee:[24],RKnee:[24]};
  const launch={...arms(-33,-24,-39,-34,0,6),lift:-.04,LThigh:[-20],RThigh:[-24],LKnee:[41],RKnee:[43]};
  const inAir={...arms(-20,-37,-38,-52,0,5),LThigh:[-33],RThigh:[-20],LKnee:[57],RKnee:[34]};
  const idle={Spine:[.5],Head:[0,0,-.5],LArm:[1,0,1],RArm:[-1,0,-1],LElbow:[-2],RElbow:[-3]};
  return [
    clip('Idle',2.5,[[0,idle],[.5,{...idle,lift:.003,Spine:[-1.0],Chest:[-1],Head:[1.1,1.1,1]}],[1,idle]]),
    gait(false),gait(true),
    clip('Guard',1.08,[[0,guard],[.5,{...guard,Chest:[11,-6,1],Head:[-4,2,0]}],[1,guard]]),
    clip('Jump_Start',.20,[[0,ready],[.25,launch],[1,inAir]]),
    clip('Jump_Loop',.55,[[0,inAir],[.55,{...inAir,RThigh:[-32],RKnee:[44],LThigh:[-26],LKnee:[48]}],[1,inAir]]),
    clip('Jump_Land',.26,[[0,inAir],[.33,launch],[1,idle]]),
    clip('Sword_Regular_A',.43,[[0,ready],[.27,arms(-16,16,-25,-49,-20,6)],[.51,arms(-24,-85,-68,-19,18,14)],[1,ready]]),
    clip('Sword_Regular_B',.45,[[0,ready],[.26,arms(22,-18,-53,-35,23,5)],[.50,arms(-81,-22,-15,-65,-22,11)],[1,ready]]),
    clip('Sword_Regular_C',.58,[[0,ready],[.31,arms(-21,22,-32,-68,-26,2)],[.56,{...arms(-58,-91,-36,-19,21,14),LThigh:[-15],RKnee:[20]}],[1,ready]]),
    clip('Sword_Dash',.44,[[0,{...launch,Spine:[18]}],[.37,{...arms(-34,-72,-56,-25,14,18),LThigh:[-41],RKnee:[49]}],[1,ready]]),
    clip('Chant',1.35,[[0,gather],[.52,{...gather,lift:.005,Head:[-5,0,0],LArm:[-40,0,14],RArm:[-37,0,-14]}],[1,gather]]),
    clip('Cast',.56,[[0,gather],[.43,arms(-50,-77,-62,-18,12,6)],[1,ready]]),
    clip('Ougi',.94,[[0,gather],[.33,arms(-68,-65,-66,-61,0,0)],[.60,{...arms(-77,-89,-21,-16,4,10),lift:.017}],[1,ready]]),
    clip('HiOugi',1.10,[[0,gather],[.30,arms(-78,-74,-44,-37,-15,-7)],[.53,{...arms(-64,-98,-20,-11,15,8),lift:.023}],[.75,arms(-40,-56,-37,-21,3,6)],[1,ready]]),
    clip('Hit',.35,[[0,ready],[.29,{...arms(9,8,-29,-22,-10,-17),LThigh:[-8],RThigh:[12]}],[1,ready]]),
    clip('Death',1.02,[[0,ready],[.45,{...arms(15,11,-28,-27,-16,-21),lift:-.066,Hips:[-27,-8,-7],LKnee:[28],RKnee:[37]}],
      [1,{...arms(15,16,-11,-13,-8,2),lift:-.425,Hips:[-83,-8,-13],LThigh:[-13],RThigh:[-15],LKnee:[13],RKnee:[24]}]]),
    clip('Victory',1.66,[[0,ready],[.30,arms(-12,-51,-16,-62,4,0)],[.68,arms(-10,-53,-15,-60,2,0)],[1,idle]])
  ];
}

export function attachTenshiRig(gltf) {
  const source=gltf.scene;
  const original=source.children.find(node=>node.isMesh&&!node.isSkinnedMesh);
  if (!original?.geometry?.attributes.position) throw Error('天子の元モデルを読み込めませんでした');
  source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source,true);
  const geometry=original.geometry;
  const {ids,weights}=weightsFor(geometry.attributes.position);
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(ids,4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const bones=joints.map(([name])=>{const b=new THREE.Bone();b.name='tenshi'+name;return b;});
  joints.forEach(([,parent,x,y,z],i)=>{
    const b=bones[i], origin=parent?joints[index[parent]].slice(2):[0,0,0];
    b.position.set(x-origin[0],y-origin[1],z-origin[2]);
    if(parent)bones[index[parent]].add(b);
  });
  const mesh=new THREE.SkinnedMesh(geometry,original.material);
  mesh.name='tenshiCostume';
  mesh.position.copy(original.position);
  mesh.quaternion.copy(original.quaternion);
  mesh.scale.copy(original.scale);
  mesh.add(bones[0]);
  source.remove(original);
  source.add(mesh);
  source.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled=false;
  gltf.animations=authoredClips();
  gltf.userData={...gltf.userData,arkeiaRig:'tenshi',arkeiaOriginalBounds:bounds};
  return gltf;
}
