// Arkeia combat exclamations. Short generated vocal effects replace robotic
// long-form speech synthesis; audio stays separate from BGM / combat SFX.
// No voice is synthesized from private player text.
const VOICE_ROOT = './assets/voices/';
const CLIPS = {
  attack: 3, skill: 3, over: 2, hurt: 2, pinch: 2,
  ko: 2, summon: 2, awaken: 2, hi: 2
};
const active = new Set();
const lastByCharacter = new Map();
let muted = false;
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
export function setVoiceMuted(value) {
  muted = !!value;
  if (muted) stopVoices();
}
export function stopVoices() {
  for (const el of [...active]) stopElement(el);
}
export function sayBattle(f, kind = 'skill', _attackName = '', important = false) {
  if (!enabled || muted || typeof Audio === 'undefined' || !f) return;
  const cue = Object.prototype.hasOwnProperty.call(CLIPS, kind) ? kind : 'skill';
  const owner = String(f.key || f.def?.name || f.name || 'player');
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
  element.volume = Math.max(0.06, Math.min(1, (player ? 0.54 : important ? 0.32 : 0.22) * (cue === 'ko' ? 1.04 : 1)));
  element.playbackRate = 0.91 + (hash(owner) % 19) / 100 + (cue === 'over' || cue === 'hi' ? -0.04 : 0);
  element.preservesPitch = false;
  element.onended = () => active.delete(element);
  element.onerror = () => active.delete(element);
  active.add(element);
  lastByCharacter.set(owner, { t: now, i: variant });
  lastGlobal = now;
  Promise.resolve(element.play()).catch(() => active.delete(element));
}
