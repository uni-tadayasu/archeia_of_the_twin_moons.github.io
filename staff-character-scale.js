// RF_STAFF_SCALE_V27: player-only size normalization. Does not resize enemy bosses or GLB assets.
export function installStaffAvatarScale({Fighter,FIGHTERS,ROSTER}){
  if(!Fighter?.prototype||Fighter.prototype.__rfStaffAvatarScaleV27)return;
  Fighter.prototype.__rfStaffAvatarScaleV27=true;
  const sizes=(ROSTER||[]).map(k=>Number(FIGHTERS?.[k]?.height)).filter(h=>h>=1.2&&h<=8).sort((a,b)=>a-b);
  const median=sizes.length?sizes[Math.floor(sizes.length/2)]:3.5;
  const target=Math.max(2.8,Math.min(4.4,median));
  if(typeof window!=='undefined')window.__rfStaffTargetHeight=target;
  const previous=Fighter.prototype.buildModel;
  Fighter.prototype.buildModel=function(gltf,...rest){
    const special=this.def?.special==='chief'||this.def?.special==='operator';
    // Local player, friendly controllable ally, verified online opponent. Keep scripted enemy bosses large.
    const playerSide=(this.isPlayer || (this.team===0 && !this.cpu) || (this.remoteAuth && this.netId!=='boss'));
    if(special && playerSide && this.def?.height>0){
      this.scale=target/this.def.height;
      this.radius=.45*this.scale*(this.def.height/1.8);
    }
    return previous.call(this,gltf,...rest);
  };
}
