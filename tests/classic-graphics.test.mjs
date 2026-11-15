import test from 'node:test';
import assert from 'node:assert/strict';
import * as Three from '../assets/vendor/three/three.module.min.js';
import { createClassicSurfaceFinish } from '../assets/classic-graphics.js';
import { createRenderBudget, renderPixelCeiling, contactShadowMetrics, createStageReflections } from '../assets/rf5526/graphics.js';

const tick = () => new Promise(resolve => setImmediate(resolve));

test('render budget caps GPU pixels and survives invalid/hidden-frame inputs',()=>{
  const ceiling = renderPixelCeiling(3840,2160,2);
  assert.ok(3840*2160*ceiling**2<=3600000.001);
  for(const values of [[0,0,0],[NaN,Infinity,NaN],[390,844,.65]])assert.ok(Number.isFinite(renderPixelCeiling(...values)));
  const budget=createRenderBudget();budget.resize(1920,1080,1.5,true);
  assert.equal(budget.frame(NaN,60,true,true),false);
  for(let i=0;i<240;i++)budget.frame(1/25,60,true,true);
  const degraded=budget.ratio;assert.ok(degraded<1.3);assert.ok(degraded>=.5);
  assert.equal(budget.frame(4,60,false,true),false);
  assert.equal(budget.frame(.001,60,true,true),false,'hidden time cannot produce a burst');
  budget.resize(390,844,.65,true);assert.ok(budget.ratio<=.65);
});

test('contact shadows follow jumps and castle coordinates without NaN transforms',()=>{
  const base={pos:{x:2,z:3},radius:.5,y:0};
  const ground=contactShadowMetrics(base,13),jump=contactShadowMetrics({...base,y:2},13);
  assert.ok(jump.opacity<ground.opacity);assert.ok(jump.width>ground.width);
  assert.equal(contactShadowMetrics({...base,pos:{x:50,z:50}},13),null);
  assert.ok(contactShadowMetrics({...base,pos:{x:50,z:50}},13,true));
  assert.equal(contactShadowMetrics({...base,pos:{x:NaN,z:2}},13),null);
  const partial=contactShadowMetrics({pos:{x:0,z:0}},13);assert.ok(Object.values(partial).every(Number.isFinite));
  assert.equal(contactShadowMetrics({...base,dead:true},13),null);
});

test('reflection cache discards stale loads, stays bounded and retries failures',async()=>{
  const oldDocument=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}})})};
  const pending=new Map();
  class Texture {constructor(){this.image={};this.disposed=false;}dispose(){this.disposed=true;}}
  const THREE={CanvasTexture:Texture,EquirectangularReflectionMapping:303,SRGBColorSpace:'srgb'};
  const loader={loadAsync(url){return new Promise((resolve,reject)=>{pending.set(url,{resolve,reject});});}};
  const scene={environment:null};const set=createStageReflections(THREE,scene,loader,{maxEntries:2});
  try {
    set('a');set('b');set('c');assert.equal(set.cacheSize,2);
    const stale=new Texture();pending.get('a').resolve(stale);await tick();assert.equal(stale.disposed,true);assert.equal(scene.environment,null);
    const current=new Texture();pending.get('c').resolve(current);await tick();assert.ok(scene.environment);assert.equal(current.disposed,true);
    set('broken');assert.equal(scene.environment,null);pending.get('broken').reject(new Error('404'));await tick();
    set('broken');assert.ok(set.cacheSize<=2);const late=new Texture();set.dispose();pending.get('broken').resolve(late);await tick();
    assert.equal(late.disposed,true);assert.equal(scene.environment,null);assert.equal(set.cacheSize,0);
  } finally {set.dispose();globalThis.document=oldDocument;}
});


test('original surface detail follows quality and preserves authored UV repeat',async()=>{
  let quality='high';const material=new Three.MeshStandardMaterial();
  material.map=new Three.Texture();material.map.repeat.set(6,6);
  const source=new Three.Texture();let loads=0;
  const finish=createClassicSurfaceFinish(Three,{capabilities:{getMaxAnisotropy:()=>8}},{getQuality:()=>quality,loader:{async loadAsync(){loads++;return source;}}});
  finish.apply(material);await tick();assert.ok(material.normalMap);assert.equal(loads,1);
  const detail=material.normalMap;assert.equal(detail.repeat.x,6);assert.equal(detail.repeat.y,6);assert.equal(detail.colorSpace,Three.NoColorSpace);
  quality='low';finish.refresh();assert.equal(material.normalMap,null);assert.equal(material.map.anisotropy,1);
  quality='standard';finish.refresh();assert.equal(material.normalMap,detail);assert.equal(material.map.anisotropy,4);
  finish.dispose();assert.equal(material.normalMap,null);assert.equal(material.normalScale.x,1);
  material.map.dispose();material.dispose();
});
