// Gaien walk cycle for the two source GLBs.
// The supplied files contain a single static mesh and no joints/animation clips,
// so motion is applied on each cloned mesh's GPU vertices (never to shared GLBs).
const GAIEN_KEYS = new Set(['gaien', 'gaien2']);
const VERTEX_GAIT = `
  // The two dragons are unrigged. Move the lower leg regions in opposing
  // phases, counter-swing the forearms and give the torso a subtle impulse.
  float gaienSide = position.x < 0.0 ? 3.14159265 : 0.0;
  float gaienStep = sin(uGaienPhase + gaienSide);
  float gaienFoot = (1.0 - smoothstep(-0.68, -0.14, position.y)) * smoothstep(0.10, 0.30, abs(position.x));
  transformed.z += gaienStep * gaienFoot * 0.11 * uGaienStrength;
  transformed.y += max(gaienStep, 0.0) * gaienFoot * 0.035 * uGaienStrength;
  float gaienArm = smoothstep(0.30, 0.52, abs(position.x))
    * smoothstep(-0.10, 0.10, position.y)
    * (1.0 - smoothstep(0.42, 0.75, position.y));
  transformed.z -= gaienStep * gaienArm * 0.055 * uGaienStrength;
`;
export function attachGaienWalk(model, key) {
  if (!model || !GAIEN_KEYS.has(key)) return null;
  let phase = 0;
  let strength = 0;
  const baseY = model.position.y;
  const baseRx = model.rotation.x;
  const baseRz = model.rotation.z;
  const uniforms = [];
  model.traverse((obj) => {
    if (!obj.isMesh || obj.isSkinnedMesh) return;
    for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
      if (!mat || typeof mat.onBeforeCompile !== 'function') continue;
      const oldCompile = mat.onBeforeCompile;
      const oldKey = mat.customProgramCacheKey?.bind(mat);
      const p = { value: 0 };
      const s = { value: 0 };
      uniforms.push({ p, s });
      mat.onBeforeCompile = (shader, renderer) => {
        oldCompile.call(mat, shader, renderer);
        shader.uniforms.uGaienPhase = p;
        shader.uniforms.uGaienStrength = s;
        shader.vertexShader = shader.vertexShader.replace('#include <common>',
          '#include <common>\nuniform float uGaienPhase;\nuniform float uGaienStrength;');
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n' + VERTEX_GAIT);
      };
      mat.customProgramCacheKey = () => (oldKey ? oldKey() : '') + '-gaien-walk-v1';
      mat.needsUpdate = true;
    }
  });
  return {
    update(delta, moving) {
      const dt = Math.max(0, Math.min(0.12, Number(delta) || 0));
      const target = moving ? 1 : 0;
      strength += (target - strength) * (1 - Math.exp(-8 * dt));
      if (strength < 0.002) strength = 0;
      if (strength) phase = (phase + dt * (moving === 'run' ? 10.5 : 7.6)) % (Math.PI * 2);
      for (const u of uniforms) { u.p.value = phase; u.s.value = strength; }
      const step = Math.sin(phase);
      model.position.y = baseY + Math.abs(step) * 0.025 * strength;
      model.rotation.z = baseRz + step * 0.034 * strength;
      model.rotation.x = baseRx + Math.cos(phase * 2) * 0.022 * strength;
    },
    stop() {
      strength = 0;
      for (const u of uniforms) u.s.value = 0;
      model.position.y = baseY;
      model.rotation.x = baseRx;
      model.rotation.z = baseRz;
    }
  };
}
