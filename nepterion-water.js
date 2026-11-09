// RF_NEPT_V18_GUARD_ILLUSTRATED_30S: Riftfall Arena - chief-only supreme water character combat.
// Uses existing Battle/Fighter APIs; no modification to the provided GLB bytes.
import * as THREE from 'three';

const KEY = 'nepterion';
const WATER = 0x35d7ff;


export function installNepterionCombat({ Battle, Fighter }) {
  if (!Battle?.prototype || !Fighter?.prototype || Battle.prototype.__nepterionInstalled) return;
  Battle.prototype.__nepterionInstalled = true;

  // Keep the imported painted GLB colors when the character awakens.
  const oldAwakenPaint = Fighter.prototype.applyRed;
  Fighter.prototype.applyRed = function () {
    if (this.key === KEY) { this.redMats = []; return; }
    return oldAwakenPaint.call(this);
  };

  // Guard art: one persistent 30-second magic circle, without any cooldown.
  // Refreshing guard reuses the same meshes so repeated inputs do not pile up draw calls.
  const FIELD_SECONDS = 30;
  const FIELD_RADIUS = 6.7;
  const ICE_SECONDS = 2.6;
  const ICE_TINT = new THREE.Color(0x82eaff);
  const ICE_GLOW = new THREE.Color(0x46bde9);
  const GUARD_SLOT = 'nep_guard';
  // One textured ground quad; all painted detail is in the transparent CG illustration.
  // No 3D torus/ring shapes or new geometry every time Guard is pressed.
  const SEAL_GEO = new THREE.PlaneGeometry(2, 2);
  const SEAL_URL = new URL('./assets/fx/nepterion-ocean-seal.webp', import.meta.url).href;
  let sealTexture;
  function oceanSealMap() {
    if (!sealTexture) {
      sealTexture = new THREE.TextureLoader().load(SEAL_URL);
      sealTexture.colorSpace = THREE.SRGBColorSpace;
      sealTexture.anisotropy = 2;
    }
    return sealTexture;
  }

  function newGuard(owner) {
    const battle = owner.battle;
    if (!battle?.fx) return null;
    if (owner._nepGuardField) {
      owner._nepGuardField.remaining = FIELD_SECONDS;
      return owner._nepGuardField;
    }
    const group = new THREE.Group();
    const art = new THREE.Mesh(SEAL_GEO, new THREE.MeshBasicMaterial({
      map: oceanSealMap(), color: 0xffffff, transparent:true, opacity:0.84,
      depthTest:true, depthWrite:false, side:THREE.DoubleSide,
      blending: THREE.AdditiveBlending, toneMapped:false
    }));
    art.rotation.x=-Math.PI/2;
    art.scale.setScalar(FIELD_RADIUS);
    art.renderOrder=12;
    group.add(art);
    group.position.set(owner.pos.x,0.09,owner.pos.z);
    battle.fx.add(group);
    const field = { owner, group, meshes:[art], remaining:FIELD_SECONDS, clock:0 };
    owner._nepGuardField = field;
    (battle._nepGuardFields ||= new Set()).add(field);
    battle.ui?.popup?.(owner.pos,'神海護陣《蒼氷封界》30秒・再使用制限なし','#7fedff');
    return field;
  }
  function endGuard(field) {
    if (!field || field.closed) return;
    field.closed = true;
    field.group.removeFromParent();
    for (const mesh of field.meshes) mesh.material.dispose();
    field.owner.battle?._nepGuardFields?.delete(field);
    if(field.owner._nepGuardField === field) field.owner._nepGuardField = null;
  }
  function icePaint(enemy) {
    if (enemy._nepIcePaint || !enemy.visual) return;
    const saved=[];
    const known=new Set();
    enemy.visual.traverse(node=>{
      if (!node.isMesh || !node.material) return;
      for (const mat of Array.isArray(node.material)?node.material:[node.material]) {
        if (!mat || known.has(mat)) continue;
        known.add(mat);
        const prev={mat,color:mat.color?.clone?.(),emissive:mat.emissive?.clone?.(),intensity:mat.emissiveIntensity};
        if(mat.color) mat.color.copy(ICE_TINT);
        if(mat.emissive){mat.emissive.copy(ICE_GLOW);mat.emissiveIntensity=Math.max(.16,mat.emissiveIntensity||0);}
        saved.push(prev);
      }
    });
    enemy._nepIcePaint = saved;
  }
  function restoreIce(enemy) {
    const saved = enemy._nepIcePaint;
    if (!saved) return;
    for(const e of saved) {
      if(e.color&&e.mat.color)e.mat.color.copy(e.color);
      if(e.emissive&&e.mat.emissive)e.mat.emissive.copy(e.emissive);
      if(e.intensity!=null)e.mat.emissiveIntensity=e.intensity;
    }
    enemy._nepIcePaint=null;
    enemy._nepIceTimer=0;
  }
  function freezeTouch(enemy, field) {
    enemy.status ||= {};
    // Native combat movement/ability locks; never delete health or replace the model.
    enemy.status.freeze = Math.max(enemy.status.freeze||0,ICE_SECONDS);
    enemy.stun = Math.max(enemy.stun||0,ICE_SECONDS);
    enemy._nepIceTimer = ICE_SECONDS;
    if (!enemy.remoteAuth) {
      enemy.vel?.set?.(0,0,0);
      if (enemy.action && !enemy.action.type?.startsWith?.('death')) enemy.action=null;
    }
    icePaint(enemy);
  }
  function tickGuard(field, dt) {
    const owner=field.owner;
    if(owner.dead || owner.battle?.ended || !field.group.parent) {endGuard(field);return;}
    field.remaining -= dt;
    if(field.remaining <= 0){endGuard(field);return;}
    field.clock += dt;
    field.group.position.set(owner.pos.x,0.09,owner.pos.z);
    field.group.rotation.y += dt*.35;
    field.meshes[0].material.opacity = .78 + .14*Math.sin(field.clock*2.0);
    const r2=FIELD_RADIUS*FIELD_RADIUS;
    for (const enemy of owner.battle.fighters) {
      if(enemy===owner || enemy.dead || enemy.team===owner.team)continue;
      const dx=enemy.pos.x-owner.pos.x,dz=enemy.pos.z-owner.pos.z;
      if(dx*dx+dz*dz<=r2) freezeTouch(enemy,field);
    }
  }
  // The battle already relays 'cast' events. We reserve one named slot for the
  // guard, so remote players see the same circle and are frozen on contact.
  const oldBattleCast=Battle.prototype.cast;
  Battle.prototype.cast=function(fighter,slot,net){
    if(slot===GUARD_SLOT && fighter?.key===KEY && !this.ended && !fighter.dead){
      newGuard(fighter);
      if(!net && !fighter.remoteAuth && this.net && fighter.netId){
        this.net.cast({id:fighter.netId,slot:GUARD_SLOT,tx:fighter.pos.x,tz:fighter.pos.z,ry:fighter.facing});
      }
      return;
    }
    return oldBattleCast.call(this,fighter,slot,net);
  };

  const oldUpdate = Fighter.prototype.update;
  Fighter.prototype.update = function (dt, input) {
    const result = oldUpdate.call(this, dt, input);
    const seconds = Math.max(0, Math.min(0.06, Number(dt) || 0));
    if (this.key === KEY && !this.dead && !this.battle?.ended) {
      if (!this.remoteAuth) {
        // Ocean deity: constant tide regeneration. Frame-rate independent.
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.016 * seconds);
        this.flux = Math.min(100, this.flux + 15 * seconds);
        // Rising edge of the existing Guard button. No cooldown; re-press refreshes 30s.
        const held=!!input?.guard;
        if (held && !this._nepGuardHeld) this.battle?.cast(this,GUARD_SLOT);
        this._nepGuardHeld=held;
        if (this.guard) this.stun = 0;
      }
      if (this._nepGuardField) tickGuard(this._nepGuardField,seconds);
    }
    if (this._nepIcePaint) {
      this._nepIceTimer=Math.max(0,(this._nepIceTimer||0)-seconds);
      if(this.dead || (this._nepIceTimer<=0 && !(this.status?.freeze>0)))restoreIce(this);
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
    for(const field of [...(this._nepGuardFields||[])]) endGuard(field);
    this._nepGuardFields?.clear();
    for(const fighter of this.fighters || []) if(fighter._nepIcePaint)restoreIce(fighter);
    return oldDispose.apply(this, args);
  };
}
