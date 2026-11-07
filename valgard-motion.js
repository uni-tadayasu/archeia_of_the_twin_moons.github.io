import * as THREE from 'three';

const STEP = Math.PI * 2;
const AX_X = new THREE.Vector3(1, 0, 0);
const AX_Y = new THREE.Vector3(0, 1, 0);

// The new iron-warlord GLB may have a proper humanoid rig or be a static mesh.
// We respect any embedded animations and only add an animation-layer offset.
export function attachValgardMotion(model, key) {
  if (!model || key !== 'valgard') return null;
  const restPosition = model.position.clone();
  const restRotation = model.rotation.clone();
  let phase = 0;
  let weight = 0;
  let skeleton = null;
  model.traverse((o) => { if (!skeleton && o.isSkinnedMesh && o.skeleton?.bones?.length) skeleton = o.skeleton; });
  const bones = skeleton?.bones || [];
  const bone = (...parts) => bones.find((b) => parts.some((re) => re.test(b.name))) || null;
  const armL = bone(/Left.*(UpperArm|Arm|Shoulder)/i, /(UpperArm|Arm)[_. -]?L(?:$|[_. -])/i, /left.*arm/i);
  const armR = bone(/Right.*(UpperArm|Arm|Shoulder)/i, /(UpperArm|Arm)[_. -]?R(?:$|[_. -])/i, /right.*arm/i);
  const legL = bone(/Left.*(UpLeg|Thigh|Leg)/i, /(Thigh|UpLeg|Leg)[_. -]?L(?:$|[_. -])/i);
  const legR = bone(/Right.*(UpLeg|Thigh|Leg)/i, /(Thigh|UpLeg|Leg)[_. -]?R(?:$|[_. -])/i);
  const chest = bone(/Chest/i, /Spine2/i, /UpperBody/i);
  const tracked = [armL, armR, legL, legR, chest].filter((x,i,a) => x && a.indexOf(x)===i);
  const originalQuats = new Map(tracked.map((b) => [b, b.quaternion.clone()]));
  const addRot = (target, axis, angle) => {
    if (!target || !Number.isFinite(angle)) return;
    target.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
  };
  return {
    update(delta, moving, action = null) {
      const dt = Math.min(0.10, Math.max(0, Number(delta) || 0));
      const isMoving = !!moving;
      const attack = action?.type === 'light' || action?.type === 'dash' || action?.type === 'cast';
      const target = isMoving ? 1 : 0;
      weight += (target - weight) * (1-Math.exp(-9*dt));
      const run = moving === 'run';
      if (weight > 0.005) phase = (phase + dt*(run ? 10.2:7.5))%STEP;
      const pulse = Math.sin(phase);
      const swing = attack ? Math.sin(Math.PI*Math.min(1,(action.t||0)/Math.max(0.15,action.dur||0.36))) : 0;
      // On a static GLB the entire rigid object moves slightly; texture UVs are untouched.
      model.position.set(restPosition.x,restPosition.y+Math.abs(pulse)*0.045*weight,restPosition.z);
      model.rotation.set(restRotation.x+(weight*Math.cos(phase*2)*0.025)-(swing*0.09),restRotation.y,restRotation.z+pulse*0.037*weight);
      // If real joints exist, add arm/leg motion after AnimationMixer.update().
      // Existing source animations have already established the frame pose.
      if (tracked.length) {
        if (!model.userData.valgardAnimatedRig) for (const [b,q] of originalQuats) b.quaternion.copy(q);
        addRot(armL, AX_X, pulse*0.30*weight-swing*0.65);
        addRot(armR, AX_X, -pulse*0.30*weight+swing*0.22);
        addRot(legL, AX_X, -pulse*0.38*weight);
        addRot(legR, AX_X, pulse*0.38*weight);
        addRot(chest, AX_Y, pulse*0.065*weight);
      }
    },
    stop() {
      model.position.copy(restPosition);
      model.rotation.copy(restRotation);
      for (const [b,q] of originalQuats) b.quaternion.copy(q);
      weight=0; phase=0;
    }
  };
}
