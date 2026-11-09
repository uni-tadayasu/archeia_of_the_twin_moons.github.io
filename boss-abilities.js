// RF_BATCH_SCALE_STARTUP_V92
/** Riftfall Arena / 2026-11-08 – Chief-only boss combat expansion.
 * Operates on the original Fighter/Battle prototypes; no GLB mesh or materials
 * are modified.  The game owns skill damage and PvP validation as before.
 * Version-pinned game/data imports must match main.js (set by ZIP builder).
 */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { FIGHTERS } from './data.js?v=rf-v9-2-20261109';
import { Fighter, Battle } from './game.js?v=rf-v9-2-20261109';

const STAMP='boss-expansion-20261108-v5';
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const fire=0xff612a, ember=0xffba55, voidC=0xbda0ff;

// These definitions come after the game's original global balance pass.
// "Strongest" is expressed as distinctive boss-class stats, not a loophole
// in Cloudflare's role checks. Worker must receive the matching overrides.
if (FIGHTERS.gaizorg) {
  Object.assign(FIGHTERS.gaizorg, {
    name:'ガイゾルグ', title:'炎獄超甲獣・運営長専用',attribute:'炎',
    color:fire,tint:null,height:4.35,hp:14800,speed:5.65,
    power:1.65,armor:0.47,overGain:1.75,fluxMul:2.25,
    permanentSuperArmor:true,staggerImmune:true,knockbackImmune:true,
    ringArt:{name:'炎獄魔法陣《灼魂の焔界》',duration:30,radius:6.1,burnSeconds:10,attackMultiplier:0.5,cooldown:0},
    light:{dmg:290,range:4.1,color:0xffd58c,claws:true},
    skills:[
      {name:'爆炎散華《ヴォルカニック・バラージ》',kind:'projectile',visual:'fire',count:9,spreadAng:.12,chain:.045,dmg:140,speed:24,radius:.86,cost:22,castTime:.55,elem:0,color:0xff7b30,vivid:true},
      {name:'熔爪断撃《タイタン・クロウ》',kind:'dash',dmg:420,speed:23,dur:.38,stun:.62,kb:7,cost:18,castTime:.48,elem:0,color:0xffc269,vivid:true},
      {name:'灼星火球《マグマ・スフィア》',kind:'projectile',visual:'orb',count:5,spreadAng:.16,dmg:210,speed:22,radius:1.15,cost:25,castTime:.85,elem:0,color:0xff4e19,vivid:true},
      {name:'連続火炎放射《インフェルノ・ブレス》',kind:'projectile',visual:'fire',count:3,spreadAng:.12,dmg:110,speed:28,radius:.68,cost:12,castTime:.38,elem:0,color:0xffa12e,holdToChannel:true,vivid:true},
      {name:'灼魂再生《マグマ・リバイブ》',kind:'heal',heal:1500,radius:5.5,cost:30,elem:0,color:0xffcf93,vivid:true}
    ],
    over:{name:'炎獄天墜《スカーレット・インパクト》',kind:'judgment',visual:'meteor',finalVisual:'pillar',count:12,spread:5.3,radius:2.5,dmg:285,delay:.38,interval:.075,finalDmg:1550,finalRadius:9.6,castTime:2.3,elem:0,color:0xff6a29,vivid:true},
    hi:{name:'太古禁呪《原初火界・ノヴァ》',kind:'judgment',visual:'meteor',finalVisual:'nova',count:17,spread:7,radius:2.7,dmg:330,delay:.45,interval:.06,finalDmg:2300,finalRadius:11.3,castTime:3.2,elem:0,color:0xffc35e,hi:true,vivid:true}
  });
}
if (FIGHTERS.valdarion) {
  Object.assign(FIGHTERS.valdarion, {
    name:'虚無機神ヴァルダリオン',title:'無の最高神・運営長専用',attribute:'無',nullElement:true,
    color:0xcbbaff,tint:null,height:4.25,hp:19500,speed:6.65,
    power:1.9,armor:0.36,fluxMul:2.6,overGain:1.9,
    permanentSuperArmor:true,staggerImmune:true,knockbackImmune:true,
    guardArt:{name:'絶対零域《無限封界》',duration:30,radius:6.4,immobilizeUntilHit:true},
    light:{dmg:310,range:3.7,color:0xf0ddff,shadowClones:4},
    skills:[
      {name:'虚無の終光《アビス・ゼロ》',kind:'projectile',visual:'orb',count:6,spreadAng:.13,chain:.045,dmg:195,speed:29,radius:1,cost:24,castTime:.55,elem:6,color:0xcbadff,nullElement:true,vivid:true},
      {name:'絶界断刀《ゼロ・エクスカリオン》',kind:'dash',dmg:520,speed:28,dur:.39,cost:24,elem:6,color:0xe5d8ff,nullElement:true,vivid:true},
      {name:'四重虚空《クアドラ・ネメシス》',kind:'rain',visual:'crystal',count:14,spread:4.7,radius:2,dmg:240,delay:.24,interval:.065,cost:32,elem:6,color:0xb389ff,nullElement:true,vivid:true},
      {name:'因果消去《リアリティ・オーバーライト》',kind:'judgment',visual:'nova',finalVisual:'pillar',count:16,spread:6.4,radius:2.4,dmg:300,delay:.42,interval:.065,finalDmg:1750,finalRadius:10.2,cost:39,castTime:2.3,elem:6,color:0xe9d6ff,nullElement:true,vivid:true},
      {name:'無限再誕《ヌル・リジェネシス》',kind:'heal',heal:2200,radius:5.5,cost:30,elem:6,color:0xc4e8ff,nullElement:true,vivid:true}
    ],
    over:{name:'世界断章《エターナル・ヌル》',kind:'judgment',visual:'nova',finalVisual:'pillar',count:19,spread:7,radius:2.8,dmg:360,delay:.38,interval:.055,finalDmg:2500,finalRadius:11.3,castTime:2.7,elem:6,color:0xf3e5ff,nullElement:true,vivid:true},
    hi:{name:'至高禁呪《原初の空白》',kind:'judgment',visual:'pillar',finalVisual:'nova',count:23,spread:7.5,radius:3.1,dmg:400,delay:.4,interval:.05,finalDmg:3200,finalRadius:12,castTime:3.05,elem:6,color:0xffffff,nullElement:true,hi:true,vivid:true}
  });
}

// Matched server/worker.js receives the same core character numbers and skill data.
// The original game already validates operator/chief role tokens; this module
// never changes these guards or grants a role to the local client.
if (Fighter?.prototype && Battle?.prototype && !Fighter.prototype.__rfBossAbilitiesV4) {
  const F=Fighter.prototype, B=Battle.prototype;
  F.__rfBossAbilitiesV4=STAMP;
  const isBoss=f=>f?.key==='gaizorg'||f?.key==='valdarion';
  const isGaizorg=f=>f?.key==='gaizorg';
  const isValdarion=f=>f?.key==='valdarion';
  const v3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  const flatDistance=(a,b)=>Math.hypot((a.x||0)-(b.x||0),(a.z||0)-(b.z||0));
  const releaseResources=(group)=>{
    if(!group)return;
    group.traverse?.(node=>{
      if(node.userData?._bossOwnedGeometry)node.geometry?.dispose?.();
      for(const m of (Array.isArray(node.material)?node.material:[node.material]))if(m?.userData?._bossOwned) m.dispose();
    });
    group.removeFromParent?.();
  };
  const mat=(color,opacity=.86)=>{
    const m=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending});
    m.userData._bossOwned=true;return m;
  };
  function ringMesh(radius,color,width=.13,opacity=.75){
    const g=new THREE.RingGeometry(radius-width,radius+width,96);
    const o=new THREE.Mesh(g,mat(color,opacity));o.rotation.x=-Math.PI/2;
    o.userData._bossOwnedGeometry=true;return o;
  }
  function installRing(f,kind){
    if(!f?.battle?.scene)return;
    if(f._bossRingRoot)releaseResources(f._bossRingRoot);
    const root=new THREE.Group();root.name=kind==='fire'?'rf_gaizorg_flame_sigil':'rf_valdarion_null_sigil';
    const color=kind==='fire'?fire:voidC;
    const R=kind==='fire'?6.1:6.4;
    root.add(ringMesh(R,color,.16,.87),ringMesh(R*.74,kind==='fire'?ember:0xf0eaff,.085,.73),ringMesh(R*.28,color,.08,.85));
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,mark=new THREE.Group();
      mark.position.set(Math.cos(a)*R*.85,.025,Math.sin(a)*R*.85);
      const line=new THREE.Mesh(new THREE.PlaneGeometry(.42,.07),mat(color,.75));
      line.rotation.x=-Math.PI/2;line.rotation.z=a;line.userData._bossOwnedGeometry=true;mark.add(line);
      root.add(mark);
    }
    f.battle.scene.add(root);f._bossRingRoot=root;f._bossRingType=kind;f._bossRingPulse=0;
  }
  function tickRing(f,dt){
    const fireMode=isGaizorg(f),voidMode=isValdarion(f),remain=fireMode?f._gaizorgRingLeft:f._valdarionRingLeft;
    if(!remain || f.dead){
      if(f._bossRingRoot){releaseResources(f._bossRingRoot);f._bossRingRoot=null;}
      return;
    }
    if(!f._bossRingRoot)installRing(f,fireMode?'fire':'void');
    const root=f._bossRingRoot;
    root.position.set(f.pos.x,.045,f.pos.z);
    root.rotation.y+=(fireMode?1.6:-1.1)*dt;
    const rest=Math.max(0,remain- dt);
    if(fireMode)f._gaizorgRingLeft=rest; else f._valdarionRingLeft=rest;
    const scale=1+.025*Math.sin(performance.now()*.007);
    root.scale.setScalar(scale);
    f._bossRingPulse=(f._bossRingPulse||0)-dt;
    if(f._bossRingPulse>0)return;
    f._bossRingPulse=.24;
    for(const e of f.battle.enemiesOf(f)){
      if(e.dead||flatDistance(f.pos,e.pos)>(fireMode?6.1:6.4)+(e.radius||0))continue;
      if(fireMode){
        // Burn and offensive weakening are maintained independently of the
        // engine's generic five-second Burn status duration.
        if(!e.remoteAuth){e.status.burn=Math.max(e.status.burn||0,10);e._gaizorgAttackWeakenTime=10;}
        f.battle.fxPop?.(e.pos.clone().setY(.12),0,4,1.4,.32,{flat:true,op:.5});
      }else{
        // One strike releases the victim until the circle has finished.
        if(e._nullReleasedRing===root)continue;
        e._nullSealSource=f;
        e._nullSealRing=root;
        e._nullSealTime=Math.max(e._nullSealTime||0,Math.min(30,rest+.2));
        e.action=null;e.vel.set(0,0,0);e.stun=Math.max(e.stun,.06);
      }
    }
    if(rest<=0){releaseResources(root);f._bossRingRoot=null;}
  }
  function activateRing(f){
    if(!f||!isBoss(f)||f.dead)return;
    const ga=isGaizorg(f);
    if(ga){
      f._gaizorgRingLeft=30;
      f._gaizorgRingPressed=true;
    }else{
      // Reuse the existing 30s shimmer/50% damage mechanic as well as the
      // new null-element magic circle. Its original 45s cooldown remains.
      if((f.nullGuardCooldown||0)>0)return;
      f._valdarionRingLeft=30;f.nullGuardTime=30;f.nullGuardCooldown=75;
      f._valdarionRingPressed=true;
    }
    installRing(f,ga?'fire':'void');
    f.battle.ui.popup?.(f.pos,ga?'炎獄魔法陣《灼魂の焔界》30秒':'絶対零域《無限封界》30秒',ga?'#ffad61':'#cfb7ff');
    f.battle.ui.sfx?.('burst');
    if(!f.remoteAuth&&f.battle.net&&f.netId){
      f.battle.net.cast({id:f.netId,slot:'s99',tx:f.pos.x,tz:f.pos.z,ry:f.facing});
    }
  }
  function fireChannel(f,dt){
    if(!f?.battle||!isGaizorg(f)||f.dead)return false;
    const drain=40;
    if(f.flux<drain*dt||f.status?.silence)return false;
    f.flux=Math.max(0,f.flux-drain*dt);
    f._fireShotCountdown=(f._fireShotCountdown||0)-dt;
    if(f._fireShotCountdown<=0){
      f._fireShotCountdown=.16;
      f.faceNearest?.(12);
      const spec={kind:'projectile',elem:0,color:0xff8a34,visual:'fire',dmg:48,
        radius:.7,speed:27,stun:.08,kb:.4,trail:.05,noBurst:true};
      for(const offset of [-.11,0,.11])f.battle.projectile?.(f,spec,f.facing+offset);
      f.battle.fxPop?.(f.pos.clone().setY(2.25),0,8,2.1,.16,{grow:1.5,op:.66});
    }
    return true;
  }
  function shadowDispose(shadow){
    if(shadow.dead)return;
    shadow.dead=true;
    if(shadow.group){releaseResources(shadow.group);shadow.group=null;}
    for(const mat of shadow.mats||[])mat.dispose?.();
    shadow.mats=[];
  }
  function spawnShadows(f){
    if(!isValdarion(f)||!f.battle||f.dead)return;
    const b=f.battle;
    for(const sh of f._nullShadows||[])shadowDispose(sh);
    f._nullShadows=[];
    const modelRoot=f.modelInstance?.wrapper;
    for(let i=0;i<4;i++){
      let clone=null,resources=[];
      if(modelRoot){
        try{
          clone=SkeletonUtils.clone(modelRoot);
          clone.traverse(node=>{
            if(!node.isMesh||!node.material)return;
            const convert=source=>{
              const m=source.clone();m.color?.set?.(0x9e7fcf);m.emissive?.set?.(0x7954dd);
              m.emissiveIntensity=1.15;m.transparent=true;m.opacity=.35;
              m.depthWrite=false;resources.push(m);return m;
            };
            node.material=Array.isArray(node.material)?node.material.map(convert):convert(node.material);
            node.castShadow=false;
          });
        }catch(e){console.warn('[Shadow duplicate]',e);clone=null;}
      }
      if(!clone){
        const g=new THREE.IcosahedronGeometry(.8,1),m=mat(0xa88aff,.4);
        clone=new THREE.Mesh(g,m);clone.userData._bossOwnedGeometry=true;resources.push(m);
      }
      // Keep the GLB's local recentering offset; apply world movement to an outer pivot.
      const shadowPivot=new THREE.Group();shadowPivot.name='valdarion_shadow_no_hp_bar';
      shadowPivot.add(clone);b.scene.add(shadowPivot);
      const a=i*Math.PI*.5,pos=v3(f.pos.x+Math.cos(a)*1.7,0,f.pos.z+Math.sin(a)*1.7);
      shadowPivot.position.copy(pos);
      const sh={owner:f,group:shadowPivot,mats:resources,pos,life:9.2,attack:.28,dead:false,team:f.team};
      f._nullShadows.push(sh);
    }
    b.ui.popup?.(f.pos,'無影分身 ×4','#e6caff');
    if(!f.remoteAuth && b.net && f.netId){
      b.net.cast({id:f.netId,slot:'s98',tx:f.pos.x,tz:f.pos.z,ry:f.facing});
    }
  }
  function tickShadows(b,dt){
    for(const owner of b.fighters){
      const shadows=owner._nullShadows||[];
      for(const sh of shadows){
        if(sh.dead)continue;
        sh.life-=dt;
        if(sh.life<=0||owner.dead||b.ended){shadowDispose(sh);continue;}
        const tgt=b.nearestEnemy(owner);
        if(!tgt){shadowDispose(sh);continue;}
        const dx=tgt.pos.x-sh.pos.x,dz=tgt.pos.z-sh.pos.z,dist=Math.hypot(dx,dz);
        const move=Math.min(dist,dt*10);
        if(dist>.001){sh.pos.x+=dx/dist*move;sh.pos.z+=dz/dist*move;}
        sh.attack-=dt;
        if(dist<1.7+(tgt.radius||0)&&sh.attack<=0){
          sh.attack=.95;
          if(!tgt.remoteAuth||owner.isPlayer)b.applyHit(owner,tgt,105,.0,0,sh.pos,{elem:6,color:0xbea5ff,kind:'shadow',nullElement:true});
          b.fxPop?.(sh.pos.clone().setY(1.0),6,8,1.4,.25,{grow:1.5,op:.65});
        }
        sh.group.position.set(sh.pos.x,Math.sin(performance.now()*.007+owner.team)*.1,sh.pos.z);
        sh.group.rotation.y=Math.atan2(dx,dz);
      }
      owner._nullShadows=shadows.filter(s=>!s.dead);
    }
  }
  function removeShadowsAroundHit(b,att,at,radius){
    if(!att||!at)return;
    for(const owner of b.fighters){
      if(owner.team===att.team)continue;
      for(const sh of owner._nullShadows||[]){
        if(!sh.dead&&flatDistance(sh.pos,at)<radius+.75){
          shadowDispose(sh);
          b.fxPop?.(sh.pos.clone().setY(1.2),6,8,1.1,.25,{grow:1.7,op:.64});
        }
      }
    }
  }
  // Shadows have NO fighter or HUD entry. Explicit hit volumes make them
  // one-strike targets without giving them a player health bar.
  function hitGhosts(b,att,x,z,radius,requireFacing=false){
    if(!att||!(radius>0))return;
    const forward=att.forward?.();
    for(const owner of b.fighters){
      if(owner.team===att.team)continue;
      for(const sh of owner._nullShadows||[]){
        if(sh.dead)continue;
        const dx=sh.pos.x-x,dz=sh.pos.z-z,d=Math.hypot(dx,dz);
        if(d>radius+.65)continue;
        if(requireFacing&&d>.85&&forward&&((dx*forward.x+dz*forward.z)/d)<=.22)continue;
        shadowDispose(sh);
        b.fxPop?.(sh.pos.clone().setY(1.2),6,8,1.5,.25,{grow:2.0,op:.75});
      }
    }
  }
  function spellVisual(b,f,slot){
    if(!isBoss(f)||!b.fx||b.ended)return;
    if(slot!=='over'&&slot!=='hi')return;
    const ga=isGaizorg(f),color=ga?fire:voidC;
    const center=b.nearestEnemy?.(f)?.pos||f.pos;
    const p=v3(center.x,.04,center.z);
    for(let k=0;k<3;k++){
      let t=-k*.16;
      b.addEffect(dt=>{
        t+=dt;if(t<0)return true;
        if(t>.04){
          b.fxPop?.(p.clone(),ga?0:6,4,3.3+k*2.4,.6,{flat:true,grow:1.7,spin:(k%2?1:-1)*2,op:.7});
          b.fxPop?.(p.clone().setY(.8+k*.6),ga?0:6,8,3+k*1.8,.55,{grow:1.9,op:.65});
          return false;
        }return true;
      });
    }
    b.shake=Math.max(b.shake,.8);
  }
  const originalUpdate=F.update,originalReceive=F.receive,originalStatus=F.applyStatus;
  const originalLight=F.startLight,originalHit=B.applyHit,originalCast=B.executeCast;
  const originalMelee=B.meleeHit,originalStrike=B.strikeAt;
  const originalBattleUpdate=B.update, originalDispose=B.dispose;
  F.update=function(dt,input){
    input=input||{mx:0,mz:0};
    this._gaizorgAttackWeakenTime=Math.max(0,(this._gaizorgAttackWeakenTime||0)-dt);
    if(this._nullSealTime>0){
      const source=this._nullSealSource;
      const active=source&&!source.dead&&(source._valdarionRingLeft>0)&&source._bossRingRoot===this._nullSealRing;
      this._nullSealTime=active?Math.min(this._nullSealTime,source._valdarionRingLeft):0;
      if(this._nullSealTime>0){
        this.action=null;this.vel.set(0,0,0);this.stun=Math.max(this.stun,dt+.01);
        input={mx:0,mz:0,guard:false,jump:false,attack:false,skill:false,skill2:false,holdSkill:false,holdSkill2:false,over:false,heal:false};
      }else this._nullSealSource=null;
    }
    if(isBoss(this)){
      this.stun=0;
      const guard=!!input.guard;
      const was=!!this._bossGuardPressed;
      if(guard&&!was)activateRing(this);
      this._bossGuardPressed=guard;
      if(isGaizorg(this)){
        if(this._gaizorgRingLeft>0)tickRing(this,dt);else if(this._bossRingRoot){releaseResources(this._bossRingRoot);this._bossRingRoot=null;}
        if(input.holdSkill2&&this.flux>0&&!this.dead&&!this.chantToken){
          fireChannel(this,dt);
          input={...input,skill2:false,holdSkill2:false,guard:false};
        }else input={...input,guard:false};
      }else{
        if(this._valdarionRingLeft>0)tickRing(this,dt);else if(this._bossRingRoot){releaseResources(this._bossRingRoot);this._bossRingRoot=null;}
        input={...input,guard:false};
      }
    }
    return originalUpdate.call(this,dt,input);
  };
  F.receive=function(dmg,stun,kx,kz){
    const pinned=!!this._nullSealTime;
    if(isBoss(this)){stun=0;kx=0;kz=0;this.stun=0;}
    const result=originalReceive.call(this,dmg,stun,kx,kz);
    if(isBoss(this)&&!this.dead)this.stun=0;
    if(pinned&&result>0){
      this._nullSealTime=0;
      this._nullReleasedRing=this._nullSealRing;
      this._nullSealRing=null;
      this._nullSealSource=null;
      this.stun=0;
      this.battle.ui.popup?.(this.pos,'拘束解除','#b7f4ff');
    }
    return result;
  };
  F.applyStatus=function(key){
    if(isBoss(this) && ['freeze','petrify','para','slow','silence'].includes(key)){
      this.battle?.ui?.popup?.(this.pos,'受け身耐性','#fff0b0');return;
    }
    if(isGaizorg(this)&&key==='burn')return;
    return originalStatus.call(this,key);
  };
  F.startLight=function(...args){
    const ret=originalLight.apply(this,args);
    if(isValdarion(this)&&!this.dead)spawnShadows(this);
    if(isGaizorg(this)&&!this.dead){
      const p=this.pos.clone().setY(Math.max(1.1,this.def.height*.36));
      this.battle?.fxPop?.(p,0,8,2.1,.22,{grow:1.75,spin:3,op:.82});
    }
    return ret;
  };
  B.meleeHit=function(att,range,dmg,stun,kb,hitSet,spec,omni){
    if(dmg>0)hitGhosts(this,att,att.pos.x,att.pos.z,Number(range)||2,!omni);
    return originalMelee.call(this,att,range,dmg,stun,kb,hitSet,spec,omni);
  };
  B.strikeAt=function(att,x,z,radius,dmg,stun,kb,spec){
    if(dmg>0)hitGhosts(this,att,x,z,Number(radius)||1,false);
    return originalStrike.call(this,att,x,z,radius,dmg,stun,kb,spec);
  };
  B.applyHit=function(att,tgt,dmg,stun,kb,from,spec){
    // Attack weakening from the gaizorg circle lasts exactly 10s after contact.
    if(att?._gaizorgAttackWeakenTime>0)dmg*=.5;
    if(att?.team!==tgt?.team)removeShadowsAroundHit(this,att,from,Math.max(1,Number(spec?.radius)||1));
    return originalHit.call(this,att,tgt,dmg,stun,kb,from,spec);
  };
  B.executeCast=function(f,slot,net){
    // An official cast notification also replicates guardian circles.
    if(slot==='s99'){
      if(isBoss(f))activateRing(f);
      return;
    }
    if(slot==='s98'){
      if(isValdarion(f) && f.remoteAuth)spawnShadows(f);
      return;
    }
    const out=originalCast.call(this,f,slot,net);
    try{spellVisual(this,f,slot)}catch(e){console.warn('[Boss spell visual]',e)}
    return out;
  };
  B.update=function(dt,input){
    const result=originalBattleUpdate.call(this,dt,input);
    try{tickShadows(this,clamp(dt,0,.05))}catch(e){console.warn('[Shadow system]',e)}
    return result;
  };
  B.dispose=function(...args){
    for(const f of this.fighters||[]){
      for(const sh of f._nullShadows||[])shadowDispose(sh);
      if(f._bossRingRoot)releaseResources(f._bossRingRoot);
      f._nullShadows=[];f._bossRingRoot=null;
    }
    return originalDispose.apply(this,args);
  };
}
