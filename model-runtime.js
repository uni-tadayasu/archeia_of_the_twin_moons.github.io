import { attachTenshiRig } from './assets/tenshi-motion.js?v=55.23';
// RF_NEPT_V14_MODEL
// RF_ULTRA_V12_MODEL
// RF_GRAND_FOUR_20261108 model-runtime.js
// Arkeia: one glTF pipeline for fighters, field actors and summons.
// No replacement geometry is created when a file fails to load.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { separateEmbeddedTextures } from './model-image-fix.js?v=model-fetch-v20261107';
import { getModelBytes, modelURLCandidates } from './model-transport.js?v=rf-mobile-v7-20261109';

const cache = new Map();
// Imported GLB geometry bounds are invariant between clones. Compute precisely once per scene.
const rfV12Bounds = new WeakMap();
const pending = new Map();
const errors = new Map();
const queue = [];
let active = 0;
let decoderPromise = null;
let meshoptPromise = null;
const BASE = new URL('./', (typeof document !== 'undefined' && document.baseURI) || import.meta.url);
export const MODEL_VERSION = 'valgard-exact-20261107';

export class ModelLoadError extends Error {
  constructor(url, detail, cause) {
    super(`${String(url).split('/').pop().split('?')[0]}: ${detail}`, { cause });
    this.name = 'ModelLoadError'; this.url = String(url);
  }
}
function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('arkeia:models'));
}
function schedule(task) {
  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject }); pump();
  });
}
function pump() {
  while (active < ((typeof matchMedia==='function' && matchMedia('(pointer:coarse)').matches) ? 1 : 2) && queue.length) {
    const job = queue.shift(); active++;
    Promise.resolve().then(job.task).then(job.resolve, job.reject).finally(() => { active--; pump(); });
  }
}
function absolute(url) { return modelURLCandidates(url, import.meta.url)[0]; }
function deadline(promise, ms, label) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}（${ms / 1000}秒）`)), ms);
  })]).finally(() => clearTimeout(timer));
}
async function fetchBytes(url) {
  // Resolve against the page URL; module URLs from Rosebud/online editors may
  // be blob: or an external CDN and do not identify the public models directory.
  return getModelBytes(url, import.meta.url);
}
function documentOf(buffer) {
  const data = new DataView(buffer);
  if (buffer.byteLength >= 20 && data.getUint32(0, true) === 0x46546c67) {
    if (data.getUint32(4, true) !== 2 || data.getUint32(8, true) !== buffer.byteLength) {
      throw new Error('GLBの長さまたはバージョンが不正です');
    }
    const size = data.getUint32(12, true);
    if (20 + size > buffer.byteLength || data.getUint32(16, true) !== 0x4e4f534a) throw new Error('GLBのJSONチャンクが不正です');
    return { doc: JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, size))), payload: buffer };
  }
  const text = new TextDecoder().decode(buffer).trim();
  if (text.startsWith('<')) throw new Error('モデルではなくHTMLが返りました。ファイルの場所・公開設定を確認してください');
  return { doc: JSON.parse(text), payload: text };
}
async function getDraco() {
  if (!decoderPromise) decoderPromise = (async () => {
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    // The exported site does not contain assets/vendor/draco/; probing it
    // causes 404, then the CDN used to fail because CSP blocked connect-src.
    // Use the official version-pinned JavaScript decoder directly. index.html
    // permits www.gstatic.com only as a fetch destination (not unsafe-eval).
    const decoderPath = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
    return new DRACOLoader().setDecoderPath(decoderPath).setDecoderConfig({ type: 'js' }).setWorkerLimit(2);
  })().catch((error) => { decoderPromise = null; throw error; });
  return decoderPromise;
}
async function getMeshopt() {
  if (!meshoptPromise) meshoptPromise = import('three/addons/libs/meshopt_decoder.module.js')
    .then(async ({ MeshoptDecoder }) => { await MeshoptDecoder.ready; return MeshoptDecoder; })
    .catch((error) => { meshoptPromise = null; throw error; });
  return meshoptPromise;
}
// Decode the WebP bytes already contained in the GLB. No blob: or data:
// resource is fetched, so restrictive connect-src policies cannot block
// the texture like ImageBitmapLoader did.
// RF558_TEXTURE_COLOR_REPAIR_20261112 — Always honor native GLB UV image orientation.
async function decodeInMemoryImage(image, i) {
  const blob = new Blob([image.bytes], { type: image.mime });
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, {
        // All GLB model images use the same unmodified top-left pixel layout.
        // The glTF UVs and Texture.flipY=false already define orientation.
        // A previous generic-only flipY placed skin and costume colors on
        // the wrong UV islands and appeared as mottled, patchy surfaces.
        imageOrientation: 'none',
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none'
      });
    } catch (cause) {
      // Older browsers may not support the options object.
      try { return await createImageBitmap(blob); }
      catch (second) { throw new Error(`内蔵画像${i + 1}の直接デコードに失敗: ${second?.message || second}`, { cause }); }
    }
  }
  // <img> fallback for browsers without createImageBitmap, still no fetch().
  const bytes = image.bytes;
  let encoded = '';
  const stride = 0x6000;
  for (let start = 0; start < bytes.length; start += stride) {
    encoded += String.fromCharCode(...bytes.subarray(start, start + stride));
  }
  return await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error(`内蔵画像${i + 1}を表示できません（img-src の data: 設定を確認）`));
    element.src = `data:${image.mime};base64,${btoa(encoded)}`;
  });
}
function samplerSetting(THREE, sampler, texture) {
  const wraps = { 33071: THREE.ClampToEdgeWrapping, 33648: THREE.MirroredRepeatWrapping, 10497: THREE.RepeatWrapping };
  const filters = {
    9728: THREE.NearestFilter, 9729: THREE.LinearFilter,
    9984: THREE.NearestMipmapNearestFilter, 9985: THREE.LinearMipmapNearestFilter,
    9986: THREE.NearestMipmapLinearFilter, 9987: THREE.LinearMipmapLinearFilter
  };
  texture.wrapS = wraps[sampler?.wrapS ?? 10497];
  texture.wrapT = wraps[sampler?.wrapT ?? 10497];
  texture.minFilter = filters[sampler?.minFilter ?? 9987];
  texture.magFilter = filters[sampler?.magFilter ?? 9729];
}
async function restoreInMemoryTextures(gltf, detached, sourceUrl = '') {
  if (!detached?.images.length || !detached.materials.length) return;
  // One orientation policy for ALL models (generic heroes, bosses, admin GLBs).
  // The embedded WebP pixel bytes and model UV coordinates remain untouched.
  const decoded = await Promise.all(detached.images.map((image, i) =>
    decodeInMemoryImage(image, i)
  ));
  const textureCache = new Map();
  const textureFor = (index, isColor) => {
    if (!Number.isInteger(index)) return null;
    const k = `${index}:${isColor ? 'color' : 'linear'}`;
    if (textureCache.has(k)) return textureCache.get(k);
    const textureDef = detached.textures[index];
    if (!textureDef) return null;
    const bitmap = decoded[textureDef.source];
    if (!bitmap) return null;
    const texture = new THREE.Texture(bitmap);
    texture.flipY = false; // glTF UVs: do not reverse image coordinates a second time.
    texture.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    // Preserve PBR channel meanings: diffuse/emissive use sRGB; roughness,
    // metalness, normals and AO remain linear (see textureFor callers).
    // Anisotropic sampling suppresses distant aliasing in compact UV atlases.
    texture.anisotropy = (typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad/i.test(navigator.userAgent||'')) ? 2 : 4;
    samplerSetting(THREE, detached.samplers[textureDef.sampler], texture);
    texture.needsUpdate = true;
    textureCache.set(k, texture);
    return texture;
  };
  const apply = (material, spec) => {
    if (!material || !spec) return;
    const albedo = textureFor(spec.baseColor, true);
    if (spec.baseColor !== null && !albedo) {
      throw new Error('GLBの肌・衣装テクスチャを正しく割り当てられませんでした');
    }
    material.map = albedo;
    const mr = textureFor(spec.metalRough, false);
    material.metalnessMap = mr;
    material.roughnessMap = mr;
    material.userData ||= {};
    material.userData.arkeiaPaintedAlbedo = !!albedo;
    material.normalMap = textureFor(spec.normal, false);
    if (material.normalMap && material.normalScale) material.normalScale.set(spec.normalScale, spec.normalScale);
    material.aoMap = textureFor(spec.occlusion, false);
    if (material.aoMap) material.aoMapIntensity = spec.occlusionStrength;
    material.emissiveMap = textureFor(spec.emissive, true);
    material.needsUpdate = true;
  };
  const materials = detached.materials;
  gltf.scene.traverse((node) => {
    if (!node.isMesh) return;
    // Shipped avatar and summon GLBs have one material; other GLBs can use
    // GLTFLoader's associations map to recover the original material index.
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      const index = gltf.parser?.associations?.get(material)?.materials;
      apply(material, materials[index ?? 0]);
    }
  });
  // The shared model loader caches the scene, so retain its decoded textures.
  gltf.userData ||= {};
  gltf.userData.arkeiaTextures = [...textureCache.values()];
  gltf.userData.arkeiaDecodedImages = decoded;
}
function createGLTFParser() { return new GLTFLoader(new THREE.LoadingManager()); }

export function peekModel(url) { return cache.get(absolute(url).href) || null; }
export function modelError(url) { return errors.get(absolute(url).href) || null; }
export function loadModel(url) {
  const key = absolute(url).href;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (pending.has(key)) return pending.get(key);
  const task = schedule(async () => {
    errors.delete(key);
    notify();
    try {
      // Keep the on-disk asset path unchanged. The previous ?v= suffix could be
      // rejected by static hosts; HTTP cache validation refreshes stale files.
      const payload = await fetchBytes(url);
      const { doc } = documentOf(payload);
      if (!doc.asset || doc.asset.version !== '2.0') throw new Error('glTF 2.0として認識できません');
      const extensions = new Set([...(doc.extensionsUsed || []), ...(doc.extensionsRequired || [])]);
      const newLoader = async () => {
        const loader = createGLTFParser(extensions);
        if (extensions.has('KHR_draco_mesh_compression')) loader.setDRACOLoader(await getDraco());
        if (extensions.has('EXT_meshopt_compression') || extensions.has('KHR_meshopt_compression')) loader.setMeshoptDecoder(await getMeshopt());
        return loader;
      };
      const sourceDir = new URL('./', key).href;
      // All of these 3D assets use embedded WebP bufferViews. Remove only
      // texture references from an in-memory copy before GLTFLoader.parseAsync
      // (geometry, UVs, skin and animation bytes are preserved exactly).
      const hasEmbeddedImages = (doc.images || []).some((image) =>
        Number.isInteger(image.bufferView) && /^image\//.test(image.mimeType || '')
      );
      const detached = hasEmbeddedImages ? separateEmbeddedTextures(payload, doc) : null;
      const loader = await newLoader();
      const result = await deadline(loader.parseAsync(detached ? detached.glb : payload, sourceDir), 120000, 'GLB解析タイムアウト');
      if (detached) await deadline(restoreInMemoryTextures(result, detached, key), 90000, '内蔵WebPの直接デコードがタイムアウト');
      let visibleMeshes = 0;
      result.scene?.traverse((node) => {
        if (node.isMesh && node.geometry?.attributes?.position?.count) visibleMeshes++;
      });
      if (!visibleMeshes) throw new Error('GLBには描画できる3D形状がありません');
      // The model is returned only when both geometry and the original
      // painted WebP textures have been restored successfully.
      result.userData ||= {};
      result.userData.arkeiaSource = key;
      if (new URL(key).pathname.endsWith('/tenshi.glb')) attachTenshiRig(result);
      cache.set(key, result);
      errors.delete(key);
      notify();
      return result;
    } catch (error) {
      const description = error?.name === 'AbortError' ? 'モデルの通信がタイムアウトしました' : error?.message || String(error);
      const failure = new ModelLoadError(url, description, error);
      errors.set(key, failure);
      notify();
      throw failure;
    }
  });
  pending.set(key, task);
  task.then(() => pending.delete(key), () => pending.delete(key));
  return task;
}

// Preserve the model's own quantization, root transforms, skeleton and texture UVs.
// Height normalization is applied to a new wrapper, never to the imported root.
export function instantiateModel(gltf, height, tint = null) {
  if (!gltf?.scene) throw new ModelLoadError('model.glb', '読込完了前にはキャラクターを生成できません');
  let box = rfV12Bounds.get(gltf.scene);
  if (!box) {
    gltf.scene.updateMatrixWorld(true);
    box = gltf.userData?.arkeiaOriginalBounds || new THREE.Box3().setFromObject(gltf.scene, true);
    rfV12Bounds.set(gltf.scene, box);
  }
  const model = SkeletonUtils.clone(gltf.scene);
  model.updateMatrixWorld(true);
  const size = box.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0.000001) throw new ModelLoadError(gltf.userData?.arkeiaSource || 'model.glb', 'モデルの高さが不正です');
  const wrapper = new THREE.Group();
  const materials = new Set();
  const skeletons = new Set();
  const rfLocalMaterialCache = new Map();
  const tintColor = tint == null ? null : new THREE.Color(tint);
  const preserveSourceMaterial = /(?:^|\/)(?:iron-warlord(?:-f2)?|operator-gigantes|gaizorg-boss|valdarion|chief-empress|maou-lord|nepterion-chief|crimson-swordsman|kraid-lightweight|udaijin-original|udaijin-exact-v21|kinosaki-sanmi-original|fujiwara-nobuyori-original|uninomiya-tadayasu-rigged|minamoto-yoritomo|tenshi)\.glb(?:[?#]|$)/i.test(gltf.userData?.arkeiaSource || '');
  model.traverse((o) => {
    if (!o.isMesh) return;
    // Shadows are disabled by the render policy. Preserve skinning and animations.
    o.castShadow = false;
    if (o.isSkinnedMesh) {
      o.frustumCulled = false;
      if (o.skeleton) {
        // SkeletonUtils creates a separate skeleton, including its eventual GPU bone texture.
        skeletons.add(o.skeleton);
        o.skeleton.update();
      }
    }
    const materialFor = (source) => {
      if (!source) return source;
      const standard = source.isMeshStandardMaterial || source.isMeshPhysicalMaterial;
      const tintNeeded = !preserveSourceMaterial && !!tintColor && !!source.color;
      if (!tintNeeded) {
        // Shared immutable geometry and normal texture references, no per-fighter clone.
        if (!preserveSourceMaterial && standard) {
          source.metalness = Math.min(0.18, source.metalness ?? 0);
          source.roughness = Math.max(0.7, source.roughness ?? 0.8);
        }
        return source;
      }
      let material = rfLocalMaterialCache.get(source);
      if (material) return material;
      material = source.clone();
      if (standard) {
        material.metalness = Math.min(0.18, material.metalness ?? 0);
        material.roughness = Math.max(0.7, material.roughness ?? 0.8);
      }
      // Keep the painted skin, face and costume readable. Unique palettes are
      // still indicated by the fighter's ornaments and a very subtle tint.
      // This leaves the source GLB image, UVs and skeleton unchanged.
      material.color.lerp(tintColor, material.map ? 0.075 : 0.22);
      rfLocalMaterialCache.set(source, material);
      materials.add(material);
      return material;
    };
    o.material = Array.isArray(o.material) ? o.material.map(materialFor) : materialFor(o.material);
  });
  wrapper.add(model);
  const scale = Math.max(0.05, Number(height) || 1.8) / size.y;
  wrapper.scale.setScalar(scale);
  wrapper.position.set(-(box.min.x + box.max.x) * 0.5 * scale, -box.min.y * scale, -(box.min.z + box.max.z) * 0.5 * scale);
  wrapper.userData.arkeiaModel = true;
  wrapper.userData.arkeiaMaterials = materials;
  return { wrapper, model, materials, skeletons, runtimeRig:gltf.userData?.arkeiaRig };
}
export function disposeModel(instance, mixer) {
  if (!instance) return;
  mixer?.stopAllAction();
  if (mixer && instance.model) mixer.uncacheRoot(instance.model);
  for (const material of instance.materials || []) material.dispose();
  for (const skeleton of instance.skeletons || []) skeleton.dispose();
  instance.skeletons?.clear();
  instance.wrapper?.removeFromParent();
  // Mesh geometry and material maps are shared with the cached GLB.
}
