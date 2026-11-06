import * as THREE from 'three';
import { attachGaienWalk } from './gaien-motion.js';
import { enhanceGaienModel } from './gaien-style.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { FIGHTERS, ELEMS } from './data.js?v=gaien-bgm-20261107b';
import { makeGear, animGear } from './gear.js';
import { instantiateModel, disposeModel, loadModel } from './model-runtime.js?v=gaien-true-uv-20261107';

// 召喚獣の見た目と性能（HPは使い手の最大HPに比例）
const SUMMON_DEFS = {
  s0: { name: 'ヤマタノオロチ', model: 'assets/models/summon-orochi.glb', height: 3.6, hpMul: 0.6, dist: 2.4, range: 4.4, mul: 1.5, autoMul: 1.3, autoCd: 1.8, autoRange: 4.5, color: 0xd01030, color2: 0xff6020 },
  s1: { name: 'スサノオ', model: 'assets/models/summon-susanoo.glb', height: 3.4, hpMul: 0.6, dist: 2.2, range: 4.4, mul: 1.5, autoMul: 1.4, autoCd: 1.6, autoRange: 4.0, color: 0x30ff70, color2: 0xa0ffc0 }
};
const SUMMON_CACHE = new Map();
// Reuse the configured GLB loader (including Draco/Meshopt decoding).
// GLTFLoader was not imported here: constructing it aborted the entire game
// before the start button was wired up.


// 八岐大蛇：一部の首が胴体から切れて見える旧GLBを、滑らかな補強曲線で接続。
// 元の顔・胴体メッシュとテクスチャは残す。首は独立材質でカメラ背面からも見える。
function repairOrochiNecks(scene, ownership) {
  const patch = new THREE.Group();
  patch.name = 'orochi_eight_necks_repaired';
  const rootColor = 0x211522;
  const ridgeColor = 0x702b35;
  const bellyColor = 0x49202a;
  const bodyMat = new THREE.MeshStandardMaterial({ color: rootColor, roughness: 0.78, metalness: 0.06, side: THREE.DoubleSide });
  const bellyMat = new THREE.MeshStandardMaterial({ color: bellyColor, roughness: 0.85, side: THREE.DoubleSide });
  const ridgeMat = new THREE.MeshStandardMaterial({ color: ridgeColor, roughness: 0.74, metalness: 0.03 });
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x392534, roughness: 0.8 });
  for (const mat of [bodyMat, bellyMat, ridgeMat, shellMat]) ownership.add(mat);
  // 旧GLBの局所座標。各首先端は元の8頭の根元の内側へ入り込ませ、切れ目を隠す。
  const heads = [
    [-0.335, 0.66, 0.020], [-0.237, 0.77, -0.050], [-0.13, 0.725, -0.12], [-0.035, 0.79, 0.035],
    [ 0.115, 0.82, 0.005], [ 0.225, 0.72, -0.055], [ 0.41, 0.52, 0.018], [ 0.405, 0.315, 0.075]
  ];
  heads.forEach(([x, y, z], i) => {
    const side = (i - 3.5) / 3.5;
    const base = new THREE.Vector3(-0.03 + side * 0.043, 0.105, -0.07 + (i % 3) * 0.02);
    const target = new THREE.Vector3(x, y - 0.025, z);
    const curve = new THREE.CatmullRomCurve3([
      base,
      new THREE.Vector3(base.x + side * 0.025, 0.20 + i * 0.002, -0.05),
      new THREE.Vector3(x * 0.53, y * 0.53, z * 0.8),
      new THREE.Vector3(x * 0.83, y - 0.13, z - 0.015),
      target
    ], false, 'centripetal', 0.45);
    const radius = i >= 6 ? 0.025 : 0.031;
    const tubeGeo = new THREE.TubeGeometry(curve, 40, radius, 14, false);
    const main = new THREE.Mesh(tubeGeo, bodyMat);
    main.name = 'neck_' + (i + 1);
    main.castShadow = true;
    main.receiveShadow = true;
    patch.add(main);
    ownership.add(tubeGeo);
    // 鱗の背筋。先端までつながる長いリブを首に沿わせる。
    const edgePoints = [];
    for (let j = 0; j <= 32; j++) {
      const pos = curve.getPoint(j / 32);
      pos.y += radius * 0.68;
      pos.z -= radius * 0.35;
      edgePoints.push(pos);
    }
    const edgeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edgePoints), 32, radius * 0.26, 6, false);
    patch.add(new THREE.Mesh(edgeGeo, ridgeMat));
    ownership.add(edgeGeo);
    const bellyPoints = [];
    for (let j = 0; j <= 28; j++) {
      const pos = curve.getPoint(j / 28);
      pos.z += radius * 0.78;
      bellyPoints.push(pos);
    }
    const bellyGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bellyPoints), 28, radius * 0.55, 10, false);
    patch.add(new THREE.Mesh(bellyGeo, bellyMat));
    ownership.add(bellyGeo);
    // 胴体とのつなぎ目を滑らかに覆う骨格の節。
    const collarGeo = new THREE.SphereGeometry(radius * 1.35, 12, 8);
    const collar = new THREE.Mesh(collarGeo, shellMat);
    collar.position.copy(base);
    collar.scale.set(1.25, 1.2, 1.25);
    patch.add(collar);
    ownership.add(collarGeo);
  });
  scene.add(patch);
  return patch;
}
function loadSummonModel(url) {
  if (!SUMMON_CACHE.has(url)) {
    const request = loadModel(url).catch((err) => {
      SUMMON_CACHE.delete(url); // Allow a later summon to retry a failed load.
      console.warn('[SUMMON MODEL]', url, err);
      return null;
    });
    SUMMON_CACHE.set(url, request);
  }
  return SUMMON_CACHE.get(url);
}

// 状態異常：持続秒数・継続ダメージ(毎秒)
const ST_INFO = {
  burn: { dur: 4, dot: 22 }, freeze: { dur: 1.2 }, para: { dur: 3 }, slow: { dur: 3.5 }, petrify: { dur: 1.5 },
  blind: { dur: 4 }, curse: { dur: 5 }, silence: { dur: 3.5 }, poison: { dur: 6, dot: 14 }, bleed: { dur: 3, dot: 32 }
};
const ST_ELEM = Object.fromEntries(ELEMS.map((e, i) => [e.st, i]));

export const ARENA_R = 13;

// ---- 追加技：技を出した直後にタイミングよく同じ技を押すと派生する（全戦士×各技＝数百種） ----
const FOLLOW_NAMES = ['追の型', '連閃', '返し刃', '裂破', '重ね撃ち', '穿ち', '狂い咲き', '終の型', '翻り', '轟連', '双牙', '残光', '烈衝', '螺旋', '天翔'];
const FOLLOW_CACHE = new WeakMap();
const FOLLOW_HOLD = 0.45, FOLLOW_MAX = 1.5; // 長押しで派生するまでの秒数
export function followSpec(def, i) {
  const base = def?.skills?.[i];
  if (!base) return null;
  let m = FOLLOW_CACHE.get(def);
  if (!m) FOLLOW_CACHE.set(def, (m = {}));
  if (m[i]) return m[i];
  let h = i * 7;
  for (const c of base.name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const s = { ...base, name: `${base.name}・${FOLLOW_NAMES[h % FOLLOW_NAMES.length]}`, cost: Math.ceil((base.cost || 0) * 0.5), follow: true };
  if (s.dmg) s.dmg = Math.round(s.dmg * 1.35);
  if (s.count) s.count = Math.min(9, s.count + 1 + (h % 2));
  if (s.radius) s.radius = +(s.radius * 1.25).toFixed(2);
  if (s.heal) s.heal = Math.round(s.heal * 1.3);
  if (s.kind === 'shockwave') s.double = true;
  if (s.speed) s.speed *= 1.15;
  m[i] = s;
  return s;
}
// ---- 秘奥義：覚醒中に放つ奥義 ----
const HI_CACHE = new WeakMap();
export function hiSpec(def) {
  if (!def?.over) return null;
  if (HI_CACHE.has(def)) return HI_CACHE.get(def);
  const o = def.over;
  const s = { ...o, name: `秘奥義・${o.name}`, hi: true };
  if (s.dmg) s.dmg = Math.round(s.dmg * 1.8);
  if (s.count) s.count = Math.min(12, s.count + 3);
  if (s.radius) s.radius = +(s.radius * 1.4).toFixed(2);
  if (s.heal) s.heal = Math.round(s.heal * 1.6);
  HI_CACHE.set(def, s);
  return s;
}
// オンラインで受け取る1撃ダメージの上限（技・奥義の最大威力×検証済み攻撃強化×秘奥義/追加技の倍率に余裕を持たせる）
function netHitCap(f) {
  const d = f.def;
  let base = 60;
  for (const s of [d.light, d.over, ...(d.skills || [])]) if (s && +s.dmg > base) base = +s.dmg;
  const atk = f.verified ? f.upg.atk || 0 : 0;
  return Math.round(base * (1 + 0.06 * atk) * (d.power || 1) * 1.8 * 1.35 * 1.25);
}
const AWAKEN_TIME = 15; // 覚醒の持続（秒）
const AWAKEN_RED = new THREE.Color(0xff1a28);

const GEO = {
  pillar: new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0),
  ring: new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2),
  disc: new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  cone: new THREE.ConeGeometry(0.2, 2.6, 8).rotateX(Math.PI),
  blade: new THREE.BoxGeometry(0.1, 0.1, 3),
  oct: new THREE.OctahedronGeometry(1)
};

// 技の立体素材：加算発光ではなく、面のある実体として見せる（控えめな自己発光＋フラットシェーディング）
function glow(color, opacity = 0.85) {
  const op = opacity >= 0.6 ? Math.min(1, opacity + 0.15) : opacity;
  const m = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.1, roughness: 0.55, metalness: 0.1, flatShading: true,
    transparent: true, opacity: op, depthWrite: op >= 0.9, side: THREE.DoubleSide
  });
  m.userData.base = op;
  return m;
}
// 形をくっきり見せる暗い縁取り（裏面を少し大きく描く）
const OUTLINE_COL = new THREE.Color(0x140a10);
function outline(mesh, k = 1.08) {
  const m = new THREE.MeshBasicMaterial({ color: OUTLINE_COL, side: THREE.BackSide, transparent: true, opacity: 0.85 });
  m.userData.base = 0.85;
  const o = new THREE.Mesh(mesh.geometry, m);
  o.scale.setScalar(k);
  mesh.add(o);
  return o;
}

// ---- 形ある技エフェクト用ジオメトリ（共有・破棄しない） ----
const SG = {
  shaft: new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6).rotateX(Math.PI / 2),
  tip: new THREE.ConeGeometry(0.13, 0.5, 6).rotateX(Math.PI / 2),
  fin: new THREE.PlaneGeometry(0.22, 0.32),
  blade: new THREE.BoxGeometry(0.05, 0.32, 2.2),
  guard: new THREE.BoxGeometry(0.8, 0.12, 0.12),
  hilt: new THREE.CylinderGeometry(0.06, 0.06, 0.5, 6).rotateX(Math.PI / 2),
  axeHead: new THREE.CylinderGeometry(0.55, 0.55, 0.06, 18, 1, false, 0, Math.PI),
  gear: new THREE.TorusGeometry(0.45, 0.12, 4, 10),
  rock: new THREE.DodecahedronGeometry(1, 0),
  torus: new THREE.TorusGeometry(1, 0.05, 6, 36),
  tetra: new THREE.TetrahedronGeometry(1),
  slash: new THREE.PlaneGeometry(1.8, 0.55),
  spike: new THREE.ConeGeometry(0.32, 1.7, 5).translate(0, 0.85, 0),
  rune: new THREE.RingGeometry(0.62, 1, 6, 1).rotateX(-Math.PI / 2),
  rune2: new THREE.RingGeometry(0.9, 1, 48, 1).rotateX(-Math.PI / 2),
  crescent: new THREE.TorusGeometry(0.85, 0.08, 4, 22, Math.PI).rotateX(Math.PI / 2),
  unitZ: new THREE.CylinderGeometry(1, 1, 1, 6).rotateX(Math.PI / 2)
};
// 技ごとの形を作る基本形（技の shape 番号で組み合わせが変わる）
const PRIMS = [
  GEO.sphere, GEO.oct, SG.tetra, new THREE.IcosahedronGeometry(1, 0), SG.rock,
  new THREE.BoxGeometry(1.2, 1.2, 1.2), new THREE.ConeGeometry(0.7, 1.6, 6), new THREE.TorusKnotGeometry(0.6, 0.18, 48, 6),
  new THREE.TorusGeometry(0.7, 0.22, 6, 18), new THREE.CylinderGeometry(1, 1, 0.3, 5)
];
const RUNES = [];
for (let s = 3; s <= 9; s++) RUNES.push(new THREE.RingGeometry(0.62, 1, s, 1).rotateX(-Math.PI / 2));
const runeOf = (spec) => RUNES[(spec?.shape ?? 3) % 7];
const primOf = (spec) => {
  const v = spec?.shape ?? 0;
  return PRIMS[(v % 10 + Math.floor(v / 10)) % 10];
};
// ---- 技エフェクト素材：10属性 × 10種（0芯 1閃光 2光条 3煙 4衝撃輪 5魔法陣 6斬撃 7粒子 8爆発 9尾） ----
const FX_NAMES = ['fire', 'ice', 'thunder', 'wind', 'earth', 'light', 'dark', 'water', 'poison', 'blood'];
const texLoader = new THREE.TextureLoader();
const FX_TEX = {};
function fxTex(elem, slot) {
  const key = (elem % 10) * 10 + slot;
  if (!FX_TEX[key]) {
    const t = texLoader.load(`assets/fx-${FX_NAMES[elem % 10]}-${slot}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    FX_TEX[key] = t;
  }
  return FX_TEX[key];
}
// 起動時に全100枚を先読み
for (let e = 0; e < 10; e++) for (let s = 0; s < 10; s++) fxTex(e, s);
const elOf = (spec, fallback = 5) => (spec && spec.elem != null ? spec.elem : fallback);
const PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function fxSprite(elem, slot, size, opacity = 1) {
  opacity *= 0.25; // 光のにじみは控えめに
  const m = new THREE.SpriteMaterial({ map: fxTex(elem, slot), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity });
  m.userData.base = opacity;
  m.rotation = Math.random() * Math.PI * 2;
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}
function fxFlat(elem, slot, size, opacity = 1) {
  opacity *= 0.35;
  const m = new THREE.MeshBasicMaterial({ map: fxTex(elem, slot), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity, side: THREE.DoubleSide });
  m.userData.base = opacity;
  const p = new THREE.Mesh(PLANE, m);
  p.scale.setScalar(size);
  return p;
}
// 白ではなく、その色を明るくした芯色
// ---- 立体エフェクト用の共有ジオメトリ（属性ごとの3D形状） ----
const G3 = {
  flame: new THREE.ConeGeometry(0.35, 1.2, 7, 1, true).translate(0, 0.6, 0),
  crystal: new THREE.OctahedronGeometry(0.3, 0).scale(0.6, 2.2, 0.6),
  bolt: new THREE.BoxGeometry(0.07, 0.07, 1),
  helix: new THREE.TorusGeometry(1, 0.05, 6, 40, Math.PI * 1.6),
  rock: new THREE.DodecahedronGeometry(0.28, 0),
  beam: new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, true).translate(0, 0.5, 0),
  star: new THREE.OctahedronGeometry(0.22, 0),
  knot: new THREE.TorusKnotGeometry(0.5, 0.07, 64, 6, 2, 3),
  wave: new THREE.TorusGeometry(1, 0.12, 8, 48),
  drop: new THREE.SphereGeometry(0.14, 10, 8),
  bubble: new THREE.IcosahedronGeometry(0.2, 1),
  crescent: new THREE.TorusGeometry(0.9, 0.06, 4, 28, Math.PI * 0.9),
  core: new THREE.IcosahedronGeometry(0.5, 1)
};
let fx3dLive = 0;
let grandLive = 0;
function lite(color, k = 0.4) {
  return new THREE.Color(color).lerp(new THREE.Color(0xffffff), k).getHex();
}
// 技固有の飾り：芯の基本形＋周回する衛星＋輪
function decorate(g, spec, s = 1) {
  const v = spec.shape ?? 0;
  const ei = Math.floor(v / 10);
  const d = new THREE.Group();
  const geo = primOf(spec);
  const core = new THREE.Mesh(geo, glow(spec.color, 0.8));
  core.scale.setScalar(0.32 * s);
  outline(core, 1.12);
  d.add(core);
  const sats = ei % 4;
  for (let i = 0; i < sats; i++) {
    const m = new THREE.Mesh(geo, glow(lite(spec.color), 0.85));
    const a = (i / sats) * Math.PI * 2;
    m.position.set(Math.cos(a) * 0.6 * s, Math.sin(a) * 0.6 * s, 0);
    m.scale.setScalar(0.12 * s);
    d.add(m);
  }
  const rings = ei % 3;
  for (let i = 0; i < rings; i++) {
    const r = new THREE.Mesh(SG.torus, glow(spec.color, 0.7));
    r.scale.setScalar((0.5 + i * 0.22) * s);
    r.rotation.set(i * 1.1 + v * 0.3, v * 0.7, 0);
    d.add(r);
  }
  d.userData.decor = true;
  g.add(d);
  return d;
}

function fade(obj, k) {
  obj.traverse((o) => {
    if (o.material) {
      if (!o.material.transparent) {
        o.material.transparent = true;
        o.material.needsUpdate = true;
      }
      o.material.opacity = (o.material.userData.base ?? 1) * k;
    }
  });
}
function kill(parent, obj) {
  parent.remove(obj);
  obj.traverse((o) => o.material?.dispose());
}

function makeShape(kind, color, s = 1) {
  const g = new THREE.Group();
  const add = (geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    if (geo.type !== 'RingGeometry' && geo.type !== 'PlaneGeometry') outline(m, 1.1);
    g.add(m);
    return m;
  };
  const c = () => glow(color, 0.95);
  const w = () => glow(lite(color), 0.9);
  switch (kind) {
    case 'laser':
      add(SG.unitZ, glow(lite(color, 0.3), 0.95), 0, 0, 0, 0.05, 0.05, 1.2);
      add(SG.unitZ, glow(color, 0.6), 0, 0, 0, 0.13, 0.13, 1.4);
      break;
    case 'spark': {
      add(PRIMS[3], w(), 0, 0, 0, 0.3);
      add(GEO.sphere, glow(color, 0.45), 0, 0, 0, 0.6);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const b = add(SG.unitZ, c(), Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0, 0.03, 0.03, 0.6);
        b.lookAt(Math.cos(a) * 2, Math.sin(a) * 2, (i % 2) - 0.5);
      }
      g.userData.spin = 'z';
      break;
    }
    case 'arrow':
    case 'spear': {
      const k = kind === 'spear' ? 1.7 : 1;
      add(SG.shaft, c(), 0, 0, 0, k);
      add(SG.tip, w(), 0, 0, 0.95 * k, k * 1.3);
      add(SG.fin, c(), 0, 0, -0.7 * k, k).rotation.y = Math.PI / 2;
      add(SG.fin, c(), 0, 0, -0.7 * k, k).rotation.set(0, Math.PI / 2, Math.PI / 2);
      add(GEO.sphere, glow(color, 0.35), 0, 0, 0.9 * k, 0.3 * k);
      break;
    }
    case 'kunai':
      add(GEO.oct, w(), 0, 0, 0.1, 0.12, 0.05, 0.55);
      add(SG.torus, c(), 0, 0, -0.45, 0.12);
      add(GEO.sphere, glow(color, 0.3), 0, 0, 0, 0.3);
      g.userData.spin = 'z';
      break;
    case 'axe':
      add(SG.shaft, c(), 0, 0, 0, 0.7);
      add(SG.axeHead, w(), 0, 0, 0.45).rotation.z = Math.PI / 2;
      add(SG.gear, c(), 0, 0, 0, 1).rotation.y = Math.PI / 2;
      g.userData.spin = 'x';
      break;
    case 'ice':
      add(GEO.oct, c(), 0, 0, 0.1, 0.25, 0.25, 0.75);
      add(GEO.oct, w(), 0.22, 0.12, -0.2, 0.12, 0.12, 0.45);
      add(GEO.oct, c(), -0.2, -0.1, -0.15, 0.12, 0.12, 0.4);
      g.userData.spin = 'z';
      break;
    case 'bomb': {
      const body = add(GEO.sphere, new THREE.MeshStandardMaterial({ color: 0x2a2a34, roughness: 0.4, metalness: 0.5 }), 0, 0, 0, 0.4);
      body.material.userData.base = 1;
      add(GEO.sphere, w(), 0, 0.45, 0, 0.12);
      add(GEO.sphere, glow(color, 0.5), 0, 0.45, 0, 0.22);
      g.userData.spin = 'x';
      break;
    }
    case 'flame':
      add(GEO.sphere, w(), 0, 0, 0, 0.25);
      add(GEO.sphere, c(), 0, 0, 0, 0.45, 0.45, 0.6);
      add(SG.tip, glow(color, 0.6), 0, 0, -0.55, 2.2, 2.2, -2.4);
      break;
    case 'feather':
      add(GEO.oct, w(), 0, 0, 0, 0.18, 0.05, 0.7);
      add(SG.torus, c(), 0, 0, 0, 0.45);
      add(GEO.sphere, glow(color, 0.4), 0, 0, 0, 0.35);
      g.userData.spin = 'z';
      break;
    case 'crescent':
      add(SG.crescent, w(), 0, 0, 0, 1);
      add(SG.crescent, c(), 0, 0, -0.12, 1.15, 1, 1.15);
      break;
    case 'sword':
      add(SG.blade, w(), 0, 0, 0.7);
      add(SG.blade, c(), 0, 0, 0.7, 2.2, 1.6, 1.05);
      add(SG.guard, c(), 0, 0, -0.45);
      add(SG.hilt, c(), 0, 0, -0.75);
      break;
    case 'meteor': {
      const rock = add(SG.rock, new THREE.MeshStandardMaterial({ color: 0x3a2a24, emissive: color, emissiveIntensity: 0.7, roughness: 0.8 }), 0, 0, 0, 0.7);
      rock.material.userData.base = 1;
      add(GEO.sphere, glow(color, 0.45), 0, 0, 0, 0.95);
      add(SG.tip, glow(color, 0.7), 0, 0, -1.2, 5, 5, -5);
      g.userData.spin = 'x';
      break;
    }
    default:
      add(GEO.sphere, w(), 0, 0, 0, 0.28);
      add(GEO.sphere, glow(color, 0.5), 0, 0, 0, 0.55);
      add(SG.torus, c(), 0, 0, 0, 0.65);
      g.userData.spin = 'y';
  }
  g.scale.multiplyScalar(s);
  return g;
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) {
    d += Math.PI * 2;
  }
  return a + d * t;
}

export class Fighter {
  constructor(battle, key, o) {
    this.battle = battle;
    this.key = key;
    this.def = FIGHTERS[key];
    this.team = o.team;
    this.cpu = o.cpu ? { level: o.cpu, t: 0, strafe: 0, wantGuard: false } : null;
    this.remoteAuth = !!o.remote;
    this.verified = !!o.verified; // サーバー署名済みの強化値か
    this.netId = o.netId || null;
    this.isPlayer = !!o.player;
    this.name = o.name || this.def.name;
    this.scale = o.scale || 1;
    this.tint = o.tint ?? this.def.tint ?? null;
    const u = o.upg || {};
    this.upg = u;
    this.hpMul = o.hpMul || 1;
    this.balAtk = o.atkMul || 1; // 戦闘バランス用の攻撃倍率（人数差・章の進み具合）
    this.balDef = o.defMul || 1; // 受けるダメージ倍率
    this.atkMul = (1 + 0.06 * (u.atk || 0)) * (this.def.power || 1) * this.balAtk;
    this.defMul = (1 - 0.05 * (u.def || 0)) * (this.def.armor || 1) * this.balDef;
    this.fluxRate = 7 * (1 + 0.12 * (u.flux || 0)) * (this.def.fluxMul || 1);
    this.og = this.def.overGain * (1 + 0.1 * (u.over || 0));
    this.maxHp = Math.round(this.def.hp * (o.hpMul || 1) * (1 + 0.08 * (u.hp || 0)));
    this.hp = this.maxHp;
    this.flux = 50;
    this.over = 0;
    this.pos = new THREE.Vector3(o.pos[0], 0, o.pos[1]);
    this.netTarget = this.pos.clone();
    this.netMoving = false;
    this.vel = new THREE.Vector3();
    this.y = 0;
    this.vy = 0;
    this.facing = o.facing || 0;
    this.action = null;
    this.combo = 0;
    this.comboWindow = 0;
    this.stun = 0;
    this.status = {};
    this.dotAcc = 0;
    this.stFx = 0;
    this.guard = false;
    this.inv = 0;
    this.dead = false;
    // 覚醒：受けたダメージを蓄積（戦いをまたいで持ち越せる）→ 満タンで覚醒
    this.awk = Math.max(0, Math.min(99, +o.awk || 0));
    this.awakened = 0;
    this.lastSkill = null;
    this.radius = 0.45 * this.scale * (this.def.height / 1.8);
    this.root = new THREE.Group();
    this.visual = new THREE.Group();
    this.root.add(this.visual);
    this.gearIds = o.gear || null;
    // 召喚獣（通常攻撃の代わり）。gear.h に召喚獣ID
    this.summonId = typeof o.gear?.h === 'string' && SUMMON_DEFS[o.gear.h] ? o.gear.h : '';
    this.summon = null;
    this.summonCd = 0;
    this.buildModel(battle.assets[key]);
    battle.scene.add(this.root);
  }

  buildModel(gltf) {
    const h = this.def.height * this.scale;
    if (!gltf?.scene) {
      throw new Error(`[3D MODEL] ${this.key}: 元のGLBを取得できません。assets/models/ の公開を確認してください。`);
    }
    const modelTint = (this.key === 'gaien' || this.key === 'gaien2') ? null : this.tint;
    const instance = instantiateModel(gltf, h, modelTint);
    this.modelInstance = instance;
    this.visual.add(instance.wrapper);
    this.gaienWalk = attachGaienWalk(instance.model, this.key);
    this.gaienStyle = enhanceGaienModel(instance.model, this.key);
    this.mixer = new THREE.AnimationMixer(instance.model);
    this.clips = {};
    for (const clip of gltf.animations || []) {
      const n = clip.name.toLowerCase();
      for (const key of ['idle', 'walk', 'run', 'jump']) {
        if (n.includes(key) && !this.clips[key]) this.clips[key] = clip;
      }
    }
    // 装備：骨格と体形を測ってフィット（骨に付けてアニメに追従）
    const model = instance.model;
    this.gear = this.gearIds ? makeGear(h, this.gearIds.w, this.gearIds.a, model, this.visual) : null;
    const teamColor = this.team === 0 ? 0x7fd3ff : 0xff7a5a;
    this.ringMesh = new THREE.Mesh(GEO.ring, glow(teamColor, 0.7));
    this.ringMesh.scale.setScalar(0.8 * this.scale);
    this.ringMesh.position.y = 0.04;
    this.root.add(this.ringMesh);
    this.guardMesh = new THREE.Mesh(GEO.sphere, glow(0x9fd8ff, 0.25));
    this.guardMesh.scale.setScalar(h * 0.62);
    this.guardMesh.position.y = h * 0.5;
    this.guardMesh.visible = false;
    this.root.add(this.guardMesh);
  }

  anim(name) {
    if (!this.mixer || this.curAnim === name) {
      return;
    }
    const clip = this.clips[name] || (name === 'run' ? this.clips.walk : null) || this.clips.idle;
    this.curAnim = name;
    if (!clip) {
      return;
    }
    const a = this.mixer.clipAction(clip);
    if (a === this.curAction) {
      return;
    }
    a.reset().fadeIn(0.15).play();
    if (this.curAction) {
      this.curAction.fadeOut(0.15);
    }
    this.curAction = a;
  }

  forward() {
    return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
  }

  faceNearest(maxD) {
    const t = this.battle.nearestEnemy(this);
    if (t && t.pos.distanceTo(this.pos) < maxD) {
      this.facing = Math.atan2(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
    }
  }

  update(dt, inp) {
    this.motionDt = dt;
    if (this.mixer) {
      this.mixer.update(dt);
    }
    this.gaienStyle?.update(dt, this.dead ? false : (this.moving || this.netMoving));
    if (this.gear) animGear(this.gear, dt, !!this.action, this.vel.lengthSq() > 0.5);
    if (this.summonCd > 0) this.summonCd -= dt;
    if (this.formSwapCd > 0) this.formSwapCd -= dt;
    // 召喚獣は戦闘開始時と、倒されてから15秒後に自動で現れる
    else if (this.summonId && !this.summon && !this.dead && !this.remoteAuth) this.battle.spawnSummon(this);
    this.inv = Math.max(0, this.inv - dt);
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    if (this.dead) {
      this.visual.rotation.x = THREE.MathUtils.damp(this.visual.rotation.x, -Math.PI / 2, 6, dt);
      this.guardMesh.visible = false;
      this.sync();
      return;
    }
    if (this.remoteAuth) {
      this.pos.lerp(this.netTarget, 1 - Math.exp(-12 * dt));
      this.facing = lerpAngle(this.facing, this.netFacing ?? this.facing, 1 - Math.exp(-12 * dt));
      this.anim(this.netMoving ? 'run' : 'idle');
      this.sync();
      return;
    }
    this.tickStatus(dt);
    if (this.dead) {
      this.sync();
      return;
    }
    if (this.awakened > 0) {
      this.awakened -= dt;
      this.awkFx = (this.awkFx || 0) - dt;
      if (this.awkFx <= 0) {
        this.awkFx = 0.12;
        const p = this.pos.clone().setY(0.3 + Math.random() * 1.6 + this.y);
        p.x += (Math.random() - 0.5) * 0.7;
        p.z += (Math.random() - 0.5) * 0.7;
        this.battle.spark(p, 0xff2a3a, 0.45);
      }
      if (this.awakenAura) {
        this.awakenAura.rotation.y += dt * 3;
        this.awakenAura.scale.setScalar(1.25 + Math.sin(performance.now() / 120) * 0.12);
      }
      if (this.awakened <= 0) this.endAwaken();
    }
    const st = this.status;
    this.flux = Math.min(100, this.flux + (st.para ? 0 : this.fluxRate) * dt);
    this.guard = false;
    let moving = false;
    // 追加技：技を出した後、同じボタンを長押しし続けると発動（全モード共通）
    const fa = this.followArm;
    if (fa && inp && !this.dead) {
      fa.t += dt;
      const held = fa.cpu != null ? fa.cpu : !!inp[fa.hold];
      if (!held || fa.t > FOLLOW_MAX + 1) {
        this.followArm = null;
      } else if (fa.t >= FOLLOW_HOLD && this.stun <= 0) {
        this.followArm = null;
        this.startSkill(fa.i, null, true);
      }
    }
    if (this.stun > 0) {
      this.stun -= dt;
    } else if (this.action) {
      this.tickAction(dt);
    } else if (inp.guard && this.y <= 0) {
      this.guard = true;
    } else {
      const len = Math.hypot(inp.mx, inp.mz);
      if (len > 0.12) {
        const sp = this.def.speed * Math.min(1, len) * (st.slow ? 0.55 : st.para ? 0.65 : 1);
        this.vel.x = (inp.mx / len) * sp;
        this.vel.z = (inp.mz / len) * sp;
        this.facing = Math.atan2(inp.mx, inp.mz);
        moving = true;
      }
      if (inp.jump && this.y <= 0) {
        this.vy = 7.5;
      }
      const mv = len > 0.12;
      if (inp.attack) {
        this.startLight();
      } else if (inp.skill) {
        this.startSkill(this.poolPick(mv ? 1 : 0), 'holdSkill');
      } else if (inp.skill2) {
        this.startSkill(this.poolPick(mv ? 3 : 2), 'holdSkill2');
      } else if (inp.heal) {
        this.startSkill(4, 'holdHeal');
      } else if (inp.skillIdx != null) {
        this.startSkill(inp.skillIdx, 'cpu');
      } else if (inp.over) {
        this.startOver();
      }
    }
    this.pos.addScaledVector(this.vel, dt);
    if (!moving && !(this.action && this.action.keepVel)) {
      this.vel.multiplyScalar(Math.exp(-9 * dt));
    }
    this.vy -= 22 * dt;
    this.y = Math.max(0, this.y + this.vy * dt);
    if (this.y === 0) {
      this.vy = Math.max(0, this.vy);
    }
    const r = Math.hypot(this.pos.x, this.pos.z);
    if (r > ARENA_R) {
      this.pos.multiplyScalar(ARENA_R / r);
    }
    this.moving = moving;
    this.anim(this.y > 0.05 ? 'jump' : moving ? 'run' : 'idle');
    this.sync();
  }

  sync() {
    this.gaienWalk?.update(this.motionDt ?? (1 / 60), this.dead ? false : (this.moving || this.netMoving ? 'run' : false));
    this.root.position.set(this.pos.x, this.y, this.pos.z);
    this.root.rotation.y = this.facing;
    this.guardMesh.visible = this.guard;
    if (!this.mixer || !this.clips.idle) {
      const bob = (this.moving || this.netMoving) && !this.dead;
      this.visual.children[0].position.y = (this.baseY ??= this.visual.children[0].position.y) + (bob ? Math.abs(Math.sin(performance.now() / 70)) * 0.12 : 0);
    }
    const flashOn = this.hitFlash > 0;
    this.visual.position.x = flashOn ? (Math.random() - 0.5) * 0.12 : 0;
    this.hitFlash = Math.max(0, (this.hitFlash || 0) - 1 / 60);
  }

  // 状態異常の付与（この端末で操作している戦士のみ）
  applyStatus(key) {
    const info = ST_INFO[key];
    if (!info || this.dead || this.remoteAuth) {
      return;
    }
    // 覚醒中は状態異常を受けない
    if (this.awakened > 0) {
      this.battle.ui.popup(this.pos, '無効', '#ff8090');
      return;
    }
    this.status[key] = Math.max(this.status[key] || 0, info.dur);
    if (key === 'freeze' || key === 'petrify') {
      this.stun = Math.max(this.stun, info.dur);
      this.action = null;
    }
    const e = ELEMS[ST_ELEM[key]];
    this.battle.ui.popup(this.pos, e.sn, '#' + e.c.toString(16).padStart(6, '0'));
  }

  tickStatus(dt) {
    let dot = 0;
    for (const k in this.status) {
      this.status[k] -= dt;
      if (this.status[k] <= 0) {
        delete this.status[k];
        continue;
      }
      dot += ST_INFO[k].dot || 0;
    }
    if (dot > 0) {
      this.dotAcc += dt;
      if (this.dotAcc >= 0.5) {
        const dmg = Math.round(dot * this.dotAcc);
        this.dotAcc = 0;
        this.hp = Math.max(0, this.hp - dmg);
        this.battle.ui.popup(this.pos, dmg, '#c890ff');
        if (this.checkTransform()) return;
        if (this.hp <= 0) {
          this.dead = true;
        }
      }
    }
    const keys = Object.keys(this.status);
    this.stFx -= dt;
    if (keys.length && this.stFx <= 0) {
      this.stFx = 0.25;
      const k = keys[Math.floor(Math.random() * keys.length)];
      const p = this.pos.clone().setY(0.4 + Math.random() * 1.4 + this.y);
      p.x += (Math.random() - 0.5) * 0.6;
      p.z += (Math.random() - 0.5) * 0.6;
      this.battle.fxPop(p, ST_ELEM[k], Math.random() < 0.5 ? 7 : 3, 0.7, 0.5, { rise: 1.2, grow: 1.4, op: 0.8 });
    }
  }

  startLight() {
    this.combo = this.comboWindow > 0 ? (this.combo + 1) % 3 : 0;
    this.faceNearest(4);
    this.action = { type: 'light', t: 0, dur: this.combo === 2 ? 0.42 : 0.32, hitAt: 0.13, hit: false, step: this.combo };
    this.vel.copy(this.forward().multiplyScalar(3));
  }

  // 全属性の技を持つ戦士（ヴェスペラ）は押すたびに次の技へ
  poolPick(i) {
    const p = this.def.pool;
    if (!p?.length) return i;
    const j = this.poolI ?? -1;
    const next = p[(j + 1) % p.length];
    if (this.flux >= (this.def.skills[next]?.cost ?? 0) && !this.status.silence) this.poolI = (j + 1) % p.length;
    return next;
  }

  startSkill(i, hold = null, follow = false) {
    const now = performance.now() / 1000;
    const spec = follow ? followSpec(this.def, i) : this.def.skills[i];
    if (!spec || this.flux < spec.cost) {
      return;
    }
    // 技の順番待ち：同じチームで誰かが技を出している間は出せない（早い者順・重ならない）
    const lk = (this.battle.skillLock ||= {})[this.team];
    if (lk && lk.f !== this && lk.f.hp > 0 && lk.until > now) {
      if (this.isPlayer && (!this.waitMsg || now - this.waitMsg > 0.8)) {
        this.waitMsg = now;
        this.battle.ui.popup?.(this.pos, '順番待ち', '#a0b8ff');
      }
      return;
    }
    if (this.status.silence) {
      if (!this.silenceMsg || performance.now() - this.silenceMsg > 800) {
        this.silenceMsg = performance.now();
        this.battle.ui.popup(this.pos, '封技中', '#6aa0ff');
      }
      return;
    }
    this.flux -= spec.cost;
    this.faceNearest(14);
    this.lastSkill = { i, t: now, followed: follow };
    // 長押し待ち（CPUは確率で派生）
    this.followArm = follow || !hold ? null : { i, t: 0, hold, cpu: hold === 'cpu' ? Math.random() < 0.45 : null };
    this.battle.cast(this, (follow ? 'f' : 's') + i);
    if (follow) this.battle.ui.popup?.(this.pos, '追加技！', '#ffd36a');
  }

  startOver() {
    if (this.over < 100) {
      return;
    }
    this.over = 0;
    this.faceNearest(14);
    this.battle.cast(this, this.awakened > 0 ? 'hi' : 'over');
  }

  // ---- 覚醒（赤く染まり、受けるダメージ半減） ----
  awaken() {
    if (this.awakened > 0 || this.dead) return;
    this.awakened = AWAKEN_TIME;
    this.awk = 0;
    // 覚醒した瞬間に状態異常を解除（凍結・石化の硬直も解く）
    if (this.status.freeze || this.status.petrify) this.stun = 0;
    for (const k in this.status) delete this.status[k];
    this.applyRed();
    this.battle.awakenFx(this);
  }
  applyRed() {
    this.redMats = [];
    this.visual.traverse((c) => {
      if (!c.isMesh || !c.material) return;
      const orig = c.material;
      const m = orig.clone();
      m.color?.lerp(AWAKEN_RED, 0.55);
      if (m.emissive) {
        m.emissive.setHex(0x8a0010);
        m.emissiveIntensity = 0.7;
      }
      c.material = m;
      this.redMats.push([c, orig, m]);
    });
    if (!this.awakenAura) {
      this.awakenAura = new THREE.Mesh(GEO.ring, glow(0xff2030, 0.85));
      this.awakenAura.position.y = 0.06;
      this.root.add(this.awakenAura);
    }
  }
  endAwaken() {
    this.awakened = 0;
    for (const [c, orig, m] of this.redMats || []) {
      c.material = orig;
      m.dispose();
    }
    this.redMats = null;
    if (this.awakenAura) {
      this.root.remove(this.awakenAura);
      this.awakenAura.material.dispose();
      this.awakenAura = null;
    }
  }

  tickAction(dt) {
    const a = this.action;
    a.t += dt;
    const k = a.t / a.dur;
    if (a.type === 'light') {
      const L = this.def.light;
      this.visual.rotation.y = L.spin ? Math.min(1, k * 1.3) * Math.PI * 2 * (a.step % 2 ? -1 : 1) : Math.sin(k * Math.PI) * 0.9 * (a.step % 2 ? -1 : 1);
      if (!a.hit && a.t >= a.hitAt) {
        a.hit = true;
        const big = a.step === 2;
        if (this.def.manualFormSwap && this.manualFormSwap()) {
          // 変身後の通常攻撃性能をそのまま使う
        }
        const curL = this.def.light;
        if (this.summonId && this.battle.summonStrike(this, big)) {
          // 召喚獣が通常攻撃の代わりに攻撃
        } else if (curL.shots) {
          this.battle.laserVolley(this, curL, big ? curL.shots + 2 : curL.shots);
        } else {
          this.battle.swingFx(this);
          this.battle.meleeHit(this, curL.range, curL.dmg * (big ? 1.6 : 1), big ? 0.5 : 0.25, big ? 8 : 2.5, null, null, !!curL.spin);
        }
      }
    } else if (a.type === 'dash') {
      this.battle.meleeHit(this, 1.8, a.spec.dmg, 0.55, 9, a.hitSet, a.spec);
      a.trail = (a.trail || 0) - dt;
      if (a.trail <= 0) {
        a.trail = 0.035;
        this.battle.afterimage(this, a.spec.color);
      }
    } else if (a.type === 'cast') {
      this.visual.position.y = Math.sin(k * Math.PI) * 0.3;
    }
    if (a.t >= a.dur) {
      this.visual.rotation.y = 0;
      this.visual.position.y = 0;
      if (a.type === 'light') {
        this.comboWindow = 0.4;
      }
      this.action = null;
    }
  }

  receive(dmg, stun, kx, kz) {
    if (this.dead) {
      return 0;
    }
    if (this.guard) {
      const f = this.forward();
      const dirLen = Math.hypot(kx, kz) || 1;
      if (-(f.x * kx + f.z * kz) / dirLen > 0.2) {
        dmg *= 0.2;
        stun *= 0.25;
        kx *= 0.3;
        kz *= 0.3;
        this.battle.spark(this.pos.clone().setY(1.1), 0x9fd8ff, 0.9);
      }
    }
    dmg = Math.round(dmg * this.defMul * (this.status.curse ? 1.3 : 1) * (this.awakened > 0 ? 0.5 : 1));
    this.hp = Math.max(0, this.hp - dmg);
    // 蓄積ダメージ：最大体力の1.2倍ぶん受けると覚醒
    if (this.awakened <= 0 && dmg > 0 && this.hp > 0) {
      this.awk = Math.min(100, this.awk + (dmg / this.maxHp) * 100 / 1.2);
      if (this.awk >= 100) this.awaken();
    }
    // 覚醒中はスーパーアーマー：ひるみ・吹き飛ばしを受けない（ダメージ半減はそのまま）
    if (this.awakened > 0) {
      stun = 0;
      kx = kz = 0;
      this.battle.spark(this.pos.clone().setY(1.1), 0xff4060, 0.5);
    }
    this.stun = Math.max(this.stun, stun);
    if (stun > 0.2) {
      this.action = null;
      this.visual.rotation.y = 0;
    }
    if (this.awakened <= 0) this.vel.set(kx, 0, kz);
    this.inv = 0.04;
    this.hitFlash = 0.15;
    this.over = Math.min(100, this.over + dmg * 0.06 * this.og);
    if (this.checkTransform()) return dmg;
    const vo = this.battle.ui.voice;
    if (this.hp <= 0) {
      this.dead = true;
      vo?.(this, 'ko');
    } else if (!this.pinchSaid && this.hp < this.maxHp * 0.25) {
      this.pinchSaid = true;
      vo?.(this, 'pinch');
    } else if (dmg > this.maxHp * 0.04) {
      vo?.(this, 'hurt');
    }
    return dmg;
  }

  // 手動変身：通常近接攻撃を出すたびに、進化前/進化後を切り替える
  manualFormSwap() {
    const nk = this.def.manualForm2 || this.def.manualBase;
    if (!nk || this.formSwapCd > 0 || !FIGHTERS[nk]) return false;
    this.formSwapCd = 0.22;
    const hpRate = Math.max(0.08, Math.min(1, this.hp / Math.max(1, this.maxHp || 1)));
    const flux = this.flux;
    const over = this.over;
    const stun = this.stun;
    const act = this.action;
    this.key = nk;
    this.def = FIGHTERS[nk];
    this.name = this.def.name;
    const u = this.upg;
    this.atkMul = (1 + 0.06 * (u.atk || 0)) * (this.def.power || 1) * this.balAtk;
    this.defMul = (1 - 0.05 * (u.def || 0)) * (this.def.armor || 1) * this.balDef;
    this.fluxRate = 7 * (1 + 0.12 * (u.flux || 0)) * (this.def.fluxMul || 1);
    this.og = this.def.overGain * (1 + 0.1 * (u.over || 0));
    this.maxHp = Math.round(this.def.hp * this.hpMul * (1 + 0.08 * (u.hp || 0)));
    this.hp = Math.max(1, Math.round(this.maxHp * hpRate));
    this.flux = Math.min(100, Math.max(flux, 36));
    this.over = over;
    this.stun = Math.min(stun, 0.12);
    this.inv = Math.max(this.inv, 0.18);
    this.dead = false;
    this.gaienWalk?.stop();
    this.gaienWalk = null;
    this.gaienStyle?.stop?.();
    this.gaienStyle = null;
    // 旧形態のGPU資源を解放し、同じ見た目に関連する共有GLBは残す。
    disposeModel(this.modelInstance, this.mixer);
    this.modelInstance = null;
    this.visual.clear();
    this.root.remove(this.ringMesh, this.guardMesh);
    this.visual.rotation.set(0, 0, 0);
    this.visual.position.set(0, 0, 0);
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.curAnim = null;
    this.curAction = null;
    this.baseY = undefined;
    this.radius = 0.45 * this.scale * (this.def.height / 1.8);
    this.buildModel(this.battle.assets[nk]);
    this.action = act;
    if (this.awakened > 0) {
      this.redMats = null;
      this.applyRed();
    }
    this.battle.transformFx(this);
    return true;
  }

  // 体力が半分を切ったら第二形態へ変身（form2 を持つ戦士のみ・1回だけ）
  checkTransform(force = false) {
    if (this.transformed || !this.def.form2) return false;
    if (!force && (this.remoteAuth || this.hp > this.maxHp * 0.5)) return false;
    const nk = this.def.form2;
    if (!FIGHTERS[nk]) return false;
    this.transformed = true;
    this.key = nk;
    this.def = FIGHTERS[nk];
    this.name = this.def.name;
    const u = this.upg;
    this.atkMul = (1 + 0.06 * (u.atk || 0)) * (this.def.power || 1) * this.balAtk;
    this.defMul = (1 - 0.05 * (u.def || 0)) * (this.def.armor || 1) * this.balDef;
    this.fluxRate = 7 * (1 + 0.12 * (u.flux || 0)) * (this.def.fluxMul || 1);
    this.og = this.def.overGain * (1 + 0.1 * (u.over || 0));
    this.maxHp = Math.round(this.def.hp * this.hpMul * (1 + 0.08 * (u.hp || 0)));
    this.hp = this.maxHp;
    this.flux = 100;
    this.over = Math.max(this.over, 50);
    this.status = {};
    this.stun = 0;
    this.action = null;
    this.inv = 1.6;
    this.dead = false;
    // 見た目を作り直す（元のGLBキャッシュは残し、複製した材質だけ解放）
    if (this.redMats) {
      for (const [part, original, temporary] of this.redMats) {
        part.material = original;
        temporary.dispose();
      }
      this.redMats = null;
    }
    disposeModel(this.modelInstance, this.mixer);
    this.modelInstance = null;
    this.gaienWalk?.stop();
    this.gaienWalk = null;
    this.gaienStyle?.stop?.();
    this.gaienStyle = null;
    this.visual.clear();
    this.root.remove(this.ringMesh, this.guardMesh);
    this.visual.rotation.set(0, 0, 0);
    this.visual.position.set(0, 0, 0);
    this.mixer?.stopAllAction();
    this.mixer = null;
    this.curAnim = null;
    this.curAction = null;
    this.baseY = undefined;
    this.radius = 0.45 * this.scale * (this.def.height / 1.8);
    this.buildModel(this.battle.assets[nk]);
    if (this.awakened > 0) {
      this.redMats = null;
      this.applyRed(); // オーラは root に残っているので再利用
    }
    this.battle.transformFx(this);
    return true;
  }
}

export class Battle {
  constructor(scene, camera, opts) {
    fx3dLive = 0;
    this.scene = scene;
    this.camera = camera;
    this.assets = opts.assets;
    this.ui = opts.ui;
    this.net = opts.net || null;
    this.fighters = [];
    this.summons = new Set(); // 消滅演出中で使い手から離れた召喚獣も管理する
    this.effects = [];
    this.fx = new THREE.Group();
    scene.add(this.fx);
    this.slowmo = 0;
    this.shake = 0;
    this.ended = false;
    this.camCenter = new THREE.Vector3();
    // 技の閃光用ライト（数を固定してシェーダー再コンパイルを防ぐ）
    this.fxLights = [];
    for (let i = 0; i < 4; i++) {
      const L = new THREE.PointLight(0xffffff, 0, 14, 2);
      L.userData.t = 0;
      this.fx.add(L);
      this.fxLights.push(L);
    }
    this.lightIdx = 0;
    grandLive = 0;
  }

  // 一瞬の色付き閃光
  flashLight(pos, color, power = 1, life = 0.4) {
    const L = this.fxLights[this.lightIdx++ % this.fxLights.length];
    L.position.copy(pos).setY(Math.max(1, pos.y + 0.8));
    L.color.setHex(color);
    L.userData.t = life;
    L.userData.life = life;
    L.userData.p = 4 * power; // 閃光は弱めに
  }

  // 追加技：パチパチと弾け飛ぶ火花＋はじける衝撃環＋連続ポップ
  burstFx(pos, color, el) {
    const N = 70;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(N * 3), v = [];
    for (let i = 0; i < N; i++) {
      p[i * 3] = pos.x; p[i * 3 + 1] = 1.1; p[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2 - 0.2, s = 5 + Math.random() * 9;
      v.push(Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 3, Math.sin(a) * Math.cos(e) * s);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const mat = new THREE.PointsMaterial({ color: lite(color, 0.55), size: 0.28, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    this.fx.add(pts);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 40), glow(lite(color, 0.7), 0.95));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pos.x, 0.12, pos.z);
    this.fx.add(ring);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), glow(0xffffff, 0.9));
    core.position.set(pos.x, 1.1, pos.z);
    this.fx.add(core);
    let t = 0, pops = 0;
    const life = 0.75;
    this.addEffect((dt) => {
      t += dt;
      const k = t / life;
      for (let i = 0; i < N; i++) {
        v[i * 3 + 1] -= 18 * dt;
        v[i * 3] *= 0.96; v[i * 3 + 2] *= 0.96;
        p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] = Math.max(0.05, p[i * 3 + 1] + v[i * 3 + 1] * dt); p[i * 3 + 2] += v[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - k) * (0.6 + 0.4 * Math.sin(t * 60)); // チカチカ明滅
      mat.size = 0.28 * (1 - k * 0.5);
      ring.scale.setScalar(1 + k * 7);
      ring.material.opacity = Math.max(0, 0.95 * (1 - k * 1.4));
      core.scale.setScalar(Math.max(0.01, 1.6 - k * 4));
      core.material.opacity = Math.max(0, 0.9 - k * 3);
      // 弾けの連鎖：周囲で小さな破裂が続く
      if (pops < 4 && t > pops * 0.09) {
        pops++;
        const q = new THREE.Vector3(pos.x + (Math.random() - 0.5) * 3, 0.9 + Math.random(), pos.z + (Math.random() - 0.5) * 3);
        this.fxPop(q, el, 6, 1.2, 0.25, { grow: 2.6, spin: 6 });
      }
      if (t < life) return true;
      for (const o of [pts, ring, core]) {
        this.fx.remove(o);
        o.geometry.dispose();
        o.material.dispose();
      }
      return false;
    });
    this.flashLight(pos, color, 1.2, 0.25);
    this.shake = Math.max(this.shake || 0, 0.25);
  }

  // 豪華化レイヤー：多重魔法陣・螺旋に昇る光粒・光柱・衝撃環・飛散する光条・閃光
  grandFx(pos, elem, color, power = 1) {
    if (grandLive > 14) return;
    grandLive++;
    const P = power;
    const g = new THREE.Group();
    g.position.set(pos.x, 0.05, pos.z);
    this.fx.add(g);
    const lc = lite(color, 0.5), wc = lite(color, 0.85);
    const parts = [];
    const mk = (geo, col, op) => {
      const m = new THREE.Mesh(geo, glow(col, op));
      g.add(m);
      parts.push(m);
      return m;
    };
    // 3段に重なる回転魔法陣（地面・中段・上空）
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = mk(i === 1 ? SG.rune2 : runeOf({ elem }), i ? lc : color, 0.85 - i * 0.15);
      r.position.y = i * 1.3 * P;
      r.userData.s = (1.6 - i * 0.35) * P;
      r.userData.spd = (i % 2 ? -1 : 1) * (3 + i * 2);
      rings.push(r);
    }
    // 外周の細い衝撃環を2重に
    const shock = [mk(G3.wave, wc, 0.9), mk(G3.wave, color, 0.6)];
    for (const s of shock) s.rotation.x = Math.PI / 2;
    // 中央の光柱（外殻＋白い芯）
    const pillarA = mk(G3.beam, color, 0.4);
    const pillarB = mk(G3.beam, 0xffffff, 0.65);
    // 螺旋に昇る光粒
    const orbs = [];
    const no = Math.round(10 + P * 8);
    for (let i = 0; i < no; i++) {
      const o = mk(i % 3 ? G3.star : G3.drop, i % 2 ? color : wc, 1);
      o.userData.a = (i / no) * Math.PI * 2;
      o.userData.r = (1.2 + (i % 3) * 0.5) * P;
      o.userData.h = 0;
      o.userData.vs = 2.5 + Math.random() * 3;
      orbs.push(o);
    }
    // 放射状に飛ぶ光条
    const rays = [];
    for (let i = 0; i < 12; i++) {
      const ray = mk(G3.bolt, i % 2 ? wc : color, 1);
      const a = (i / 12) * Math.PI * 2;
      ray.userData.dir = new THREE.Vector3(Math.cos(a), 0.25 + Math.random() * 0.5, Math.sin(a)).normalize();
      ray.position.y = 1;
      ray.lookAt(ray.userData.dir.clone().add(ray.position));
      rays.push(ray);
    }
    this.flashLight(new THREE.Vector3(pos.x, 1, pos.z), color, P, 0.5);
    const life = 0.8 + P * 0.35;
    let t = 0;
    this.addEffect((dt) => {
      t += dt;
      const k = Math.min(1, t / life);
      const ease = 1 - Math.pow(1 - Math.min(1, k * 2.5), 3);
      for (const r of rings) {
        r.scale.setScalar(r.userData.s * (0.3 + ease * 0.9));
        r.rotation.y += r.userData.spd * dt;
      }
      shock[0].scale.setScalar(0.5 + k * 7 * P);
      shock[1].scale.setScalar(0.3 + Math.max(0, k - 0.15) * 5.5 * P);
      shock[0].position.y = 0.1;
      shock[1].position.y = 0.2;
      const pw = Math.sin(Math.min(1, k * 1.6) * Math.PI);
      pillarA.scale.set(1.4 * P * (0.4 + pw), 9 * P * Math.min(1, k * 5), 1.4 * P * (0.4 + pw));
      pillarB.scale.set(0.5 * P * pw + 0.01, 10 * P * Math.min(1, k * 5), 0.5 * P * pw + 0.01);
      for (const o of orbs) {
        const u = o.userData;
        u.a += dt * (4 + u.vs * 0.4);
        u.h += dt * u.vs;
        const rr = u.r * (1 - k * 0.6);
        o.position.set(Math.cos(u.a) * rr, u.h, Math.sin(u.a) * rr);
        o.rotation.y += dt * 8;
        o.scale.setScalar(Math.max(0.05, (1 - k) * 1.2));
      }
      for (const ray of rays) {
        ray.position.addScaledVector(ray.userData.dir, dt * 14 * P);
        ray.scale.set(1.8, 1.8, 0.5 + 3 * Math.sin(Math.min(1, k * 2) * Math.PI));
      }
      fade(g, 1 - k * k);
      if (k >= 1) {
        kill(this.fx, g);
        grandLive--;
        return false;
      }
      return true;
    });
  }

  // 第二形態への変身演出
  transformFx(f) {
    const p = f.pos.clone();
    this.slowmo = Math.max(this.slowmo, 1.2);
    this.shake = Math.max(this.shake, 1.2);
    this.ui.flash();
    this.ui.flash();
    this.ui.sfx('burst');
    this.ui.banner?.({ name: `— ${f.def.title} —` }, '真の姿が目を覚ます');
    this.ui.popup(p, '変身！', '#ff6080');
    for (let i = 0; i < 3; i++) {
      this.addEffect(((d) => (dt) => {
        d -= dt;
        if (d > 0) return true;
        const c = [0xa040ff, 0xff2050, 0xffd060][i];
        this.grandFx(p, i === 1 ? 9 : 6, c, 1.6 + i * 0.4);
        this.fx3d(p.clone().setY(1), [6, 9, 5][i], 2, c);
        this.burst(p.clone().setY(1.2), c, 2.4, { elem: [6, 9, 5][i] });
        return false;
      })(i * 0.25));
    }
    for (const e of this.enemiesOf(f)) {
      if (!e.remoteAuth && e.pos.distanceTo(p) < 7) {
        const d = e.pos.clone().sub(p).setY(0).normalize().multiplyScalar(12);
        e.vel.set(d.x, 0, d.z);
        e.stun = Math.max(e.stun, 0.6);
      }
    }
  }

  add(key, o) {
    const f = new Fighter(this, key, o);
    this.fighters.push(f);
    return f;
  }

  enemiesOf(f) {
    return this.fighters.filter((e) => e.team !== f.team && !e.dead);
  }

  nearestEnemy(f) {
    let best = null;
    let bd = Infinity;
    for (const e of this.enemiesOf(f)) {
      const d = e.pos.distanceToSquared(f.pos);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  meleeHit(f, range, dmg, stun, kb, hitSet, spec, omni) {
    const fw = f.forward();
    for (const e of this.enemiesOf(f)) {
      if (hitSet && hitSet.has(e)) {
        continue;
      }
      const dx = e.pos.x - f.pos.x;
      const dz = e.pos.z - f.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < range + e.radius && (omni || d < 0.9 || (dx * fw.x + dz * fw.z) / d > 0.25)) {
        hitSet?.add(e);
        this.applyHit(f, e, dmg, stun, kb, f.pos, spec);
      }
    }
  }

  strikeAt(owner, x, z, radius, dmg, stun, kb, spec) {
    if (dmg <= 0) {
      return;
    }
    const p = new THREE.Vector3(x, 0, z);
    for (const e of this.enemiesOf(owner)) {
      if (e.pos.distanceTo(p) < radius + e.radius) {
        this.applyHit(owner, e, dmg, stun, kb, p, spec);
      }
    }
  }

  // 属性技は確率で状態異常（奥義は高確率）
  rollStatus(att, spec) {
    if (!spec || spec.elem == null || spec.kind === 'heal') {
      return null;
    }
    const chance = spec === att.def.over || spec.hi ? 0.4 : 0.25;
    return Math.random() < chance ? ELEMS[spec.elem].st : null;
  }

  applyHit(att, tgt, dmg, stun, kb, from, spec) {
    if (att.remoteAuth || tgt.dead) {
      return;
    }
    const dir = tgt.pos.clone().sub(from).setY(0);
    if (dir.lengthSq() < 1e-4) {
      dir.copy(att.forward());
    }
    dir.normalize().multiplyScalar(kb);
    dmg *= att.atkMul * (att.status.blind ? 0.6 : 1);
    att.over = Math.min(100, att.over + dmg * 0.12 * att.og);
    this.spark(tgt.pos.clone().setY(1.1), spec ? spec.color : att.def.light.color ?? att.def.color, 0.7);
    this.fxPop(tgt.pos.clone().setY(1.1), elOf(spec, elOf(att.def.skills[0])), 1, 1.4, 0.22, { grow: 1.8, spin: 6 });
    this.ui.sfx('hit');
    const st = this.rollStatus(att, spec);
    if (tgt.remoteAuth) {
      this.net?.hit({ to: tgt.netId, dmg: Math.round(dmg), stun, kx: dir.x, kz: dir.z, st });
      this.ui.popup(tgt.pos, Math.round(dmg), '#ffe9a8');
      if (st) this.ui.popup(tgt.pos, ELEMS[ST_ELEM[st]].sn, '#' + ELEMS[ST_ELEM[st]].c.toString(16).padStart(6, '0'));
      return;
    }
    if (tgt.inv > 0) {
      return;
    }
    if (this.summonBlock(tgt, from, dmg)) return;
    const real = tgt.receive(dmg, stun, dir.x, dir.z);
    if (st && real > 0) {
      tgt.applyStatus(st);
    }
    this.ui.popup(tgt.pos, real, tgt.isPlayer ? '#ff8f7a' : '#ffe9a8');
    if (tgt.isPlayer || dmg > 100) {
      this.shake = Math.max(this.shake, Math.min(0.5, dmg / 300));
    }
  }

  receiveNetHit(e) {
    const t = this.fighters.find((f) => f.netId === e.to && !f.remoteAuth);
    if (t) {
      // 受信する攻撃の検証：攻撃者の実在・生存・距離・攻撃回数・技のクールダウン・1撃の上限
      const a = this.fighters.find((f) => f.netId === e.from && f.remoteAuth);
      if (!a || a.hp <= 0 || t.hp <= 0) return;
      const now = performance.now() / 1000;
      const dx = a.pos.x - t.pos.x, dz = a.pos.z - t.pos.z;
      const dist = Math.hypot(dx, dz);
      if (!(dist <= ARENA_R * 2 + 2)) return; // 闘技場の外からの攻撃は無効
      let dmg = Math.max(0, Math.min(+e.dmg || 0, netHitCap(a)));
      // 通常攻撃の届く距離を超える大きな一撃は、直前（3秒以内）に技・奥義を出していなければ無効
      const lightCap = Math.round((+a.def.light?.dmg || 30) * (1 + 0.06 * (a.verified ? a.upg.atk || 0 : 0)) * (a.def.power || 1) * 1.6);
      const castRecent = a.netCastAt && now - a.netCastAt < 3;
      if (dmg > lightCap && !castRecent) dmg = lightCap;
      if (dist > 4.5 && !castRecent) return;
      // 攻撃回数：1秒あたり最大10撃、1秒あたりの総ダメージは上限の3倍まで
      const w = (a.netHitWin ||= { t: now, n: 0, d: 0 });
      if (now - w.t > 1) { w.t = now; w.n = 0; w.d = 0; }
      if (w.n >= 10 || w.d + dmg > netHitCap(a) * 3) return;
      w.n++;
      w.d += dmg;
      const real = t.receive(dmg, e.stun, e.kx, e.kz);
      this.ui.popup(t.pos, real, '#ff8f7a');
      if (e.st) t.applyStatus(e.st);
      this.ui.sfx('hit');
      this.shake = Math.max(this.shake, 0.25);
    }
  }

  // 覚醒の演出（カットイン・赤い爆光）
  awakenFx(f) {
    const p = f.pos.clone();
    this.ui.popup(p, '覚醒！', '#ff3040');
    this.ui.cutin?.(f, '覚醒', '受けるダメージ半減 ／ 奥義が秘奥義に');
    this.ui.sfx('burst');
    this.shake = Math.max(this.shake, 0.6);
    this.slowmo = Math.max(this.slowmo, 0.5);
    this.grandFx(p, 9, 0xff2030, 1.6);
    this.fx3d(p.clone().setY(1), 0, 1.6, 0xff3040);
    this.burst(p.clone().setY(1.2), 0xff2030, 2, { elem: 0 });
  }

  cast(f, slot, net) {
    const idx = Math.max(0, Math.min((f.def.skills?.length || 1) - 1, +slot.slice(1) || 0));
    const spec = slot === 'over' ? f.def.over
      : slot === 'hi' ? hiSpec(f.def)
        : slot[0] === 'f' ? followSpec(f.def, idx) || f.def.skills[0]
          : f.def.skills[idx] || f.def.skills[0];
    const isOver = slot === 'over' || slot === 'hi';
    // 通信相手の技：クールダウン（技0.35秒・奥義3秒）より速い連発は無視
    if (net && f.remoteAuth) {
      const nowS = performance.now() / 1000;
      const cd = isOver ? 3 : 0.35;
      const last = isOver ? f.netOverAt : f.netSkillAt;
      if (last && nowS - last < cd) return;
      if (isOver) f.netOverAt = nowS;
      else f.netSkillAt = nowS;
      f.netCastAt = nowS;
    }
    // 技の順番：このチームの技枠を確保（通信相手の技も含む）
    if (!isOver) (this.skillLock ||= {})[f.team] = { f, until: performance.now() / 1000 + (spec.kind === 'dash' ? (spec.dur || 0.5) + 0.25 : 0.9) };
    let tx;
    let tz;
    if (net) {
      tx = net.tx;
      tz = net.tz;
      f.facing = net.ry;
    } else {
      const t = this.nearestEnemy(f);
      const fw = f.forward();
      tx = t ? t.pos.x : f.pos.x + fw.x * 5;
      tz = t ? t.pos.z : f.pos.z + fw.z * 5;
      if (this.net && f.netId) {
        this.net.cast({ id: f.netId, slot, tx, tz, ry: f.facing });
      }
    }
    this.ui.skillName?.(f, spec, isOver);
    if (slot === 'hi') {
      // 秘奥義：カットイン＋長いスロー＋多重の大爆光
      this.ui.cutin?.(f, spec.name, '秘奥義');
      this.ui.banner(f, spec.name);
      this.slowmo = 1.4;
      this.shake = Math.max(this.shake, 1);
      this.ui.flash?.();
      this.ui.sfx('burst');
      this.ui.sfx('skill', spec);
      const el = elOf(spec);
      for (let i = 0; i < 4; i++) {
        let d = 0.1 + i * 0.22;
        this.addEffect((dt) => {
          d -= dt;
          if (d > 0) return true;
          const a = (i / 4) * Math.PI * 2;
          const q = new THREE.Vector3(tx + Math.cos(a) * 2.2, 0.05, tz + Math.sin(a) * 2.2);
          this.grandFx(q, el, i % 2 ? 0xff3040 : spec.color, 1.8);
          this.fx3d(q.clone().setY(0.8), (el + i * 3) % 10, 1.8, spec.color);
          return false;
        });
      }
    } else if (slot === 'over') {
      this.ui.banner(f, spec.name);
      this.slowmo = 0.6;
      this.ui.sfx('burst');
      this.ui.sfx('skill', spec);
    } else {
      this.ui.sfx('skill', spec);
      this.ui.callout(f, spec.follow ? `追加技！ ${spec.name}` : spec.name);
    }
    if (!f.remoteAuth) {
      f.action = spec.kind === 'dash'
        ? { type: 'dash', t: 0, dur: spec.dur, keepVel: true, hitSet: new Set(), spec }
        : { type: 'cast', t: 0, dur: 0.45 };
      if (spec.kind === 'dash') {
        f.vel.copy(f.forward().multiplyScalar(spec.speed));
      } else {
        f.vel.set(0, 0, 0);
      }
    }
    this.castFx(f, spec.color, spec);
    // 技の具現化：狙った地点にも属性の立体エフェクトと閃光を出す
    {
      const tp = new THREE.Vector3(tx, 0.6, tz);
      const el = elOf(spec);
      let d = spec.kind === 'dash' ? 0.15 : 0.28;
      this.addEffect((dt) => {
        d -= dt;
        if (d > 0) return true;
        this.fx3d(tp, el, isOver ? 2 : spec.follow ? 1.5 : 1.1, spec.color);
        this.fxPop(tp.clone().setY(0.08), el, 4, isOver ? 5 : 2.6, 0.5, { flat: true, grow: 2.2 });
        this.fxPop(tp.clone().setY(1.2), el, 8, isOver ? 3.6 : 1.8, 0.4, { grow: 1.8, spin: 3 });
        this.flashLight(tp, spec.color, isOver ? 1.6 : 0.8, 0.35);
        if (spec.follow) this.burstFx(tp, spec.color, el);
        return false;
      });
    }
    if (spec.kind === 'projectile') {
      const cnt = Math.max(1, Math.floor(+spec.count || 1));
      const spr = Number.isFinite(+spec.spreadAng) ? +spec.spreadAng : 0;
      for (let i = 0; i < cnt; i++) {
        const ang = f.facing + (i - (cnt - 1) / 2) * spr;
        if (spec.chain) {
          let w = -i * spec.chain;
          this.addEffect((dt) => {
            w += dt;
            if (w >= 0) {
              this.projectile(f, spec, f.facing);
              return false;
            }
            return true;
          });
        } else {
          this.projectile(f, spec, ang);
        }
      }
    } else if (spec.kind === 'implode') {
      this.implode(f, spec, tx, tz);
    } else if (spec.kind === 'shockwave') {
      this.shockwave(f, spec, 0.15);
      if (spec.double) {
        this.shockwave(f, spec, 0.6);
      }
    } else if (spec.kind === 'rain' || spec.kind === 'judgment') {
      this.rain(f, spec, tx, tz);
    } else if (spec.kind === 'heal') {
      const ring = new THREE.Mesh(GEO.disc, glow(spec.color, 0.35));
      ring.position.set(f.pos.x, 0.05, f.pos.z);
      ring.scale.setScalar(spec.radius);
      this.fx.add(ring);
      let t = 0;
      this.addEffect((dt) => {
        t += dt;
        ring.material.opacity = Math.max(0, 0.35 - t * 0.5);
        if (t > 0.7) {
          this.fx.remove(ring);
          return false;
        }
        return true;
      });
      for (const a of this.fighters) {
        if (a.team === f.team && !a.dead && !a.remoteAuth && a.pos.distanceTo(f.pos) < spec.radius) {
          const h = Math.round(Math.min(a.maxHp - a.hp, spec.heal));
          a.hp += h;
          this.ui.popup(a.pos, '+' + h, '#9dffb0');
          this.spark(a.pos.clone().setY(1.2), spec.color, 1);
        }
      }
    }
  }

  addEffect(fn) {
    this.effects.push(fn);
  }

  // 属性ごとの立体エフェクト（炎の柱・氷晶・雷撃・旋風・岩塊・光柱・闇の結び目・波紋・毒泡・血の刃）
  fx3d(pos, elem, power = 1, color = 0xffffff) {
    if (fx3dLive > 40) return; // 同時発生数を制限して重くならないように
    fx3dLive++;
    const e = ((elem ?? 5) % 10 + 10) % 10;
    const g = new THREE.Group();
    g.position.copy(pos);
    this.fx.add(g);
    const lc = lite(color, 0.35);
    const parts = [];
    const add = (geo, col, op, p) => {
      const m = new THREE.Mesh(geo, glow(col, op));
      if (geo.type !== 'RingGeometry' && geo.type !== 'PlaneGeometry') outline(m);
      Object.assign(m.userData, { v: new THREE.Vector3(), spin: new THREE.Vector3(), s0: 1, s1: 1, grav: 0 }, p);
      if (p.pos) m.position.copy(p.pos);
      if (p.rot) m.rotation.copy(p.rot);
      m.scale.setScalar(m.userData.s0);
      g.add(m);
      parts.push(m);
      return m;
    };
    const R = () => Math.random() - 0.5;
    const P = power;
    const n = Math.round(6 + P * 4);
    if (e === 0) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        add(G3.flame, i % 2 ? color : 0xffd040, 0.85, { pos: new THREE.Vector3(Math.cos(a) * 0.5 * P, 0, Math.sin(a) * 0.5 * P), v: new THREE.Vector3(Math.cos(a) * 2, 3 + Math.random() * 3, Math.sin(a) * 2).multiplyScalar(P), spin: new THREE.Vector3(0, 8, 0), s0: 0.4 * P, s1: 1.4 * P });
      }
      for (let i = 0; i < n; i++) add(G3.drop, 0xffa020, 1, { v: new THREE.Vector3(R() * 8, 4 + Math.random() * 6, R() * 8).multiplyScalar(P), grav: 10, s0: 0.8, s1: 0.1 });
    } else if (e === 1) {
      for (let i = 0; i < n + 2; i++) {
        const a = Math.random() * Math.PI * 2;
        add(G3.crystal, i % 3 ? color : 0xffffff, 0.9, { rot: new THREE.Euler(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9), v: new THREE.Vector3(Math.cos(a) * 1.5, 0.5, Math.sin(a) * 1.5).multiplyScalar(P), s0: 0.2 * P, s1: 1.5 * P });
      }
    } else if (e === 2) {
      for (let b = 0; b < 3; b++) {
        let x = 0, y = 4 * P, z = 0;
        const ox = R() * 1.5, oz = R() * 1.5;
        for (let i = 0; i < 7; i++) {
          const nx = ox * (i / 6) + R() * 0.8, ny = y - (4 * P) / 7, nz = oz * (i / 6) + R() * 0.8;
          const seg = add(G3.bolt, i % 2 ? color : 0xffffff, 1, { pos: new THREE.Vector3((x + nx) / 2, (y + ny) / 2, (z + nz) / 2), s0: 1, s1: 1 });
          seg.scale.set(1.6, 1.6, Math.hypot(nx - x, ny - y, nz - z));
          seg.userData.fixed = true;
          seg.lookAt(nx, ny, nz); // 親グループは未更新（単位行列）なのでローカル座標で向ける
          x = nx; y = ny; z = nz;
        }
      }
      for (let i = 0; i < n; i++) add(G3.star, 0xffffa0, 1, { v: new THREE.Vector3(R() * 10, Math.random() * 6, R() * 10), spin: new THREE.Vector3(9, 9, 0), s0: 0.6, s1: 0.1 });
    } else if (e === 3) {
      for (let i = 0; i < 4; i++) add(G3.helix, i % 2 ? color : lc, 0.8, { pos: new THREE.Vector3(0, 0.3 + i * 0.6, 0), rot: new THREE.Euler(Math.PI / 2, 0, i), v: new THREE.Vector3(0, 2.5, 0), spin: new THREE.Vector3(0, 0, 12 - i * 2), s0: 0.5 * P, s1: (1.6 + i * 0.3) * P });
    } else if (e === 4) {
      for (let i = 0; i < n + 2; i++) {
        const m = add(G3.rock, i % 2 ? 0x8a6a40 : color, 1, { v: new THREE.Vector3(R() * 7, 5 + Math.random() * 5, R() * 7).multiplyScalar(P), grav: 18, spin: new THREE.Vector3(R() * 12, R() * 12, 0), s0: (0.6 + Math.random() * 0.8) * P, s1: 0.5 * P });
        m.material.blending = THREE.NormalBlending;
      }
      add(G3.wave, color, 0.8, { rot: new THREE.Euler(Math.PI / 2, 0, 0), s0: 0.3, s1: 2.8 * P });
    } else if (e === 5) {
      add(G3.beam, color, 0.55, { pos: new THREE.Vector3(0, -pos.y, 0), s0: 0.2, s1: 1 }).userData.beam = 7 * P;
      add(G3.beam, 0xffffff, 0.7, { pos: new THREE.Vector3(0, -pos.y, 0), s0: 0.1, s1: 0.4 }).userData.beam = 8 * P;
      for (let i = 0; i < n; i++) add(G3.star, i % 2 ? color : 0xffffff, 1, { v: new THREE.Vector3(R() * 6, 2 + Math.random() * 5, R() * 6).multiplyScalar(P), spin: new THREE.Vector3(6, 8, 0), s0: 1, s1: 0.2 });
    } else if (e === 6) {
      const c = add(G3.core, 0x200030, 0.95, { s0: 0.3 * P, s1: 2 * P });
      c.material.blending = THREE.NormalBlending;
      for (let i = 0; i < 3; i++) add(G3.knot, color, 0.85, { rot: new THREE.Euler(i, i * 2, 0), spin: new THREE.Vector3(3 + i, 5, 2), s0: 0.6 * P, s1: 2.2 * P });
    } else if (e === 7) {
      for (let i = 0; i < 3; i++) add(G3.wave, i % 2 ? lc : color, 0.8, { pos: new THREE.Vector3(0, 0.2 - pos.y + i * 0.15, 0), rot: new THREE.Euler(Math.PI / 2, 0, 0), s0: 0.2, s1: (2 + i) * P });
      for (let i = 0; i < n + 4; i++) add(G3.drop, i % 2 ? color : 0xffffff, 0.9, { v: new THREE.Vector3(R() * 6, 4 + Math.random() * 6, R() * 6).multiplyScalar(P), grav: 16, s0: 1.2, s1: 0.4 });
    } else if (e === 8) {
      for (let i = 0; i < n + 4; i++) add(G3.bubble, i % 3 ? color : 0xd080ff, 0.6, { pos: new THREE.Vector3(R() * 2 * P, R(), R() * 2 * P), v: new THREE.Vector3(R() * 1.5, 1.5 + Math.random() * 3, R() * 1.5), s0: 0.4, s1: (1.5 + Math.random() * 1.5) * P });
    } else {
      for (let i = 0; i < 5; i++) add(G3.crescent, i % 2 ? color : 0xff6060, 0.95, { rot: new THREE.Euler(R() * 2, Math.random() * 6, R() * 2), spin: new THREE.Vector3(0, 0, 16), s0: 0.4 * P, s1: 2 * P });
      for (let i = 0; i < n; i++) add(G3.drop, 0xa00010, 1, { v: new THREE.Vector3(R() * 8, 3 + Math.random() * 5, R() * 8).multiplyScalar(P), grav: 18, s0: 1, s1: 0.5 });
    }
    const life = 0.55 + P * 0.25;
    let t = 0;
    this.addEffect((dt) => {
      t += dt;
      const k = Math.min(1, t / life);
      for (const m of parts) {
        const u = m.userData;
        if (u.beam) {
          m.scale.set(u.s0 + (u.s1 - u.s0) * k, u.beam * Math.min(1, k * 4), u.s0 + (u.s1 - u.s0) * k);
        } else if (!u.fixed) {
          u.v.y -= u.grav * dt;
          m.position.addScaledVector(u.v, dt);
          m.rotation.x += u.spin.x * dt;
          m.rotation.y += u.spin.y * dt;
          m.rotation.z += u.spin.z * dt;
          m.scale.setScalar(Math.max(0.01, u.s0 + (u.s1 - u.s0) * Math.sin(k * Math.PI * 0.5)));
        }
      }
      fade(g, e === 2 ? (Math.random() < 0.3 ? 0.3 : 1) * (1 - k) : 1 - k * k);
      if (k >= 1) {
        kill(this.fx, g);
        fx3dLive--;
        return false;
      }
      return true;
    });
  }

  // 素材エフェクトを1枚出して、拡大・回転・上昇・フェードさせる
  fxPop(pos, elem, slot, size, life, o = {}) {
    const obj = o.flat ? fxFlat(elem, slot, size, o.op ?? 1) : fxSprite(elem, slot, size, o.op ?? 1);
    obj.position.copy(pos);
    if (o.flat) obj.rotation.y = o.rot ?? Math.random() * Math.PI * 2;
    this.fx.add(obj);
    const grow = o.grow ?? 1.6;
    const spin = o.spin ?? 0;
    const rise = o.rise ?? 0;
    const delay = o.delay ?? 0;
    obj.visible = delay <= 0;
    let t = -delay;
    this.addEffect((dt) => {
      t += dt;
      if (t < 0) return true;
      obj.visible = true;
      const k = t / life;
      obj.scale.setScalar(size * (1 + (grow - 1) * Math.min(1, k * 1.4)));
      if (o.flat) obj.rotation.y += spin * dt;
      else obj.material.rotation += spin * dt;
      obj.position.y += rise * dt;
      const fin = o.hold ? Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4) : Math.max(0, 1 - k * k);
      obj.material.opacity = (obj.material.userData.base ?? 1) * Math.min(1, t * 20) * fin;
      if (k >= 1) {
        kill(this.fx, obj);
        return false;
      }
      return true;
    });
    return obj;
  }

  // 闇の重力球：周囲を引き寄せてから圧壊・爆発
  implode(f, spec, x, z) {
    const g = new THREE.Group();
    const orb = new THREE.Mesh(GEO.sphere, glow(spec.color, 0.55));
    const core = new THREE.Mesh(GEO.sphere, glow(0x100018, 0.9));
    core.material.blending = THREE.NormalBlending;
    const ring = new THREE.Mesh(runeOf(spec), glow(spec.color, 0.9));
    const ring2 = new THREE.Mesh(SG.rune2, glow(lite(spec.color), 0.6));
    g.add(orb, core, ring, ring2);
    g.position.set(x, 0.1, z);
    this.fx.add(g);
    this.fxPop(new THREE.Vector3(x, 0.12, z), spec.elem ?? 6, 5, spec.radius * 2.4, 1.25, { flat: true, spin: -3, grow: 0.4, hold: true });
    this.fxPop(new THREE.Vector3(x, 1.2, z), spec.elem ?? 6, 0, 2, 0.95, { grow: 2.4, spin: 5, hold: true });
    let t = 0;
    let boom = false;
    const R = spec.radius;
    this.addEffect((dt) => {
      t += dt;
      if (t < 0.9) {
        const k = t / 0.9;
        ring.scale.setScalar(R * (1 - k) + 0.3);
        ring2.scale.setScalar(R * (1 - k * 0.8));
        ring.rotation.y += dt * 6;
        ring2.rotation.y -= dt * 3;
        orb.scale.setScalar(0.6 + k * 1.6);
        orb.position.y = 1.2;
        core.scale.setScalar(0.3 + k * 0.6);
        core.position.y = 1.2;
        for (const e of this.enemiesOf(f)) {
          const dx = x - e.pos.x;
          const dz = z - e.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < R + 1 && d > 0.3 && !e.remoteAuth) {
            e.pos.x += (dx / d) * dt * 5;
            e.pos.z += (dz / d) * dt * 5;
          }
        }
        if (Math.random() < 0.6) {
          const a = Math.random() * Math.PI * 2;
          this.puff(new THREE.Vector3(x + Math.cos(a) * R * (1 - k), 0.5 + Math.random() * 2, z + Math.sin(a) * R * (1 - k)), spec.color, 0.3);
        }
        return true;
      }
      if (!boom) {
        boom = true;
        this.strikeAt(f, x, z, R * 0.6, spec.dmg, 0.8, 11, spec);
        this.burst(new THREE.Vector3(x, 1, z), spec.color, 2.5, spec);
        this.shake = Math.max(this.shake, 0.7);
        this.ui.flash();
        this.ui.sfx('burst');
      }
      const k = (t - 0.9) / 0.35;
      orb.scale.setScalar(2.2 + k * R * 1.4);
      core.scale.setScalar(Math.max(0.01, 0.9 * (1 - k * 2)));
      fade(g, Math.max(0, 1 - k));
      if (k >= 1) {
        kill(this.fx, g);
        return false;
      }
      return true;
    });
  }

  // 赤い光線弾の連射（通常攻撃）
  laserVolley(f, L, n) {
    const spec = { visual: 'laser', color: L.color, dmg: L.dmg, speed: 30, radius: 0.35, stun: 0.12, kb: 1.5, trail: 0.06, noBurst: true };
    for (let i = 0; i < n; i++) {
      let w = -i * 0.07;
      this.addEffect((dt) => {
        w += dt;
        if (w >= 0) {
          f.faceNearest?.(14);
          this.projectile(f, spec, f.facing + (Math.random() - 0.5) * 0.08);
          this.ui.sfx('laser');
          return false;
        }
        return true;
      });
    }
  }

  castFx(f, color, spec) {
    // 足元に回転する紋章陣（技ごとに角数が違う）+ 立ち昇る光輪
    const g = new THREE.Group();
    const r1 = new THREE.Mesh(runeOf(spec), glow(color, 0.9));
    const r2 = new THREE.Mesh(SG.rune2, glow(lite(color), 0.6));
    r2.scale.setScalar(1.3);
    const el = elOf(spec);
    const isOver = spec && (spec === f.def.over || spec.hi);
    const base = new THREE.Vector3(f.pos.x, 0.08, f.pos.z);
    this.fxPop(base, el, 5, isOver ? 6 : 3.2, isOver ? 1.2 : 0.7, { flat: true, spin: 2.5, grow: 1.15, hold: true });
    this.fxPop(base.clone().setY(1.2), el, 1, isOver ? 5 : 2.6, 0.35, { spin: 4, grow: 1.5 });
    this.fx3d(base.clone().setY(0.4), el, isOver ? 1.8 : 0.8, color);
    this.grandFx(base, el, color, isOver ? 1.8 : 0.9);
    if (isOver) {
      // 奥義：時間差で重なる魔法陣と立体エフェクトの多重展開
      for (let i = 1; i <= 3; i++) {
        let d = i * 0.18;
        this.addEffect((dt) => {
          d -= dt;
          if (d > 0) return true;
          const a = Math.random() * Math.PI * 2;
          const q = base.clone().add(new THREE.Vector3(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5));
          this.grandFx(q, el, i % 2 ? lite(color, 0.3) : color, 1 + i * 0.2);
          this.fx3d(q.setY(0.6), (el + i) % 10, 1.2, color);
          return false;
        });
      }
      this.shake = Math.max(this.shake, 0.5);
    }
    if (isOver) {
      for (let i = 0; i < 4; i++) this.fxPop(base.clone().setY(0.5 + i * 0.9), el, 9, 2.4, 0.9, { rise: 2.5, spin: 3, delay: i * 0.08, op: 0.8 });
    }
    const halo = new THREE.Mesh(SG.torus, glow(color, 0.8));
    halo.rotation.x = Math.PI / 2;
    g.add(r1, r2, halo);
    g.position.set(f.pos.x, 0.06, f.pos.z);
    this.fx.add(g);
    let t = 0;
    this.addEffect((dt) => {
      t += dt;
      g.scale.setScalar(0.6 + Math.min(1, t * 5) * 1.2);
      r1.rotation.y += dt * 4;
      r2.rotation.y -= dt * 2;
      halo.position.y = t * 5;
      halo.scale.setScalar(0.8 - t * 0.6);
      fade(g, Math.max(0, 1 - t / 0.35));
      if (t > 0.35) {
        kill(this.fx, g);
        return false;
      }
      return true;
    });
  }

  afterimage(f, color) {
    const m = new THREE.Mesh(SG.slash, glow(color, 0.6));
    m.position.set(f.pos.x, 1 + f.y, f.pos.z);
    m.rotation.y = f.facing - Math.PI / 2;
    this.fx.add(m);
    let t = 0;
    this.addEffect((dt) => {
      t += dt;
      m.scale.y = 1 + t * 3;
      fade(m, Math.max(0, 1 - t / 0.3));
      if (t > 0.3) {
        kill(this.fx, m);
        return false;
      }
      return true;
    });
  }

  puff(pos, color, size) {
    const m = new THREE.Mesh(GEO.sphere, glow(color, 0.5));
    m.position.copy(pos);
    m.scale.setScalar(size);
    this.fx.add(m);
    let t = 0;
    this.addEffect((dt) => {
      t += dt;
      m.scale.setScalar(size * (1 - t * 3));
      if (t > 0.3) {
        kill(this.fx, m);
        return false;
      }
      return true;
    });
  }

  burst(pos, color, size, spec) {
    this.spark(pos, color, size);
    if (spec && spec.elem != null) {
      const el = spec.elem;
      this.fxPop(pos.clone(), el, 8, size * 2.4, 0.45, { grow: 1.6 });
      this.fxPop(pos.clone(), el, 1, size * 2.2, 0.25, { grow: 2, spin: 5 });
      this.fxPop(pos.clone(), el, 7, size * 2.6, 0.6, { grow: 2.2, op: 0.9 });
      this.fxPop(pos.clone().setY(pos.y + 0.3), el, 3, size * 2, 0.8, { rise: 1.6, grow: 1.8, op: 0.55 });
      this.fxPop(new THREE.Vector3(pos.x, 0.1, pos.z), el, 4, size * 1.2, 0.45, { flat: true, grow: 2.6 });
      this.fx3d(pos.clone(), el, Math.min(2.2, 0.5 + size * 0.45), color);
      if (size >= 1.2) this.grandFx(pos, el, color, Math.min(2, size * 0.6));
      else this.flashLight(pos, color, size * 0.6, 0.25);
    }
    const n = 7;
    const geo = spec ? primOf(spec) : SG.tetra;
    const lc = lite(color);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(geo, glow(i % 2 ? lc : color, 0.95));
      m.scale.setScalar(0.12 * size);
      m.position.copy(pos);
      const v = new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 5, (Math.random() - 0.5) * 8).multiplyScalar(size * 0.7);
      this.fx.add(m);
      let t = 0;
      this.addEffect((dt) => {
        t += dt;
        v.y -= 18 * dt;
        m.position.addScaledVector(v, dt);
        m.rotation.x += dt * 12;
        m.rotation.z += dt * 9;
        fade(m, Math.max(0, 1 - t / 0.5));
        if (t > 0.5) {
          kill(this.fx, m);
          return false;
        }
        return true;
      });
    }
  }

  // ---- 召喚獣：HPを持ち、倒されるまで使い手の前方に居続ける。通常攻撃の代わりに攻撃する ----
  spawnSummon(f) {
    const d = SUMMON_DEFS[f.summonId];
    if (!d) return null;
    const k = (f.def.height / 1.8) * f.scale;
    const g = new THREE.Group();
    const body = new THREE.Group();
    g.add(body);
    // 読み込み中の仮の姿（霊気の柱）
    const ghost = new THREE.Mesh(new THREE.CylinderGeometry(0.6 * k, 1.2 * k, d.height * k, 12, 1, true), glow(d.color, 0.35));
    ghost.position.y = (d.height * k) / 2;
    body.add(ghost);
    // HPバー（カメラへ向ける）
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.14), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.75, depthTest: false }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.1), new THREE.MeshBasicMaterial({ color: d.color, depthTest: false }));
    fill.position.z = 0.001;
    bg.renderOrder = fill.renderOrder = 999;
    bar.add(bg, fill);
    bar.position.y = d.height * k + 0.5;
    g.add(bar);
    const s = { def: d, f, g, body, bar, fill, k, maxHp: Math.round(f.maxHp * d.hpMul), hp: 0, t: 0, atk: 0, dying: 0, mixer: null, acts: {}, own: new Set([ghost.geometry, ghost.material, bg.geometry, bg.material, fill.geometry, fill.material]) };
    s.hp = s.maxHp;
    const fw = f.forward();
    g.position.set(f.pos.x + fw.x * d.dist * k, 0, f.pos.z + fw.z * d.dist * k);
    g.rotation.y = f.facing;
    this.scene.add(g);
    this.summons.add(s);
    f.summon = s;
    loadSummonModel(d.model).then((gltf) => {
      if (!gltf || s.dying) return;
      const m = SkeletonUtils.clone(gltf.scene);
      m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m);
      const size = box.getSize(new THREE.Vector3());
      const sc = (d.height * k) / Math.max(size.y, 0.001);
      m.scale.setScalar(sc);
      m.position.y = -box.min.y * sc;
      m.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          if (c.material?.emissive) {
            c.material = c.material.clone();
            s.own.add(c.material);
            c.material.emissive.setHex(d.color);
            c.material.emissiveIntensity = 0.12;
          }
        }
      });
      body.remove(ghost);
      ghost.geometry.dispose();
      ghost.material.dispose();
      s.own.delete(ghost.geometry);
      s.own.delete(ghost.material);
      if (f.summonId === 's0') {
        // 修復メッシュもGLBの局所座標で配置し、上のm.scaleと同じ倍率で拡大する。
        repairOrochiNecks(m, s.own);
        // 既存モデルの片面描画で消えていた薄い首の裏面も表示。
        m.traverse((c) => {
          if (!c.isMesh || c.parent?.name === 'orochi_eight_necks_repaired') return;
          const materials = Array.isArray(c.material) ? c.material : [c.material];
          for (const material of materials) if (material) material.side = THREE.DoubleSide;
        });
      }
      body.add(m);
      if (gltf.animations?.length) {
        s.mixer = new THREE.AnimationMixer(m);
        const find = (re) => gltf.animations.find((a) => re.test(a.name));
        for (const [key, re] of [['idle', /^idle$/i], ['walk', /^walk$/i], ['atk', /heavy_combo|sword_attack|punch/i], ['die', /death/i]]) {
          const c = find(re);
          if (c) s.acts[key] = s.mixer.clipAction(c);
        }
        s.acts.idle?.play();
        if (s.acts.atk) s.acts.atk.setLoop(THREE.LoopOnce, 1);
        if (s.acts.die) { s.acts.die.setLoop(THREE.LoopOnce, 1); s.acts.die.clampWhenFinished = true; }
      }
    });
    // 出現演出
    this.burstFx ? this.burstFx(g.position.clone().setY(1.2), d.color, elOf(f.def.skills[0])) : this.spark(g.position.clone().setY(1.2), d.color, 2);
    this.ui.popup?.(g.position, `召喚！${d.name}`, '#' + d.color.toString(16).padStart(6, '0'));
    this.ui.voice?.(f, 'summon', d.name);
    this.shake = Math.max(this.shake || 0, 0.4);
    this.addEffect((dt) => this.tickSummon(s, dt));
    return s;
  }

  tickSummon(s, dt) {
    const f = s.f, d = s.def;
    s.t += dt;
    s.mixer?.update(dt);
    if (f.dead && !s.dying) this.killSummon(s);
    if (s.dying) {
      s.dying += dt;
      s.body.position.y = -Math.max(0, s.dying - 0.6) * 3;
      s.bar.visible = false;
      if (s.dying > 1.8) {
        this.removeSummon(s);
        return false;
      }
      return true;
    }
    // 使い手の前方へ追従
    const fw = f.forward();
    const tx = f.pos.x + fw.x * d.dist * s.k, tz = f.pos.z + fw.z * d.dist * s.k;
    const dx = tx - s.g.position.x, dz = tz - s.g.position.z;
    const moving = Math.hypot(dx, dz) > 0.25;
    s.g.position.x += dx * (1 - Math.exp(-6 * dt));
    s.g.position.z += dz * (1 - Math.exp(-6 * dt));
    let ang = f.facing - s.g.rotation.y;
    ang = Math.atan2(Math.sin(ang), Math.cos(ang));
    s.g.rotation.y += ang * (1 - Math.exp(-8 * dt));
    if (s.mixer && s.atk <= 0) {
      const want = moving && s.acts.walk ? s.acts.walk : s.acts.idle;
      if (want && s.cur !== want) { want.reset().fadeIn(0.2).play(); s.cur?.fadeOut(0.2); s.cur = want; }
    }
    // 攻撃の踏み込み（アニメの無い竜は体ごと前へ）
    s.atk = Math.max(0, s.atk - dt);
    const lunge = Math.sin(Math.min(1, 1 - s.atk / 0.6) * Math.PI) * (s.atk > 0 ? 1 : 0);
    s.body.position.z = lunge * 0.8 * s.k;
    s.body.position.y = Math.sin(s.t * 2) * 0.05;
    if (!s.mixer) s.body.rotation.x = -lunge * 0.15;
    // 自動攻撃：近くの敵へ一定間隔で攻撃（威力は使い手の攻撃力に比例）
    s.auto = (s.auto ?? 0.8) - dt;
    if (s.auto <= 0 && !f.remoteAuth && !f.dead) {
      s.auto = d.autoCd || 1.8;
      const p = s.g.position;
      let best = null, bd = Infinity;
      for (const e of this.enemiesOf(f)) {
        if (e.dead) continue;
        const dd = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
        if (dd < bd) { bd = dd; best = e; }
      }
      const reach = d.autoRange * s.k;
      if (best && bd < reach + best.radius) {
        // 敵の方へ向き直って攻撃
        s.g.rotation.y = Math.atan2(best.pos.x - p.x, best.pos.z - p.z);
        s.atk = 0.6;
        if (s.acts.atk) { s.acts.atk.reset().play(); s.cur?.fadeOut(0.1); s.cur = s.acts.atk; }
        const dmg = f.def.light.dmg * d.autoMul;
        this.strikeAt(f, best.pos.x, best.pos.z, 1.6, dmg, 0.3, 4, null);
        for (let i = 0; i < 4; i++) this.spark(best.pos.clone().setY(0.8 + i * 0.3), i % 2 ? d.color2 : d.color, 0.8);
        this.fxPop(best.pos.clone().setY(1), elOf(f.def.skills[0]), 5, 2.2, 0.28, { grow: 1.6, spin: 8 });
      } else {
        s.auto = 0.3; // 敵が居なければ短い間隔で再確認
      }
    }
    s.bar.quaternion.copy(this.camera.quaternion);
    s.bar.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -s.g.rotation.y, 0)));
    s.fill.scale.x = Math.max(0.001, s.hp / s.maxHp);
    s.fill.position.x = -0.78 * (1 - s.fill.scale.x);
    return true;
  }

  summonStrike(f, big) {
    let s = f.summon;
    if (!s || s.dying) {
      if (f.summonCd > 0) return false;
      s = this.spawnSummon(f);
      if (!s) return false;
    }
    const d = s.def;
    s.atk = 0.6;
    if (s.acts.atk) { s.acts.atk.reset().play(); s.cur?.fadeOut(0.1); s.cur = s.acts.atk; }
    const L = f.def.light;
    // 召喚獣の前方を薙ぎ払う（判定は使い手基準で前方 4.4m）
    this.meleeHit(f, d.range, L.dmg * d.mul, big ? 0.5 : 0.3, big ? 8 : 3.5, null, null, false);
    const p = s.g.position;
    const fw = f.forward();
    for (let i = 0; i < 6; i++) {
      const a = f.facing + (i - 2.5) * 0.3;
      this.spark(new THREE.Vector3(p.x + Math.sin(a) * 2 * s.k, 1 + Math.random(), p.z + Math.cos(a) * 2 * s.k), i % 2 ? d.color2 : d.color, 0.9);
    }
    this.fxPop(new THREE.Vector3(p.x + fw.x, 0.8, p.z + fw.z), elOf(f.def.skills[0]), 6, d.range, 0.3, { flat: true, rot: f.facing + Math.PI / 2, grow: 1.4 });
    if (big) this.shake = Math.max(this.shake || 0, 0.3);
    return true;
  }

  // 前方からの攻撃は召喚獣が受け止める
  summonBlock(tgt, from, dmg) {
    const s = tgt.summon;
    if (!s || s.dying || s.hp <= 0) return false;
    const fw = tgt.forward();
    const vx = from.x - tgt.pos.x, vz = from.z - tgt.pos.z;
    if (vx * fw.x + vz * fw.z <= 0) return false;
    s.hp -= dmg;
    this.ui.popup(s.g.position, Math.round(dmg), '#c8b8ff');
    this.spark(s.g.position.clone().setY(1.5 * s.k), s.def.color, 0.8);
    if (s.hp <= 0) this.killSummon(s);
    return true;
  }

  killSummon(s) {
    if (s.dying) return;
    s.dying = 0.001;
    s.hp = 0;
    s.f.summonCd = 15; // 倒されたら15秒後に再召喚できる
    if (s.acts.die) { s.cur?.fadeOut(0.1); s.acts.die.reset().play(); }
    this.spark(s.g.position.clone().setY(1.5), s.def.color, 2.4);
    this.ui.popup?.(s.g.position, `${s.def.name} 消滅`, '#bbbbbb');
    if (s.f.summon === s) s.f.summon = null;
  }

  removeSummon(s) {
    if (!this.summons.delete(s)) return;
    s.dying = Math.max(s.dying, 1); // 読み込み完了が遅れてもモデルを追加させない
    s.mixer?.stopAllAction();
    this.scene.remove(s.g);
    // GLBキャッシュの共有素材は残し、この召喚獣専用の素材だけを解放する
    for (const resource of s.own) resource.dispose();
    s.own.clear();
    if (s.f.summon === s) s.f.summon = null;
  }

  swingFx(f) {
    const L = f.def.light;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(L.range * (L.spin ? 0.95 : 0.7), L.spin ? 0.09 : 0.05, 4, L.spin ? 40 : 16, Math.PI * (L.spin ? 2 : 0.8)), glow(L.color ?? f.def.color, 0.9));
    arc.rotation.set(Math.PI / 2, 0, -f.facing - Math.PI * 0.9 + Math.PI / 2);
    if (L.spin) {
      // 回転斬り：足元に水平の刃風を重ねる
      for (let i = 0; i < 3; i++) this.spark(f.pos.clone().setY(1 + i * 0.2), L.color, 0.6 + i * 0.3);
    }
    arc.position.set(f.pos.x, 1.1 + f.y, f.pos.z);
    this.fx.add(arc);
    const el = L.shots ? 9 : elOf(f.def.skills[0]);
    const fw = f.forward();
    if (L.spin) {
      this.fxPop(new THREE.Vector3(f.pos.x, 1 + f.y, f.pos.z), el, 4, L.range * 1.4, 0.3, { flat: true, grow: 1.6, spin: 14 });
    } else {
      this.fxPop(new THREE.Vector3(f.pos.x + fw.x * L.range * 0.6, 1.1 + f.y, f.pos.z + fw.z * L.range * 0.6), el, 6, L.range * 1.5, 0.22, { flat: true, rot: f.facing + Math.PI / 2, grow: 1.25 });
    }
    let t = 0;
    this.addEffect((dt) => {
      t += dt;
      arc.material.opacity = Math.max(0, 0.9 - t * 5);
      if (t > 0.2) {
        arc.geometry.dispose();
        this.fx.remove(arc);
        return false;
      }
      return true;
    });
  }

  spark(pos, color, size) {
    const m = new THREE.Mesh(GEO.oct, glow(color, 0.95));
    m.position.copy(pos);
    this.fx.add(m);
    let t = 0;
    this.addEffect((dt) => {
      t += dt;
      m.scale.setScalar(size * (0.3 + t * 4));
      m.rotation.y += dt * 8;
      m.material.opacity = Math.max(0, 0.95 - t * 5);
      if (t > 0.2) {
        this.fx.remove(m);
        return false;
      }
      return true;
    });
  }

  projectile(f, spec, ang) {
    const m = makeShape(spec.visual || 'orb', spec.color, Math.max(0.8, spec.radius * 1.7));
    const deco = spec.shape != null ? decorate(m, spec, 1) : null;
    const inner = new THREE.Group();
    const spin = m.userData.spin;
    inner.add(m);
    const el = elOf(spec, 9);
    const core = fxSprite(el, spec.visual === 'laser' ? 2 : 0, Math.max(1.2, spec.radius * 3.2), 0.95);
    inner.add(core);
    const p = f.pos.clone().setY(1.1);
    const v = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(spec.speed);
    inner.position.copy(p);
    inner.rotation.y = ang;
    this.fx.add(inner);
    let t = 0;
    let trail = 0;
    const done = () => {
      kill(this.fx, inner);
      return false;
    };
    this.addEffect((dt) => {
      t += dt;
      p.addScaledVector(v, dt);
      inner.position.copy(p);
      if (spin === 'x') m.rotation.x += dt * 22;
      if (spin === 'y') m.rotation.y += dt * 8;
      if (spin === 'z') m.rotation.z += dt * 14;
      if (deco) {
        deco.rotation.z += dt * 7;
        deco.rotation.x += dt * 3;
      }
      trail -= dt;
      if (trail <= 0) {
        trail = spec.trail ?? 0.04;
        this.puff(p.clone(), spec.color, 0.22 * Math.max(1, spec.radius * 1.5));
        this.fxPop(p.clone(), el, Math.random() < 0.5 ? 9 : 3, Math.max(0.8, spec.radius * 2.2), 0.3, { grow: 1.5, op: 0.6 });
      }
      if (spec.visual !== 'laser') core.material.rotation += dt * 6;
      for (const e of this.enemiesOf(f)) {
        if (Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < spec.radius + e.radius) {
          this.applyHit(f, e, spec.dmg, spec.stun ?? 0.4, spec.kb ?? 5, f.pos, spec);
          if (spec.noBurst) this.spark(p.clone(), spec.color, 0.5);
          else this.burst(p.clone(), spec.color, 1.2, spec);
          return done();
        }
      }
      if (t > 1.3) {
        return done();
      }
      return true;
    });
  }

  shockwave(f, spec, delay, cx, cz) {
    const ox = cx ?? f.pos.x;
    const oz = cz ?? f.pos.z;
    const ring = new THREE.Group();
    const flat = new THREE.Mesh(GEO.ring, glow(spec.color, 0.9));
    const wall = new THREE.Mesh(GEO.pillar, glow(spec.color, 0.35));
    wall.scale.set(1, 0.9, 1);
    const rune = new THREE.Mesh(runeOf(spec), glow(lite(spec.color), 0.6));
    rune.scale.setScalar(0.8);
    ring.add(flat, wall, rune);
    ring.position.set(ox, 0.08, oz);
    ring.visible = false;
    this.fx.add(ring);
    if (spec.elem != null) {
      const el = spec.elem;
      this.fxPop(new THREE.Vector3(ox, 0.12, oz), el, 4, 1, 0.5, { flat: true, grow: spec.radius * 2.3, delay, spin: 1.5 });
      this.fxPop(new THREE.Vector3(ox, 0.1, oz), el, 5, spec.radius * 1.6, 0.6, { flat: true, grow: 1.2, delay, spin: -2, hold: true, op: 0.8 });
      this.fx3d(new THREE.Vector3(ox, 0.3, oz), el, Math.min(2.2, spec.radius / 3), spec.color);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.fxPop(new THREE.Vector3(ox + Math.cos(a) * spec.radius * 0.6, 0.6, oz + Math.sin(a) * spec.radius * 0.6), el, i % 2 ? 3 : 8, 1.8, 0.55, { rise: 1.5, grow: 1.8, delay: delay + 0.05, op: 0.7 });
      }
    }
    // 地面から突き出す結晶の棘
    const spikes = new THREE.Group();
    const n = Math.round(spec.radius * 3);
    const v = spec.shape ?? 0;
    const spikeGeo = v % 2 ? SG.spike : primOf(spec);
    const lc = lite(spec.color);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const rr = spec.radius * (0.45 + Math.random() * 0.45);
      const s = new THREE.Mesh(spikeGeo, glow(i % 3 ? spec.color : lc, 0.85));
      const prim = spikeGeo !== SG.spike;
      s.position.set(Math.cos(a) * rr, prim ? 0.5 : 0, Math.sin(a) * rr);
      s.rotation.set((Math.random() - 0.5) * 0.6, Math.random() * 3, (Math.random() - 0.5) * 0.6);
      s.userData.h = prim ? 0.35 + Math.random() * 0.4 : 0.6 + Math.random() * 0.9;
      s.scale.set(prim ? 0.35 : 1, 0.01, prim ? 0.35 : 1);
      spikes.add(s);
    }
    spikes.position.set(ox, 0, oz);
    spikes.visible = false;
    this.fx.add(spikes);
    const hit = new Set();
    let t = -delay;
    this.addEffect((dt) => {
      t += dt;
      if (t < 0) {
        return true;
      }
      ring.visible = true;
      spikes.visible = true;
      const r = Math.min(1, t / 0.45) * spec.radius;
      ring.scale.setScalar(Math.max(0.1, r));
      fade(ring, Math.max(0, 1 - t / 0.5));
      fade(spikes, Math.max(0, 1 - t / 0.5));
      const up = t < 0.12 ? t / 0.12 : Math.max(0, 1 - (t - 0.12) / 0.3);
      for (const s of spikes.children) {
        s.scale.y = Math.max(0.01, up * s.userData.h);
      }
      if (t < 0.05) {
        this.shake = Math.max(this.shake, 0.3);
      }
      for (const e of this.enemiesOf(f)) {
        const d = Math.hypot(e.pos.x - ox, e.pos.z - oz);
        if (spec.dmg > 0 && !hit.has(e) && d < r + e.radius && e.y < 0.8) {
          hit.add(e);
          this.applyHit(f, e, spec.dmg, 0.6, 9, new THREE.Vector3(ox, 0, oz), spec);
        }
      }
      if (t > 0.5) {
        kill(this.fx, ring);
        kill(this.fx, spikes);
        return false;
      }
      return true;
    });
  }

  rain(f, spec, tx, tz) {
    for (let i = 0; i < spec.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = i === 0 ? 0 : Math.sqrt(Math.random()) * spec.spread;
      this.strike(f, spec, tx + Math.cos(a) * r, tz + Math.sin(a) * r, spec.delay + i * spec.interval, spec.radius, spec.dmg);
    }
    if (spec.kind === 'judgment') {
      const finalDelay = spec.delay + spec.count * spec.interval + 0.5;
      const fv = spec.finalVisual || 'verdict';
      this.strike(f, { ...spec, visual: fv, final: true }, tx, tz, finalDelay, spec.finalRadius, spec.finalDmg, spec);
      if (fv === 'bigsword') {
        // 大剣の着弾と同時に雷の柱を周囲へ
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.strike(f, { ...spec, visual: 'bolt' }, tx + Math.cos(a) * spec.finalRadius * 0.7, tz + Math.sin(a) * spec.finalRadius * 0.7, finalDelay + 0.05 + i * 0.04, 1.2, 0, spec);
        }
      }
    }
  }

  strike(f, spec, x, z, delay, radius, dmg, hitSpec) {
    hitSpec = hitSpec || spec;
    // 予兆の紋章陣（技ごとに角数の違う環 + 外周）
    const mark = new THREE.Group();
    mark.add(new THREE.Mesh(runeOf(spec), glow(spec.color, 0.7)), new THREE.Mesh(SG.rune2, glow(lite(spec.color), 0.4)));
    mark.position.set(x, 0.07, z);
    mark.scale.setScalar(radius);
    this.fx.add(mark);
    const vis = spec.visual;
    const sel = elOf(spec);
    // 予兆の魔法陣（素材）
    this.fxPop(new THREE.Vector3(x, 0.09, z), sel, 5, radius * 2.3, delay + 0.3, { flat: true, spin: 2, grow: 1.05, hold: true, op: 0.9 });
    const big = !!spec.final;
    let body = null;
    const fall = vis === 'spear' ? 0.2 : vis === 'meteor' ? 0.4 : vis === 'sword' ? 0.22 : vis === 'blade' ? 0.1 : vis === 'nova' ? 0.75 : vis === 'bigsword' ? 0.4 : 0;
    const startPos = vis === 'bigsword'
      ? new THREE.Vector3(x, 20, z + 0.01)
      : vis === 'nova'
        ? new THREE.Vector3(x - 9, 22, z - 5)
        : new THREE.Vector3(x - (vis === 'meteor' ? 4 : 0.6), vis === 'blade' ? 3 : 13, z - (vis === 'meteor' ? 2 : 0.3));
    let t = -delay;
    let struck = false;
    this.addEffect((dt) => {
      t += dt;
      mark.rotation.y += dt * 2.5;
      if (t < 0) {
        fade(mark, 0.5 + 0.5 * Math.abs(Math.sin(t * 12)));
      }
      if (t >= -fall && !body) {
        if (vis === 'spear' || vis === 'sword' || vis === 'meteor' || vis === 'blade' || vis === 'nova' || vis === 'bigsword') {
          const sc = vis === 'nova' ? radius * 0.9 : vis === 'bigsword' ? radius * 1.5 : vis === 'meteor' ? radius * 0.8 : vis === 'sword' ? 1.4 + radius * 0.3 : vis === 'blade' ? 1.1 : 1.3;
          body = makeShape(vis === 'blade' || vis === 'bigsword' ? 'sword' : vis === 'nova' ? 'meteor' : vis, spec.color, sc);
          if (vis !== 'bigsword' && vis !== 'nova') decorate(body, spec, 0.8);
          body.position.copy(startPos);
          body.lookAt(x, 0, z);
        } else if (vis === 'bolt') {
          // 稲妻：ジグザグの幹＋枝
          body = new THREE.Group();
          const lc = lite(spec.color, 0.55);
          const seg = (a, b, w) => {
            const len = a.distanceTo(b);
            const o = new THREE.Mesh(SG.unitZ, glow(spec.color, 0.75));
            o.position.copy(a).lerp(b, 0.5);
            o.scale.set(w, w, len);
            o.lookAt(b);
            const c = new THREE.Mesh(SG.unitZ, glow(lc, 0.95));
            c.position.copy(o.position);
            c.scale.set(w * 0.35, w * 0.35, len);
            c.quaternion.copy(o.quaternion);
            body.add(o, c);
          };
          let prev = new THREE.Vector3(0, 15, 0);
          for (let i = 1; i <= 9; i++) {
            const y = 15 - (i / 9) * 15;
            const p = i === 9 ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3((Math.random() - 0.5) * 1.6, y, (Math.random() - 0.5) * 1.6);
            seg(prev, p, big ? 0.35 : 0.2);
            if (i % 3 === 1) {
              const br = p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, -1.5 - Math.random(), (Math.random() - 0.5) * 3));
              seg(p, br, 0.09);
            }
            prev = p;
          }
          const flash = new THREE.Mesh(GEO.sphere, glow(spec.color, 0.6));
          flash.scale.set(radius * 0.8, 0.4, radius * 0.8);
          body.add(flash);
          body.position.set(x, 0, z);
          body.visible = false;
        } else if (vis === 'tornado') {
          // 竜巻：上ほど広がる回転する輪
          body = new THREE.Group();
          for (let i = 0; i < 8; i++) {
            const r = new THREE.Mesh(SG.torus, glow(i % 2 ? lite(spec.color) : spec.color, 0.8));
            r.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
            r.position.y = i * 0.75;
            r.scale.setScalar(radius * (0.3 + i * 0.16));
            body.add(r);
          }
          for (let i = 0; i < 6; i++) {
            const b = new THREE.Mesh(SG.slash, glow(spec.color, 0.7));
            const a = (i / 6) * Math.PI * 2;
            b.position.set(Math.cos(a) * radius * 0.7, 1 + i * 0.7, Math.sin(a) * radius * 0.7);
            b.rotation.y = -a;
            body.add(b);
          }
          body.position.set(x, 0, z);
          body.visible = false;
        } else if (vis === 'crystal') {
          body = new THREE.Group();
          for (let i = 0; i < 5; i++) {
            const s = new THREE.Mesh(SG.spike, glow(i % 2 ? lite(spec.color) : spec.color, 0.9));
            const a = (i / 5) * Math.PI * 2;
            s.position.set(Math.cos(a) * radius * 0.35, 0, Math.sin(a) * radius * 0.35);
            s.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
            s.scale.set(1, 0.01, 1);
            body.add(s);
          }
          body.position.set(x, 0, z);
        } else {
          // 光柱：本体 + 芯 + 上下の光輪
          body = new THREE.Group();
          const rr = radius * (big ? 1 : 0.6);
          const shell = new THREE.Mesh(GEO.pillar, glow(spec.color, 0.6));
          shell.scale.set(rr, big ? 34 : 18, rr);
          const core = new THREE.Mesh(GEO.pillar, glow(lite(spec.color, 0.5), 0.9));
          core.scale.set(rr * 0.35, big ? 34 : 18, rr * 0.35);
          body.add(shell, core);
          decorate(body, spec, rr * 1.2).position.y = 1.4;
          for (let i = 0; i < (big ? 4 : 2); i++) {
            const halo = new THREE.Mesh(SG.torus, glow(spec.color, 0.9));
            halo.rotation.x = Math.PI / 2;
            halo.scale.setScalar(rr * 1.3);
            halo.position.y = 1 + i * (big ? 4 : 3);
            halo.userData.halo = i;
            body.add(halo);
          }
          if (big) {
            const orb = new THREE.Mesh(GEO.sphere, glow(spec.color, 0.5));
            orb.userData.orb = true;
            body.add(orb);
          }
          body.position.set(x, 0, z);
          body.visible = false;
        }
        this.fx.add(body);
      }
      if (body && fall > 0 && t < 0) {
        const k = 1 + t / fall;
        body.position.lerpVectors(startPos, new THREE.Vector3(x, vis === 'meteor' ? 0.6 : 0.4, z), k);
        if (body.userData.spin === 'x') body.children[0].rotation.x += dt * 10;
        if (Math.random() < 0.5) this.puff(body.position.clone(), spec.color, 0.25);
      }
      if (t >= 0 && !struck) {
        struck = true;
        if (body) body.visible = true;
        this.strikeAt(f, x, z, radius, dmg, big ? 1 : vis === 'nova' ? 0.8 : 0.35, big || vis === 'nova' ? 12 : 3, hitSpec);
        this.shake = Math.max(this.shake, big || vis === 'nova' ? 0.9 : vis === 'meteor' ? 0.35 : vis === 'bolt' ? 0.25 : 0.15);
        if (big || vis === 'nova') {
          this.ui.flash();
          this.ui.sfx('burst');
        }
        if (vis === 'bolt') {
          this.ui.sfx('zap');
          this.fxPop(new THREE.Vector3(x, 4, z), 2, 2, big ? 10 : 7, 0.3, { grow: 1.1 });
        }
        if (vis === 'tornado') {
          for (let i = 0; i < 4; i++) this.fxPop(new THREE.Vector3(x, 0.8 + i * 1.3, z), 3, i % 2 ? 9 : 4, radius * (1.4 + i * 0.4), 0.8, { spin: 10, rise: 1, grow: 1.3, op: 0.85 });
        }
        if (big || vis === 'nova') {
          // 奥義の着弾：巨大な爆発と閃光を重ねる
          this.fxPop(new THREE.Vector3(x, 1.5, z), sel, 8, radius * 3.2, 0.8, { grow: 1.5 });
          this.fxPop(new THREE.Vector3(x, 2, z), sel, 1, radius * 3.5, 0.5, { grow: 1.8, spin: 3 });
          this.fxPop(new THREE.Vector3(x, 0.15, z), sel, 4, radius, 0.7, { flat: true, grow: 3.2, spin: 1 });
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            this.fxPop(new THREE.Vector3(x + Math.cos(a) * radius * 0.8, 1, z + Math.sin(a) * radius * 0.8), sel, i % 2 ? 3 : 7, radius * 1.1, 0.9, { rise: 2.5, grow: 1.7, delay: i * 0.03, op: 0.75 });
          }
        }
        this.burst(new THREE.Vector3(x, 0.6, z), spec.color, Math.min(vis === 'nova' ? 3.5 : 2.5, radius * 0.8), spec);
        if (vis === 'nova') this.shockwave(f, { ...hitSpec, dmg: 0, radius: radius * 1.6 }, 0, x, z);
      }
      if (t >= 0) {
        const life = big ? 0.7 : vis === 'tornado' ? 0.75 : vis === 'nova' ? 0.5 : vis === 'sword' || vis === 'spear' ? 0.3 : 0.25;
        if (vis === 'tornado' && body) {
          body.rotation.y += dt * 14;
          if (Math.random() < 0.4) this.puff(new THREE.Vector3(x + (Math.random() - 0.5) * radius, Math.random() * 5, z + (Math.random() - 0.5) * radius), spec.color, 0.3);
        }
        if (vis === 'bolt' && body) body.visible = Math.random() > 0.25;
        const k = t / life;
        fade(mark, Math.max(0, 1 - k));
        if (body) {
          fade(body, Math.max(0, 1 - k));
          for (const c of body.children) {
            if (c.userData.halo != null) {
              c.position.y += dt * (6 + c.userData.halo * 3);
              c.scale.multiplyScalar(1 + dt * 1.5);
            }
            if (c.userData.orb) {
              c.scale.setScalar(radius * (0.3 + k * 1.1));
            }
          }
          if (vis === 'crystal') {
            const up = Math.min(1, k * 5);
            for (const s of body.children) s.scale.y = up * 1.2;
          }
          if (vis === 'verdict') {
            body.children[0].scale.x = body.children[0].scale.z = radius * (1 + k * 0.6);
          }
        }
        if (k >= 1) {
          kill(this.fx, mark);
          if (body) {
            kill(this.fx, body);
          }
          return false;
        }
      }
      return true;
    });
  }

  aiInput(f, dt) {
    const st = f.cpu;
    const inp = { mx: 0, mz: 0 };
    const tgt = this.nearestEnemy(f);
    if (!tgt) {
      return inp;
    }
    const dx = tgt.pos.x - f.pos.x;
    const dz = tgt.pos.z - f.pos.z;
    const d = Math.hypot(dx, dz) || 0.01;
    st.t -= dt;
    if (st.t <= 0) {
      st.t = 0.25 + Math.random() * 0.45;
      st.strafe = (Math.random() - 0.5) * 1.4;
      st.wantGuard = d < 3.5 && Math.random() < st.level * 0.55;
    }
    const kind = f.def.skills[0].kind;
    const pref = kind === 'projectile' || kind === 'heal' ? 6 : 1.7;
    let mx = 0;
    let mz = 0;
    if (d > pref) {
      mx = dx / d;
      mz = dz / d;
    } else if (d < pref - 2.5) {
      mx = -dx / d;
      mz = -dz / d;
    }
    mx += (-dz / d) * st.strafe * 0.6;
    mz += (dx / d) * st.strafe * 0.6;
    inp.mx = mx;
    inp.mz = mz;
    inp.guard = st.wantGuard && !!tgt.action;
    if (d < (f.def.light.shots ? 9 : f.def.light.range + 0.5) && Math.random() < dt * 5 * st.level) {
      inp.attack = true;
    }
    const si = Math.floor(Math.random() * f.def.skills.length);
    const sp = f.def.skills[si];
    const k2 = sp.kind;
    const ok = k2 === 'heal' ? f.hp < f.maxHp * 0.55 : d < (k2 === 'dash' ? 7 : k2 === 'shockwave' ? sp.radius : 12);
    if (ok && f.flux >= sp.cost && Math.random() < dt * 1.2 * st.level) {
      inp.skillIdx = si;
    }
    if (f.over >= 100 && Math.random() < dt * 1.5) {
      inp.over = true;
    }
    return inp;
  }

  update(rawDt, playerInput) {
    this.slowmo -= rawDt;
    if (this.intro > 0) this.intro -= rawDt; // 開戦の合図までは誰も動かない
    const dt = rawDt * (this.slowmo > 0 ? 0.4 : 1);
    for (const L of this.fxLights) {
      const u = L.userData;
      u.t = Math.max(0, u.t - rawDt);
      L.intensity = u.t > 0 ? u.p * (u.t / u.life) : 0;
    }
    const idle = { mx: 0, mz: 0 };
    for (const f of this.fighters) {
      let inp = idle;
      if (!this.ended && !(this.intro > 0)) {
        if (f.isPlayer) {
          inp = playerInput;
        } else if (f.cpu && !f.remoteAuth) {
          inp = this.aiInput(f, dt);
        }
      }
      f.update(dt, inp);
    }
    for (let i = 0; i < this.fighters.length; i++) {
      for (let j = i + 1; j < this.fighters.length; j++) {
        const a = this.fighters[i];
        const b = this.fighters[j];
        if (a.dead || b.dead) {
          continue;
        }
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = a.radius + b.radius;
        if (d < min && d > 1e-4) {
          const push = (min - d) / 2;
          if (!a.remoteAuth) {
            a.pos.x -= (dx / d) * push;
            a.pos.z -= (dz / d) * push;
          }
          if (!b.remoteAuth) {
            b.pos.x += (dx / d) * push;
            b.pos.z += (dz / d) * push;
          }
        }
      }
    }
    // 技の跡を素早く消す：例外で止まった演出や取り残しも強制回収
    // 実行中に追加された処理（光線・時間差発射など）は捨てずに次フレームへ持ち越す
    const running = this.effects;
    this.effects = [];
    const keep = running.filter((fn) => {
      try {
        return fn(dt);
      } catch (e) {
        return false;
      }
    });
    this.effects = keep.concat(this.effects);
    this.fxClock = (this.fxClock || 0) + rawDt;
    for (let i = this.fx.children.length - 1; i >= 0; i--) {
      const o = this.fx.children[i];
      if (o.isLight) continue; // 再利用する閃光ライトは一時エフェクトではない
      if (o.userData.born == null) {
        o.userData.born = this.fxClock;
      } else if (this.fxClock - o.userData.born > 6) {
        kill(this.fx, o);
      }
    }
    if (this.effects.length === 0 && this.fx.children.length) {
      for (let i = this.fx.children.length - 1; i >= 0; i--) {
        if (!this.fx.children[i].isLight) kill(this.fx, this.fx.children[i]);
      }
    }
    this.updateCamera(rawDt);
    if (!this.ended) {
      const alive = [0, 1].map((t) => this.fighters.some((f) => f.team === t && !f.dead));
      if (!alive[0] || !alive[1]) {
        this.ended = true;
        this.ui.end(alive[0] ? 0 : 1);
      }
    }
  }

  updateCamera(dt) {
    const c = new THREE.Vector3();
    let w = 0;
    for (const f of this.fighters) {
      if (f.dead) {
        continue;
      }
      const k = f.isPlayer ? 2 : 1;
      c.addScaledVector(f.pos, k);
      w += k;
    }
    if (w > 0) {
      c.multiplyScalar(1 / w);
    }
    let spread = 0;
    for (const f of this.fighters) {
      if (!f.dead) {
        spread = Math.max(spread, f.pos.distanceTo(c));
      }
    }
    this.camCenter.lerp(c, 1 - Math.exp(-5 * dt));
    const portrait = this.camera.aspect < 1 ? 1.7 : 1;
    const dist = (8 + spread * 0.9) * portrait;
    const target = this.camCenter.clone().add(new THREE.Vector3(0, dist * 0.62 + 1, dist));
    this.camera.position.lerp(target, 1 - Math.exp(-4 * dt));
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const s = this.shake * 0.35;
    this.camera.position.x += (Math.random() - 0.5) * s;
    this.camera.position.y += (Math.random() - 0.5) * s;
    this.camera.lookAt(this.camCenter.x, 1, this.camCenter.z);
  }

  dispose() {
    for (const f of this.fighters) {
      this.scene.remove(f.root);
      if (f.redMats) f.endAwaken();
      disposeModel(f.modelInstance, f.mixer);
      f.modelInstance = null;
    }
    // 生存中・消滅演出中のどちらも戦闘終了時に片付ける
    for (const s of this.summons) this.removeSummon(s);
    this.scene.remove(this.fx);
    this.fighters = [];
    this.effects = [];
  }
}
