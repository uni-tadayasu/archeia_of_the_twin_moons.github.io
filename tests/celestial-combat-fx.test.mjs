import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { CelestialCombatFX, combatEffectBudget, getCombatFXDiagnostics } from '../assets/celestial-combat-fx.js';

function fixture(initial = {}) {
  const state = { quality: 'high', ...initial }, textures = [], lights = [];
  const battle = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), slowmo: 0, flashLight(...args) { lights.push(args); } };
  battle.camera.position.set(0, 8, 12);
  const fx = new CelestialCombatFX(battle, { environment: () => state, loader: { load() { const texture = new THREE.Texture(); textures.push(texture); return texture; } } });
  const fighter = { key: 'rowen', pos: new THREE.Vector3(1, 0, 2), y: 0, facing: .6, combo: 1,
    def: { color: 0xff9a4a, light: { range: 2.4 }, skills: [], over: {} } };
  return { fx, battle, fighter, state, textures, lights };
}
const countDisposals = resource => { let count = 0; resource.addEventListener('dispose', () => count++); return () => count; };

test('combat graphics cover authored actions without modifying fighter or battle gameplay', () => {
  const h = fixture(), before = JSON.stringify(h.fighter), stats = getCombatFXDiagnostics().emitted;
  try {
    h.fx.swing(h.fighter);
    h.fx.cast(h.fighter, 0xff9922, { kind: 'shockwave' });
    h.fx.impact(new THREE.Vector3(2, 1, 3), 0xff9922, new THREE.Vector3(1, 0, 0));
    h.fx.shockwave(h.fighter.pos, 0xff9922, 3, .15);
    h.fx.heal(h.fighter.pos, 0x66ffaa, 3);
    h.fx.cast(h.fighter, 0xffdd77, h.fighter.def.over, true);
    const point = new THREE.Vector3(1, 1, 2), trail = h.fx.projectile(point, 0xff9922, .3);
    for (let i = 0; i < 10; i++) { point.x += .2; h.fx.tick(.016); }
    assert.ok(h.fx.active.some(entry => entry.kind === 'trail' && entry.object.geometry.drawRange.count > 0));
    trail.stop();
    assert.equal(JSON.stringify(h.fighter), before);
    assert.equal(h.battle.slowmo, 0, 'presentation cannot slow gameplay or change hit timing');
    for (const key of ['swing', 'cast', 'impact', 'shockwave', 'heal', 'ultimate', 'projectile']) assert.ok(getCombatFXDiagnostics().emitted[key] > stats[key], key);
    assert.ok(h.lights.length > 0);
  } finally { h.fx.dispose(); }
});

test('effect priority and downgrade keep both draw emitters and batched particles bounded', () => {
  const h = fixture();
  try {
    for (let i = 0; i < 120; i++) { h.fx.burst(new THREE.Vector3(i * .6, 1, 0), 0, 0xff9900, 2, true); }
    assert.ok(h.fx.active.length <= h.fx.budget.emitters);
    assert.ok(h.fx.particles.length <= h.fx.budget.particles);
    h.fx.swing(h.fighter);
    assert.ok(h.fx.active.some(entry => entry.kind === 'arc'), 'high-priority blade readability survives a particle storm');
    h.state.quality = 'low'; h.fx.tick(.016);
    assert.ok(h.fx.active.length <= 12); assert.ok(h.fx.particles.length <= 40);
    h.state.reducedMotion = true; h.fx.tick(.016);
    assert.equal(h.fx.particles.length, 0);
    assert.equal(h.fx.particleMesh.geometry.drawRange.count, 0);
    const lights = h.lights.length; h.fx.cast(h.fighter, 0xffffff, {}, true);
    assert.equal(h.lights.length, lights, 'reduced motion never flashes a new light');
    assert.equal(h.fx.active.at(-1).spin, 0);
    assert.ok(combatEffectBudget({ mobile: true, quality: 'low' }).emitters <= 8);
  } finally { h.fx.dispose(); }
});

test('expired CG emitters detach and reuse their materials; battle disposal releases every owned GPU resource once', () => {
  const h = fixture(), fx = h.fx;
  const first = fx.emit('seal', new THREE.Vector3(), 0xffffff, 3, .3);
  const materialDisposed = countDisposals(first.object.material), geometryDisposed = countDisposals(first.object.geometry);
  const textureDisposed = countDisposals(h.textures[0]);
  fx.tick(.4);
  assert.equal(first.object.parent, null); assert.equal(materialDisposed(), 0, 'pooled material stays reusable');
  const second = fx.emit('seal', new THREE.Vector3(), 0xffffff, 3, .3);
  assert.equal(first.object, second.object);
  const path = new THREE.Vector3(), handle = fx.projectile(path, 0xffffff);
  const entry = fx.active.find(effect => effect.kind === 'trail');
  const trailGeometryDisposed = countDisposals(entry.object.geometry), trailMaterialDisposed = countDisposals(entry.object.material);
  const pointsGeometryDisposed = countDisposals(fx.particleMesh.geometry), pointsMaterialDisposed = countDisposals(fx.particleMesh.material);
  fx.dispose(); fx.dispose(); handle.stop();
  assert.deepEqual([materialDisposed(), geometryDisposed(), textureDisposed(), trailGeometryDisposed(), trailMaterialDisposed(), pointsGeometryDisposed(), pointsMaterialDisposed()], [1, 1, 1, 1, 1, 1, 1]);
  assert.equal(fx.group.parent, null); assert.equal(h.battle.scene.children.length, 0);
  assert.equal(fx.active.length, 0); assert.equal(fx.particles.length, 0); assert.equal(fx.pools.size, 0);
  assert.equal(fx.emit('ring', new THREE.Vector3(), 0xffffff, 2, .3), null, 'retired battles cannot create new artwork');
});

test('particle paths and fades use elapsed time instead of frame-dependent velocity changes', () => {
  const a = fixture(), b = fixture();
  try {
    for (const h of [a, b]) { h.fx.motes(new THREE.Vector3(1, 1, 1), 0xffa044, 1); h.fx.emit('ring', new THREE.Vector3(), 0xffcc88, 3, .6); }
    for (let i = 0; i < 12; i++) a.fx.tick(1 / 60);
    for (let i = 0; i < 6; i++) b.fx.tick(1 / 30);
    const one = a.fx.particleMesh.geometry.attributes.position.array, two = b.fx.particleMesh.geometry.attributes.position.array;
    for (let i = 0; i < a.fx.particleMesh.geometry.drawRange.count * 3; i++) assert.ok(Math.abs(one[i] - two[i]) < 1e-5);
    assert.ok(Math.abs(a.fx.active[0].object.material.uniforms.opacity.value - b.fx.active[0].object.material.uniforms.opacity.value) < 1e-10);
  } finally { a.fx.dispose(); b.fx.dispose(); }
});

test('projectile trails fade after impact and ignore handles retained after pool reuse', () => {
  const h = fixture();
  try {
    const point = new THREE.Vector3(1, 1, 0), first = h.fx.projectile(point, 0xffcc88);
    for (let i = 0; i < 8; i++) { point.z += .2; h.fx.tick(.02); }
    first.stop(); h.fx.tick(.4);
    assert.equal(h.fx.active.filter(entry => entry.kind === 'trail').length, 0);
    const second = h.fx.projectile(point, 0xffffff);
    first.stop(); point.z += .3; h.fx.tick(.02);
    assert.ok(h.fx.active.some(entry => entry.kind === 'trail' && !entry.stopped), 'an expired handle cannot stop a reused trail');
    second.stop(); h.fx.tick(.4);
    assert.equal(h.fx.active.length, 0);
  } finally { h.fx.dispose(); }
});

test('hidden screens, invalid coordinates and elapsed-time spikes do not leak effects', () => {
  const h = fixture();
  try {
    assert.equal(h.fx.emit('flare', { x: NaN, y: 0, z: 0 }, 0xffffff, 1, .5), null);
    assert.equal(h.fx.emit('ring', new THREE.Vector3(), 0xffffff, 1, NaN), null);
    h.state.hidden = true; h.fx.swing(h.fighter); assert.equal(h.fx.active.length, 0);
    h.state.hidden = false; h.fx.swing(h.fighter); const age = h.fx.active[0].age;
    h.fx.tick(NaN); h.fx.tick(-1); h.fx.tick(Infinity); assert.equal(h.fx.active[0].age, age);
    h.fx.tick(20); assert.equal(h.fx.active.length, 0); assert.equal(h.fx.particles.length, 0);
  } finally { h.fx.dispose(); }
});

test('diagnostics are detached snapshots and active counts reset after disposal', () => {
  const h = fixture(); h.fx.swing(h.fighter);
  const diagnostic = getCombatFXDiagnostics();
  assert.equal(diagnostic.activePresentations, 1); assert.ok(diagnostic.activeEmitters > 0);
  diagnostic.instances[0].budget.emitters = 100000; diagnostic.emitted.swing = -1;
  assert.notEqual(h.fx.budget.emitters, 100000); assert.notEqual(getCombatFXDiagnostics().emitted.swing, -1);
  h.fx.dispose();
  assert.equal(getCombatFXDiagnostics().activePresentations, 0);
  assert.equal(getCombatFXDiagnostics().activeEmitters, 0); assert.equal(getCombatFXDiagnostics().activeParticles, 0);
});

test('Tenshi keeps its bespoke texture pipeline and it is disposed with the same battle', () => {
  const h = fixture(), calls = [];
  const special = { active: [], swing() { calls.push('swing'); }, cast() { calls.push('cast'); }, emit(kind) { calls.push(kind); }, tick() {}, dispose() { calls.push('dispose'); } };
  h.fx.specialFactory = () => special; h.fighter.key = 'tenshi';
  h.fx.swing(h.fighter); h.fx.cast(h.fighter, 0xffffff, {});
  h.fx.emit('tenshi-seal-moon', new THREE.Vector3(), 0xffffff, 3, .7);
  assert.deepEqual(calls, ['swing', 'cast', 'tenshi-seal-moon']);
  assert.equal(h.fx.active.length, 0, 'the general layer does not duplicate bespoke artwork');
  h.fx.dispose(); h.fx.dispose(); assert.equal(calls.filter(call => call === 'dispose').length, 1);
});

test('the authored 3:2 sigil stays circular and a late texture load cannot resurrect disposed resources', () => {
  let complete, texture, url;
  const battle = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() };
  const fx = new CelestialCombatFX(battle, { environment: () => ({ quality: 'high' }), loader: { load(path, callback) { url = path; complete = callback; texture = new THREE.Texture(); return texture; } } });
  const seal = fx.emit('seal', new THREE.Vector3(), 0xffffff, 3, .6);
  assert.ok(url.endsWith('/assets/celestial/spell-seal.webp'));
  assert.equal(seal.object.scale.x / seal.object.scale.y, 1.5);
  const release = countDisposals(texture); fx.dispose(); complete(texture);
  assert.equal(release(), 1); assert.equal(battle.scene.children.length, 0);
});
