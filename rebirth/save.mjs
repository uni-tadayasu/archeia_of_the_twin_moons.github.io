// Rebirth saves never read or overwrite classic/online account data or currency.
export const SAVE_KEY = 'arkeia.rebirth.v1';
export const SAVE_VERSION = 1;
const MAX_VALUE = 999999999;
const IDS = new Set(['rowen', 'minase', 'garou', 'tsubaki', 'harlan', 'pip', 'velka', 'osric', 'noa', 'kurouga', 'rinfa', 'igna', 'petra', 'uninomiya']);
const MODES = new Set(['story', 'adventure', 'endless', 'duel']);
const QUALITIES = new Set(['low', 'balanced', 'high']);
const UPGRADE_TYPES = new Set(['vitality', 'power']);
const integer = (value, fallback = 0, max = MAX_VALUE) => Number.isFinite(value) ? Math.min(max, Math.max(0, Math.floor(value))) : fallback;
const ratio = (value, fallback) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
const text = (value, fallback, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) || fallback : fallback;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function createSave() {
  return {
    version: SAVE_VERSION, nickname: '旅人', selectedFighter: 'rowen',
    shards: 0, wins: 0, kills: 0, bestFloor: 0, storyChapter: 0, adventureStage: 0, adventureHp: null,
    favorites: [], upgrades: { vitality: 0, power: 0 },
    settings: { quality: 'balanced', volume: .5, sfxVolume: .7, difficulty: 50, reducedMotion: false },
    completedRuns: [], history: [], updatedAt: 0
  };
}

export function validateSave(input) {
  const fallback = createSave();
  if (!record(input) || (input.version !== undefined && input.version !== SAVE_VERSION)) return fallback;
  const settings = record(input.settings) ? input.settings : {};
  const upgrades = record(input.upgrades) ? input.upgrades : {};
  const completedRuns = Array.isArray(input.completedRuns)
    ? [...new Set(input.completedRuns.filter(id => typeof id === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(id)))].slice(-4096) : [];
  return {
    version: SAVE_VERSION,
    nickname: text(input.nickname, '旅人', 16),
    selectedFighter: IDS.has(input.selectedFighter) ? input.selectedFighter : 'rowen',
    shards: integer(input.shards), wins: integer(input.wins), kills: integer(input.kills),
    bestFloor: integer(input.bestFloor, 0, 10000),
    storyChapter: integer(input.storyChapter, 0, 4),
    adventureStage: integer(input.adventureStage, 0, 10),
    adventureHp: ratio(input.adventureHp, null),
    favorites: Array.isArray(input.favorites) ? [...new Set(input.favorites.filter(id => IDS.has(id)))].slice(0, 14) : [],
    upgrades: { vitality: integer(upgrades.vitality, 0, 10), power: integer(upgrades.power, 0, 10) },
    settings: {
      quality: QUALITIES.has(settings.quality) ? settings.quality : 'balanced',
      volume: ratio(settings.volume, .5), sfxVolume: ratio(settings.sfxVolume, .7),
      difficulty: Math.max(1, integer(settings.difficulty, 50, 100)),
      reducedMotion: settings.reducedMotion === true
    },
    completedRuns,
    history: Array.isArray(input.history) ? input.history.filter(item => record(item) && MODES.has(item.mode))
      .slice(-20).map(item => ({
        mode: item.mode, index: integer(item.index, 0, 9999), victory: item.victory === true,
        kills: integer(item.kills, 0, 1000), reward: integer(item.reward, 0, 100000),
        seconds: integer(item.seconds, 0, 86400), at: integer(item.at, 0, Number.MAX_SAFE_INTEGER)
      })) : [],
    updatedAt: integer(input.updatedAt, 0, Number.MAX_SAFE_INTEGER)
  };
}

function defaultStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function loadSave(storage) {
  try {
    const target = storage === undefined ? defaultStorage() : storage;
    const raw = target?.getItem(SAVE_KEY);
    if (!raw || raw.length > 2_000_000) return createSave();
    return validateSave(JSON.parse(raw));
  } catch { return createSave(); }
}

/** False means progress is still in memory, but the browser refused persistence. */
export function saveGame(data, storage) {
  try {
    const target = storage === undefined ? defaultStorage() : storage;
    if (!target || typeof target.setItem !== 'function') return false;
    target.setItem(SAVE_KEY, JSON.stringify({ ...validateSave(data), updatedAt: Date.now() }));
    return true;
  } catch { return false; }
}

/** Apply one completed encounter. The same runId cannot pay out twice. */
export function applyReward(input, result) {
  const state = validateSave(input);
  if (!record(result) || !MODES.has(result.mode)) throw new TypeError('Invalid battle result');
  if (typeof result.runId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,120}$/.test(result.runId)) throw new TypeError('A unique runId is required');
  if (state.completedRuns.includes(result.runId)) return { state, reward: 0, duplicate: true };
  const index = integer(result.index, 0, 9999);
  if ((result.mode === 'story' && index > 3) || (result.mode === 'adventure' && index > 9)) throw new RangeError('Invalid encounter index');
  const kills = integer(result.kills, 0, 1000);
  const victory = result.victory === true;
  const reward = Math.min(100000, kills * 12 + (victory ? 40 + Math.min(index, 100) * 8 : 0));
  state.shards = Math.min(MAX_VALUE, state.shards + reward);
  state.kills = Math.min(MAX_VALUE, state.kills + kills);
  if (victory) {
    state.wins = Math.min(MAX_VALUE, state.wins + 1);
    if (result.mode === 'story' && index === state.storyChapter) state.storyChapter = Math.min(4, index + 1);
    if (result.mode === 'adventure' && index === state.adventureStage) {
      state.adventureStage = Math.min(10, index + 1);
      // Keep HP with its checkpoint; replaying earlier nodes must not heal or
      // damage the saved continuation. Node five is the full-rest checkpoint.
      state.adventureHp = index === 4 ? 1 : ratio(result.healthRatio, null);
    }
    if (result.mode === 'endless') state.bestFloor = Math.max(state.bestFloor, index + 1);
  }
  state.completedRuns = [...state.completedRuns, result.runId].slice(-4096);
  state.updatedAt = Date.now();
  state.history = [...state.history, {
    mode: result.mode, index, victory, kills, reward,
    seconds: integer(result.seconds, 0, 86400), at: state.updatedAt
  }].slice(-20);
  return { state, reward, duplicate: false };
}

export function upgradeCost(level) {
  const current = integer(level, 0, 10);
  return current >= 10 ? null : 120 + current * 100;
}

export function purchaseUpgrade(input, type) {
  const state = validateSave(input);
  if (!UPGRADE_TYPES.has(type)) return { state, success: false, reason: '強化項目が見つかりません。' };
  const cost = upgradeCost(state.upgrades[type]);
  if (cost === null) return { state, success: false, reason: '最大まで強化しています。' };
  if (state.shards < cost) return { state, success: false, reason: '灯晶が足りません。' };
  state.shards -= cost;
  state.upgrades[type] += 1;
  state.updatedAt = Date.now();
  return { state, success: true, cost };
}

export function boostFighter(fighter, input) {
  const state = validateSave(input);
  const definition = JSON.parse(JSON.stringify(fighter));
  definition.hp = Math.round(definition.hp * (1 + state.upgrades.vitality * .05));
  const power = 1 + state.upgrades.power * .04;
  for (const skill of [definition.light, ...definition.skills, definition.over, definition.hi].filter(Boolean)) {
    if (skill.dmg) skill.dmg = Math.round(skill.dmg * power);
    if (skill.finalDmg) skill.finalDmg = Math.round(skill.finalDmg * power);
  }
  return definition;
}

export function exportSave(state) {
  return JSON.stringify({ format: 'arkeia-rebirth-save', version: SAVE_VERSION, savedAt: new Date().toISOString(), data: validateSave(state) }, null, 2);
}

export function importSave(raw) {
  if (typeof raw !== 'string' || raw.length > 2_000_000) throw new Error('セーブファイルの形式またはサイズが不正です。');
  let backup;
  try { backup = JSON.parse(raw); } catch { throw new Error('セーブファイルを読み取れませんでした。'); }
  if (!record(backup) || backup.format !== 'arkeia-rebirth-save' || backup.version !== SAVE_VERSION || !record(backup.data) || backup.data.version !== SAVE_VERSION) {
    throw new Error('双月のアルケイア Rebirth のセーブファイルを選んでください。');
  }
  return validateSave(backup.data);
}
