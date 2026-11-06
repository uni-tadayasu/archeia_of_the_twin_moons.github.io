// The supplied GLBs are one rigid mesh with no rig or animation clips.
// Preserve their source geometry and textures; use a small whole-body gait
// so the original claws, horns, armor edges and UVs never deform or tear.
const KEYS = new Set(['gaien', 'gaien2']);
export function attachGaienWalk(model, key) {
  if (!model || !KEYS.has(key)) return null;
  const startY = model.position.y;
  const startRX = model.rotation.x;
  const startRZ = model.rotation.z;
  let phase = 0;
  let amount = 0;
  return {
    update(delta, moving) {
      const dt = Math.max(0, Math.min(0.12, Number(delta) || 0));
      const active = !!moving;
      amount += ((active ? 1 : 0) - amount) * (1 - Math.exp(-7 * dt));
      phase = (phase + dt * (moving === 'run' ? 9 : 6.5)) % (Math.PI * 2);
      model.position.y = startY + Math.max(0, Math.sin(phase)) * 0.023 * amount;
      model.rotation.x = startRX + Math.cos(phase * 2) * 0.015 * amount;
      model.rotation.z = startRZ + Math.sin(phase) * 0.025 * amount;
    },
    stop() {
      amount = 0;
      model.position.y = startY;
      model.rotation.x = startRX;
      model.rotation.z = startRZ;
    }
  };
}
