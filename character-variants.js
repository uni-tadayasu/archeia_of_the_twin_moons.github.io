// 同じGLBから派生した戦士に、固有の体形と骨に追従する衣装を生成する。
// 基本モデル・アニメーションは共有し、変更する頂点と材質だけを各役者が所有する。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const RF564_MOBILE = typeof navigator !== 'undefined' && (/Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.deviceMemory||8)<=4);
const RF564_RADIAL = RF564_MOBILE ? 16 : 26;

const OWN = new WeakMap();
const G = {
  sphere: new THREE.SphereGeometry(1, RF564_RADIAL, RF564_MOBILE ? 12 : 20),
  half: new THREE.SphereGeometry(1, RF564_RADIAL, RF564_MOBILE ? 12 : 18, 0, Math.PI * 2, 0, Math.PI / 2),
  box: new RoundedBoxGeometry(1, 1, 1, RF564_MOBILE ? 2 : 3, 0.095),
  cyl: new THREE.CylinderGeometry(1, 1, 1, RF564_RADIAL),
  cone: new THREE.ConeGeometry(1, 1, RF564_RADIAL),
  taper: new THREE.CylinderGeometry(0.74, 1, 1, RF564_RADIAL),
  ring: new THREE.TorusGeometry(1, 0.055, 10, RF564_MOBILE ? 32 : 52),
  arc: new THREE.TorusGeometry(1, 0.065, 10, RF564_MOBILE ? 30 : 50, Math.PI * 1.45),
  oct: new THREE.OctahedronGeometry(1),
  plate: new THREE.CylinderGeometry(1, 0.86, 1, RF564_RADIAL, 1, true),
  panel: new THREE.CylinderGeometry(0.86, 1.14, 1, RF564_RADIAL, 4, true, -0.65, 1.3),
  cape: new THREE.CylinderGeometry(0.78, 1.26, 1, RF564_RADIAL, 4, true, Math.PI - 0.95, 1.9),
  fan: new THREE.CircleGeometry(1, RF564_RADIAL, Math.PI * 0.12, Math.PI * 0.76)
};
const V = new THREE.Vector3();
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const smoothSlope = (a, b, x) => {
  if (x <= a || x >= b) return 0;
  const t = (x - a) / (b - a);
  return 6 * t * (1 - t) / (b - a);
};

function bonesOf(model) {
  const b = {};
  model.traverse(o => {
    if (!o.isBone || /finger|thumb|index|middle|ring|pinky|end|twist|top/i.test(o.name)) return;
    const n = o.name.toLowerCase().replace(/^mixamorig[:_]?/, '');
    if (/^head$|head_?0?1?$/.test(n)) b.head ||= o;
    else if (/neck/.test(n)) b.neck ||= o;
    else if (/hips|pelvis/.test(n)) b.hips ||= o;
    else if (/spine2|upperchest|chest/.test(n)) b.chest ||= o;
    else if (/spine1/.test(n)) b.spine ||= o;
    const side = /left/.test(n) ? 'l' : /right/.test(n) ? 'r' : '';
    if (side && /hand|wrist/.test(n)) b[side + 'hand'] ||= o;
    else if (side && /forearm|lowerarm/.test(n)) b[side + 'forearm'] ||= o;
    else if (side && /arm/.test(n)) b[side + 'arm'] ||= o;
  });
  b.chest ||= b.spine || b.hips;
  return b;
}

function modelBounds(model) {
  model.updateMatrixWorld(true);
  const inverse = model.matrixWorld.clone().invert();
  const box = new THREE.Box3();
  const transform = new THREE.Matrix4();
  model.traverse(o => {
    const position = o.isMesh && o.geometry?.getAttribute('position');
    if (!position || o.userData.appearancePart) return;
    transform.multiplyMatrices(inverse, o.matrixWorld);
    for (let i = 0; i < position.count; i++) {
      o.getVertexPosition(i, V);
      box.expandByPoint(V.applyMatrix4(transform));
    }
  });
  return box;
}

function bonePoint(bone, model, fallback) {
  if (!bone) return fallback.clone();
  return model.worldToLocal(bone.getWorldPosition(new THREE.Vector3()));
}

function measure(model, bones, bounds) {
  const h = Math.max(0.01, bounds.max.y - bounds.min.y);
  const minY = bounds.min.y;
  const cx = (bounds.min.x + bounds.max.x) / 2;
  const cz = (bounds.min.z + bounds.max.z) / 2;
  const at = (x, y, z = 0) => new THREE.Vector3(cx + x * h, minY + y * h, cz + z * h);
  const hip = bonePoint(bones.hips, model, at(0, 0.53));
  const chest = bonePoint(bones.chest, model, at(0, 0.73));
  const neck = bonePoint(bones.neck, model, at(0, 0.81));
  const head = bonePoint(bones.head, model, at(0, 0.86));
  const la = bonePoint(bones.larm, model, at(0.15, 0.77));
  const ra = bonePoint(bones.rarm, model, at(-0.15, 0.77));
  const lh = bonePoint(bones.lhand, model, at(0.29, 0.57, 0.03));
  const rh = bonePoint(bones.rhand, model, at(-0.29, 0.57, 0.03));
  const transform = new THREE.Matrix4();
  const inverse = model.matrixWorld.clone().invert();
  const rows = { head: [], chest: [], waist: [] };
  model.traverse(o => {
    const position = o.isMesh && o.geometry?.getAttribute('position');
    if (!position || o.userData.appearancePart) return;
    transform.multiplyMatrices(inverse, o.matrixWorld);
    for (let i = 0; i < position.count; i += Math.max(1, Math.floor(position.count / 5000))) {
      o.getVertexPosition(i, V);
      V.applyMatrix4(transform);
      if (Math.abs(V.x - head.x) < 0.17 * h && V.y >= head.y && V.y < bounds.max.y + 0.015 * h) rows.head.push([V.x, V.y, V.z]);
      if (Math.abs(V.x - chest.x) < 0.16 * h && V.y > chest.y - 0.07 * h && V.y < neck.y - 0.035 * h) rows.chest.push([V.x, V.y, V.z]);
      if (Math.abs(V.x - hip.x) < 0.15 * h && V.y > hip.y + 0.025 * h && V.y < hip.y + 0.09 * h) rows.waist.push([V.x, V.y, V.z]);
    }
  });
  function section(points, center, defaults) {
    if (points.length < 12) return { x: center.x, z: center.z, rx: defaults[0] * h, rz: defaults[1] * h, top: defaults[2] * h + minY };
    const sorted = axis => points.map(p => p[axis]).sort((a, b) => a - b);
    const xs = sorted(0), ys = sorted(1), zs = sorted(2);
    const q = (list, t) => list[Math.floor((list.length - 1) * t)];
    const loX = q(xs, 0.03), hiX = q(xs, 0.97), loZ = q(zs, 0.04), hiZ = q(zs, 0.96);
    return { x: (loX + hiX) / 2, z: (loZ + hiZ) / 2, rx: clamp((hiX - loX) / 2, 0.045 * h, 0.17 * h), rz: clamp((hiZ - loZ) / 2, 0.045 * h, 0.15 * h), top: q(ys, 0.98) };
  }
  return { h, minY, at, hip, chest, neck, head, la, ra, lh, rh,
    hd: section(rows.head, head, [0.085, 0.085, 1]),
    torso: section(rows.chest, chest, [0.12, 0.085, 0.81]),
    waist: section(rows.waist, hip, [0.105, 0.075, 0.62]) };
}

function reshape(model, profile, bounds, owned) {
  const h = Math.max(0.01, bounds.max.y - bounds.min.y);
  const cx = (bounds.min.x + bounds.max.x) / 2;
  const cz = (bounds.min.z + bounds.max.z) / 2;
  const inverse = model.matrixWorld.clone().invert();
  const transform = new THREE.Matrix4();
  const back = new THREE.Matrix4();
  const normalTransform = new THREE.Matrix4();
  const normalToModel = new THREE.Matrix3();
  const normalToGeometry = new THREE.Matrix3();
  const normal = new THREE.Vector3();
  const [headWidth, headDepth, shoulders, waist, jaw] = profile.shape;
  model.traverse(o => {
    if (!o.isMesh || !o.geometry?.getAttribute('position')) return;
    const geometry = o.geometry.clone();
    const source = o.geometry.getAttribute('position');
    const sourceNormal = o.geometry.getAttribute('normal');
    const positions = new Float32Array(source.count * 3);
    const normals = sourceNormal ? new Float32Array(source.count * 3) : null;
    transform.multiplyMatrices(inverse, o.matrixWorld);
    back.copy(transform).invert();
    // Mesh quantization may live in inverse bind matrices rather than mesh.scale.
    // Deform the visible bind-pose position, then invert that vertex's skin blend.
    const palette = o.isSkinnedMesh ? o.skeleton.bones.map((bone, i) => new THREE.Matrix4().multiplyMatrices(bone.matrixWorld, o.skeleton.boneInverses[i])) : null;
    const skin = new THREE.Matrix4();
    const index = geometry.getAttribute('skinIndex'), weight = geometry.getAttribute('skinWeight');
    for (let i = 0; i < source.count; i++) {
      V.fromBufferAttribute(source, i);
      if (palette) {
        const indices = [index.getX(i), index.getY(i), index.getZ(i), index.getW(i)];
        const weights = [weight.getX(i), weight.getY(i), weight.getZ(i), weight.getW(i)];
        skin.elements.fill(0);
        for (let k = 0; k < 4; k++) {
          if (!weights[k]) continue;
          const elements = palette[indices[k]].elements;
          for (let j = 0; j < 16; j++) skin.elements[j] += elements[j] * weights[k];
        }
        skin.elements[3] = skin.elements[7] = skin.elements[11] = 0;
        skin.elements[15] = 1;
        skin.premultiply(o.bindMatrixInverse).multiply(o.bindMatrix);
        V.applyMatrix4(skin);
      }
      V.applyMatrix4(transform);
      const y = (V.y - bounds.min.y) / h;
      const head = smooth(0.80, 0.87, y);
      const shoulder = Math.exp(-Math.pow((y - 0.745) / 0.12, 2));
      const core = Math.exp(-Math.pow((y - 0.59) / 0.095, 2));
      const jawBand = Math.exp(-Math.pow((y - 0.87) / 0.045, 2));
      const torsoScale = 1 + (shoulders - 1) * shoulder + (waist - 1) * core;
      const body = (1 - head) * torsoScale;
      const sx = body + head * (headWidth + (jaw - 1) * jawBand);
      const sz = 1 + head * (headDepth - 1) + core * (waist - 1) * 0.55;
      if (normals) {
        // Keep the authored smooth normals across UV seams. Rebuilding normals
        // from the split mesh creates dark triangle-shaped patches on faces.
        // Transform them with the inverse transpose of this exact deformation.
        normalTransform.copy(transform);
        if (palette) normalTransform.multiply(skin);
        normalToModel.getNormalMatrix(normalTransform);
        normalToGeometry.copy(normalToModel).invert();
        normal.fromBufferAttribute(sourceNormal, i).applyMatrix3(normalToModel);
        const headSlope = smoothSlope(0.80, 0.87, y);
        const shoulderSlope = -2 * (y - 0.745) * shoulder / (0.12 * 0.12);
        const coreSlope = -2 * (y - 0.59) * core / (0.095 * 0.095);
        const jawSlope = -2 * (y - 0.87) * jawBand / (0.045 * 0.045);
        const sxSlope = (1 - head) * ((shoulders - 1) * shoulderSlope + (waist - 1) * coreSlope)
          + headSlope * (headWidth + (jaw - 1) * jawBand - torsoScale) + head * (jaw - 1) * jawSlope;
        const szSlope = headSlope * (headDepth - 1) + coreSlope * (waist - 1) * 0.55;
        const dy = 1 + smoothSlope(0.88, 1.0, y) * ((profile.ordinal % 5) - 2) * 0.004;
        const nx = normal.x / sx, nz = normal.z / sz;
        normal.set(nx, (normal.y - (V.x - cx) * sxSlope * nx / h - (V.z - cz) * szSlope * nz / h) / dy, nz);
        normal.applyMatrix3(normalToGeometry).normalize();
        normals.set([normal.x, normal.y, normal.z], i * 3);
      }
      V.x = cx + (V.x - cx) * sx;
      V.z = cz + (V.z - cz) * sz;
      // A small crown-length difference makes even bare-headed silhouettes distinct.
      V.y += smooth(0.88, 1.0, y) * h * ((profile.ordinal % 5) - 2) * 0.004;
      V.applyMatrix4(back);
      if (palette) V.applyMatrix4(skin.invert());
      positions.set([V.x, V.y, V.z], i * 3);
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (normals) geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    else geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.appearanceId = profile.id;
    o.geometry = geometry;
    if (o.isSkinnedMesh) {
      o.boundingBox = null;
      o.boundingSphere = null;
    }
    owned.resources.add(geometry);
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    const copies = materials.map(original => {
      if (!original) return original;
      const material = original.clone();
      // Keep painted faces readable; cloth and armor are separate shaped meshes.
      material.color?.lerp(new THREE.Color(profile.colors[3]), material.map ? 0.055 : 0.11);
      material.roughness = Math.max(material.roughness || 0.5, 0.62);
      material.userData.appearanceId = profile.id;
      owned.resources.add(material);
      return material;
    });
    o.material = Array.isArray(o.material) ? copies : copies[0];
  });
}

function makeContext(model, p, M, bones, owned) {
  const material = (color, metalness = 0.12, roughness = 0.65) => {
    const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness, side: THREE.DoubleSide });
    mat.userData.appearanceId = p.id;
    owned.resources.add(mat);
    return mat;
  };
  const mats = {
    cloth: material(p.colors[0], 0.04, 0.9),
    metal: material(p.colors[1], 0.58, 0.4),
    dark: material(p.colors[2], 0.12, 0.82),
    pale: material(p.colors[3], 0.25, 0.56),
    hair: material([0x2e2328, 0x664c34, 0xb0a48a, 0x928c96, 0x352e44, 0xa7b3b9, 0x4d372e][(p.ordinal + p.family * 2) % 7], 0.03, 0.92)
  };
  const mesh = (shape, mat, sx, sy, sz, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(G[shape], mats[mat]);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.appearancePart = true;
    m.name = `appearance_${p.id}_${shape}`;
    return m;
  };
  const group = (name, bone, position) => {
    const g = new THREE.Group();
    g.name = `appearance_${p.id}_${name}`;
    g.userData.appearancePart = true;
    if (position) g.position.copy(position);
    model.add(g);
    owned.nodes.push(g);
    // Building in model space and attaching after creation preserves the bind pose.
    g.userData.appearanceBone = bone || '';
    return g;
  };
  const rod = (parent, mat, a, b, radius = 0.008 * M.h) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const d = end.clone().sub(start);
    const o = mesh('cyl', mat, radius, d.length(), radius);
    o.position.copy(start.add(end).multiplyScalar(0.5));
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    parent.add(o);
    return o;
  };
  return { model, p, M, bones, owned, mats, mesh, group, rod };
}

function headwear(C) {
  const { p, M, mesh, group, rod } = C;
  const H = M.hd, u = M.h;
  const x = H.rx * 1.09, z = H.rz * 1.09;
  const top = Math.max(H.top, M.head.y + 0.10 * u);
  const g = group('head', 'head', new THREE.Vector3(H.x, top - 0.025 * u, H.z));
  const add = (shape, mat, sx, sy, sz, px = 0, py = 0, pz = 0) => {
    const o = mesh(shape, mat, sx, sy, sz, px, py, pz);
    g.add(o);
    return o;
  };
  const band = (mat = 'metal') => {
    const a = add('ring', mat, x * 1.03, z * 1.03, (x + z) * 0.55, 0, 0, 0);
    a.rotation.x = Math.PI / 2;
    return a;
  };
  const crest = (n = p.crest, high = 0.075 * u) => {
    band();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      add('cone', i % 2 ? 'metal' : 'pale', 0.018 * u, high * (0.75 + 0.25 * Math.cos(a)), 0.018 * u, Math.sin(a) * x, high / 2, Math.cos(a) * z);
    }
  };
  const locks = (n, length, style = 0) => {
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 0.43 + (i / Math.max(1, n - 1)) * Math.PI * 1.14;
      const o = add(style ? 'cone' : 'sphere', 'hair', 0.025 * u, length, 0.026 * u, Math.sin(a) * x, -length * 0.65, Math.cos(a) * z);
      o.rotation.z = -Math.sin(a) * 0.14;
      if (style) o.rotation.z += Math.PI;
    }
  };
  switch (p.head) {
    case 0: // rounded helmet and sweeping feather crest
      add('half', 'metal', x * 1.05, 0.065 * u, z * 1.05, 0, -0.005 * u);
      band('dark');
      for (let i = 0; i < p.crest + 1; i++) {
        const o = add('sphere', i % 2 ? 'cloth' : 'pale', 0.018 * u, 0.075 * u, 0.012 * u, 0, 0.065 * u + i * 0.006 * u, -i * 0.022 * u);
        o.rotation.x = -0.4 - i * 0.12;
      }
      break;
    case 1: // branching antlers
      band('dark');
      for (const side of [-1, 1]) {
        rod(g, 'pale', [side * x * 0.75, 0, 0], [side * x * 1.5, 0.13 * u, -0.025 * u], 0.009 * u);
        for (let i = 0; i < 3; i++) rod(g, 'metal', [side * x * (0.95 + i * 0.2), 0.025 * u + i * 0.035 * u, -0.005 * u], [side * x * (1.4 + i * 0.18), 0.055 * u + i * 0.04 * u, -0.01 * u], 0.005 * u);
      }
      break;
    case 2:
      add('cone', 'cloth', x * 1.06, 0.20 * u, z, 0, 0.055 * u);
      band();
      add('oct', 'pale', 0.025 * u, 0.045 * u, 0.011 * u, 0, 0.04 * u, z * 0.78);
      for (const s of [-1, 1]) add('box', 'cloth', 0.04 * u, 0.18 * u, 0.012 * u, s * x * 0.85, -0.11 * u, -z * 0.5);
      break;
    case 3:
      add('half', 'cloth', x * 1.12, 0.065 * u, z * 1.14, 0, -0.01 * u);
      for (const s of [-1, 1]) {
        const ear = add('cone', 'cloth', 0.037 * u, 0.10 * u, 0.022 * u, s * x * 0.75, 0.075 * u);
        ear.rotation.z = -s * 0.25;
        add('oct', 'pale', 0.015 * u, 0.035 * u, 0.007 * u, s * x * 0.76, 0.07 * u, 0.018 * u);
      }
      locks(5, 0.08 * u);
      break;
    case 4:
      add('cyl', 'cloth', x * 2.1, 0.012 * u, z * 1.75, 0, 0.005 * u);
      add('taper', 'cloth', x * 0.9, 0.10 * u, z * 0.85, 0, 0.055 * u);
      band();
      add('oct', 'pale', 0.023 * u, 0.046 * u, 0.012 * u, -x * 0.86, 0.11 * u, 0);
      break;
    case 5:
      add('half', 'hair', x * 1.03, 0.045 * u, z * 1.04, 0, -0.015 * u);
      for (const s of [-1, 1]) {
        add('sphere', 'hair', 0.052 * u, 0.055 * u, 0.045 * u, s * x * 1.12, 0.025 * u, -0.02 * u);
        for (let i = 0; i < 4; i++) add('sphere', i % 2 ? 'hair' : 'cloth', 0.018 * u, 0.024 * u, 0.016 * u, s * x * 1.15, -0.035 * u - i * 0.035 * u, -0.015 * u);
      }
      band();
      break;
    case 6:
      add('half', 'metal', x * 1.08, 0.06 * u, z * 1.1);
      for (const s of [-1, 1]) {
        const horn = add('cone', 'pale', 0.03 * u, 0.145 * u, 0.027 * u, s * x * 1.25, 0.04 * u, -0.02 * u);
        horn.rotation.z = -s * 0.65;
        const cheek = add('box', 'metal', 0.018 * u, 0.09 * u, z * 0.75, s * x, -0.055 * u, z * 0.2);
        cheek.rotation.z = s * 0.08;
      }
      break;
    case 7: {
      band();
      const moon = add('arc', 'pale', x * 1.12, x * 1.12, 0.08 * u, 0, 0.07 * u, z * 0.3);
      moon.rotation.z = Math.PI * 0.78;
      add('oct', 'metal', 0.025 * u, 0.043 * u, 0.012 * u, 0, 0.045 * u, z);
      locks(4, 0.09 * u, 1);
      break;
    }
    case 8:
      band('pale');
      for (let i = 0; i < 5; i++) {
        const a = (i - 2) * 0.3;
        const o = add('oct', i % 2 ? 'cloth' : 'metal', 0.025 * u, (0.08 + 0.02 * Math.cos(a * 3)) * u, 0.014 * u, Math.sin(a) * x * 1.35, 0.07 * u, -z * 0.3);
        o.rotation.z = -a;
      }
      locks(5, 0.08 * u);
      break;
    case 9:
      band('cloth');
      add('sphere', 'hair', 0.045 * u, 0.07 * u, 0.045 * u, 0, 0.035 * u, -z * 0.5);
      for (let i = 0; i < 4; i++) {
        const o = add('sphere', 'hair', 0.028 * u, 0.075 * u, 0.026 * u, (i % 2 ? 1 : -1) * 0.008 * u, -0.01 * u - i * 0.055 * u, -z * 1.2 - i * 0.008 * u);
        o.rotation.x = -0.25;
      }
      add('box', 'metal', 0.075 * u, 0.015 * u, 0.012 * u, 0, -0.01 * u, z);
      break;
    case 10:
      add('half', 'metal', x * 1.06, 0.065 * u, z * 1.05, 0, 0);
      add('sphere', 'metal', x * 0.86, 0.073 * u, 0.02 * u, 0, -0.067 * u, z * 0.93);
      add('box', 'dark', x * 1.3, 0.009 * u, 0.009 * u, 0, -0.052 * u, z * 1.15);
      for (const s of [-1, 1]) add('cone', 'metal', 0.022 * u, 0.075 * u, 0.02 * u, s * x * 0.8, 0.06 * u);
      break;
    case 11:
      band();
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        const o = add('cone', i % 2 ? 'metal' : 'pale', 0.022 * u, (0.09 - i * 0.01) * u, 0.008 * u, s * (x + i * 0.018 * u), 0.025 * u + i * 0.007 * u);
        o.rotation.z = -s * (0.5 + i * 0.16);
      }
      locks(3, 0.12 * u);
      break;
    case 12:
      add('half', 'cloth', x * 1.14, 0.06 * u, z * 1.15, 0, -0.005 * u);
      {
        const cap = add('cone', 'cloth', 0.065 * u, 0.19 * u, 0.055 * u, 0, 0.07 * u, -0.04 * u);
        cap.rotation.x = -0.5;
      }
      for (const s of [-1, 1]) add('box', 'cloth', 0.023 * u, 0.16 * u, z * 0.85, s * x * 1.04, -0.08 * u, -z * 0.25);
      band('dark');
      break;
    case 13:
      for (let i = 0; i < 4; i++) {
        const a = add('ring', i % 2 ? 'pale' : 'cloth', x * (1.07 - i * 0.06), z * (1.07 - i * 0.06), (x + z) * 0.65, 0, i * 0.012 * u);
        a.rotation.x = Math.PI / 2 + i * 0.06;
      }
      add('sphere', 'cloth', x * 0.9, 0.033 * u, 0.016 * u, 0, -0.105 * u, z * 0.9);
      add('oct', 'metal', 0.021 * u, 0.032 * u, 0.012 * u, 0, 0.015 * u, z * 0.96);
      break;
    case 14:
      add('half', 'hair', x * 1.05, 0.05 * u, z * 1.08, 0, -0.01 * u);
      locks(9, (0.1 + (p.ordinal % 3) * 0.02) * u);
      for (const s of [-1, 1]) add('oct', 'metal', 0.012 * u, 0.028 * u, 0.01 * u, s * x * 0.95, -0.02 * u, z * 0.6);
      break;
    case 15:
      crest(5, 0.045 * u);
      add('ring', 'pale', 0.15 * u, 0.15 * u, 0.15 * u, 0, 0.035 * u, -z * 1.1);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const o = add('cone', 'metal', 0.009 * u, 0.045 * u, 0.007 * u, Math.sin(a) * 0.16 * u, 0.035 * u + Math.cos(a) * 0.16 * u, -z * 1.1);
        o.rotation.z = -a;
      }
      break;
    case 16:
      add('half', 'hair', x, 0.045 * u, z, 0, -0.015 * u);
      add('sphere', 'hair', 0.04 * u, 0.055 * u, 0.04 * u, 0, 0.07 * u, -z * 0.15);
      for (const s of [-1, 1]) {
        add('ring', 'metal', 0.029 * u, 0.029 * u, 0.029 * u, s * 0.036 * u, -0.028 * u, z);
        add('sphere', 'dark', 0.023 * u, 0.023 * u, 0.009 * u, s * 0.036 * u, -0.028 * u, z);
      }
      add('box', 'metal', 0.025 * u, 0.01 * u, 0.01 * u, 0, -0.028 * u, z);
      break;
    case 17:
      band();
      for (let i = 0; i < 7; i++) {
        const a = (i / 6 - 0.5) * 1.9;
        const o = add('oct', i % 2 ? 'metal' : 'cloth', 0.028 * u, (0.06 + 0.04 * Math.cos(a)) * u, 0.01 * u, Math.sin(a) * 0.11 * u, 0.055 * u, -z * 0.6);
        o.rotation.z = -a * 0.8;
      }
      locks(6, 0.09 * u, 1);
      break;
    default:
      crest(p.crest + 2, 0.075 * u);
      for (const s of [-1, 1]) for (let i = 0; i < 5; i++) add('sphere', i % 2 ? 'hair' : 'metal', 0.018 * u, 0.022 * u, 0.017 * u, s * x * 1.12, -0.018 * u - i * 0.032 * u, 0);
  }
  return g;
}

function outfit(C) {
  const { p, M, mesh, group, rod } = C;
  const u = M.h, T = M.torso, W = M.waist;
  const chest = group('coat', 'chest', new THREE.Vector3(T.x, M.chest.y, T.z));
  const add = (shape, mat, sx, sy, sz, x = 0, y = 0, z = 0, parent = chest) => {
    const o = mesh(shape, mat, sx, sy, sz, x, y, z);
    parent.add(o);
    return o;
  };
  const bodyW = T.rx * 1.10, bodyD = T.rz * 1.13;
  const coatH = clamp(M.neck.y - M.hip.y - 0.025 * u, 0.20 * u, 0.29 * u);
  const belt = group('belt', 'hips', new THREE.Vector3(W.x, M.hip.y + 0.035 * u, W.z));
  const br = add('ring', 'dark', W.rx * 1.13, W.rz * 1.13, 0.11 * u, 0, 0, 0, belt);
  br.rotation.x = Math.PI / 2;
  add('oct', 'metal', 0.03 * u, 0.025 * u, 0.011 * u, 0, 0, W.rz * 1.12, belt);
  const panel = (side, mat, length, width, depth = 0) => {
    const o = add('panel', mat, width * 0.78, length, 0.024 * u, side * W.rx * 0.55, -length * 0.47, W.rz * 1.10 + depth, belt);
    o.rotation.x = -0.09;
    o.rotation.z = -side * 0.06;
    return o;
  };
  const shoulder = (side, style = 0) => {
    const a = side < 0 ? M.ra : M.la;
    const q = group(side < 0 ? 'pauldron_r' : 'pauldron_l', side < 0 ? 'rarm' : 'larm', a.clone());
    const o = add('half', style === 2 ? 'pale' : 'metal', 0.058 * u, (style === 1 ? 0.047 : 0.035) * u, 0.064 * u, side * 0.018 * u, 0.012 * u, 0, q);
    o.rotation.z = -side * 0.35;
    for (let i = 0; i < (style === 2 ? 3 : 1); i++) {
      const rim = add('box', 'dark', 0.11 * u, 0.012 * u, 0.06 * u, side * 0.02 * u, -i * 0.021 * u, 0, q);
      rim.rotation.z = -side * 0.28;
    }
    return q;
  };
  const cape = (side = 0, length = 0.54 * u, broad = 1) => {
    const c = add('cape', 'cloth', bodyW * broad, length, bodyD * 1.55, side * bodyW * 0.4, 0.075 * u - length * 0.5, -0.01 * u);
    c.rotation.x = 0.11;
    c.rotation.z = -side * 0.12;
    return c;
  };
  switch (p.coat) {
    case 0:
      for (let i = 0; i < 4; i++) add('plate', i % 2 ? 'metal' : 'pale', bodyW * (1 + i * 0.025), 0.045 * u, bodyD, 0, 0.065 * u - i * 0.042 * u);
      shoulder(-1); shoulder(1);
      panel(-1, 'cloth', 0.23 * u, 0.08 * u); panel(1, 'cloth', 0.23 * u, 0.08 * u);
      break;
    case 1:
      add('plate', 'cloth', bodyW, coatH, bodyD, 0, -0.015 * u);
      panel(-1, 'cloth', 0.39 * u, 0.12 * u); panel(1, 'pale', 0.34 * u, 0.09 * u, 0.005 * u);
      cape(0, 0.55 * u, 1.1);
      break;
    case 2:
      add('plate', 'dark', bodyW, coatH * 0.8, bodyD, 0, -0.015 * u);
      shoulder(p.ordinal % 2 ? -1 : 1, 1);
      cape(p.ordinal % 2 ? -1 : 1, 0.55 * u, 0.76);
      {
        const sash = add('box', 'cloth', 0.05 * u, coatH * 1.1, 0.013 * u, 0, 0.01 * u, bodyD * 1.06);
        sash.rotation.z = -0.48;
      }
      break;
    case 3:
      add('plate', 'dark', bodyW, coatH, bodyD, 0, -0.02 * u);
      for (let i = 0; i < 11; i++) {
        const a = i / 10 * Math.PI * 1.35 + Math.PI * 0.33;
        add('sphere', 'pale', 0.038 * u, 0.028 * u, 0.034 * u, Math.cos(a) * bodyW, 0.072 * u, Math.sin(a) * bodyD);
      }
      panel(-1, 'dark', 0.18 * u, 0.10 * u); panel(1, 'cloth', 0.25 * u, 0.09 * u);
      break;
    case 4:
      add('plate', 'dark', bodyW, coatH, bodyD, 0, -0.015 * u);
      for (let y = 0; y < 4; y++) for (let x = -2; x <= 2; x++) add('box', (x + y) % 2 ? 'metal' : 'pale', 0.035 * u, 0.038 * u, 0.012 * u, x * 0.037 * u, 0.065 * u - y * 0.04 * u, bodyD * 0.98);
      shoulder(-1, 2); shoulder(1, 2);
      panel(-1, 'metal', 0.15 * u, 0.07 * u); panel(1, 'metal', 0.15 * u, 0.07 * u);
      break;
    case 5:
      add('plate', 'cloth', bodyW, coatH, bodyD, 0, -0.01 * u);
      add('cape', 'pale', bodyW * 0.85, 0.072 * u, bodyD * 1.04, 0, 0.075 * u);
      panel(-1, 'cloth', 0.33 * u, 0.085 * u); panel(1, 'cloth', 0.33 * u, 0.085 * u);
      for (let i = 0; i < 5; i++) add('sphere', 'metal', 0.009 * u, 0.009 * u, 0.007 * u, 0, 0.07 * u - i * 0.035 * u, bodyD * 1.04);
      cape(0, 0.46 * u, 0.9);
      break;
    case 6:
      add('plate', 'dark', bodyW, coatH, bodyD, 0, -0.02 * u);
      for (let s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const rib = add('box', 'pale', bodyW * 0.85, 0.018 * u, 0.014 * u, s * bodyW * 0.45, 0.055 * u - i * 0.04 * u, bodyD);
          rib.rotation.z = s * 0.20;
        }
        const pad = shoulder(s, 1);
        const spike = add('cone', 'pale', 0.018 * u, 0.10 * u, 0.018 * u, s * 0.065 * u, 0.075 * u, -0.01 * u, pad);
        spike.rotation.z = -s * 0.5;
      }
      break;
    case 7:
      add('plate', 'cloth', bodyW * 0.98, coatH * 0.8, bodyD, 0, -0.03 * u);
      for (let i = 0; i < 3; i++) {
        const sash = add('box', i % 2 ? 'pale' : 'dark', 0.035 * u, coatH * 0.95, 0.013 * u, (i - 1) * 0.015 * u, -0.02 * u, bodyD);
        sash.rotation.z = -0.5;
      }
      panel(p.ordinal % 2 ? 1 : -1, 'cloth', 0.34 * u, 0.09 * u);
      for (let i = 0; i < 9; i++) add('sphere', 'metal', 0.01 * u, 0.01 * u, 0.01 * u, Math.sin(i / 8 * Math.PI - Math.PI / 2) * bodyW * 0.9, 0.065 * u - Math.cos(i / 8 * Math.PI - Math.PI / 2) * 0.035 * u, bodyD);
      break;
    case 8:
      add('plate', 'cloth', bodyW, coatH, bodyD, 0, -0.01 * u);
      for (const s of [-1, 1]) {
        const collar = add('box', 'pale', 0.065 * u, 0.11 * u, 0.015 * u, s * 0.075 * u, 0.075 * u, bodyD * 0.5);
        collar.rotation.z = -s * 0.65;
      }
      panel(-1, 'pale', 0.27 * u, 0.075 * u); panel(1, 'cloth', 0.31 * u, 0.075 * u);
      cape(0, 0.52 * u, 1.1);
      break;
    case 9:
      add('plate', 'dark', bodyW, coatH, bodyD, 0, -0.015 * u);
      for (const s of [-1, 1]) {
        const strap = add('box', 'cloth', 0.035 * u, coatH * 1.08, 0.012 * u, s * bodyW * 0.2, -0.015 * u, bodyD);
        strap.rotation.z = s * 0.55;
      }
      for (let i = -2; i <= 2; i++) {
        add('sphere', i % 2 ? 'metal' : 'pale', 0.017 * u, 0.027 * u, 0.016 * u, i * 0.04 * u, -0.035 * u, W.rz * 1.22, belt);
        add('cyl', 'dark', 0.008 * u, 0.015 * u, 0.008 * u, i * 0.04 * u, -0.005 * u, W.rz * 1.22, belt);
      }
      panel(-1, 'cloth', 0.21 * u, 0.09 * u);
      break;
    case 10:
      add('plate', 'metal', bodyW * 1.03, coatH, bodyD, 0, -0.02 * u);
      shoulder(-1, 1); shoulder(1, 1);
      cape(0, 0.58 * u, 1.25);
      for (const s of [-1, 1]) panel(s, 'pale', 0.23 * u, 0.08 * u);
      break;
    default:
      add('plate', 'cloth', bodyW, coatH * 0.9, bodyD, 0, -0.02 * u);
      add('oct', 'metal', bodyW * 0.76, 0.12 * u, 0.02 * u, 0, -0.01 * u, bodyD);
      shoulder(p.ordinal % 2 ? 1 : -1);
      for (const s of [-1, 1]) panel(s, 'cloth', 0.18 * u, 0.07 * u);
  }
  // A different raised emblem for every design, rather than a hue-only duplicate.
  const emblem = add('oct', 'pale', 0.018 * u, 0.026 * u, 0.013 * u, 0, 0.045 * u, bodyD * 1.2);
  emblem.rotation.z = p.trim * Math.PI / 6;
  for (let i = 0; i < p.crest; i++) {
    const a = i * Math.PI * 2 / p.crest;
    rod(chest, 'metal', [0, 0.045 * u, bodyD * 1.19], [Math.sin(a) * 0.034 * u, 0.045 * u + Math.cos(a) * 0.034 * u, bodyD * 1.19], 0.0025 * u);
  }
}

function backAndWeapon(C) {
  const { p, M, mesh, group, rod } = C;
  const u = M.h, T = M.torso;
  const back = group('back', 'chest', new THREE.Vector3(T.x, M.chest.y + 0.04 * u, T.z - T.rz * 1.2));
  const add = (parent, shape, mat, sx, sy, sz, x = 0, y = 0, z = 0) => {
    const m = mesh(shape, mat, sx, sy, sz, x, y, z);
    parent.add(m);
    return m;
  };
  switch (p.back) {
    case 0:
      for (const s of [-1, 1]) add(back, 'box', 'cloth', 0.055 * u, 0.36 * u, 0.008 * u, s * 0.045 * u, -0.15 * u, -0.035 * u).rotation.z = s * 0.17;
      break;
    case 1:
      for (let i = 0; i < 5; i++) {
        const a = (i - 2) * 0.35;
        const feather = add(back, 'oct', i % 2 ? 'pale' : 'metal', 0.028 * u, 0.13 * u, 0.012 * u, Math.sin(a) * 0.12 * u, 0.06 * u, -0.03 * u);
        feather.rotation.z = -a;
      }
      break;
    case 2:
      add(back, 'cyl', 'dark', 0.043 * u, 0.25 * u, 0.043 * u, 0.08 * u, -0.09 * u, -0.035 * u).rotation.z = -0.23;
      for (let i = 0; i < 3; i++) {
        rod(back, 'pale', [0.065 * u + i * 0.02 * u, -0.13 * u, -0.04 * u], [0.105 * u + i * 0.02 * u, 0.15 * u, -0.04 * u], 0.004 * u);
        add(back, 'cone', 'cloth', 0.015 * u, 0.035 * u, 0.008 * u, 0.105 * u + i * 0.02 * u, 0.15 * u, -0.04 * u);
      }
      break;
    case 3:
      add(back, 'ring', 'metal', 0.16 * u, 0.16 * u, 0.16 * u, 0, 0.02 * u, -0.025 * u);
      for (let i = 0; i < p.crest; i++) {
        const a = i / p.crest * Math.PI * 2;
        add(back, 'oct', 'pale', 0.018 * u, 0.028 * u, 0.012 * u, Math.sin(a) * 0.15 * u, 0.02 * u + Math.cos(a) * 0.15 * u, -0.025 * u);
      }
      break;
    case 4:
      for (const s of [-1, 1]) {
        rod(back, 'dark', [s * 0.11 * u, -0.22 * u, -0.03 * u], [s * 0.11 * u, 0.16 * u, -0.03 * u], 0.007 * u);
        add(back, 'box', 'cloth', 0.085 * u, 0.19 * u, 0.006 * u, s * 0.15 * u, 0.04 * u, -0.03 * u);
        add(back, 'oct', 'metal', 0.023 * u, 0.035 * u, 0.008 * u, s * 0.15 * u, 0.04 * u, -0.024 * u);
      }
      break;
    case 5:
      for (let i = 0; i < 3; i++) add(back, 'box', i % 2 ? 'pale' : 'cloth', 0.035 * u, (0.30 + i * 0.07) * u, 0.006 * u, (i - 1) * 0.045 * u, -0.14 * u, -0.03 * u).rotation.z = (i - 1) * 0.2;
      break;
    case 6:
      add(back, 'cyl', 'dark', 0.12 * u, 0.035 * u, 0.12 * u, 0, -0.035 * u, -0.05 * u).rotation.x = Math.PI / 2;
      add(back, 'ring', 'metal', 0.095 * u, 0.095 * u, 0.095 * u, 0, -0.035 * u, -0.075 * u);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const tooth = add(back, 'box', 'metal', 0.03 * u, 0.04 * u, 0.04 * u, Math.sin(a) * 0.13 * u, -0.035 * u + Math.cos(a) * 0.13 * u, -0.05 * u);
        tooth.rotation.z = -a;
      }
      break;
    case 7:
      for (let i = 0; i < 4; i++) {
        const spike = add(back, 'oct', i % 2 ? 'metal' : 'pale', 0.024 * u, (0.08 + i * 0.015) * u, 0.025 * u, (i - 1.5) * 0.05 * u, 0.05 * u, -0.03 * u);
        spike.rotation.z = (i - 1.5) * -0.15;
      }
      break;
    default:
      for (const s of [-1, 1]) {
        const blade = add(back, 'box', 'metal', 0.035 * u, 0.46 * u, 0.011 * u, 0, -0.07 * u, -0.045 * u);
        blade.rotation.z = s * 0.55;
      }
  }

  const weapon = group('signature_weapon', 'rhand', M.rh.clone());
  weapon.rotation.set(0.95, -0.15, -0.18);
  const L = (0.42 + (p.ordinal % 5) * 0.018) * u;
  const handle = () => add(weapon, 'cyl', 'dark', 0.012 * u, 0.14 * u, 0.012 * u, 0, 0.015 * u);
  handle();
  switch (p.weapon) {
    case 0: case 7: // long / split sword
      add(weapon, 'box', 'metal', 0.13 * u, 0.018 * u, 0.026 * u, 0, 0.08 * u);
      add(weapon, 'box', 'pale', p.weapon === 7 ? 0.03 * u : 0.045 * u, L, 0.009 * u, 0, 0.08 * u + L / 2);
      add(weapon, 'cone', 'metal', 0.03 * u, 0.08 * u, 0.006 * u, 0, 0.12 * u + L);
      if (p.weapon === 7) add(weapon, 'box', 'metal', 0.018 * u, L * 0.75, 0.009 * u, 0.045 * u, 0.1 * u + L * 0.4);
      break;
    case 1: // staff
      add(weapon, 'cyl', 'dark', 0.013 * u, L * 1.65, 0.013 * u, 0, 0.10 * u);
      add(weapon, 'ring', 'metal', 0.065 * u, 0.065 * u, 0.065 * u, 0, 0.12 * u + L * 0.85);
      add(weapon, 'oct', 'pale', 0.035 * u, 0.055 * u, 0.025 * u, 0, 0.12 * u + L * 0.85);
      break;
    case 2: // crescent axe
      add(weapon, 'cyl', 'dark', 0.016 * u, L * 1.2, 0.016 * u, 0, L * 0.4);
      add(weapon, 'oct', 'metal', 0.13 * u, 0.10 * u, 0.018 * u, 0.055 * u, L * 0.91);
      add(weapon, 'box', 'pale', 0.05 * u, 0.15 * u, 0.022 * u, -0.025 * u, L * 0.91);
      break;
    case 3: // hooked dagger
      add(weapon, 'box', 'metal', 0.028 * u, L * 0.65, 0.010 * u, 0, 0.08 * u + L * 0.32);
      add(weapon, 'arc', 'pale', 0.065 * u, 0.065 * u, 0.025 * u, 0.028 * u, 0.08 * u + L * 0.65).rotation.z = -0.6;
      break;
    case 4: // hammer
      add(weapon, 'cyl', 'dark', 0.015 * u, L * 1.2, 0.015 * u, 0, L * 0.4);
      add(weapon, 'box', 'metal', 0.18 * u, 0.10 * u, 0.095 * u, 0, L * 0.9);
      for (const s of [-1, 1]) add(weapon, 'oct', 'pale', 0.04 * u, 0.065 * u, 0.065 * u, s * 0.10 * u, L * 0.9);
      break;
    case 5: // bow
      add(weapon, 'arc', 'metal', 0.22 * u, 0.22 * u, 0.11 * u, 0, 0.10 * u).rotation.z = -0.72;
      rod(weapon, 'pale', [-0.13 * u, -0.08 * u, 0], [-0.13 * u, 0.28 * u, 0], 0.0025 * u);
      break;
    case 6: // ring blade
      add(weapon, 'ring', 'metal', 0.15 * u, 0.15 * u, 0.15 * u, 0, 0.19 * u);
      for (let i = 0; i < p.crest; i++) {
        const a = i / p.crest * Math.PI * 2;
        add(weapon, 'oct', 'pale', 0.025 * u, 0.04 * u, 0.008 * u, Math.sin(a) * 0.14 * u, 0.19 * u + Math.cos(a) * 0.14 * u).rotation.z = -a;
      }
      break;
    case 8: // ceremonial fan
      add(weapon, 'fan', 'cloth', 0.25 * u, 0.25 * u, 1, 0, 0.07 * u);
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * 0.13 + i / 5 * Math.PI * 0.74;
        rod(weapon, 'metal', [0, 0.07 * u, 0.003 * u], [Math.cos(a) * 0.24 * u, 0.07 * u + Math.sin(a) * 0.24 * u, 0.003 * u], 0.004 * u);
      }
      break;
    default:
      add(weapon, 'cyl', 'dark', 0.012 * u, L * 1.6, 0.012 * u, 0, L * 0.4);
      add(weapon, 'cone', 'metal', 0.05 * u, 0.17 * u, 0.025 * u, 0, L * 1.25);
      add(weapon, 'box', 'cloth', 0.06 * u, 0.13 * u, 0.006 * u, 0.035 * u, L * 1.02);
  }
}

// Keep the same shaped parts, but issue one draw per material on each attachment
// bone instead of one draw for every rivet, braid bead or crown point.
function batchParts(owned, id) {
  for (const group of owned.nodes) {
    const batches = new Map();
    for (const child of group.children) {
      if (!child.isMesh) continue;
      if (!batches.has(child.material)) batches.set(child.material, []);
      batches.get(child.material).push(child);
    }
    for (const [material, children] of batches) {
      if (children.length < 2) continue;
      const pieces = children.map(child => {
        child.updateMatrix();
        const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
        geometry.applyMatrix4(child.matrix);
        return geometry;
      });
      const count = pieces.reduce((n, geometry) => n + geometry.getAttribute('position').count, 0);
      const combined = new THREE.BufferGeometry();
      for (const [name, size] of [['position', 3], ['normal', 3], ['uv', 2]]) {
        const array = new Float32Array(count * size);
        let cursor = 0;
        for (const geometry of pieces) {
          const source = geometry.getAttribute(name);
          const vertices = geometry.getAttribute('position').count;
          if (source) array.set(source.array, cursor * size);
          cursor += vertices;
        }
        combined.setAttribute(name, new THREE.BufferAttribute(array, size));
      }
      combined.computeBoundingBox();
      combined.computeBoundingSphere();
      combined.userData.generatedApparel = id;
      owned.resources.add(combined);
      const mesh = new THREE.Mesh(combined, material);
      mesh.name = `${group.name}_batch`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.appearancePart = true;
      children.forEach(child => group.remove(child));
      group.add(mesh);
      pieces.forEach(geometry => geometry.dispose());
    }
  }
}

/** Mutates only a fresh scene clone. Existing original characters are untouched. */
export function applyCharacterVariant(model, fighter) {
  const p = fighter?.appearance;
  if (!model || !p) return model;
  if (OWN.has(model)) {
    if (model.userData.characterVariant !== p.id) throw new Error('A character model cannot change variant without a fresh clone.');
    return model;
  }
  const owned = { resources: new Set(), nodes: [] };
  OWN.set(model, owned);
  model.updateMatrixWorld(true);
  const bones = bonesOf(model);
  const initial = modelBounds(model);
  reshape(model, p, initial, owned);
  const bodyBounds = modelBounds(model);
  model.userData.characterBodyBounds = { min: bodyBounds.min.toArray(), max: bodyBounds.max.toArray() };
  const M = measure(model, bones, bodyBounds);
  const C = makeContext(model, p, M, bones, owned);
  headwear(C);
  outfit(C);
  backAndWeapon(C);
  batchParts(owned, p.id);
  model.updateMatrixWorld(true);
  for (const node of owned.nodes) {
    const bone = bones[node.userData.appearanceBone];
    if (bone) bone.attach(node);
  }
  model.userData.characterVariant = p.id;
  model.userData.characterVariantSource = p.source;
  model.userData.variantPortraitLocal = [M.hd.x, M.head.y + 0.01 * M.h, M.hd.z];
  model.userData.variantPortraitHeight = M.h * 0.42;
  model.updateMatrixWorld(true);
  return model;
}

/** Bind-pose body bounds for initial height and ground alignment, without added apparel. */
export function getCharacterBodyBounds(model) {
  model.updateMatrixWorld(true);
  const bounds = model.userData.characterBodyBounds;
  if (!bounds) return new THREE.Box3().setFromObject(model);
  return new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max)).applyMatrix4(model.matrixWorld);
}

/** World-space upper-body framing used to capture the actual in-game appearance. */
export function getCharacterPortraitFrame(model) {
  model.updateMatrixWorld(true);
  if (model.userData.variantPortraitLocal) {
    const scale = model.getWorldScale(new THREE.Vector3());
    const head = bonesOf(model).head;
    const target = head ? head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, model.userData.variantPortraitHeight * Math.abs(scale.y) / 42, 0)) : model.localToWorld(new THREE.Vector3(...model.userData.variantPortraitLocal));
    const headwear = model.getObjectByName(`appearance_${model.userData.characterVariant}_head`);
    const top = headwear ? new THREE.Box3().setFromObject(headwear).max.y : target.y;
    const height = model.userData.variantPortraitHeight * Math.abs(scale.y);
    // Keep a close bust crop: move it slightly upward for a crest instead of
    // zooming out until the face becomes a tiny part of the selection image.
    target.y = Math.max(target.y, top - height * 0.46);
    return { target, height };
  }
  const box = new THREE.Box3().setFromObject(model);
  const h = box.max.y - box.min.y;
  const head = bonesOf(model).head;
  const target = head ? head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, h * 0.01, 0)) : new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y + h * 0.85, (box.min.z + box.max.z) / 2);
  return { target, height: h * 0.42 };
}

/** Releases only generated resources; the cached source GLB remains reusable. */
export function disposeCharacterVariant(root) {
  if (!root) return;
  const models = [];
  root.traverse(o => { if (OWN.has(o)) models.push(o); });
  for (const model of models) {
    const owned = OWN.get(model);
    model.traverse(o => {
      for (const material of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (material?.userData.appearanceId === model.userData.characterVariant) owned.resources.add(material);
      }
    });
    for (const node of owned.nodes) node.removeFromParent();
    for (const resource of owned.resources) resource.dispose();
    OWN.delete(model);
  }
}
