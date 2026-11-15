import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { subdivideCharacterGeometry, CharacterGeometryCache, trackModelQuality, setModelQuality, modelQualityReport, geometryCounts } from '../assets/celestial-model-quality.js';
import { finishIllustratedModel } from '../assets/rf5520-illustrated-material.js';

const near = (a, b, epsilon = 1e-6) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
function triangle() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0,0,1, 0,0,1, 0,0,1], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, 1,0, 0,1], 2));
  geometry.setIndex([0,1,2]); return geometry;
}
const tick = () => new Promise(resolve => queueMicrotask(resolve));

test('curved subdivision increases actual triangles, preserves source/UV/groups and finite bounds', () => {
  const source = triangle(); source.addGroup(0,3,2); source.setDrawRange(0,3);
  const original = Array.from(source.attributes.position.array);
  const enhanced = subdivideCharacterGeometry(source);
  assert.deepEqual(geometryCounts(enhanced), { vertices:6, triangles:4 });
  assert.deepEqual(Array.from(source.attributes.position.array), original);
  assert.deepEqual(Array.from(enhanced.attributes.position.array).slice(0,9), original);
  assert.deepEqual(enhanced.groups, [{start:0,count:12,materialIndex:2}]);
  assert.deepEqual(enhanced.drawRange,{start:0,count:12});
  near(enhanced.attributes.uv.getX(3),.5); near(enhanced.attributes.uv.getY(3),0);
  for (const attr of Object.values(enhanced.attributes)) assert.ok([...attr.array].every(Number.isFinite));
  assert.ok(Number.isFinite(enhanced.boundingSphere.radius));
});

test('skin midpoint combines joint identities, retains strongest four and normalizes weights', () => {
  const source=triangle();
  source.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([1,2,3,4, 2,5,6,7, 1,2,3,4],4));
  source.setAttribute('skinWeight',new THREE.Float32BufferAttribute([.4,.3,.2,.1, .5,.25,.15,.1, .4,.3,.2,.1],4));
  const result=subdivideCharacterGeometry(source), bones=result.attributes.skinIndex, weights=result.attributes.skinWeight;
  assert.deepEqual(Array.from(bones.array).slice(0,12),Array.from(source.attributes.skinIndex.array));
  assert.deepEqual(Array.from(bones.array).slice(12,16),[2,1,5,3]);
  for(let i=0;i<weights.count;i++) near(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i),1);
  near(weights.getX(3),.4/.825);
});

test('UV seams stay distinct while their curved geometric edges coincide; creases stay sharp', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([1,0,0, 0,1,0, 0,0,1, 1,0,0, 0,1,0, 0,0,-1],3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute([1,0,2, 0,1,2, 0,0,1, 1,0,2, 0,1,2, 0,0,-1],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0, 1,0, 0,1, .3,.4, .7,.4, 1,1],2));
  geometry.setIndex([0,1,2, 3,4,5]);
  const result=subdivideCharacterGeometry(geometry);
  for(let c=0;c<3;c++)near(result.attributes.position.getComponent(6,c),result.attributes.position.getComponent(9,c));
  assert.notEqual(result.attributes.uv.getY(6),result.attributes.uv.getY(9));
  assert.ok(result.attributes.position.getX(6)>.5,'curvature adds real silhouette detail');
  geometry.attributes.normal.setXYZ(3,-1,0,0);
  const sharp=subdivideCharacterGeometry(geometry);
  near(sharp.attributes.position.getX(6),.5);near(sharp.attributes.position.getY(6),.5);
});

test('normalized interleaved attributes and relative/absolute morphs remain valid', () => {
  const source=triangle();
  const interleaved=new THREE.InterleavedBuffer(new Uint16Array([0,0,99, 65535,0,99, 0,65535,99]),3);
  source.setAttribute('uv',new THREE.InterleavedBufferAttribute(interleaved,2,0,true));
  source.morphAttributes.position=[new THREE.Float32BufferAttribute([0,0,.2, 0,0,.4, 0,0,.6],3)];source.morphTargetsRelative=true;
  let enhanced=subdivideCharacterGeometry(source);
  near(enhanced.attributes.uv.getX(3),.5);
  near(enhanced.morphAttributes.position[0].getZ(3),.3);
  assert.equal(enhanced.morphTargetsRelative,true);
  source.morphTargetsRelative=false;
  source.morphAttributes.position=[new THREE.Float32BufferAttribute([0,0,1, 1,0,1, 0,1,1],3)];
  enhanced=subdivideCharacterGeometry(source);
  near(enhanced.morphAttributes.position[0].getX(3),.5);near(enhanced.morphAttributes.position[0].getZ(3),1);
});

test('cache shares leased derivatives, respects triangle/memory limits and never disposes sources', () => {
  const source=triangle(), cache=new CharacterGeometryCache({maxEntries:1});let sourceDisposed=0,derivedDisposed=0;
  source.addEventListener('dispose',()=>sourceDisposed++);
  const a=cache.acquire(source,'high'),b=cache.acquire(source,'high');a.geometry.addEventListener('dispose',()=>derivedDisposed++);
  assert.equal(a.geometry,b.geometry);assert.equal(cache.report().geometries[0].refs,2);
  const other=cache.acquire(triangle(),'high');assert.equal(other.stats.passes,0,'active derivative is never evicted');
  a.release();cache.clearUnused();assert.equal(derivedDisposed,0);
  b.release();b.release();cache.clearUnused();assert.equal(derivedDisposed,1);assert.equal(sourceDisposed,0);
  const tiny=new CharacterGeometryCache({maxBytes:1});assert.equal(tiny.acquire(source,'ultra').geometry,source);
  source.setIndex(new THREE.BufferAttribute(new Uint32Array(45001*3),1));
  assert.equal(cache.acquire(source,'ultra').geometry,source,'already dense authored assets are not multiplied');
  assert.equal(subdivideCharacterGeometry(triangle(),{triangleLimit:3}),null);
});

test('ultra is two bounded passes; quality switches restore per-instance appearance and release refs', async()=>{
  setModelQuality('high');
  const source=triangle(), model=new THREE.Group(), mesh=new THREE.Mesh(source,new THREE.MeshStandardMaterial());model.add(mesh);
  const instance={model,wrapper:new THREE.Group()};instance.wrapper.add(model);
  const release=trackModelQuality(instance);
  // Appearance customization happens after instantiateModel in the same task.
  const appearance=source.clone();appearance.attributes.position.setX(0,-.1);mesh.geometry=appearance;
  await tick();assert.equal(geometryCounts(mesh.geometry).triangles,4);
  setModelQuality('ultra');assert.equal(geometryCounts(mesh.geometry).triangles,16);
  const report=modelQualityReport();assert.equal(report.renderTriangles,16);assert.equal(report.baseTriangles,1);
  assert.equal(report.instances[0].parts[0].passes,2);
  setModelQuality('low');assert.equal(mesh.geometry,appearance);near(mesh.geometry.attributes.position.getX(0),-.1);
  setModelQuality('high');assert.equal(geometryCounts(mesh.geometry).triangles,4);
  release();assert.equal(mesh.geometry,appearance);assert.equal(modelQualityReport().activeInstances,0);
  assert.equal(modelQualityReport().bytes,0);
});

test('disposal before deferred enhancement cannot resurrect a removed model', async()=>{
  const mesh=new THREE.Mesh(triangle(),new THREE.MeshStandardMaterial()),model=new THREE.Group();model.add(mesh);
  const instance={model,wrapper:new THREE.Group()},original=mesh.geometry;
  const release=trackModelQuality(instance);release();await tick();assert.equal(mesh.geometry,original);
  assert.equal(modelQualityReport().activeInstances,0);
});

test('illustrated finish preserves painted albedo, packed PBR maps and authored normal detail',()=>{
  const albedo=new THREE.Texture(), packed=new THREE.Texture(), normal=new THREE.Texture();
  const material=new THREE.MeshStandardMaterial({color:0xf3b18f,map:albedo,roughnessMap:packed,metalnessMap:packed,normalMap:normal,roughness:.37,metalness:.86});
  material.normalScale.set(.71,.83);
  const mesh=new THREE.Mesh(triangle(),material),model=new THREE.Group();model.add(mesh);
  const instance={model,materials:new Set()};finishIllustratedModel(instance,'rowen');
  assert.notEqual(mesh.material,material);assert.equal(mesh.material.map,albedo);assert.equal(mesh.material.normalMap,normal);
  assert.deepEqual(mesh.material.color.toArray(),material.color.toArray());
  assert.deepEqual(mesh.material.normalScale.toArray(),[.71,.83]);
  assert.equal(mesh.material.metalness,.86);assert.equal(mesh.material.roughness,.37);
  assert.equal(material.userData.rf5527Painted,undefined,'cached source material stays immutable');
  assert.equal(instance.materials.size,1);finishIllustratedModel(instance,'rowen');assert.equal(instance.materials.size,1);
});

test('portrait finish applies quality before the synchronous render and microtask does not repeat it',async()=>{
  setModelQuality('high');
  const mesh=new THREE.Mesh(triangle(),new THREE.MeshStandardMaterial()),model=new THREE.Group();model.add(mesh);
  const instance={model,wrapper:new THREE.Group(),materials:new Set()},release=trackModelQuality(instance);
  finishIllustratedModel(instance,'rowen');
  assert.equal(geometryCounts(mesh.geometry).triangles,4);
  const enhanced=mesh.geometry;await tick();assert.equal(mesh.geometry,enhanced);
  release();
});
