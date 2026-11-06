// ガイエン専用：原本GLBの頂点・UV・素材を変更しない歩行モーション。
// 添付の二形態は一体型メッシュで骨格アニメーションがないため、
// モデル全体の接地・重心・首の動きを模した緩やかな揺れで歩行を表現する。
const GAIEN_KEYS = new Set(['gaien', 'gaien2']);
const TAU = Math.PI * 2;

export function attachGaienWalk(model, key) {
  if (!model || !GAIEN_KEYS.has(key)) return null;

  const basePosition = model.position.clone();
  const baseRotation = model.rotation.clone();
  const evolved = key === 'gaien2';
  let phase = 0;
  let blend = 0;
  let movingLast = false;

  const reset = () => {
    model.position.copy(basePosition);
    model.rotation.copy(baseRotation);
  };

  return {
    update(delta, moving) {
      const dt = Math.max(0, Math.min(0.12, Number(delta) || 0));
      const active = !!moving;
      const running = moving === 'run' || moving === true;
      blend += ((active ? 1 : 0) - blend) * (1 - Math.exp(-8 * dt));
      blend = Math.min(1, Math.max(0, blend));
      if (blend < 0.001 && !active) {
        blend = 0;
        movingLast = false;
        reset();
        return;
      }

      // 行動に合わせて実時間で位相を進める。スタン・停止時には減衰する。
      const pace = running ? (evolved ? 8.3 : 7.7) : 6.0;
      phase = (phase + dt * pace) % TAU;
      const step = Math.sin(phase);
      const oppose = Math.sin(phase + Math.PI);
      const doubleStep = Math.sin(phase * 2);
      const stridePower = evolved ? 1.16 : 1;

      // 一体型モデルの前脚・後脚を個別に変形させない（UVと外形を保護）。
      // 二歩に一度の上下動＋左右の加重＋前後傾で「重量感のある歩行」を表す。
      const lift = Math.pow(Math.abs(step), 1.45) * 0.030 * stridePower * blend;
      const plant = Math.max(0, step) - Math.max(0, oppose);
      model.position.set(
        basePosition.x + plant * 0.007 * blend,
        basePosition.y + lift,
        basePosition.z + doubleStep * 0.008 * blend
      );
      model.rotation.set(
        baseRotation.x + doubleStep * 0.024 * blend,
        baseRotation.y + step * 0.012 * blend,
        baseRotation.z + plant * 0.028 * blend
      );
      movingLast = active;
    },
    stop() {
      blend = 0;
      phase = 0;
      movingLast = false;
      reset();
    }
  };
}
