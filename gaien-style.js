// Preserve Gaien GLB materials exactly. No re-coloring, overlaid patterns,
// emissive shader rewrites or changes to geometry/normals/UVs.
const GAIEN_KEYS = new Set(['gaien', 'gaien2']);
export function enhanceGaienModel(model, key) {
  if (!model || !GAIEN_KEYS.has(key)) return null;
  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      for (const texture of [material.map, material.normalMap, material.metalnessMap,
        material.roughnessMap, material.aoMap, material.emissiveMap]) {
        if (texture) texture.anisotropy = Math.max(8, texture.anisotropy || 1);
      }
    }
  });
  return { update() {}, stop() {} };
}
