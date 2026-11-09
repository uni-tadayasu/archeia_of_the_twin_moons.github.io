// RF_KINOSAKI_V27: Wind combat and safe motion for 城崎三位.
// The original GLB's meshes, geometry, UVs, skin weights, textures and material shaders are unchanged.
import * as THREE from 'three';
const KEY = 'kinosaki_sanmi';
const X = new THREE.Vector3(1,0,0), Z = new THREE.Vector3(0,0,1);
const qtemp = new THREE.Quaternion();
const LIMIT = (v,min,max)=>Math.min(max,Math.max(min,v));
const roles = [
  ['lArm',/(?:left|_l\b|\.l\b|^l_).*(?:arm|shoulder|sleeve|hand|腕|袖)|(?:arm|shoulder|sleeve|hand|腕|袖).*(?:left|_l\b|\.l\b|左)/i],
  ['rArm',/(?:right|_r\b|\.r\b|^r_).*(?:arm|shoulder|sleeve|hand|腕|袖)|(?:arm|shoulder|sleeve|hand|腕|袖).*(?:right|_r\b|\.r\b|右)/i],
  ['lLeg',/(?:left|_l\b|\.l\b|^l_).*(?:leg|thigh|hip|foot|腿|脚|足)|(?:leg|thigh|hip|foot|腿|脚|足).*(?:left|_l\b|\.l\b|左)/i],
  ['rLeg',/(?:right|_r\b|\.r\b|^r_).*(?:leg|thigh|hip|foot|腿|脚|足)|(?:leg|thigh|hip|foot|腿|脚|足).*(?:right|_r\b|\.r\b|右)/i],
  ['spine',/spine|chest|torso|upperbody|胸|胴体|背骨/i],
  ['head',/head|neck|頭|首/i]
];
const CLIPS={idle:/idle|stand|wait|待機/i,walk:/walk|walking|歩行/i,run:/run|sprint|jog|dash|走行/i,attack:/attack|strike|punch|slash|swing|hit|攻撃/i,cast:/magic|cast|chant|spell|skill|詠唱/i};
function classify(model) {
  const found=new Map();
  // Prefer native bones. For a model without bones, only named independent transform nodes.
  let bones=0; model.traverse(n=>{if(n.isBone)bones++});
  model.traverse(n=>{
    if(!n.name || n===model) return;
    if(bones ? !n.isBone : (!n.isGroup && !n.isMesh))return;
    for(const [role,pattern] of roles){if(!found.has(role) && pattern.test(n.name)){found.set(role,n);break;}}
  });
  return {bones,found};
}
function getClips(clips){
  const obj={};for(const [key,re] of Object.entries(CLIPS))obj[key]=(clips||[]).find(c=>re.test(c.name||''))||null;
  return obj;
}
function newMotion(model,clips=[],mixer=null){
  if(!model)return null;
  const {bones,found}=classify(model);
  const authored=getClips(clips);
  const originals=new Map([...found.values()].map(n=>[n,n.quaternion.clone()]));
  const startPos=model.position.clone(), startRot=model.quaternion.clone();
  let t=0,prev='';let action=null;
  const player={
    tick(dt,{moving=false,running=false,attack=false,cast=false}={}){
      dt=LIMIT(Number(dt)||0,0,.06);t+=dt;
      const mode=attack?'attack':cast?'cast':moving?(running?'run':'walk'):'idle';
      // Use the artist's original animations whenever they exist.
      const clip=authored[mode]||((mode==='run')?authored.walk:null)||((mode==='attack'||mode==='cast')?authored.idle:null);
      if(mixer && clip && (prev!==mode || !action)){
        const next=mixer.clipAction(clip);next.reset().fadeIn(.12).play();
        if(action&&action!==next)action.fadeOut(.12);
        action=next;
      }
      prev=mode;
      const movePower=moving?(running?1:.60):.05;
      const freq=running?11.2:7.1, step=Math.sin(t*freq), anti=Math.sin(t*freq+Math.PI);
      const attackSwing=attack?Math.sin((t%0.46)/.46*Math.PI)*.9:0;
      const castPose=cast?0.45+Math.sin(t*7)*.12:0;
      const pose={
        lLeg:step*.42*movePower,rLeg:anti*.42*movePower,
        lArm:anti*.32*movePower-castPose*.8,
        rArm:step*.32*movePower-attackSwing-castPose,
        spine:attackSwing*.1+Math.sin(t*2.2)*.018,
        head:Math.sin(t*1.3)*.022
      };
      if(found.size && !clip){
        for(const [role,n] of found){
          const original=originals.get(n);if(!original)continue;
          const val=pose[role]||0;
          n.quaternion.copy(original).multiply(qtemp.setFromAxisAngle(role==='head'?Z:X,val));
        }
      }
      if(!found.size && !clip){
        // A unified mesh cannot articulate without modifying geometry/skin data.
        // Preserve appearance by moving only its root; no vertex shader alteration.
        model.position.copy(startPos);
        model.position.y += moving ? Math.abs(step)*(running?.085:.055) : Math.sin(t*2.2)*.012;
        model.quaternion.copy(startRot).multiply(qtemp.setFromAxisAngle(Z,Math.sin(t*freq*.5)*movePower*.032-attackSwing*.1));
      }
    },
    dispose(){
      if(action)action.stop();
      for(const [n,original] of originals)n.quaternion.copy(original);
      model.position.copy(startPos);model.quaternion.copy(startRot);
    },
    getMode(){return found.size?bones?'skeleton':'named-parts':'whole-mesh'}
  };
  return player;
}
export function attachKinosakiRestMotion(model,clips=[],mixer=null){
  const controller=newMotion(model,clips,mixer);if(!controller)return null;
  return {
    update(dt,moving,running){controller.tick(dt,{moving:!!moving,running:!!running})},
    dispose(){controller.dispose()},
    mode:controller.getMode()
  };
}
function windTex(){
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  const r=x.createRadialGradient(128,128,8,128,128,118);
  r.addColorStop(0,'rgba(225,255,244,.98)');r.addColorStop(.14,'rgba(122,255,217,.9)');r.addColorStop(.40,'rgba(50,203,156,.58)');r.addColorStop(1,'rgba(31,165,155,0)');
  x.fillStyle=r;x.beginPath();x.arc(128,128,118,0,Math.PI*2);x.fill();
  x.strokeStyle='rgba(219,255,240,.78)';x.lineWidth=6;
  for(let i=0;i<3;i++){x.beginPath();x.arc(128,128,45+i*19,i*.8,Math.PI*1.45+i*.7);x.stroke();}
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
let sharedTex=null;
function windFx(battle,f,slot){
  if(!battle.fx||battle.ended)return;
  sharedTex ||= windTex();
  const isBig=slot==='hi'||slot==='over';
  const target=battle.nearestEnemy?.(f);const p=target?.pos||f.pos;
  const group=new THREE.Group();group.position.set(p.x,.4,p.z);battle.fx.add(group);
  const sprites=[];const count=isBig?5:2;
  for(let i=0;i<count;i++){
    const material=new THREE.SpriteMaterial({map:sharedTex,color:i%2?0xb0ffe5:0x56eebf,transparent:true,opacity:.72,depthWrite:false,blending:THREE.AdditiveBlending});
    const s=new THREE.Sprite(material);s.position.set(Math.cos(i*Math.PI*2/count)*1.2,1+i*.2,Math.sin(i*Math.PI*2/count)*1.2);
    s.scale.setScalar(isBig?4.8:2.1);group.add(s);sprites.push(s);
  }
  let time=0;battle.addEffect(dt=>{
    time+=dt;const k=time/(isBig?1.0:.52);
    group.rotation.y+=dt*(isBig?3:5);
    for(const s of sprites){s.material.opacity=Math.max(0,.77*(1-k));s.scale.multiplyScalar(1+Math.min(.05,dt*.85));}
    if(k>=1){group.removeFromParent();for(const s of sprites)s.material.dispose();return false;}return true;
  });
}
export function installKinosakiMotion({Fighter,Battle}){
  if(!Fighter?.prototype||Fighter.prototype.__rfKinosakiV27)return;
  Fighter.prototype.__rfKinosakiV27=true;
  const previousBuild=Fighter.prototype.buildModel;
  Fighter.prototype.buildModel=function(gltf,...rest){
    const result=previousBuild.call(this,gltf,...rest);
    if(this.key===KEY){
      this._ksMotion?.dispose();
      this._ksMotion=newMotion(this.modelInstance?.model,gltf?.animations||[],this.mixer);
      this._ksAttackUntil=0;this._ksCastUntil=0;
    }return result;
  };
  const previousLight=Fighter.prototype.startLight;
  Fighter.prototype.startLight=function(...args){
    if(this.key===KEY)this._ksAttackUntil=performance.now()/1000+.43;
    return previousLight.apply(this,args);
  };
  const previousSkill=Fighter.prototype.startSkill;
  Fighter.prototype.startSkill=function(...args){
    if(this.key===KEY)this._ksCastUntil=performance.now()/1000+1.1;
    return previousSkill.apply(this,args);
  };
  const previousUpdate=Fighter.prototype.update;
  Fighter.prototype.update=function(dt,input){
    const out=previousUpdate.call(this,dt,input);
    if(this.key===KEY&&this._ksMotion){
      const now=performance.now()/1000;
      const moving=!!(this.moving||this.netMoving||Math.hypot(this.vel?.x||0,this.vel?.z||0)>.8);
      const running=moving&&(Math.hypot(this.vel?.x||0,this.vel?.z||0)>4.9||this.netMoving);
      const attack=now<(this._ksAttackUntil||0);
      const cast=now<(this._ksCastUntil||0)||this.action?.type==='chant'||this.action?.type==='cast';
      this._ksMotion.tick(dt,{moving,running,attack,cast});
    }
    return out;
  };
  if(Battle?.prototype){
    const oldExecute=Battle.prototype.executeCast;
    Battle.prototype.executeCast=function(f,slot,net){
      const out=oldExecute.call(this,f,slot,net);
      if(f?.key===KEY){f._ksCastUntil=performance.now()/1000+.85;windFx(this,f,slot);}
      return out;
    };
    const oldDispose=Battle.prototype.dispose;
    Battle.prototype.dispose=function(...args){
      for(const f of this.fighters||[])if(f.key===KEY){f._ksMotion?.dispose();f._ksMotion=null;}
      return oldDispose.apply(this,args);
    };
  }
}
