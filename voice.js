// 戦闘ボイス：ブラウザの音声合成で、戦士ごとに声の高さ・速さ・声色を変えて技名を叫ぶ
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voices = [];
let muted = false;
let vol = 0.9;
function loadVoices() {
  if (!synth) return;
  const all = synth.getVoices();
  voices = all.filter((v) => /^ja/i.test(v.lang));
}
if (synth) {
  loadVoices();
  synth.addEventListener?.('voiceschanged', loadVoices);
}
function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  return h >>> 0;
}
// 戦士ごとの声の性格（決定的）
const PROFILE = new Map();
function profile(key, def) {
  if (PROFILE.has(key)) return PROFILE.get(key);
  const h = hash(key);
  const big = (def?.height || 1.8) > 2 || /斧|魔|王|鬼|竜|将/.test(def?.title || '');
  const p = {
    pitch: big ? 0.35 + (h % 30) / 100 : 0.75 + (h % 90) / 100,
    rate: 1.05 + ((h >>> 8) % 35) / 100,
    vi: (h >>> 16)
  };
  PROFILE.set(key, p);
  return p;
}
const LINES = {
  skill: ['はっ！', 'そこだ！', 'いくぞ！', '受けてみろ！', 'せいっ！'],
  over: ['これで終わりだ！', '全力でいく！', '見せてやる！', '覚悟しろ！'],
  awaken: ['力が…溢れる！', 'まだ終わらない！', '本気を見せてやる！'],
  hi: ['すべてを懸ける！', '極めし一撃、受けよ！']
};
let lastAt = 0;
// 《…》の読みがあればそちらを、無ければ技名を読む
function spokenName(name) {
  const m = /《(.+?)》/.exec(name);
  return (m ? m[1] : name).replace(/[・・]/g, ' ');
}
/**
 * kind: 'skill' | 'over' | 'awaken' | 'hi'
 * important=true の時は再生中の声を止めて割り込む
 */
export function sayBattle(f, kind, specName, important = false) {
  if (!synth || muted || !f) return;
  const now = performance.now();
  if (!important && (synth.speaking || now - lastAt < 700)) return;
  lastAt = now;
  const key = f.key || f.def?.name || f.name;
  const p = profile(key, f.def);
  const pool = LINES[kind] || LINES.skill;
  const shout = pool[hash(key + (specName || '') + Math.floor(now / 3000)) % pool.length];
  const text = kind === 'skill' || kind === 'over' || kind === 'hi' ? `${shout} ${spokenName(specName || '')}！` : shout;
  if (important) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  if (voices.length) u.voice = voices[p.vi % voices.length];
  u.pitch = Math.max(0, Math.min(2, p.pitch + (kind === 'over' || kind === 'hi' ? 0.1 : 0)));
  u.rate = Math.max(0.5, Math.min(2, p.rate + (kind === 'skill' ? 0.15 : 0)));
  u.volume = Math.max(0, Math.min(1, vol * (f.team === 0 ? 1 : 0.8)));
  synth.speak(u);
}
export function setVoiceMuted(m) {
  muted = !!m;
  if (muted) synth?.cancel();
}
export function stopVoices() {
  synth?.cancel();
}
