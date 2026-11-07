// Arkeia combat exclamations. Short generated vocal effects replace robotic
// long-form speech synthesis; audio stays separate from BGM / combat SFX.
// No voice is synthesized from private player text.
const VOICE_ROOT = './assets/voices/';
// Dedicated, pre-rendered low male synthetic lines for Valgard's spell calls.
// No device-dependent browser speech synthesis; respect the existing voice mixer.
const VALGARD_CLIPS = Object.freeze({
  astral: './assets/audio/valgard-judgment-voice.mp3',
  other: './assets/audio/valgard-other-voice.mp3',
  spear: './assets/audio/valgard-shining-spear-voice.mp3'
});
let lastValgardLineAt = -Infinity;
function playValgardLine(line = 'other', actor = null) {
  if (!enabled || muted || channelVolume <= 0 || typeof Audio === 'undefined') return false;
  const now = timeNow();
  if (now - lastValgardLineAt < (line === 'spear' ? 260 : 820)) return false;
  const url = VALGARD_CLIPS[line === 'astral' ? 'astral' : line === 'spear' ? 'spear' : 'other'];
  const sound = new Audio(url);
  sound.preload = 'auto';
  sound.volume = Math.min(1, (actor?.isPlayer === false ? 0.62 : 0.94) * channelVolume);
  sound.playbackRate = 1;
  sound.preservesPitch = true;
  sound.onended = () => active.delete(sound);
  sound.onerror = () => active.delete(sound);
  // Prevent overlapping Valgard lines while keeping other fighters' voices.
  for (const prev of [...active]) if (prev.__arkeiaValgardLine) stopElement(prev);
  sound.__arkeiaValgardLine = true;
  active.add(sound);
  lastValgardLineAt = now;
  lastGlobal = now;
  Promise.resolve(sound.play()).catch(() => active.delete(sound));
  return true;
}
// The ice seal and ice echo are actions added by arkeia-ui.js, not skill slots.
// Expose a narrow, voice-settings-aware call for those two special actions.
if (typeof window !== 'undefined') {
  window.__arkeiaPlayValgardOther = (fighter) => playValgardLine('other', fighter);
}

const CLIPS = {
  attack: 3, skill: 3, over: 2, hurt: 2, pinch: 2,
  ko: 2, summon: 2, awaken: 2, hi: 2
};
const active = new Set();
const lastByCharacter = new Map();
let muted = false;
let channelVolume = 0.75;
let enabled = true;
let lastGlobal = 0;
const MAX_ACTIVE = 4;
const globalGap = { attack: 90, skill: 130, over: 260, hi: 280, hurt: 100, ko: 120, pinch: 260, summon: 240, awaken: 220 };
function hash(text) {
  let x = 2166136261;
  for (const c of String(text || '')) x = Math.imul((x ^ c.charCodeAt(0)) >>> 0, 16777619) >>> 0;
  return x >>> 0;
}
const timeNow = () => typeof performance === 'undefined' ? Date.now() : performance.now();
const styleFor = (f) => {
  const key = f?.key || f?.def?.name || f?.name || 'unknown';
  const label = `${f?.def?.title || ''} ${f?.def?.name || ''}`;
  if (key === 'valgard' || /魔王|獣|竜王|魔神|覇王|大蛇|血魔/.test(label)) return 'v5';
  if (/女|妃|姫|巫|天后|魔女|聖女|女性|少女/.test(label)) return (hash(key) % 2) ? 'v1' : 'v2';
  if (/老|重装|巨|斧鬼|豪|王/.test(label)) return 'v4';
  return (hash(key) % 3) ? 'v3' : 'v2';
};
function stopElement(el) {
  try { el.pause(); el.currentTime = 0; } catch {}
  active.delete(el);
}
export function setVoiceVolume(value) {
  channelVolume = Math.min(1, Math.max(0, Number(value) || 0));
  if (channelVolume <= 0) stopVoices();
}
export function setVoiceMuted(value) {
  muted = !!value;
  if (muted) stopVoices();
}
export function stopVoices() {
  for (const el of [...active]) stopElement(el);
}
export function sayBattle(f, kind = 'skill', _attackName = '', important = false) {
  if (!enabled || muted || channelVolume <= 0 || typeof Audio === 'undefined' || !f) return;
  const cue = Object.prototype.hasOwnProperty.call(CLIPS, kind) ? kind : 'skill';
  const owner = String(f.key || f.def?.name || f.name || 'player');
  if (owner === 'valgard' && (cue === 'skill' || cue === 'over' || cue === 'hi')) {
    const name = String(_attackName || '');
    const isAstral = /アストラル[・･\s]*ジャッジメント|蒼天雷裁|astral[\s-]*judgment/i.test(name);
    const isSpear = /光牢剣陣|ルミナス[・･\s]*レギオン|シャイニング[・･\s]*スピア|凍牙・光槍封陣|shining[\s-]*spear/i.test(name);
    playValgardLine(isAstral ? 'astral' : isSpear ? 'spear' : 'other', f);
    return;
  }
  const now = timeNow();
  const player = !!f.isPlayer;
  const minGap = (important ? 110 : 230) + (cue === 'attack' ? 50 : 0);
  const prev = lastByCharacter.get(owner);
  if (prev && now - prev.t < minGap) return;
  if (!important && now - lastGlobal < (globalGap[cue] || 160)) return;
  if (!player && ['hurt', 'attack'].includes(cue) && ((hash(owner) + Math.floor(now / 200)) % 3) === 0) return;
  if (active.size >= MAX_ACTIVE) {
    if (!important) return;
    stopElement(active.values().next().value);
  }
  const variant = prev ? (prev.i + 1 + (hash(owner + cue) % (CLIPS[cue] - 1 || 1))) % CLIPS[cue] : hash(owner + cue) % CLIPS[cue];
  const family = styleFor(f);
  const clip = `${VOICE_ROOT}${family}/${cue}-${variant}.ogg`;
  const element = new Audio(clip);
  element.preload = 'auto';
  element.volume = Math.min(1, (player ? 0.54 : important ? 0.32 : 0.22) * (cue === 'ko' ? 1.04 : 1) * channelVolume);
  element.playbackRate = 0.91 + (hash(owner) % 19) / 100 + (cue === 'over' || cue === 'hi' ? -0.04 : 0);
  element.preservesPitch = false;
  element.onended = () => active.delete(element);
  element.onerror = () => active.delete(element);
  active.add(element);
  lastByCharacter.set(owner, { t: now, i: variant });
  lastGlobal = now;
  Promise.resolve(element.play()).catch(() => active.delete(element));
}
