// ストーリーモードのフィールド：町 → 野 → ダンジョン（迷宮）を歩いて目的地へ。
// 魔物は姿が見える「シンボルエンカウント」。触れると戦闘、目的地の祭壇で章の決戦。
import * as THREE from 'three';
import { instantiateModel } from './model-runtime.js?v=direct-texture-20261106c';
import { FIGHTERS } from './data.js';
import { makeGear, animGear, removeGear } from './gear.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 広大な世界：南の街道（前章の地から続く道）→ 町 → 長い野 → 最北の迷宮
export const BOUNDS = { minX: -130, maxX: 130, minZ: -536, maxZ: 120 };
const AREA = 3.2; // 以前の世界に対する自然物の密度倍率（広さに合わせる）
const TOWN = { x: 0, z: 10, r: 15 };
// 迷宮の大きさは章ごとに変わる（Field生成時に設定）
let DUN = { x0: -40, z0: -470, cols: 8, rows: 6, cell: 10 };
// ---- 10種の風土 × 10種の地形配置 = 100通りの世界 ----
const BIOMES = [
  { name: '若草', ground: 'tex-grass', tint: 0xffffff, sky: 0xcfe8ff, gnd: 0x5a8a3a, hue: 0.28, crowns: [0x4ab040, 0x6ac848, 0x3a9a50, 0x58c070, 0xffc838], flowers: [0xff5a8a, 0xffd23a, 0xffffff, 0xb070ff, 0x5ab0ff], trees: 1, conifer: 0.5, wall: 0xffffff, rune: 0x4ad8ff, water: 0x3aa8ff, glow: 0xd8ff70, roof: 0xffffff, field: ['の野', '平原', '草原'], dun: ['遺跡', '古城'] },
  { name: '桜', ground: 'tex-grass', tint: 0xfff0f4, sky: 0xffe0f0, gnd: 0x7a9a5a, hue: 0.3, crowns: [0xffb0d0, 0xffc0e0, 0xff98c0, 0xffe0f0, 0x6ac848], flowers: [0xffb0d0, 0xffffff, 0xff7aa8, 0xf0a0ff], trees: 1.1, conifer: 0.2, wall: 0xfff0f4, rune: 0xff8ad8, water: 0x7ac8ff, glow: 0xffc0e0, roof: 0xffd0e0, field: ['の花園', '桜並木', 'の丘'], dun: ['大祠', '社'] },
  { name: '紅葉', ground: 'tex-grass', tint: 0xffd8a0, sky: 0xffe0c0, gnd: 0x8a6a3a, hue: 0.12, crowns: [0xff8a30, 0xe04a3a, 0xffc838, 0xd06a20, 0xb03a2a], flowers: [0xffa020, 0xff5030, 0xffe060, 0xffffff], trees: 1.2, conifer: 0.35, wall: 0xffe8d0, rune: 0xffa040, water: 0x4a98d0, glow: 0xffb050, roof: 0xffb890, field: ['の森', '紅葉谷', '街道'], dun: ['古城', '地下迷宮'] },
  { name: '雪原', ground: 'tex-cobble', tint: 0xf0f6ff, sky: 0xe0f0ff, gnd: 0xc0d0e0, hue: 0.45, crowns: [0xf4f8ff, 0xd8e8f8, 0xe8f0ff, 0xb8d8f0], flowers: [0xbfe8ff, 0xffffff, 0x9ad0ff], trees: 0.9, conifer: 0.85, wall: 0xe0f0ff, rune: 0x8ae8ff, water: 0x9ad8ff, glow: 0xffffff, roof: 0x9ab8ff, field: ['雪原', 'の氷野', '凍土'], dun: ['氷窟', '氷の神殿'] },
  { name: '砂漠', ground: 'tex-dirt-road', tint: 0xffe0b0, sky: 0xfff0d0, gnd: 0xc09050, hue: 0.18, crowns: [0x8ab040, 0xa0b850, 0x6a9a40], flowers: [0xff7030, 0xffd040, 0xff4080], trees: 0.35, conifer: 0.1, wall: 0xffe0b0, rune: 0xffd040, water: 0x30c0d0, glow: 0xffe090, roof: 0xffe0a0, field: ['砂海', 'の砂丘', '荒野'], dun: ['王墓', '砂の神殿'] },
  { name: '沼地', ground: 'tex-grass', tint: 0xa8c090, sky: 0xb0c8b0, gnd: 0x3a4a30, hue: 0.22, crowns: [0x4a6a30, 0x5a7a40, 0x3a5a3a, 0x6a8a50], flowers: [0xb070ff, 0x80ff80, 0x40f0ff], trees: 1.3, conifer: 0.3, wall: 0xb0c8a0, rune: 0x80ff60, water: 0x5a8a50, glow: 0x9aff50, roof: 0xb0e090, field: ['の湿原', '霧の沼', '泥濘'], dun: ['沈没神殿', '朽ちた祠'] },
  { name: '火山', ground: 'tex-dirt-road', tint: 0x8a6a60, sky: 0xffb090, gnd: 0x4a2010, hue: 0.05, crowns: [0x5a3a30, 0x7a4a30, 0x3a2a2a, 0xff6a30], flowers: [0xff4020, 0xffa020, 0xffe040], trees: 0.45, conifer: 0.6, wall: 0xc08070, rune: 0xff5020, water: 0xff6020, glow: 0xff8030, roof: 0xa08080, field: ['の焦土', '灰の原', '溶岩原'], dun: ['火口神殿', '炎の砦'] },
  { name: '水晶', ground: 'tex-cobble', tint: 0xc8d8ff, sky: 0xd8e0ff, gnd: 0x6a6aa0, hue: 0.6, crowns: [0x8ac8ff, 0xb08aff, 0x8affe8, 0xe0b0ff], flowers: [0x8ac8ff, 0xb070ff, 0xffffff, 0x60ffe0], trees: 0.8, conifer: 0.4, wall: 0xd0d8ff, rune: 0xb080ff, water: 0x60e0ff, glow: 0xa0e0ff, roof: 0xc0b0ff, field: ['晶野', 'の水晶原', '輝き野'], dun: ['水晶宮', '星の祠'] },
  { name: '夜光', ground: 'tex-grass', tint: 0x7a90c0, sky: 0x8090d0, gnd: 0x203050, hue: 0.5, crowns: [0x30d0b0, 0x4080ff, 0x8050ff, 0x20a0a0], flowers: [0x40f0ff, 0xff60e0, 0x80ff80, 0xfff080], trees: 1.2, conifer: 0.4, wall: 0x9aa8e0, rune: 0x40ffd0, water: 0x2060c0, glow: 0x80fff0, roof: 0x9ab8ff, field: ['夜光の森', 'の幽林', '月影原'], dun: ['月の神殿', '影の迷宮'] },
  { name: '天空', ground: 'tex-cobble', tint: 0xfff8e8, sky: 0xffffff, gnd: 0xd8c8a0, hue: 0.3, crowns: [0xffffff, 0xffe8a0, 0xa0e0a0, 0xfff0d0], flowers: [0xffffff, 0xffe060, 0x9ad8ff], trees: 0.7, conifer: 0.2, wall: 0xfff8e0, rune: 0xffe070, water: 0xa0e0ff, glow: 0xfff0a0, roof: 0x9ab8ff, field: ['の天原', '雲上の庭', '空中回廊'], dun: ['天の聖堂', '光の塔'] }
];
const SYL = ['アル', 'ベル', 'セラ', 'ミナ', 'ロウ', 'カナ', 'ティ', 'ノル', 'エス', 'リム', 'ヴァ', 'ソラ', 'クオ', 'ハル', 'ネイ', 'ユラ'];

// ---- 地面や壁のテクスチャ（一度だけ読み込んで共有） ----
const TL = new THREE.TextureLoader();
const TEX = {};
function baseTex(name) {
  if (!TEX[name]) {
    const t = TL.load(`assets/${name}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    TEX[name] = t;
  }
  return TEX[name];
}
const FLOWER_COLS = [0xff5a8a, 0xffd23a, 0xffffff, 0xb070ff, 0x5ab0ff, 0xff8a3a, 0xff3a5a, 0xf0a0ff];

// ---- モデル（GLB）を指定の高さで置く小さな役者 ----
function makeActor(gltf, height, color, tint, own) {
  const root = new THREE.Group();
  const a = { root, mixer: null, clips: {}, cur: null, act: null };
  const instance = instantiateModel(gltf, height, tint);
  root.add(instance.wrapper);
  a.model = instance.model;
  own.push(...instance.materials);
  a.mixer = new THREE.AnimationMixer(instance.model);
  for (const clip of gltf.animations || []) {
    const n = clip.name.toLowerCase();
    for (const k of ['idle', 'walk', 'run']) if (n.includes(k) && !a.clips[k]) a.clips[k] = clip;
  }
  a.play = (name) => {
    if (!a.mixer || a.cur === name) return;
    a.cur = name;
    const clip = a.clips[name] || (name === 'run' ? a.clips.walk : null) || a.clips.idle;
    if (!clip) return;
    const act = a.mixer.clipAction(clip);
    if (act === a.act) return;
    act.reset().fadeIn(0.2).play();
    a.act?.fadeOut(0.2);
    a.act = act;
  };
  a.play('idle');
  return a;
}

export class Field {
  constructor(scene, o) {
    this.scene = scene;
    this.o = o;
    this.own = []; // このフィールドが作ったジオメトリ・マテリアル（破棄用）
    this.group = new THREE.Group();
    scene.add(this.group);
    this.circles = [];
    this.boxes = [];
    this.npcs = [];
    this.syms = [];
    this.remotes = new Map(); // 世界中の旅人（同じ章を歩いている他のプレイヤー）
    this.chests = [];
    this.frozen = false;
    this.inv = 0;
    this.prompt = '';
    this.region = '';
    this.t = 0;
    const r = (this.r = rng(o.chapter * 7717 + 99));
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    // 章ごとの風土（10種）と地形配置（10種）
    const B = (this.B = BIOMES[o.chapter % BIOMES.length]);
    const L = (this.L = Math.floor(o.chapter / BIOMES.length) % 10);
    const cols = 6 + ((L * 3 + o.chapter) % 5), rows = 4 + ((L + o.chapter) % 3);
    DUN = { x0: -(cols * 10) / 2 + ((L % 3) - 1) * 30, z0: -470, cols, rows, cell: 10 };
    this.houseN = 6 + ((L * 7 + o.chapter) % 5);
    this.treeMul = B.trees * (0.75 + (L % 4) * 0.15);
    this.pondN = 1 + ((L + o.chapter) % 5);
    this.townName = pick(SYL) + pick(SYL) + pick(['の町', '村', 'の宿場', 'の里', '港']);
    this.fieldName = pick(SYL) + pick(SYL) + pick(B.field);
    this.dunName = pick(SYL) + pick(SYL) + pick(B.dun);
    this.st = o.stage;
    this.buildGround();
    this.buildRoad();
    this.buildTown();
    this.buildDungeon();
    this.buildRoutes();
    this.buildWilds();
    this.buildActors();
    this.buildMapImage();
  }

  geo(g) { this.own.push(g); return g; }
  mat(m) { this.own.push(m); return m; }
  std(color, extra = {}) { return this.mat(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra })); }
  addBox(x, z, w, d) { this.boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); }
  tex(name, rx, ry) {
    const t = baseTex(name).clone();
    t.repeat.set(rx, ry);
    this.own.push(t);
    return t;
  }

  buildGround() {
    const st = this.st;
    const w = BOUNDS.maxX - BOUNDS.minX + 40, d = BOUNDS.maxZ - BOUNDS.minZ + 40;
    const B = this.B;
    const g = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, d)), this.std(new THREE.Color(B.tint).lerp(new THREE.Color(st.floor), 0.1), { map: this.tex(B.ground, w / 7, d / 7), roughness: 0.95 }));
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, 0, (BOUNDS.maxZ + BOUNDS.minZ) / 2);
    g.receiveShadow = true;
    this.group.add(g);
    // 空と大地の照り返しで色を鮮やかに
    this.group.add(new THREE.HemisphereLight(B.sky, B.gnd, 1.1));
    this.lights = [];
    this.anims = [];
  }
  pointLight(color, intensity, dist, x, y, z, flicker) {
    const l = new THREE.PointLight(color, intensity, dist, 1.6);
    l.position.set(x, y, z);
    l.userData.base = intensity;
    l.userData.flicker = flicker;
    this.group.add(l);
    this.lights.push(l);
    return l;
  }
  // 色ちがいの球を一括配置（花・果物・ベリーなど）
  dots(list, radius, colors, emissive = 0) {
    const geo = this.geo(new THREE.IcosahedronGeometry(radius, 0));
    const im = new THREE.InstancedMesh(geo, this.std(0xffffff, { roughness: 0.6, emissive: 0xffffff, emissiveIntensity: emissive }), list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    list.forEach(([x, y, z, k = 1], i) => {
      im.setMatrixAt(i, m.compose(p.set(x, y, z), q, s.setScalar(k)));
      im.setColorAt(i, c.set(colors[i % colors.length]));
    });
    this.group.add(im);
    return im;
  }

  buildRoad() {
    const r = this.r;
    const ex = DUN.x0 + this.entranceCol() * DUN.cell + DUN.cell / 2;
    // 南の街道（前章から続く道）→ 町 → 曲がりくねった長い野道 → 迷宮
    const pts = [[0, BOUNDS.maxZ - 2], [(r() - 0.5) * 30, 75], [0, 40], [0, 30], [0, -6]];
    const N = 24, endZ = DUN.z0 + 10;
    let x = 0;
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      x = Math.max(-95, Math.min(95, x + (r() - 0.5) * 70));
      pts.push([x * (1 - t) + ex * t * t, -6 + (endZ + 6) * t]);
    }
    pts.push([ex, DUN.z0 + 8], [ex, DUN.z0 - 1]);
    this.road = pts;
    const mat = this.std(0xffffff, { map: this.tex('tex-dirt-road', 1, 1) });
    const geo = this.geo(new THREE.PlaneGeometry(1, 1));
    const disc = this.geo(new THREE.CircleGeometry(2.6, 16));
    const edgeStones = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const segMat = this.std(0xffffff, { map: this.tex('tex-dirt-road', 1, len / 5.2) });
      const m = new THREE.Mesh(geo, segMat);
      // 道の縁石
      const nx = (bz - az) / (len || 1), nz = -(bx - ax) / (len || 1);
      for (let t = 0; t < len; t += 2.2) {
        const px = ax + ((bx - ax) * t) / len, pz = az + ((bz - az) * t) / len;
        for (const sd of [-1, 1]) if (r() < 0.55) edgeStones.push([px + nx * 2.8 * sd, 0.08, pz + nz * 2.8 * sd, 0.18 + r() * 0.2]);
      }
      m.scale.set(5.2, len, 1);
      m.rotation.set(-Math.PI / 2, 0, Math.atan2(bx - ax, bz - az));
      m.position.set((ax + bx) / 2, 0.02, (az + bz) / 2);
      m.receiveShadow = true;
      this.group.add(m);
      const j = new THREE.Mesh(disc, mat);
      j.rotation.x = -Math.PI / 2;
      j.position.set(bx, 0.021, bz);
      this.group.add(j);
    }
    this.dots(edgeStones, 1, [0x9a9488, 0xb8b0a0, 0x7a7468, 0xa89880]);
  }
  roadDist(x, z) {
    let best = 1e9;
    for (const p of [this.road, ...(this.branches || [])]) {
      for (let i = 0; i < p.length - 1; i++) {
        const [ax, az] = p[i], [bx, bz] = p[i + 1];
        const dx = bx - ax, dz = bz - az;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
        best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
      }
    }
    return best;
  }
  // 拠点（村・遺跡）の中か
  inSite(x, z, pad = 0) {
    for (const s of this.sites || []) if (Math.hypot(x - s.x, z - s.z) < s.r + pad) return s;
    return null;
  }
  // 脇道を敷く
  paintRoad(pts, width) {
    const geo = this.geo(new THREE.PlaneGeometry(1, 1));
    const disc = this.geo(new THREE.CircleGeometry(width / 2, 14));
    const dm = this.std(0xffffff, { map: this.tex('tex-dirt-road', 1, 1) });
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const m = new THREE.Mesh(geo, this.std(0xffffff, { map: this.tex('tex-dirt-road', 1, len / width) }));
      m.scale.set(width, len, 1);
      m.rotation.set(-Math.PI / 2, 0, Math.atan2(bx - ax, bz - az));
      m.position.set((ax + bx) / 2, 0.019, (az + bz) / 2);
      m.receiveShadow = true;
      const j = new THREE.Mesh(disc, dm);
      j.rotation.x = -Math.PI / 2;
      j.position.set(bx, 0.018, bz);
      this.group.add(m, j);
    }
  }

  // ---- 経路・村・遺跡：章ごとに数も形も変わる ----
  // 村の様式8種 × 遺跡の様式6種 × 数(村1〜3・遺跡1〜3・分かれ道) × 風土10種 → 100通り以上
  buildRoutes() {
    const r = this.r, o = this.o;
    const pick = (a) => a[Math.floor(r() * a.length)];
    this.sites = [];
    this.branches = [];
    this.extraChests = [];
    this.extraSyms = [];
    this.villageNpcs = [];
    const nV = 1 + ((o.chapter * 7 + this.L) % 3);
    const nR = 1 + ((o.chapter * 3 + this.L * 2) % 3);
    const plan = [...Array(nV).fill('v'), ...Array(nR).fill('r')];
    for (let i = plan.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [plan[i], plan[j]] = [plan[j], plan[i]];
    }
    const road = this.road;
    const first = 6, last = road.length - 4;
    plan.forEach((kind, idx) => {
      for (let tries = 0; tries < 40; tries++) {
        const wi = first + Math.floor(((idx + r()) / plan.length) * (last - first));
        const [wx, wz] = road[Math.min(last, wi)];
        const side = r() < 0.5 ? -1 : 1;
        const x = Math.max(-112, Math.min(112, wx + side * (38 + r() * 40)));
        const z = wz + (r() - 0.5) * 30;
        const rad = kind === 'v' ? 17 : 13;
        if (z > -40 || z < DUN.z0 + 28) continue;
        if (this.roadDist(x, z) < rad + 6) continue;
        if (this.sites.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + rad + 12)) continue;
        // 分かれ道：本道から曲がりながら拠点へ
        const mx = (wx + x) / 2 + (r() - 0.5) * 16, mz = (wz + z) / 2 + (r() - 0.5) * 16;
        const path = [[wx, wz], [mx, mz], [x, z]];
        this.branches.push(path);
        this.paintRoad(path, 3.6);
        if (kind === 'v') {
          const name = pick(SYL) + pick(SYL) + pick(['村', 'の集落', 'の宿場', 'の隠れ里', 'の野営地', 'の宿', '牧場', 'の市']);
          this.sites.push({ x, z, r: rad, name, kind });
          this.buildVillage(x, z, (o.chapter + idx * 3 + this.L) % 8, name);
        } else {
          const name = pick(SYL) + pick(SYL) + pick(['の廃墟', '小迷宮', 'の塔跡', '地下祠', 'の砦跡', 'の古墓']);
          this.sites.push({ x, z, r: rad, name, kind });
          this.buildRuin(x, z, (o.chapter * 5 + idx + this.L) % 6, Math.atan2(wx - x, wz - z));
        }
        break;
      }
    });
    // 本道どうしをつなぐ近道（輪になる経路）
    const nShort = (o.chapter + this.L) % 3;
    for (let k = 0; k < nShort; k++) {
      const a = first + Math.floor(r() * (last - first - 6)), b = a + 3 + Math.floor(r() * 3);
      const [ax, az] = road[a], [bx, bz] = road[Math.min(last, b)];
      const side = r() < 0.5 ? -1 : 1;
      const mx = Math.max(-115, Math.min(115, (ax + bx) / 2 + side * (30 + r() * 25)));
      const path = [[ax, az], [mx, (az * 2 + bz) / 3], [mx, (az + bz * 2) / 3], [bx, bz]];
      if (path.some(([px, pz]) => this.inSite(px, pz, 4))) continue;
      this.branches.push(path);
      this.paintRoad(path, 3.6);
    }
  }

  // 小さな村（8様式）
  buildVillage(cx, cz, style, name) {
    const r = this.r;
    const plaza = new THREE.Mesh(this.geo(new THREE.CircleGeometry(8, 28)), this.std(0xffffff, { map: this.tex('tex-cobble', 3, 3) }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(cx, 0.025, cz);
    plaza.receiveShadow = true;
    this.group.add(plaza);
    // 中央：井戸・焚き火・石碑・花壇 のどれか
    const center = style % 4;
    if (center === 0) {
      const well = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(1, 1.1, 1, 14)), this.std(0x9a9488));
      well.position.set(cx, 0.5, cz);
      const roof = new THREE.Mesh(this.geo(new THREE.ConeGeometry(1.6, 1, 4)), this.std(0x8a3a2a, { map: this.tex('tex-roof', 2, 1) }));
      roof.position.set(cx, 2.6, cz);
      roof.rotation.y = Math.PI / 4;
      this.group.add(well, roof);
    } else if (center === 1) {
      const fire = new THREE.Mesh(this.geo(new THREE.ConeGeometry(0.5, 1.2, 8)), this.mat(new THREE.MeshBasicMaterial({ color: 0xffa040 })));
      fire.position.set(cx, 0.6, cz);
      this.flames.push(fire);
      this.group.add(fire);
      this.pointLight(0xff9a40, 8, 16, cx, 1.5, cz, 0.3);
    } else if (center === 2) {
      const stele = new THREE.Mesh(this.geo(new THREE.BoxGeometry(1.2, 3, 0.5)), this.std(0xd0c8b8));
      stele.position.set(cx, 1.5, cz);
      const gem = new THREE.Mesh(this.geo(new THREE.OctahedronGeometry(0.4)), this.mat(new THREE.MeshStandardMaterial({ color: this.B.rune, emissive: this.B.rune, emissiveIntensity: 1.4 })));
      gem.position.set(cx, 3.6, cz);
      this.spinners.push(gem);
      this.group.add(stele, gem);
    } else {
      const fl = [];
      for (let i = 0; i < 60; i++) {
        const a = r() * 6.28, d = r() * 1.6;
        fl.push([cx + Math.cos(a) * d, 0.2, cz + Math.sin(a) * d, 0.14]);
      }
      this.dots(fl, 1, this.B.flowers, 0.2);
    }
    this.circles.push({ x: cx, z: cz, r: 1.3 });
    // 家々：様式で形が変わる
    const shape = Math.floor(style / 2) % 4; // 0:木組み 1:丸小屋 2:塔の家 3:天幕
    const n = 3 + Math.floor(r() * 4);
    const tentCols = [0xe04050, 0x3a80e0, 0xf0c040, 0x40b070, 0xb060e0];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.4;
      const hx = cx + Math.cos(a) * 12, hz = cz + Math.sin(a) * 12;
      const g = new THREE.Group();
      if (shape === 0) {
        const w = 4.5 + r() * 1.5, h = 3 + r();
        const body = new THREE.Mesh(this.geo(new THREE.BoxGeometry(w, h, w)), this.std(0xffffff, { map: this.tex('tex-house-wall', w / 4, h / 4) }));
        body.position.y = h / 2;
        const roof = new THREE.Mesh(this.geo(new THREE.ConeGeometry(w * 0.8, 2.2, 4)), this.std(new THREE.Color(this.B.roof), { map: this.tex('tex-roof', 3, 2) }));
        roof.position.y = h + 1.1;
        roof.rotation.y = Math.PI / 4;
        g.add(body, roof);
        this.addBox(hx, hz, w, w);
      } else if (shape === 1) {
        const body = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(2.2, 2.4, 2.6, 14)), this.std(0xe8d8b8));
        body.position.y = 1.3;
        const roof = new THREE.Mesh(this.geo(new THREE.ConeGeometry(3, 2.4, 14)), this.std(0xc8a050));
        roof.position.y = 3.8;
        g.add(body, roof);
        this.circles.push({ x: hx, z: hz, r: 2.4 });
      } else if (shape === 2) {
        const h = 6 + r() * 3;
        const body = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(1.8, 2, h, 10)), this.std(0xffffff, { map: this.tex('tex-dungeon-wall', 2, h / 4) }));
        body.position.y = h / 2;
        const roof = new THREE.Mesh(this.geo(new THREE.ConeGeometry(2.4, 3, 10)), this.std(new THREE.Color(this.B.roof).multiplyScalar(0.8), { map: this.tex('tex-roof', 3, 2) }));
        roof.position.y = h + 1.5;
        g.add(body, roof);
        this.circles.push({ x: hx, z: hz, r: 2 });
      } else {
        const c = tentCols[(i + style) % tentCols.length];
        const tent = new THREE.Mesh(this.geo(new THREE.ConeGeometry(2.4, 3.2, 6)), this.std(c, { emissive: c, emissiveIntensity: 0.08 }));
        tent.position.y = 1.6;
        g.add(tent);
        this.circles.push({ x: hx, z: hz, r: 2.2 });
      }
      g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      g.position.set(hx, 0, hz);
      g.rotation.y = a;
      this.group.add(g);
      this.houses.push({ x: hx, z: hz });
    }
    // 村人（話しかけられる）
    this.villageNpcs.push({ x: cx + 3, z: cz + 3, name });
  }

  // 小さな遺跡（6様式）：壁の迷路・柱の環・塔跡など。奥に宝箱、番人の魔物
  buildRuin(cx, cz, style, faceA) {
    const r = this.r;
    const S = 10 + (style % 3) * 2;
    const floor = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(S * 2, S * 2)), this.std(0xffffff, { map: this.tex('tex-dungeon-floor', S / 3, S / 3) }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0.03, cz);
    floor.receiveShadow = true;
    this.group.add(floor);
    const wallM = this.std(new THREE.Color(this.B.wall), { map: this.tex('tex-dungeon-wall', 2, 1), emissive: this.B.rune, emissiveMap: this.tex('tex-dungeon-wall', 2, 1), emissiveIntensity: 0.15 });
    const box = this.geo(new THREE.BoxGeometry(1, 1, 1));
    const wall = (x, z, w, d, h) => {
      const m = new THREE.Mesh(box, wallM);
      m.scale.set(w, h, d);
      m.position.set(x, h / 2, z);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      this.addBox(x, z, w, d);
    };
    // 入口は本道の方向に開ける
    const gx = Math.sin(faceA), gz = Math.cos(faceA);
    const openSide = Math.abs(gx) > Math.abs(gz) ? (gx > 0 ? 'e' : 'w') : (gz > 0 ? 's' : 'n');
    const H = style >= 3 ? 3.6 : 2.6;
    if (style % 2 === 0) {
      // 外壁（入口つき）＋内壁
      for (const side of ['n', 's', 'e', 'w']) {
        const hor = side === 'n' || side === 's';
        const off = side === 'n' || side === 'w' ? -S : S;
        if (side === openSide) {
          const seg = S - 2.5;
          for (const sgn of [-1, 1]) hor ? wall(cx + sgn * (2.5 + seg / 2), cz + off, seg, 0.8, H) : wall(cx + off, cz + sgn * (2.5 + seg / 2), 0.8, seg, H);
        } else hor ? wall(cx, cz + off, S * 2, 0.8, H) : wall(cx + off, cz, 0.8, S * 2, H);
      }
      const inner = 2 + style;
      for (let i = 0; i < inner; i++) {
        const hor = r() < 0.5, len = 4 + r() * (S - 4);
        const x = cx + (r() - 0.5) * S, z = cz + (r() - 0.5) * S;
        if (Math.hypot(x - cx, z - cz) < 3) continue;
        hor ? wall(x, z, len, 0.7, H * 0.8) : wall(x, z, 0.7, len, H * 0.8);
      }
    } else {
      // 柱の環（崩れた神殿・塔跡）
      const n = 8 + style * 2;
      const colGeo = this.geo(new THREE.CylinderGeometry(0.6, 0.75, 1, 8));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const h = r() < 0.3 ? 1 + r() * 2 : 4 + r() * 2;
        const c = new THREE.Mesh(colGeo, wallM);
        c.scale.y = h;
        c.position.set(cx + Math.cos(a) * (S - 1), h / 2, cz + Math.sin(a) * (S - 1));
        c.castShadow = true;
        this.group.add(c);
        this.circles.push({ x: c.position.x, z: c.position.z, r: 0.8 });
      }
    }
    // 中央の魔法陣と灯り
    const ring = new THREE.Mesh(this.geo(new THREE.RingGeometry(2, 2.5, 8)), this.mat(new THREE.MeshBasicMaterial({ color: this.B.rune, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.06, cz);
    (this.runes ||= []).push(ring);
    this.group.add(ring);
    this.pointLight(this.B.rune, 6, 16, cx, 3, cz, 0.2);
    this.extraChests.push([cx + 1.5, cz + 1.5]);
    // 番人
    for (let i = 0; i < 1 + (style % 3); i++) this.extraSyms.push([cx + (r() - 0.5) * S, cz + (r() - 0.5) * S]);
  }

  // ---- 町：広場・噴水・家々・街灯・門 ----
  buildTown() {
    const r = this.r, st = this.st;
    const plaza = new THREE.Mesh(this.geo(new THREE.CircleGeometry(TOWN.r, 40)), this.std(0xffffff, { map: this.tex('tex-cobble', 5, 5) }));
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(TOWN.x, 0.03, TOWN.z);
    plaza.receiveShadow = true;
    this.group.add(plaza);
    // 噴水
    const stone = this.std(0xd8d0c0);
    const basin = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(2.4, 2.6, 0.8, 24)), stone);
    basin.position.set(TOWN.x, 0.4, TOWN.z);
    const col = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.3, 0.45, 2.6, 10)), stone);
    col.position.set(TOWN.x, 1.3, TOWN.z);
    const water = new THREE.Mesh(this.geo(new THREE.CircleGeometry(2.2, 24)), this.mat(new THREE.MeshStandardMaterial({ color: 0x5ab0ff, emissive: 0x2060a0, emissiveIntensity: 0.5, roughness: 0.1 })));
    water.rotation.x = -Math.PI / 2;
    water.position.set(TOWN.x, 0.75, TOWN.z);
    const gem = new THREE.Mesh(this.geo(new THREE.OctahedronGeometry(0.5)), this.mat(new THREE.MeshStandardMaterial({ color: st.crystal, emissive: st.crystal, emissiveIntensity: 1.2 })));
    gem.position.set(TOWN.x, 3, TOWN.z);
    this.spinners = [gem];
    for (const m of [basin, col]) m.castShadow = true;
    this.group.add(basin, col, water, gem);
    this.circles.push({ x: TOWN.x, z: TOWN.z, r: 2.6 });
    // 家々（向きは90°単位）
    const roofCols = [0xffffff, 0x9ab8ff, 0xb0e090, 0xffe0a0, 0xe0a8ff, 0xffb890];
    const wallCols = [0xffffff, 0xfff0e0, 0xf0f8ff, 0xfff8d0, 0xffe8f0];
    const flowerBox = [];
    const allSpots = [[-22, 0], [-22, 16], [22, 0], [22, 16], [-12, 30], [12, 30], [-26, -10], [26, -10], [-30, 26], [30, 26]];
    for (let i = allSpots.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [allSpots[i], allSpots[j]] = [allSpots[j], allSpots[i]];
    }
    const spots = allSpots.slice(0, this.houseN);
    const roofTint = new THREE.Color(this.B.roof);
    this.houses = [];
    for (const [hx, hz] of spots) {
      const w = 6 + r() * 2.5, d = 5 + r() * 2, h = 3.2 + r() * 1.6;
      const face = Math.abs(hx) > Math.abs(hz - TOWN.z) ? (hx > 0 ? -Math.PI / 2 : Math.PI / 2) : (hz > TOWN.z ? Math.PI : 0);
      const g = new THREE.Group();
      const body = new THREE.Mesh(this.geo(new THREE.BoxGeometry(w, h, d)), this.std(wallCols[Math.floor(r() * wallCols.length)], { map: this.tex('tex-house-wall', w / 4, h / 4) }));
      body.position.y = h / 2;
      const roof = new THREE.Mesh(this.geo(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.6, 4)), this.std(new THREE.Color(roofCols[Math.floor(r() * roofCols.length)]).multiply(roofTint), { map: this.tex('tex-roof', 4, 2) }));
      // 窓辺の花箱
      for (const sx of [-w / 3, w / 3]) {
        const lx = sx, lz = d / 2 + 0.25;
        for (let k = 0; k < 4; k++) {
          const ox = lx - 0.4 + k * 0.27;
          const cs = Math.cos(face), sn = Math.sin(face);
          flowerBox.push([hx + ox * cs + lz * sn, h * 0.6 - 0.45, hz - ox * sn + lz * cs, 0.16]);
        }
      }
      const base = new THREE.Mesh(this.geo(new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3)), this.std(0x8a8478));
      base.position.y = 0.25;
      g.add(base);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
      roof.position.y = h + 1.3;
      const door = new THREE.Mesh(this.geo(new THREE.BoxGeometry(1.2, 2, 0.1)), this.std(0x4a3020));
      door.position.set(0, 1, d / 2 + 0.05);
      const winMat = this.mat(new THREE.MeshStandardMaterial({ color: 0xffd890, emissive: 0xffb040, emissiveIntensity: 0.9 }));
      const winGeo = this.geo(new THREE.BoxGeometry(0.9, 0.8, 0.1));
      for (const sx of [-w / 3, w / 3]) {
        const wn = new THREE.Mesh(winGeo, winMat);
        wn.position.set(sx, h * 0.6, d / 2 + 0.05);
        g.add(wn);
      }
      const chim = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.6, 1.6, 0.6)), this.std(0x8a7a6a));
      chim.position.set(w * 0.25, h + 1.6, -d * 0.15);
      for (const m of [body, roof, chim]) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
      g.add(body, roof, door, chim);
      g.position.set(hx, 0, hz);
      g.rotation.y = face;
      this.group.add(g);
      const rot = Math.abs(Math.sin(face)) > 0.5;
      this.addBox(hx, hz, rot ? d : w, rot ? w : d);
      this.houses.push({ x: hx, z: hz, w: rot ? d : w, d: rot ? w : d });
    }
    this.dots(flowerBox, 1, FLOWER_COLS, 0.15);
    this.buildTownDecor();
    // 街灯
    const postGeo = this.geo(new THREE.CylinderGeometry(0.08, 0.1, 3, 6));
    const postMat = this.std(0x2a2a30, { metalness: 0.6 });
    const lampGeo = this.geo(new THREE.SphereGeometry(0.25, 10, 8));
    const lampMat = this.mat(new THREE.MeshBasicMaterial({ color: 0xffe0a0 }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const x = TOWN.x + Math.cos(a) * (TOWN.r - 1), z = TOWN.z + Math.sin(a) * (TOWN.r - 1);
      const p = new THREE.Mesh(postGeo, postMat);
      p.position.set(x, 1.5, z);
      p.castShadow = true;
      const l = new THREE.Mesh(lampGeo, lampMat);
      l.position.set(x, 3.1, z);
      this.group.add(p, l);
      if (i % 2 === 0) this.pointLight(0xffc070, 6, 12, x, 3, z, 0.08);
      this.circles.push({ x, z, r: 0.3 });
    }
    // 北の門（町の出口）
    const gateMat = this.std(0x6a4a30);
    for (const sx of [-3.5, 3.5]) {
      const p = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.7, 5, 0.7)), gateMat);
      p.position.set(sx, 2.5, -8);
      p.castShadow = true;
      this.group.add(p);
      this.circles.push({ x: sx, z: -8, r: 0.6 });
    }
    const beam = new THREE.Mesh(this.geo(new THREE.BoxGeometry(8.4, 0.7, 0.8)), gateMat);
    beam.position.set(0, 5, -8);
    beam.castShadow = true;
    this.group.add(beam);
    // 町を囲う柵
    const fenceMat = this.std(0x7a5a3a);
    const fenceGeo = this.geo(new THREE.BoxGeometry(0.15, 1.1, 0.15));
    const railGeo = this.geo(new THREE.BoxGeometry(1, 0.1, 0.1));
    const R = 36;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const x = Math.cos(a) * R, z = TOWN.z + Math.sin(a) * R;
      if (Math.abs(x) < 5 && z < TOWN.z) continue; // 北の出口
      if (Math.abs(x) < 4 && z > TOWN.z) continue; // 南
      const p = new THREE.Mesh(fenceGeo, fenceMat);
      p.position.set(x, 0.55, z);
      const rl = new THREE.Mesh(railGeo, fenceMat);
      rl.scale.x = (2 * Math.PI * R) / 72;
      rl.position.set(x, 0.85, z);
      rl.rotation.y = -a + Math.PI / 2;
      this.group.add(p, rl);
    }
  }

  // ---- 町の彩り：花壇・露店・旗・桜・噴水のしぶき ----
  buildTownDecor() {
    const r = this.r, st = this.st;
    // 噴水まわりの花壇
    const beds = [];
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2, rr = 4 + r() * 1.6;
      beds.push([TOWN.x + Math.cos(a) * rr, 0.18 + r() * 0.12, TOWN.z + Math.sin(a) * rr, 0.12 + r() * 0.08]);
    }
    this.dots(beds, 1, FLOWER_COLS, 0.2);
    const bedRim = new THREE.Mesh(this.geo(new THREE.RingGeometry(3.8, 5.8, 40)), this.std(0x5a3a22));
    bedRim.rotation.x = -Math.PI / 2;
    bedRim.position.set(TOWN.x, 0.05, TOWN.z);
    this.group.add(bedRim);
    // 噴水のしぶき（上がって落ちる水滴）
    const N = 140;
    const sp = new Float32Array(N * 3);
    this.spray = { pts: null, seed: Array.from({ length: N }, () => [r() * Math.PI * 2, r(), 0.6 + r() * 0.8]) };
    const sg = this.geo(new THREE.BufferGeometry());
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.spray.pts = new THREE.Points(sg, this.mat(new THREE.PointsMaterial({ color: 0xbfe8ff, size: 0.16, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })));
    this.spray.pts.frustumCulled = false;
    this.group.add(this.spray.pts);
    // 露店（縞の日よけ・木箱・果物）
    const awnA = [0xe03040, 0x2a70e0, 0x20a060, 0xe0a020];
    const wood = this.std(0x7a5230);
    const fruits = [];
    [[-11, -2], [11, -2], [-12, 21], [12, 21]].forEach(([x, z], i) => {
      const g = new THREE.Group();
      const counter = new THREE.Mesh(this.geo(new THREE.BoxGeometry(3, 1, 1.4)), wood);
      counter.position.y = 0.5;
      g.add(counter);
      for (const [px, pz] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]]) {
        const post = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6)), wood);
        post.position.set(px, 1.3, pz);
        g.add(post);
      }
      for (let k = 0; k < 6; k++) {
        const stripe = new THREE.Mesh(this.geo(new THREE.BoxGeometry(0.55, 0.06, 2)), this.std(k % 2 ? 0xfff6e0 : awnA[i]));
        stripe.position.set(-1.375 + k * 0.55, 2.7, 0);
        stripe.rotation.x = 0.18;
        stripe.castShadow = true;
        g.add(stripe);
      }
      g.position.set(x, 0, z);
      g.rotation.y = Math.atan2(TOWN.x - x, TOWN.z - z);
      this.group.add(g);
      for (let k = 0; k < 14; k++) fruits.push([x + (r() - 0.5) * 2.4, 1.1, z + (r() - 0.5) * 0.8, 0.13]);
      this.addBox(x, z, 3.2, 3.2);
    });
    this.dots(fruits, 1, [0xff3030, 0xffa020, 0xffe040, 0x80d040, 0xa040e0]);
    // 旗（風になびく）
    const flagGeo = this.geo(new THREE.PlaneGeometry(1.4, 0.9));
    const flagCols = [st.crystal, 0xe03050, 0xffd040, 0x3a80ff];
    this.flags = [];
    [[-3.5, -8], [3.5, -8], [-15, 10], [15, 10], [-9, 26], [9, 26]].forEach(([x, z], i) => {
      const pole = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.06, 0.06, 6, 6)), this.std(0xd0b060, { metalness: 0.7, roughness: 0.3 }));
      pole.position.set(x, 3, z + (i < 2 ? 0 : 0));
      const f = new THREE.Mesh(flagGeo, this.std(flagCols[i % flagCols.length], { side: THREE.DoubleSide, emissive: flagCols[i % flagCols.length], emissiveIntensity: 0.15 }));
      f.position.set(x + 0.72, 5.4, z);
      f.castShadow = true;
      this.group.add(pole, f);
      this.flags.push(f);
      if (i >= 2) this.circles.push({ x, z, r: 0.2 });
    });
    // 町の花木（桜・紅葉）
    const trunkGeo = this.geo(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6));
    const crownGeo = this.geo(new THREE.IcosahedronGeometry(1.5, 1));
    const trunkMat = this.std(0x5a3a26);
    [[-17, -6, 0xffb0d0], [17, -6, 0xffb0d0], [-6, 32, 0xff9a40], [6, 32, 0xffc0e0], [-30, 8, 0xffb0d0], [30, 8, 0xffd060]].forEach(([x, z, c]) => {
      const t = new THREE.Mesh(trunkGeo, trunkMat);
      t.position.set(x, 1.1, z);
      const cr = new THREE.Mesh(crownGeo, this.std(c, { emissive: c, emissiveIntensity: 0.08 }));
      cr.position.set(x, 3, z);
      cr.scale.set(1.2, 1, 1.2);
      t.castShadow = cr.castShadow = true;
      this.group.add(t, cr);
      this.circles.push({ x, z, r: 0.4 });
    });
  }

  // ---- ダンジョン：外壁と迷路、最奥に祭壇 ----
  entranceCol() { return Math.floor(DUN.cols / 2) - (this.o.chapter % 2); }
  buildDungeon() {
    const r = this.r;
    const { x0, z0, cols, rows, cell } = DUN;
    const ec = this.entranceCol();
    const H = Array.from({ length: rows + 1 }, () => Array(cols).fill(true));
    const V = Array.from({ length: rows }, () => Array(cols + 1).fill(true));
    const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
    const stack = [[ec, 0]];
    seen[0][ec] = true;
    while (stack.length) {
      const [c, rr] = stack[stack.length - 1];
      const nb = [[c, rr + 1, 'n'], [c, rr - 1, 's'], [c + 1, rr, 'e'], [c - 1, rr, 'w']].filter(([a, b]) => a >= 0 && a < cols && b >= 0 && b < rows && !seen[b][a]);
      if (!nb.length) { stack.pop(); continue; }
      const [a, b, dir] = nb[Math.floor(r() * nb.length)];
      if (dir === 'n') H[rr + 1][c] = false;
      if (dir === 's') H[rr][c] = false;
      if (dir === 'e') V[rr][c + 1] = false;
      if (dir === 'w') V[rr][c] = false;
      seen[b][a] = true;
      stack.push([a, b]);
    }
    // 行き止まりを少し減らす（輪をつくる）
    for (let rr = 1; rr < rows; rr++) for (let c = 0; c < cols; c++) if (r() < 0.12) H[rr][c] = false;
    for (let rr = 0; rr < rows; rr++) for (let c = 1; c < cols; c++) if (r() < 0.12) V[rr][c] = false;
    H[0][ec] = false; // 入口
    this.maze = { H, V };
    // 最奥（入口から最も遠いマス）
    const dist = Array.from({ length: rows }, () => Array(cols).fill(-1));
    const q = [[ec, 0]];
    dist[0][ec] = 0;
    let far = [ec, 0];
    while (q.length) {
      const [c, rr] = q.shift();
      if (dist[rr][c] > dist[far[1]][far[0]]) far = [c, rr];
      const go = (a, b, open) => {
        if (open && a >= 0 && a < cols && b >= 0 && b < rows && dist[b][a] < 0) { dist[b][a] = dist[rr][c] + 1; q.push([a, b]); }
      };
      go(c, rr + 1, rr + 1 < rows && !H[rr + 1][c]);
      go(c, rr - 1, rr > 0 && !H[rr][c]);
      go(c + 1, rr, !V[rr][c + 1]);
      go(c - 1, rr, !V[rr][c]);
    }
    this.goal = { x: x0 + far[0] * cell + cell / 2, z: z0 - far[1] * cell - cell / 2 };
    // 床
    const floor = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(cols * cell, rows * cell)), this.std(0xffffff, { map: this.tex('tex-dungeon-floor', (cols * cell) / 6, (rows * cell) / 6), roughness: 0.6, metalness: 0.15 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x0 + (cols * cell) / 2, 0.04, z0 - (rows * cell) / 2);
    floor.receiveShadow = true;
    this.group.add(floor);
    // 壁（インスタンス描画）
    const walls = [];
    for (let rr = 0; rr <= rows; rr++) for (let c = 0; c < cols; c++) if (H[rr][c]) walls.push([x0 + c * cell + cell / 2, z0 - rr * cell, cell + 0.8, 0.8, rr === 0 || rr === rows]);
    for (let rr = 0; rr < rows; rr++) for (let c = 0; c <= cols; c++) if (V[rr][c]) walls.push([x0 + c * cell, z0 - rr * cell - cell / 2, 0.8, cell + 0.8, c === 0 || c === cols]);
    const wm = new THREE.InstancedMesh(this.geo(new THREE.BoxGeometry(1, 1, 1)), this.std(new THREE.Color(this.B.wall).lerp(new THREE.Color(this.st.pillar), 0.2), { map: this.tex('tex-dungeon-wall', 3, 1), emissive: this.B.rune, emissiveMap: this.tex('tex-dungeon-wall', 3, 1), emissiveIntensity: 0.18 }), walls.length);
    const mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    walls.forEach(([x, z, w, d, outer], i) => {
      const h = outer ? 4 : 2.4;
      wm.setMatrixAt(i, mtx.compose(ps.set(x, h / 2, z), q4, sc.set(w, h, d)));
      this.addBox(x, z, w, d);
    });
    wm.castShadow = true;
    wm.receiveShadow = true;
    this.group.add(wm);
    // 入口の門と松明
    const ex = x0 + ec * cell + cell / 2;
    const pil = this.std(new THREE.Color(this.st.pillar).multiplyScalar(0.8));
    const flame = this.mat(new THREE.MeshBasicMaterial({ color: 0xffa040 }));
    const flameGeo = this.geo(new THREE.ConeGeometry(0.3, 0.8, 8));
    this.flames = [];
    for (const sx of [-5.5, 5.5]) {
      const p = new THREE.Mesh(this.geo(new THREE.BoxGeometry(1.6, 7, 1.6)), pil);
      p.position.set(ex + sx, 3.5, z0);
      p.castShadow = true;
      const f = new THREE.Mesh(flameGeo, flame);
      f.position.set(ex + sx, 7.5, z0);
      this.flames.push(f);
      this.group.add(p, f);
    }
    const arch = new THREE.Mesh(this.geo(new THREE.BoxGeometry(12.6, 1.4, 1.8)), pil);
    arch.position.set(ex, 7.3, z0);
    this.group.add(arch);
    this.pointLight(0xff9a40, 10, 16, ex - 5.5, 7, z0 + 1, 0.25);
    this.pointLight(0xff9a40, 10, 16, ex + 5.5, 7, z0 + 1, 0.25);
    // 迷路内の松明
    for (let i = 0; i < 16; i++) {
      const w = walls[Math.floor(r() * walls.length)];
      const f = new THREE.Mesh(flameGeo, flame);
      f.position.set(w[0], (w[4] ? 4 : 2.4) + 0.4, w[1]);
      this.flames.push(f);
      this.group.add(f);
      if (i < 3) this.pointLight(0xff8a30, 8, 14, w[0], 3.4, w[1], 0.3);
    }
    // 交点の柱と、頂に光る結晶
    const crys = this.st.crystal;
    const pts = [];
    for (let rr = 0; rr <= rows; rr++) for (let c = 0; c <= cols; c++) pts.push([x0 + c * cell, z0 - rr * cell]);
    const colM = new THREE.InstancedMesh(this.geo(new THREE.CylinderGeometry(0.75, 0.9, 1, 8)), this.std(0xffffff, { map: this.tex('tex-dungeon-wall', 2, 1) }), pts.length);
    const capM = new THREE.InstancedMesh(this.geo(new THREE.OctahedronGeometry(0.45).scale(1, 1.8, 1)), this.mat(new THREE.MeshStandardMaterial({ color: crys, emissive: crys, emissiveIntensity: 1.6, roughness: 0.15 })), pts.length);
    pts.forEach(([x, z], i) => {
      const outer = Math.abs(z - z0) < 0.1 || Math.abs(z - (z0 - rows * cell)) < 0.1 || Math.abs(x - x0) < 0.1 || Math.abs(x - (x0 + cols * cell)) < 0.1;
      const h = (outer ? 4 : 2.4) + 0.6;
      colM.setMatrixAt(i, mtx.compose(ps.set(x, h / 2, z), q4, sc.set(1, h, 1)));
      capM.setMatrixAt(i, mtx.compose(ps.set(x, h + 0.7, z), q4, sc.set(1, 1, 1)));
    });
    colM.castShadow = true;
    this.group.add(colM, capM);
    // 床に浮かぶ魔法陣
    const runeGeo = this.geo(new THREE.RingGeometry(1.6, 2, 6));
    const runeMat = this.mat(new THREE.MeshBasicMaterial({ color: crys, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    for (let i = 0; i < 10; i++) {
      const c = Math.floor(r() * cols), rr = Math.floor(r() * rows);
      const m = new THREE.Mesh(runeGeo, runeMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x0 + c * cell + cell / 2 - 2.5, 0.06, z0 - rr * cell - cell / 2 - 2.5);
      this.group.add(m);
      (this.runes ||= []).push(m);
    }
    // 漂う光の粒
    this.motes = this.particles(260, crys, 0.22, () => [x0 + r() * cols * cell, 0.5 + r() * 4, z0 - r() * rows * cell]);
    // 祭壇：光の柱で遠くからも見える
    const G = this.goal;
    const alt = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(3, 3.4, 0.5, 8)), this.std(0xe0d8c8));
    alt.position.set(G.x, 0.25, G.z);
    alt.receiveShadow = true;
    const rune = new THREE.Mesh(this.geo(new THREE.RingGeometry(2.2, 2.7, 8)), this.mat(new THREE.MeshBasicMaterial({ color: this.st.crystal, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })));
    rune.rotation.x = -Math.PI / 2;
    rune.position.set(G.x, 0.55, G.z);
    const pillar = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(1.4, 1.4, 70, 16, 1, true)), this.mat(new THREE.MeshBasicMaterial({ color: this.st.crystal, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })));
    pillar.position.set(G.x, 35, G.z);
    this.goalRune = rune;
    this.goalPillar = pillar;
    this.group.add(alt, rune, pillar);
    this.pointLight(crys, 14, 18, G.x, 3, G.z, 0.15);
  }

  // 漂う光の粒（蛍・魔力の粒）
  particles(n, color, size, place) {
    const pos = new Float32Array(n * 3);
    const base = [];
    for (let i = 0; i < n; i++) {
      const [x, y, z] = place();
      base.push([x, y, z, Math.random() * 6]);
      pos.set([x, y, z], i * 3);
    }
    const g = this.geo(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, this.mat(new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
    pts.frustumCulled = false;
    this.group.add(pts);
    return { pts, base };
  }

  // ---- 野：木・岩・草・水晶・廃墟の柱・宝箱 ----
  buildWilds() {
    const r = this.r, st = this.st;
    const inDun = (x, z) => z < DUN.z0 + 4 && x > DUN.x0 - 4 && x < DUN.x0 + DUN.cols * DUN.cell + 4;
    const inTown = (x, z) => Math.hypot(x - TOWN.x, z - TOWN.z) < 38;
    const free = (x, z, roadGap) => !inDun(x, z) && !inTown(x, z) && !this.inSite(x, z, 2) && this.roadDist(x, z) > roadGap;
    const rnd = () => [BOUNDS.minX + r() * (BOUNDS.maxX - BOUNDS.minX), BOUNDS.minZ + r() * (BOUNDS.maxZ - BOUNDS.minZ)];
    // 木
    const trees = [];
    const B = this.B;
    const nCon = Math.round(340 * AREA * this.treeMul * (0.4 + B.conifer));
    for (let i = 0; i < 2600 * AREA && trees.length < nCon; i++) {
      const [x, z] = rnd();
      const edge = Math.min(x - BOUNDS.minX, BOUNDS.maxX - x) < 8;
      if (!free(x, z, 4.5) || (!edge && r() < 0.35)) continue;
      trees.push([x, z, 0.8 + r() * 0.7]);
    }
    const leaf = new THREE.Color(0x2f6a3a).lerp(new THREE.Color(st.crystal), 0.18);
    const trunkM = new THREE.InstancedMesh(this.geo(new THREE.CylinderGeometry(0.22, 0.32, 1.8, 6)), this.std(0x5a3e28), trees.length);
    const leafA = new THREE.InstancedMesh(this.geo(new THREE.ConeGeometry(1.6, 2.8, 7)), this.std(new THREE.Color(0xffffff).lerp(leaf, 0.25)), trees.length);
    const leafB = new THREE.InstancedMesh(this.geo(new THREE.ConeGeometry(1.1, 2.2, 7)), this.std(new THREE.Color(0xffffff).lerp(leaf, 0.2)), trees.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    const tc = new THREE.Color();
    trees.forEach(([x, z, k], i) => {
      trunkM.setMatrixAt(i, m.compose(p.set(x, 0.9 * k, z), q, s.set(k, k, k)));
      leafA.setMatrixAt(i, m.compose(p.set(x, 2.8 * k, z), q, s.set(k, k, k)));
      leafB.setMatrixAt(i, m.compose(p.set(x, 4.1 * k, z), q, s.set(k, k, k)));
      tc.setHSL(B.hue + (r() - 0.5) * 0.1, 0.45 + r() * 0.3, 0.55 + r() * 0.25);
      leafA.setColorAt(i, tc);
      leafB.setColorAt(i, tc.offsetHSL(0.02, 0, 0.08));
      this.circles.push({ x, z, r: 0.55 * k });
    });
    // 広葉樹（緑・桜・紅葉・黄金）
    const rounds = [];
    const nRound = Math.round(200 * AREA * this.treeMul * (1.1 - B.conifer));
    for (let i = 0; i < 2000 * AREA && rounds.length < nRound; i++) {
      const [x, z] = rnd();
      if (free(x, z, 5)) rounds.push([x, z, 0.8 + r() * 0.8]);
    }
    const crownCols = B.crowns;
    const rTrunk = new THREE.InstancedMesh(this.geo(new THREE.CylinderGeometry(0.2, 0.34, 2.4, 6)), this.std(0x6a4630), rounds.length);
    const rCrown = new THREE.InstancedMesh(this.geo(new THREE.IcosahedronGeometry(1.7, 1)), this.std(0xffffff, { roughness: 0.8 }), rounds.length);
    const rCrown2 = new THREE.InstancedMesh(this.geo(new THREE.IcosahedronGeometry(1.1, 1)), this.std(0xffffff, { roughness: 0.8 }), rounds.length);
    rounds.forEach(([x, z, k], i) => {
      rTrunk.setMatrixAt(i, m.compose(p.set(x, 1.2 * k, z), q, s.set(k, k, k)));
      rCrown.setMatrixAt(i, m.compose(p.set(x, 3.3 * k, z), q, s.set(k * 1.15, k * 0.95, k * 1.15)));
      rCrown2.setMatrixAt(i, m.compose(p.set(x + 0.8 * k, 4.2 * k, z + 0.3 * k), q, s.set(k, k, k)));
      tc.set(crownCols[Math.floor(r() * crownCols.length)]).offsetHSL(0, 0, (r() - 0.5) * 0.1);
      rCrown.setColorAt(i, tc);
      rCrown2.setColorAt(i, tc.offsetHSL(0, 0, 0.07));
      this.circles.push({ x, z, r: 0.5 * k });
    });
    for (const im of [rTrunk, rCrown, rCrown2]) {
      im.castShadow = true;
      this.group.add(im);
    }
    this.treePts = trees.concat(rounds);
    // 野の花（道ばたに多め）
    const flowers = [];
    for (let i = 0; i < 9000 * AREA && flowers.length < 2200 * AREA; i++) {
      const [x, z] = rnd();
      if (inTown(x, z) || inDun(x, z)) continue;
      const rd = this.roadDist(x, z);
      if (rd < 3.2 || (rd > 14 && r() < 0.6)) continue;
      // 小さな群れにする
      for (let k = 0; k < 4; k++) flowers.push([x + (r() - 0.5) * 1.4, 0.15 + r() * 0.15, z + (r() - 0.5) * 1.4, 0.09 + r() * 0.07]);
    }
    this.dots(flowers, 1, B.flowers, 0.25);
    // 茂みと実
    const bushes = [], berries = [];
    for (let i = 0; i < 1200 * AREA && bushes.length < 160 * AREA; i++) {
      const [x, z] = rnd();
      if (!free(x, z, 3.5)) continue;
      const k = 0.6 + r() * 0.7;
      bushes.push([x, k * 0.5, z, k]);
      for (let j = 0; j < 3; j++) berries.push([x + (r() - 0.5) * k, k * 0.6 + r() * k * 0.4, z + (r() - 0.5) * k, 0.1]);
    }
    this.dots(bushes, 0.9, [0x3a8a3a, 0x4aa040, 0x2f7a44, 0x5ab84a]).castShadow = true;
    this.dots(berries, 1, [0xff3050, 0x6a50ff, 0xffd040], 0.3);
    // 光るきのこ
    const shrooms = [];
    for (let i = 0; i < 400 * AREA && shrooms.length < 70 * AREA; i++) {
      const [x, z] = rnd();
      if (free(x, z, 3)) shrooms.push([x, 0.2, z, 0.18 + r() * 0.15]);
    }
    this.dots(shrooms, 1, [0x40f0ff, 0xff60e0, 0x80ff80], 1.2);
    // 池（睡蓮つき）
    const waterMat = this.mat(new THREE.MeshStandardMaterial({ color: B.water, emissive: new THREE.Color(B.water).multiplyScalar(0.4), emissiveIntensity: 0.45, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.88 }));
    this.ponds = [];
    const pads = [];
    for (let i = 0, made = 0; i < 900 && made < this.pondN * 3; i++) {
      const [x, z] = rnd();
      const pr = 3 + r() * 6;
      if (!free(x, z, pr + 4) || Math.abs(x) > 115) continue;
      made++;
      const w = new THREE.Mesh(this.geo(new THREE.CircleGeometry(pr, 32)), waterMat);
      w.rotation.x = -Math.PI / 2;
      w.position.set(x, 0.07, z);
      w.receiveShadow = true;
      this.group.add(w);
      this.ponds.push(w);
      const rim = [];
      for (let a = 0; a < Math.PI * 2; a += 0.35) rim.push([x + Math.cos(a) * (pr + 0.2), 0.12, z + Math.sin(a) * (pr + 0.2), 0.35 + r() * 0.25]);
      this.dots(rim, 1, [0x9a9488, 0xb8b0a0, 0x80786c]);
      for (let k = 0; k < 7; k++) {
        const a = r() * 6.28, d = r() * pr * 0.75;
        pads.push([x + Math.cos(a) * d, 0.1, z + Math.sin(a) * d]);
      }
      this.circles.push({ x, z, r: pr });
    }
    const padM = new THREE.InstancedMesh(this.geo(new THREE.CircleGeometry(0.45, 10)), this.std(0x3aa040, { side: THREE.DoubleSide }), Math.max(1, pads.length));
    const bloom = [];
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    padM.count = pads.length;
    pads.forEach(([x, y, z], i) => {
      padM.setMatrixAt(i, m.compose(p.set(x, y, z), qx, s.set(1, 1, 1)));
      if (i % 2) bloom.push([x + 0.1, 0.2, z, 0.14]);
    });
    this.group.add(padM);
    if (bloom.length) this.dots(bloom, 1, [0xffb0d8, 0xffffff], 0.4);
    // 蛍
    this.fireflies = this.particles(900, B.glow, 0.2, () => {
      let x, z;
      do [x, z] = rnd(); while (inDun(x, z));
      return [x, 0.6 + r() * 2.5, z];
    });
    for (const im of [trunkM, leafA, leafB]) {
      im.castShadow = true;
      this.group.add(im);
    }
    // 岩
    const rocks = [];
    for (let i = 0; i < 800 * AREA && rocks.length < 90 * AREA; i++) {
      const [x, z] = rnd();
      if (free(x, z, 3.5)) rocks.push([x, z, 0.5 + r() * 1.3, r() * 6]);
    }
    const rockM = new THREE.InstancedMesh(this.geo(new THREE.DodecahedronGeometry(1, 0)), this.std(new THREE.Color(st.pillar).lerp(new THREE.Color(0x888080), 0.5)), rocks.length);
    rocks.forEach(([x, z, k, a], i) => {
      q.setFromEuler(new THREE.Euler(a, a * 2, 0));
      rockM.setMatrixAt(i, m.compose(p.set(x, k * 0.45, z), q, s.set(k, k * 0.75, k)));
      this.circles.push({ x, z, r: k * 0.9 });
    });
    rockM.castShadow = true;
    rockM.receiveShadow = true;
    this.group.add(rockM);
    // 草むら
    q.identity();
    const NG = Math.round(2600 * AREA);
    const grass = new THREE.InstancedMesh(this.geo(new THREE.ConeGeometry(0.16, 0.7, 4)), this.std(0xffffff), NG);
    for (let i = 0; i < NG; i++) {
      const [x, z] = rnd();
      grass.setMatrixAt(i, m.compose(p.set(x, 0.3, z), q, s.set(1, 0.6 + r(), 1)));
      grass.setColorAt(i, tc.setHSL(B.hue + (r() - 0.5) * 0.1, 0.6, 0.35 + r() * 0.2));
    }
    this.group.add(grass);
    // 水晶と廃墟の柱
    const cMat = this.mat(new THREE.MeshStandardMaterial({ color: st.crystal, emissive: st.crystal, emissiveIntensity: 1, roughness: 0.2 }));
    const cGeo = this.geo(new THREE.OctahedronGeometry(0.7).scale(0.6, 1.6, 0.6));
    const pMat = this.std(st.pillar);
    const pGeo = this.geo(new THREE.CylinderGeometry(0.6, 0.75, 1, 8));
    for (let i = 0, made = 0; i < 400 * AREA && made < 34 * AREA; i++) {
      const [x, z] = rnd();
      if (!free(x, z, 4)) continue;
      made++;
      if (made % 2) {
        const c = new THREE.Mesh(cGeo, cMat);
        c.position.set(x, 1.1, z);
        c.rotation.z = (r() - 0.5) * 0.6;
        this.group.add(c);
        this.spinners.push(c);
        this.circles.push({ x, z, r: 0.5 });
      } else {
        const h = 1 + r() * 4;
        const pl = new THREE.Mesh(pGeo, pMat);
        pl.scale.y = h;
        pl.position.set(x, h / 2, z);
        pl.rotation.z = r() < 0.3 ? 0.3 : 0;
        pl.castShadow = true;
        this.group.add(pl);
        this.circles.push({ x, z, r: 0.75 });
      }
    }
    // 宝箱（野に4つ・迷宮に3つ）
    const boxM = this.std(0x8a5a2a), bandM = this.std(0xe0b040, { metalness: 0.8, roughness: 0.3 });
    const baseG = this.geo(new THREE.BoxGeometry(1.1, 0.7, 0.8)), lidG = this.geo(new THREE.BoxGeometry(1.15, 0.3, 0.85)), bandG = this.geo(new THREE.BoxGeometry(1.18, 0.12, 0.88));
    const spotsC = [];
    for (let i = 0; i < 1200 && spotsC.length < 12; i++) {
      const [x, z] = rnd();
      if (free(x, z, 3) && z < -20 && z > DUN.z0 + 12 && Math.abs(x) < 115) spotsC.push([x, z]);
    }
    for (let i = 0; i < 3; i++) {
      const c = Math.floor(r() * DUN.cols), rr = 1 + Math.floor(r() * (DUN.rows - 1));
      spotsC.push([DUN.x0 + c * DUN.cell + DUN.cell / 2 + 2, DUN.z0 - rr * DUN.cell - DUN.cell / 2 + 2]);
    }
    spotsC.push(...this.extraChests);
    for (const [x, z] of spotsC) {
      const g = new THREE.Group();
      const base = new THREE.Mesh(baseG, boxM);
      base.position.y = 0.35;
      const lid = new THREE.Group();
      const lm = new THREE.Mesh(lidG, boxM);
      lm.position.set(0, 0.15, 0.4);
      const band = new THREE.Mesh(bandG, bandM);
      band.position.set(0, 0.15, 0.4);
      lid.add(lm, band);
      lid.position.set(0, 0.7, -0.4);
      g.add(base, lid);
      g.position.set(x, 0, z);
      g.rotation.y = r() * 6;
      base.castShadow = true;
      this.group.add(g);
      this.chests.push({ x, z, g, lid, open: false });
      this.circles.push({ x, z, r: 0.6 });
    }
  }

  // ---- 人と魔物 ----
  buildActors() {
    const o = this.o, r = this.r;
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const ch = o.ch;
    const town = this.townName, dun = this.dunName;
    // 主人公と仲間
    const def = FIGHTERS[o.mainKey];
    this.player = makeActor(o.assets[o.mainKey], def.height, def.color, def.tint, this.own);
    this.setGear(this.player, def.height, o.gear);
    // 2章目以降は前の地から旅を続け、南の街道の端から歩いてくる
    this.continued = o.chapter > 0;
    const [sx0, sz0] = this.road[0];
    this.player.pos = this.continued ? new THREE.Vector3(sx0, 0, sz0 - 4) : new THREE.Vector3(0, 0, 24);
    this.player.facing = Math.PI;
    this.group.add(this.player.root);
    if (this.continued) {
      // 旅路の門（前章の地との境）
      const stone = this.std(0x8a8478);
      for (const dx of [-4, 4]) {
        const p = new THREE.Mesh(this.geo(new THREE.BoxGeometry(1.2, 6, 1.2)), stone);
        p.position.set(sx0 + dx, 3, sz0 - 8);
        p.castShadow = true;
        this.group.add(p);
        this.circles.push({ x: sx0 + dx, z: sz0 - 8, r: 0.8 });
      }
      const top = new THREE.Mesh(this.geo(new THREE.BoxGeometry(10, 1, 1.4)), stone);
      top.position.set(sx0, 6.3, sz0 - 8);
      const glow = new THREE.Mesh(this.geo(new THREE.OctahedronGeometry(0.6)), this.mat(new THREE.MeshStandardMaterial({ color: this.B.rune, emissive: this.B.rune, emissiveIntensity: 1.5 })));
      glow.position.set(sx0, 7.6, sz0 - 8);
      this.spinners.push(glow);
      this.group.add(top, glow);
    }
    this.followers = o.partyKeys.filter((k) => k !== o.mainKey).map((k) => {
      const d = FIGHTERS[k];
      const a = makeActor(o.assets[k], d.height, d.color, d.tint, this.own);
      a.pos = this.player.pos.clone().add(new THREE.Vector3(0, 0, 2));
      a.facing = Math.PI;
      this.group.add(a.root);
      return a;
    });
    this.trail = [];
    // 町の人々
    const people = [
      ['長老', [[`${town}の長老`, `よく来たな、旅の方。「${ch.title}」……灯を奪った者は、北の${dun}の奥に潜んでおる。`], [`${town}の長老`, '町を出て道なりに北へ。光の柱が立つ場所こそ、その最奥じゃ。']]],
      ['衛兵', [['町の衛兵', '町の外には魔物がうろついている。姿が見えるから、避けて通るのも手だ。'], ['町の衛兵', '触れたら最後、戦いになる。仲間と力を合わせて斬り伏せろ！']]],
      ['商人', [['旅の商人', '宝箱を見つけたら触ってみな。灯晶が入ってることがあるぜ。'], ['旅の商人', '迷宮の中にも宝箱があるって噂だ。']]],
      ['子ども', [['町の子ども', 'ねえねえ！遺跡の奥に光の柱が立ってるの、見た？'], ['町の子ども', '右上の地図に、星のしるしが出てるでしょ？あそこだよ！']]],
      ['宿屋の娘', [['宿屋の娘', '旅の方、どうかご無事で。'], ['宿屋の娘', '疲れたら、Shiftキーで駆け足になると早く進めますよ。']]],
      ['吟遊詩人', [['吟遊詩人', `♪ 双つの月の下　${dun}に眠る影……`], ['吟遊詩人', '灯を取り戻す者の歌を、いつか歌わせておくれ。']]],
      ['老婆', [['町の老婆', `${dun}は迷路のように入り組んでおる。壁づたいに進むと良いぞ。`]]],
      ['鍛冶屋', [['鍛冶屋', '武器や強化は「鍛冶場」で頼むといい。灯晶さえあればな！']]]
    ];
    const npcModels = o.npcKeys;
    const spots = [[-6, 2], [6, 2], [-8, 18], [8, 18], [0, -2], [-14, 10], [14, 10], [0, 26]];
    // 道中の村の人々
    const vLines = [
      (n) => [[`${n}の村人`, `ようこそ${n}へ。${dun}へ向かうなら、本道へ戻って北へ進みなされ。`]],
      (n) => [[`${n}の狩人`, '脇道の先の遺跡には宝が眠っているが、番人の魔物もいる。気をつけな。']],
      (n) => [[`${n}の旅人`, `${town}から来たのかい？この先は道が分かれている。地図をよく見るといい。`]],
      (n) => [[`${n}の娘`, '近道もあるけれど、魔物も多いの。']]
    ];
    this.villageNpcs.forEach((v, i) => {
      people.push([`${v.name}の人`, vLines[i % vLines.length](v.name)]);
      spots.push([v.x, v.z]);
    });
    people.forEach(([role, lines], i) => {
      const k = npcModels[i % npcModels.length];
      const d = FIGHTERS[k];
      const a = makeActor(o.assets[k], (d?.height || 1.75) * 0.95, d?.color, [0xd8c8a8, 0x9ab0d0, 0xc0a080, 0xa0c090, 0xe0b0b0, 0xb0a0d0][i % 6], this.own);
      const [x, z] = spots[i];
      a.pos = new THREE.Vector3(x, 0, z);
      a.home = a.pos.clone();
      a.facing = r() * 6;
      a.role = role;
      a.lines = lines;
      a.wander = { t: r() * 3, tx: x, tz: z };
      this.group.add(a.root);
      this.npcs.push(a);
    });
    // 名札（頭上の「！」）
    const markMat = this.mat(new THREE.MeshBasicMaterial({ color: 0xffe070 }));
    const markGeo = this.geo(new THREE.OctahedronGeometry(0.18));
    for (const n of this.npcs) {
      const mk = new THREE.Mesh(markGeo, markMat);
      mk.position.y = 2.3;
      n.root.add(mk);
      n.mark = mk;
    }
    // 魔物シンボル
    const auraGeo = this.geo(new THREE.RingGeometry(0.6, 1.05, 24));
    const auraMat = this.mat(new THREE.MeshBasicMaterial({ color: 0xff3050, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    const nField = 22 + Math.floor(o.chapter / 6);
    const spotsE = [];
    const span = -24 - (DUN.z0 + 14);
    for (let i = 0; i < 3000 && spotsE.length < nField; i++) {
      const z = -24 - r() * span, x = (r() - 0.5) * 230;
      if (this.roadDist(x, z) < 26) spotsE.push([x, z]);
    }
    spotsE.push(...this.extraSyms);
    // 南の街道にも少しだけ
    for (let i = 0; i < 300 && spotsE.length < nField + 3; i++) {
      const z = 50 + r() * 50, x = (r() - 0.5) * 80;
      if (this.roadDist(x, z) < 14 && this.roadDist(x, z) > 5) spotsE.push([x, z]);
    }
    for (let i = 0; i < 4; i++) {
      const c = Math.floor(r() * DUN.cols), rr = 1 + Math.floor(r() * (DUN.rows - 1));
      spotsE.push([DUN.x0 + c * DUN.cell + DUN.cell / 2, DUN.z0 - rr * DUN.cell - DUN.cell / 2]);
    }
    for (const [x, z] of spotsE) {
      const k = pick(o.enemyPool);
      const d = FIGHTERS[k];
      const a = makeActor(o.assets[k], 1.7, d?.color, d?.tint, this.own);
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.rotation.x = -Math.PI / 2;
      aura.position.y = 0.06;
      a.root.add(aura);
      a.aura = aura;
      a.key = k;
      a.pos = new THREE.Vector3(x, 0, z);
      a.home = a.pos.clone();
      a.facing = r() * 6;
      a.wander = { t: 0, tx: x, tz: z };
      this.group.add(a.root);
      this.syms.push(a);
    }
    // 最奥の主（章の敵）
    const bossKey = ch.enemies[0]?.k || pick(o.enemyPool);
    const bd = FIGHTERS[bossKey];
    this.boss = makeActor(o.assets[bossKey], ch.boss ? 2.6 : 2, bd?.color, ch.enemies[0]?.tint ?? bd?.tint, this.own);
    this.boss.pos = new THREE.Vector3(this.goal.x, 0.5, this.goal.z);
    this.boss.facing = 0;
    this.group.add(this.boss.root);
  }

  // ---- 地図の下絵（静的部分）を一度だけ描く ----
  buildMapImage() {
    // 広い世界全体を1m=1pxで描き、表示時に自分の周りだけ切り出す（スクロール地図）
    this.mapW = 104;
    this.mapH = 228;
    const W = BOUNDS.maxX - BOUNDS.minX, Hh = BOUNDS.maxZ - BOUNDS.minZ;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = Hh;
    const g = c.getContext('2d');
    const sx = 1, sz = 1;
    this.toMap = (x, z) => [(x - BOUNDS.minX) * sx, (BOUNDS.maxZ - z) * sz];
    g.fillStyle = 'rgba(30,50,30,0.85)';
    g.fillRect(0, 0, W, Hh);
    g.fillStyle = 'rgba(20,70,30,0.9)';
    for (const [x, z] of this.treePts) {
      const [a, b] = this.toMap(x, z);
      g.fillRect(a - 0.8, b - 0.8, 1.6, 1.6);
    }
    g.strokeStyle = '#b8a070';
    g.lineWidth = 3;
    for (const br of this.branches) {
      g.beginPath();
      br.forEach(([x, z], i) => {
        const [a, b] = this.toMap(x, z);
        if (i) g.lineTo(a, b);
        else g.moveTo(a, b);
      });
      g.stroke();
    }
    for (const s of this.sites) {
      const [a, b] = this.toMap(s.x, s.z);
      g.fillStyle = s.kind === 'v' ? 'rgba(200,184,152,0.85)' : 'rgba(90,70,120,0.9)';
      g.beginPath();
      g.arc(a, b, s.r * 0.8, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#d8c090';
    g.lineWidth = 4;
    g.beginPath();
    this.road.forEach(([x, z], i) => {
      const [a, b] = this.toMap(x, z);
      if (i) g.lineTo(a, b);
      else g.moveTo(a, b);
    });
    g.stroke();
    const [tx, tz] = this.toMap(TOWN.x, TOWN.z);
    g.fillStyle = '#c8b898';
    g.beginPath();
    g.arc(tx, tz, TOWN.r * sx * 1.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#a04030';
    for (const h of this.houses) {
      const [a, b] = this.toMap(h.x, h.z);
      g.fillRect(a - 3, b - 3, 6, 6);
    }
    for (const pd of this.ponds) {
      const [a, b] = this.toMap(pd.position.x, pd.position.z);
      g.fillStyle = '#4aa0e0';
      g.beginPath();
      g.arc(a, b, pd.geometry.parameters.radius, 0, Math.PI * 2);
      g.fill();
    }
    const [d0x, d0z] = this.toMap(DUN.x0, DUN.z0);
    const [d1x, d1z] = this.toMap(DUN.x0 + DUN.cols * DUN.cell, DUN.z0 - DUN.rows * DUN.cell);
    g.fillStyle = '#3a3440';
    g.fillRect(d0x, d0z, d1x - d0x, d1z - d0z);
    g.strokeStyle = '#a89cb8';
    g.lineWidth = 1;
    g.beginPath();
    const { H, V } = this.maze;
    for (let rr = 0; rr <= DUN.rows; rr++) for (let cc = 0; cc < DUN.cols; cc++) if (H[rr][cc]) {
      const [a, b] = this.toMap(DUN.x0 + cc * DUN.cell, DUN.z0 - rr * DUN.cell);
      const [e] = this.toMap(DUN.x0 + (cc + 1) * DUN.cell, 0);
      g.moveTo(a, b);
      g.lineTo(e, b);
    }
    for (let rr = 0; rr < DUN.rows; rr++) for (let cc = 0; cc <= DUN.cols; cc++) if (V[rr][cc]) {
      const [a, b] = this.toMap(DUN.x0 + cc * DUN.cell, DUN.z0 - rr * DUN.cell);
      const [, e] = this.toMap(0, DUN.z0 - (rr + 1) * DUN.cell);
      g.moveTo(a, b);
      g.lineTo(a, e);
    }
    g.stroke();
    this.mapBase = c;
  }

  drawMap(ctx) {
    const W = this.mapW, Hh = this.mapH;
    ctx.clearRect(0, 0, W, Hh);
    const [pmx, pmz] = this.toMap(this.player.pos.x, this.player.pos.z);
    const ox = Math.max(0, Math.min(this.mapBase.width - W, pmx - W / 2));
    const oz = Math.max(0, Math.min(this.mapBase.height - Hh, pmz - Hh * 0.6));
    ctx.save();
    ctx.translate(-ox, -oz);
    ctx.drawImage(this.mapBase, 0, 0);
    for (const c of this.chests) {
      if (c.open) continue;
      const [a, b] = this.toMap(c.x, c.z);
      ctx.fillStyle = '#ffd040';
      ctx.fillRect(a - 1.5, b - 1.5, 3, 3);
    }
    ctx.fillStyle = '#ff4050';
    for (const s of this.syms) {
      const [a, b] = this.toMap(s.pos.x, s.pos.z);
      ctx.beginPath();
      ctx.arc(a, b, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const a of this.remotes.values()) {
      const [rx, rz] = this.toMap(a.pos.x, a.pos.z);
      ctx.fillStyle = a.friend ? '#70ff9a' : '#7fd3ff';
      ctx.fillRect(rx - 2, rz - 2, 4, 4);
    }
    let [gx, gz] = this.toMap(this.goal.x, this.goal.z);
    // 画面外の目的地は地図の端に表示
    gx = Math.max(ox + 6, Math.min(ox + W - 6, gx));
    gz = Math.max(oz + 6, Math.min(oz + Hh - 6, gz));
    const pulse = 3.5 + Math.sin(this.t * 5) * 1.2;
    ctx.fillStyle = '#fff070';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? pulse * 0.45 : pulse;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(gx + Math.cos(a) * rr, gz + Math.sin(a) * rr);
    }
    ctx.fill();
    const p = this.player;
    const [px, pz] = this.toMap(p.pos.x, p.pos.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-p.facing + Math.PI);
    ctx.fillStyle = '#7fd3ff';
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.lineTo(3.2, 3.5);
    ctx.lineTo(-3.2, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // ---- 当たり判定（円と箱から押し出す） ----
  resolve(pos, rad) {
    for (const c of this.circles) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const rr = c.r + rad;
      if (Math.abs(dx) > rr || Math.abs(dz) > rr) continue;
      const d = Math.hypot(dx, dz);
      if (d < rr && d > 1e-4) {
        pos.x = c.x + (dx / d) * rr;
        pos.z = c.z + (dz / d) * rr;
      }
    }
    for (const b of this.boxes) {
      const cx = Math.max(b.x0, Math.min(b.x1, pos.x)), cz = Math.max(b.z0, Math.min(b.z1, pos.z));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d = Math.hypot(dx, dz);
      if (d < rad) {
        if (d > 1e-4) {
          pos.x = cx + (dx / d) * rad;
          pos.z = cz + (dz / d) * rad;
        } else {
          // 箱の中に入り込んだ：一番近い辺へ
          const opts = [[b.x0 - rad - pos.x, 0], [b.x1 + rad - pos.x, 0], [0, b.z0 - rad - pos.z], [0, b.z1 + rad - pos.z]];
          opts.sort((u, v) => Math.abs(u[0] + u[1]) - Math.abs(v[0] + v[1]));
          pos.x += opts[0][0];
          pos.z += opts[0][1];
        }
      }
    }
    pos.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, pos.x));
    pos.z = Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, pos.z));
  }

  regionAt(z, x) {
    if (z > TOWN.z + 40) return `${this.townName}へ続く旅路`;
    const site = this.inSite(x, z);
    if (site) return site.name;
    if (z > -10 && Math.hypot(x - TOWN.x, z - TOWN.z) < 38) return this.townName;
    if (z < DUN.z0) return this.dunName;
    return this.fieldName;
  }

  objective() {
    const p = this.player.pos;
    const d = Math.round(Math.hypot(this.goal.x - p.x, this.goal.z - p.z));
    return `目的地：${this.dunName}の最奥（光の柱）　あと ${d}m`;
  }

  // ---- 毎フレーム ----
  update(dt, inp, camera) {
    this.t += dt;
    const p = this.player;
    this.inv = Math.max(0, this.inv - dt);
    if (!this.frozen && inp) {
      const len = Math.hypot(inp.mx, inp.mz);
      const moving = len > 0.12;
      if (moving) {
        const sp = (inp.guard ? 11 : 7) * Math.min(1, len);
        p.pos.x += (inp.mx / len) * sp * dt;
        p.pos.z += (inp.mz / len) * sp * dt;
        p.facing = Math.atan2(inp.mx, inp.mz);
      }
      this.resolve(p.pos, 0.45);
      p.play(moving ? 'run' : 'idle');
      // 仲間は足跡をたどってついてくる
      const last = this.trail[this.trail.length - 1];
      if (!last || last.distanceTo(p.pos) > 0.5) {
        this.trail.push(p.pos.clone());
        if (this.trail.length > 40) this.trail.shift();
      }
      this.followers.forEach((f, i) => {
        const tgt = this.trail[Math.max(0, this.trail.length - 1 - (i + 1) * 4)] || p.pos;
        const dx = tgt.x - f.pos.x, dz = tgt.z - f.pos.z;
        const d = Math.hypot(dx, dz);
        const go = d > 0.9;
        if (go) {
          const sp = Math.min(d * 4, 12) * dt;
          f.pos.x += (dx / d) * sp;
          f.pos.z += (dz / d) * sp;
          f.facing = Math.atan2(dx, dz);
        }
        f.play(go ? 'run' : 'idle');
      });
      // 話しかける
      let near = null;
      for (const n of this.npcs) {
        const d = n.pos.distanceTo(p.pos);
        if (d < 2.4 && (!near || d < near.pos.distanceTo(p.pos))) near = n;
      }
      this.prompt = near ? `${near.role}に話しかける（J／クリック／「斬」）` : '';
      if (near && inp.attack) {
        near.facing = Math.atan2(p.pos.x - near.pos.x, p.pos.z - near.pos.z);
        near.mark.visible = false;
        this.o.onTalk(near.lines);
      }
      // 宝箱
      for (const c of this.chests) {
        if (!c.open && Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < 1.5) {
          c.open = true;
          this.o.onChest(20 + Math.floor(this.r() * 30) + this.o.chapter);
        }
      }
      // 目的地
      if (Math.hypot(this.goal.x - p.pos.x, this.goal.z - p.pos.z) < 3.4) {
        this.frozen = true;
        this.o.onGoal();
      }
      // 地域名
      const reg = this.regionAt(p.pos.z, p.pos.x);
      if (reg !== this.region) {
        const first = !this.region;
        this.region = reg;
        this.o.onRegion(reg, first);
      }
    }
    // 町の人：うろうろ・近づくとこちらを向く
    for (const n of this.npcs) {
      const d = n.pos.distanceTo(p.pos);
      let moving = false;
      if (d < 3.5) {
        n.facing = Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z);
      } else {
        const w = n.wander;
        w.t -= dt;
        if (w.t <= 0) {
          w.t = 2 + this.r() * 4;
          w.tx = n.home.x + (this.r() - 0.5) * 5;
          w.tz = n.home.z + (this.r() - 0.5) * 5;
        }
        const dx = w.tx - n.pos.x, dz = w.tz - n.pos.z;
        const dd = Math.hypot(dx, dz);
        if (dd > 0.3) {
          n.pos.x += (dx / dd) * 1.4 * dt;
          n.pos.z += (dz / dd) * 1.4 * dt;
          n.facing = Math.atan2(dx, dz);
          moving = true;
        }
      }
      n.play(moving ? 'walk' : 'idle');
      n.mark.position.y = 2.3 + Math.sin(this.t * 3) * 0.1;
      n.mark.rotation.y += dt * 2;
    }
    // 魔物シンボル：うろつき → 近づくと追ってくる → 触れたら戦闘
    for (const s of this.syms) {
      const dx = p.pos.x - s.pos.x, dz = p.pos.z - s.pos.z;
      const d = Math.hypot(dx, dz);
      // 遠くの魔物は止めて描画もしない（広い世界でも軽く）
      s.far = d > 90;
      s.root.visible = !s.far;
      if (s.far) continue;
      let mx = 0, mz = 0, sp = 0;
      if (this.inv > 0 && d < 10) {
        mx = -dx / d; mz = -dz / d; sp = 3; // 戦闘直後は逃げる
      } else if (d < 9 && !this.frozen) {
        mx = dx / d; mz = dz / d; sp = 4.6;
      } else {
        const w = s.wander;
        w.t -= dt;
        if (w.t <= 0) {
          w.t = 1.5 + this.r() * 3;
          w.tx = s.home.x + (this.r() - 0.5) * 12;
          w.tz = s.home.z + (this.r() - 0.5) * 12;
        }
        const wx = w.tx - s.pos.x, wz = w.tz - s.pos.z;
        const wd = Math.hypot(wx, wz);
        if (wd > 0.4) { mx = wx / wd; mz = wz / wd; sp = 1.8; }
      }
      if (this.frozen) sp = 0;
      if (sp) {
        s.pos.x += mx * sp * dt;
        s.pos.z += mz * sp * dt;
        s.facing = Math.atan2(mx, mz);
        this.resolve(s.pos, 0.5);
      }
      s.play(sp > 2 ? 'run' : sp ? 'walk' : 'idle');
      s.aura.scale.setScalar(1 + Math.sin(this.t * 4 + s.home.x) * 0.15);
      s.aura.material.opacity = d < 9 ? 0.95 : 0.6;
      if (!this.frozen && this.inv <= 0 && d < 1.3) {
        this.frozen = true;
        this.o.onEncounter(s);
      }
    }
    // 宝箱のふたが開く
    for (const c of this.chests) if (c.open) c.lid.rotation.x = THREE.MathUtils.damp(c.lid.rotation.x, -1.9, 6, dt);
    // 演出
    for (const s of this.spinners) s.rotation.y += dt;
    for (const f of this.flames) f.scale.set(1, 0.8 + Math.random() * 0.5, 1);
    for (const l of this.lights) l.intensity = l.userData.base * (1 - l.userData.flicker + Math.random() * l.userData.flicker * 2);
    for (let i = 0; i < this.flags.length; i++) {
      const f = this.flags[i];
      f.rotation.y = Math.sin(this.t * 2.4 + i) * 0.35;
      f.rotation.z = Math.sin(this.t * 3.1 + i * 2) * 0.06;
    }
    // 噴水のしぶき
    const sa = this.spray.pts.geometry.attributes.position;
    this.spray.seed.forEach(([a, ph, v], i) => {
      const k = (this.t * 0.7 * v + ph) % 1;
      const rr = 0.2 + k * 1.9;
      sa.setXYZ(i, TOWN.x + Math.cos(a) * rr, 2.8 + k * 1.6 - k * k * 3.8, TOWN.z + Math.sin(a) * rr);
    });
    sa.needsUpdate = true;
    for (const m of this.runes) m.rotation.z += dt * 0.6;
    // 蛍と魔力の粒
    for (const pt of [this.fireflies, this.motes]) {
      const at = pt.pts.geometry.attributes.position;
      const tt = this.t;
      pt.base.forEach(([x, y, z, ph], i) => {
        at.setXYZ(i, x + Math.sin(tt * 0.6 + ph) * 1.2, y + Math.sin(tt * 1.3 + ph * 2) * 0.5, z + Math.cos(tt * 0.5 + ph) * 1.2);
      });
      at.needsUpdate = true;
      pt.pts.material.opacity = 0.55 + Math.sin(this.t * 3) * 0.35;
    }
    for (const w of this.ponds) w.material.emissiveIntensity = 0.4 + Math.sin(this.t * 1.5) * 0.12;
    this.goalRune.rotation.z += dt;
    this.goalPillar.material.opacity = 0.22 + Math.sin(this.t * 2) * 0.08;
    this.boss.facing = Math.atan2(p.pos.x - this.boss.pos.x, p.pos.z - this.boss.pos.z);
    // 反映
    for (const a of [p, ...this.followers, ...this.npcs, ...this.syms, this.boss]) {
      if (a.far) continue;
      a.mixer?.update(dt);
      if (a.gear) animGear(a.gear, dt, false, a.cur === 'run');
      a.root.position.copy(a.pos);
      a.root.rotation.y = a.facing;
    }
    this.updateRemotes(dt);
    p.root.visible = this.inv <= 0 || Math.floor(this.t * 12) % 2 === 0;
    // カメラ：後ろ上から追従
    if (camera) {
      const want = new THREE.Vector3(p.pos.x, 12, p.pos.z + 13);
      camera.position.lerp(want, 1 - Math.exp(-6 * dt));
      camera.lookAt(p.pos.x, 1, p.pos.z - 2);
    }
  }

  // ---- 他のプレイヤー（リアルタイム反映） ----
  nameTag(name, friend) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(10,10,28,0.7)';
    g.fillRect(8, 10, 240, 44);
    g.strokeStyle = friend ? '#70ff9a' : '#7fd3ff';
    g.lineWidth = 3;
    g.strokeRect(8, 10, 240, 44);
    g.font = 'bold 28px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = friend ? '#a8ffc0' : '#ffffff';
    g.fillText((friend ? '★ ' : '') + name, 128, 33);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(2.6, 0.65, 1);
    sp.renderOrder = 10;
    return sp;
  }
  // 自分の頭上にも旅人名
  // 装備の見た目を付け替える
  setGear(a, h, g) {
    removeGear(a.gear);
    a.gkey = `${g?.w}|${g?.a}`;
    // 骨格・体形に合わせてフィット（測るときは向き・位置を初期化した状態で）
    const rot = a.root.rotation.y;
    const pos = a.root.position.clone();
    a.root.rotation.y = 0;
    a.root.position.set(0, 0, 0);
    a.gear = g ? makeGear(h, g.w, g.a, a.model || null, a.root) : null;
    a.root.rotation.y = rot;
    a.root.position.copy(pos);
  }
  setOwnName(name) {
    const p = this.player;
    if (p.label === name) return;
    if (p.tag) {
      p.root.remove(p.tag);
      p.tag.material.map.dispose();
      p.tag.material.dispose();
    }
    p.tag = this.nameTag(name, false);
    p.tag.material.map.needsUpdate = true;
    p.tag.position.y = (FIGHTERS[this.o.mainKey]?.height || 1.75) + 0.55;
    p.root.add(p.tag);
    p.label = name;
  }
  setRemotes(list) {
    const seen = new Set();
    const me = this.player.pos;
    const near = list.slice().sort((u, v) => Math.hypot(u.x - me.x, u.z - me.z) - Math.hypot(v.x - me.x, v.z - me.z));
    for (const p of near.slice(0, 60)) {
      seen.add(p.id);
      let a = this.remotes.get(p.id);
      if (a && a.fk !== p.fk) {
        this.removeRemote(p.id);
        a = null;
      }
      if (!a) {
        const d = FIGHTERS[p.fk] || FIGHTERS[this.o.mainKey];
        const h = d?.height || 1.75;
        if (!this.o.assets[p.fk]) continue; // Never substitute a remote player with a capsule.
        a = makeActor(this.o.assets[p.fk], h, d?.color, d?.tint, this.own);
        a.fk = p.fk;
        a.h = h;
        a.pos = new THREE.Vector3(p.x, 0, p.z);
        a.facing = p.ry;
        this.group.add(a.root);
        this.remotes.set(p.id, a);
      }
      if (a.label !== p.name + p.friend) {
        if (a.tag) {
          a.root.remove(a.tag);
          a.tag.material.map.dispose();
          a.tag.material.dispose();
        }
        a.tag = this.nameTag(p.name, p.friend);
        a.tag.position.y = a.h + 0.55;
        a.root.add(a.tag);
        a.label = p.name + p.friend;
      }
      if (a.gkey !== `${p.gw}|${p.ga}`) this.setGear(a, a.h, { w: p.gw, a: p.ga });
      Object.assign(a, { id: p.id, name: p.name, friend: p.friend, tx: p.x, tz: p.z, tr: p.ry, mv: p.mv });
    }
    for (const id of [...this.remotes.keys()]) if (!seen.has(id)) this.removeRemote(id);
  }
  removeRemote(id) {
    const a = this.remotes.get(id);
    if (!a) return;
    a.mixer?.stopAllAction();
    this.group.remove(a.root);
    a.tag?.material.map.dispose();
    a.tag?.material.dispose();
    this.remotes.delete(id);
  }
  // 近くにいる旅人（近い順）
  nearbyRemotes(range = 30) {
    const p = this.player.pos;
    return [...this.remotes.values()]
      .map((a) => ({ id: a.id, name: a.name, fk: a.fk, friend: a.friend, d: Math.hypot(a.pos.x - p.x, a.pos.z - p.z) }))
      .filter((a) => a.d < range)
      .sort((u, v) => u.d - v.d);
  }
  updateRemotes(dt) {
    const p = this.player.pos;
    for (const a of this.remotes.values()) {
      const k = 1 - Math.exp(-10 * dt);
      if (Math.hypot(a.tx - a.pos.x, a.tz - a.pos.z) > 20) a.pos.set(a.tx, 0, a.tz);
      a.pos.x += (a.tx - a.pos.x) * k;
      a.pos.z += (a.tz - a.pos.z) * k;
      let df = a.tr - a.facing;
      df = Math.atan2(Math.sin(df), Math.cos(df));
      a.facing += df * k;
      a.far = Math.hypot(a.pos.x - p.x, a.pos.z - p.z) > 90;
      a.root.visible = !a.far;
      if (a.far) continue;
      a.play(a.mv ? 'run' : 'idle');
      a.mixer?.update(dt);
      if (a.gear) animGear(a.gear, dt, false, a.mv);
      a.root.position.copy(a.pos);
      a.root.rotation.y = a.facing;
    }
  }

  // 戦闘から戻る
  resume(sym, won) {
    if (sym && won) {
      this.syms = this.syms.filter((s) => s !== sym);
      this.group.remove(sym.root);
    }
    if (!won && sym) {
      this.player.pos.set(0, 0, 22);
      this.trail = [];
      for (const f of this.followers) f.pos.copy(this.player.pos);
    }
    this.inv = 2.5;
    this.frozen = false;
  }

  dispose() {
    for (const id of [...this.remotes.keys()]) this.removeRemote(id);
    this.player?.tag?.material.map.dispose();
    this.player?.tag?.material.dispose();
    this.scene.remove(this.group);
    for (const a of [this.player, ...this.followers, ...this.npcs, ...this.syms, this.boss]) a?.mixer?.stopAllAction();
    for (const x of this.own) x.dispose?.();
    this.own = [];
  }
}
