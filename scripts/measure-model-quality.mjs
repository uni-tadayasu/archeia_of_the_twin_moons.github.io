/** Offline measurement of the shipped GLBs and the real runtime quality helper.
 * No browser, rendering, network request, source-model mutation or upload occurs.
 * Usage: node scripts/measure-model-quality.mjs [--json] [assets/models/model.glb ...]
 */
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, basename } from 'node:path';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import * as THREE from '../assets/vendor/three/three.module.min.js';
import { CharacterGeometryCache, geometryCounts } from '../assets/celestial-model-quality.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaults = ['hero-swordsman', 'mage-weaver', 'brute-axe', 'shinobi-twin', 'old-knight', 'alchemist-boy', 'ranger-archer', 'dark-mercenary', 'bell-priestess', 'wolf-warrior', 'monk-brawler', 'dragoon-lancer', 'clockwork-puppeteer', 'verdict-maiden-v2', 'uninomiya'];
const args = process.argv.slice(2);
const requested = args.filter(value => value !== '--json');
const files = requested.length ? requested : defaults.map(name => `assets/models/${name}.glb`);
const types = {
  5120: [Int8Array, 'DT_INT8'], 5121: [Uint8Array, 'DT_UINT8'],
  5122: [Int16Array, 'DT_INT16'], 5123: [Uint16Array, 'DT_UINT16'],
  5125: [Uint32Array, 'DT_UINT32'], 5126: [Float32Array, 'DT_FLOAT32'],
};
const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const semantics = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight', COLOR_0: 'color', TANGENT: 'tangent' };
const decoderDirectory = resolve(root, 'assets/vendor/draco');
const module = { exports: {} };
const context = { require: createRequire(import.meta.url), module, exports: module.exports, process,
  __dirname: decoderDirectory, WebAssembly, TextDecoder, console, Buffer, setTimeout, clearTimeout };
vm.runInNewContext(await readFile(resolve(decoderDirectory, 'draco_wasm_wrapper.js'), 'utf8'), context);
const draco = await module.exports({ wasmBinary: await readFile(resolve(decoderDirectory, 'draco_decoder.wasm')) });

function parseGLB(buffer) {
  if (buffer.readUInt32LE(0) !== 0x46546c67 || buffer.readUInt32LE(4) !== 2) throw new Error('Expected a GLB v2');
  let json, binary;
  for (let offset = 12; offset < buffer.length;) {
    const length = buffer.readUInt32LE(offset), type = buffer.readUInt32LE(offset + 4);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    if (type === 0x004e4942) binary = chunk;
    offset += 8 + length;
  }
  if (!json || !binary) throw new Error('GLB JSON or binary chunk missing');
  return { json, binary };
}
function rawAttribute(json, binary, index) {
  const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView];
  if (accessor.sparse || !view || view.extensions?.EXT_meshopt_compression) throw new Error('This measurement requires a raw or Draco attribute');
  const [Type] = types[accessor.componentType] || [];
  const itemSize = sizes[accessor.type];
  if (!Type || !itemSize) throw new Error(`Unsupported accessor type: ${accessor.componentType}/${accessor.type}`);
  const output = new Type(accessor.count * itemSize);
  const stride = view.byteStride || Type.BYTES_PER_ELEMENT * itemSize;
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  for (let i = 0; i < accessor.count; i++) {
    const bytes = binary.subarray(start + i * stride, start + i * stride + Type.BYTES_PER_ELEMENT * itemSize);
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    output.set(new Type(copy), i * itemSize);
  }
  return new THREE.BufferAttribute(output, itemSize, Boolean(accessor.normalized));
}
function decodePrimitive(json, binary, primitive) {
  if (primitive.mode !== undefined && primitive.mode !== 4) throw new Error('Only triangle primitives are measured');
  const geometry = new THREE.BufferGeometry();
  const extension = primitive.extensions?.KHR_draco_mesh_compression;
  if (!extension) {
    for (const [semantic, index] of Object.entries(primitive.attributes)) geometry.setAttribute(semantics[semantic] || semantic.toLowerCase(), rawAttribute(json, binary, index));
    if (primitive.indices !== undefined) geometry.setIndex(rawAttribute(json, binary, primitive.indices));
    return geometry;
  }
  const view = json.bufferViews[extension.bufferView];
  const bytes = new Int8Array(binary.buffer, binary.byteOffset + (view.byteOffset || 0), view.byteLength);
  const decoder = new draco.Decoder(), mesh = new draco.Mesh();
  try {
    const status = decoder.DecodeArrayToMesh(bytes, bytes.byteLength, mesh);
    if (!status.ok() || !mesh.ptr) throw new Error(`Draco decode failed: ${status.error_msg()}`);
    for (const [semantic, accessorIndex] of Object.entries(primitive.attributes)) {
      if (extension.attributes[semantic] === undefined) {
        geometry.setAttribute(semantics[semantic] || semantic.toLowerCase(), rawAttribute(json, binary, accessorIndex));
        continue;
      }
      const accessor = json.accessors[accessorIndex];
      const [Type, dracoType] = types[accessor.componentType] || [];
      if (!Type) throw new Error(`Unsupported Draco accessor component ${accessor.componentType}`);
      const attribute = decoder.GetAttributeByUniqueId(mesh, extension.attributes[semantic]);
      const count = mesh.num_points(), itemSize = attribute.num_components();
      if (count !== accessor.count || itemSize !== sizes[accessor.type]) throw new Error(`Accessor mismatch: ${semantic}`);
      const length = count * itemSize, byteLength = length * Type.BYTES_PER_ELEMENT;
      const ptr = draco._malloc(byteLength);
      try {
        decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, draco[dracoType], byteLength, ptr);
        const array = new Type(draco.HEAPF32.buffer, ptr, length).slice();
        geometry.setAttribute(semantics[semantic] || semantic.toLowerCase(), new THREE.BufferAttribute(array, itemSize, Boolean(accessor.normalized)));
      } finally { draco._free(ptr); }
    }
    const count = mesh.num_faces() * 3, byteLength = count * Uint32Array.BYTES_PER_ELEMENT;
    const ptr = draco._malloc(byteLength);
    try {
      decoder.GetTrianglesUInt32Array(mesh, byteLength, ptr);
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(draco.HEAPF32.buffer, ptr, count).slice(), 1));
    } finally { draco._free(ptr); }
    for (const target of primitive.targets || []) {
      for (const [semantic, index] of Object.entries(target)) {
        const name = semantics[semantic] || semantic.toLowerCase();
        (geometry.morphAttributes[name] ||= []).push(rawAttribute(json, binary, index));
      }
      geometry.morphTargetsRelative = true;
    }
    return geometry;
  } finally { draco.destroy(mesh); draco.destroy(decoder); }
}
const totals = parts => parts.reduce((sum, part) => ({ vertices: sum.vertices + part.vertices, triangles: sum.triangles + part.triangles }), { vertices: 0, triangles: 0 });
const results = [];
for (const file of files) {
  const start = performance.now();
  const { json, binary } = parseGLB(await readFile(resolve(root, file)));
  const geometries = (json.meshes || []).flatMap(mesh => mesh.primitives.map(primitive => decodePrimitive(json, binary, primitive)));
  const source = totals(geometries.map(geometryCounts));
  const result = { file: basename(file), primitives: geometries.length, source };
  for (const tier of ['high', 'ultra']) {
    const tierStart = performance.now(), cache = new CharacterGeometryCache();
    const leases = geometries.map(geometry => cache.acquire(geometry, tier));
    result[tier] = { ...totals(leases.map(lease => geometryCounts(lease.geometry))), milliseconds: Math.round(performance.now() - tierStart), cacheBytes: cache.report().bytes, passes: leases.map(lease => lease.stats.passes), reasons: [...new Set(leases.map(lease => lease.stats.reason).filter(Boolean))] };
    leases.forEach(lease => lease.release()); cache.clearUnused();
  }
  geometries.forEach(geometry => geometry.dispose());
  result.totalMilliseconds = Math.round(performance.now() - start);
  results.push(result);
  if (!args.includes('--json')) console.log(`${result.file.padEnd(29)} vertices ${String(source.vertices).padStart(7)} → ${String(result.high.vertices).padStart(7)} → ${String(result.ultra.vertices).padStart(7)}  triangles ${String(source.triangles).padStart(7)} → ${String(result.high.triangles).padStart(7)} → ${String(result.ultra.triangles).padStart(7)}  ${result.totalMilliseconds}ms`);
}
if (args.includes('--json')) console.log(JSON.stringify({ measuredAt: new Date().toISOString(), method: 'Local Draco decoding and actual CharacterGeometryCache acquisition; source/high/ultra. Each file is measured independently, counting unique GLB primitives, not spawned instances or shared-source appearance variants.', models: results }, null, 2));
