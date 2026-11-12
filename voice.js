// Short combat clips. This channel is mixed separately from music and SFX.
const VOICE_ROOT = './assets/voices/';
const FALLBACK_ROOT = './assets/rf5530/voices/';
const VALGARD_CLIPS = Object.freeze({
  astral: './assets/audio/valgard-judgment-voice.mp3',
  other: './assets/audio/valgard-other-voice.mp3',
  spear: './assets/audio/valgard-shining-spear-voice.mp3'
});
const CLIPS = Object.freeze({
  attack: 3, skill: 3, over: 2, hurt: 2, pinch: 2,
  ko: 2, summon: 2, awaken: 2, hi: 2
});
const PRIORITY = Object.freeze({
  attack: 0, hurt: 0, skill: 1, pinch: 1, summon: 2,
  awaken: 2, ko: 2, over: 3, hi: 4
});
const MAX_ACTIVE = 4;
const MAX_IDLE = 12;
const idle = [];
const active = new Map();
const lastByActor = new WeakMap();
let channelVolume = .75;
let muted = false;
let useOpus;
let lastQuietCue = -Infinity;

function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
function voiceFamily(actor, key) {
  const label = `${actor.def?.title || ''} ${actor.def?.name || ''}`;
  if (key === 'valgard' || /魔王|獣|竜王|魔神|覇王|大蛇|血魔/.test(label)) return 'v5';
  if (/女|妃|姫|巫|天后|魔女|聖女/.test(label)) return hash(key) % 2 ? 'v1' : 'v2';
  if (/老|重装|巨|斧鬼|豪|王/.test(label)) return 'v4';
  return hash(key) % 3 ? 'v3' : 'v2';
}
function available() {
  return !muted && channelVolume > 0 && typeof Audio !== 'undefined' &&
    (typeof document === 'undefined' || !document.hidden);
}
function acquire(url) {
  const index = idle.findIndex(slot => slot.url === url);
  if (index !== -1) return idle.splice(index, 1)[0].element;
  const element = new Audio();
  element.preload = 'none';
  element.src = url;
  return element;
}
function release(element, ticket, keep = true) {
  if (active.get(element) !== ticket) return;
  active.delete(element);
  element.onended = null;
  element.onerror = null;
  element.pause();
  try { element.currentTime = 0; } catch {}
  if (keep) {
    if (idle.length >= MAX_IDLE) idle.shift();
    idle.push({ url: ticket.url, element });
  }
}
function play(url, actor, priority, gain, rate) {
  const previous = [...active].find(([, slot]) => slot.actor === actor);
  if (previous) {
    const [element, slot] = previous;
    if (slot.priority >= priority) return false;
    release(element, slot);
  }
  if (active.size >= MAX_ACTIVE) {
    const weakest = [...active].reduce((a, b) => a[1].priority <= b[1].priority ? a : b);
    if (weakest[1].priority >= priority) return false;
    release(...weakest);
  }
  const element = acquire(url);
  const ticket = { url, actor, priority, gain };
  active.set(element, ticket);
  element.volume = Math.min(1, gain * channelVolume);
  element.playbackRate = rate;
  element.preservesPitch = true;
  if ('webkitPreservesPitch' in element) element.webkitPreservesPitch = true;
  element.onended = () => release(element, ticket);
  element.onerror = () => release(element, ticket, false);
  try {
    Promise.resolve(element.play()).catch(() => release(element, ticket, !element.error));
  } catch {
    release(element, ticket, !element.error);
    return false;
  }
  return true;
}

export function setVoiceVolume(value) {
  channelVolume = Math.min(1, Math.max(0, Number(value) || 0));
  if (channelVolume <= 0) stopVoices();
  for (const [element, slot] of active) element.volume = Math.min(1, slot.gain * channelVolume);
}
export function setVoiceMuted(value) {
  muted = Boolean(value);
  if (muted) stopVoices();
}
export function stopVoices() {
  for (const [element, ticket] of active) release(element, ticket);
}

const systemValgard = {};
function playValgardLine(line, actor = systemValgard, priority = 3) {
  if (!available()) return false;
  const now = performance.now();
  const previous = lastByActor.get(actor);
  if (previous && now - previous.at < 320 && priority <= previous.priority) return false;
  const player = actor.isPlayer !== false;
  if (!play(VALGARD_CLIPS[line], actor, priority + Number(player), player ? .92 : .62, 1)) return false;
  lastByActor.set(actor, { at: now, cue: line, priority });
  return true;
}
if (typeof window !== 'undefined') {
  // The ice seal and echo also use the dedicated Valgard recording.
  window.__arkeiaPlayValgardOther = actor => playValgardLine('other', actor || systemValgard);
  window.addEventListener('rf564:audio-paused', stopVoices);
}

export function sayBattle(actor, kind = 'skill', attackName = '', important = false) {
  if (!available() || !actor) return;
  const cue = Object.hasOwn(CLIPS, kind) ? kind : 'skill';
  const key = String(actor.key || actor.def?.name || actor.name || 'player');
  const player = Boolean(actor.isPlayer);
  const weight = PRIORITY[cue];
  if (key === 'valgard' && ['skill', 'over', 'hi', 'summon'].includes(cue)) {
    const name = String(attackName);
    const astral = /アストラル[・･\s]*ジャッジメント|蒼天雷裁|astral[\s-]*judgment/i.test(name);
    const spear = /光牢剣陣|ルミナス[・･\s]*レギオン|シャイニング[・･\s]*スピア|凍牙・光槍封陣|shining[\s-]*spear/i.test(name);
    playValgardLine(astral ? 'astral' : spear ? 'spear' : 'other', actor, weight + 2);
    return;
  }

  const priority = weight * 2 + Number(player) + Number(important);
  const now = performance.now();
  const previous = lastByActor.get(actor);
  const gap = cue === 'attack' ? 290 : important ? 150 : 220;
  if (previous && now - previous.at < gap && priority <= previous.priority) return;
  if (!weight && now - lastQuietCue < (player ? 105 : 210)) return;
  if (!weight && !player && [...active.values()].some(slot => slot.priority >= 5)) return;

  if (useOpus === undefined) {
    const probe = new Audio();
    useOpus = Boolean(probe.canPlayType?.('audio/ogg; codecs="opus"'));
  }
  const count = CLIPS[cue];
  const signature = hash(key + cue);
  const variant = previous?.cue === cue
    ? (previous.variant + 1 + signature % (count - 1)) % count
    : signature % count;
  const root = useOpus ? VOICE_ROOT : FALLBACK_ROOT;
  const url = `${root}${voiceFamily(actor, key)}/${cue}-${variant}.${useOpus ? 'ogg' : 'mp3'}`;
  const gain = player ? (weight > 1 ? .64 : .51) : (weight > 1 ? .35 : .23);
  const rate = (weight >= 3 ? .96 : 1) + (hash(key) % 11 - 5) / 100;
  if (play(url, actor, priority, gain, rate)) {
    lastByActor.set(actor, { at: now, cue, variant, priority });
    if (!weight) lastQuietCue = now;
  }
}
