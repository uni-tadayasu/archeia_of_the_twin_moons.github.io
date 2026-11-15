import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { createProceduralRig, captureProceduralRig, animateProceduralRig } from '../rebirth/rig.mjs';

function fixture(){
  const model=new THREE.Group();const geometry=new THREE.BoxGeometry(.65,2,.35,4,12,2);
  const original=geometry.getAttribute('position');const packed=new Int16Array(original.count*3);
  for(let i=0;i<packed.length;i++)packed[i]=Math.round(original.array[i]*32767);
  geometry.setAttribute('position',new THREE.Int16BufferAttribute(packed,3,true));
  const material=new THREE.MeshStandardMaterial();const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(.2,1,-.1);mesh.scale.setScalar(2);model.add(mesh);model.updateMatrixWorld(true);
  const expected=[];for(let i=0;i<packed.length/3;i++)expected.push(new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('position'),i).applyMatrix4(mesh.matrixWorld));
  return {model,mesh,material,expected,uv:geometry.getAttribute('uv').array.slice()};
}

test('runtime rig preserves quantized bind-pose geometry, UVs and material',()=>{
  const f=fixture();const rig=createProceduralRig(f.model);assert.equal(rig.skeleton.bones.length,13);
  let mesh;f.model.traverse(node=>{if(node.isSkinnedMesh)mesh=node;});assert.ok(mesh);assert.equal(mesh.material,f.material);
  assert.deepEqual(mesh.geometry.getAttribute('uv').array,f.uv);
  assert.ok(mesh.geometry.getAttribute('position').array instanceof Float32Array);
  f.model.updateMatrixWorld(true);rig.skeleton.update();
  const weights=mesh.geometry.getAttribute('skinWeight');
  for(let i=0;i<f.expected.length;i++){
    const sum=weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i);assert.ok(Math.abs(sum-1)<1e-6);
    const point=mesh.applyBoneTransform(i,new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'),i));
    assert.ok(point.distanceTo(f.expected[i])<1e-5,`bind vertex ${i}`);
  }
});

test('procedural gait moves limbs and guard/cast reset without accumulating deformation',()=>{
  const {model}=fixture();createProceduralRig(model);const motion=captureProceduralRig(model);assert.ok(motion);
  animateProceduralRig(motion,'run',{dt:.13,moving:true});assert.ok(Math.abs(motion.joints.leftLeg.rotation.x)>.1);
  animateProceduralRig(motion,'guard',{dt:.1});const rotation=motion.joints.leftArm.rotation.x;assert.ok(rotation<-.5);
  for(let i=0;i<100;i++)animateProceduralRig(motion,'guard',{dt:.016});assert.equal(motion.joints.leftArm.rotation.x,rotation);
  animateProceduralRig(motion,'skill',{dt:.1});assert.ok(motion.joints.rightArm.rotation.x<-.6);
  animateProceduralRig(motion,'idle',{dt:.1});assert.equal(motion.joints.rightArm.rotation.x,0);assert.equal(motion.joints.leftLeg.rotation.x,0);
  assert.equal(createProceduralRig(model),null,'do not add a second skeleton');
});
