import test from 'node:test';
import assert from 'node:assert/strict';
import { Combat, createObstacles } from '../rebirth/combat.mjs';

const fighter = {
  id: 'rowen', name: 'ロウエン', hp: 1000, speed: 6, color: 0xffb347,
  light: { dmg: 40, range: 2.1 },
  skills: [
    { name: '焔牙', kind: 'shockwave', dmg: 100, radius: 4, cost: 20 },
    { name: '燕翔', kind: 'dash', dmg: 100, speed: 20, dur: .3, cost: 20 },
    { name: '双燕', kind: 'projectile', dmg: 60, count: 2, radius: .5, speed: 20, cost: 25 },
    { name: '灰舞', kind: 'rain', dmg: 35, count: 5, radius: 2, spread: 1, cost: 25 },
  ],
  over: { name: '灰燼百華', kind: 'shockwave', dmg: 200, radius: 8 },
};
const enemy = { ...fighter, id: 'foe', hp: 1000, speed: 3, light: { dmg: 20, range: 2 } };
const make = (options = {}) => new Combat({ fighter, enemies: [enemy], difficulty: 1, seed: 10, ...options });
function advance(sim, seconds, input = {}, fps = 60) {
  for (let i = 0; i < Math.round(seconds * fps); i++) sim.update(1 / fps, input);
}
function closeEnemy(sim, hp = 1000) {
  const foe = sim.foes[0];
  foe.x = sim.player.x; foe.z = sim.player.z - 2;
  foe.hp = foe.maxHp = hp;
  foe.aiTimer = 1000; foe.aiSkillTimer = 1000;
  return foe;
}

test('movement is normalized and independent of 30/60/120 Hz render rate', () => {
  const sims = [30, 60, 120].map(fps => {
    const sim = make(); sim.foes[0].z = -30;
    advance(sim, 1, { x: 1, z: 1 }, fps);
    return sim;
  });
  for (const sim of sims) {
    assert.ok(Math.abs(Math.hypot(sim.player.x, sim.player.z - 10) - 6) < .001);
    assert.ok(Math.abs(sim.elapsed - 1) < .00001);
    assert.ok(Math.abs(sim.player.x - sims[0].player.x) < .00001);
  }
});

test('a tab return cannot simulate seconds of unseen combat', () => {
  const sim = make(); sim.update(12, { x: 1 });
  assert.ok(sim.elapsed <= .100001);
  assert.ok(sim.player.x <= .600001);
});

test('tapped input survives a frame shorter than a simulation step', () => {
  const sim = make(); const foe = closeEnemy(sim);
  sim.update(1 / 240, { attack: true });
  sim.update(1 / 240, {});
  advance(sim, .2);
  assert.ok(foe.hp < 1000);
});

test('normal attacks chain, emit damage and settle a match exactly once', () => {
  const sim = make(); closeEnemy(sim, 130);
  advance(sim, 3, { attack: true });
  assert.equal(sim.status, 'victory');
  assert.equal(sim.kills, 1);
  assert.ok(sim.bestCombo >= 3);
  const events = sim.drainEvents();
  assert.equal(events.filter(event => event.type === 'kill').length, 1);
  assert.equal(events.filter(event => event.type === 'victory').length, 1);
  const dealt = sim.player.damageDealt;
  advance(sim, 2, { attack: true, skill: true, over: true });
  assert.equal(sim.player.damageDealt, dealt);
  assert.equal(sim.drainEvents().length, 0);
});

test('skill costs and cooldowns prevent an unlimited cast per held frame', () => {
  const sim = make(); closeEnemy(sim, 10000);
  advance(sim, 1, { skill: true });
  assert.equal(sim.drainEvents().filter(event => event.type === 'action' && event.action === 'skill').length, 1);
  assert.ok(sim.player.energy < 90 && sim.player.energy >= 80);
  sim.player.energy = 0;
  sim.player.skillCooldowns[0] = 0;
  sim.update(1 / 60, { skill: true });
  assert.equal(sim.drainEvents().filter(event => event.type === 'action').length, 0);
});

test('projectiles travel and strike rather than instantly damaging distant targets', () => {
  const sim = make(); const foe = sim.foes[0];
  foe.x = 0; foe.z = 1; foe.aiTimer = 100; foe.aiSkillTimer = 100;
  sim.update(1 / 60, { skill2: true });
  assert.equal(foe.hp, 1000);
  advance(sim, .25);
  assert.ok(sim.projectiles.length > 0);
  advance(sim, .6);
  assert.ok(foe.hp < 1000);
});

test('rain shows a telegraph and resolves delayed ground impacts', () => {
  const sim = make(); const foe = closeEnemy(sim);
  sim.update(1 / 60, { skill2: true, x: 1 });
  advance(sim, .25);
  assert.ok(sim.effects.some(effect => effect.kind === 'telegraph'));
  assert.equal(foe.hp, 1000);
  advance(sim, 1.2);
  assert.ok(foe.hp < 1000);
});

test('a front guard reduces damage, spends energy, and does not protect the back', () => {
  const sim = make(); const foe = closeEnemy(sim);
  sim.player.guarding = true; sim.player.facing = Math.PI;
  const front = sim.damage(foe, sim.player, 100);
  assert.ok(front < 15);
  assert.equal(sim.player.energy, 97);
  foe.z = sim.player.z + 2;
  const back = sim.damage(foe, sim.player, 100);
  assert.ok(back > front * 3);
});

test('dodge provides a short immunity window and cannot be spammed without cost', () => {
  const sim = make(); const foe = closeEnemy(sim);
  sim.update(1 / 60, { dash: true, x: 1 });
  const health = sim.player.hp;
  sim.damage(foe, sim.player, 100);
  assert.equal(sim.player.hp, health);
  assert.ok(sim.player.energy < 90);
  advance(sim, .5, { dash: true, x: 1 });
  assert.equal(sim.drainEvents().filter(event => event.action === 'dodge').length, 1);
  assert.ok(sim.player.x > 4);
});

test('healing is capped and requires energy, injury, and cooldown availability', () => {
  const sim = make(); sim.player.hp = 950;
  sim.update(1 / 60, { heal: true });
  assert.equal(sim.player.hp, 1000);
  assert.ok(sim.player.energy < 66);
  sim.player.hp = 500;
  advance(sim, 1, { heal: true });
  assert.equal(sim.player.hp, 500);
});

test('ultimate requires a full gauge and consumes it', () => {
  const sim = make(); const foe = closeEnemy(sim, 5000);
  sim.update(1 / 60, { over: true });
  assert.equal(sim.drainEvents().filter(event => event.action === 'over').length, 0);
  sim.player.ultimate = 100;
  sim.update(1 / 60, { over: true });
  assert.equal(sim.player.ultimate, 0);
  advance(sim, 1);
  assert.ok(foe.hp <= 4800);
});

test('walls and obstacles remain impassable during movement', () => {
  const sim = make({ stage: 'castle' }); sim.foes[0].z = -30;
  sim.player.x = 10; sim.player.z = 8;
  advance(sim, 3, { x: 1 });
  assert.ok(sim.player.x <= 12.36);
  sim.player.x = 0; sim.player.z = 31;
  advance(sim, 2, { z: 1 });
  assert.ok(sim.player.z <= sim.bounds.maxZ - sim.player.radius);
  assert.equal(createObstacles('castle').length, 8);
});

test('deterministic seeds reproduce enemy choices and the same combat outcome', () => {
  const a = make({ difficulty: 80 }); const b = make({ difficulty: 80 });
  advance(a, 8, { skill: true, attack: true });
  advance(b, 8, { skill: true, attack: true });
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.deepEqual(a.drainEvents(), b.drainEvents());
});

test('enemy attacks announce their danger and defeat is emitted only once', () => {
  const sim = make({ difficulty: 100 }); const foe = closeEnemy(sim);
  foe.aiTimer = 0; sim.player.hp = 1;
  sim.update(1 / 60, {});
  assert.ok(sim.effects.some(effect => effect.kind === 'telegraph'));
  assert.equal(sim.player.hp, 1);
  advance(sim, 2);
  assert.equal(sim.status, 'defeat');
  assert.equal(sim.drainEvents().filter(event => event.type === 'defeat').length, 1);
  advance(sim, 1);
  assert.equal(sim.drainEvents().length, 0);
});

test('a successful hit interrupts a telegraphed melee attack', () => {
  const sim = make({ difficulty: 50 }); const foe = closeEnemy(sim);
  foe.aiTimer = 0;
  sim.update(1 / 60, {});
  assert.ok(sim.pending.some(action => action.source === foe && action.kind === 'melee'));
  sim.update(1 / 60, { attack: true });
  advance(sim, .25);
  assert.equal(sim.pending.some(action => action.source === foe && action.kind === 'melee'), false);
  advance(sim, .7);
  assert.equal(sim.player.hp, 1000);
});

test('enemy navigation can skirt a column on a direct pursuit path', () => {
  const sim = make({ stage: 'castle', difficulty: 80 });
  sim.player.x = 14; sim.player.z = 3;
  const foe = sim.foes[0]; foe.x = 14; foe.z = 13;
  foe.aiTimer = 1000; foe.aiSkillTimer = 1000;
  advance(sim, 6);
  assert.ok(Math.hypot(foe.x - sim.player.x, foe.z - sim.player.z) < 4);
  assert.equal(sim.blocked(foe.x, foe.z, foe.radius - .001), false);
});
