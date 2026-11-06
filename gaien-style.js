const GAIEN_STYLE_KEYS = new Set(['gaien', 'gaien2']);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function enhanceGaienModel(model, key) {
  if (!model || !GAIEN_STYLE_KEYS.has(key)) return null;
  const titan = key === 'gaien2';
  const touched = new Set();

  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat || touched.has(mat)) continue;
      touched.add(mat);

      // Preserve the imported texture/model look as faithfully as possible.
      // Only improve sampling/stability; do not add extra patterns or repaint colors.
      for (const tex of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.emissiveMap, mat.aoMap]) {
        if (tex) {
          tex.anisotropy = Math.max(16, tex.anisotropy || 1);
          tex.needsUpdate = true;
        }
      }

      if (mat.map && 'colorSpace' in mat.map) {
        // Keep base color texture correct in current renderer.
        // Using assignment only if property exists avoids breaking older builds.
        try { mat.map.colorSpace = 'srgb'; } catch {}
      }

      if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
        // Keep the source material feel, only prevent over-flat or over-metallic rendering.
        mat.metalness = clamp(mat.metalness ?? (titan ? 0.16 : 0.08), 0.0, titan ? 0.28 : 0.18);
        mat.roughness = clamp(mat.roughness ?? (titan ? 0.64 : 0.74), titan ? 0.42 : 0.50, 0.9);
        mat.envMapIntensity = titan ? 1.0 : 0.9;
        if (mat.normalScale?.setScalar) mat.normalScale.setScalar(titan ? 1.0 : 0.95);
      }

      // Do not inject emissive colors or procedural shaders here.
      // The goal is faithful reproduction of the GLB model textures.
      mat.needsUpdate = true;
    }
  });

  return {
    update(_delta, _moving) {
      // faithful mode: no procedural recolor / no patterned glow animation
    },
    stop() {}
  };
}
