import * as THREE from 'three';
import { divinePalette, tenshiTexture } from '../tenshi-effects.js?v=55.23';
import { combatTexture } from './combat-art.js?v=55.27';

const motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
const pointer = globalThis.matchMedia?.('(pointer: coarse)');
const palette = [0xff9658, 0xa5e7ff, 0xd0aeff, 0x95edc0, 0xe9ae6a, 0xffe9af, 0xa38cfd, 0x67c7ff, 0xb4e885, 0xff7e90, 0xffe0a0];
const seals = ['tide', 'prism', 'prism', 'tide', 'script', 'prism', 'script', 'tide', 'script', 'script', 'prism'];
const narrow = { limit: 8, shards: 0 };
const desktopEconomy = { limit: 12, shards: 0 };
const mobileStandard = { limit: 16, shards: 5 };
const mobileHigh = { limit: 22, shards: 7 };
const desktopStandard = { limit: 24, shards: 7 };
const desktopHigh = { limit: 34, shards: 11 };
const shardMax = desktopHigh.shards;
const shardTint = new THREE.Color(0xffefcf);
const point = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const floorKind = kind => kind === 'slash' || kind === 'shock' || kind.startsWith('seal-') ||
  kind.startsWith('tenshi-seal-') || kind.startsWith('tenshi-arc-');
const effectPriority = kind => {
  if (kind.startsWith('tenshi-seal-')) return 3;
  if (floorKind(kind)) return 2;
  return kind === 'flash' || kind.startsWith('tenshi-beam-') ? 1 : 0;
};

function reducedMotion() {
  return !!motion?.matches || document.body.classList.contains('rf558-no-effects');
}

function visualBudget(reduced) {
  const mobile = pointer?.matches || navigator.maxTouchPoints > 0;
  const tier = window.RF45Performance?.getQuality?.();
  const profile = window.RF556Graphics?.profile?.();
  if (reduced || tier === 'low' || profile === 'economy') return mobile ? narrow : desktopEconomy;
  const high = tier !== 'standard' && profile !== 'balanced';
  if (mobile) return high ? mobileHigh : mobileStandard;
  return high ? desktopHigh : desktopStandard;
}

function textureFor(kind) {
  return kind.startsWith('tenshi-') ? tenshiTexture(kind) : combatTexture(kind);
}

const baseMaterial = {
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false,
  toneMapped: false
};

export class BattlePresentation {
  constructor(battle) {
    this.battle = battle;
    this.group = new THREE.Group();
    this.group.name = 'Riftfall battle artwork';
    this.plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.pools = new Map();
    this.active = [];
    this.shardSequence = 0;
    battle.scene.add(this.group);
  }

  reserve(priority, limit) {
    if (this.active.length < limit) return true;
    if (priority === 0) return false;
    while (this.active.length >= limit) {
      let victim = -1;
      let lowest = priority >= 2 ? priority + 1 : priority;
      for (let i = 0; i < this.active.length; i++) {
        if (this.active[i].priority >= lowest) continue;
        victim = i;
        lowest = this.active[i].priority;
      }
      if (victim < 0) return false;
      this.recycle(this.active[victim]);
      this.active.splice(victim, 1);
    }
    return true;
  }

  acquire(kind, create) {
    let pool = this.pools.get(kind);
    if (!pool) {
      pool = [];
      this.pools.set(kind, pool);
    }
    return pool.pop() || create();
  }

  emit(kind, pos, color, size, life, options = {}) {
    if (document.hidden) return;
    const reduced = reducedMotion();
    if (reduced && kind === 'mist') return;
    const priority = effectPriority(kind);
    if (!this.reserve(priority, visualBudget(reduced).limit)) return;
    const floor = floorKind(kind);
    const obj = this.acquire(kind, () => {
      const material = { ...baseMaterial, map: textureFor(kind) };
      if (floor && !kind.startsWith('tenshi-')) material.blending = THREE.NormalBlending;
      const object = floor ? new THREE.Mesh(this.plane, new THREE.MeshBasicMaterial(material)) :
        new THREE.Sprite(new THREE.SpriteMaterial(material));
      object.renderOrder = floor ? 3 : 4;
      return object;
    });
    const yaw = options.yaw || 0;
    const stretch = options.stretch || 1;
    const opacity = (options.opacity ?? .78) * (reduced ? .72 : 1);
    obj.position.copy(pos);
    const start = Math.max(.04, size * .76);
    obj.scale.set(start, floor ? start : start * stretch, floor ? start * stretch : 1);
    if (floor) obj.rotation.y = yaw;
    else obj.material.rotation = yaw;
    obj.material.color.set(color ?? 0xffffff);
    obj.material.opacity = opacity;
    this.group.add(obj);
    this.active.push({
      obj, kind, priority, size, life, opacity, yaw, floor, stretch, age: 0,
      rise: options.rise || 0, spin: reduced ? 0 : options.spin || 0
    });
  }

  shards(pos, color, size) {
    if (document.hidden) return;
    const { limit, shards } = visualBudget(reducedMotion());
    if (!shards || !this.reserve(0, limit)) return;
    const obj = this.acquire('shards', () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(shardMax * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const material = new THREE.PointsMaterial({ ...baseMaterial, map: combatTexture('shard'), sizeAttenuation: true });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      points.userData.velocities = new Float32Array(shardMax * 3);
      points.renderOrder = 5;
      return points;
    });
    const data = obj.geometry.getAttribute('position');
    const velocity = obj.userData.velocities;
    const power = clamp(Number(size) || 1, .25, 2.5);
    const phase = ++this.shardSequence * .62;
    for (let i = 0; i < shards; i++) {
      const j = i * 3;
      const angle = phase + i * 2.39996;
      const speed = (2.8 + i % 4 * .67) * power;
      velocity[j] = Math.sin(angle) * speed;
      velocity[j + 1] = (1.8 + i % 5 * .72) * power;
      velocity[j + 2] = Math.cos(angle) * speed;
      data.setXYZ(i, velocity[j] * .018, velocity[j + 1] * .018, velocity[j + 2] * .018);
    }
    data.needsUpdate = true;
    obj.geometry.setDrawRange(0, shards);
    obj.position.copy(pos);
    obj.material.color.set(color ?? 0xffffff).lerp(shardTint, .36);
    obj.material.opacity = .87;
    obj.material.size = .13 * Math.sqrt(power);
    this.group.add(obj);
    this.active.push({ obj, kind: 'shards', priority: 0, life: .43, age: 0, count: shards, power });
  }

  swing(fighter) {
    const attack = fighter.def.light;
    const { x, z } = fighter.pos;
    const dir = fighter.forward();
    const offset = attack.spin ? 0 : attack.range * .48;
    const color = attack.color ?? fighter.def.color;
    const divine = fighter.key === 'tenshi';
    const combo = (fighter.combo || 0) % 3;
    this.emit(divine ? 'tenshi-arc-gold' : attack.spin ? 'shock' : 'slash',
      point(x + dir.x * offset, .86 + fighter.y, z + dir.z * offset),
      divine ? 0xffffff : color, clamp(attack.range * 1.65, 1.6, 9), .25, {
        yaw: fighter.facing + Math.PI / 2 + (attack.spin ? 0 : (combo - 1) * .15),
        spin: attack.spin ? 2.8 : 0,
        stretch: attack.spin ? 1 : .92,
        opacity: .91
      });
  }

  cast(fighter, color, spec, strong = false) {
    const over = strong || Boolean(spec && (spec === fighter.def.over || spec === fighter.def.hi || spec.hi === true));
    const { x, z } = fighter.pos;
    const shade = color ?? palette[spec?.elem] ?? 0xb5e2ff;
    if (fighter.key === 'tenshi') {
      const style = divinePalette(spec?.divine);
      this.emit('tenshi-seal-' + style, point(x, .10, z), 0xffffff, over ? 4.6 : 3.12, over ? .81 : .52, { spin: .48 });
      this.emit('tenshi-beam-' + style, point(x, 1.22 + fighter.y, z), 0xffffff, over ? 2.6 : 1.45, .41,
        { rise: .66, stretch: 1.38, opacity: .78 });
      return;
    }
    this.emit('seal-' + (seals[spec?.elem] || 'prism'), point(x, .095, z), shade, over ? 6.2 : 3.75,
      over ? .88 : .50, { yaw: fighter.facing, spin: over ? .54 : .87, opacity: .96 });
    this.emit('flash', point(x, .93 + fighter.y, z), shade, over ? 2.25 : 1.24, .29,
      { rise: .65, opacity: over ? .72 : .58, stretch: .84 });
    if (over && !reducedMotion()) {
      this.emit('shock', point(x, .075, z), shade, 4.7, .60, { spin: -.45, opacity: .62 });
      this.battle.shake = Math.max(this.battle.shake, .32);
    }
  }

  burst(pos, elem, color, power, grand) {
    const shade = color ?? palette[elem] ?? 0xb5e2ff;
    const strength = clamp(Number(power) || 1, .45, 3.4);
    const center = point(pos.x, Math.max(.45, pos.y) + .27, pos.z);
    this.emit('flash', center, shade, (grand ? 1.95 : 1.20) * strength, grand ? .48 : .25,
      { rise: grand ? .75 : .32, stretch: grand ? .89 : .81, opacity: grand ? .84 : .69 });
    if (grand) {
      this.emit('shock', point(pos.x, Math.max(.075, Math.min(.19, pos.y)), pos.z), shade,
        3.3 * strength, .57, { spin: .58, opacity: .82 });
      if (!reducedMotion()) this.battle.flashLight(center, shade, Math.min(1.7, strength), .28);
    }
  }

  spark(pos, color, size = 1) {
    this.emit('flash', pos, color, Math.max(.28, size * 1.45), .18, { rise: .38, opacity: .78, stretch: .83 });
  }

  puff(pos, color, size = 1) {
    this.emit('mist', pos, color, size * 2.0, .34, { rise: .65, opacity: .20, stretch: .62 });
  }

  tick(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i];
      const { obj, opacity, size, life, floor, stretch } = entry;
      entry.age += dt;
      if (entry.age >= life) {
        this.recycle(entry);
        this.active.splice(i, 1);
        continue;
      }
      const progress = entry.age / life;
      if (entry.kind === 'shards') {
        const attr = obj.geometry.getAttribute('position');
        const v = obj.userData.velocities;
        for (let j = 0; j < entry.count; j++) {
          const offset = j * 3;
          v[offset + 1] -= dt * 8;
          attr.setXYZ(j, attr.getX(j) + v[offset] * dt,
            Math.max(.04 - obj.position.y, attr.getY(j) + v[offset + 1] * dt),
            attr.getZ(j) + v[offset + 2] * dt);
        }
        attr.needsUpdate = true;
        obj.material.opacity = .87 * (1 - progress);
        obj.material.size = .13 * Math.sqrt(entry.power) * (1 - progress * .45);
        continue;
      }
      const scale = size * (.76 + progress * (floor ? .73 : .53));
      obj.scale.set(scale, floor ? scale : scale * stretch, floor ? scale * stretch : 1);
      obj.position.y += entry.rise * dt;
      obj.material.opacity = opacity * Math.pow(1 - progress, floor ? 1.06 : 1.53);
      if (floor) obj.rotation.y = entry.yaw + entry.spin * entry.age;
    }
  }

  recycle(entry) {
    entry.obj.removeFromParent();
    const pool = this.pools.get(entry.kind);
    if (pool.length < 6) pool.push(entry.obj);
    else this.disposeObject(entry.obj);
  }

  disposeObject(obj) {
    obj.material.dispose();
    if (obj.isPoints) obj.geometry.dispose();
  }

  dispose() {
    for (const { obj } of this.active) this.disposeObject(obj);
    for (const pool of this.pools.values()) for (const obj of pool) this.disposeObject(obj);
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
