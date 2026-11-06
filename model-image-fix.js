/**
 * Isolate images packed as GLB bufferViews without creating any blob: URL.
 * The geometry-only GLB preserves the original binary chunk, nodes, skins,
 * quantized vertices and animations byte-for-byte.
 * This module intentionally has no THREE/browser imports so it is testable.
 */
const GLTF_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const codec = new TextEncoder();

export function separateEmbeddedTextures(input, json) {
  const view = new DataView(input);
  if (input.byteLength < 28 || view.getUint32(0, true) !== GLTF_MAGIC || view.getUint32(4, true) !== 2) {
    throw new Error('GLB 2.0ファイルではありません');
  }
  let binStart = -1;
  let binSize = 0;
  let cursor = 12;
  while (cursor + 8 <= input.byteLength) {
    const length = view.getUint32(cursor, true);
    const type = view.getUint32(cursor + 4, true);
    if (cursor + 8 + length > input.byteLength) throw new Error('GLBチャンクのサイズが不正です');
    if (type === BIN_CHUNK) { binStart = cursor + 8; binSize = length; break; }
    cursor += 8 + length;
  }
  if (binStart < 0) throw new Error('GLBバイナリチャンクがありません');

  const images = (json.images || []).map((image, index) => {
    if (!Number.isInteger(image.bufferView) || !/^image\//.test(image.mimeType || '')) {
      throw new Error(`内蔵画像${index + 1}の形式を認識できません`);
    }
    const entry = json.bufferViews?.[image.bufferView];
    if (!entry || entry.buffer !== 0) throw new Error(`内蔵画像${index + 1}のbufferViewが不正です`);
    const start = entry.byteOffset || 0;
    const length = entry.byteLength;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || length <= 0 || start + length > binSize) {
      throw new Error(`内蔵画像${index + 1}がバイナリ範囲外です`);
    }
    return { bytes: new Uint8Array(input, binStart + start, length).slice(), mime: image.mimeType };
  });
  const textures = (json.textures || []).map((texture, i) => {
    const source = texture.extensions?.EXT_texture_webp?.source ?? texture.source;
    if (!Number.isInteger(source) || !images[source]) throw new Error(`画像参照${i + 1}が不正です`);
    return { source, sampler: texture.sampler };
  });
  const samplers = json.samplers || [];
  const materials = (json.materials || []).map((mat) => {
    const pbr = mat.pbrMetallicRoughness || {};
    const idx = (o) => Number.isInteger(o?.index) ? o.index : null;
    return {
      baseColor: idx(pbr.baseColorTexture),
      metalRough: idx(pbr.metallicRoughnessTexture),
      normal: idx(mat.normalTexture),
      occlusion: idx(mat.occlusionTexture),
      emissive: idx(mat.emissiveTexture),
      normalScale: mat.normalTexture?.scale ?? 1,
      occlusionStrength: mat.occlusionTexture?.strength ?? 1
    };
  });
  // GLTFLoader must never receive any texture references: it would turn a
  // bufferView into an object URL and then call fetch(blob:...), which the
  // deployment's CSP blocks. Decode directly from the bytes above instead.
  const stripped = JSON.parse(JSON.stringify(json));
  for (const mat of stripped.materials || []) {
    if (mat.pbrMetallicRoughness) {
      delete mat.pbrMetallicRoughness.baseColorTexture;
      delete mat.pbrMetallicRoughness.metallicRoughnessTexture;
    }
    delete mat.normalTexture;
    delete mat.occlusionTexture;
    delete mat.emissiveTexture;
  }
  delete stripped.images;
  delete stripped.textures;
  delete stripped.samplers;
  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    if (Array.isArray(stripped[key])) stripped[key] = stripped[key].filter((s) => s !== 'EXT_texture_webp');
  }
  const jsonBytes = codec.encode(JSON.stringify(stripped));
  const jsonLength = Math.ceil(jsonBytes.length / 4) * 4;
  const totalLength = 12 + 8 + jsonLength + 8 + binSize;
  const output = new ArrayBuffer(totalLength);
  const out = new DataView(output);
  out.setUint32(0, GLTF_MAGIC, true);
  out.setUint32(4, 2, true);
  out.setUint32(8, totalLength, true);
  out.setUint32(12, jsonLength, true);
  out.setUint32(16, JSON_CHUNK, true);
  const payload = new Uint8Array(output);
  payload.set(jsonBytes, 20);
  payload.fill(0x20, 20 + jsonBytes.length, 20 + jsonLength);
  const binHeader = 20 + jsonLength;
  out.setUint32(binHeader, binSize, true);
  out.setUint32(binHeader + 4, BIN_CHUNK, true);
  payload.set(new Uint8Array(input, binStart, binSize), binHeader + 8);
  return { glb: output, images, textures, samplers, materials };
}
