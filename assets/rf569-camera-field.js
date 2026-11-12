
/* Riftfall Arena V55.19 — auto camera switching for story fields and Infinite Castle.
 * Infinite Castle camera is patched in rf568-castle-maze.js.
 * This file adds auto-switch exploration camera to field gameplay and preserves other modes.
 */
import * as THREE from 'three';
import { Field } from '../field.js?v=rf-v9-2-20261109';

if(!window.__rf569FieldCamera){
  window.__rf569FieldCamera=true;
  const oldUpdate=Field.prototype.update;
  Field.prototype.update=function(dt,inp,camera){
    const result=oldUpdate.call(this,dt,inp,camera);
    if(!camera||!this?.player?.pos) return result;
    const p=this.player;
    const region=(document.getElementById('field-region')?.textContent||'') + ' ' + (this.objective?.()||'');
    const dungeonLike=/城|天守|神殿|迷宮|洞窟|塔|古城|地下/i.test(region) || !!this.maze;
    const running=!!inp && (Math.hypot(inp.mx||0, inp.mz||0)>.55 || !!inp.run);
    const bossNear=this.boss && !this.boss.dead && Math.hypot(this.boss.pos.x-p.pos.x,this.boss.pos.z-p.pos.z)<24;
    if(!this.__rf569Facing) this.__rf569Facing=new THREE.Vector3(0,0,1);
    const moveVec=new THREE.Vector3((inp?.mx||0),0,(inp?.mz||0));
    if(moveVec.lengthSq()>.04){
      moveVec.normalize();
      this.__rf569Facing.lerp(moveVec,1-Math.exp(-6*Math.max(0,dt)));
    }
    const face=this.__rf569Facing;
    let height=12,dist=12.8,lookY=1.2,side=0;
    if(dungeonLike){ height=14.8; dist=8.3; lookY=1.0; }
    else if(bossNear){ height=10.4; dist=11.2; lookY=1.35; side=1.6; }
    else if(running){ height=11.2; dist=13.8; lookY=1.2; }
    else { height=12.6; dist=11.4; lookY=1.2; side=.9; }
    const tx=p.pos.x-face.x*dist + face.z*side;
    const tz=p.pos.z-face.z*dist - face.x*side;
    if(!this.__rf569CamTarget) this.__rf569CamTarget=new THREE.Vector3();
    this.__rf569CamTarget.set(tx,height,tz);
    camera.position.lerp(this.__rf569CamTarget,1-Math.exp(-4.4*Math.max(0,dt)));
    camera.lookAt(p.pos.x,lookY,p.pos.z);
    return result;
  };
  window.RF569CameraMode={version:'55.19',mode:'auto'};
}
