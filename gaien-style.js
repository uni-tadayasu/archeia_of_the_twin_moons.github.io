const GAIEN_STYLE_KEYS = new Set(['gaien', 'gaien2']);

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function enhanceGaienModel(model, key) {
  if (!model || !GAIEN_STYLE_KEYS.has(key)) return null;
  const titan = key === 'gaien2';
  const uniforms = [];
  const touched = new Set();
  let time = Math.random() * Math.PI * 2;
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!mat || touched.has(mat)) continue;
      touched.add(mat);
      if (mat.map) mat.map.anisotropy = Math.max(8, mat.map.anisotropy || 1);
      if (mat.normalMap) mat.normalMap.anisotropy = Math.max(8, mat.normalMap.anisotropy || 1);
      if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
        mat.roughness = titan ? clamp((mat.roughness ?? 0.8) * 0.82, 0.28, 0.72) : clamp((mat.roughness ?? 0.82) * 0.9, 0.34, 0.8);
        mat.metalness = titan ? Math.max(mat.metalness ?? 0, 0.22) : Math.max(mat.metalness ?? 0, 0.1);
        mat.envMapIntensity = titan ? 1.28 : 0.92;
        if (mat.normalScale?.setScalar) mat.normalScale.setScalar(titan ? 1.16 : 1.05);
      }
      if (mat.emissive?.setHex) mat.emissive.setHex(titan ? 0xff6a18 : 0xff7c24);
      mat.emissiveIntensity = titan ? 0.62 : 0.3;

      const oldCompile = mat.onBeforeCompile?.bind(mat);
      const oldKey = mat.customProgramCacheKey?.bind(mat);
      const uTime = { value: time };
      const uGlow = { value: titan ? 1.0 : 0.68 };
      const uHeat = { value: titan ? 1.0 : 0.64 };
      uniforms.push({ uTime, uGlow, uHeat });

      mat.onBeforeCompile = (shader, renderer) => {
        oldCompile?.(shader, renderer);
        shader.uniforms.uGaienStyleTime = uTime;
        shader.uniforms.uGaienStyleGlow = uGlow;
        shader.uniforms.uGaienStyleHeat = uHeat;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\nvarying vec3 vGaienLocalPos;`)
          .replace('#include <begin_vertex>', `#include <begin_vertex>\nvGaienLocalPos = position;`);
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\nuniform float uGaienStyleTime;\nuniform float uGaienStyleGlow;\nuniform float uGaienStyleHeat;\nvarying vec3 vGaienLocalPos;`)
          .replace('#include <output_fragment>', `
            float gaienView = 1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0);
            float gaienRim = pow(clamp(gaienView, 0.0, 1.0), 2.05);
            float gaienPulse = 0.5 + 0.5 * sin(uGaienStyleTime * 3.4 + vGaienLocalPos.y * 4.2 + vGaienLocalPos.x * 1.6);
            float gaienChest = smoothstep(-0.25, 0.52, vGaienLocalPos.y) * (1.0 - smoothstep(0.22, 0.96, abs(vGaienLocalPos.x)));
            float gaienBack = smoothstep(0.02, 0.62, vGaienLocalPos.z);
            float gaienShell = smoothstep(0.18, 0.95, abs(vGaienLocalPos.x)) * smoothstep(-0.28, 0.48, vGaienLocalPos.y);
            vec3 gaienFireA = vec3(1.0, 0.40, 0.10);
            vec3 gaienFireB = vec3(1.0, 0.86, 0.40);
            vec3 gaienLava = mix(gaienFireA, gaienFireB, gaienPulse);
            totalEmissiveRadiance += gaienLava * gaienRim * (0.18 + 0.16 * uGaienStyleGlow);
            totalEmissiveRadiance += gaienLava * gaienChest * uGaienStyleHeat * (0.09 + 0.18 * gaienPulse);
            totalEmissiveRadiance += gaienLava * gaienBack * uGaienStyleHeat * (0.06 + 0.18 * gaienPulse);
            totalEmissiveRadiance += gaienLava * gaienShell * gaienBack * (0.04 + 0.08 * uGaienStyleGlow);
            #include <output_fragment>`);
      };
      mat.customProgramCacheKey = () => (oldKey ? oldKey() : '') + (titan ? '-gaien-style-v2' : '-gaien-style-v1');
      mat.needsUpdate = true;
    }
  });

  return {
    update(delta, moving) {
      const dt = Math.max(0, Math.min(0.1, Number(delta) || 0));
      time += dt;
      const targetGlow = moving ? (titan ? 1.18 : 0.88) : (titan ? 1.0 : 0.68);
      const targetHeat = moving ? (titan ? 1.12 : 0.78) : (titan ? 1.0 : 0.64);
      for (const s of uniforms) {
        s.uTime.value = time;
        s.uGlow.value += (targetGlow - s.uGlow.value) * (1 - Math.exp(-5 * dt));
        s.uHeat.value += (targetHeat - s.uHeat.value) * (1 - Math.exp(-4 * dt));
      }
    },
    stop() {
      for (const s of uniforms) {
        s.uGlow.value = titan ? 1.0 : 0.68;
        s.uHeat.value = titan ? 1.0 : 0.64;
      }
    }
  };
}
