/** Visuals of the chief-only character's 30-second null-element super armor.
 * Damage reduction and stagger immunity are applied by game.js, not here.
 * This module creates no gameplay authority and does not alter the source GLB.
 */
import * as THREE from 'three';

export function createNullGuardAura(f) {
  if (!f || f.nullGuardAura) return;
  const h = Math.max(1.8, (f.def?.height || 3.9) * (f.scale || 1));
  const aura = new THREE.Group();
  aura.name = 'Valdarion-NullGuard-30sec';
  const mats = [], geos = [];
  const colors = [0xffffff, 0xc7b4ff, 0xe8f3ff, 0xffe9aa];
  const pCount = 110;
  const xyz = new Float32Array(pCount * 3), cc = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const radius = (0.22 + Math.random() * 0.55) * h;
    xyz[i * 3] = Math.cos(a) * radius;
    xyz[i * 3 + 1] = h * (0.05 + Math.random() * 0.92);
    xyz[i * 3 + 2] = Math.sin(a) * radius;
    const c = new THREE.Color(colors[i % colors.length]);
    cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(xyz, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  const particleMat = new THREE.PointsMaterial({ size: Math.max(.085, h * .034),
    vertexColors: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: .9, sizeAttenuation: true });
  const pts = new THREE.Points(particleGeo, particleMat);
  mats.push(particleMat);geos.push(particleGeo);aura.add(pts);
  for (let j = 0; j < 2; j++) {
    const g = new THREE.TorusGeometry(h * (.33 + j * .065), h * .009, 8, 72);
    const m = new THREE.MeshBasicMaterial({color: j ? 0xffffff : 0xb897ff,
      transparent: true, opacity: .62, depthWrite: false, blending: THREE.AdditiveBlending});
    const ring = new THREE.Mesh(g, m);
    ring.position.y = h * (.47 + j * .15);
    ring.rotation.x = j ? .9 : Math.PI / 2;
    aura.add(ring);mats.push(m);geos.push(g);
  }
  (f.visual || f.root).add(aura);
  f.nullGuardAura = {group: aura, pts, mats, geos, time: 0};
}
export function tickNullGuardAura(f, dt) {
  const v = f?.nullGuardAura;
  if (!v) return;
  v.time += dt;
  v.group.rotation.y += dt * 0.8;
  v.group.children.forEach((child, i) => {
    if (child.isMesh) child.rotation.z += (i % 2 ? -1 : 1) * dt * .8;
  });
  v.pts.material.opacity = .65 + .3 * Math.abs(Math.sin(v.time * 6));
}
export function disposeNullGuardAura(f) {
  const v = f?.nullGuardAura;
  if (!v) return;
  v.group.removeFromParent();
  for (const g of v.geos) g.dispose();
  for (const m of v.mats) m.dispose();
  f.nullGuardAura = null;
}
