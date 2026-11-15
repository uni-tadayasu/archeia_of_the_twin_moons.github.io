import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SAVE_KEY, createSave, validateSave, loadSave, saveGame, applyReward, exportSave, importSave, purchaseUpgrade, boostFighter } from '../rebirth/save.mjs';
import { ROSTER, STAGES, CHAPTERS, getEncounter } from '../rebirth/catalog.mjs';

const storage = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
};
const result = overrides => ({ runId: 'run:one', mode: 'story', index: 0, kills: 1, victory: true, seconds: 30, ...overrides });

test('fresh, corrupt, unavailable and quota-limited saves recover without touching classic data', () => {
  const memory = storage();
  memory.setItem('arkeia.classic', 'unchanged');
  assert.deepEqual(loadSave(memory), createSave());
  memory.setItem(SAVE_KEY, '{broken');
  assert.deepEqual(loadSave(memory), createSave());
  assert.deepEqual(loadSave({ getItem() { throw new Error('privacy'); } }), createSave());
  assert.equal(saveGame(createSave(), { setItem() { throw new Error('quota'); } }), false);
  assert.equal(saveGame(createSave(), null), false);
  assert.equal(saveGame({ ...createSave(), nickname: '月の旅人' }, memory), true);
  assert.equal(loadSave(memory).nickname, '月の旅人');
  assert.equal(memory.getItem('arkeia.classic'), 'unchanged');
});

test('validation clamps all persisted gameplay settings and filters access-controlled fighter ids', () => {
  const save = validateSave({
    version: 1, shards: Infinity, kills: -5, storyChapter: 100, adventureStage: 200, bestFloor: 1e9,
    selectedFighter: 'chief', nickname: '\u0000', favorites: ['rowen', 'chief', 'rowen'],
    upgrades: { power: 99, vitality: -1 }, settings: { quality: 'ultra', difficulty: -5, volume: 8, sfxVolume: -2 }
  });
  assert.equal(save.shards, 0);
  assert.equal(save.kills, 0);
  assert.equal(save.storyChapter, 4);
  assert.equal(save.adventureStage, 10);
  assert.equal(save.bestFloor, 10000);
  assert.equal(save.selectedFighter, 'rowen');
  assert.deepEqual(save.favorites, ['rowen']);
  assert.deepEqual(save.upgrades, { power: 10, vitality: 0 });
  assert.equal(save.settings.difficulty, 1);
  assert.equal(save.settings.volume, 1);
  assert.equal(save.settings.sfxVolume, 0);
  assert.equal(save.settings.quality, 'balanced');
  assert.equal(save.nickname, '旅人');
  assert.deepEqual(validateSave({ version: 99 }), createSave());
});

test('a completed run receives currency and progression exactly once, including after reload', () => {
  const original = createSave();
  const paid = applyReward(original, result());
  assert.equal(original.shards, 0);
  assert.equal(paid.reward, 52);
  assert.equal(paid.state.shards, 52);
  assert.equal(paid.state.storyChapter, 1);
  assert.equal(paid.state.wins, 1);
  const memory = storage();
  saveGame(paid.state, memory);
  const duplicate = applyReward(loadSave(memory), result());
  assert.equal(duplicate.reward, 0);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.state.wins, 1);
  assert.equal(duplicate.state.shards, 52);
  assert.throws(() => applyReward(original, result({ runId: undefined })), /runId/);
});

test('only sequential victories advance chapters; defeat still rewards defeated enemies', () => {
  let state = createSave();
  state = applyReward(state, result({ runId: 'out-of-order', index: 2 })).state;
  assert.equal(state.storyChapter, 0);
  for (let chapter = 0; chapter < 4; chapter++) state = applyReward(state, result({ runId: `chapter-${chapter}`, index: chapter })).state;
  assert.equal(state.storyChapter, 4);
  state = applyReward(state, result({ runId: 'replay', index: 3 })).state;
  assert.equal(state.storyChapter, 4);
  const lost = applyReward(state, result({ runId: 'loss', mode: 'endless', index: 99, victory: false, kills: 3 }));
  assert.equal(lost.reward, 36);
  assert.equal(lost.state.bestFloor, 0);
  assert.equal(lost.state.wins, state.wins);
  const won = applyReward(lost.state, result({ runId: 'floor1', mode: 'endless', index: 0 }));
  assert.equal(won.state.bestFloor, 1);
  assert.throws(() => applyReward(state, result({ index: 4 })), RangeError);
});

test('adventure finishes at ten and backups retain idempotency receipts', () => {
  let state = createSave();
  for (let index = 0; index < 10; index++) state = applyReward(state, result({ mode: 'adventure', index, runId: `journey-${index}` })).state;
  assert.equal(state.adventureStage, 10);
  const restored = importSave(exportSave(state));
  assert.deepEqual(restored, state);
  assert.equal(applyReward(restored, result({ mode: 'adventure', index: 9, runId: 'journey-9' })).duplicate, true);
  assert.throws(() => importSave('not json'));
  assert.throws(() => importSave('{"version":1}'));
  assert.throws(() => importSave(exportSave(state).replace('arkeia-rebirth-save', 'classic-save')));
});

test('adventure carries checkpoint HP across saves, restores at the fifth rest and ignores defeated or earlier replay HP', () => {
  assert.equal(createSave().adventureHp, null);
  assert.equal(validateSave({ version: 1 }).adventureHp, null);
  assert.equal(validateSave({ version: 1, adventureHp: '0.5' }).adventureHp, null);
  assert.equal(validateSave({ version: 1, adventureHp: Infinity }).adventureHp, null);
  assert.equal(validateSave({ version: 1, adventureHp: -4 }).adventureHp, 0);
  assert.equal(validateSave({ version: 1, adventureHp: 3 }).adventureHp, 1);
  let state = applyReward(createSave(), result({ mode: 'adventure', index: 0, runId: 'hp-0', healthRatio: .63 })).state;
  assert.equal(state.adventureStage, 1);
  assert.equal(state.adventureHp, .63);
  const memory = storage();
  assert.equal(saveGame(state, memory), true);
  state = loadSave(memory);
  assert.equal(state.adventureHp, .63);
  state = applyReward(state, result({ mode: 'adventure', index: 1, runId: 'hp-loss', victory: false, healthRatio: 0 })).state;
  assert.equal(state.adventureStage, 1);
  assert.equal(state.adventureHp, .63);
  state = applyReward(state, result({ mode: 'adventure', index: 0, runId: 'hp-replay', healthRatio: 1 })).state;
  assert.equal(state.adventureHp, .63);
  for (let index = 1; index <= 4; index++) {
    state = applyReward(state, result({ mode: 'adventure', index, runId: `hp-${index}`, healthRatio: .12 })).state;
  }
  assert.equal(state.adventureStage, 5);
  assert.equal(state.adventureHp, 1);
  state = applyReward(state, result({ mode: 'adventure', index: 5, runId: 'hp-5', healthRatio: .78 })).state;
  assert.equal(state.adventureStage, 6);
  assert.equal(state.adventureHp, .78);
  assert.equal(importSave(exportSave(state)).adventureHp, .78);
  assert.equal(applyReward(state, result({ mode: 'adventure', index: 5, runId: 'hp-5', healthRatio: 1 })).state.adventureHp, .78);
});

test('upgrades charge the displayed cost once, cap at level ten, and never mutate the roster', () => {
  const original = { ...createSave(), shards: 1000 };
  const bought = purchaseUpgrade(original, 'power');
  assert.equal(bought.success, true);
  assert.equal(bought.cost, 120);
  assert.equal(bought.state.shards, 880);
  assert.equal(original.shards, 1000);
  assert.equal(purchaseUpgrade(createSave(), 'vitality').success, false);
  assert.equal(purchaseUpgrade({ ...original, upgrades: { power: 10, vitality: 0 } }, 'power').success, false);
  const fighter = ROSTER[0];
  const damage = fighter.light.dmg;
  assert.ok(boostFighter(fighter, bought.state).light.dmg > damage);
  assert.equal(fighter.light.dmg, damage);
});

test('catalogue references existing assets and preserves restricted access', () => {
  assert.equal(ROSTER.length, 14);
  for (const fighter of ROSTER) {
    assert.ok(existsSync(new URL(`../${fighter.model}`, import.meta.url)), fighter.model);
    assert.ok(existsSync(new URL(`../${fighter.face.split('?')[0]}`, import.meta.url)), fighter.face);
    assert.ok(fighter.skills.length >= 4);
    assert.ok(fighter.height >= 1 && fighter.height <= 2.1);
  }
  for (const stage of STAGES) assert.ok(existsSync(new URL(`../${stage.image}`, import.meta.url)), stage.image);
  assert.equal(CHAPTERS.length, 4);
  assert.ok(!ROSTER.find(fighter => ['chief', 'minamoto_yoritomo', 'crimson', 'tenshi'].includes(fighter.id)));
});

test('encounters are bounded, distinct and do not mutate source definitions', () => {
  const initial = JSON.stringify(ROSTER);
  assert.equal(getEncounter('story', 3).isFinal, true);
  assert.equal(getEncounter('adventure', 4).restAfter, true);
  assert.equal(getEncounter('adventure', 9).isFinal, true);
  const highFloor = getEncounter('endless', 999999);
  assert.equal(highFloor.enemies.length, 10);
  assert.ok(highFloor.enemies.every(enemy => Number.isFinite(enemy.hp)));
  assert.equal(new Set(highFloor.enemies.map(enemy => enemy.id)).size, highFloor.enemies.length);
  assert.notEqual(getEncounter('duel', 0, 'rowen').enemies[0].key, 'rowen');
  assert.equal(JSON.stringify(ROSTER), initial);
});
