// ガイエン専用歩行・近接モーション。
// 骨格付きGLBでは手足のWalk/Runクリップを優先し、近接攻撃時だけ腕の振りを上乗せする。
// 頂点/UV/テクスチャは変更しない。
import * as THREE from 'three';

const GAIEN_KEYS = new Set(['gaien', 'gaien2']);
const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

function addBoneRotation(bone, axis, angle) {
  if (!bone || !Number.isFinite(angle) || Math.abs(angle) < 1e-5) return;
  const delta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  bone.quaternion.multiply(delta);
}

export function attachGaienWalk(model, key) {
  if (!model || !GAIEN_KEYS.has(key)) return null;

  let rig = null;
  model.traverse((node) => {
    if (!rig && node.isSkinnedMesh && node.skeleton?.bones?.length) rig = node.skeleton;
  });
  if (rig) {
    const bones = Object.fromEntries(rig.bones.map((bone) => [bone.name, bone]));
    const titan = key === 'gaien2';
    // Every frame AnimationMixer first writes the original rig pose. Then the
    // attack overlay runs, so it never accumulates angle offsets or breaks UVs.
    return {
      update(_delta, _moving, action = null) {
        if (action?.type !== 'light') return;
        const fraction = Math.max(0, Math.min(1, action.t / Math.max(0.1, action.dur || 0.32)));
        const swing = Math.sin(Math.PI * fraction);
        const left = (action.step || 0) % 2 !== 0;
        const power = titan ? 1.18 : 1;
        const lead = left ? 'L' : 'R';
        const trail = left ? 'R' : 'L';
        addBoneRotation(bones[`Shoulder_${lead}`], AXIS_X, -0.74 * swing * power);
        addBoneRotation(bones[`Elbow_${lead}`], AXIS_X, -0.42 * swing * power);
        addBoneRotation(bones[`Wrist_${lead}`], AXIS_X, 0.16 * swing * power);
        addBoneRotation(bones[`Shoulder_${trail}`], AXIS_X, 0.27 * swing * power);
        addBoneRotation(bones.Pelvis, AXIS_Y, (left ? -1 : 1) * 0.13 * swing);
        addBoneRotation(bones.Neck, AXIS_X, -0.13 * swing);
        addBoneRotation(bones.TailBase, AXIS_Y, (left ? 1 : -1) * 0.15 * swing);
      },
      stop() { /* The AnimationMixer restores the rig pose on its next update. */ }
    };
  }

  // Older, unrigged GLBs can still walk without deforming the original mesh.
  const pos = model.position.clone();
  const rot = model.rotation.clone();
  let phase = 0;
  let strength = 0;
  const titan = key === 'gaien2';
  const reset = () => { model.position.copy(pos); model.rotation.copy(rot); };
  return {
    update(delta, moving) {
      const dt = Math.max(0, Math.min(0.12, Number(delta) || 0));
      strength += ((moving ? 1 : 0) - strength) * (1 - Math.exp(-8 * dt));
      if (strength < 0.002 && !moving) { strength = 0; reset(); return; }
      phase = (phase + dt * (moving === 'run' ? 9.5 : 7.0)) % TAU;
      const step = Math.sin(phase);
      const weight = titan ? 1.25 : 1;
      model.position.set(pos.x + step * 0.016 * strength, pos.y + Math.abs(step) * 0.052 * weight * strength, pos.z);
      model.rotation.set(rot.x + Math.sin(phase * 2) * 0.065 * strength, rot.y, rot.z + step * 0.06 * weight * strength);
    },
    stop() { strength = 0; phase = 0; reset(); }
  };
}
