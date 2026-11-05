import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Battle, ARENA_R } from './game.js';
import { FIGHTERS, STORY, ROSTER, UPGRADES, MAX_LV, STAGES, BGM, APEX_BGM, ENEMY_ROSTER, UPG_CAP, WEAPONS, ARMORS, STAT_LABEL, SPECIAL_KEYS } from './data.js';
import { ProcMusic } from './music.js';
import { OPERATOR_KEY_SHA256, CHIEF_KEY_SHA256, MAX_KEY_ATTEMPTS, LOCKOUT_MS, SHOP_ITEMS } from './config.js';
import { connect, issueInvite, redeemInvite, syncPush, syncPull } from './net.js';

const $ = (s) => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ---------- Renderer / scene ----------
const container = $('#game-container');
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b1d3a);
scene.fog = new THREE.Fog(0x2a2850, 30, 80);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 9, 14);

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
window.visualViewport?.addEventListener('resize', onResize);

const hemi = new THREE.HemisphereLight(0xcfd8ff, 0x3a2a40, 0.9);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xfff0d8, 2.2);
moon.position.set(8, 16, 6);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 });
scene.add(moon);
scene.add(moon.target);

const texLoader = new THREE.TextureLoader();
const floorTex = texLoader.load('assets/arena-floor.webp');
floorTex.colorSpace = THREE.SRGBColorSpace;
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(6, 6);

// ---------- Stages ----------
const skyCache = {};
let wantSky = '';
function setSky(url) {
  wantSky = url;
  const apply = (tex) => {
    if (wantSky === url) {
      scene.background = tex;
      scene.environment = tex;
    }
  };
  if (skyCache[url]) {
    apply(skyCache[url]);
    return;
  }
  texLoader.loadAsync(url).then((tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    skyCache[url] = tex;
    apply(tex);
  }).catch(() => {});
}

let arena = null;
let crystals = [];
let currentStage = null;
function pillarGeo(shape, h) {
  if (shape === 'box') return new THREE.BoxGeometry(1.1, h, 1.1);
  if (shape === 'spire') return new THREE.ConeGeometry(0.9, h * 1.5, 6);
  if (shape === 'bamboo') return new THREE.CylinderGeometry(0.16, 0.18, h * 2.4, 8);
  return new THREE.CylinderGeometry(0.5, 0.65, h, 8);
}
function crystalGeo(shape) {
  if (shape === 'ico') return new THREE.IcosahedronGeometry(0.45, 0);
  if (shape === 'torus') return new THREE.TorusGeometry(0.45, 0.1, 6, 20);
  return new THREE.OctahedronGeometry(0.45);
}
function setStage(st) {
  if (currentStage === st) {
    return;
  }
  currentStage = st;
  if (arena) {
    scene.remove(arena);
    arena.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
  arena = new THREE.Group();
  crystals = [];
  const outer = (ARENA_R + 1.6) / Math.cos(Math.PI / st.seg);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(outer, st.seg), new THREE.MeshStandardMaterial({ map: floorTex, color: st.floor, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  arena.add(floor);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(outer, 0.16, 6, st.seg), new THREE.MeshStandardMaterial({ color: st.rim, metalness: 0.7, roughness: 0.3, emissive: st.crystal, emissiveIntensity: 0.25 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.06;
  arena.add(rim);
  const stone = new THREE.MeshStandardMaterial({ color: st.pillar, roughness: 0.85 });
  const cMat = new THREE.MeshStandardMaterial({ color: st.crystal, emissive: st.crystal, emissiveIntensity: 0.9, roughness: 0.2 });
  const n = st.pshape === 'bamboo' ? 18 : 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const h = 3 + (i % 3) * 1.2;
    const geo = pillarGeo(st.pshape, h);
    const p = new THREE.Mesh(geo, stone);
    geo.computeBoundingBox();
    const ph = geo.boundingBox.max.y - geo.boundingBox.min.y;
    const rr = outer + 2 + (st.pshape === 'bamboo' ? (i % 2) * 1.5 : 0);
    p.position.set(Math.cos(a) * rr, ph / 2, Math.sin(a) * rr);
    p.castShadow = true;
    arena.add(p);
    if (i % (st.pshape === 'bamboo' ? 2 : 1) === 0) {
      const c = new THREE.Mesh(crystalGeo(st.cshape), cMat);
      c.position.set(p.position.x, ph + 0.9, p.position.z);
      arena.add(c);
      crystals.push(c);
    }
  }
  scene.add(arena);
  scene.fog.color.set(st.fog);
  hemi.color.set(st.hemi);
  moon.color.set(st.sun);
  setSky(st.sky);
}
const stageById = (id) => STAGES.find((s) => s.id === id) || STAGES[0];
setStage(STAGES[0]);

// ---------- Assets ----------
const assets = {};
const gltfLoader = new GLTFLoader();
const modelUrls = [...new Set(Object.values(FIGHTERS).map((d) => d.model))];
const byUrl = {};
const loadPromise = Promise.allSettled(modelUrls.map((url) =>
  gltfLoader.loadAsync(url).then((g) => {
    byUrl[url] = g;
  })
)).then(() => {
  for (const [k, d] of Object.entries(FIGHTERS)) {
    if (byUrl[d.model]) assets[k] = byUrl[d.model];
  }
  $('#loading').textContent = '';
});

// ---------- Save ----------
const SAVE_KEY = 'arkeia-save-v1';
const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));
function loadSave() {
  let raw = {};
  try {
    raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') || {};
  } catch {
    raw = {};
  }
  const s = { shards: clampInt(raw.shards, 0, 999999), chapter: clampInt(raw.chapter, 0, STORY.length), upg: {} };
  for (const k of Object.keys(FIGHTERS)) {
    const src = raw.upg?.[k];
    if (!src || typeof src !== 'object') continue;
    for (const u of UPGRADES) {
      const v = clampInt(src[u.id], 0, MAX_LV);
      if (v) (s.upg[k] ||= {})[u.id] = v;
    }
  }
  const wids = new Set(WEAPONS.map((w) => w.id));
  const aids = new Set(ARMORS.map((w) => w.id));
  s.owned = Array.isArray(raw.owned) ? raw.owned.filter((id) => wids.has(id) || aids.has(id)) : [];
  s.equip = {};
  s.armor = {};
  for (const k of Object.keys(FIGHTERS)) {
    const id = raw.equip?.[k];
    if (wids.has(id) && s.owned.includes(id)) s.equip[k] = id;
    const ai = raw.armor?.[k];
    if (aids.has(ai) && s.owned.includes(ai)) s.armor[k] = ai;
  }
  s.diff = raw.diff == null ? 1 : clampInt(raw.diff, 0, 3);
  s.chars = Array.isArray(raw.chars) ? raw.chars.filter((k) => FIGHTERS[k]?.shop) : [];
  s.party = Array.isArray(raw.party) ? raw.party.filter((k) => FIGHTERS[k]).slice(0, 4) : [];
  s.main = FIGHTERS[raw.main] ? raw.main : null;
  s.pid = raw.pid;
  s.friends = raw.friends;
  s.uname = raw.uname;
  s.noHero = !!raw.noHero;
  s.awk = clampInt(raw.awk, 0, 99);
  return s;
}
const save = loadSave();
// 世界でのあなたの印（端末ごとに固定）とフレンド
if (typeof save.pid !== 'string' || !/^[a-z0-9]{8,24}$/.test(save.pid)) save.pid = (Math.random().toString(36).slice(2) + Date.now().toString(36)).slice(0, 16);
if (!Array.isArray(save.friends)) save.friends = [];
save.friends = save.friends.filter((f) => f && typeof f.pid === 'string').slice(0, 100).map((f) => ({ pid: String(f.pid).slice(0, 24), name: String(f.name || '旅人').replace(/[<>&"']/g, '').slice(0, 12) }));
if (typeof save.uname !== 'string') save.uname = '';
const lvOf = (k, id) => save.upg[k]?.[id] || 0;
// 100種の強化を戦闘用の5能力（段換算）にまとめる
function upgFor(k) {
  const out = { hp: 0, atk: 0, def: 0, flux: 0, over: 0 };
  for (const u of UPGRADES) out[u.stat] += lvOf(k, u.id) * u.w;
  for (const s in out) out[s] = Math.min(UPG_CAP[s], out[s]);
  const w = WEAPONS.find((x) => x.id === save.equip[k]);
  if (w) for (const s in w.bonus) out[s] += w.bonus[s];
  const a = ARMORS.find((x) => x.id === save.armor[k]);
  if (a) for (const s in a.bonus) out[s] += a.bonus[s];
  out.def = Math.min(18, out.def);
  return out;
}
// 装備の見た目（戦闘・ワールド用）
const gearFor = (k) => ({ w: save.equip[k] || '', a: save.armor[k] || '' });
function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (err) {
    console.warn(err);
  }
}
persist(); // 世界の印（pid）を確定させる
{
  const cy = document.getElementById('copy-year');
  if (cy) cy.textContent = String(new Date().getFullYear());
}

// ---------- Audio ----------
const audio = {
  muted: localStorage.getItem('arkeia-muted') === '1',
  tracks: {},
  current: null,
  pools: {},
  ctx: null,
  unlocked: false
};
for (const name of ['title', 'story', 'battle', 'boss']) {
  const a = new Audio(`assets/audio/${name}-theme.mp3`);
  a.loop = true;
  a.preload = 'none';
  a.volume = 0.35;
  audio.tracks[name] = a;
}
function pool(name, url, n) {
  audio.pools[name] = { list: Array.from({ length: n }, () => new Audio(url)), i: 0 };
}
pool('hit', 'assets/audio/hit-impact.mp3', 4);
pool('burst', 'assets/audio/arte-burst.mp3', 2);
let proc = null;
function startProc() {
  const m = /^(bgm|field|apex):(\d+)$/.exec(audio.current || '');
  if (!m || !audio.ctx || audio.muted) return;
  proc ||= new ProcMusic(audio.ctx);
  const n = +m[2];
  if (m[1] === 'apex') {
    proc.play(APEX_BGM[n] || APEX_BGM[1]);
    return;
  }
  // フィールド用：壮大な冒険曲（金管・聖歌隊を必ず入れ、ゆったり力強いテンポ）
  proc.play(m[1] === 'field' ? { seed: 50021 + n * 131, bpm: 104 + (n % 6) * 4, epic: true } : BGM[n % BGM.length]);
}
function playTrack(name) {
  if (audio.current === name) {
    return;
  }
  const old = audio.tracks[audio.current];
  old?.pause();
  proc?.stop();
  audio.current = name;
  const t = audio.tracks[name];
  if (t && audio.unlocked && !audio.muted) {
    t.currentTime = 0;
    t.play().catch(() => {});
  }
  if (audio.unlocked) startProc();
}
function blip(freq) {
  if (!audio.ctx) {
    return;
  }
  const o = audio.ctx.createOscillator();
  const g = audio.ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, audio.ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq * 2, audio.ctx.currentTime + 0.15);
  g.gain.setValueAtTime(0.12, audio.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + 0.25);
  o.connect(g).connect(audio.ctx.destination);
  o.start();
  o.stop(audio.ctx.currentTime + 0.26);
}
// ---- 技の効果音：snd番号(0-99)と属性から100通りの音を合成 ----
let noiseBuf = null;
function noiseSrc(ctx) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}
// 効果音の共通出力：コンプ＋リバーブで迫力と広がりを出す
let sfxChain = null;
function sfxBus(ctx) {
  if (sfxChain) return sfxChain;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 5;
  comp.attack.value = 0.002;
  comp.release.value = 0.15;
  const master = ctx.createGain();
  master.gain.value = 1.1;
  comp.connect(master).connect(ctx.destination);
  const dry = ctx.createGain();
  dry.connect(comp);
  const verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 1.6);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  verb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  wet.connect(verb).connect(comp);
  sfxChain = { dry, wet };
  return sfxChain;
}
const ELEM_BASE = [160, 1200, 900, 520, 70, 880, 110, 300, 240, 200];
const ELEM_NOISE = [0.7, 0.25, 0.5, 0.8, 0.9, 0.1, 0.4, 0.6, 0.35, 0.5];
function skillSfx(id, elem) {
  const ctx = audio.ctx;
  if (!ctx) return;
  const p = (k) => {
    const x = Math.sin((id + 1) * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const t0 = ctx.currentTime;
  const dur = 0.35 + p(1) * 0.55;
  const base = ELEM_BASE[elem % 10] * (0.6 + p(2) * 0.9);
  const end = base * [0.25, 0.5, 1.6, 3][Math.floor(p(3) * 4)];
  const bus = sfxBus(ctx);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.3, t0 + 0.006 + p(4) * 0.03);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const pan = ctx.createStereoPanner();
  pan.pan.value = (p(12) - 0.5) * 0.5;
  out.connect(pan).connect(bus.dry);
  pan.connect(bus.wet);
  // 重低音のインパクト（ドスッ）
  const th = ctx.createOscillator();
  const tg = ctx.createGain();
  th.frequency.setValueAtTime(elem === 4 ? 120 : 160, t0);
  th.frequency.exponentialRampToValueAtTime(38, t0 + 0.25);
  tg.gain.setValueAtTime(0.55, t0);
  tg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
  th.connect(tg).connect(bus.dry);
  th.start(t0);
  th.stop(t0 + 0.32);
  // 風切り（シュッ）
  const w = noiseSrc(ctx);
  const wf = ctx.createBiquadFilter();
  wf.type = 'bandpass';
  wf.Q.value = 1.5;
  wf.frequency.setValueAtTime(600, t0);
  wf.frequency.exponentialRampToValueAtTime(5000 + p(13) * 3000, t0 + 0.15);
  const wg = ctx.createGain();
  wg.gain.setValueAtTime(0.25, t0);
  wg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
  w.connect(wf).connect(wg).connect(pan);
  w.start(t0, Math.random() * 0.5);
  w.stop(t0 + 0.22);
  // 光・氷・雷にはきらめく高音を重ねる
  if (elem === 1 || elem === 2 || elem === 5) {
    for (let k = 0; k < 3; k++) {
      const s = ctx.createOscillator();
      const sg = ctx.createGain();
      s.type = 'sine';
      s.frequency.value = base * 4 * (1 + k * 0.5);
      const st = t0 + 0.03 + k * 0.05;
      sg.gain.setValueAtTime(0.0001, st);
      sg.gain.exponentialRampToValueAtTime(0.08, st + 0.01);
      sg.gain.exponentialRampToValueAtTime(0.0001, st + 0.4);
      s.connect(sg).connect(bus.wet);
      s.start(st);
      s.stop(st + 0.42);
    }
  }
  const waves = ['sine', 'square', 'sawtooth', 'triangle'];
  const voices = 1 + (id % 3);
  const ratios = [1, 1.5, 2, 1.25, 0.5, 2.5];
  for (let v = 0; v < voices; v++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = waves[(id + v) % 4];
    const r = ratios[(Math.floor(id / 3) + v) % ratios.length];
    o.frequency.setValueAtTime(base * r, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, end * r), t0 + dur);
    if (p(5) > 0.5) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 6 + p(6) * 30;
      lg.gain.value = base * 0.08 * r;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur);
    }
    g.gain.value = (o.type === 'square' || o.type === 'sawtooth' ? 0.35 : 0.7) / voices;
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  const na = ELEM_NOISE[elem % 10] * (0.5 + p(7));
  if (na > 0.15) {
    const n = noiseSrc(ctx);
    const f = ctx.createBiquadFilter();
    f.type = ['bandpass', 'lowpass', 'highpass'][Math.floor(p(8) * 3)];
    f.frequency.setValueAtTime(300 + p(9) * 4000, t0);
    f.frequency.exponentialRampToValueAtTime(100 + p(10) * 2000, t0 + dur);
    f.Q.value = 0.7 + p(11) * 6;
    const ng = ctx.createGain();
    ng.gain.value = na * 0.6;
    n.connect(f).connect(ng).connect(out);
    n.start(t0, Math.random() * 0.5);
    n.stop(t0 + dur + 0.02);
  }
}
function sfx(name, spec) {
  if (audio.muted) {
    return;
  }
  if (name === 'skill' && spec && spec.snd != null) {
    skillSfx(spec.snd, spec.elem ?? 0);
    return;
  }
  if (name === 'laser') {
    skillSfx(37, 0);
    return;
  }
  if (name === 'zap') {
    skillSfx(23, 2);
    return;
  }
  if (name === 'skill' || name === 'ui') {
    blip(name === 'ui' ? 520 : 330);
    return;
  }
  if (name === 'hit' && audio.ctx) {
    // 打撃音に重低音とクラック音を重ねて手応えを強化
    const ctx = audio.ctx, bus = sfxBus(ctx), t0 = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(130, t0);
    o.frequency.exponentialRampToValueAtTime(42, t0 + 0.12);
    g.gain.setValueAtTime(0.45, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
    o.connect(g).connect(bus.dry);
    o.start(t0);
    o.stop(t0 + 0.16);
    const n = noiseSrc(ctx), f = ctx.createBiquadFilter(), ng = ctx.createGain();
    f.type = 'highpass';
    f.frequency.value = 2500;
    ng.gain.setValueAtTime(0.3, t0);
    ng.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
    n.connect(f).connect(ng).connect(bus.dry);
    ng.connect(bus.wet);
    n.start(t0, Math.random() * 0.5);
    n.stop(t0 + 0.07);
  }
  const p = audio.pools[name];
  if (!p) {
    return;
  }
  const a = p.list[p.i++ % p.list.length];
  a.currentTime = 0;
  a.volume = name === 'hit' ? 0.5 : 0.7;
  a.play().catch(() => {});
}
function unlockAudio() {
  if (!audio.ctx) {
    audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  audio.unlocked = true;
  audio.ctx.resume?.();
  const t = audio.tracks[audio.current];
  if (t && !audio.muted && t.paused) {
    t.play().catch(() => {});
  }
  if (!proc?.playing) startProc();
}
function setMuted(m) {
  audio.muted = m;
  localStorage.setItem('arkeia-muted', m ? '1' : '0');
  const t = audio.tracks[audio.current];
  if (m) {
    t?.pause();
    proc?.stop();
  } else if (audio.unlocked) {
    t?.play().catch(() => {});
    startProc();
  }
  $('#opt-mute').textContent = m ? '音：黙らせる' : '音：鳴らす';
}
setMuted(audio.muted);

// ---------- Input ----------
const keys = new Set();
const edges = { attack: false, skill: false, skill2: false, over: false, jump: false };
const touchState = { mx: 0, mz: 0, guard: false };
const padState = { mx: 0, mz: 0, guard: false };
const KEYMAP = { KeyJ: 'attack', KeyZ: 'attack', KeyK: 'skill', KeyX: 'skill', KeyU: 'skill2', KeyV: 'skill2', KeyL: 'over', KeyC: 'over', Space: 'jump' };

function inBattleView() {
  return (!!state.battle || !!state.field) && !document.querySelector('.screen.on');
}

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') {
    if (e.code === 'Escape') {
      e.target.blur();
    }
    return;
  }
  if (isScreen('scr-press')) {
    enterTitle();
    return;
  }
  if (e.code === 'Escape') {
    goBackCurrent();
    return;
  }
  if (inBattleView() && !e.repeat && KEYMAP[e.code]) {
    edges[KEYMAP[e.code]] = true;
  }
  if (isScreen('scr-story') && (e.code === 'Enter' || e.code === 'Space')) {
    advanceDialogue();
  }
  keys.add(e.code);
  if (e.code === 'Space' && inBattleView()) {
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('mousedown', (e) => {
  if (!inBattleView()) {
    return;
  }
  if (e.button === 0) {
    edges.attack = true;
  }
  if (e.button === 2) {
    edges.skill = true;
  }
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

function readInput() {
  let mx = touchState.mx + padState.mx;
  let mz = touchState.mz + padState.mz;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  const inp = {
    mx, mz,
    guard: touchState.guard || padState.guard || keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyI'),
    ...edges
  };
  for (const k in edges) {
    edges[k] = false;
  }
  return inp;
}

function setupTouch() {
  if (!isTouch) {
    return;
  }
  $('#press-hint').textContent = '— 画面に触れて、扉をひらく —';
  const pad = $('#touch');
  pad.hidden = false;
  const joy = $('#joy');
  const knob = $('#knob');
  let jid = null;
  let ox = 0;
  let oy = 0;
  joy.addEventListener('pointerdown', (e) => {
    jid = e.pointerId;
    const r = joy.getBoundingClientRect();
    ox = r.left + r.width / 2;
    oy = r.top + r.height / 2;
    joy.setPointerCapture(jid);
  });
  joy.addEventListener('pointermove', (e) => {
    if (e.pointerId !== jid) {
      return;
    }
    const R = joy.clientWidth / 2;
    let dx = (e.clientX - ox) / R;
    let dy = (e.clientY - oy) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    touchState.mx = dx;
    touchState.mz = dy;
    knob.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
  });
  const endJoy = (e) => {
    if (e.pointerId !== jid) {
      return;
    }
    jid = null;
    touchState.mx = touchState.mz = 0;
    knob.style.transform = '';
  };
  joy.addEventListener('pointerup', endJoy);
  joy.addEventListener('pointercancel', endJoy);
  for (const b of pad.querySelectorAll('[data-act]')) {
    const act = b.dataset.act;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (act === 'guard') {
        touchState.guard = true;
      } else {
        edges[act] = true;
      }
    });
    const up = () => {
      if (act === 'guard') {
        touchState.guard = false;
      }
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  }
}

// ---------- Screens ----------
const state = { mode: null, myKey: null, oppKey: null, chapter: 0, battle: null, paused: false, net: null, online: null, dialogue: null, lastWin: false };
function isScreen(id) {
  return $('#' + id)?.classList.contains('on');
}
function show(id) {
  for (const s of document.querySelectorAll('.screen')) {
    s.classList.toggle('on', s.id === id);
  }
  $('#hud').hidden = id !== null;
  $('#touch').classList.toggle('active', id === null);
  if (id) {
    const first = $('#' + id).querySelector('.menu button, .card:not(.locked), .chip');
    if (first && !isTouch) {
      first.focus({ preventScroll: true });
    }
  }
}
function goBackCurrent() {
  if (!$('#pause').hidden) {
    togglePause();
    return;
  }
  const scr = document.querySelector('.screen.on');
  if (!scr) {
    togglePause();
    return;
  }
  scr.querySelector('.back')?.click();
}
// 運営長：運営長キーでのみ（このタブの間だけ）
function chiefUnlocked() {
  return localStorage.getItem('arkeia-chief') === '1' || sessionStorage.getItem('arkeia-chief') === '1';
}
// 運営：運営キー（このタブの間）／招待コードで登録済み（この端末）／運営長
function operatorUnlocked() {
  return localStorage.getItem('arkeia-op') === '1' || sessionStorage.getItem('arkeia-op') === '1' || localStorage.getItem('arkeia-op-reg') === '1' || chiefUnlocked();
}
// CPUの強さ：敵の頭の良さ(cpu)と体力を倍率で変える
const DIFFS = [
  { n: 'イージー', c: 0.55, h: 0.7 },
  { n: 'ノーマル', c: 1, h: 1 },
  { n: 'ハード', c: 1.25, h: 1.3 },
  { n: 'ベリーハード', c: 1.6, h: 1.7 }
];
const foeCpu = (base) => Math.max(0.15, Math.min(1, base * DIFFS[save.diff].c));
const foeHp = (m) => (m || 1) * DIFFS[save.diff].h;
// その戦士を使えるか（運営専用・ショップ解放）
function canUse(k) {
  const d = FIGHTERS[k];
  if (d.special === 'chief') return chiefUnlocked();
  if (d.shop) return save.chars.includes(k) || operatorUnlocked();
  if (d.locked) return operatorUnlocked();
  return true;
}
const SELECT_KEYS = () => [...ROSTER, 'seraphel', 'chief', 'sovereign', 'crimson'];
function refreshTitle() {
  $('#btn-invade').hidden = !operatorUnlocked();
  $('#title-shards').textContent = `灯晶　${save.shards}`;
  const ch = save.chapter % STORY.length;
  $('#story-sub').textContent = save.chapter >= STORY.length ? '旅は終わった。もう一度、最初の灯から' : `続きから：${STORY[ch].title}`;
}
function enterTitle() {
  unlockAudio();
  playTrack('title');
  refreshTitle();
  show('scr-title');
}

$('#scr-press').addEventListener('pointerdown', () => {
  if (isScreen('scr-press')) {
    enterTitle();
  }
});

document.querySelectorAll('[data-to]').forEach((b) => b.addEventListener('click', () => {
  sfx('ui');
  if (b.dataset.to === 'press') {
    show('scr-press');
  } else {
    goTitle();
  }
}));

document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
  sfx('ui');
  state.mode = b.dataset.go;
  state.online = null;
  if (state.mode === 'story') {
    state.chapter = save.chapter % STORY.length;
    openPartySelect(() => runStoryChapter());
    return;
  }
  const crumbs = { cpu: 'ひとりで手合わせ', duo: '背中をあずける', 'online-vs': 'オンライン対戦', 'online-coop': 'オンライン協力' };
  const pickMine = () => openSelect('あなたが握る剣は？', crumbs[state.mode], (k) => {
    state.myKey = k;
    if (state.mode === 'cpu') {
      const pickOpp = () => openSelect('向かい合うのは？', crumbs[state.mode] + ' › 相手', (k2) => {
        state.oppKey = k2;
        openStageSelect(crumbs[state.mode] + ' › 舞台', pickOpp);
      }, { allowLocked: true, onBack: pickMine });
      pickOpp();
    } else if (state.mode === 'duo') {
      openStageSelect(crumbs[state.mode] + ' › 舞台', pickMine);
    } else {
      openLobby();
    }
  }, { onBack: goTitle });
  pickMine();
}));

function openSelect(label, crumb, cb, { allowLocked = false, onBack = goTitle } = {}) {
  $('#select-label').textContent = label;
  $('#select-crumb').textContent = crumb;
  $('#select-back').onclick = () => {
    sfx('ui');
    onBack();
  };
  $('#party-bar').hidden = true;
  const grid = $('#select-grid');
  grid.replaceChildren();
  for (const k of SELECT_KEYS()) {
    const d = FIGHTERS[k];
    const locked = !canUse(k) && !allowLocked;
    const card = document.createElement('button');
    card.className = 'card' + (locked ? ' locked' : '');
    card.style.setProperty('--c', '#' + d.color.toString(16).padStart(6, '0'));
    const t = document.createElement('em');
    t.textContent = locked ? '名を封じられし者' : d.title;
    const n = document.createElement('b');
    n.textContent = locked ? '？？？' : d.name;
    const s = document.createElement('small');
    s.textContent = locked
      ? (d.shop ? '灯晶商店で迎えられる' : '運営の鍵でのみ目覚める')
      : `${d.skills.map((x) => x.name).join('／')}\n奥義：${d.over.name}`;
    if (d.face) {
      const img = document.createElement('img');
      img.className = 'face';
      img.src = d.face;
      img.alt = '';
      img.loading = 'lazy';
      if (d.faceHue) img.style.filter = `hue-rotate(${d.faceHue}deg)`;
      if (locked) img.style.filter = 'brightness(0)';
      card.append(img);
    }
    card.append(t, n, s);
    card.disabled = locked;
    card.addEventListener('click', () => {
      sfx('ui');
      cb(k);
    });
    grid.append(card);
  }
  show('scr-select');
}

// 物語のパーティー編成（最大4人、★が自分の操作キャラ）
function openPartySelect(done) {
  const pool = SELECT_KEYS().filter((k) => canUse(k) && (!SPECIAL_KEYS.includes(k) || operatorUnlocked() || FIGHTERS[k].shop));
  let party = save.party.filter((k) => pool.includes(k));
  if (!party.length) party = ['rowen'];
  let main = party.includes(save.main) ? save.main : party[0];
  $('#select-label').textContent = '旅の仲間を選ぶ';
  $('#select-crumb').textContent = '灯脈の旅路 › 編成';
  $('#select-back').onclick = () => {
    sfx('ui');
    goTitle();
  };
  $('#party-bar').hidden = false;
  const grid = $('#select-grid');
  const cards = {};
  // 運営長・運営だけ：主人公（自分で操作するキャラ）を外し、全員を自動で戦わせられる
  const op = operatorUnlocked();
  let noHero = op && !!save.noHero;
  const nh = $('#party-nohero');
  nh.hidden = !op;
  nh.onclick = () => {
    sfx('ui');
    noHero = !noHero;
    render();
  };
  const render = () => {
    nh.textContent = noHero ? '主人公：外す（全員が自動で戦う）' : '主人公：あり（★を自分で操作）';
    const slots = $('#party-slots');
    slots.replaceChildren();
    for (let i = 0; i < 4; i++) {
      const k = party[i];
      const b = document.createElement('button');
      const isMain = k === main && !noHero;
      b.textContent = k ? (isMain ? '★ ' : '') + FIGHTERS[k].name : '（空き）';
      b.className = isMain ? 'main' : '';
      b.disabled = !k;
      b.addEventListener('click', () => {
        sfx('ui');
        main = k;
        render();
      });
      slots.append(b);
    }
    for (const k in cards) cards[k].classList.toggle('picked', party.includes(k));
    $('#party-go').disabled = !party.length;
  };
  grid.replaceChildren();
  for (const k of pool) {
    const d = FIGHTERS[k];
    const card = document.createElement('button');
    card.className = 'card';
    card.style.setProperty('--c', '#' + d.color.toString(16).padStart(6, '0'));
    if (d.face) {
      const img = document.createElement('img');
      img.className = 'face';
      img.src = d.face;
      img.alt = '';
      img.loading = 'lazy';
      if (d.faceHue) img.style.filter = `hue-rotate(${d.faceHue}deg)`;
      card.append(img);
    }
    const t = document.createElement('em');
    t.textContent = d.title;
    const n = document.createElement('b');
    n.textContent = d.name;
    card.append(t, n);
    card.addEventListener('click', () => {
      sfx('ui');
      if (party.includes(k)) {
        party = party.filter((x) => x !== k);
        if (main === k) main = party[0] || null;
      } else if (party.length < 4) {
        party.push(k);
        if (!main) main = k;
      }
      render();
    });
    cards[k] = card;
    grid.append(card);
  }
  $('#party-go').onclick = () => {
    if (!party.length) return;
    sfx('ui');
    save.party = party.slice();
    save.main = main;
    save.noHero = op && noHero;
    persist();
    $('#party-bar').hidden = true;
    done();
  };
  render();
  show('scr-select');
}

function openStageSelect(crumb, onBack) {
  $('#party-bar').hidden = true;
  $('#select-label').textContent = 'どこで剣を抜く？';
  $('#select-crumb').textContent = crumb;
  $('#select-back').onclick = () => {
    sfx('ui');
    onBack();
  };
  const grid = $('#select-grid');
  grid.replaceChildren();
  const list = [{ id: 'random', name: '風まかせ', floor: 0xc9a65a, seg: 0 }, ...STAGES];
  for (const st of list) {
    const card = document.createElement('button');
    card.className = 'card';
    card.style.setProperty('--c', '#' + st.floor.toString(16).padStart(6, '0'));
    const t = document.createElement('em');
    t.textContent = st.seg ? (st.seg > 20 ? '円の舞台' : `${st.seg}つの辺を持つ舞台`) : 'どこへ連れていかれるかは月次第';
    const n = document.createElement('b');
    n.textContent = st.name;
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    const thumb = document.createElement('div');
    thumb.className = 'sthumb';
    if (st.sky) {
      thumb.style.backgroundImage = `url(${st.sky})`;
      const fl = document.createElement('i');
      const segs = Math.min(st.seg, 24);
      const pts = Array.from({ length: segs }, (_, i) => {
        const a = (i / segs) * Math.PI * 2 - Math.PI / 2;
        return `${50 + Math.cos(a) * 46}% ${50 + Math.sin(a) * 46}%`;
      }).join(',');
      fl.style.clipPath = `polygon(${pts})`;
      fl.style.background = `radial-gradient(circle, ${hex(st.floor)}, ${hex(st.rim)})`;
      fl.style.boxShadow = `0 0 12px ${hex(st.crystal)}`;
      thumb.append(fl);
    } else {
      thumb.textContent = '？';
    }
    card.append(thumb, t, n);
    if (st.bgm != null) {
      const s = document.createElement('small');
      s.textContent = `♪ ${BGM[st.bgm % BGM.length].name}`;
      card.append(s);
    }
    card.addEventListener('mouseenter', () => st.sky && setStage(st));
    card.addEventListener('focus', () => st.sky && setStage(st));
    card.addEventListener('click', () => {
      sfx('ui');
      state.stage = st.sky ? st : STAGES[Math.floor(Math.random() * STAGES.length)];
      startOffline();
    });
    grid.append(card);
  }
  show('scr-select');
}

function goTitle() {
  endBattle();
  leaveField();
  setStage(STAGES[0]);
  state.mode = null;
  state.invaded = false;
  if (state.net) {
    state.net.leave();
    state.net = null;
  }
  state.online = null;
  state.duel = null;
  state.duelWait = null;
  $('#world-panel').hidden = true;
  $('#world-req').hidden = true;
  state.paused = false;
  state.dialogue = null;
  $('#pause').hidden = true;
  playTrack('title');
  refreshTitle();
  show('scr-title');
}

// ---------- Battle setup ----------
const ui = {
  sfx,
  popup(pos, val, color) {
    const v = new THREE.Vector3(pos.x, 2.2, pos.z).project(camera);
    const el = document.createElement('span');
    el.className = 'pop';
    el.textContent = val;
    el.style.color = color;
    el.style.left = Math.max(5, Math.min(95, ((v.x + 1) / 2) * 100)) + '%';
    el.style.top = Math.max(5, Math.min(95, ((1 - v.y) / 2) * 100)) + '%';
    $('#pops').append(el);
    setTimeout(() => el.remove(), 800);
  },
  banner(f, name) {
    const b = $('#banner');
    b.querySelector('i').textContent = f.name;
    b.querySelector('b').textContent = name;
    b.classList.remove('go');
    void b.offsetWidth;
    b.classList.add('go');
  },
  callout(f, name) {
    ui.popup(f.pos, name, '#f4ead2');
  },
  // 画面上部の技名表示：次の技で切り替わり、出なければ自然に消える
  skillName(f, spec, isOver) {
    const el = $('#skillname');
    if (!el || !spec) return;
    const KIND = { projectile: '飛び道具', dash: '突進', shockwave: '衝撃波', rain: '降りそそぐ範囲攻撃', implode: '引き寄せ爆発', judgment: '大範囲の奥義' };
    const ally = f.team === 0;
    el.querySelector('.sn-who').textContent = `${f.name}${ally ? '' : '（敵）'}`;
    el.querySelector('.sn-name').textContent = spec.name;
    el.querySelector('.sn-kind').textContent = (isOver ? '奥義 ／ ' : '技 ／ ') + (KIND[spec.kind] || '特技');
    el.style.setProperty('--sc', '#' + (spec.color ?? 0xffffff).toString(16).padStart(6, '0'));
    el.classList.toggle('over', !!isOver);
    el.classList.toggle('foe', !ally);
    el.classList.remove('show', 'hide');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.add('hide'), isOver ? 3000 : 2200);
  },
  // カットイン（覚醒・秘奥義・運営長降臨）
  cutin(f, title, sub) {
    const el = $('#cutin');
    if (!el || !f) return;
    const d = f.def || FIGHTERS[f.key] || {};
    const img = el.querySelector('img');
    img.hidden = !d.face;
    if (d.face) {
      img.src = d.face;
      img.style.filter = d.faceHue ? `hue-rotate(${d.faceHue}deg)` : '';
    }
    el.querySelector('.ci-who').textContent = f.name || d.name || '';
    el.querySelector('.ci-title').textContent = title;
    el.querySelector('.ci-sub').textContent = sub || '';
    el.classList.toggle('foe', f.team !== 0);
    el.hidden = false;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.hidden = true;
    }, 1900);
  },
  flash() {
    const fl = $('#flash');
    fl.classList.remove('go');
    void fl.offsetWidth;
    fl.classList.add('go');
  },
  end(winTeam) {
    setTimeout(() => onBattleEnd(winTeam === 0), 1400);
  }
};

function makeBattle(net) {
  endBattle();
  state.invaded = false;
  state.battle = new Battle(scene, camera, { assets, ui, net });
  return state.battle;
}
function endBattle() {
  if (state.battle) {
    // 覚醒の蓄積ダメージは次の戦いへ持ち越す（覚醒中に終わったらリセット）
    const me = state.battle.fighters.find((f) => f.isPlayer && !f.remoteAuth);
    if (me) {
      save.awk = me.awakened > 0 ? 0 : Math.max(0, Math.min(99, Math.round(me.awk)));
      persist();
    }
    state.battle.dispose();
    state.battle = null;
  }
}

async function startOffline() {
  await loadPromise;
  setStage(state.stage || STAGES[0]);
  const b = makeBattle(null);
  b.add(state.myKey, { team: 0, player: true, awk: save.awk, pos: [-4, 3], name: FIGHTERS[state.myKey].name + '（あなた）', upg: upgFor(state.myKey), gear: gearFor(state.myKey) });
  if (state.mode === 'cpu') {
    b.add(state.oppKey, { team: 1, cpu: foeCpu(0.8), hpMul: foeHp(1), pos: [4, -3], facing: Math.PI });
  } else {
    const pick = () => ROSTER[Math.floor(Math.random() * ROSTER.length)];
    const ally = pick();
    b.add(ally, { team: 0, cpu: 0.75, pos: [-6, -1], name: FIGHTERS[ally].name + '（相棒）' });
    const foe = () => (Math.random() < 0.5 ? ENEMY_ROSTER[Math.floor(Math.random() * ENEMY_ROSTER.length)] : pick());
    b.add(foe(), { team: 1, cpu: foeCpu(0.7), hpMul: foeHp(1), pos: [5, -4], facing: Math.PI });
    b.add(foe(), { team: 1, cpu: foeCpu(0.7), hpMul: foeHp(1), pos: [6, 1], facing: Math.PI });
  }
  beginBattle(b.fighters.some((f) => f.key === 'seraphel'));
}

function beginBattle(boss) {
  buildHud();
  show(null);
  // 物語は章ごとに100曲から、その他は舞台の曲。ヴェスペラ・運営長戦は専用曲
  const bgmIdx = (state.mode === 'story' ? state.chapter : currentStage?.bgm ?? 0) % BGM.length;
  // 敵側（運営の乱入時は両方）にヴェスペラ／運営長がいる時だけ
  const ks = state.battle.fighters.filter((f) => f.team === 1 || state.mode === 'invade').map((f) => f.key);
  const apex = ks.some((k) => k === 'sovereign' || k === 'sovereign2') ? 2 : ks.includes('chief') ? 1 : 0;
  if (apex) {
    playTrack('apex:' + apex);
    ui.banner({ name: `— ♪ ${APEX_BGM[apex].name} —` }, '頂上決戦');
  } else {
    playTrack(boss ? 'boss' : 'bgm:' + bgmIdx);
    ui.banner({ name: boss ? '— 双月の下で —' : `— ♪ ${BGM[bgmIdx].name} —` }, '剣を抜け');
  }
  // 開戦の合図：構え → 3・2・1 → 戦闘開始！（その間は誰も動かない）
  const b = state.battle;
  b.intro = 4.3;
  const cd = $('#countdown');
  clearTimeout(cd._t);
  const seq = [[1200, '構え……', 'ui'], [900, '3', 'ui'], [900, '2', 'ui'], [900, '1', 'ui'], [900, '戦闘開始！', 'burst']];
  let i = 0;
  const step = () => {
    if (state.battle !== b || i >= seq.length) {
      cd.hidden = true;
      return;
    }
    const [ms, txt, s] = seq[i++];
    cd.hidden = false;
    cd.textContent = txt;
    cd.classList.toggle('fight', i === seq.length);
    cd.classList.remove('go');
    void cd.offsetWidth;
    cd.classList.add('go');
    sfx(s);
    if (i === seq.length) ui.flash();
    cd._t = setTimeout(step, ms);
  };
  cd._t = setTimeout(step, 600);
}

function buildHud() {
  const L = $('#hud-left');
  const R = $('#hud-right');
  L.replaceChildren();
  R.replaceChildren();
  for (const f of state.battle.fighters) {
    const plate = document.createElement('div');
    plate.className = 'plate';
    const n = document.createElement('b');
    n.textContent = f.name;
    const bar = document.createElement('i');
    const fill = document.createElement('u');
    bar.append(fill);
    plate.append(n, bar);
    f.hudFill = fill;
    f.hudPlate = plate;
    (f.team === 0 ? L : R).append(plate);
  }
}

function updateHud() {
  const b = state.battle;
  if (!b) {
    return;
  }
  for (const f of b.fighters) {
    f.hudFill.style.width = (f.hp / f.maxHp) * 100 + '%';
    f.hudPlate.classList.toggle('down', f.dead);
  }
  const me = b.fighters.find((f) => f.isPlayer);
  if (me) {
    $('#flux u').style.width = me.flux + '%';
    $('#over u').style.width = me.over + '%';
    $('#over').classList.toggle('full', me.over >= 100);
    const aw = me.awakened > 0;
    $('#awk u').style.width = (aw ? (me.awakened / 15) * 100 : me.awk) + '%';
    $('#awk').classList.toggle('on', aw);
    $('#awk b').textContent = aw ? '覚醒中' : '覚醒';
    $('#over b').textContent = aw ? '秘奥義' : '奥義';
  }
}

const REWARD = { cpu: 30, duo: 40, story: 60, 'online-vs': 50, 'online-coop': 60 };
function grant(n) {
  save.shards += n;
  persist();
  return n;
}

function onBattleEnd(won) {
  if (!state.battle) {
    return;
  }
  state.lastWin = won;
  if (state.mode === 'invade') {
    showResult(won ? '裁きは下った' : '旅人に退けられた', won ? '物語の灯をひとつ揺らした。運営の仕事、おつかれさま。' : 'なかなかの旅人だ。物語は続く。', '', false, false);
    return;
  }
  if (state.mode === 'story') {
    // 旅人との決闘
    if (state.duel) {
      const d = state.duel;
      state.duel = null;
      const r = grant(won ? 40 : 10);
      endBattle();
      returnToField(null, true);
      ui.banner({ name: won ? `— ${d.name}に勝った！ —` : `— ${d.name}に敗れた —` }, `灯晶 +${r}`);
      return;
    }
    // フィールドの魔物シンボルとの戦闘
    if (state.encounter) {
      const sym = state.encounter;
      state.encounter = null;
      if (won && state.invaded) grant(100);
      const r = won ? grant(15 + Math.floor(state.chapter / 4)) : 0;
      endBattle();
      returnToField(sym, won);
      ui.banner({ name: won ? '— 魔物を退けた —' : '— 町の宿で目を覚ました —' }, won ? `灯晶 +${r}` : 'もう一度、北を目指そう');
      return;
    }
    if (won) {
      if (state.invaded) {
        grant(100);
        ui.banner({ name: '— 乱入者を退けた —' }, '灯晶 +100');
      }
      const ch = STORY[state.chapter];
      // 章の中の次の話（最大3話）
      const eps = Math.max(1, Math.min(3, ch.eps || 1));
      if ((state.ep || 0) < eps - 1) {
        state.ep = (state.ep || 0) + 1;
        const r = grant(Math.round(REWARD.story / 2));
        endBattle();
        playTrack('story');
        const lines = ch.epLines?.[state.ep - 1] || [['ロウエン', 'まだ気配が残っている……行こう！']];
        $('#story-chapter').textContent = `${ch.title}　第${state.ep + 1}話`;
        playDialogue([[`— 第${state.ep}話 完 —`, `灯晶 +${r}。物語は第${state.ep + 1}話へ。`], ...lines], () => startChapterBattle());
        return;
      }
      grant(REWARD.story);
      endBattle();
      leaveField();
      playTrack('story');
      playDialogue(ch.after, () => {
        state.chapter++;
        save.chapter = Math.max(save.chapter, state.chapter);
        persist();
        if (state.chapter >= STORY.length) {
          showResult('旅の終わり、旅のはじまり', '双つの空に灯が戻った。最後まで付き合ってくれて、ありがとう。', `灯晶 +${REWARD.story}`, false, false);
        } else {
          showResult('灯がひとつ戻った', `次は「${STORY[state.chapter].title}」。`, `灯晶 +${REWARD.story}`, false, true);
        }
      });
    } else {
      showResult('膝をついた', 'けれど、灯はまだ消えていない。もう一度立とう。', '', true, false);
    }
    return;
  }
  const r = won ? grant(REWARD[state.mode] || 30) : grant(5);
  showResult(
    won ? '勝ち名乗り' : '今日は相手の日',
    won ? '剣を納めよう。この勝負、あなたのものだ。' : '負けは地図の余白。次は描き込めばいい。',
    `灯晶 +${r}`,
    !state.online,
    false
  );
}

function showResult(title, text, reward, retry, next) {
  $('#res-title').textContent = title;
  $('#res-text').textContent = text;
  $('#res-reward').textContent = reward;
  $('#btn-retry').hidden = !retry;
  $('#btn-next').hidden = !next;
  playTrack(state.mode === 'story' ? 'story' : 'title');
  show('scr-result');
}
$('#btn-retry').addEventListener('click', () => {
  sfx('ui');
  if (state.mode === 'story') {
    if (state.field) startChapterBattle();
    else runStoryChapter();
  } else {
    startOffline();
  }
});
$('#btn-next').addEventListener('click', () => {
  sfx('ui');
  runStoryChapter();
});

// ---------- Story ----------
function playDialogue(lines, done) {
  state.dialogue = { lines, i: 0, done };
  show('scr-story');
  advanceDialogue();
}
function advanceDialogue() {
  const d = state.dialogue;
  if (!d) {
    return;
  }
  if (d.i >= d.lines.length) {
    state.dialogue = null;
    d.done();
    return;
  }
  $('#story-who').textContent = d.lines[d.i][0];
  $('#story-line').textContent = d.lines[d.i][1];
  d.i++;
}
$('#story-box').addEventListener('click', () => {
  sfx('ui');
  advanceDialogue();
});
$('#story-skip').addEventListener('click', () => {
  const d = state.dialogue;
  if (d) {
    state.dialogue = null;
    d.done();
  }
});
$('#story-back').addEventListener('click', () => {
  sfx('ui');
  goTitle();
});

function runStoryChapter() {
  const ch = STORY[state.chapter];
  state.ep = 0;
  const eps = Math.max(1, Math.min(3, ch.eps || 1));
  $('#story-chapter').textContent = (ch.part ? ch.part + '　' : '') + ch.title + (eps > 1 ? `　第1話（全${eps}話）` : '');
  playTrack('story');
  setStage(stageById(ch.stage));
  playDialogue(ch.before, () => enterField());
}

// 1〜6体（先の章ほど多く出やすい）
function rollFoeCount() {
  const prog = Math.min(1, state.chapter / Math.max(1, STORY.length - 1));
  const w = [1, 2, 3, 4, 5, 6].map((k) => Math.pow(k, 4 * prog));
  let roll = Math.random() * w.reduce((a, b) => a + b, 0);
  let n = 1;
  while (n < 6 && (roll -= w[n - 1]) > 0) n++;
  return n;
}
function storyParty() {
  const party = save.party.length ? save.party : ['rowen'];
  const mainKey = party.includes(save.main) ? save.main : party[0];
  return { party, mainKey };
}
// 戦闘を組む（パーティ＋敵）
function buildStoryBattle(foes, boss) {
  const ch = STORY[state.chapter];
  setStage(stageById(ch.stage));
  if (arena) arena.visible = true;
  if (state.field) state.field.group.visible = false;
  document.body.classList.remove('field-mode');
  resetFieldLight();
  const b = makeBattle(null);
  const { party, mainKey } = storyParty();
  state.myKey = mainKey;
  // ---- 強さの調整 ----
  // 敵が味方より多いほど1体あたりを弱く、少人数パーティーは味方を少し頑丈に。
  // 序盤はやさしく、章が進むほど敵の攻撃が上がる。道中の戦闘は決戦より軽め。
  const nA = party.length, nF = foes.length;
  const prog = state.chapter / Math.max(1, STORY.length - 1);
  const crowd = Math.max(0, nF - nA);
  const foeHpBal = (boss ? 1 : 1 / (1 + 0.16 * (nF - 1))) * (state.encounter ? 0.8 : 1) * (state.chapter < 8 ? 0.85 : 1);
  const foeAtkBal = Math.max(0.55, (0.82 + 0.3 * prog) * Math.pow(0.9, crowd) * (state.encounter ? 0.85 : 1));
  const allyDef = Math.max(0.7, 1 - 0.08 * Math.max(0, 4 - nA) - 0.04 * crowd);
  const allyAtk = 1 + 0.06 * Math.max(0, 4 - nA);
  // 運営が主人公を外した場合：先頭の戦士もAIで戦い、プレイヤーは見守る
  const noHero = !!save.noHero && operatorUnlocked();
  const me = noHero
    ? b.add(mainKey, { team: 0, cpu: Math.min(0.95, 0.8 + prog * 0.15), pos: [-4, 3], upg: upgFor(mainKey), gear: gearFor(mainKey), defMul: allyDef, atkMul: allyAtk })
    : b.add(mainKey, { team: 0, player: true, awk: save.awk, pos: [-4, 3], name: FIGHTERS[mainKey].name + '（あなた）', upg: upgFor(mainKey), gear: gearFor(mainKey), defMul: allyDef, atkMul: allyAtk });
  const spots = [[-6, 0], [-6, 5], [-3, -2]];
  party.filter((k) => k !== mainKey).forEach((k, i) => {
    // 仲間AIは章が進むほど賢く、主人公よりわずかに控えめな火力
    b.add(k, { team: 0, cpu: Math.min(0.95, 0.8 + prog * 0.15), pos: spots[i], upg: upgFor(k), gear: gearFor(k), defMul: allyDef, atkMul: allyAtk * 0.92 });
  });
  if (allowInvade()) {
    ensureWorld().then((w) => {
      if (w && state.battle === b) {
        b.net = w;
        me.netId = w.myId;
      }
    });
  }
  const baseCpu = Math.min(0.95, 0.55 + state.chapter * 0.006);
  foes.forEach((e, i) => {
    b.add(e.k, { team: 1, cpu: foeCpu(baseCpu), pos: [3 + (i % 3) * 2.4, -4 + Math.floor(i / 3) * 3], facing: Math.PI, tint: e.tint, name: e.name, hpMul: foeHp(e.hpMul) * foeHpBal * (boss && i === 0 ? 1 + 0.3 * (nA - 1) : 1), atkMul: foeAtkBal * (boss && i === 0 ? 1.1 : 1), scale: e.scale });
  });
  beginBattle(!!boss);
}
// 目的地の決戦：ボス章は決められた敵、通常の章は1〜6体
async function startChapterBattle() {
  await loadPromise;
  const ch = STORY[state.chapter];
  state.encounter = null;
  let foes = ch.enemies;
  // ボスは最後の話にだけ現れる
  const finalEp = (state.ep || 0) >= Math.max(1, Math.min(3, ch.eps || 1)) - 1;
  const bossNow = ch.boss && finalEp;
  if (!bossNow) {
    const lvl = ch.enemies[0]?.hpMul || 1;
    foes = Array.from({ length: rollFoeCount() }, (_, i) => ({ k: i === 0 && ch.enemies[0] && !ch.boss ? ch.enemies[0].k : ENEMY_ROSTER[Math.floor(Math.random() * ENEMY_ROSTER.length)], hpMul: ch.boss ? Math.min(lvl, 1.2) : lvl }));
  }
  buildStoryBattle(foes, bossNow);
}
// 魔物シンボルとの戦闘
function startEncounter(sym) {
  const ch = STORY[state.chapter];
  const lvl = Math.min(ch.enemies.find((e) => !e.scale)?.hpMul || 1, 1 + state.chapter * 0.02);
  const n = rollFoeCount();
  const foes = Array.from({ length: n }, (_, i) => ({ k: i === 0 ? sym.key : ENEMY_ROSTER[Math.floor(Math.random() * ENEMY_ROSTER.length)], hpMul: lvl }));
  state.encounter = sym;
  buildStoryBattle(foes, false);
}

// ---------- Field（ワールド探索） ----------
function resetFieldLight() {
  moon.position.set(8, 16, 6);
  moon.target.position.set(0, 0, 0);
  scene.fog.near = 30;
  scene.fog.far = 80;
}
async function enterField() {
  // フィールドは物語でしか使わないので必要になった時だけ読み込む（初回表示を軽く）
  const [{ Field }] = await Promise.all([import('./field.js'), loadPromise]);
  leaveField();
  const ch = STORY[state.chapter];
  const st = stageById(ch.stage);
  setStage(st);
  const { party, mainKey } = storyParty();
  state.myKey = mainKey;
  state.field = new Field(scene, {
    chapter: state.chapter, ch, stage: st, assets, floorTex,
    mainKey, gear: gearFor(mainKey), partyKeys: party, npcKeys: ROSTER, enemyPool: ENEMY_ROSTER,
    onTalk: (lines) => {
      sfx('ui');
      playDialogue(lines, () => show(null));
    },
    onChest: (n) => {
      grant(n);
      sfx('burst');
      ui.banner({ name: '— 宝箱をあけた —' }, `灯晶 +${n}`);
    },
    onRegion: (name, first) => {
      if (!first) sfx('ui');
      ui.banner({ name: first ? `— ${ch.title} —` : '— ここは —' }, name);
    },
    onEncounter: (sym) => {
      sfx('burst');
      ui.flash();
      ui.banner({ name: '— 魔物が現れた！ —' }, FIGHTERS[sym.key]?.name || '魔物');
      setTimeout(() => {
        if (state.field && !state.battle) startEncounter(sym);
      }, 700);
    },
    onGoal: () => {
      sfx('burst');
      ui.flash();
      setTimeout(() => {
        if (state.field && !state.battle) startChapterBattle();
      }, 600);
    }
  });
  if (arena) arena.visible = false;
  scene.fog.near = 45;
  scene.fog.far = 130;
  document.body.classList.add('field-mode');
  $('#hud-left').replaceChildren();
  $('#hud-right').replaceChildren();
  state.fieldHud = '';
  show(null);
  playTrack('field:' + state.chapter);
  state.field.setOwnName(myName());
  // 世界中の旅人とつながる
  ensureWorld().then(() => refreshFieldRemotes());
}
function returnToField(sym, won) {
  const f = state.field;
  if (!f) {
    goTitle();
    return;
  }
  if (arena) arena.visible = false;
  f.group.visible = true;
  f.resume(sym, won);
  scene.fog.near = 45;
  scene.fog.far = 130;
  document.body.classList.add('field-mode');
  $('#hud-left').replaceChildren();
  $('#hud-right').replaceChildren();
  show(null);
  playTrack('field:' + state.chapter);
}
function leaveField() {
  if (state.field) {
    state.field.dispose();
    state.field = null;
  }
  state.encounter = null;
  document.body.classList.remove('field-mode');
  if (arena) arena.visible = true;
  resetFieldLight();
}
const mapCtx = $('#field-map')?.getContext('2d');
function updateFieldHud() {
  const f = state.field;
  const p = f.player.pos;
  moon.position.set(p.x + 8, 16, p.z + 6);
  moon.target.position.set(p.x, 0, p.z);
  const obj = f.objective();
  if (obj !== state.fieldObj) {
    state.fieldObj = obj;
    $('#field-obj').textContent = obj;
  }
  if (f.prompt !== state.fieldHud) {
    state.fieldHud = f.prompt;
    $('#field-prompt').textContent = f.prompt;
    $('#field-prompt').hidden = !f.prompt;
  }
  $('#field-region').textContent = f.region;
  if (mapCtx) f.drawMap(mapCtx);
}

// ---------- Forge ----------
let forgeSel = 'rowen';
let forgeTab = 'upg';
function renderForge() {
  const list = $('#forge-list');
  list.replaceChildren();
  const keysList = SELECT_KEYS().filter(canUse);
  for (const k of keysList) {
    const b = document.createElement('button');
    b.className = 'chip' + (k === forgeSel ? ' on' : '');
    const total = UPGRADES.reduce((s, u) => s + lvOf(k, u.id), 0);
    b.textContent = `${FIGHTERS[k].name}　${total}/${UPGRADES.length * MAX_LV}`;
    b.addEventListener('click', () => {
      sfx('ui');
      forgeSel = k;
      renderForge();
    });
    list.append(b);
  }
  const d = FIGHTERS[forgeSel];
  $('#forge-name').textContent = `${d.name}　— ${d.title}`;
  const rows = $('#forge-rows');
  rows.replaceChildren();
  const tabs = document.createElement('div');
  tabs.className = 'ftabs';
  for (const [id, label] of [['upg', '強化（100種）'], ['wep', '武器（100種）'], ['arm', '防具（100種）']]) {
    const tb = document.createElement('button');
    tb.className = 'btn mini' + (forgeTab === id ? ' on' : '');
    tb.textContent = label;
    tb.addEventListener('click', () => {
      sfx('ui');
      forgeTab = id;
      renderForge();
    });
    tabs.append(tb);
  }
  rows.append(tabs);
  if (forgeTab === 'wep' || forgeTab === 'arm') {
    const LIST = forgeTab === 'wep' ? WEAPONS : ARMORS;
    const slot = forgeTab === 'wep' ? save.equip : save.armor;
    const cur = LIST.find((w) => w.id === slot[forgeSel]);
    const info = document.createElement('small');
    info.textContent = `装備中：${cur ? cur.name : 'なし'}（装備は戦闘とワールドで姿に反映されます）`;
    rows.append(info);
    for (const w of LIST) {
      const owned = save.owned.includes(w.id);
      const on = slot[forgeSel] === w.id;
      const row = document.createElement('div');
      row.className = 'frow';
      const lab = document.createElement('span');
      lab.textContent = w.name;
      const btn = document.createElement('button');
      btn.className = 'btn mini';
      btn.textContent = on ? '外す' : owned ? '装備' : `買う ${w.price}`;
      btn.disabled = !owned && save.shards < w.price;
      btn.addEventListener('click', () => {
        if (on) {
          delete slot[forgeSel];
        } else if (owned) {
          slot[forgeSel] = w.id;
        } else {
          if (save.shards < w.price) return;
          save.shards -= w.price;
          save.owned.push(w.id);
          slot[forgeSel] = w.id;
        }
        persist();
        sfx('skill');
        renderForge();
      });
      const pips = document.createElement('i');
      pips.textContent = on ? '◆装備中' : owned ? '◇所持' : '';
      const desc = document.createElement('small');
      desc.textContent = Object.entries(w.bonus).map(([s, v]) => `${STAT_LABEL[s]}+${v}段`).join('／');
      row.append(lab, btn, pips, desc);
      rows.append(row);
    }
    $('#forge-shards').textContent = `手持ちの灯晶　${save.shards}`;
    return;
  }
  for (const u of UPGRADES) {
    const lv = lvOf(forgeSel, u.id);
    const cost = (lv + 1) * 40;
    const row = document.createElement('div');
    row.className = 'frow';
    const lab = document.createElement('span');
    lab.textContent = u.label;
    const btn = document.createElement('button');
    btn.className = 'btn mini';
    btn.textContent = lv >= MAX_LV ? '極めた' : `注ぐ ${cost}`;
    btn.disabled = lv >= MAX_LV || save.shards < cost;
    btn.addEventListener('click', () => {
      if (save.shards < cost || lv >= MAX_LV) {
        return;
      }
      save.shards -= cost;
      (save.upg[forgeSel] ||= {})[u.id] = lv + 1;
      persist();
      sfx('skill');
      renderForge();
    });
    const pips = document.createElement('i');
    pips.textContent = '◆'.repeat(lv) + '◇'.repeat(MAX_LV - lv);
    const desc = document.createElement('small');
    desc.textContent = u.desc;
    row.append(lab, btn, pips, desc);
    rows.append(row);
  }
  $('#forge-shards').textContent = `手持ちの灯晶　${save.shards}`;
}
$('#btn-forge').addEventListener('click', () => {
  sfx('ui');
  renderForge();
  show('scr-forge');
});

// ---------- Online ----------
function openLobby() {
  $('#lobby-mode').textContent = state.mode === 'online-vs' ? '遠い誰かと剣を交える' : '遠い誰かと、裁定者に挑む';
  const params = new URLSearchParams(location.search);
  $('#lobby-room').value = (params.get('room') || Math.random().toString(36).slice(2, 7)).replace(/[^a-z0-9]/gi, '').slice(0, 12);
  $('#lobby-status').textContent = '同じ合言葉を、相手にも伝えてください。';
  $('#btn-join').disabled = false;
  show('scr-lobby');
}

$('#btn-join').addEventListener('click', async () => {
  const room = $('#lobby-room').value.replace(/[^a-z0-9]/gi, '').slice(0, 12);
  const name = $('#lobby-name').value.replace(/[<>&"']/g, '').trim().slice(0, 12) || '旅人';
  if (!room) {
    $('#lobby-status').textContent = '合言葉は英数字で入れてください。';
    return;
  }
  $('#btn-join').disabled = true;
  $('#lobby-status').textContent = '回線を結んでいます…';
  history.replaceState({}, '', `?room=${encodeURIComponent(room)}`);
  try {
    state.net = await connect(state.mode, room, {
      onPeers: (p) => onPeers(p),
      onCast: (e) => {
        const f = state.battle?.fighters.find((x) => x.netId === e.id && x.remoteAuth);
        if (f) {
          state.battle.cast(f, e.slot, e);
        }
      },
      onHit: (e) => state.battle?.receiveNetHit(e),
      onBoss: (e) => {
        const boss = state.battle?.fighters.find((x) => x.netId === 'boss' && x.remoteAuth);
        if (boss) {
          boss.netTarget.set(e.x, 0, e.z);
          boss.netFacing = e.ry;
          boss.netMoving = e.mv;
          boss.hp = e.hp;
          boss.dead = e.hp <= 0;
        }
      }
    });
    state.online = { name, started: false };
    $('#lobby-status').textContent = `焚き火を起こしました（合言葉: ${room}）。相手を待っています…`;
    state.net.publish({ name, fk: state.myKey, mode: state.mode, x: 0, z: 0, ry: 0, hp: 1, mv: false, ready: true });
  } catch (err) {
    console.error(err);
    $('#lobby-status').textContent = 'つながりませんでした。少し置いてから、もう一度。';
    $('#btn-join').disabled = false;
  }
});

function onPeers(peers) {
  if (!state.online) {
    return;
  }
  const peer = Object.values(peers).find((p) => p.mode === state.mode && p.ready);
  if (!state.online.started && peer) {
    startOnline(peer);
    return;
  }
  const b = state.battle;
  if (!b || !state.online.started) {
    return;
  }
  const remote = b.fighters.find((f) => f.netId === state.online.peerId);
  const p = peers[state.online.peerId];
  if (!p) {
    if (!b.ended) {
      b.ended = true;
      showResult('灯が途切れた', '相手との回線が切れました。', '', false, false);
    }
    return;
  }
  remote.netTarget.set(p.x, 0, p.z);
  remote.netFacing = p.ry;
  remote.netMoving = p.mv;
  remote.hp = Math.min(remote.maxHp, p.hp);
  remote.dead = p.hp <= 0;
}

async function startOnline(peer) {
  await loadPromise;
  if (!state.online) {
    return;
  }
  state.online.started = true;
  state.online.peerId = peer.id;
  const myId = state.net.myId;
  const host = myId < peer.id;
  const peerKey = FIGHTERS[peer.fk] ? peer.fk : 'rowen';
  const roomSeed = [...($('#lobby-room').value || 'a')].reduce((s, c) => s + c.charCodeAt(0), 0);
  setStage(state.mode === 'online-coop' ? stageById('heaven') : STAGES[roomSeed % STAGES.length]);
  const b = makeBattle(state.net);
  const vs = state.mode === 'online-vs';
  const mePos = host ? [-4, 3] : vs ? [4, -3] : [-6, -1];
  const peerPos = host ? (vs ? [4, -3] : [-6, -1]) : [-4, 3];
  b.add(state.myKey, { team: 0, player: true, awk: save.awk, netId: myId, pos: mePos, name: state.online.name, upg: upgFor(state.myKey), gear: gearFor(state.myKey) });
  b.add(peerKey, { team: vs ? 1 : 0, remote: true, netId: peer.id, pos: peerPos, name: peer.name, hpMul: 1.15 });
  if (!vs) {
    b.add('seraphel', { team: 1, cpu: 0.9, remote: !host, netId: 'boss', pos: [5, -5], facing: Math.PI, hpMul: 2.2, name: '裁定者セラフェル' });
  }
  beginBattle(!vs || b.fighters.some((f) => f.key === 'seraphel'));
}

let netTimer = 0;
function netTick(dt) {
  const b = state.battle;
  if (!state.net || !b || !state.online?.started) {
    return;
  }
  netTimer += dt;
  if (netTimer < 0.08) {
    return;
  }
  netTimer = 0;
  const me = b.fighters.find((f) => f.isPlayer);
  state.net.publish({ name: state.online.name, fk: state.myKey, mode: state.mode, x: me.pos.x, z: me.pos.z, ry: me.facing, hp: me.hp, mv: !!me.moving, ready: true });
  const boss = b.fighters.find((f) => f.netId === 'boss' && !f.remoteAuth);
  if (boss) {
    state.net.boss({ x: boss.pos.x, z: boss.pos.z, ry: boss.facing, hp: boss.hp, mv: !!boss.moving });
  }
}

// ---------- World (運営の乱入) ----------
// 物語中のプレイヤーは共有ルーム "world" に在席を示し、運営はそこから選んで乱入する。
// ※クライアント側の仕組みのため完全な不正防止ではない（運営キー同様、厳密にはサーバー検証が必要）。
function allowInvade() {
  return true;
}
function isLive() {
  return !!state.online || state.invaded || state.mode === 'invade' || !!state.duel;
}
function handleCast(e) {
  const f = state.battle?.fighters.find((x) => x.netId === e.id && x.remoteAuth);
  if (f) {
    state.battle.cast(f, e.slot, e);
  }
}
function ensureWorld() {
  if (state.world) {
    return Promise.resolve(state.world);
  }
  if (!state.worldPending) {
    state.worldPending = connect('world', 'global', {
      onPeers: (p) => {
        state.worldPeers = p;
        syncWorldRemotes(p);
        refreshFieldRemotes();
        if (!$('#world-panel').hidden) renderWorldPanel();
        if (isScreen('scr-invade')) {
          renderInvadeList();
        }
      },
      onCast: handleCast,
      onHit: (e) => state.battle?.receiveNetHit(e),
      onBoss: () => {},
      onInvade: (e) => onInvaded(e),
      onReq: (e) => onWorldReq(e)
    }).then((n) => {
      state.world = n;
      return n;
    }).catch((err) => {
      console.warn(err);
      state.worldPending = null;
      return null;
    });
  }
  return state.worldPending;
}

function syncWorldRemotes(peers) {
  const b = state.battle;
  if (!b || state.online) {
    return;
  }
  for (const f of b.fighters) {
    if (!f.remoteAuth || !f.netId || f.netId === 'boss') {
      continue;
    }
    const p = peers[f.netId];
    if (!p) {
      if (!f.dead) {
        f.dead = true;
        if (state.mode === 'invade' && !b.ended) {
          b.ended = true;
          showResult('灯が遠のいた', '相手が物語を閉じたようです。', '', false, false);
        } else {
          ui.banner({ name: '— 風が止んだ —' }, '乱入者は去った');
        }
      }
      continue;
    }
    if (p.fk && p.fk === f.def.form2) f.checkTransform(true); // 乱入者の変身を反映
    f.netTarget.set(p.x, 0, p.z);
    f.netFacing = p.ry;
    f.netMoving = p.mv;
    f.hp = Math.min(f.maxHp, p.hp);
    f.dead = p.hp <= 0;
  }
}

function onInvaded(e) {
  const w = state.world;
  const b = state.battle;
  if (!w || e.to !== w.myId || state.mode !== 'story' || !b || b.ended || state.invaded || !allowInvade() || document.querySelector('.screen.on')) {
    return;
  }
  state.invaded = true;
  state.paused = false;
  $('#pause').hidden = true;
  const p = state.worldPeers?.[e.from];
  const ik = ['chief', 'sovereign', 'sovereign2'].includes(p?.fk) ? p.fk : 'seraphel';
  b.add(ik, { team: 1, remote: true, netId: e.from, pos: p ? [p.x, p.z] : [0, -9], facing: Math.PI, name: `乱入者・${e.name}` });
  b.net = w;
  buildHud();
  ui.flash();
  sfx('burst');
  const apex = ik === 'sovereign' || ik === 'sovereign2' ? 2 : ik === 'chief' ? 1 : 0;
  playTrack(apex ? 'apex:' + apex : 'boss');
  if (apex) ui.cutin(b.fighters[b.fighters.length - 1], FIGHTERS[ik].name, '運営長、降臨');
  ui.banner({ name: '— 空が裂けた —' }, apex ? '運営長が降りてきた！' : '裁定者が降りてきた！');
}

function renderInvadeList() {
  const list = $('#invade-list');
  list.replaceChildren();
  const myId = state.world?.myId;
  const targets = Object.values(state.worldPeers || {}).filter((p) => p.role === 'story' && p.ib && p.id !== myId);
  $('#invade-status').textContent = state.world
    ? (targets.length ? `${targets.length} 人が物語の途中にいます。` : 'いま戦っている旅人はいません。少し待つと現れるかもしれません。')
    : '世界の灯を探しています…';
  for (const p of targets) {
    const b = document.createElement('button');
    const ch = STORY[p.ch]?.title || '旅の途中';
    b.textContent = `${p.name} に乱入する`;
    const s = document.createElement('small');
    s.textContent = `${ch}／${FIGHTERS[p.fk]?.name || '？'}`;
    b.append(s);
    b.addEventListener('click', () => startInvade(p));
    list.append(b);
  }
}

$('#invade-who').addEventListener('click', () => {
  sfx('ui');
  const order = chiefUnlocked() ? ['seraphel', 'chief', 'sovereign'] : ['seraphel'];
  state.invadeKey = order[(order.indexOf(state.invadeKey) + 1) % order.length];
  $('#invade-who').textContent = `乱入する姿：${FIGHTERS[state.invadeKey].name}`;
});
$('#btn-invade').addEventListener('click', async () => {
  if (!operatorUnlocked()) {
    return;
  }
  sfx('ui');
  show('scr-invade');
  renderInvadeList();
  await ensureWorld();
  renderInvadeList();
});

async function startInvade(p) {
  const w = state.world;
  if (!w || !operatorUnlocked()) {
    return;
  }
  await loadPromise;
  state.mode = 'invade';
  w.invade({ to: p.id, from: w.myId, name: '運営' });
  setStage(stageById(STORY[p.ch]?.stage));
  const b = makeBattle(w);
  const ik = (state.invadeKey === 'chief' || state.invadeKey === 'sovereign') && chiefUnlocked() ? state.invadeKey : 'seraphel';
  b.add(ik, { team: 0, player: true, awk: save.awk, netId: w.myId, pos: [0, -9], name: FIGHTERS[ik].name + '（運営）', upg: upgFor(ik), gear: gearFor(ik) });
  b.add(FIGHTERS[p.fk] ? p.fk : 'rowen', { team: 1, remote: true, netId: p.id, pos: [p.x, p.z], name: p.name, gear: { w: p.gw, a: p.ga } });
  beginBattle(true);
  ui.flash();
  ui.banner({ name: `— ${STORY[p.ch]?.title || '旅の途中'} —` }, '裁きの時間だ');
}

let worldTimer = 0;
function worldTick(dt) {
  const w = state.world;
  if (!w) {
    return;
  }
  worldTimer += dt;
  if (worldTimer < 0.1) {
    return;
  }
  worldTimer = 0;
  const b = state.battle;
  const me = b?.fighters.find((f) => f.isPlayer);
  const gk = state.myKey || '';
  const base = { name: myName(), pid: save.pid, mode: 'world', ready: false, gw: save.equip[gk] || '', ga: save.armor[gk] || '' };
  if (state.mode === 'story' && state.field && !b) {
    const fp = state.field.player;
    w.publish({ ...base, role: 'field', fk: state.myKey, ch: state.chapter, ib: false, x: 0, z: 0, fx: fp.pos.x, fz: fp.pos.z, ry: fp.facing, hp: 1, mv: fp.cur === 'run' });
  } else if (state.mode === 'story' && me && allowInvade()) {
    w.publish({ ...base, role: 'story', fk: me.key, ch: state.chapter, ib: !b.ended && !state.invaded && !state.duel, x: me.pos.x, z: me.pos.z, ry: me.facing, hp: me.hp, mv: !!me.moving });
  } else if (state.mode === 'invade' && me) {
    w.publish({ ...base, name: '運営', role: 'op', fk: me.key, ch: 0, ib: true, x: me.pos.x, z: me.pos.z, ry: me.facing, hp: me.hp, mv: !!me.moving });
  } else {
    w.publish({ ...base, role: 'idle', fk: '', ch: 0, ib: false, x: 0, z: 0, ry: 0, hp: 0, mv: false });
  }
}

// ---------- World（旅人どうしの交流：姿の反映・決闘・フレンド） ----------
function myName() {
  return [...(save.uname || $('#lobby-name').value || '旅人').replace(/[<>&"']/g, '').trim()].slice(0, 10).join('') || '旅人';
}
const isFriend = (pid) => !!pid && save.friends.some((f) => f.pid === pid);
function refreshFieldRemotes() {
  const f = state.field;
  const w = state.world;
  if (!f || !w) return;
  const list = Object.values(state.worldPeers || {})
    .filter((p) => p.role === 'field' && p.id !== w.myId && p.pid !== save.pid)
    .map((p) => ({ id: p.id, name: [...p.name].slice(0, 10).join(''), fk: FIGHTERS[p.fk] ? p.fk : 'rowen', x: p.fx, z: p.fz, ry: p.ry, mv: p.mv, friend: isFriend(p.pid), gw: p.gw || '', ga: p.ga || '' }));
  f.setRemotes(list);
}
function peerStatus(p) {
  if (p.role === 'field') return `${STORY[p.ch]?.title || '旅'}を探索中`;
  if (p.role === 'story') return `${STORY[p.ch]?.title || '旅'}で戦闘中`;
  if (p.role === 'op') return '運営の務め中';
  return 'オンライン';
}
function renderWorldPanel() {
  const near = $('#world-near');
  const fr = $('#world-friends');
  near.replaceChildren();
  fr.replaceChildren();
  const w = state.world;
  $('#world-status').textContent = w ? `世界の旅人 ${Math.max(0, Object.keys(state.worldPeers || {}).length - 1)} 人` : '世界とつながっています…';
  const peers = state.worldPeers || {};
  const mk = (tag, text, cls) => {
    const e = document.createElement(tag);
    e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const list = state.field ? state.field.nearbyRemotes(40) : [];
  if (!list.length) near.append(mk('p', '近くに旅人はいません。どの章を旅している人でも、近づくとここに映ります。', 'wp-empty'));
  for (const r of list) {
    const p = peers[r.id];
    if (!p) continue;
    const row = mk('div', '', 'wp-row');
    row.append(mk('span', `${r.friend ? '★' : ''}${r.name}`, 'wp-name'), mk('small', `${FIGHTERS[r.fk]?.name || ''}・${Math.round(r.d)}m`));
    const duel = mk('button', '決闘を申し込む');
    duel.addEventListener('click', () => sendReq(p, 'duel'));
    row.append(duel);
    if (!isFriend(p.pid)) {
      const fb = mk('button', 'フレンド申請');
      fb.addEventListener('click', () => sendReq(p, 'friend'));
      row.append(fb);
    }
    near.append(row);
  }
  if (!save.friends.length) fr.append(mk('p', 'まだフレンドはいません。', 'wp-empty'));
  const online = Object.values(peers);
  for (const f of save.friends) {
    const p = online.find((x) => x.pid === f.pid);
    const row = mk('div', '', 'wp-row');
    row.append(mk('span', (p ? '● ' : '○ ') + (p?.name || f.name), 'wp-name ' + (p ? 'on' : 'off')), mk('small', p ? peerStatus(p) : 'オフライン'));
    const del = mk('button', '解除');
    del.addEventListener('click', () => {
      save.friends = save.friends.filter((x) => x.pid !== f.pid);
      persist();
      refreshFieldRemotes();
      renderWorldPanel();
    });
    row.append(del);
    fr.append(row);
  }
}
function sendReq(p, kind) {
  const w = state.world;
  if (!w || !p) return;
  sfx('ui');
  if (kind === 'duel') {
    if (state.battle || !state.field || state.field.frozen) return;
    state.duelWait = { id: p.id, at: performance.now() };
  }
  w.req({ kind, to: p.id, pid: save.pid, name: myName(), fk: state.myKey || '' });
  ui.banner({ name: '— 申請を送った —' }, `${p.name}の返事を待っています`);
}
function addFriend(pid, name) {
  if (!pid || pid === save.pid || isFriend(pid)) return;
  save.friends.push({ pid, name });
  persist();
  refreshFieldRemotes();
}
function canDuelNow() {
  return state.mode === 'story' && state.field && !state.battle && !state.field.frozen && !state.paused && !document.querySelector('.screen.on');
}
function onWorldReq(e) {
  const w = state.world;
  if (!w || e.to !== w.myId) return;
  // 申請の連打（スパム）対策：同じ相手から10秒に4件まで
  const now = performance.now();
  const rl = (state.reqRate ||= new Map());
  const hist = (rl.get(e.from) || []).filter((t) => now - t < 10000);
  if (hist.length >= 4) return;
  hist.push(now);
  rl.set(e.from, hist);
  if (rl.size > 200) rl.clear();
  if ((e.kind === 'duel' || e.kind === 'friend') && state.incoming && now - state.incoming.at < 30000) return;
  const peer = state.worldPeers?.[e.from];
  if (e.kind === 'duel' || e.kind === 'friend') {
    if (e.kind === 'duel' && !canDuelNow()) {
      w.req({ kind: 'dueldeny', to: e.from, pid: save.pid, name: myName() });
      return;
    }
    if (e.kind === 'friend' && isFriend(e.pid)) {
      w.req({ kind: 'friendok', to: e.from, pid: save.pid, name: myName() });
      return;
    }
    state.incoming = { ...e, at: performance.now() };
    $('#world-req-text').textContent = e.kind === 'duel'
      ? `${e.name}（${FIGHTERS[e.fk]?.name || '旅人'}）から決闘を申し込まれた！`
      : `${e.name}からフレンド申請が届いた。`;
    $('#world-req').hidden = false;
    sfx('ui');
    return;
  }
  if (e.kind === 'friendok') {
    addFriend(e.pid, e.name);
    ui.banner({ name: '— フレンドになった —' }, e.name);
  } else if (e.kind === 'frienddeny') {
    ui.banner({ name: '— フレンド申請 —' }, `${e.name}は今回は見送った`);
  } else if (e.kind === 'dueldeny') {
    state.duelWait = null;
    ui.banner({ name: '— 決闘 —' }, `${e.name}は申し込みを断った`);
  } else if (e.kind === 'duelok') {
    const wait = state.duelWait;
    state.duelWait = null;
    if (wait && wait.id === e.from && performance.now() - wait.at < 30000 && canDuelNow()) {
      startDuel({ id: e.from, name: e.name, fk: e.fk || peer?.fk }, true);
    }
  }
  if (!$('#world-panel').hidden) renderWorldPanel();
}
function answerReq(yes) {
  const e = state.incoming;
  state.incoming = null;
  $('#world-req').hidden = true;
  const w = state.world;
  if (!e || !w) return;
  sfx('ui');
  const stale = performance.now() - e.at > 30000;
  if (e.kind === 'friend') {
    w.req({ kind: yes ? 'friendok' : 'frienddeny', to: e.from, pid: save.pid, name: myName() });
    if (yes) {
      addFriend(e.pid, e.name);
      ui.banner({ name: '— フレンドになった —' }, e.name);
    }
  } else if (e.kind === 'duel') {
    const ok = yes && !stale && canDuelNow() && state.worldPeers?.[e.from];
    w.req({ kind: ok ? 'duelok' : 'dueldeny', to: e.from, pid: save.pid, name: myName(), fk: state.myKey || '' });
    if (ok) startDuel({ id: e.from, name: e.name, fk: e.fk }, false);
  }
}
// 決闘：世界ルームの回線で 1対1（申し込んだ側が左手前）
function startDuel(peer, challenger) {
  const w = state.world;
  if (!w || !canDuelNow()) return;
  $('#world-panel').hidden = true;
  const ch = STORY[state.chapter];
  setStage(stageById(ch.stage));
  if (arena) arena.visible = true;
  state.field.group.visible = false;
  state.field.frozen = true;
  document.body.classList.remove('field-mode');
  resetFieldLight();
  state.duel = { id: peer.id, name: peer.name };
  state.encounter = null;
  const b = makeBattle(w);
  const myPos = challenger ? [-4, 3] : [4, -3];
  const peerPos = challenger ? [4, -3] : [-4, 3];
  b.add(state.myKey, { team: 0, player: true, awk: save.awk, netId: w.myId, pos: myPos, facing: challenger ? 0 : Math.PI, name: myName() + '（あなた）', upg: upgFor(state.myKey), gear: gearFor(state.myKey) });
  b.add(FIGHTERS[peer.fk] ? peer.fk : 'rowen', { team: 1, remote: true, netId: peer.id, pos: peerPos, facing: challenger ? Math.PI : 0, name: peer.name, gear: { w: peer.gw, a: peer.ga } });
  beginBattle(false);
  ui.flash();
  sfx('burst');
  ui.banner({ name: '— 決闘 —' }, `${myName()} vs ${peer.name}`);
}
$('#btn-world').addEventListener('click', async () => {
  sfx('ui');
  const pnl = $('#world-panel');
  pnl.hidden = !pnl.hidden;
  if (!pnl.hidden) {
    $('#world-name').value = myName();
    renderWorldPanel();
    await ensureWorld();
    renderWorldPanel();
  }
});
$('#world-close').addEventListener('click', () => {
  sfx('ui');
  $('#world-panel').hidden = true;
});
$('#world-name').addEventListener('change', () => {
  save.uname = [...$('#world-name').value.replace(/[<>&"']/g, '').trim()].slice(0, 10).join('');
  $('#world-name').value = myName();
  persist();
  state.field?.setOwnName(myName());
});
$('#world-req-yes').addEventListener('click', () => answerReq(true));
$('#world-req-no').addEventListener('click', () => answerReq(false));

// ---------- Pause ----------
function togglePause() {
  if ((!state.battle && !state.field) || document.querySelector('.screen.on')) {
    return;
  }
  if (state.invaded || state.mode === 'invade' || state.duel) {
    ui.banner({ name: '— いまは止まれない —' }, '乱入中');
    return;
  }
  state.paused = !state.paused;
  $('#pause').hidden = !state.paused;
  $('#pause-note').textContent = state.online ? '遠い相手の時間は止まりません。' : '';
  if (state.paused && !isTouch) {
    $('#btn-resume').focus();
  }
}
$('#btn-pause').addEventListener('click', togglePause);
$('#btn-resume').addEventListener('click', togglePause);
$('#btn-quit').addEventListener('click', goTitle);

// ---------- Options / operator key ----------
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function safeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let r = 0;
  for (let i = 0; i < a.length; i++) {
    r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return r === 0;
}
window.ArkeiaOps = Object.freeze({ hash: sha256 });
const opState = { tries: 0, lockUntil: 0 };
function refreshOptions() {
  $('#opt-mute').textContent = audio.muted ? '音：黙らせる' : '音：鳴らす';
  $('#opt-diff').textContent = `CPUの強さ：${DIFFS[save.diff].n}`;
  $('#op-state').textContent = chiefUnlocked()
    ? '運営長として認められています — ルミナリアとセラフェルが選べます'
    : operatorUnlocked() ? '運営として認められています — セラフェルが選べます' : '運営の鍵・運営長の鍵・招待された運営キー（OP-…）を入力';
  $('#chief-panel').hidden = !chiefUnlocked();
}
// 推測されにくいランダムコード（紛らわしい文字を除外）
function randomCode(groups) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(groups * 4));
  return Array.from({ length: groups }, (_, g) => [...b.slice(g * 4, g * 4 + 4)].map((x) => A[x % A.length]).join('')).join('-');
}
$('#chief-issue').addEventListener('click', async () => {
  if (!chiefUnlocked()) return;
  sfx('ui');
  const code = 'OP-' + randomCode(3);
  $('#chief-code').value = '発行中…';
  try {
    await issueInvite(await sha256('arkeia-invite:' + code));
    $('#chief-code').value = code;
    $('#chief-code').select();
  } catch {
    $('#chief-code').value = '発行できませんでした（通信を確認してください）';
  }
});
// 端末間同期
const normSync = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
$('#sync-push').addEventListener('click', async () => {
  sfx('ui');
  const m = $('#sync-msg');
  let code = localStorage.getItem('arkeia-sync') || '';
  if (normSync(code).length !== 12) code = randomCode(3);
  m.textContent = '預けています…';
  try {
    await syncPush(await sha256('arkeia-sync:' + normSync(code)), JSON.stringify(save));
    localStorage.setItem('arkeia-sync', code);
    $('#sync-code').value = code;
    m.textContent = `預けました。別の端末で同期コード「${code}」を入力してください（他人には教えないでください）。`;
  } catch {
    m.textContent = '預けられませんでした（通信を確認してください）。';
  }
});
$('#sync-pull').addEventListener('click', async () => {
  sfx('ui');
  const m = $('#sync-msg');
  const n = normSync($('#sync-code').value);
  if (n.length !== 12) {
    m.textContent = '同期コードは12文字です。';
    return;
  }
  m.textContent = '受け取っています…';
  try {
    const json = await syncPull(await sha256('arkeia-sync:' + n));
    if (!json) {
      m.textContent = 'その同期コードの記録は見つかりませんでした。';
      return;
    }
    JSON.parse(json); // 壊れたデータは弾く（中身は読み込み時に検証される）
    localStorage.setItem(SAVE_KEY, json);
    localStorage.setItem('arkeia-sync', n.match(/.{4}/g).join('-'));
    m.textContent = '受け取りました。読み込み直します…';
    setTimeout(() => location.reload(), 600);
  } catch {
    m.textContent = '受け取れませんでした（通信を確認してください）。';
  }
});
$('#btn-options').addEventListener('click', () => {
  sfx('ui');
  $('#op-msg').textContent = '';
  refreshOptions();
  show('scr-options');
});
$('#opt-mute').addEventListener('click', () => {
  setMuted(!audio.muted);
  refreshOptions();
});
$('#opt-diff').addEventListener('click', () => {
  sfx('ui');
  save.diff = (save.diff + 1) % DIFFS.length;
  persist();
  refreshOptions();
});

// ---------- Shop ----------
function renderShop() {
  const list = $('#shop-list');
  list.replaceChildren();
  for (const it of SHOP_ITEMS) {
    const d = FIGHTERS[it.key];
    if (!d) continue;
    const owned = save.chars.includes(it.key);
    const row = document.createElement('div');
    row.className = 'card';
    row.style.setProperty('--c', '#' + d.color.toString(16).padStart(6, '0'));
    row.style.width = '100%';
    const img = document.createElement('img');
    img.className = 'face';
    img.src = d.face;
    img.alt = '';
    img.style.maxWidth = '220px';
    const t = document.createElement('em');
    t.textContent = d.title;
    const n = document.createElement('b');
    n.textContent = d.name;
    const s = document.createElement('small');
    s.textContent = `${d.skills.map((x) => x.name).join('／')}\n奥義：${d.over.name}\n価格：${it.price}`;
    row.append(img, t, n, s);
    if (owned) {
      const ok = document.createElement('b');
      ok.textContent = '— 迎え入れ済み —';
      row.append(ok);
    } else {
      const buy = document.createElement('button');
      buy.className = 'btn mini';
      buy.textContent = '購入する';
      buy.addEventListener('click', () => {
        sfx('ui');
        if (it.url) window.open(it.url, '_blank', 'noopener');
        else $('#shop-msg').textContent = '購入ページは準備中です。もう少しお待ちください。';
      });
      const form = document.createElement('form');
      form.className = 'field';
      const inp = document.createElement('input');
      inp.type = 'password';
      inp.maxLength = 64;
      inp.placeholder = '購入後に届く解放コード';
      const go = document.createElement('button');
      go.type = 'submit';
      go.className = 'btn mini';
      go.textContent = 'コードで解放';
      form.append(inp, go);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = inp.value.slice(0, 64);
        inp.value = '';
        if (!it.codeSha256) {
          $('#shop-msg').textContent = 'コードの受付はまだ始まっていません。';
          return;
        }
        try {
          if (safeEqual(await sha256(v), it.codeSha256)) {
            save.chars.push(it.key);
            persist();
            sfx('burst');
            $('#shop-msg').textContent = `${d.name} が仲間になった！`;
            renderShop();
          } else $('#shop-msg').textContent = 'コードが違うようです。';
        } catch {
          $('#shop-msg').textContent = 'この環境では照合できません（HTTPSで開いてください）。';
        }
      });
      row.append(buy, form);
    }
    list.append(row);
  }
}
$('#btn-shop').addEventListener('click', () => {
  sfx('ui');
  $('#shop-msg').textContent = '';
  renderShop();
  show('scr-shop');
});
$('#op-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#op-msg');
  if (Date.now() < opState.lockUntil) {
    msg.textContent = '鍵穴が熱を持っています。少し待ってから。';
    return;
  }
  // 全角文字・前後の空白・改行を正規化（スマホやIMEの全角ハイフン対策）
  const val = $('#op-key').value.normalize('NFKC').replace(/[‐‑‒–—―ー−]/g, '-').trim().slice(0, 128);
  $('#op-key').value = '';
  try {
    const h = await sha256(val);
    const ok = (text) => {
      msg.textContent = text;
      opState.tries = 0;
      sfx('burst');
      refreshOptions();
    };
    if (safeEqual(h, CHIEF_KEY_SHA256)) {
      localStorage.setItem('arkeia-chief', '1');
      ok('運営長として認められた。白耀の天后ルミナリアが目を覚ます。');
    } else if (safeEqual(h, OPERATOR_KEY_SHA256)) {
      localStorage.setItem('arkeia-op', '1');
      ok('かちり、と音がした。裁定者セラフェルが目を覚ます。');
    } else if (/^OP-[A-Z0-9-]{8,20}$/.test(val.trim().toUpperCase()) && (msg.textContent = '招待を確かめています…') && await redeemInvite(await sha256('arkeia-invite:' + val.trim().toUpperCase()))) {
      localStorage.setItem('arkeia-op-reg', '1');
      ok('招待が受理された。あなたは運営として登録された（このキーはもう使えない）。');
    } else {
      opState.tries++;
      if (opState.tries >= MAX_KEY_ATTEMPTS) {
        opState.lockUntil = Date.now() + LOCKOUT_MS;
        opState.tries = 0;
      }
      msg.textContent = '鍵は回らなかった。';
    }
  } catch {
    msg.textContent = 'この環境では照合できません（HTTPSで開いてください）。';
  }
});

// ---------- Gamepad (Standard mapping: Xbox / PlayStation / Switch Pro / 汎用) ----------
const pad = { prev: [], navT: 0 };
window.addEventListener('gamepadconnected', (e) => {
  $('#pad-status').textContent = `ゲームパッド：${e.gamepad.id.slice(0, 40)} と手を結びました`;
});
window.addEventListener('gamepaddisconnected', () => {
  $('#pad-status').textContent = 'ゲームパッド：手が離れました';
});
function activePad() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const g of list) {
    if (g && g.connected) {
      return g;
    }
  }
  return null;
}
function pollPad(dt) {
  padState.mx = padState.mz = 0;
  padState.guard = false;
  const g = activePad();
  if (!g) {
    return;
  }
  const btn = (i) => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.5));
  const down = (i) => btn(i) && !pad.prev[i];
  let mx = Math.abs(g.axes[0] || 0) > 0.2 ? g.axes[0] : 0;
  let mz = Math.abs(g.axes[1] || 0) > 0.2 ? g.axes[1] : 0;
  if (btn(14)) mx = -1;
  if (btn(15)) mx = 1;
  if (btn(12)) mz = -1;
  if (btn(13)) mz = 1;
  const anyDown = g.buttons.some((_, i) => down(i));
  if (isScreen('scr-press')) {
    if (anyDown) {
      enterTitle();
    }
  } else if (inBattleView() && !state.paused) {
    padState.mx = mx;
    padState.mz = mz;
    padState.guard = btn(4) || btn(6) || btn(7);
    if (down(0)) edges.attack = true;
    if (down(2)) edges.skill = true;
    if (down(5)) edges.skill2 = true;
    if (down(3)) edges.over = true;
    if (down(1)) edges.jump = true;
    if (down(9)) togglePause();
  } else {
    const root = state.paused ? $('#pause') : document.querySelector('.screen.on');
    const items = root ? [...root.querySelectorAll('button:not([disabled]), input, #story-box')].filter((b) => b.offsetParent !== null) : [];
    pad.navT -= dt;
    if (items.length && pad.navT <= 0 && (Math.abs(mx) > 0.5 || Math.abs(mz) > 0.5)) {
      pad.navT = 0.18;
      let i = items.indexOf(document.activeElement);
      i = (i + (mz > 0.5 || mx > 0.5 ? 1 : -1) + items.length) % items.length;
      items[i].focus();
      items[i].scrollIntoView({ block: 'nearest' });
    }
    if (down(0)) {
      unlockAudio();
      const el = document.activeElement;
      if (isScreen('scr-story') && (!el || el === document.body || el.id === 'story-box')) {
        advanceDialogue();
      } else if (el && items.includes(el)) {
        el.click();
      } else if (items[0]) {
        items[0].focus();
      }
    }
    if (down(1) || down(8)) {
      goBackCurrent();
    }
    if (down(9) && state.paused) {
      togglePause();
    }
  }
  pad.prev = g.buttons.map((b) => b.pressed || b.value > 0.5);
}

// ---------- Loop ----------
setupTouch();
const timer = new THREE.Timer();
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(0.05, Math.max(0, timer.getDelta()));
  const t = time / 1000;
  pollPad(dt);
  crystals.forEach((c, i) => {
    c.position.y += Math.sin(t * 1.5 + i) * 0.004;
    c.rotation.y += dt;
  });
  worldTick(dt);
  if (state.battle && (!state.paused || isLive())) {
    state.battle.update(dt, state.paused ? { mx: 0, mz: 0 } : readInput());
    netTick(dt);
    updateHud();
  } else if (state.field && !state.battle) {
    const live = !state.paused && !document.querySelector('.screen.on');
    state.field.update(live ? dt : 0, live ? readInput() : null, camera);
    updateFieldHud();
  } else if (!state.battle) {
    camera.position.set(Math.sin(t * 0.1) * 16, 7, Math.cos(t * 0.1) * 16);
    camera.lookAt(0, 2, 0);
  }
  renderer.render(scene, camera);
});

show('scr-press');
