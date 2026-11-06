const GAIEN_STYLE_KEYS = new Set(['gaien', 'gaien2']);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function enhanceGaienModel(model, key) {
  if (!model || !GAIEN_STYLE_KEYS.has(key)) return null;
  const titan = key === 'gaien2';
  const uniforms = [];
  const matsSeen = new Set();
  let time = Math.random() * Math.PI * 2;

  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat || matsSeen.has(mat)) continue;
      matsSeen.add(mat);

      if (mat.map) mat.map.anisotropy = Math.max(12, mat.map.anisotropy || 1);
      if (mat.normalMap) mat.normalMap.anisotropy = Math.max(12, mat.normalMap.anisotropy || 1);
      if (mat.roughnessMap) mat.roughnessMap.anisotropy = Math.max(12, mat.roughnessMap.anisotropy || 1);
      if (mat.metalnessMap) mat.metalnessMap.anisotropy = Math.max(12, mat.metalnessMap.anisotropy || 1);
      if (mat.emissiveMap) mat.emissiveMap.anisotropy = Math.max(12, mat.emissiveMap.anisotropy || 1);

      if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
        mat.roughness = titan ? clamp(mat.roughness ?? 0.68, 0.34, 0.74) : clamp(mat.roughness ?? 0.78, 0.42, 0.84);
        mat.metalness = titan ? clamp(mat.metalness ?? 0.16, 0.08, 0.32) : clamp(mat.metalness ?? 0.09, 0.03, 0.18);
        mat.envMapIntensity = titan ? 1.22 : 1.0;
        if (mat.normalScale?.setScalar) mat.normalScale.setScalar(titan ? 1.12 : 1.04);
      }
      if (mat.emissive?.setHex) mat.emissive.setHex(titan ? 0xff6820 : 0xff7a2c);
      mat.emissiveIntensity = titan ? 0.42 : 0.22;

      const baseCompile = mat.onBeforeCompile?.bind(mat);
      const baseKey = mat.customProgramCacheKey?.bind(mat);
      const uTime = { value: time };
      const uGlow = { value: titan ? 1.0 : 0.78 };
      uniforms.push({ uTime, uGlow });

      mat.onBeforeCompile = (shader, renderer) => {
        baseCompile?.(shader, renderer);
        shader.uniforms.uGaienFxTime = uTime;
        shader.uniforms.uGaienFxGlow = uGlow;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vGaienLocalPos;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGaienLocalPos = position;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uGaienFxTime;\nuniform float uGaienFxGlow;\nvarying vec3 vGaienLocalPos;')
          .replace('#include <output_fragment>', `
            float gView = 1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0);
            float gRim = pow(clamp(gView, 0.0, 1.0), 2.2);
            float gPulse = 0.55 + 0.45 * sin(uGaienFxTime * 3.6 + vGaienLocalPos.y * 4.8 + vGaienLocalPos.x * 1.3);
            float gChest = smoothstep(-0.24, 0.54, vGaienLocalPos.y) * (1.0 - smoothstep(0.20, 1.00, abs(vGaienLocalPos.x)));
            float gSpikes = smoothstep(0.10, 0.72, vGaienLocalPos.z) * smoothstep(-0.28, 0.54, vGaienLocalPos.y);
            vec3 gFireA = vec3(1.0, 0.42, 0.10);
            vec3 gFireB = vec3(1.0, 0.84, 0.38);
            vec3 gFire = mix(gFireA, gFireB, gPulse);
            totalEmissiveRadiance += gFire * gRim * (0.10 + 0.14 * uGaienFxGlow);
            totalEmissiveRadiance += gFire * gChest * (0.04 + 0.10 * uGaienFxGlow);
            totalEmissiveRadiance += gFire * gSpikes * (0.03 + 0.08 * uGaienFxGlow);
            #include <output_fragment>`);
      };
      mat.customProgramCacheKey = () => (baseKey ? baseKey() : '') + (titan ? '-gaien-hd-v2' : '-gaien-hd-v1');
      mat.needsUpdate = true;
    }
  });

  return {
    update(delta, moving) {
      const dt = Math.max(0, Math.min(0.1, Number(delta) || 0));
      time += dt;
      const target = moving ? (titan ? 1.16 : 0.96) : (titan ? 1.0 : 0.78);
      for (const u of uniforms) {
        u.uTime.value = time;
        u.uGlow.value += (target - u.uGlow.value) * (1 - Math.exp(-4.5 * dt));
      }
    },
    stop() {
      for (const u of uniforms) u.uGlow.value = titan ? 1.0 : 0.78;
    }
  };
}
