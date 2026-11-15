import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { createCelestialStage, celestialTheme, celestialBudget } from '../assets/celestial-stage.js';

function fixture(quality='high') {
  const scene=new THREE.Scene(),arena=new THREE.Group(),floor=new THREE.Mesh(new THREE.CircleGeometry(13,32),new THREE.MeshStandardMaterial({roughness:.91}));
  scene.add(arena);arena.add(floor);
  const loaded=[],pending=[];
  const loader={load(path,callback){const texture=new THREE.Texture();texture.userData.path=path;loaded.push(texture);pending.push(()=>callback(texture));return texture;}};
  const state={quality};
  const stage=createCelestialStage(THREE,{scene,arena,floor,loader,getQuality:()=>state.quality});
  stage.setStage({id:'moon'});
  const root=scene.children.find(object=>object.name.startsWith('Celestial stage'));
  return {scene,arena,floor,loaded,pending,state,stage,root};
}

test('stage themes follow authored stage families and bounded quality budgets',()=>{
  assert.equal(celestialTheme({id:'frost'}),'frost');
  assert.equal(celestialTheme({id:'s10',sky:'assets/frost-aurora-sky.webp'}),'frost');
  assert.equal(celestialTheme({id:'s50',pshape:'bamboo'}),'bamboo');
  assert.equal(celestialTheme({cshape:'torus'}),'void');
  assert.equal(celestialBudget('low').particles,0);
  assert.ok(celestialBudget('high',true).particles<celestialBudget('high').particles);
  assert.ok(celestialBudget('high').particles<=128);
  assert.equal(celestialBudget('ultra').tier,'ultra');
  assert.ok(celestialBudget('ultra').segments>=celestialBudget('high').segments);
});

test('crafted arena scenery stays outside combat bounds and does not alter actors or camera',()=>{
  const f=fixture(),camera=new THREE.PerspectiveCamera();camera.position.set(0,9,14);
  const before=camera.matrixWorld.clone(),actor=new THREE.Object3D();actor.position.set(2,0,3);f.scene.add(actor);
  f.stage.update(.016,{active:true,battle:{fighters:[]},camera});
  assert.equal(f.stage.stats().sceneryVisible,true);assert.equal(f.stage.stats().particleCount,128);
  const scenery=f.root.children[0];scenery.updateMatrixWorld(true);
  const apron=scenery.getObjectByName('Continuous stone courtyard apron');
  assert.equal(apron.geometry.parameters.innerRadius,12.9);
  assert.equal(apron.geometry.parameters.outerRadius,23);
  assert.ok(apron.position.y<0);
  assert.equal(f.floor.geometry.parameters.radius,13,'the original collision floor is unchanged');
  // Every solid upright prop has its complete world bounding box outside the
  // original 13 m playable circle. The low terrace itself is below the floor.
  const matrix=new THREE.Matrix4(),box=new THREE.Box3(),point=new THREE.Vector3();
  scenery.traverse(object=>{
    if(!object.isMesh)return;
    object.geometry.computeBoundingBox();
    const count=object.isInstancedMesh?object.count:1;
    for(let i=0;i<count;i++) {
      if(object.isInstancedMesh){object.getMatrixAt(i,matrix);matrix.premultiply(object.matrixWorld);}else matrix.copy(object.matrixWorld);
      box.copy(object.geometry.boundingBox).applyMatrix4(matrix);
      if(box.max.y<=.16)return;
      point.set(Math.max(box.min.x,Math.min(0,box.max.x)),0,Math.max(box.min.z,Math.min(0,box.max.z)));
      assert.ok(point.length()>13,object.name||object.geometry.type);
    }
  });
  assert.ok(camera.matrixWorld.equals(before));assert.deepEqual(actor.position.toArray(),[2,0,3]);
  f.stage.dispose();
});

test('world and maze transitions hide courtyard architecture, follow player position, and preserve shared materials',()=>{
  const f=fixture(),group=new THREE.Group(),source=new THREE.MeshStandardMaterial({map:new THREE.Texture(),roughness:.9});
  const wall=new THREE.Mesh(new THREE.BoxGeometry(2,4,1),source);group.add(wall);f.scene.add(group);
  const actorRoot=new THREE.Group();actorRoot.userData.arkeiaModel=true;
  const costume=new THREE.Mesh(new THREE.BoxGeometry(),source);actorRoot.add(costume);group.add(actorRoot);
  const field={group,player:{pos:new THREE.Vector3(100,0,-500)}};
  f.arena.visible=false;f.stage.update(.1,{active:true,field});
  assert.equal(f.stage.stats().context,'field');assert.equal(f.stage.stats().sceneryVisible,false);
  assert.deepEqual(f.root.children[1].position.toArray(),[100,0,-500]);
  assert.notEqual(wall.material,source);assert.equal(costume.material,source);assert.equal(source.roughnessMap,null);
  const copy=wall.material;let disposed=0;copy.addEventListener('dispose',()=>disposed++);
  const maze=new THREE.Group();f.stage.update(.016,{active:true,battle:{rf568Maze:{group:maze},fighters:[{isPlayer:true,pos:new THREE.Vector3(-47,0,58)}]}});
  assert.equal(f.stage.stats().context,'castle');assert.equal(f.stage.stats().particleCount,24);
  assert.equal(wall.material,source);assert.equal(disposed,1);assert.deepEqual(f.root.children[1].position.toArray(),[-47,0,58]);
  f.stage.update(.016,{active:true,battle:{storyII:{}}});assert.equal(f.stage.stats().particleCount,0);assert.equal(f.stage.stats().sceneryVisible,false);
  f.stage.dispose();
});

test('quality changes and repeated stage rebuilds release every owned render resource and restore floor finish',()=>{
  const f=fixture(),watched=[];
  f.root.traverse(object=>{
    for(const resource of [object.isInstancedMesh?object:null,object.isSprite?null:object.geometry,...(Array.isArray(object.material)?object.material:[object.material])]){
      if(resource&&!watched.some(item=>item.resource===resource)){
        const record={resource,count:0};resource.addEventListener('dispose',()=>record.count++);watched.push(record);
      }
    }
  });
  f.state.quality='low';f.stage.update(NaN,{active:true,battle:{}});
  assert.equal(f.stage.stats().particleCount,0);assert.equal(f.stage.stats().quality,'low');
  // Sprites share a Three-owned quad that this controller intentionally keeps.
  for(const record of watched)assert.equal(record.count,1,'every owned render resource is released once');
  const maxResources=f.stage.stats().ownedResources;
  for(let i=0;i<6;i++){f.stage.setStage({id:i%2?'frost':'moon'});assert.ok(f.stage.stats().ownedResources<=maxResources+20);}
  const textureCounts=f.loaded.map(texture=>{let count=0;texture.addEventListener('dispose',()=>count++);return ()=>count;});
  f.stage.dispose();f.stage.dispose();for(const complete of f.pending)complete();
  assert.deepEqual(textureCounts.map(count=>count()),[1,1,1,1]);
  assert.equal(f.stage.stats().ownedResources,0);assert.equal(f.stage.stats().textureCount,0);assert.equal(f.root.parent,null);
  assert.equal(f.floor.material.roughness,.91);assert.equal(f.floor.material.roughnessMap,null);
});

test('reduced motion freezes atmospheric positions and invalid frame time cannot corrupt buffers',()=>{
  const f=fixture();f.stage.setStage({id:'frost'});f.stage.update(.016,{active:true,reducedMotion:true});
  const points=f.root.children[1].children[0],before=points.geometry.attributes.position.array.slice();
  for(const dt of [Infinity,NaN,-1,100])f.stage.update(dt,{active:true,reducedMotion:true});
  assert.deepEqual(points.geometry.attributes.position.array,before);
  assert.ok([...before].every(Number.isFinite));
  f.stage.update(.1,{active:false,paused:true,battle:{}});
  assert.equal(f.root.visible,true,'pausing retains the world scenery');
  assert.deepEqual(points.geometry.attributes.position.array,before);
  f.stage.update(.1,{active:false});assert.equal(f.root.visible,false);assert.equal(f.stage.stats().particleCount,0);
  f.stage.dispose();
});

test('all authored stage families build finite normals and remain within a fixed render budget',()=>{
  const f=fixture();
  for(const id of ['moon','bamboo','frost','desert','heaven','ember','void']){
    f.stage.setStage({id});f.stage.update(.016,{active:true});
    assert.equal(f.stage.stats().theme,id);
    assert.ok(f.stage.stats().sceneryDrawCalls<55);
    assert.ok(f.stage.stats().sceneryTriangles<70000);
    f.root.children[0].traverse(object=>{if(object.isMesh)for(const name of ['position','normal']){
      const attribute=object.geometry.attributes[name];
      if(attribute)assert.ok([...attribute.array].every(Number.isFinite),`${id} ${name}`);
    }});
  }
  f.stage.dispose();
});
