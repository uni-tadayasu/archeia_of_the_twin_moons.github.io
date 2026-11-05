// 武器・防具の見た目（手続き生成）。戦闘とワールドの両方でキャラに装着する
import * as THREE from 'three';

const TIER_COL = [0x8a5a2b, 0x8f969e, 0xc3ccd8, 0xeef3fa, 0x8fe6ff, 0xe6d6b4, 0xcfe0ff, 0xffd970, 0xff8a3a, 0xc98aff];
const TIER_GLOW = [0, 0, 0, 0, 0x3fcfff, 0xff9030, 0x9ac0ff, 0xffe680, 0xff5a1a, 0xb050ff];
const CLOTH = [0x6b4a2e, 0x3a4a6a, 0x5a2a3a, 0x2a5a4a, 0x7a2a2a, 0x2a2a5a, 0x4a2a6a, 0xe8e0d0, 0x8a1a2a, 0x2a1040];

const MATS = new Map();
function mat(color, emissive = 0, ei = 0, opts = {}) {
  const k = `${color}|${emissive}|${ei}|${opts.side || 0}|${opts.rough ?? 0.35}`;
  if (!MATS.has(k)) {
    MATS.set(k, new THREE.MeshStandardMaterial({
      color, metalness: opts.metal ?? 0.75, roughness: opts.rough ?? 0.35,
      emissive, emissiveIntensity: ei, side: opts.side || THREE.FrontSide
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
  half: new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
  torus: new THREE.TorusGeometry(1, 0.08, 8, 28),
  bow: new THREE.TorusGeometry(1, 0.05, 6, 24, Math.PI),
  fan: new THREE.CircleGeometry(1, 18, Math.PI * 0.15, Math.PI * 0.7),
  plane: new THREE.PlaneGeometry(1, 1, 1, 4),
  skirt: new THREE.CylinderGeometry(0.66, 1, 1, 14, 1, true),
  ring: new THREE.RingGeometry(0.8, 1, 40)
};
function part(geo, m, sx, sy, sz, x = 0, y = 0, z = 0) {
  const p = new THREE.Mesh(geo, m);
  p.scale.set(sx, sy, sz);
  p.position.set(x, y, z);
  p.castShadow = true;
  return p;
}

// ---- 武器（type 0-9 × tier 0-9）----
function weaponMesh(type, tier) {
  const g = new THREE.Group();
  const metal = mat(TIER_COL[tier], TIER_GLOW[tier], tier >= 4 ? 0.35 + tier * 0.06 : 0);
  const glowM = mat(TIER_GLOW[tier] || TIER_COL[tier], TIER_GLOW[tier] || 0x88ccff, tier >= 4 ? 1.4 : 0.5, { metal: 0.2 });
  const grip = mat(0x3a2414, 0, 0, { metal: 0.1, rough: 0.8 });
  const L = 1 + tier * 0.035;
  switch (type) {
    case 0: // 剣
      g.add(part(G.cyl, grip, 0.025, 0.2, 0.025, 0, -0.05, 0));
      g.add(part(G.box, metal, 0.26, 0.05, 0.07, 0, 0.07, 0));
      g.add(part(G.box, metal, 0.07, 0.85 * L, 0.018, 0, 0.1 + 0.425 * L, 0));
      g.add(part(G.cone, metal, 0.05, 0.12, 0.012, 0, 0.16 + 0.85 * L, 0));
      if (tier >= 4) g.add(part(G.sph, glowM, 0.04, 0.04, 0.04, 0, 0.07, 0.04));
      break;
    case 1: // 杖
      g.add(part(G.cyl, grip, 0.022, 1.5 * L, 0.022, 0, 0.3, 0));
      g.add(part(G.torus, metal, 0.11, 0.11, 0.11, 0, 0.3 + 0.75 * L, 0));
      g.add(part(G.sph, glowM, 0.08, 0.08, 0.08, 0, 0.3 + 0.75 * L, 0));
      break;
    case 2: // 大斧
      g.add(part(G.cyl, grip, 0.03, 1.15 * L, 0.03, 0, 0.35, 0));
      g.add(part(G.box, metal, 0.42 * L, 0.32 * L, 0.04, 0.16, 0.78 * L, 0));
      g.add(part(G.box, metal, 0.16, 0.12, 0.04, -0.09, 0.78 * L, 0));
      break;
    case 3: // 双刃（片手分。左手にもう一本付ける）
      g.add(part(G.cyl, grip, 0.022, 0.16, 0.022, 0, -0.03, 0));
      g.add(part(G.box, metal, 0.05, 0.55 * L, 0.014, 0.02, 0.32 * L, 0));
      g.add(part(G.cone, metal, 0.035, 0.1, 0.01, 0.02, 0.36 + 0.55 * L, 0));
      break;
    case 4: // 槍
      g.add(part(G.cyl, grip, 0.022, 1.9 * L, 0.022, 0, 0.5, 0));
      g.add(part(G.cone, metal, 0.06, 0.32, 0.06, 0, 0.6 + 0.95 * L, 0));
      g.add(part(G.torus, glowM, 0.05, 0.05, 0.05, 0, 0.42 + 0.95 * L, 0));
      break;
    case 5: { // 弓
      const b = part(G.bow, metal, 0.55 * L, 0.55 * L, 0.55 * L, 0, 0.1, 0);
      b.rotation.z = -Math.PI / 2;
      g.add(b);
      g.add(part(G.cyl, glowM, 0.004, 1.1 * L, 0.004, 0, 0.1, 0));
      g.add(part(G.cyl, grip, 0.03, 0.18, 0.03, -0.55 * L, 0.1, 0));
      break;
    }
    case 6: // 錬金瓶
      g.add(part(G.sph, mat(0xddeeff, 0, 0, { metal: 0.1, rough: 0.1 }), 0.11, 0.11, 0.11, 0, 0.12, 0));
      g.add(part(G.sph, glowM, 0.085, 0.085, 0.085, 0, 0.12, 0));
      g.add(part(G.cyl, metal, 0.035, 0.12, 0.035, 0, 0.27, 0));
      break;
    case 7: // 拳甲（片手分）
      g.add(part(G.box, metal, 0.13, 0.2, 0.14, 0, 0.02, 0));
      g.add(part(G.cone, glowM, 0.03, 0.08, 0.03, 0, 0.02, 0.1));
      g.children[1].rotation.x = Math.PI / 2;
      break;
    case 8: // 聖鈴
      g.add(part(G.cyl, grip, 0.02, 0.45, 0.02, 0, 0.12, 0));
      g.add(part(G.bell, mat(TIER_COL[tier], TIER_GLOW[tier], 0.3, { side: THREE.DoubleSide }), 0.13, 0.2, 0.13, 0, 0.42, 0));
      g.add(part(G.sph, glowM, 0.04, 0.04, 0.04, 0, 0.33, 0));
      break;
    case 9: { // 雅扇
      g.add(part(G.cyl, grip, 0.02, 0.14, 0.02, 0, 0, 0));
      const f = part(G.fan, mat(CLOTH[tier], TIER_GLOW[tier], tier >= 4 ? 0.4 : 0, { side: THREE.DoubleSide, metal: 0.1, rough: 0.6 }), 0.45 * L, 0.45 * L, 1, 0, 0.05, 0);
      g.add(f);
      break;
    }
  }
  return g;
}

// ---- 防具（type 0-9 × tier 0-9）----
const ARMOR_PARTS = [
  { chest: 0.8, belt: 1 }, // 軽鎧
  { chest: 1.15, sh: 1.2, belt: 1 }, // 重鎧
  { skirt: 1, belt: 1 }, // 法衣
  { cape: 1, sh: 0.8 }, // 外套
  { chest: 1 }, // 胸当て
  { sh: 1.35 }, // 肩鎧
  { chest: 1, sh: 1, spike: 1 }, // 竜鱗鎧
  { skirt: 1, halo: 1 }, // 聖衣
  { cape: 1, belt: 1 }, // 影装束
  { chest: 1.1, sh: 1.1, cape: 1, crown: 1 } // 王冠鎧
];
function armorMesh(type, tier, h, k) {
  const g = new THREE.Group();
  const P = ARMOR_PARTS[type];
  const metal = mat(TIER_COL[tier], TIER_GLOW[tier], tier >= 4 ? 0.25 + tier * 0.04 : 0);
  const glowM = mat(TIER_GLOW[tier] || 0xffe08a, TIER_GLOW[tier] || 0xffe08a, 1.3, { metal: 0.2 });
  const cloth = mat(CLOTH[(type + tier) % 10], 0, 0, { side: THREE.DoubleSide, metal: 0, rough: 0.85 });
  if (P.chest) {
    const c = P.chest;
    g.add(part(G.box, metal, 0.36 * k * c, 0.28 * h * 0.55 * c, 0.07 * k, 0, 0.68 * h, 0.13 * k));
    if (tier >= 4) g.add(part(G.sph, glowM, 0.04 * k, 0.04 * k, 0.02 * k, 0, 0.7 * h, 0.17 * k));
  }
  if (P.sh) {
    for (const s of [-1, 1]) {
      const sp = part(G.half, metal, 0.12 * k * P.sh, 0.08 * k * P.sh, 0.12 * k * P.sh, s * 0.22 * k, 0.8 * h, 0);
      sp.rotation.z = -s * 0.5;
      g.add(sp);
      if (P.spike) {
        const sk = part(G.cone, metal, 0.03 * k, 0.14 * k, 0.03 * k, s * 0.27 * k, 0.85 * h, 0);
        sk.rotation.z = -s * 0.6;
        g.add(sk);
      }
    }
  }
  if (P.belt) {
    const b = part(G.torus, metal, 0.2 * k, 0.2 * k, 0.5 * k, 0, 0.52 * h, 0);
    b.rotation.x = Math.PI / 2;
    g.add(b);
  }
  if (P.skirt) g.add(part(G.skirt, cloth, 0.24 * k, 0.24 * h, 0.22 * k, 0, 0.4 * h, 0));
  if (P.cape) {
    const c = part(G.plane, cloth, 0.5 * k, 0.6 * h, 1, 0, 0.5 * h, -0.17 * k);
    c.rotation.x = 0.12;
    c.rotation.y = Math.PI;
    c.userData.cape = true;
    g.add(c);
  }
  if (P.halo) {
    const r = part(G.torus, glowM, 0.15 * k, 0.15 * k, 0.15 * k, 0, h + 0.12 * k, 0);
    r.rotation.x = Math.PI / 2;
    g.add(r);
  }
  if (P.crown) {
    const r = part(G.torus, mat(0xffd970, 0xffaa30, 0.4), 0.1 * k, 0.1 * k, 0.25 * k, 0, h * 0.97, 0);
    r.rotation.x = Math.PI / 2;
    g.add(r);
  }
  // 上位の防具は足元に光の紋
  if (tier >= 7) {
    const ring = new THREE.Mesh(G.ring, new THREE.MeshBasicMaterial({ color: TIER_GLOW[tier], transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    ring.scale.setScalar(0.65 * k);
    ring.userData.spin = true;
    g.add(ring);
  }
  return g;
}

const idx = (id, p) => (typeof id === 'string' && id[0] === p ? +id.slice(1) : -1);

/** キャラ（高さh）の装備見た目を作る。wid='w0'..'w99', aid='a0'..'a99' */
export function makeGear(h, wid, aid) {
  const wi = idx(wid, 'w');
  const ai = idx(aid, 'a');
  if (!(wi >= 0 && wi < 100) && !(ai >= 0 && ai < 100)) return null;
  const k = h / 1.8;
  const root = new THREE.Group();
  root.userData.t = 0;
  if (ai >= 0 && ai < 100) root.add(armorMesh(ai % 10, Math.floor(ai / 10), h, k));
  if (wi >= 0 && wi < 100) {
    const type = wi % 10, tier = Math.floor(wi / 10);
    const hand = new THREE.Group(); // 右手（キャラは+Z向き → 右手は-X）
    hand.position.set(-0.3 * k, 0.5 * h, 0.12 * k);
    hand.rotation.x = 0.35;
    const w = weaponMesh(type, tier);
    w.scale.setScalar(k);
    if (type === 5) { // 弓は左手に縦持ち
      hand.position.x = 0.3 * k;
      hand.rotation.set(0, Math.PI / 2, 0);
    }
    if (type === 6) hand.position.y = 0.48 * h;
    hand.add(w);
    root.add(hand);
    root.userData.hand = hand;
    root.userData.base = hand.rotation.x;
    if (type === 3 || type === 7) { // 両手
      const off = new THREE.Group();
      off.position.set(0.3 * k, 0.5 * h, 0.12 * k);
      off.rotation.x = 0.35;
      const w2 = weaponMesh(type, tier);
      w2.scale.setScalar(k);
      off.add(w2);
      root.add(off);
    }
    root.userData.swing = type !== 5;
  }
  return root;
}

/** 毎フレーム：攻撃中は武器を振り、マントや光の紋を揺らす */
export function animGear(g, dt, attacking, moving) {
  if (!g) return;
  const u = g.userData;
  u.t += dt;
  u.sw = Math.max(0, (u.sw || 0) - dt * 3.2);
  if (attacking && u.sw <= 0) u.sw = 1;
  if (u.hand && u.swing) {
    const s = u.sw;
    u.hand.rotation.x = u.base + (s > 0 ? Math.sin((1 - s) * Math.PI) * 1.6 - 0.2 : Math.sin(u.t * 2) * 0.05);
  }
  g.traverse((c) => {
    if (c.userData.cape) c.rotation.x = (moving ? 0.45 : 0.1) + Math.sin(u.t * (moving ? 9 : 2)) * 0.06;
    else if (c.userData.spin) c.rotation.z += dt * 0.8;
  });
}
