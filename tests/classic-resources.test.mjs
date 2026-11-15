import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import * as THREE from '../assets/vendor/three/three.module.min.js';

// Exercise the actual browser classes against their vendored Three implementation.
const vendor = new URL('../assets/vendor/three/', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, nextResolve) {
    if (specifier === 'three') return { url: ${JSON.stringify(vendor)} + 'three.module.min.js', shortCircuit: true };
    if (specifier.startsWith('three/addons/')) return { url: ${JSON.stringify(vendor)} + specifier.slice(6), shortCircuit: true };
    return nextResolve(specifier, context);
  }
`), import.meta.url);
const { Battle, Fighter } = await import('../game.js');
const { CelestialCombatFX } = await import('../assets/celestial-combat-fx.js');
const { loadModel } = await import('../model-runtime.js?v=rf-minamoto-v48-20261111');

function battle() {
  return new Battle(new THREE.Scene(), new THREE.PerspectiveCamera(), { assets: {}, ui: {} });
}

function disposed(resource) {
  let count = 0;
  resource.addEventListener('dispose', () => count++);
  return () => count;
}

test('exiting a battle releases live effect materials once and preserves cached geometry and textures', () => {
  const b = battle();
  const geometry = new THREE.PlaneGeometry();
  const texture = new THREE.Texture();
  const first = new THREE.MeshBasicMaterial({ map: texture });
  const second = new THREE.MeshBasicMaterial({ map: texture });
  const counts = [first, second, geometry, texture].map(disposed);
  const nested = new THREE.Group();
  nested.add(new THREE.Mesh(geometry, [first, second]));
  b.fx.add(new THREE.Mesh(geometry, first), nested);
  b.effects.push(() => true);
  b.dispose();
  b.dispose();
  assert.deepEqual(counts.map(count => count()), [1, 1, 0, 0]);
  assert.equal(b.fx.children.length, 0);
  assert.equal(b.fx.parent, null);
  assert.equal(b.effects.length, 0);
});

test('healing artwork expires into its pool and battle exit releases its GPU resources once', () => {
  const b = battle();
  const textures = [];
  b.presentation = new CelestialCombatFX(b, { environment: () => ({ quality: 'low' }), loader: { load() { const texture = new THREE.Texture(); textures.push(texture); return texture; } } });
  b.ui = { sfx() {}, callout() {}, popup() {} };
  b.castFx = () => {};
  const f = {
    def: { skills: [{ kind: 'heal', name: 'Heal', radius: 3, heal: 100, color: 0x66ff88 }] },
    team: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), hp: 60, maxHp: 200,
    forward: () => new THREE.Vector3(0, 0, 1)
  };
  const outside = { team: 0, pos: new THREE.Vector3(10, 0, 0), hp: 50, maxHp: 200 };
  b.fighters.push(f, outside);
  b.executeCast(f, 's0');
  assert.equal(f.hp, 160, 'the actual original heal amount is preserved');
  assert.equal(outside.hp, 50, 'the original healing radius is preserved');
  const ring = b.presentation.active.find(entry => entry.kind === 'seal').object;
  const materialDisposed = disposed(ring.material), geometryDisposed = disposed(ring.geometry), textureDisposed = disposed(textures[0]);
  b.presentation.tick(.5);
  assert.ok(ring.parent);
  b.presentation.tick(.5);
  assert.equal(ring.parent, null);
  assert.equal(materialDisposed(), 0, 'expired material is retained for reuse in the bounded pool');
  b.fighters.length = 0; // Lightweight actors above own no model resources.
  b.dispose(); b.dispose();
  assert.deepEqual([materialDisposed(), geometryDisposed(), textureDisposed()], [1, 1, 1]);
});

// A genuine skinned GLB without image dependencies keeps this lifecycle test
// independent of network, canvas, WebGL and the large production model files.
function skinnedGLB() {
  const binary = new ArrayBuffer(108);
  new Float32Array(binary, 0, 9).set([-.5, 0, 0, .5, 0, 0, 0, 2, 0]);
  new Float32Array(binary, 60, 12).set([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
  const doc = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0, 1] }],
    nodes: [{ name: 'SummonMesh', mesh: 0, skin: 0 }, { name: 'Hips' }],
    skins: [{ joints: [1] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 1 } }],
    buffers: [{ byteLength: 108 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 24 }, { buffer: 0, byteOffset: 60, byteLength: 48 }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-.5, 0, 0], max: [.5, 2, 0] },
      { bufferView: 1, componentType: 5123, count: 3, type: 'VEC4' },
      { bufferView: 2, componentType: 5126, count: 3, type: 'VEC4' }
    ]
  };
  const json = new TextEncoder().encode(JSON.stringify(doc));
  const jsonLength = Math.ceil(json.length / 4) * 4;
  const glb = new ArrayBuffer(28 + jsonLength + binary.byteLength);
  const view = new DataView(glb);
  [0x46546c67, 2, glb.byteLength, jsonLength, 0x4e4f534a].forEach((value, index) => view.setUint32(index * 4, value, true));
  const jsonBytes = new Uint8Array(glb, 20, jsonLength);
  jsonBytes.fill(32);
  jsonBytes.set(json);
  view.setUint32(20 + jsonLength, binary.byteLength, true);
  view.setUint32(24 + jsonLength, 0x004e4942, true);
  new Uint8Array(glb, 28 + jsonLength).set(new Uint8Array(binary));
  return glb;
}

test('removing a loaded summon releases its skeleton and mixer while preserving the cached GLB', async t => {
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(String(url), 'https://summon.test/assets/models/summon-susanoo.glb');
    return new Response(skinnedGLB());
  });
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { baseURI: 'https://summon.test/' } });
  t.after(() => {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
  });
  const cached = await loadModel('assets/models/summon-susanoo.glb');
  const source = cached.scene.getObjectByName('SummonMesh');
  source.skeleton.computeBoneTexture();
  const sourceCounts = [source.geometry, source.material, source.skeleton.boneTexture].map(disposed);
  const b = battle();
  b.burstFx = () => {};
  const fighter = {
    summonId: 's1', def: { height: 1.8, skills: [{}] }, scale: 1,
    maxHp: 1000, pos: new THREE.Vector3(), facing: 0, forward: () => new THREE.Vector3(0, 0, 1)
  };
  const summon = b.spawnSummon(fighter);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(summon.model, 'the asynchronous production spawn path has attached its clone');
  const clone = summon.model.getObjectByName('SummonMesh');
  assert.notEqual(clone.skeleton, source.skeleton);
  assert.equal(clone.geometry, source.geometry);
  assert.notEqual(clone.material, source.material);
  clone.skeleton.computeBoneTexture();
  const skeletonDisposed = disposed(clone.skeleton.boneTexture);
  const materialDisposed = disposed(clone.material);
  const mixer = summon.mixer = new THREE.AnimationMixer(summon.model);
  const clip = new THREE.AnimationClip('idle', 1, [new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0])]);
  summon.acts.idle = mixer.clipAction(clip).play();
  assert.equal(mixer.stats.actions.total, 1);
  b.removeSummon(summon);
  b.removeSummon(summon);
  assert.equal(skeletonDisposed(), 1);
  assert.equal(materialDisposed(), 1);
  assert.deepEqual(sourceCounts.map(count => count()), [0, 0, 0]);
  assert.equal(mixer.stats.actions.total, 0);
  assert.equal(mixer.stats.bindings.total, 0);
  assert.equal(summon.own.size, 0);
  assert.equal(summon.g.parent, null);
  assert.equal(summon.model, null);
  assert.equal(fighter.summon, null);
  assert.equal(b.summons.size, 0);
  b.dispose();
});

test('hit flash duration follows elapsed motion time at different frame rates', () => {
  const actor = {
    root: new THREE.Group(), pos: new THREE.Vector3(), y: 0, facing: 0,
    guardMesh: new THREE.Mesh(), visual: new THREE.Group(), dead: true, hitFlash: .2
  };
  actor.motionDt = 1 / 30;
  for (let i = 0; i < 3; i++) Fighter.prototype.sync.call(actor);
  assert.ok(Math.abs(actor.hitFlash - .1) < 1e-10);
  actor.hitFlash = .2;
  actor.motionDt = 1 / 120;
  for (let i = 0; i < 12; i++) Fighter.prototype.sync.call(actor);
  assert.ok(Math.abs(actor.hitFlash - .1) < 1e-10);
  actor.motionDt = NaN;
  Fighter.prototype.sync.call(actor);
  assert.ok(Math.abs(actor.hitFlash - (.1 - 1 / 60)) < 1e-10);
});

test('accepted hits emit directional contact artwork; invulnerability never reports a false impact', () => {
  const b = battle(), contacts = [];
  b.ui = { sfx() {}, popup() {} };
  b.presentation = { impact(...args) { contacts.push(args); }, dispose() {} };
  const attacker = { key: 'rowen', pos: new THREE.Vector3(), atkMul: 1, og: 1, over: 0, status: {},
    def: { color: 0xffaa66, light: { color: 0xffaa66 }, skills: [{}] }, forward: () => new THREE.Vector3(0, 0, 1) };
  const target = { pos: new THREE.Vector3(0, 0, 2), y: 0, inv: .1, hp: 100, isPlayer: true,
    receive(damage) { this.hp -= damage; return damage; } };
  b.applyHit(attacker, target, 30, .25, 2, attacker.pos, null);
  assert.equal(target.hp, 100); assert.equal(contacts.length, 0);
  target.inv = 0;
  b.applyHit(attacker, target, 30, .25, 2, attacker.pos, null);
  assert.equal(target.hp, 70); assert.equal(contacts.length, 1);
  assert.equal(contacts[0][2].z, 2, 'the hit direction reaches the CG burst');
  assert.ok(contacts[0][3].power > 0);
  b.dispose();
});
