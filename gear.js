// 武器・防具の見た目（手続き生成）。キャラモデルの骨格と体形を測ってフィットさせる
import * as THREE from 'three';

const TIER_COL = [0x8a5a2b, 0x8f969e, 0xc3ccd8, 0xeef3fa, 0x8fe6ff, 0xe6d6b4, 0xcfe0ff, 0xffd970, 0xff8a3a, 0xc98aff];
const TIER_GLOW = [0, 0, 0, 0, 0x3fcfff, 0xff9030, 0x9ac0ff, 0xffe680, 0xff5a1a, 0xb050ff];
const CLOTH = [0x6b4a2e, 0x3a4a6a, 0x5a2a3a, 0x2a5a4a, 0x7a2a2a, 0x2a2a5a, 0x4a2a6a, 0xe8e0d0, 0x8a1a2a, 0x2a1040];

const MATS = new Map();
function mat(color, emissive = 0, ei = 0, opts = {}) {
  const k = `${color}|${emissive}|${ei}|${opts.side || 0}|${opts.rough ?? 0.35}|${opts.metal ?? 0.75}|${opts.op ?? 1}`;
  if (!MATS.has(k)) {
    MATS.set(k, new THREE.MeshStandardMaterial({
      color, metalness: opts.metal ?? 0.75, roughness: opts.rough ?? 0.35,
      emissive, emissiveIntensity: ei, side: opts.side || THREE.FrontSide,
      transparent: (opts.op ?? 1) < 1, opacity: opts.op ?? 1, depthWrite: (opts.op ?? 1) >= 1
    }));
  }
  return MATS.get(k);
}
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 10),
  bell: new THREE.CylinderGeometry(0.35, 1, 1, 14, 1, true),
  sph: new THREE.SphereGeometry(1, 14, 10),
  half: new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(1, 0.08, 8, 32),
  bow: new THREE.TorusGeometry(1, 0.05, 6, 24, Math.PI),
  fan: new THREE.CircleGeometry(1, 18, Math.PI * 0.15, Math.PI * 0.7),
  // 胴に沿う曲面（+Z が正面。CylinderGeometry は θ=0 が +Z）
  plate: new THREE.CylinderGeometry(1, 1, 1, 24, 1, true, -1.15, 2.3),
  plateFull: new THREE.CylinderGeometry(1, 0.92, 1, 28, 1, true),
  backPlate: new THREE.CylinderGeometry(1, 1, 1, 18, 1, true, Math.PI - 1.0, 2.0),
  skirt: new THREE.CylinderGeometry(1, 1.35, 1, 24, 1, true),
  cape: new THREE.CylinderGeometry(1, 1.25, 1, 16, 6, true, Math.PI - 0.95, 1.9).translate(0, -0.5, 0), // 原点＝肩の高さ
  ring: new THREE.RingGeometry(0.8, 1, 40)
};
function part(geo, m, sx, sy, sz, x = 0, y = 0, z = 0) {
  const p = new THREE.Mesh(geo, m);
  p.scale.set(sx, sy, sz);
  p.position.set(x, y, z);
  p.castShadow = true;
  return p;
}

// ---- 武器（type 0-9 × tier 0-9）。原点＝握り、+Y＝刃先 ----
function weaponMesh(type, tier) {
  const g = new THREE.Group();
  const metal = mat(TIER_COL[tier], TIER_GLOW[tier], tier >= 4 ? 0.2 + tier * 0.03 : 0);
  const glowM = mat(TIER_GLOW[tier] || TIER_COL[tier], TIER_GLOW[tier] || 0x88ccff, tier >= 4 ? 0.8 : 0.3, { metal: 0.2 });
  const grip = mat(0x3a2414, 0, 0, { metal: 0.1, rough: 0.8 });
  const L = 1 + tier * 0.035;
  switch (type) {
    case 0: // 剣
      g.add(part(G.cyl, grip, 0.025, 0.2, 0.025, 0, -0.02, 0));
      g.add(part(G.box, metal, 0.26, 0.05, 0.07, 0, 0.1, 0));
      g.add(part(G.box, metal, 0.07, 0.85 * L, 0.018, 0, 0.13 + 0.425 * L, 0));
      g.add(part(G.cone, metal, 0.05, 0.12, 0.012, 0, 0.19 + 0.85 * L, 0));
      if (tier >= 4) g.add(part(G.sph, glowM, 0.04, 0.04, 0.04, 0, 0.1, 0.04));
      break;
    case 1: // 杖（中ほどを握る）
      g.add(part(G.cyl, grip, 0.022, 1.5 * L, 0.022, 0, 0.25, 0));
      g.add(part(G.torus, metal, 0.11, 0.11, 0.11, 0, 0.25 + 0.75 * L, 0));
      g.add(part(G.sph, glowM, 0.08, 0.08, 0.08, 0, 0.25 + 0.75 * L, 0));
      break;
    case 2: // 大斧
      g.add(part(G.cyl, grip, 0.03, 1.15 * L, 0.03, 0, 0.3, 0));
      g.add(part(G.box, metal, 0.42 * L, 0.32 * L, 0.04, 0.16, 0.75 * L, 0));
      g.add(part(G.box, metal, 0.16, 0.12, 0.04, -0.09, 0.75 * L, 0));
      break;
    case 3: // 双刃（片手分）
      g.add(part(G.cyl, grip, 0.022, 0.16, 0.022, 0, 0, 0));
      g.add(part(G.box, metal, 0.05, 0.55 * L, 0.014, 0.02, 0.08 + 0.275 * L, 0));
      g.add(part(G.cone, metal, 0.035, 0.1, 0.01, 0.02, 0.13 + 0.55 * L, 0));
      break;
    case 4: // 槍（中ほどを握る）
      g.add(part(G.cyl, grip, 0.022, 1.9 * L, 0.022, 0, 0.45, 0));
      g.add(part(G.cone, metal, 0.06, 0.32, 0.06, 0, 0.55 + 0.95 * L, 0));
      g.add(part(G.torus, glowM, 0.05, 0.05, 0.05, 0, 0.37 + 0.95 * L, 0));
      break;
    case 5: { // 弓（握りが原点）
      const b = part(G.bow, metal, 0.55 * L, 0.55 * L, 0.55 * L, -0.55 * L, 0, 0);
      b.rotation.z = -Math.PI / 2;
      g.add(b);
      g.add(part(G.cyl, glowM, 0.004, 1.1 * L, 0.004, -0.55 * L, 0, 0));
      g.add(part(G.cyl, grip, 0.03, 0.18, 0.03, 0, 0, 0));
      break;
    }
    case 6: // 錬金瓶
      g.add(part(G.sph, mat(0xddeeff, 0, 0, { metal: 0.1, rough: 0.1 }), 0.11, 0.11, 0.11, 0, 0.06, 0));
      g.add(part(G.sph, glowM, 0.085, 0.085, 0.085, 0, 0.06, 0));
      g.add(part(G.cyl, metal, 0.035, 0.12, 0.035, 0, 0.21, 0));
      break;
    case 7: { // 拳甲（片手分：手を包む）
      g.add(part(G.box, metal, 0.12, 0.16, 0.13, 0, 0.02, 0));
      const sp = part(G.cone, glowM, 0.025, 0.07, 0.025, 0, 0.02, 0.09);
      sp.rotation.x = Math.PI / 2;
      g.add(sp);
      break;
    }
    case 8: // 聖鈴
      g.add(part(G.cyl, grip, 0.02, 0.45, 0.02, 0, 0.12, 0));
      g.add(part(G.bell, mat(TIER_COL[tier], TIER_GLOW[tier], 0.2, { side: THREE.DoubleSide }), 0.13, 0.2, 0.13, 0, 0.42, 0));
      g.add(part(G.sph, glowM, 0.04, 0.04, 0.04, 0, 0.33, 0));
      break;
    case 9: // 雅扇
      g.add(part(G.cyl, grip, 0.02, 0.14, 0.02, 0, 0, 0));
      g.add(part(G.fan, mat(CLOTH[tier], TIER_GLOW[tier], tier >= 4 ? 0.25 : 0, { side: THREE.DoubleSide, metal: 0.1, rough: 0.6 }), 0.45 * L, 0.45 * L, 1, 0, 0.05, 0));
      break;
  }
  return g;
}

// ---- 至宝：草薙の剣（黄金の神剣。ねじれた柄・十字の鍔・刻み模様の刃） ----
function relicSword() {
  const g = new THREE.Group();
  const gold = mat(0xffcc33, 0xffa500, 0.35, { metal: 1, rough: 0.22 });
  const goldD = mat(0xd9a520, 0xff9a00, 0.2, { metal: 1, rough: 0.3 });
  g.add(part(G.sph, gold, 0.05, 0.035, 0.05, 0, -0.17, 0)); // 柄頭
  for (let i = 0; i < 4; i++) g.add(part(G.sph, i % 2 ? goldD : gold, 0.032, 0.04, 0.032, 0, -0.12 + i * 0.05, 0)); // ねじれた柄
  g.add(part(G.box, gold, 0.24, 0.06, 0.075, 0, 0.1, 0)); // 鍔
  g.add(part(G.box, goldD, 0.06, 0.1, 0.09, 0.12, 0.1, 0));
  g.add(part(G.box, goldD, 0.06, 0.1, 0.09, -0.12, 0.1, 0));
  g.add(part(G.sph, gold, 0.045, 0.045, 0.045, 0, 0.1, 0.035));
  g.add(part(G.box, gold, 0.085, 0.95, 0.022, 0, 0.6, 0)); // 刃
  for (let i = 0; i < 7; i++) g.add(part(G.box, goldD, 0.06, 0.012, 0.026, 0, 0.22 + i * 0.12, 0)); // 刻み
  g.add(part(G.cone, gold, 0.06, 0.16, 0.014, 0, 1.15, 0));
  g.add(part(G.sph, mat(0xfff2a0, 0xffd040, 1.2, { metal: 0.2 }), 0.05, 0.5, 0.012, 0, 0.6, 0.012)); // 刃の輝き
  return g;
}
// ---- 至宝：草薙の盾（黄金の縁・紅玉の盾面・双巴の紋。左腕に装着） ----
function relicShield(M) {
  const { h, k } = M;
  const out = [];
  const gold = mat(0xffcc33, 0xffa500, 0.3, { metal: 1, rough: 0.25 });
  const red = mat(0xc8321e, 0x801000, 0.25, { metal: 0.4, rough: 0.4 });
  const gem = mat(0xff3a6a, 0xff2050, 0.9, { metal: 0.3, rough: 0.1 });
  const sh = new THREE.Group();
  const R = 0.3 * k;
  sh.add(part(G.cyl, gold, R * 1.08, 0.04 * k, R * 1.25, 0, 0, 0)); // 金の縁
  sh.add(part(G.cyl, red, R * 0.92, 0.05 * k, R * 1.08, 0, 0, 0)); // 紅の盾面
  sh.add(part(G.cone, gold, R * 0.18, 0.12 * k, R * 0.18, 0, 0.05 * k, 0)); // 中央の突起
  for (const s of [1, -1]) { // 双巴の紋
    const t = part(G.torus, gold, R * 0.38, R * 0.38, 0.6 * k, s * R * 0.32, 0.03 * k, 0);
    t.rotation.x = Math.PI / 2;
    sh.add(t);
  }
  for (let i = 0; i < 4; i++) { // 紅玉
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    sh.add(part(G.sph, gem, 0.035 * k, 0.03 * k, 0.035 * k, Math.cos(a) * R * 0.98, 0.04 * k, Math.sin(a) * R * 1.15));
  }
  sh.add(part(G.cone, gold, R * 0.3, R * 0.5, 0.02 * k, 0, 0.02 * k, R * 1.35)); // 下の尖り
  sh.children.forEach((c) => (c.castShadow = true));
  // 盾面を外向き（下の尖りは下）
  sh.rotation.set(Math.PI / 2, 0, 0);
  const holder = new THREE.Group();
  holder.add(sh);
  // 左手の甲（外側）に装着：手の位置から体の外側へ十分離し、腕を振っても胴に当たらないように
  const side = Math.sign(M.shL.x || 1);
  const hand = M.lh || new THREE.Vector3(M.shL.x * 1.25, M.hipY + 0.05 * h, 0.05 * k);
  const fore = M.lf || new THREE.Vector3(M.shL.x * 1.15, (M.shY + M.hipY) / 2, 0);
  // 前腕と手の間（手の甲寄り）を中心に、外側へ盾の半径分＋余白だけずらす
  const c = fore.clone().lerp(hand, 0.7);
  const C = M.chest;
  const minX = Math.abs(C.cx) + C.rx * 1.2 + R * 1.15; // 胴の外形＋盾の半径
  c.x = side * Math.max(Math.abs(c.x) + 0.1 * k, minX);
  c.z += 0.04 * k;
  holder.position.copy(c);
  holder.rotation.y = side * 1.15; // 面を外側やや前へ（体側に裏面）
  holder.userData.bone = M.lh ? 'lh' : 'lf'; // 手に追従
  void h;
  out.push(holder);
  // 神気の輪
  if (!MATS.has('relicRing')) MATS.set('relicRing', new THREE.MeshBasicMaterial({ color: 0xffd040, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  const ring = new THREE.Mesh(G.ring, MATS.get('relicRing'));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  ring.scale.setScalar(Math.max(M.chest.rx, 0.15 * k) * 3.4);
  ring.userData.spin = true;
  out.push(ring);
  return out;
}

// ---------- 体形と骨格の計測 ----------
function findBones(model) {
  const B = {};
  const chest = [];
  model.traverse((o) => {
    if (!o.isBone) return;
    const n = o.name.toLowerCase().replace(/^mixamorig[:_]?/, '').replace(/^(def|bip\d*|armature)[-_ .]?/, '');
    const side = /left|(^|[_.\s-])l($|[_.\s-])/.test(n) ? 'l' : /right|(^|[_.\s-])r($|[_.\s-])/.test(n) ? 'r' : '';
    if (/thumb|index|middle|ring|pinky|finger|end|top|twist|ik|pole|target/.test(n)) return;
    if (/hand|wrist/.test(n)) {
      if (side === 'r') B.rh ||= o;
      else if (side === 'l') B.lh ||= o;
    } else if (/forearm|lowerarm|elbow/.test(n)) {
      if (side === 'r') B.rf ||= o;
      else if (side === 'l') B.lf ||= o;
    } else if (/upperarm|(^|[^a-z])arm/.test(n)) {
      if (side === 'r') B.ra ||= o;
      else if (side === 'l') B.la ||= o;
    } else if (/shoulder|clavicle/.test(n)) {
      if (side === 'r') B.rs ||= o;
      else if (side === 'l') B.ls ||= o;
    } else if (/head/.test(n)) B.head ||= o;
    else if (/neck/.test(n)) B.neck ||= o;
    else if (/hips|pelvis|root/.test(n) && !side) B.hips ||= o;
    else if (/spine|chest/.test(n) && !side) chest.push(o);
  });
  const pick = (re) => chest.find((o) => re.test(o.name.toLowerCase()));
  B.chest = pick(/upperchest|spine2|spine_02|chest/) || pick(/spine1|spine_01/) || chest[chest.length - 1] || null;
  B.spine = pick(/spine$|spine_?0?$|spine\b/) || chest[0] || null;
  return B;
}

// 親(キャラ空間)から見た位置
const _v = new THREE.Vector3();
function localPos(o, inv) {
  return o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
}

// 胴の高さ帯ごとの幅・奥行きを頂点から測る（腕は除外）
const MEASURE = new WeakMap();
function measure(model, parent, h, B) {
  const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
  const geoKey = (() => {
    let g = null;
    model.traverse((o) => {
      if (!g && o.isMesh) g = o.geometry;
    });
    return g;
  })();
  const ck = geoKey && MEASURE.get(geoKey);
  const bonesKey = `${h.toFixed(3)}|${B.chest ? 1 : 0}`;
  if (ck && ck[bonesKey]) return ck[bonesKey];

  const k = h / 1.8;
  const M = { h, k };
  M.hipY = B.hips ? localPos(B.hips, inv).y : 0.5 * h;
  M.chestY = B.chest ? localPos(B.chest, inv).y : 0.7 * h;
  M.headY = B.head ? localPos(B.head, inv).y : 0.88 * h;
  M.neckY = B.neck ? localPos(B.neck, inv).y : (M.chestY + M.headY) / 2;
  const armR = B.ra || B.rs, armL = B.la || B.ls;
  M.shR = armR ? localPos(armR, inv) : new THREE.Vector3(-0.2 * k, 0.8 * h, 0);
  M.shL = armL ? localPos(armL, inv) : new THREE.Vector3(0.2 * k, 0.8 * h, 0);
  M.shY = (M.shR.y + M.shL.y) / 2;
  const armX = Math.max(0.12 * k, Math.min(Math.abs(M.shR.x), Math.abs(M.shL.x)) * 0.9);

  // 帯ごとの外形
  const bands = { chest: [M.chestY - 0.05 * h, M.shY - 0.02 * h], waist: [M.hipY + 0.02 * h, M.hipY + 0.09 * h], head: [M.headY, h * 1.05], hip: [M.hipY - 0.08 * h, M.hipY] };
  const ext = {};
  for (const b in bands) ext[b] = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, top: -Infinity, n: 0 };
  const m4 = new THREE.Matrix4();
  model.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    m4.multiplyMatrices(inv, o.matrixWorld);
    const step = Math.max(1, Math.floor(pos.count / 8000));
    for (let i = 0; i < pos.count; i += step) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m4);
      for (const b in bands) {
        const [y0, y1] = bands[b];
        if (_v.y < y0 || _v.y > y1) continue;
        const lim = b === 'head' ? 0.22 * k : armX; // 腕・手の頂点は胴の幅に入れない
        if (Math.abs(_v.x) > lim) continue;
        const e = ext[b];
        e.n++;
        if (_v.x < e.x0) e.x0 = _v.x;
        if (_v.x > e.x1) e.x1 = _v.x;
        if (_v.z < e.z0) e.z0 = _v.z;
        if (_v.z > e.z1) e.z1 = _v.z;
        if (_v.y > e.top) e.top = _v.y;
      }
    }
  });
  const fit = (e, w, d) => (e.n > 10 ? { cx: (e.x0 + e.x1) / 2, cz: (e.z0 + e.z1) / 2, rx: Math.max(0.05 * k, (e.x1 - e.x0) / 2), rz: Math.max(0.04 * k, (e.z1 - e.z0) / 2), top: e.top } : { cx: 0, cz: 0, rx: w * k, rz: d * k, top: h });
  M.chest = fit(ext.chest, 0.17, 0.11);
  M.waist = fit(ext.waist, 0.15, 0.1);
  M.hip = fit(ext.hip, 0.16, 0.11);
  M.head = fit(ext.head, 0.1, 0.1);
  if (geoKey) {
    const o = MEASURE.get(geoKey) || {};
    o[bonesKey] = M;
    MEASURE.set(geoKey, o);
  }
  return M;
}

// ---- 防具（type 0-9 × tier 0-9）を体形に合わせて作る。各部位は付ける骨の名前を持つ ----
const ARMOR_PARTS = [
  { chest: 0.85, belt: 1 }, // 軽鎧
  { chest: 1, full: 1, sh: 1.2, belt: 1 }, // 重鎧
  { skirt: 1, belt: 1 }, // 法衣
  { cape: 1, sh: 0.8 }, // 外套
  { chest: 1 }, // 胸当て
  { sh: 1.35 }, // 肩鎧
  { chest: 1, full: 1, sh: 1, spike: 1 }, // 竜鱗鎧
  { skirt: 1, halo: 1 }, // 聖衣
  { cape: 1, belt: 1 }, // 影装束
  { chest: 1, sh: 1.1, cape: 1, crown: 1 } // 王冠鎧
];
function armorParts(type, tier, M) {
  const P = ARMOR_PARTS[type];
  const { h, k } = M;
  const out = [];
  const metal = mat(TIER_COL[tier], TIER_GLOW[tier], tier >= 4 ? 0.15 + tier * 0.02 : 0);
  const metalD = mat(TIER_COL[tier], TIER_GLOW[tier], tier >= 4 ? 0.15 + tier * 0.02 : 0, { side: THREE.DoubleSide });
  const glowM = mat(TIER_GLOW[tier] || 0xffe08a, TIER_GLOW[tier] || 0xffe08a, 0.8, { metal: 0.2 });
  const cloth = mat(CLOTH[(type + tier) % 10], 0, 0, { side: THREE.DoubleSide, metal: 0, rough: 0.85 });
  const add = (mesh, bone) => {
    mesh.userData.bone = bone;
    out.push(mesh);
    return mesh;
  };
  const pad = 1.1; // 体表から少し浮かせて食い込みを防ぐ
  const C = M.chest;
  if (P.chest) {
    const top = M.shY - 0.01 * h;
    const bot = Math.max(M.hipY + 0.06 * h, M.chestY - (M.shY - M.chestY) * 1.6);
    const hh = Math.max(0.1 * h, top - bot);
    add(part(P.full ? G.plateFull : G.plate, metalD, C.rx * pad, hh * P.chest, C.rz * pad * 1.05, C.cx, (top + bot) / 2, C.cz), 'chest');
    if (P.full) add(part(G.backPlate, metalD, C.rx * pad * 1.02, hh * 0.9, C.rz * pad * 1.1, C.cx, (top + bot) / 2, C.cz), 'chest');
    if (tier >= 4) add(part(G.sph, glowM, 0.035 * k, 0.035 * k, 0.02 * k, C.cx, (top + bot) / 2 + hh * 0.15, C.cz + C.rz * pad * 1.05), 'chest');
  }
  if (P.sh) {
    for (const [s, p] of [['r', M.shR], ['l', M.shL]]) {
      const r = Math.max(0.07 * k, Math.min(0.14 * k, C.rz * 0.95)) * P.sh;
      const sp = add(part(G.half, metal, r, r * 0.7, r * 1.05, p.x, p.y + r * 0.15, p.z), s === 'r' ? 'ra' : 'la');
      sp.rotation.z = (s === 'r' ? 1 : -1) * 0.45;
      if (P.spike) {
        const sk = add(part(G.cone, metal, 0.025 * k, 0.12 * k, 0.025 * k, p.x * 1.15, p.y + r * 0.6, p.z), s === 'r' ? 'ra' : 'la');
        sk.rotation.z = (s === 'r' ? 1 : -1) * 0.6;
      }
    }
  }
  const W = M.waist;
  if (P.belt) {
    const b = add(part(G.torus, metal, W.rx * pad, W.rz * pad, 0.45 * k, W.cx, M.hipY + 0.05 * h, W.cz), 'hips');
    b.rotation.x = Math.PI / 2;
    b.scale.set(W.rx * pad, W.rz * pad, 0.5);
  }
  if (P.skirt) {
    const Hh = M.hip;
    const len = Math.max(0.15 * h, (M.hipY + 0.05 * h) * 0.55);
    add(part(G.skirt, cloth, Math.max(W.rx, Hh.rx) * pad, len, Math.max(W.rz, Hh.rz) * pad, W.cx, M.hipY + 0.05 * h - len / 2, W.cz), 'hips');
  }
  if (P.cape) {
    const top = M.shY;
    const len = top * 0.82;
    const c = add(part(G.cape, cloth, C.rx * 1.12, len, C.rz * 1.35, C.cx, top, C.cz), 'chest');
    c.userData.cape = true;
  }
  const Hd = M.head;
  if (P.halo) {
    const r = add(part(G.torus, glowM, Hd.rx * 1.2, Hd.rz * 1.2, Hd.rx * 1.2, Hd.cx, Hd.top + 0.08 * k, Hd.cz), 'head');
    r.rotation.x = Math.PI / 2;
  }
  if (P.crown) {
    const r = add(part(G.torus, mat(0xffd970, 0xffaa30, 0.25), Hd.rx * 0.95, Hd.rz * 0.95, 0.9, Hd.cx, Hd.top - 0.035 * k, Hd.cz), 'head');
    r.rotation.x = Math.PI / 2;
    r.scale.set(Hd.rx * 0.95, Hd.rz * 0.95, 0.9);
  }
  if (tier >= 7) {
    const key = `ring${tier}`;
    if (!MATS.has(key)) MATS.set(key, new THREE.MeshBasicMaterial({ color: TIER_GLOW[tier], transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    const ring = add(new THREE.Mesh(G.ring, MATS.get(key)), null);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.scale.setScalar(Math.max(C.rx, 0.15 * k) * 3.2);
    ring.userData.spin = true;
  }
  return out;
}

const idx = (id, p) => (typeof id === 'string' && id[0] === p ? +id.slice(1) : -1);
const Q_FWD = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 - 0.35, 0, 0)); // 刃先を正面やや上へ

/**
 * キャラ（高さh）に装備を付ける。model と parent を渡すと骨格・体形に合わせてフィットする。
 * 戻り値の group は parent に追加済み。外すときは removeGear(group)。
 */
export function makeGear(h, wid, aid, model = null, parent = null) {
  const wi = idx(wid, 'w');
  const ai = idx(aid, 'a');
  const hasW = wi >= 0 && wi <= 100, hasA = ai >= 0 && ai <= 100;
  if (!hasW && !hasA) return null;
  const k = h / 1.8;
  const root = new THREE.Group();
  root.userData = { t: 0, parts: [], hands: [] };
  if (parent) parent.add(root);
  parent?.updateMatrixWorld(true);
  const B = model ? findBones(model) : {};
  // 骨はバインド姿勢で計測（アニメの途中で付けても位置がずれないように）
  const restore = model && parent ? bindPose(model) : null;
  parent?.updateMatrixWorld(true);
  const M = model && parent ? measure(model, parent, h, B) : {
    h, k, hipY: 0.5 * h, chestY: 0.7 * h, headY: 0.88 * h, shY: 0.8 * h,
    shR: new THREE.Vector3(-0.2 * k, 0.8 * h, 0), shL: new THREE.Vector3(0.2 * k, 0.8 * h, 0),
    chest: { cx: 0, cz: 0, rx: 0.17 * k, rz: 0.11 * k }, waist: { cx: 0, cz: 0, rx: 0.15 * k, rz: 0.1 * k },
    hip: { cx: 0, cz: 0, rx: 0.16 * k, rz: 0.11 * k }, head: { cx: 0, cz: 0, rx: 0.1 * k, rz: 0.1 * k, top: h }
  };
  const inv = parent ? new THREE.Matrix4().copy(parent.matrixWorld).invert() : null;

  const pieces = [];
  M.lh = B.lh && inv ? localPos(B.lh, inv) : null; // 盾用：左手の位置（バインド姿勢）
  M.lf = B.lf && inv ? localPos(B.lf, inv) : null;
  if (hasA) pieces.push(...(ai === 100 ? relicShield(M) : armorParts(ai % 10, Math.floor(ai / 10), M)));

  if (hasW) {
    const relic = wi === 100;
    const type = relic ? 0 : wi % 10, tier = relic ? 7 : Math.floor(wi / 10);
    const mkHand = (side) => {
      const bone = side === 'r' ? B.rh : B.lh;
      const holder = new THREE.Group();
      if (bone && inv) {
        // 手の骨の向き（指の方向・親指の方向）から握りの姿勢を決める
        const hp = localPos(bone, inv);
        const fore = side === 'r' ? B.rf : B.lf;
        const kids = bone.children.filter((c) => c.isBone);
        const fing = new THREE.Vector3();
        let thumb = null;
        for (const c of kids) {
          const cp = localPos(c, inv).sub(hp);
          if (/thumb/i.test(c.name)) thumb = cp;
          else fing.add(cp);
        }
        if (fing.lengthSq() < 1e-8) fing.copy(fore ? hp.clone().sub(localPos(fore, inv)) : new THREE.Vector3(side === 'r' ? -1 : 1, 0, 0));
        fing.normalize();
        // 刃先方向＝親指側（無ければ正面やや上）。指方向と直交させる
        const blade = thumb ? thumb.clone() : new THREE.Vector3(0, 0.35, 1);
        blade.addScaledVector(fing, -blade.dot(fing));
        if (blade.lengthSq() < 1e-6) blade.set(0, 0, 1).addScaledVector(fing, -fing.z);
        blade.normalize();
        const zAx = new THREE.Vector3().crossVectors(fing, blade).normalize();
        holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fing, blade, zAx));
        // 掌の中心（指の付け根の少し手前）で握る
        const palmLen = kids.length ? Math.min(0.09 * k, Math.max(0.03 * k, localPos(kids[0], inv).distanceTo(hp) * 0.8)) : 0.06 * k;
        holder.position.copy(hp).addScaledVector(fing, palmLen);
      } else {
        holder.position.set((side === 'r' ? -1 : 1) * Math.max(0.24 * k, Math.abs(M.shR.x) + 0.06 * k), 0.5 * h, 0.1 * k);
        if (type === 5) holder.rotation.set(0, side === 'r' ? -Math.PI / 2 : Math.PI / 2, 0);
        else if (type !== 6 && type !== 7) holder.quaternion.copy(Q_FWD);
      }
      const swing = new THREE.Group();
      const w = relic ? relicSword() : weaponMesh(type, tier);
      w.scale.setScalar(k);
      swing.add(w);
      holder.add(swing);
      holder.userData.bone = side === 'r' ? 'rh' : 'lh';
      root.userData.hands.push({ swing, base: 0, swingOn: type !== 5 && type !== 7 });
      pieces.push(holder);
    };
    mkHand(type === 5 ? 'l' : 'r');
    if (type === 3 || type === 7) mkHand('l');
  }

  // まずキャラ空間に置き、骨があれば見た目の位置を保ったまま骨へ付け替える（アニメに追従）
  for (const p of pieces) {
    root.add(p);
    root.userData.parts.push(p);
  }
  if (parent) {
    root.updateMatrixWorld(true);
    for (const p of pieces) {
      const bn = p.userData.bone;
      const bone = bn && (B[bn] || (bn === 'ra' ? B.rs : bn === 'la' ? B.ls : bn === 'chest' ? B.spine : null));
      if (bone) bone.attach(p);
    }
  }
  for (const p of pieces) p.userData.q0 = p.quaternion.clone();
  if (restore) restore();
  return root;
}

// バインド姿勢に一時的に戻す。戻り値の関数で元の姿勢を復元
function bindPose(model) {
  let sm = null;
  model.traverse((o) => {
    if (!sm && o.isSkinnedMesh && o.skeleton) sm = o;
  });
  if (!sm) return null;
  model.updateMatrixWorld(true);
  const base = new THREE.Matrix4().multiplyMatrices(sm.matrixWorld, sm.bindMatrixInverse);
  const target = new Map();
  sm.skeleton.bones.forEach((b, i) => {
    const inv = sm.skeleton.boneInverses[i];
    if (inv) target.set(b, new THREE.Matrix4().copy(inv).invert().premultiply(base));
  });
  const saved = [];
  const pinv = new THREE.Matrix4();
  model.traverse((o) => {
    if (!o.isBone) return;
    saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]);
    const t = target.get(o);
    if (t && o.parent) {
      pinv.copy(o.parent.matrixWorld).invert();
      new THREE.Matrix4().multiplyMatrices(pinv, t).decompose(o.position, o.quaternion, o.scale);
    }
    o.updateMatrix();
    o.matrixWorld.multiplyMatrices(o.parent ? o.parent.matrixWorld : new THREE.Matrix4(), o.matrix);
  });
  model.updateMatrixWorld(true);
  return () => {
    for (const [o, p, q, s] of saved) {
      o.position.copy(p);
      o.quaternion.copy(q);
      o.scale.copy(s);
    }
    model.updateMatrixWorld(true);
  };
}

/** 装備を外す（骨に付け替えた部位もまとめて外す） */
export function removeGear(g) {
  if (!g) return;
  for (const p of g.userData.parts || []) p.parent?.remove(p);
  g.parent?.remove(g);
}

const _q = new THREE.Quaternion();
const _ax = new THREE.Vector3(1, 0, 0);
/** 毎フレーム：攻撃中は武器を振り、マントや光の紋を揺らす */
export function animGear(g, dt, attacking, moving) {
  if (!g) return;
  const u = g.userData;
  u.t += dt;
  u.sw = Math.max(0, (u.sw || 0) - dt * 3.2);
  if (attacking && u.sw <= 0) u.sw = 1;
  // 武器は手に固定（手の骨のアニメだけで動かす。独自の揺れは付けない）
  for (const hnd of u.hands) hnd.swing.rotation.set(0, 0, 0);
  for (const c of u.parts) {
    if (c.userData.cape && c.userData.q0) {
      // 肩を支点に後ろへなびく（付け替え後の向きを基準に、キャラ空間の X 軸まわり）
      _q.setFromAxisAngle(_ax, ((moving ? 0.35 : 0.05) + Math.sin(u.t * (moving ? 9 : 2)) * 0.04));
      c.quaternion.copy(c.userData.q0).multiply(_q);
    }
    else if (c.userData.spin) c.rotation.z += dt * 0.8;
  }
}
