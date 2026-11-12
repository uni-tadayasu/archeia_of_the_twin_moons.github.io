import * as THREE from 'three';
import { Field } from '../field.js?v=55.21';
import { approachYaw } from './rf-camera-v5520.js?v=55.21';

const originalUpdate = Field.prototype.update;
Field.prototype.update = function(dt, input, camera) {
  const view = this.o?.cameraView;
  if (!view) return originalUpdate.call(this, dt, input, camera);
  const result = originalUpdate.call(this, dt, input, null);
  if (!camera || !this.player?.pos || dt <= 0) return result;

  const p = this.player.pos;
  const inside = Boolean(this.__rf563Story?.mode || this.isDungeonAt(p.x, p.z));
  const nearBoss = this.boss && !this.boss.dead && this.boss.pos.distanceToSquared(p) < 24 ** 2;
  const moving = Math.hypot(input?.mx || 0, input?.mz || 0) > .15;
  const automatic = view.yaw === null;
  if (moving && automatic) {
    this.rfStoryYaw = approachYaw(this.rfStoryYaw ?? 0, input.mx, input.mz, 1 - Math.exp(-6 * dt));
  }
  const yaw = view.yaw ?? this.rfStoryYaw ?? 0;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const portrait = camera.aspect < 1;
  const dist = (inside ? 8 : nearBoss ? 12 : moving ? 18.5 : 16.5) * (portrait ? .82 : 1);
  const height = inside ? 13.3 : nearBoss ? 10.2 : portrait ? 9.1 : 10.4;
  const target = (this.rfStoryCamera ||= new THREE.Vector3()).set(p.x + sin * dist, height, p.z + cos * dist);
  if (!this.rfStoryCameraReady || camera.position.distanceToSquared(target) > 1600) {
    camera.position.copy(target);
    this.rfStoryCameraReady = true;
  } else {
    camera.position.lerp(target, 1 - Math.exp(-5.2 * dt));
  }
  const lookAhead = automatic && !inside && !nearBoss ? (portrait ? 1.6 : 3.4) : 0;
  camera.lookAt(p.x - sin * lookAhead, inside ? 1.25 : 1.55, p.z - cos * lookAhead);
  return result;
};
