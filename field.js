// ストーリーモードのフィールド：町 → 野 → ダンジョン（迷宮）を歩いて目的地へ。
// 魔物は姿が見える「シンボルエンカウント」。触れると戦闘、目的地の祭壇で章の決戦。
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { FIGHTERS } from './data.js';

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

export const BOUNDS = { minX: -62, maxX: 62, minZ: -238, maxZ: 36 };
const TOWN = { x: 0, z: 10, r: 15 };
const DUN = { x0: -40, z0: -176, cols: 8, rows: 6, cell: 10 };
const SYL = ['アル', 'ベル', 'セラ', 'ミナ', 'ロウ', 'カナ', 'ティ', 'ノル', 'エス', 'リム', 'ヴァ', 'ソラ', 'クオ', 'ハル', 'ネイ', 'ユラ'];

// ---- モデル（GLB）を指定の高さで置く小さな役者 ----
function makeActor(gltf, height, color, tint, own) {
  const root = new THREE.Group();
  const a = { root, mixer: null, clips: {}, cur: null, act: null };
  if (gltf) {
    const m = SkeletonUtils.clone(gltf.scene);
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const s = height / Math.max(size.y, 0.001);
    m.scale.setScalar(s);
    m.position.y = -box.min.y * s;
    const tc = tint != null ? new THREE.Color(tint) : null;
    m.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        if (tc && c.material) {
          c.material = c.material.clone();
          c.material.color?.lerp(tc, 0.6);
          own.push(c.material);
        }
      }
    });
    root.add(m);
    a.mixer = new THREE.AnimationMixer(m);
    for (const clip of gltf.animations) {
      const n = clip.name.toLowerCase();
      for (const k of ['idle', 'walk', 'run']) if (n.includes(k) && !a.clips[k]) a.clips[k] = clip;
    }
  } else {
    const geo = new THREE.CapsuleGeometry(0.35, height - 0.7, 6, 12);
    const mat = new THREE.MeshStandardMaterial({ color: tint ?? color ?? 0xcccccc });
    own.push(geo, mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    root.add(mesh);
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
    this.chests = [];
    this.frozen = false;
    this.inv = 0;
    this.prompt = '';
    this.region = '';
    this.t = 0;
    const r = (this.r = rng(o.chapter * 7717 + 99));
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    this.townName = pick(SYL) + pick(SYL) + pick(['の町', '村', 'の宿場', 'の里', '港']);
    this.fieldName = pick(SYL) + pick(SYL) + pick(['の野', '平原', 'の森', '街道', '高原']);
    this.dunName = pick(SYL) + pick(SYL) + pick(['遺跡', '神殿', '地下迷宮', '古城', '大祠']);
    this.st = o.stage;
    this.buildGround();
    this.buildRoad();
    this.buildTown();
    this.buildDungeon();
    this.buildWilds();
    this.buildActors();
    this.buildMapImage();
  }

  geo(g) { this.own.push(g); return g; }
  mat(m) { this.own.push(m); return m; }
  std(color, extra = {}) { return this.mat(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra })); }
  addBox(x, z, w, d) { this.boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); }

  buildGround() {
    const st = this.st;
    const w = BOUNDS.maxX - BOUNDS.minX + 40, d = BOUNDS.maxZ - BOUNDS.minZ + 40;
    const tex = this.o.floorTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(w / 8, d / 8);
    this.own.push(tex);
    const g = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, d)), this.std(new THREE.Color(st.floor).lerp(new THREE.Color(0x4a7a3a), 0.35), { map: tex }));
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, 0, (BOUNDS.maxZ + BOUNDS.minZ) / 2);
    g.receiveShadow = true;
    this.group.add(g);
  }

  buildRoad() {
    const r = this.r;
    const ex = DUN.x0 + this.entranceCol() * DUN.cell + DUN.cell / 2;
    const pts = [[0, 30], [0, -6]];
    for (let i = 1; i <= 10; i++) pts.push([(r() - 0.5) * 50 * (i < 10 ? 1 : 0.3), -6 - i * 15.6]);
    pts.push([ex, -168], [ex, -177]);
    this.road = pts;
    const mat = this.std(new THREE.Color(this.st.floor).lerp(new THREE.Color(0xc8b48a), 0.55));
    const geo = this.geo(new THREE.PlaneGeometry(1, 1));
    const disc = this.geo(new THREE.CircleGeometry(2.6, 16));
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const m = new THREE.Mesh(geo, mat);
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
  }
  roadDist(x, z) {
    let best = 1e9;
    const p = this.road;
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i], [bx, bz] = p[i + 1];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    return best;
  }

  // ---- 町：広場・噴水・家々・街灯・門 ----
  buildTown() {
    const r = this.r, st = this.st;
    const plaza = new THREE.Mesh(this.geo(new THREE.CircleGeometry(TOWN.r, 40)), this.std(0xb8ad98));
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
    const roofCols = [0xa04030, 0x3a5a90, 0x507040, 0x806030, 0x6a3a70, 0x904a20];
    const wallCols = [0xe8dcc0, 0xd8c8a8, 0xc8b898, 0xf0e8d8];
    const spots = [[-22, 0], [-22, 16], [22, 0], [22, 16], [-12, 30], [12, 30], [-26, -10], [26, -10], [-30, 26], [30, 26]];
    this.houses = [];
    for (const [hx, hz] of spots) {
      const w = 6 + r() * 2.5, d = 5 + r() * 2, h = 3.2 + r() * 1.6;
      const face = Math.abs(hx) > Math.abs(hz - TOWN.z) ? (hx > 0 ? -Math.PI / 2 : Math.PI / 2) : (hz > TOWN.z ? Math.PI : 0);
      const g = new THREE.Group();
      const body = new THREE.Mesh(this.geo(new THREE.BoxGeometry(w, h, d)), this.std(wallCols[Math.floor(r() * wallCols.length)]));
      body.position.y = h / 2;
      const roof = new THREE.Mesh(this.geo(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.6, 4)), this.std(roofCols[Math.floor(r() * roofCols.length)]));
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

  // ---- ダンジョン：外壁と迷路、最奥に祭壇 ----
  entranceCol() { return 3 + (this.o.chapter % 2); }
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
    const floor = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(cols * cell, rows * cell)), this.std(new THREE.Color(this.st.pillar).multiplyScalar(0.55)));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(x0 + (cols * cell) / 2, 0.04, z0 - (rows * cell) / 2);
    floor.receiveShadow = true;
    this.group.add(floor);
    // 壁（インスタンス描画）
    const walls = [];
    for (let rr = 0; rr <= rows; rr++) for (let c = 0; c < cols; c++) if (H[rr][c]) walls.push([x0 + c * cell + cell / 2, z0 - rr * cell, cell + 0.8, 0.8, rr === 0 || rr === rows]);
    for (let rr = 0; rr < rows; rr++) for (let c = 0; c <= cols; c++) if (V[rr][c]) walls.push([x0 + c * cell, z0 - rr * cell - cell / 2, 0.8, cell + 0.8, c === 0 || c === cols]);
    const wm = new THREE.InstancedMesh(this.geo(new THREE.BoxGeometry(1, 1, 1)), this.std(this.st.pillar), walls.length);
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
    // 迷路内の松明
    for (let i = 0; i < 10; i++) {
      const w = walls[Math.floor(r() * walls.length)];
      const f = new THREE.Mesh(flameGeo, flame);
      f.position.set(w[0], (w[4] ? 4 : 2.4) + 0.4, w[1]);
      this.flames.push(f);
      this.group.add(f);
    }
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
  }

  // ---- 野：木・岩・草・水晶・廃墟の柱・宝箱 ----
  buildWilds() {
    const r = this.r, st = this.st;
    const inDun = (x, z) => z < DUN.z0 + 4 && x > DUN.x0 - 4 && x < DUN.x0 + DUN.cols * DUN.cell + 4;
    const inTown = (x, z) => Math.hypot(x - TOWN.x, z - TOWN.z) < 38;
    const free = (x, z, roadGap) => !inDun(x, z) && !inTown(x, z) && this.roadDist(x, z) > roadGap;
    const rnd = () => [BOUNDS.minX + r() * (BOUNDS.maxX - BOUNDS.minX), BOUNDS.minZ + r() * (BOUNDS.maxZ - BOUNDS.minZ)];
    // 木
    const trees = [];
    for (let i = 0; i < 2200 && trees.length < 340; i++) {
      const [x, z] = rnd();
      const edge = Math.min(x - BOUNDS.minX, BOUNDS.maxX - x) < 8;
      if (!free(x, z, 4.5) || (!edge && r() < 0.35)) continue;
      trees.push([x, z, 0.8 + r() * 0.7]);
    }
    const leaf = new THREE.Color(0x2f6a3a).lerp(new THREE.Color(st.crystal), 0.18);
    const trunkM = new THREE.InstancedMesh(this.geo(new THREE.CylinderGeometry(0.22, 0.32, 1.8, 6)), this.std(0x5a3e28), trees.length);
    const leafA = new THREE.InstancedMesh(this.geo(new THREE.ConeGeometry(1.6, 2.8, 7)), this.std(leaf), trees.length);
    const leafB = new THREE.InstancedMesh(this.geo(new THREE.ConeGeometry(1.1, 2.2, 7)), this.std(leaf.clone().multiplyScalar(1.25)), trees.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    trees.forEach(([x, z, k], i) => {
      trunkM.setMatrixAt(i, m.compose(p.set(x, 0.9 * k, z), q, s.set(k, k, k)));
      leafA.setMatrixAt(i, m.compose(p.set(x, 2.8 * k, z), q, s.set(k, k, k)));
      leafB.setMatrixAt(i, m.compose(p.set(x, 4.1 * k, z), q, s.set(k, k, k)));
      this.circles.push({ x, z, r: 0.55 * k });
    });
    for (const im of [trunkM, leafA, leafB]) {
      im.castShadow = true;
      this.group.add(im);
    }
    this.treePts = trees;
    // 岩
    const rocks = [];
    for (let i = 0; i < 800 && rocks.length < 90; i++) {
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
    const grass = new THREE.InstancedMesh(this.geo(new THREE.ConeGeometry(0.18, 0.6, 4)), this.std(leaf.clone().multiplyScalar(1.5)), 600);
    for (let i = 0; i < 600; i++) {
      const [x, z] = rnd();
      grass.setMatrixAt(i, m.compose(p.set(x, 0.3, z), q, s.set(1, 0.6 + r(), 1)));
    }
    this.group.add(grass);
    // 水晶と廃墟の柱
    const cMat = this.mat(new THREE.MeshStandardMaterial({ color: st.crystal, emissive: st.crystal, emissiveIntensity: 1, roughness: 0.2 }));
    const cGeo = this.geo(new THREE.OctahedronGeometry(0.7).scale(0.6, 1.6, 0.6));
    const pMat = this.std(st.pillar);
    const pGeo = this.geo(new THREE.CylinderGeometry(0.6, 0.75, 1, 8));
    for (let i = 0, made = 0; i < 400 && made < 34; i++) {
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
    for (let i = 0; i < 300 && spotsC.length < 4; i++) {
      const [x, z] = rnd();
      if (free(x, z, 3) && z < -20 && z > -165 && Math.abs(x) < 52) spotsC.push([x, z]);
    }
    for (let i = 0; i < 3; i++) {
      const c = Math.floor(r() * DUN.cols), rr = 1 + Math.floor(r() * (DUN.rows - 1));
      spotsC.push([DUN.x0 + c * DUN.cell + DUN.cell / 2 + 2, DUN.z0 - rr * DUN.cell - DUN.cell / 2 + 2]);
    }
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
    this.player.pos = new THREE.Vector3(0, 0, 24);
    this.player.facing = Math.PI;
    this.group.add(this.player.root);
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
    const nField = 8 + Math.floor(o.chapter / 12);
    const spotsE = [];
    for (let i = 0; i < 600 && spotsE.length < nField; i++) {
      const z = -24 - r() * 140, x = (r() - 0.5) * 100;
      if (this.roadDist(x, z) < 18) spotsE.push([x, z]);
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
    const W = 104, Hh = 228;
    this.mapW = W;
    this.mapH = Hh;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = Hh;
    const g = c.getContext('2d');
    const sx = W / (BOUNDS.maxX - BOUNDS.minX), sz = Hh / (BOUNDS.maxZ - BOUNDS.minZ);
    this.toMap = (x, z) => [(x - BOUNDS.minX) * sx, (BOUNDS.maxZ - z) * sz];
    g.fillStyle = 'rgba(30,50,30,0.85)';
    g.fillRect(0, 0, W, Hh);
    g.fillStyle = 'rgba(20,70,30,0.9)';
    for (const [x, z] of this.treePts) {
      const [a, b] = this.toMap(x, z);
      g.fillRect(a - 0.8, b - 0.8, 1.6, 1.6);
    }
    g.strokeStyle = '#d8c090';
    g.lineWidth = 2.2;
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
      g.fillRect(a - 1.5, b - 1.5, 3, 3);
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
    const [gx, gz] = this.toMap(this.goal.x, this.goal.z);
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
    this.goalRune.rotation.z += dt;
    this.goalPillar.material.opacity = 0.22 + Math.sin(this.t * 2) * 0.08;
    this.boss.facing = Math.atan2(p.pos.x - this.boss.pos.x, p.pos.z - this.boss.pos.z);
    // 反映
    for (const a of [p, ...this.followers, ...this.npcs, ...this.syms, this.boss]) {
      a.mixer?.update(dt);
      a.root.position.copy(a.pos);
      a.root.rotation.y = a.facing;
    }
    p.root.visible = this.inv <= 0 || Math.floor(this.t * 12) % 2 === 0;
    // カメラ：後ろ上から追従
    if (camera) {
      const want = new THREE.Vector3(p.pos.x, 12, p.pos.z + 13);
      camera.position.lerp(want, 1 - Math.exp(-6 * dt));
      camera.lookAt(p.pos.x, 1, p.pos.z - 2);
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
    this.scene.remove(this.group);
    for (const a of [this.player, ...this.followers, ...this.npcs, ...this.syms, this.boss]) a?.mixer?.stopAllAction();
    for (const x of this.own) x.dispose?.();
    this.own = [];
  }
}
