import * as THREE from 'three';
import { fujiwaraSprite } from './fujiwara-cg.js?v=55.29';

export const JUDGMENT_IMPACT = 1.62;
export const JUDGMENT_END = 2.13;
const FALL_START = 1.02;
const FLASHES = [.23, .39, .55, .71, .87, 1.03];

const clamp01 = value => THREE.MathUtils.clamp(value, 0, 1);
const smooth = value => {
  const t = clamp01(value);
  return t*t*(3-2*t);
};

export function createFujiwaraJudgmentCG(battle, target) {
  const root = new THREE.Group();
  root.name = 'Fujiwara Judgment CG';
  battle.scene.add(root);
  const blade = fujiwaraSprite('judgment', 6.6, 13.2, 0, false);
  blade.name = 'Fujiwara Judgment blade';
  blade.renderOrder = 20;
  const seal = fujiwaraSprite('seal', 9, 3.6, 0);
  seal.name = 'Fujiwara Judgment wind seal';
  seal.position.y = .18;
  seal.material.depthTest = false;
  seal.renderOrder = 5;
  const burst = fujiwaraSprite('glow', 5, 3.4, 0);
  burst.material.color.setHex(0xb7c8ff);
  burst.position.y = .8;
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    document.body?.classList.contains('rf558-no-effects');
  const rays = Array.from({length:reduced?2:3}, (_,index) => {
    const ray = fujiwaraSprite('lightning', 5.5, 12.7, 0);
    ray.name = 'Fujiwara Judgment lightning';
    ray.position.set((index-1)*1.35,6.15,0);
    ray.material.color.setHex(index===1?0xe7eeff:0xa3abff);
    ray.material.rotation = (index-1)*.17;
    return ray;
  });
  root.add(seal,...rays,blade,burst);
  const container = document.getElementById('game-container');
  const dim = container && document.createElement('div');
  if (dim) {
    dim.dataset.fujiwaraJudgment = '';
    dim.setAttribute('aria-hidden','true');
    dim.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;opacity:0;background:radial-gradient(ellipse at 52% 58%,#130e2e35 10%,#0b0726ed 91%)';
    container.append(dim);
  }
  let fixed = false;
  let disposed = false;

  function update(time) {
    if (disposed) return;
    if (!fixed) root.position.set(target.pos.x,0,target.pos.z);
    if (time >= JUDGMENT_IMPACT) fixed = true;
    const tail = clamp01((time-JUDGMENT_IMPACT)/(JUDGMENT_END-JUDGMENT_IMPACT));
    if (dim) dim.style.opacity = String((reduced?.32:.69)*smooth(time/.24)*(1-tail));
    const wind = smooth(time/.28);
    seal.scale.set(5+wind*5+tail*2,2.1+wind*1.6+tail*.5,1);
    seal.material.opacity = .44*wind*(1-tail);
    const fall = clamp01((time-FALL_START)/(JUDGMENT_IMPACT-FALL_START));
    blade.position.y = 18.3-11.75*fall*fall;
    blade.material.opacity = smooth((time-FALL_START)/.17)*(1-smooth(tail));
    for (const [index,ray] of rays.entries()) {
      let alpha = 0;
      for (let i=index;i<FLASHES.length;i+=rays.length) {
        const since = time-FLASHES[i];
        if (since>=0 && since<.26) alpha=Math.max(alpha,(1-since/.26)**2);
      }
      const impact = time>=JUDGMENT_IMPACT ? (1-tail)**3 : 0;
      ray.material.opacity = (reduced?.38:.84)*Math.max(alpha,impact);
    }
    const impact = time>=JUDGMENT_IMPACT ? (1-tail)**3 : 0;
    burst.scale.set(4+tail*8,2.7+tail*3,1);
    burst.material.opacity = (reduced?.48:.91)*impact;
  }
  update(0);

  return {
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const child of root.children) child.material.dispose();
      root.removeFromParent();
      dim?.remove();
    },
  };
}
