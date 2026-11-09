// RF_NEPT_V1: Riftfall Arena - chief-only supreme water character combat.
// Uses existing Battle/Fighter APIs; no modification to the provided GLB bytes.
import * as THREE from 'three';

const KEY = 'nepterion';
const WATER = 0x35d7ff;
const RING_GEOMETRY = new THREE.RingGeometry(0.89, 1.0, 56);

export function installNepterionCombat({ Battle, Fighter }) {
  if (!Battle?.prototype || !Fighter?.prototype || Battle.prototype.__nepterionInstalled) return;
  Battle.prototype.__nepterionInstalled = true;

  // Keep the imported painted GLB colors when the character awakens.
  const oldAwakenPaint = Fighter.prototype.applyRed;
  Fighter.prototype.applyRed = function () {
    if (this.key === KEY) { this.redMats = []; return; }
    return oldAwakenPaint.call(this);
  };

  const oldUpdate = Fighter.prototype.update;
  Fighter.prototype.update = function (dt, input) {
    const result = oldUpdate.call(this, dt, input);
    if (this.key === KEY && !this.dead && !this.remoteAuth && !this.battle?.ended) {
      const seconds = Math.max(0, Math.min(0.06, Number(dt) || 0));
      // Ocean deity: constant tide regeneration. Frame-rate independent.
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.016 * seconds);
      this.flux = Math.min(100, this.flux + 15 * seconds);
      if (this.guard) this.stun = 0;
    }
    return result;
  };

  const oldReceive = Fighter.prototype.receive;
  Fighter.prototype.receive = function (damage, stun, kx, kz) {
    if (this.key !== KEY || this.remoteAuth || this.dead) {
      return oldReceive.call(this, damage, stun, kx, kz);
    }
    const shield = this.guard ? 0.09 : 0.38;
    const incoming = Math.max(0, Number(damage) || 0) * shield;
    // One emergency rebirth per battle. Keeps the normal KO logic intact otherwise.
    if (!this._nepterionRevived && this.hp > 0 && incoming * this.defMul >= this.hp) {
      this._nepterionRevived = true;
      this.hp = Math.max(this.hp, this.maxHp * 0.78);
      this.status = {};
      this.stun = 0;
      this.battle?.ui?.popup?.(this.pos, '神海転生《生命の大潮》', '#79f9ff');
      this.battle?.ui?.sfx?.('burst');
    }
    return oldReceive.call(this, incoming, Math.max(0, stun || 0) * 0.08,
      (kx || 0) * 0.12, (kz || 0) * 0.12);
  };

  const oldStatus = Fighter.prototype.applyStatus;
  Fighter.prototype.applyStatus = function (key) {
    if (this.key === KEY && !this.dead && !this.remoteAuth) {
      // Immune to crowd-control and damage-over-time status.
      return;
    }
    return oldStatus.call(this, key);
  };

  function oceanWaves(battle, owner, type) {
    if (!battle.fx?.parent) return;
    const group = new THREE.Group();
    const isGrand = type === 'hi' || type === 'over';
    const rings = isGrand ? 3 : 2;
    const radius = type === 'hi' ? 12 : type === 'over' ? 11 : 8;
    const entries = [];
    const base = new THREE.Color(WATER);
    for (let i = 0; i < rings; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: i % 2 ? 0x195dff : base, transparent: true, opacity: 0.48,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(RING_GEOMETRY, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.13 + i * 0.075;
      group.add(mesh);
      entries.push(mesh);
    }
    group.position.copy(owner.pos);
    group.position.y = 0;
    battle.fx.add(group);
    const item = { group, entries, done: false };
    (battle._nepterionVisuals ||= new Set()).add(item);
    const cleanup = () => {
      if (item.done) return;
      item.done = true;
      group.removeFromParent();
      for (const mesh of entries) mesh.material.dispose();
      battle._nepterionVisuals?.delete(item);
    };
    const length = isGrand ? 1.25 : 0.8;
    let elapsed = 0;
    battle.addEffect((dt) => {
      if (!battle.fx?.parent || battle.ended) { cleanup(); return false; }
      elapsed += Math.max(0, dt);
      const k = Math.min(1, elapsed / length);
      entries.forEach((mesh, i) => {
        const delay = i / (rings * 2);
        const progress = Math.max(0, (k - delay) / (1 - delay));
        mesh.scale.setScalar(radius * (0.13 + 1.06 * progress));
        mesh.material.opacity = 0.50 * (1 - progress) * (1 - progress);
      });
      if (k >= 1) { cleanup(); return false; }
      return true;
    });
  }

  const oldExecute = Battle.prototype.executeCast;
  Battle.prototype.executeCast = function (fighter, slot, networkCast) {
    const result = oldExecute.call(this, fighter, slot, networkCast);
    if (fighter?.key !== KEY || this.ended) return result;
    const index = +String(slot).slice(1);
    if (slot === 'hi' || slot === 'over' ||
        (String(slot)[0] === 's' && [2, 3, 6, 9].includes(index))) {
      oceanWaves(this, fighter, String(slot));
    }
    if (!fighter.remoteAuth && (slot === 'over' || slot === 'hi')) {
      // Ultimate cast replenishes health and instantly dispels debuffs.
      fighter.hp = Math.min(fighter.maxHp, fighter.hp + fighter.maxHp * (slot === 'hi' ? 1 : 0.7));
      fighter.status = {};
      fighter.stun = 0;
      this.ui.popup?.(fighter.pos, '海皇の祝福・生命完全復元', '#8ff9ff');
    }
    return result;
  };

  const oldDispose = Battle.prototype.dispose;
  Battle.prototype.dispose = function (...args) {
    for (const item of this._nepterionVisuals || []) {
      item.group.removeFromParent();
      for (const mesh of item.entries) mesh.material.dispose();
      item.done = true;
    }
    this._nepterionVisuals?.clear();
    return oldDispose.apply(this, args);
  };
}
