// Painted environment art shared by stages with the same landscape.
const VERSION = '20261106-stage1';
const DEFINITIONS = [
  ['moon', '双月の闘技場', '#a5bce7'],
  ['desert', '砂漠の遺跡', '#d7a66e'],
  ['frost', '氷雪の書架', '#9bd9eb'],
  ['bamboo', '夜の竹林', '#9fc78f'],
  ['heaven', '天空の聖堂', '#e0c889'],
  ['ember', '火山の祭壇', '#e1a17e'],
  ['void', '月影の回廊', '#b3a1dc'],
  ['lakeside', '湖畔', '#8bbfc5'],
  ['temple', '神殿', '#d5c195'],
  ['fortress', '砦', '#b7b5af'],
  ['canyon', '峡谷', '#d5a17b'],
  ['cloudsea', '雲海', '#b7cde1'],
  ['graveyard', '墓所', '#b0a8c0'],
  ['garden', '花園', '#d2b6bb'],
  ['mine', '鉱山', '#a3bacb'],
  ['harbor', '港', '#92b7ca'],
  ['corridor', '回廊', '#bdb1d4']
];

const ART = Object.fromEntries(DEFINITIONS.map(([biome, label, accent]) => [biome, Object.freeze({
  src: `assets/stages/${biome}.webp?v=${VERSION}`, biome, label, accent
})]));

export const STAGE_ART_CATEGORIES = Object.freeze(DEFINITIONS.map(([biome, label]) => Object.freeze({biome, label})));
const BASE_IDS = new Set(DEFINITIONS.slice(0, 7).map(([id]) => id));
const TERRAIN_SUFFIXES = DEFINITIONS.slice(7).map(([id, label]) => [label, id]);
const SKY_FALLBACKS = [
  ['bamboo', 'bamboo'], ['frost', 'frost'], ['heaven', 'heaven'], ['desert', 'desert']
];

/** Every stage resolves to a real landscape illustration, including random selection. */
export function getStageArt(stage) {
  if (!stage || stage.id === 'random') return {...ART.moon, biome: 'random', label: '風まかせ'};
  let key = BASE_IDS.has(stage.id) ? stage.id : '';
  if (!key) {
    const name = String(stage.name || '');
    key = TERRAIN_SUFFIXES.find(([suffix]) => name.endsWith(suffix))?.[1] || '';
  }
  if (!key) key = SKY_FALLBACKS.find(([part]) => String(stage.sky || '').includes(part))?.[1] || 'moon';
  const art = ART[key];
  // Keep the stage's real crystal colour in its card trim; do not recolour the painting.
  const accent = Number.isInteger(stage.crystal) && stage.crystal >= 0 && stage.crystal <= 0xffffff
    ? '#' + stage.crystal.toString(16).padStart(6, '0') : art.accent;
  return {...art, accent};
}
