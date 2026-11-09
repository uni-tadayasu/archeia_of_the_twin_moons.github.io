// RF_UDAIJIN_V20 右大臣 – chief-exclusive curse fighter.
// The source GLB remains byte-for-byte untouched. Runtime skinning only if unrigged.
import * as THREE from 'three';
const KEY='udaijin', CURSE_TIME=30, CURSE_RADIUS=5.65;
const PURPLE=0xaf5dff, C=0xbc72ff;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const specFor=(name)=>({name,kind:'curse',elem:6,color:C,vivid:true});
const statusMark=specFor('呪印');
const statusBurn=specFor('おにび');
const animationNames={walk:/walk|歩行/i,run:/run|sprint|走行/i,attack:/attack|hit|punch|swing|攻撃/i,cast:/cast|spell|magic|詠唱/i};

function magicTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=768;
  const c=canvas.getContext('2d'),mid=384,R=365;
  c.clearRect(0,0,768,768);c.translate(mid,mid);
  const light=c.createRadialGradient(0,0,12,0,0,380);
  light.addColorStop(0,'rgba(233,189,255,.20)');light.addColorStop(.55,'rgba(130,40,255,.12)');light.addColorStop(.95,'rgba(63,10,124,.04)');light.addColorStop(1,'transparent');
  c.fillStyle=light;c.beginPath();c.arc(0,0,R,0,Math.PI*2);c.fill();
  const ring=(r,width,opacity=1)=>{c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.lineWidth=width;c.strokeStyle=`rgba(217,145,255,${opacity})`;c.shadowColor='#7d0dff';c.shadowBlur=14;c.stroke();c.shadowBlur=0;};
  [[345,6,.9],[328,1.5,.95],[305,3,.76],[268,2,.8],[245,1,.75],[208,4,.8],[176,2,.6],[125,3,.72],[80,2,.56]].forEach(x=>ring(...x));
  c.lineCap='round';
  const trace=(pts,width,alpha)=>{c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.strokeStyle=`rgba(218,174,255,${alpha})`;c.lineWidth=width;c.shadowBlur=10;c.shadowColor='#6f17ec';c.stroke();c.shadowBlur=0;};
  for(const n of [5,8,10]){
    const pts=Array.from({length:n},(_,i)=>{const a=(i*Math.PI*2/n)-Math.PI/2;return [Math.cos(a)*(n===5?270:n===8?310:182),Math.sin(a)*(n===5?270:n===8?310:182)];});
    trace(pts,2,n===8?.5:.78);
  }
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6;c.save();c.rotate(angle);
    c.strokeStyle='rgba(236,185,255,.94)';c.lineWidth=2.2;c.shadowColor='#b85bff';c.shadowBlur=11;
    c.beginPath();c.moveTo(0,-355);c.lineTo(-14,-317);c.lineTo(0,-282);c.lineTo(14,-317);c.closePath();c.stroke();
    c.beginPath();c.moveTo(0,-303);c.lineTo(0,-215);c.stroke();
    c.lineWidth=1.4;c.beginPath();c.arc(0,-237,13,0,Math.PI*2);c.stroke();
    c.restore();
  }
  c.shadowBlur=0;
  for(let i=0;i<8;i++){
    c.save();c.rotate(i*Math.PI/4);c.strokeStyle='rgba(239,219,255,.68)';c.lineWidth=2;
    c.beginPath();c.moveTo(-14,-118);c.lineTo(0,-152);c.lineTo(14,-118);c.lineTo(0,-95);c.closePath();c.stroke();
    c.restore();
  }
  for(let i=0;i<5;i++){
    c.save();c.rotate(i*Math.PI*2/5);c.beginPath();c.moveTo(0,-184);c.quadraticCurveTo(-100,-80,0,0);c.quadraticCurveTo(100,-80,0,-184);
    c.lineWidth=1.6;c.strokeStyle='rgba(214,133,255,.66)';c.stroke();c.restore();
  }
  c.fillStyle='rgba(245,212,255,.94)';c.shadowColor='#9b2dff';c.shadowBlur=30;
  c.beginPath();c.moveTo(0,-51);c.lineTo(17,-17);c.lineTo(51,0);c.lineTo(17,17);c.lineTo(0,51);c.lineTo(-17,17);c.lineTo(-51,0);c.lineTo(-17,-17);c.closePath();c.fill();
  c.shadowBlur=0;
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=2;return tex;
}
function chainTexture(){
  const can=document.createElement('canvas');can.width=can.height=512;const c=can.getContext('2d');
  const gradient=c.createRadialGradient(256,256,20,256,256,230);gradient.addColorStop(0,'rgba(100,18,148,.3)');gradient.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=gradient;c.fillRect(0,0,512,512);
  for(const sign of [-1,1]){
    c.save();c.translate(256,256);c.rotate(sign*Math.PI/4);
    c.shadowBlur=11;c.shadowColor='#a652ff';
    for(let i=-6;i<=6;i++){
      const x=i*40;c.beginPath();c.ellipse(x,0,19,12,0,0,Math.PI*2);
      c.lineWidth=6;c.strokeStyle=i%2?'#9e78c6':'#dfc8fa';c.stroke();
      c.beginPath();c.ellipse(x,0,16,9,0,0,Math.PI*2);c.lineWidth=2;c.strokeStyle='#4b1e81';c.stroke();
    }c.restore();
  }
  const tex=new THREE.CanvasTexture(can);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
let common=null;
function commonAssets(){
  if(!common)common={seal:magicTexture(),chains:chainTexture(),pSphere:new THREE.SphereGeometry(.2,9,7),pBeam:new THREE.CylinderGeometry(.08,.16,1,7)};
  return common;
}
function sealOn(caster){
  if(!caster?.battle || caster.dead)return;
  const b=caster.battle;
  let x=caster._udaSeal;
  if(!x){
    const mat=new THREE.MeshBasicMaterial({map:commonAssets().seal,transparent:true,opacity:.87,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    const quad=new THREE.Mesh(new THREE.PlaneGeometry(CURSE_RADIUS*2,CURSE_RADIUS*2),mat);
    quad.rotation.x=-Math.PI/2;quad.renderOrder=5;b.fx.add(quad);
    x={quad,mat,expires:0,collided:new Set()};caster._udaSeal=x;
  }
  x.expires=performance.now()/1000+CURSE_TIME;
  x.quad.visible=true;
  caster.battle.ui?.popup?.(caster.pos,'呪術結界《行動封絶》 30秒','#d5a2ff');
  caster.battle.ui?.sfx?.('skill');
  if(!caster.remoteAuth && caster.netId && b.net) b.net.cast?.({id:caster.netId,slot:'seal',tx:caster.pos.x,tz:caster.pos.z,ry:caster.facing});
}
function bindChains(tgt){
  if(tgt._udaCross)return;
  const mat=new THREE.SpriteMaterial({map:commonAssets().chains,transparent:true,depthWrite:false,opacity:1});
  const spr=new THREE.Sprite(mat);spr.scale.set(3.7,3.7,1);spr.position.set(0,Math.max(1.25,(tgt.def?.height||2)*.62),0);
  tgt.root.add(spr);tgt._udaCross={spr,mat};
}
function releaseStasis(tgt,attacked=false){
  const old=tgt._udaStasis;if(!old)return;
  tgt._udaStasis=null;
  if(old.owner && attacked)tgt._udaNoRefreezeOwner=old.owner;
  if(tgt._udaCross){tgt._udaCross.spr.removeFromParent();tgt._udaCross.mat.dispose();tgt._udaCross=null;}
  tgt._udaHoldPos=null;
  if(attacked)tgt.battle?.ui?.popup?.(tgt.pos,'呪縛解除','#e9caff');
}
function applyStasis(owner,tgt,now){
  if(tgt.dead || tgt._udaNoRefreezeOwner===owner)return;
  if(tgt._udaStasis?.owner===owner){tgt._udaStasis.until=now+.22;return;}
  releaseStasis(tgt);
  tgt._udaStasis={owner,until:now+.22};
  tgt._udaHoldPos=tgt.pos.clone();tgt.vel?.set(0,0,0);tgt.action=null;tgt.chantToken=null;
  bindChains(tgt);
  tgt.battle?.ui?.popup?.(tgt.pos,'行動停止','#cb87ff');
}
function updateSeal(f,dt){
  const seal=f._udaSeal;if(!seal)return;
  const now=performance.now()/1000;
  if(!seal.quad)return;
  if(f.dead || f.battle?.ended || now>seal.expires){seal.quad.removeFromParent();seal.mat.dispose();seal.quad.geometry.dispose();f._udaSeal=null;return;}
  seal.quad.position.set(f.pos.x,.048,f.pos.z);
  seal.quad.rotation.z+=dt*.15;
  seal.quad.material.opacity=.64+.18*Math.sin(now*4);
  for(const t of f.battle.enemiesOf(f)){
    if(!t || t.dead)continue;
    const r=Math.hypot(t.pos.x-f.pos.x,t.pos.z-f.pos.z);
    if(r>CURSE_RADIUS+t.radius*.25){if(t._udaNoRefreezeOwner===f)t._udaNoRefreezeOwner=null;if(t._udaStasis?.owner===f)releaseStasis(t);continue;}
    applyStasis(f,t,now);
    // Online receiver sees the same visual via the signed/verified caster's seal event.
  }
}
function applyMark(f,target,visualOnly=false){
  if(!target || target.dead)return;
  const now=performance.now()/1000;
  if(!target._udaMark || target._udaMark.until<=now){target._udaMark={caster:f,until:now+5,next:now+1,ticks:0};}
  if(!visualOnly){f.battle?.ui?.popup?.(target.pos,'呪印　HP10%×5秒','#cc85ff');}
  if(target._udaStasis)releaseStasis(target,true);
  if(!visualOnly && !f.remoteAuth && f.netId && f.battle.net)f.battle.net.cast?.({id:f.netId,slot:'mark',tx:target.pos.x,tz:target.pos.z,ry:f.facing});
}
function tickMark(t){
  const now=performance.now()/1000,mark=t._udaMark;if(!mark)return;
  if(t.dead||now>mark.until+.25||mark.ticks>=5){t._udaMark=null;return;}
  if(now<mark.next)return;
  mark.next+=1;mark.ticks++;
  if(mark.caster?.dead || mark.caster?.battle!==t.battle || mark.caster.remoteAuth)return;
  const damage=Math.max(1,Math.round(t.maxHp*.1));
  t.battle.applyHit(mark.caster,t,damage,0,0,t.pos,statusMark);
}
function addBurn(f,t){
  if(!t||t.dead)return;
  const now=performance.now()/1000;
  if(!t._udaBurn || t._udaBurn.until<=now)t._udaBurn={caster:f,until:now+10,next:now+1,ticks:0};
  t.battle?.ui?.popup?.(t.pos,'鬼火・灼熱10秒','#ff9e60');
}
function tickBurn(t){
  const x=t._udaBurn,now=performance.now()/1000;if(!x)return;
  if(t.dead||now>x.until+.25||x.ticks>=10){t._udaBurn=null;return;}
  if(now<x.next)return;
  x.next+=1;x.ticks++;
  if(x.caster?.dead || x.caster?.battle!==t.battle || x.caster.remoteAuth)return;
  // Ten seconds of burning, total about 1/15 max HP; no stacking.
  t.battle.applyHit(x.caster,t,Math.max(1,Math.round(t.maxHp/150)),0,0,t.pos,statusBurn);
}
function startOrbs(b,f){
  const target=b.nearestEnemy?.(f);
  if(!target)return;
  const geo=commonAssets().pSphere,orbs=[];
  for(let i=0;i<2;i++){
    const mat=new THREE.MeshBasicMaterial({color:i?0xef5aff:0xff742a,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending});
    const m=new THREE.Mesh(geo,mat);b.fx.add(m);orbs.push({m,mat,a:i*Math.PI});
  }
  let timer=0;
  b.addEffect(dt=>{
    timer+=dt;
    for(const o of orbs){
      const dest=target.dead ? f.pos : target.pos;
      const phase=o.a+timer*12;
      const p=o.m.position;
      const radius=Math.max(.15,1.4*(1-timer/2.45));
      const lift=1.6+.22*Math.sin(phase*1.5);
      const spiral=v3(f.pos.x+Math.cos(phase)*radius,lift,f.pos.z+Math.sin(phase)*radius);
      const seek=clamp((timer-.3)/1.25,0,1);
      p.copy(spiral.lerp(v3(dest.x,lift,dest.z),seek));
      o.m.scale.setScalar(.9+.15*Math.sin(timer*14));
    }
    if(timer>=1.58 || target.dead){
      if(!target.dead&&!f.remoteAuth){
        b.applyHit(f,target,78,.16,1,f.pos,statusBurn);
        addBurn(f,target);
      } else if(!target.dead) addBurn(f,target);
      for(const o of orbs){o.m.removeFromParent();o.mat.dispose();}
      return false;
    }
    return true;
  });
}
function eyeLaser(b,f){
  const root=new THREE.Group();b.fx.add(root);
  const beams=[];
  for(let i=0;i<2;i++){
    const mat=new THREE.MeshBasicMaterial({color:i?0xe9aaff:0x9b3aff,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending});
    const geo=new THREE.CylinderGeometry(.16,.24,17,9,1,true);
    const beam=new THREE.Mesh(geo,mat);beam.rotation.x=Math.PI/2;beam.position.set((i?1:-1)*.35,0,8.4);root.add(beam);beams.push({mat,geo});
  }
  let elapsed=0;const hit=new Set();
  b.addEffect(dt=>{
    elapsed+=dt;
    const phase=clamp(elapsed/1.15,0,1),sweep=-.88+phase*1.76;
    root.position.copy(f.pos).add(v3(0,Math.max(1.3,(f.def.height||2)*.74),0));
    root.rotation.set(0,f.facing+sweep,0);
    for(const e of b.enemiesOf(f)){
      if(e.dead||hit.has(e))continue;
      const dx=e.pos.x-f.pos.x,dz=e.pos.z-f.pos.z,r=Math.hypot(dx,dz);
      const a=Math.atan2(dx,dz);const diff=Math.atan2(Math.sin(a-(f.facing+sweep)),Math.cos(a-(f.facing+sweep)));
      if(r<16 && r>0.1 && Math.abs(diff)<.115+(e.radius||.8)/Math.max(3,r)){
        hit.add(e);
        if(!f.remoteAuth)b.applyHit(f,e,510,.48,4,f.pos,specFor('呪いの光'));
        b.ui?.popup?.(e.pos,'呪光命中','#c276ff');
      }
    }
    for(const x of beams)x.mat.opacity=Math.max(0,.72*(1-phase));
    if(phase<1)return true;
    for(const x of beams){x.geo.dispose();x.mat.dispose();}root.removeFromParent();return false;
  });
}
// 20-bone automatic runtime rig. Does not alter or re-export the user's GLB.
function attachRig(f,glb){
  const model=f.modelInstance?.model;if(!model)return;
  const clips=glb?.animations||[];
  let preRigged=false,vertices=0;
  model.traverse(o=>{if(o.isSkinnedMesh||o.isBone)preRigged=true;if(o.isMesh&&!o.isSkinnedMesh)vertices+=o.geometry?.attributes?.position?.count||0;});
  if(clips.length){f._udaRig={authored:true,model,clips};return;}
  if(preRigged){
    const bones=[],find=(side,part)=>{
      const re=new RegExp(side==='l'?'left|(^|[_\\.])l':'right|(^|[_\\.])r','i');
      return bones.find(b=>re.test(b.name)&&part.test(b.name));
    };
    model.traverse(o=>{if(o.isBone)bones.push(o)});
    const named={
      lArm:find('l',/upperarm|arm|shoulder/i),rArm:find('r',/upperarm|arm|shoulder/i),
      lFore:find('l',/forearm|elbow|lowerarm/i),rFore:find('r',/forearm|elbow|lowerarm/i),
      lThigh:find('l',/thigh|upleg|upperleg/i),rThigh:find('r',/thigh|upleg|upperleg/i),
      lShin:find('l',/shin|calf|lowerleg/i),rShin:find('r',/shin|calf|lowerleg/i),
      chest:bones.find(x=>/chest|spine2/i.test(x.name)),head:bones.find(x=>/head/i.test(x.name))
    };
    const bases=Object.fromEntries(Object.entries(named).filter(([,v])=>v).map(([k,v])=>[k,v.quaternion.clone()]));
    f._udaRig={model,bones:named,bases,baseY:model.position.y,t:0,authored:false};return;
  }
  if(vertices<40||vertices>420000){
    console.warn('[右大臣] 複雑なモデルの自動スキニングを省略しました:',vertices);
    f._udaRig={fallback:true,model,baseY:model.position.y,t:0};return;
  }
  const mesh=[],box=new THREE.Box3();const pts=[];
  model.updateMatrixWorld(true);const inv=model.matrixWorld.clone().invert();
  model.traverse(o=>{
    if(!o.isMesh||o.isSkinnedMesh||!o.geometry?.attributes?.position)return;
    const x=new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld);
    const bb=o.geometry.boundingBox||(o.geometry.computeBoundingBox(),o.geometry.boundingBox);
    if(bb)box.union(bb.clone().applyMatrix4(x));
    const attr=o.geometry.attributes.position,step=Math.max(1,Math.ceil(attr.count/850));
    const p=new THREE.Vector3();for(let i=0;i<attr.count;i+=step){p.fromBufferAttribute(attr,i).applyMatrix4(x);pts.push([p.x,p.y,p.z]);}
    mesh.push({o,m:x});
  });
  if(!mesh.length||box.isEmpty()){f._udaRig={fallback:true,model,baseY:model.position.y,t:0};return;}
  const ys=pts.map(v=>v[1]).sort((a,b)=>a-b), xs=pts.map(v=>v[0]).sort((a,b)=>a-b);
  const q=(a,p)=>a[Math.max(0,Math.min(a.length-1,Math.floor((a.length-1)*p)))];
  const low=q(ys,.012),high=q(ys,.986),h=high-low,w=Math.max(.001,q(xs,.90)-q(xs,.10)),cx=(q(xs,.08)+q(xs,.92))*.5,cz=(box.min.z+box.max.z)*.5;
  if(h<=.01||!Number.isFinite(h)){f._udaRig={fallback:true,model,baseY:model.position.y,t:0};return;}
  const joint={
    hips:[cx,.51,0],spine:[cx,.65,0],upperSpine:[cx,.75,0],chest:[cx,.81,0],neck:[cx,.88,0],head:[cx,.94,0],
    lClav:[cx-w*.17,.79,0],lArm:[cx-w*.31,.77,0],lFore:[cx-w*.43,.65,0],lHand:[cx-w*.52,.56,0],
    rClav:[cx+w*.17,.79,0],rArm:[cx+w*.31,.77,0],rFore:[cx+w*.43,.65,0],rHand:[cx+w*.52,.56,0],
    lThigh:[cx-w*.12,.46,0],lShin:[cx-w*.12,.23,0],lFoot:[cx-w*.12,.085,.075],
    rThigh:[cx+w*.12,.46,0],rShin:[cx+w*.12,.23,0],rFoot:[cx+w*.12,.085,.075]
  };
  const parents={spine:'hips',upperSpine:'spine',chest:'upperSpine',neck:'chest',head:'neck',lClav:'chest',lArm:'lClav',lFore:'lArm',lHand:'lFore',rClav:'chest',rArm:'rClav',rFore:'rArm',rHand:'rFore',lThigh:'hips',lShin:'lThigh',lFoot:'lShin',rThigh:'hips',rShin:'rThigh',rFoot:'rShin'};
  const bones=[],named={};
  for(const [name,v] of Object.entries(joint)){
    const b=new THREE.Bone();b.name='UDAIJIN_'+name;
    const par=parents[name],pp=par?joint[par]:null;
    b.position.set(v[0]-(pp?.[0]||0),low+h*v[1]-(pp?low+h*pp[1]:0),cz+v[2]-(pp?cz+pp[2]:0));
    (par?named[par]:model).add(b);named[name]=b;bones.push(b);
  }
  model.updateMatrixWorld(true);
  const skeleton=new THREE.Skeleton(bones),indices=Object.fromEntries(bones.map((b,i)=>[b.name.slice(8),i]));
  const smooth=(x,a,b)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
  function weights(x,y,z){
    const yy=(y-low)/h,ax=Math.abs((x-cx)/w),side=x<cx?'l':'r';let pairs;
    if(yy<.52){
      if(yy<.12)pairs=[[side+'Foot',.85],[side+'Shin',.15]];
      else if(yy<.29){let f=smooth(yy,.10,.24);pairs=[[side+'Foot',.18*(1-f)],[side+'Shin',.80],[side+'Thigh',.02+.18*f]];}
      else pairs=[[side+'Shin',.25*(1-smooth(yy,.29,.44))],[side+'Thigh',.72],['hips',.28*smooth(yy,.44,.56)]];
    }else if(yy>.55&&yy<.88&&ax>.25){
      if(ax>.46&&yy<.68)pairs=[[side+'Hand',.80],[side+'Fore',.2]];
      else {const t=smooth(ax,.31,.48);pairs=[[side+'Fore',.7*t],[side+'Arm',.85*(1-t)],['chest',.15]];}
    }else if(yy>.89)pairs=[['head',smooth(yy,.87,.96)],['neck',1-smooth(yy,.87,.96)]];
    else if(yy>.77)pairs=[['chest',.75],['upperSpine',.25]];
    else if(yy>.65)pairs=[['upperSpine',.8],['spine',.2]];
    else pairs=[['spine',smooth(yy,.53,.66)],['hips',1-smooth(yy,.53,.66)]];
    pairs=pairs.filter(([n,v])=>indices[n]!=null&&v>0);const sum=pairs.reduce((s,v)=>s+v[1],0)||1;
    return pairs.map(([name,v])=>[indices[name],v/sum]);
  }
  const geos=[];
  for(const {o,m} of mesh){
    const geo=o.geometry.clone();geo.applyMatrix4(m);const p=geo.getAttribute('position');
    const a=new Uint16Array(p.count*4),wgt=new Float32Array(p.count*4);
    for(let i=0;i<p.count;i++){
      const w=weights(p.getX(i),p.getY(i),p.getZ(i));for(let k=0;k<Math.min(w.length,4);k++){a[i*4+k]=w[k][0];wgt[i*4+k]=w[k][1];}
    }
    geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(a,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(wgt,4));
    const sk=new THREE.SkinnedMesh(geo,o.material);sk.name=o.name;sk.renderOrder=o.renderOrder;sk.castShadow=o.castShadow;sk.receiveShadow=o.receiveShadow;sk.frustumCulled=false;
    model.add(sk);sk.bind(skeleton);o.parent?.remove(o);geos.push(geo);
  }
  const bases=Object.fromEntries(Object.entries(named).map(([k,v])=>[k,v.quaternion.clone()]));
  f._udaRig={model,bones:named,bases,geos,skeleton,baseY:model.position.y,t:0,authored:false};
  console.info('[右大臣] 20ボーン・自動ウェイト適用:',vertices,'頂点');
}
function animateRig(f,dt){
  const r=f._udaRig;if(!r || r.authored||f.dead)return;
  r.t+=dt;const moving=f.moving||f.netMoving,fast=Math.hypot(f.vel?.x||0,f.vel?.z||0)>3.6,rate=fast?9.5:5.8,step=Math.sin(r.t*rate);
  const striking=(f._udaStrike||0)>0;
  f._udaStrike=Math.max(0,(f._udaStrike||0)-dt);
  const chant=f.action?.type==='chant'||f.action?.type==='cast';
  if(r.fallback){r.model.position.y=r.baseY+(moving?.04*Math.abs(step):.012*Math.sin(r.t*2.1));return;}
  const rot=(name,x=0,z=0)=>{
    const bone=r.bones[name];if(!bone)return;
    bone.quaternion.copy(r.bases[name]);if(x)bone.rotateX(x);if(z)bone.rotateZ(z);
  };
  const amp=moving?(fast?.54:.32)*step:0;
  rot('hips',.02*step);rot('spine',chant?-.09:.02*step);rot('upperSpine',striking?-.14:.025*step);
  rot('chest',striking?-.24:chant?-.13:0);rot('neck',.012*step);rot('head',chant?-.10:.015*step);
  rot('lClav',chant?-.10:0,-.02);rot('rClav',chant?-.10:0,.02);
  rot('lArm',amp*.65-(chant?.45:0)+(striking?.18:0),chant?.09:0);
  rot('rArm',-amp*.65-(chant?.45:0)-(striking?.92:0),chant?-.09:0);
  rot('lFore',chant?-.48:striking?-.22:-.13);rot('rFore',chant?-.48:striking?-.74:-.13);
  rot('lHand',chant?.28:0);rot('rHand',chant?-.28:0);
  rot('lThigh',amp);rot('rThigh',-amp);
  rot('lShin',-Math.max(0,-step)*(fast?.43:.24));rot('rShin',-Math.max(0,step)*(fast?.43:.24));
  rot('lFoot',.13*Math.max(0,-step));rot('rFoot',.13*Math.max(0,step));
  r.model.position.y=r.baseY+(moving?.018*Math.abs(step):0);
}
function cleanup(f){
  if(f._udaSeal){f._udaSeal.quad.removeFromParent();f._udaSeal.quad.geometry.dispose();f._udaSeal.mat.dispose();f._udaSeal=null;}
  if(f._udaCross){f._udaCross.spr.removeFromParent();f._udaCross.mat.dispose();f._udaCross=null;}
  const rig=f._udaRig;if(rig?.geos){for(const g of rig.geos)g.dispose();rig.skeleton?.dispose?.();}
  f._udaRig=null;f._udaMark=null;f._udaBurn=null;f._udaStasis=null;
}
function updateTouchUI(f){
  if(typeof document==='undefined')return;
  const b=document.querySelector('#tbtns');if(!b)return;
  const active=!!f;
  if(b.dataset.udaijin===String(active))return;b.dataset.udaijin=String(active);
  const labels={guard:['呪','構'],attack:['印','斬'],skill:['鬼','技A'],skill2:['光','技B']};
  for(const [act,text] of Object.entries(labels)){const el=b.querySelector(`[data-act="${act}"]`);if(el)el.textContent=active?text[0]:text[1];}
}
export function installUdaijinCombat({Fighter,Battle,state}){
  if(!Fighter?.prototype||Fighter.prototype.__udaijinCurseV20)return;
  Fighter.prototype.__udaijinCurseV20=true;
  const baseBuild=Fighter.prototype.buildModel;
  Fighter.prototype.buildModel=function(glb,...args){
    const out=baseBuild.call(this,glb,...args);
    if(this.key===KEY)try{attachRig(this,glb)}catch(e){console.warn('[右大臣 RIG]',e);}
    return out;
  };
  const baseUpdate=Fighter.prototype.update;
  Fighter.prototype.update=function(dt,input){
    const t=performance.now()/1000,st=this._udaStasis;
    const frozen=!!(st&&st.until>t&&!this.dead),wasPos=frozen?this.pos.clone():null;
    if(st&&!frozen)releaseStasis(this);
    const inp={...(input||{})};
    if(frozen){
      this.vel.set(0,0,0);this.action=null;this.chantToken=null;
      this.stun=Math.max(.1,this.stun||0);
      Object.assign(inp,{mx:0,mz:0,guard:false,attack:false,skill:false,skill2:false,heal:false,over:false,jump:false,skillIdx:null});
    }
    if(this.key===KEY){
      const g=!!inp.guard;
      if(g&&!this._udaGuardPressed)sealOn(this);
      this._udaGuardPressed=g;
      inp.guard=false;
      // Two spells remain fixed regardless of movement; no rotating spell pool.
      if(inp.skill||inp.skill2){inp.skillIdx=inp.skill2?1:0;inp.skill=false;inp.skill2=false;}
      // H / L can still trigger the same fixed spells, without adding a fifth move.
      if(inp.heal){inp.skillIdx=0;inp.heal=false;}
      if(inp.over){inp.skillIdx=1;inp.over=false;}
    }
    const out=baseUpdate.call(this,dt,inp);
    if(frozen&&wasPos){this.pos.copy(wasPos);this.vel.set(0,0,0);this.sync?.();}
    if(this.key===KEY){updateSeal(this,clamp(dt,0,.05));animateRig(this,clamp(dt,0,.05));}
    tickMark(this);tickBurn(this);
    return out;
  };
  const baseLight=Fighter.prototype.startLight;
  Fighter.prototype.startLight=function(...args){
    if(this.key!==KEY)return baseLight.apply(this,args);
    const target=this.battle?.nearestEnemy?.(this);
    this._udaStrike=.36;
    if(target){this.faceNearest?.(40);applyMark(this,target,!!this.remoteAuth);}
    return undefined; // no ordinary combo/swing, mark is the basic attack
  };
  const baseReceive=Fighter.prototype.receive;
  Fighter.prototype.receive=function(dmg,...args){
    if(this._udaStasis && dmg>0)releaseStasis(this,true);
    return baseReceive.call(this,dmg,...args);
  };
  if(Battle?.prototype){
    const proto=Battle.prototype;
    const baseCast=proto.cast;
    proto.cast=function(f,slot,net){
      if(f?.key===KEY && slot==='seal'){sealOn(f);return;}
      if(f?.key===KEY && slot==='mark'){
        const target=this.enemiesOf(f).find(x=>!x.dead&&Math.hypot(x.pos.x-(net?.tx??0),x.pos.z-(net?.tz??0))<3)||this.nearestEnemy(f);
        if(target)applyMark(f,target,true);
        return;
      }
      return baseCast.call(this,f,slot,net);
    };
    const baseExecute=proto.executeCast;
    proto.executeCast=function(f,slot,net){
      const result=baseExecute.call(this,f,slot,net);
      if(f?.key===KEY){
        const index=Number(slot?.slice(1));
        if(index===0)startOrbs(this,f);
        else if(index===1 || slot==='over' || slot==='hi')eyeLaser(this,f);
      }
      return result;
    };
    const baseDispose=proto.dispose;
    proto.dispose=function(...args){for(const f of this.fighters||[])cleanup(f);return baseDispose.apply(this,args);};
  }
  if(typeof window!=='undefined'){
    window.__rfUdaijinCurrent=()=>{const s=typeof state==='function'?state():state;return s?.battle?.fighters?.find(x=>x.key===KEY&&x.isPlayer&&!x.remoteAuth)||null;};
    // On mobile, preserve the existing buttons and touch handlers; only change labels for this fighter.
    setInterval(()=>{
      const f=window.__rfUdaijinCurrent?.(); // optional host hook
      if(f)updateTouchUI(f);
      else{const active=document.querySelector('#hud-left .plate')?.textContent?.includes('右大臣');updateTouchUI(active?{}:null);}
    },600);
  }
}
