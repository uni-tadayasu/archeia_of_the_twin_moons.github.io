/* Curved, seam-preserving tessellation of the shipped character meshes.
 * Source vertices, painted UVs, bones and morph targets remain authoritative.
 * No model or texture is generated/replaced by this quality setting. */
import * as THREE from './vendor/three/three.module.min.js';

export const MODEL_QUALITY = Object.freeze({
  low: Object.freeze({ passes: 0, triangleLimit: 0 }),
  standard: Object.freeze({ passes: 0, triangleLimit: 0 }),
  high: Object.freeze({ passes: 1, triangleLimit: 90000 }),
  ultra: Object.freeze({ passes: 2, triangleLimit: 300000 }),
});
export const normalizeModelQuality = value => Object.hasOwn(MODEL_QUALITY, value) ? value : 'high';
export function geometryCounts(geometry) {
  return { vertices: geometry?.attributes?.position?.count || 0,
    triangles: Math.floor((geometry?.index?.count ?? geometry?.attributes?.position?.count ?? 0) / 3) };
}
function component(attribute, i, c) {
  return attribute.getComponent ? attribute.getComponent(i, c) : [attribute.getX, attribute.getY, attribute.getZ, attribute.getW][c].call(attribute, i);
}
function bytesOf(geometry) {
  const arrays = new Set();
  for (const attr of [...Object.values(geometry.attributes), ...Object.values(geometry.morphAttributes).flat(), geometry.index]) {
    if (attr) arrays.add(attr.isInterleavedBufferAttribute ? attr.data.array : attr.array);
  }
  return [...arrays].reduce((sum, array) => sum + array.byteLength, 0);
}
function normalized3(array, offset) {
  const length = Math.hypot(array[offset], array[offset + 1], array[offset + 2]);
  if (length > 1e-12) for (let c = 0; c < 3; c++) array[offset + c] /= length;
}

/** One four-way pass. Only NEW edge vertices move, by at most 6% of that edge.
 * UV seams remain separate vertices. A canonical position is used solely for
 * the shared curved edge position, preventing cracks without welding UVs. */
export function subdivideCharacterGeometry(source, { curvature = .34, triangleLimit = 300000 } = {}) {
  const position = source?.attributes?.position;
  const { vertices, triangles } = geometryCounts(source);
  if (!position || !vertices || !triangles || triangles * 4 > triangleLimit) return null;
  if ((source.index?.count ?? vertices) % 3) return null;
  for (const attr of Object.values(source.attributes)) {
    if (attr.count !== vertices || attr.itemSize > 4) return null;
  }
  for (const list of Object.values(source.morphAttributes)) for (const attr of list) {
    if (attr.count !== vertices || attr.itemSize > 4) return null;
  }
  if ((source.attributes.skinIndex || source.attributes.skinWeight) &&
      (source.attributes.skinIndex?.itemSize !== 4 || source.attributes.skinWeight?.itemSize !== 4)) return null;
  const normal = source.attributes.normal;
  // A position seam with contradictory normals is an intentional crease.
  // Keep its shared midpoint exactly linear rather than rounding armor edges.
  const canonical = new Uint32Array(vertices), sites = [], siteMap = new Map();
  let extent = 0;
  for (let i = 0; i < vertices; i++) for (let c = 0; c < 3; c++) extent = Math.max(extent, Math.abs(component(position, i, c)));
  const epsilon = Math.max(1e-8, extent * 1e-7);
  for (let i = 0; i < vertices; i++) {
    const p = [position.getX(i), position.getY(i), position.getZ(i)];
    if (!p.every(Number.isFinite)) throw new Error('Character geometry contains a non-finite position');
    const key = p.map(value => Math.round(value / epsilon)).join(',');
    const n = normal ? [normal.getX(i), normal.getY(i), normal.getZ(i)] : [0, 0, 0];
    const nl = Math.hypot(...n); if (nl) for (let c = 0; c < 3; c++) n[c] /= nl;
    let id = siteMap.get(key);
    if (id === undefined) { id = sites.length; siteMap.set(key, id); sites.push({ p, n, crease: !nl }); }
    else {
      const site = sites[id];
      if (site.n.reduce((sum, value, c) => sum + value * n[c], 0) < .92) site.crease = true;
    }
    canonical[i] = id;
  }
  const edges = [], edgeMap = new Map(), outIndex = new Uint32Array(triangles * 12);
  const edge = (a, b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    let id = edgeMap.get(key);
    if (id === undefined) { id = vertices + edges.length; edgeMap.set(key, id); edges.push([a, b]); }
    return id;
  };
  const index = i => source.index ? source.index.getX(i) : i;
  for (let face = 0; face < triangles; face++) {
    const a = index(face * 3), b = index(face * 3 + 1), c = index(face * 3 + 2);
    if (![a, b, c].every(i => Number.isInteger(i) && i >= 0 && i < vertices)) throw new Error('Character geometry index is out of range');
    const ab = edge(a, b), bc = edge(b, c), ca = edge(c, a);
    outIndex.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], face * 12);
  }
  const count = vertices + edges.length, result = new THREE.BufferGeometry();
  const curvedEdges = new Map();
  function curvedPosition(a, b) {
    const ia = canonical[a], ib = canonical[b], key = ia < ib ? `${ia}:${ib}` : `${ib}:${ia}`;
    if (curvedEdges.has(key)) return curvedEdges.get(key);
    const A = sites[ia], B = sites[ib], mid = A.p.map((value, c) => (value + B.p[c]) * .5);
    const span = A.p.map((value, c) => B.p[c] - value), length = Math.hypot(...span);
    const agreement = A.n.reduce((sum, value, c) => sum + value * B.n[c], 0);
    if (!A.crease && !B.crease && agreement > .5 && length > epsilon) {
      const da = span.reduce((sum, value, c) => sum + value * A.n[c], 0) * .5;
      const db = span.reduce((sum, value, c) => sum - value * B.n[c], 0) * .5;
      const shift = A.n.map((value, c) => -.5 * curvature * (value * da + B.n[c] * db));
      const scale = Math.min(1, length * .06 / Math.max(1e-12, Math.hypot(...shift)));
      for (let c = 0; c < 3; c++) mid[c] += shift[c] * scale;
    }
    curvedEdges.set(key, mid); return mid;
  }
  const interpolate = (name, attr, morph = false) => {
    const size = attr.itemSize;
    const array = name === 'skinIndex' ? new (attr.array?.BYTES_PER_ELEMENT === 4 ? Uint32Array : Uint16Array)(count * size) : new Float32Array(count * size);
    for (let i = 0; i < vertices; i++) for (let c = 0; c < size; c++) array[i * size + c] = component(attr, i, c);
    for (let j = 0; j < edges.length; j++) {
      const [a, b] = edges[j], at = (vertices + j) * size;
      for (let c = 0; c < size; c++) array[at + c] = (component(attr, a, c) + component(attr, b, c)) * .5;
      if (name === 'position' && !morph) array.set(curvedPosition(a, b), at);
      if (name === 'normal' && (!morph || !source.morphTargetsRelative)) normalized3(array, at);
      if (name === 'tangent') {
        normalized3(array, at);
        if (size === 4) array[at + 3] = component(attr, a, 3) < 0 ? -1 : 1;
      }
      // Absolute morphs share the base curvature offset; relative morph deltas
      // remain deltas. Original endpoint values are never altered.
      if (name === 'position' && morph && !source.morphTargetsRelative) {
        const curved = curvedPosition(a, b);
        for (let c = 0; c < 3; c++) array[at + c] += curved[c] - (component(position, a, c) + component(position, b, c)) * .5;
      }
    }
    return new THREE.BufferAttribute(array, size, false);
  };
  for (const [name, attr] of Object.entries(source.attributes)) result.setAttribute(name, interpolate(name, attr));
  const skinIndex = source.attributes.skinIndex, skinWeight = source.attributes.skinWeight;
  if (skinIndex && skinWeight) {
    const outBones = result.attributes.skinIndex.array, outWeights = result.attributes.skinWeight.array;
    for (let j = 0; j < edges.length; j++) {
      const weights = new Map(), [a, b] = edges[j], at = (vertices + j) * 4;
      for (const i of [a, b]) for (let c = 0; c < 4; c++) {
        const bone = component(skinIndex, i, c), weight = component(skinWeight, i, c) * .5;
        if (weight > 0) weights.set(bone, (weights.get(bone) || 0) + weight);
      }
      const strongest = [...weights].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4);
      const total = strongest.reduce((sum, pair) => sum + pair[1], 0);
      for (let c = 0; c < 4; c++) { outBones[at + c] = strongest[c]?.[0] || 0; outWeights[at + c] = total > 0 ? (strongest[c]?.[1] || 0) / total : +(c === 0); }
    }
  }
  for (const [name, attrs] of Object.entries(source.morphAttributes)) result.morphAttributes[name] = attrs.map(attr => interpolate(name, attr, true));
  result.morphTargetsRelative = source.morphTargetsRelative;
  result.setIndex(new THREE.BufferAttribute(count <= 65535 ? new Uint16Array(outIndex) : outIndex, 1));
  for (const group of source.groups) result.addGroup(group.start * 4, group.count * 4, group.materialIndex);
  result.setDrawRange(source.drawRange.start * 4, source.drawRange.count * 4);
  result.name = `${source.name || 'character'} · curved subdivision`;
  result.userData = { ...source.userData, celestialSubdivision: true };
  result.computeBoundingBox(); result.computeBoundingSphere();
  return result;
}

/** Refcounted derivatives only: source GLB/appearance geometry is never disposed. */
export class CharacterGeometryCache {
  constructor({ maxBytes = 96 * 1024 * 1024, maxEntries = 32 } = {}) {
    this.maxBytes = Math.max(0, maxBytes); this.maxEntries = Math.max(0, maxEntries);
    this.entries = new Map(); this.bytes = 0; this.clock = 0;
  }
  prune(required = 0, reserve = 0) {
    const unused = [...this.entries.values()].filter(entry => entry.refs === 0).sort((a, b) => a.used - b.used);
    while ((this.bytes + required > this.maxBytes || this.entries.size + reserve > this.maxEntries) && unused.length) {
      const entry = unused.shift(); this.entries.delete(entry.key); this.bytes -= entry.bytes; entry.geometry.dispose();
    }
  }
  acquire(source, requested = 'high') {
    const tier = normalizeModelQuality(requested), policy = MODEL_QUALITY[tier], original = geometryCounts(source);
    let passes = policy.passes;
    while (passes && original.triangles * 4 ** passes > policy.triangleLimit) passes--;
    const originalLease = reason => ({ geometry: source, stats: { tier, passes: 0, originalVertices: original.vertices, originalTriangles: original.triangles, ...original, reason }, release() {} });
    if (!passes || original.triangles > 45000 || !this.maxEntries) return originalLease(passes ? 'authored-density' : 'quality-or-density-limit');
    const key = `${source.uuid}:${passes}`;
    let entry = this.entries.get(key);
    if (!entry) {
      // Upper bound before allocating: at most three new vertices per triangle.
      let vertices = original.vertices, triangles = original.triangles;
      const stride = Object.values(source.attributes).reduce((sum, attr) => sum + attr.itemSize * 4, 0)
        + Object.values(source.morphAttributes).flat().reduce((sum, attr) => sum + attr.itemSize * 4, 0);
      for (let i = 0; i < passes; i++) { vertices += triangles * 3; triangles *= 4; }
      const estimate = vertices * stride + triangles * 12;
      this.prune(estimate, 1);
      if (this.bytes + estimate > this.maxBytes || this.entries.size >= this.maxEntries) return passes > 1 ? this.acquire(source, 'high') : originalLease('memory-budget');
      let geometry = source;
      for (let i = 0; i < passes; i++) {
        const next = subdivideCharacterGeometry(geometry, { curvature: i ? .22 : .34, triangleLimit: policy.triangleLimit });
        if (geometry !== source) geometry.dispose();
        if (!next) return originalLease('unsupported-attributes');
        geometry = next;
      }
      entry = { key, geometry, refs: 0, used: ++this.clock, bytes: bytesOf(geometry), tier,
        passes, originalVertices: original.vertices, originalTriangles: original.triangles, ...geometryCounts(geometry) };
      this.entries.set(key, entry); this.bytes += entry.bytes;
    }
    entry.refs++; entry.used = ++this.clock;
    let released = false;
    return { geometry: entry.geometry, stats: this.describe(entry, tier), release: () => {
      if (released) return; released = true; entry.refs--; entry.used = ++this.clock; this.prune();
    } };
  }
  describe(entry, tier = entry.tier) {
    const { passes, originalVertices, originalTriangles, vertices, triangles, refs, bytes } = entry;
    return { tier, passes, originalVertices, originalTriangles, vertices, triangles, refs, bytes };
  }
  report() { return { bytes: this.bytes, maxBytes: this.maxBytes, maxEntries: this.maxEntries, geometries: [...this.entries.values()].map(entry => this.describe(entry)) }; }
  clearUnused() {
    for (const [key, entry] of this.entries) if (!entry.refs) { entry.geometry.dispose(); this.bytes -= entry.bytes; this.entries.delete(key); }
  }
}

const shared = new CharacterGeometryCache();
const active = new Set();
const instanceRecords = new WeakMap();
let currentQuality = 'high';
function updateInstance(record) {
  if (record.disposed) return;
  if (record.tier === currentQuality && record.parts.every(part => part.lease && part.node.geometry === part.lease.geometry)) return;
  for (const part of record.parts) {
    // Deferred first acquisition observes synchronous appearance reshaping.
    if (!part.lease) part.source = part.node.geometry;
    else if (part.node.geometry !== part.lease.geometry) { part.lease.release(); part.source = part.node.geometry; }
    else { part.node.geometry = part.source; part.lease.release(); }
    part.lease = shared.acquire(part.source, currentQuality);
    part.node.geometry = part.lease.geometry;
    if (part.node.isSkinnedMesh) { part.node.boundingBox = null; part.node.boundingSphere = null; }
  }
  record.instance.wrapper.userData.celestialQuality = {
    tier: currentQuality, pending: false, parts: record.parts.map(part => ({ name: part.node.name, skinned: !!part.node.isSkinnedMesh, ...part.lease.stats })),
  };
  record.tier = currentQuality;
}
export function trackModelQuality(instance) {
  const parts = [];
  instance.model.traverse(node => { if (node.isMesh && node.geometry?.attributes?.position) parts.push({ node, source: node.geometry, lease: null }); });
  const record = { instance, parts, disposed: false };
  active.add(record);
  instanceRecords.set(instance, record);
  instance.wrapper.userData.celestialQuality = { tier: currentQuality, pending: true, parts: [] };
  queueMicrotask(() => { if (!record.disposed) updateInstance(record); });
  return () => {
    if (record.disposed) return; record.disposed = true; active.delete(record); instanceRecords.delete(instance);
    for (const part of parts) {
      if (part.lease && part.node.geometry === part.lease.geometry) part.node.geometry = part.source;
      part.lease?.release();
    }
    // Appearance source meshes belong to the disposed instance, so their
    // derivatives should not occupy the reusable GLB cache after a mode exit.
    shared.clearUnused();
  };
}
// Portraits draw synchronously. Call this only after optional appearance edits.
export function finalizeModelQuality(instance) {
  const record = instanceRecords.get(instance);
  if (record) updateInstance(record);
}
export function setModelQuality(value) {
  const tier = normalizeModelQuality(value);
  if (tier === currentQuality) return;
  currentQuality = tier;
  for (const record of active) updateInstance(record);
  shared.clearUnused();
}
export function modelQualityReport() {
  const instances = [...active].map(record => {
    const state = record.instance.wrapper.userData.celestialQuality;
    const counts = { baseTriangles: 0, renderTriangles: 0, baseVertices: 0, renderVertices: 0, skinnedMeshes: 0 };
    for (const part of record.parts) {
      const base = geometryCounts(part.source), current = geometryCounts(part.node.geometry);
      counts.baseTriangles += base.triangles; counts.renderTriangles += current.triangles;
      counts.baseVertices += base.vertices; counts.renderVertices += current.vertices;
      counts.skinnedMeshes += +!!part.node.isSkinnedMesh;
    }
    return { name: record.instance.model.name, ...state, ...counts };
  });
  const totals = { baseTriangles: 0, renderTriangles: 0, baseVertices: 0, renderVertices: 0, skinnedMeshes: 0 };
  for (const item of instances) for (const key of Object.keys(totals)) totals[key] += item[key];
  return { tier: currentQuality, activeInstances: active.size, cachedGeometries: shared.entries.size, ...totals, ...shared.report(), instances };
}
