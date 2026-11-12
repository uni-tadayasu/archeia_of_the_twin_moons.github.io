import { divinePalette, tenshiTexture } from './tenshi-effects.js?v=55.23';
import * as THREE from 'three';

const assets = {
  ring: 'arcane-ring',
  slash: 'energy-slash',
  flash: 'luminous-flare',
  mist: 'luminous-flare'
};
const floorKinds = new Set(['ring', 'slash']);
const textures = new Map();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const coarsePointer = matchMedia('(pointer: coarse)');
const textureLoader = new THREE.TextureLoader();
const palette = [0xff9658, 0xa5e7ff, 0xd0aeff, 0x95edc0, 0xe9ae6a, 0xffe9af, 0xa38cfd, 0x67c7ff, 0xb4e885, 0xff7e90];
const point = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

function effectTexture(kind) {
  if (kind.startsWith('tenshi-')) return tenshiTexture(kind);
  const name = assets[kind];
  if (!textures.has(name)) {
    const url = new URL('./rf558/' + name + '.webp', import.meta.url);
    const texture = textureLoader.load(url.href);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.set(name, texture);
  }
  return textures.get(name);
}

function effectLimit(reduced) {
  const profile = window.RF556Graphics?.profile?.();
  const mobile = coarsePointer.matches || navigator.maxTouchPoints > 0;
  if (reduced || profile === 'economy') return mobile ? 6 : 10;
  return mobile ? 15 : profile === 'quality' ? 32 : 22;
}

export class BattlePresentation {
  constructor(battle) {
    this.battle = battle;
    this.group = new THREE.Group();
    this.group.name = 'Riftfall battle artwork';
    this.plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.pools = new Map();
    this.active = [];
    battle.scene.add(this.group);
  }

  get reduced() {
    return reducedMotion.matches ||
      document.body.classList.contains('rf558-no-effects');
  }

  emit(kind, pos, color, size, life, options = {}) {
    const reduced = this.reduced;
    if (document.hidden || (reduced && kind === 'mist')) return;
    if (this.active.length >= effectLimit(reduced)) {
      if (kind !== 'ring' && kind !== 'slash' && !kind.startsWith('tenshi-seal-')) return;
      const oldest = this.active.findIndex(entry => entry.kind === 'flash' || entry.kind === 'mist' || entry.kind.startsWith('tenshi-beam-'));
      if (oldest < 0) return;
      this.recycle(this.active[oldest]);
      this.active.splice(oldest, 1);
    }
    const pool = this.pools.get(kind) || [];
    if (!this.pools.has(kind)) this.pools.set(kind, pool);
    let obj = pool.pop();
    const floor = floorKinds.has(kind) || kind.startsWith('tenshi-seal-') || kind.startsWith('tenshi-arc-');
    if (!obj) {
      const mat = {
        map: effectTexture(kind),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        toneMapped: false
      };
      obj = floor ? new THREE.Mesh(this.plane, new THREE.MeshBasicMaterial(mat)) :
        new THREE.Sprite(new THREE.SpriteMaterial(mat));
      obj.renderOrder = floor ? 4 : 5;
    }
    const yaw = options.yaw || 0;
    obj.position.copy(pos);
    obj.scale.setScalar(Math.max(.04, size * .78));
    if (floor) obj.rotation.y = yaw;
    else obj.material.rotation = yaw;
    obj.material.color.set(color ?? 0xffffff);
    const opacity = (options.opacity ?? .84) * (reduced ? .64 : 1);
    obj.material.opacity = opacity;
    this.group.add(obj);
    this.active.push({
      obj, kind, size, life, opacity, yaw, floor, age: 0,
      rise: options.rise || 0, spin: reduced ? 0 : options.spin || 0,
      stretch: options.stretch || 1
    });
  }

  swing(fighter) {
    const attack = fighter.def.light;
    const {x, z} = fighter.pos;
    const y = .92 + fighter.y;
    const dir = fighter.forward();
    const offset = attack.spin ? 0 : attack.range * .46;
    const color = attack.color ?? fighter.def.color;
    const divine=fighter.key==='tenshi';
    const kind=divine ? 'tenshi-arc-gold' : attack.spin ? 'ring' : 'slash';
    this.emit(kind, point(x + dir.x * offset, y, z + dir.z * offset),
      divine ? 0xffffff : color, clamp(attack.range * 1.45, 1.3, 9), .24, { yaw: fighter.facing + Math.PI / 2, spin: attack.spin ? 6 : 0 });
  }

  cast(fighter, color, spec) {
    const over = spec && (spec === fighter.def.over || spec.hi);
    const {x, z} = fighter.pos;
    const shade = color ?? palette[spec?.elem] ?? 0xb5e2ff;
    if (fighter.key==='tenshi') {
      const style=divinePalette(spec?.divine);
      this.emit('tenshi-seal-'+style,point(x,.10,z),0xffffff,over?4.6:3.12,over?.81:.52,{spin:.48});
      this.emit('tenshi-beam-'+style,point(x,1.22+fighter.y,z),0xffffff,over?2.6:1.45,.41,
        {rise:.66,stretch:1.38,opacity:.78});
      return;
    }
    this.emit('ring', point(x, .1, z), shade, over ? 6 : 3.45, over ? .92 : .52, { spin: 1.35 });
    this.emit('flash', point(x, 1.18 + fighter.y, z), shade, over ? 3.2 : 1.6, .36, { rise: .7, opacity: .66 });
    if (over && !this.reduced) this.battle.shake = Math.max(this.battle.shake, .32);
  }

  burst(pos, elem, color, power, grand) {
    const shade = color ?? palette[elem] ?? 0xb5e2ff;
    const strength = clamp(Number(power) || 1, .45, 3.4);
    const center = point(pos.x, Math.max(.45, pos.y) + .4, pos.z);
    this.emit('flash', center, shade, (grand ? 2.5 : 1.38) * strength, grand ? .54 : .28,
      { rise: grand ? .85 : .3, stretch: grand ? 1.18 : 1 });
    if (grand) {
      this.emit('ring', point(pos.x, Math.max(.1, Math.min(.32, pos.y)), pos.z), shade,
        3.1 * strength, .66, { spin: .85 });
      if (!this.reduced) this.battle.flashLight(center, shade, Math.min(1.7, strength), .28);
    }
  }

  spark(pos, color, size = 1) {
    this.emit('flash', pos, color, Math.max(.28, size * 1.5), .18, { rise: .42 });
  }

  puff(pos, color, size = 1) {
    this.emit('mist', pos, color, size * 2.2, .38, { rise: .65, opacity: .25, stretch: .6 });
  }

  tick(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i];
      const {obj, opacity, size, life, floor, stretch} = entry;
      entry.age += dt;
      if (entry.age >= life) {
        this.recycle(entry);
        this.active.splice(i, 1);
        continue;
      }
      const progress = entry.age / life;
      const scale = size * (.78 + progress * .64);
      obj.scale.set(scale, floor ? scale : scale * stretch, scale * (floor ? stretch : 1));
      obj.position.y += entry.rise * dt;
      obj.material.opacity = opacity * Math.pow(1 - progress, 1.35);
      if (floor) obj.rotation.y = entry.yaw + entry.spin * entry.age;
    }
  }

  recycle(entry) {
    entry.obj.removeFromParent();
    const pool = this.pools.get(entry.kind);
    if (pool.length < 8) pool.push(entry.obj);
    else entry.obj.material.dispose();
  }

  dispose() {
    for (const {obj} of this.active) obj.material.dispose();
    for (const pool of this.pools.values()) for (const obj of pool) obj.material.dispose();
    this.group.clear();
    this.group.removeFromParent();
    this.plane.dispose();
    this.active.length = 0;
    this.pools.clear();
  }
}

export function presentationFor(battle) {
  return (battle.presentation ??= new BattlePresentation(battle));
}
