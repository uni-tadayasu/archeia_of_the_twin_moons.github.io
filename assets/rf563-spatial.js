/* Riftfall Arena V55.13 — spatial battle rooms and enterable story interiors.
 * Adds 3D scenery outside the existing combat bounds; combat rules, AI, networking
 * and persistence are not changed. Installed before main.js, on its shared modules.
 */
import * as THREE from 'three';
import { Battle, ARENA_R } from '../game.js?v=rf553-chief-cpu-20261111';
import { Field } from '../field.js?v=rf-v9-2-20261109';

if (!window.__rf563Spatial) {
  window.__rf563Spatial = true;
  const ROOT = 'assets/rf562/';
  const CAVE = /洞|窟|坑|墓|cave|mine|地下/i;
  const RUINS = /神殿|遺跡|聖堂|古城|社|祠|神宮|塔|temple|ruins|shrine/i;
  const img = {
    japanese: ['japanese-palace.webp', 'japanese-corridor.webp'],
    western: ['western-throne.webp', 'western-cathedral.webp'],
    cave: ['cave-crystals.webp', 'cave-embers.webp'],
    ruins: ['ruins-sunlight.webp', 'ruins-moonlit.webp']
  };
  const MAX_R = Math.min(18, Number(ARENA_R) || 14);
  const low = /Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.deviceMemory || 8) <= 4;
  const loader = new THREE.TextureLoader();
  const texCache = new Map();
  const clamp = (a, b, n) => Math.max(a, Math.min(b, n));
  let requestedMode = '';
  document.addEventListener('click',(event)=>{
    const node=event.target?.closest?.('[data-go]');
    if(node){const mode=node.getAttribute('data-go');requestedMode=mode==='infinite'?'infinite':mode||'';}
  },true);
  const floorText = () => (document.getElementById('rf552-endless-hud')?.textContent || '');
  const floorNo = () => Number((floorText().replaceAll(',','').match(/第\s*(\d+)\s*層/) || [])[1] || 1);
  function inInfinite() { const e = document.getElementById('rf552-endless-hud'); return !!e && !e.hidden && e.textContent.includes('無限天守'); }
  function stageTheme() {
    if (inInfinite() || requestedMode==='infinite') {
      let theme='japanese'; try { theme=localStorage.getItem('rf561-infinite-style') === 'western' ? 'western':'japanese'; } catch {}
      return {kind: theme, floor: floorNo()};
    }
    const region=document.getElementById('field-region')?.textContent || '';
    if (CAVE.test(region)) return {kind:'cave',floor:1};
    if (RUINS.test(region)) return {kind:'ruins',floor:1};
    const cur=document.body.dataset.rf562Stage || '';
    for(const k of ['japanese','western','cave','ruins']) if(cur.startsWith(k)) return {kind:k,floor:1};
    return {kind:'ruins',floor:1};
  }
  function texture(path) {
    if (!texCache.has(path)) {
      const t=loader.load(path); t.colorSpace=THREE.SRGBColorSpace;
      t.anisotropy=low?2:4;
      texCache.set(path,t);
    }
    return texCache.get(path);
  }
  function context(parent){
    const own=[];
    const mat=(opts)=>{ const m=new THREE.MeshStandardMaterial(opts); own.push(m); return m; };
    const add=(geo,material,x=0,y=0,z=0,rotation=0)=>{
      own.push(geo); const mesh=new THREE.Mesh(geo,material); mesh.position.set(x,y,z); mesh.rotation.y=rotation;
      mesh.receiveShadow=false; mesh.castShadow=false; parent.add(mesh); return mesh;
    };
    return {mat,add,own};
  }
  function createBattleRoom(battle) {
    if (battle.__rf563Room || !battle.scene || !battle.fx) return;
    const {kind,floor}=stageTheme();
    const isEast = kind==='japanese';
    const woody = isEast;
    const cave = kind==='cave';
    const room = new THREE.Group(); room.name='RF563_CG_Spatial_Combat_Stage';
    battle.scene.add(room); battle.__rf563Room=room;
    const C=context(room); battle.__rf563Owned=C.own;
    const stone=C.mat({ color: cave?0x515a6b:woody?0x6d4130:0x8895a9, metalness:0.08, roughness:0.75 });
    const dark=C.mat({ color:woody?0x37251f:0x242d3c, roughness:0.82 });
    const trim=C.mat({ color:woody?0xc7a25d:0xc9a56f, roughness:0.42, metalness:0.6 });
    const floorMaterial=C.mat({ color:cave?0xa9acbb:woody?0xb49379:0xd1d3dc, map:texture(cave?'assets/tex-dungeon-floor.webp':woody?'assets/tex-house-wall.webp':'assets/tex-cobble.webp'), roughness:cave?0.9:0.62, metalness:0.08 });
    floorMaterial.map.wrapS=floorMaterial.map.wrapT=THREE.RepeatWrapping;
    // Square room floor hides the old arena ring without altering its collision radius.
    const pad = MAX_R + 2.5;
    const floorMesh = C.add(new THREE.PlaneGeometry(2*pad,2*pad), floorMaterial,0,0.11,0);
    floorMesh.rotation.x=-Math.PI/2;
    const backgroundFile = img[kind][Math.floor((floor-1)/3) % img[kind].length] || img[kind][0];
    const sky=C.add(new THREE.PlaneGeometry(52,31),new THREE.MeshBasicMaterial({map:texture(ROOT+backgroundFile), side:THREE.DoubleSide, depthWrite:false, toneMapped:false}),0,12,-26);
    C.own.push(sky.material);
    // Rendered room depth: columns, wall side sections, arch beams and lamps.
    const wallH=10;
    for (const side of [-1,1]) {
      C.add(new THREE.BoxGeometry(0.8,wallH,2*pad+4),stone,side*(pad+.8),wallH/2,-.7);
      for(let i=0;i<4;i++){
        const z=-pad+4+i*(2*pad-8)/3;
        C.add(new THREE.CylinderGeometry(woody?.55:.67,woody?.6:.78,wallH,low?9:18),stone,side*(pad-1.5),wallH/2,z);
        C.add(new THREE.BoxGeometry(2.5,.4,1.5),trim,side*(pad-1.5),wallH-.5,z);
        if(i%2===0) {
          const flame=C.mat({ color:0xffcc8c, emissive:0xffa541, emissiveIntensity:1.9, roughness:.25 });
          C.add(new THREE.SphereGeometry(.22,10,8),flame,side*(pad-1.7),3.4,z+.35);
        }
      }
    }
    C.add(new THREE.BoxGeometry(2*pad+3,wallH,.8),stone,0,wallH/2,-pad-1);
    for(let i=-2;i<=2;i++){
      C.add(new THREE.BoxGeometry(.45,6,.75),dark,i*6,5,-pad+.1);
      C.add(new THREE.BoxGeometry(3,.25,.8),trim,i*6,8,-pad+.1);
    }
    for(let i=-2;i<=2;i++) C.add(new THREE.BoxGeometry(2*pad+2,.32,.8),dark,0,wallH-(i%2)*.18, i*6);
    const canopy = C.mat({ color:woody?0x49312b:0x596374,roughness:.86,side:THREE.BackSide,transparent:true,opacity:.48 });
    const ceiling=C.add(new THREE.PlaneGeometry(2*pad+2,2*pad+2),canopy,0,wallH+1,0);ceiling.rotation.x=-Math.PI/2;
    const rug=C.mat({color:woody?0x6b1e2b:0x34385d, roughness:.96, transparent:true,opacity:.55});
    const strip=C.add(new THREE.PlaneGeometry(7,18),rug,0,.125,-2);strip.rotation.x=-Math.PI/2;
    const torches=Math.min(low?1:3,low?1:3);
    for(let i=0;i<torches;i++){
      const light=new THREE.PointLight(woody?0xffbb79:0x8bbfff, low?1.3:2.2, 14,2);
      light.position.set((i-1)*8,4,-pad+3);
      room.add(light);
    }
    const marker = document.createElement('div'); marker.id='rf563-space-label';
    marker.textContent = kind==='japanese'?'城内・和風の広間':kind==='western'?'王城・洋風の広間':kind==='cave'?'洞窟・結晶深部':'遺跡・地下神殿';
    document.body.append(marker);battle.__rf563Label=marker;
    setTimeout(()=>{if(marker.isConnected)marker.remove();},5000);
    document.body.classList.add('rf563-combat-space');
  }
  const prevAdd=Battle.prototype.add;
  Battle.prototype.add=function(...args){
    if(!this.__rf563Room) { try{createBattleRoom(this)}catch(e){console.warn('[RF563 stage]',e);} }
    return prevAdd.apply(this,args);
  };
  const prevDispose=Battle.prototype.dispose;
  Battle.prototype.dispose=function(...args){
    try{
      if(this.__rf563Room) this.__rf563Room.removeFromParent();
      for(const res of this.__rf563Owned||[]) res?.dispose?.();
      this.__rf563Label?.remove();
      document.body.classList.remove('rf563-combat-space');
    }catch(e){console.warn('[RF563 cleanup]',e);}
    this.__rf563Room=null;this.__rf563Owned=[];
    return prevDispose.apply(this,args);
  };

  // Enterable story interiors. Room geometry is generated once per field;
  // the town/world group is only hidden while the player is inside.
  const oldTown=Field.prototype.buildTown;
  Field.prototype.buildTown=function(...args){
    const v=oldTown.apply(this,args);
    try{installPortals(this);}catch(e){console.warn('[RF563 town]',e);}
    return v;
  };
  function installPortals(field){
    if(field.__rf563Story || !Array.isArray(field.houses))return;
    const markers = [];
    const owned=[];
    const portalMat = new THREE.MeshStandardMaterial({color:0xaedaff,emissive:0x398ad2,emissiveIntensity:1.05,metalness:.5,roughness:.36});owned.push(portalMat);
    for(const [i,h] of field.houses.entries()){
      const dx=-h.x,dz=10-h.z;
      let px=h.x,pz=h.z;
      if(Math.abs(dx)>Math.abs(dz))px+=Math.sign(dx||1)*(h.w/2+2.1);
      else pz+=Math.sign(dz||1)*(h.d/2+2.1);
      const g=new THREE.Group(); g.position.set(px,0,pz);
      const frame = new THREE.Mesh(new THREE.TorusGeometry(.77,.095,10,32),portalMat);frame.position.y=1.55;
      const plinth=new THREE.Mesh(new THREE.CylinderGeometry(.95,.95,.10,24),portalMat);plinth.position.y=.07;
      g.add(frame,plinth);field.group.add(g); owned.push(frame.geometry,plinth.geometry);
      markers.push({x:px,z:pz,index:i,root:g,name:['民家','工房','古書の館','旅籠','茶屋','薬屋','鍛冶屋','研究所','集会所','宿屋'][i%10]});
    }
    const center={x:102,z:94};
    const room=new THREE.Group();room.name='RF563_Story_Interior';room.position.set(center.x,0,center.z);room.visible=false;
    field.scene.add(room);
    const C=context(room);
    const stone=C.mat({color:0x8c98a9,roughness:.8});
    const trim=C.mat({color:0xc6a66b,metalness:.5,roughness:.42});
    const wood=C.mat({color:0x563a34,roughness:.82});
    const floor=C.add(new THREE.PlaneGeometry(17,18),C.mat({map:texture('assets/tex-dungeon-floor.webp'),color:0xe5dbce,roughness:.8}),0,.02,0);floor.rotation.x=-Math.PI/2;
    for(const side of [-1,1]){
      C.add(new THREE.BoxGeometry(.55,7,18),stone,side*8.3,3.5,0);
      for(let z=-5;z<=5;z+=5){
        C.add(new THREE.CylinderGeometry(.37,.41,6.9,low?8:16),trim,side*7.8,3.45,z);
      }
    }
    C.add(new THREE.BoxGeometry(17,7,.6),stone,0,3.5,-8.4);
    C.add(new THREE.BoxGeometry(17,.5,.7),wood,0,7,0);
    C.add(new THREE.BoxGeometry(17,.5,.7),wood,0,7,-7.5);
    const back=C.add(new THREE.PlaneGeometry(17,10),new THREE.MeshBasicMaterial({map:texture(ROOT+'western-throne.webp'), side:THREE.DoubleSide}),0,4.5,-8.1);
    owned.push(back.material);
    const leverBase=C.add(new THREE.BoxGeometry(.75,1,.75),trim,4,.5,-3);
    const lever=C.add(new THREE.CylinderGeometry(.12,.12,1.5,10),stone,4,1.6,-3);lever.rotation.z=-.3;
    const gate=C.add(new THREE.BoxGeometry(3,4,.23),wood,-4,2,-4.7);
    const chest=C.add(new THREE.BoxGeometry(1.2,.7,.85),trim,-4,.45,-6.2);
    const door=C.add(new THREE.TorusGeometry(.85,.10,12,24),portalMat,0,1.45,7.5);
    const torch=C.add(new THREE.SphereGeometry(.25,10,8),C.mat({color:0xffc375,emissive:0xffad4a,emissiveIntensity:2}),-6,4,-5);
    room.add(new THREE.AmbientLight(0xc9d5ff,.72));
    const lamp=new THREE.PointLight(0xffc67b,low?1.6:2.5,15);lamp.position.set(0,5,-3);room.add(lamp);
    owned.push(...C.own);
    field.__rf563Story={room,owned,markers,center,lever,gate,chest,back,lamp,mode:null,locked:true,opened:false,delay:0,outside:null,visibility:null};
  }
  // Enhance the existing procedural maze with overhead cross-beams and
  // warm/cool wayfinding lights. The maze walls, paths, enemies and collision stay unchanged.
  const oldBuildDungeon=Field.prototype.buildDungeon;
  Field.prototype.buildDungeon=function(...args){
    const result=oldBuildDungeon.apply(this,args);
    try{
      const cols=this.maze?.V?.[0]?.length-1 || 8;
      const rows=this.maze?.V?.length || 5;
      const x0=-(cols*10)/2+((this.L%3)-1)*30,z0=-470;
      const material=this.std(this.o.chapter%2?0x766d65:0x666d80,{metalness:.08,roughness:.9});
      const metal=this.std(this.o.chapter%2?0xd8a765:0x9ab5d6,{metalness:.42,roughness:.5});
      for(let r=0;r<=rows;r+=2){
        const z=z0-r*10-1.5;
        for(let c=1;c<cols;c+=2){
          const x=x0+c*10;
          const top=new THREE.Mesh(this.geo(new THREE.BoxGeometry(7,.38,.6)),material);
          top.position.set(x,5.8,z);this.group.add(top);
          const emblem=new THREE.Mesh(this.geo(new THREE.TorusGeometry(.8,.10,7,22)),metal);
          emblem.position.set(x,5.8,z-.32);this.group.add(emblem);
        }
      }
      const guide=this.goal;
      if(guide){
        const pedestal=new THREE.Mesh(this.geo(new THREE.CylinderGeometry(3.5,3.7,.14,32)),metal);
        pedestal.position.set(guide.x,.10,guide.z);this.group.add(pedestal);
      }
    }catch(error){console.warn('[RF563 dungeon details]',error);}
    return result;
  };
  const oldResolve=Field.prototype.resolve;
  Field.prototype.resolve=function(pos,rad){
    if(this.__rf563Story?.mode && pos === this.player?.pos){
      const c=this.__rf563Story.center;
      pos.x=clamp(c.x-7.5+rad,c.x+7.5-rad,pos.x);
      pos.z=clamp(c.z-7.5+rad,c.z+7.5-rad,pos.z);
      return;
    }
    return oldResolve.call(this,pos,rad);
  };
  const oldRegion=Field.prototype.regionAt;
  Field.prototype.regionAt=function(z,x){
    const a=this.__rf563Story;
    return a?.mode ? `${this.townName}・${a.mode.name}`:oldRegion.call(this,z,x);
  };
  const oldObjective=Field.prototype.objective;
  Field.prototype.objective=function(){
    const a=this.__rf563Story;
    if(a?.mode) return a.locked?'室内の仕掛けを解除し、隠された宝箱を探す':'宝箱を回収したら入口へ戻る';
    return oldObjective.call(this);
  };
  function claimedKey(field){return `rf563-interior-claims:${Math.max(0,Math.floor(Number(field.o?.chapter)||0))}`;}
  function isClaimed(field,index){try{return (JSON.parse(localStorage.getItem(claimedKey(field))||'[]')||[]).includes(index)}catch{return false}}
  function claimReward(field,index){try{const key=claimedKey(field),rows=JSON.parse(localStorage.getItem(key)||'[]');if(!rows.includes(index))rows.push(index);localStorage.setItem(key,JSON.stringify(rows.slice(0,20)));}catch{}}
  function setRoom(field,marker){
    const a=field.__rf563Story,p=field.player;
    if(!a||a.delay>0)return;
    a.mode=marker;a.locked=true;a.opened=isClaimed(field,marker.index);a.delay=1.1;
    a.outside=p.pos.clone();a.visibility=new Map();
    for(const child of field.group.children){
      if(child===p.root || field.followers?.some(f=>f.root===child))continue;
      a.visibility.set(child,child.visible);child.visible=false;
    }
    p.pos.set(a.center.x,0,a.center.z+5);
    field.trail=[];
    for(const f of field.followers||[])f.pos.copy(p.pos);
    a.room.visible=true;a.gate.visible=true;a.chest.visible=false;a.lever.rotation.z=-.3;
    document.body.classList.add('rf563-story-interior');
    try{window.RF564Interiors?.onEnter?.(field,marker)}catch(e){console.warn('[RF564 interior enter]',e)}
    updateInteriorUi(`${marker.name}へ入った`, a.opened?'宝箱は回収済み。室内を探索して出口へ戻ろう':'レバーを操作して隠し扉を開こう');
  }
  function leaveRoom(field){
    const a=field.__rf563Story;if(!a?.mode)return;
    try{window.RF564Interiors?.onLeave?.(field)}catch(e){console.warn('[RF564 interior exit]',e)}
    a.room.visible=false;
    for(const [child,visible] of a.visibility||[])if(child.parent===field.group)child.visible=visible;
    field.player.pos.copy(a.outside);
    field.trail=[];for(const f of field.followers||[])f.pos.copy(field.player.pos);
    a.mode=null;a.delay=1.15;
    document.body.classList.remove('rf563-story-interior');
    updateInteriorUi(null);
  }
  function updateInteriorUi(title,desc){
    let el=document.getElementById('rf563-interior-panel');
    if(!el){el=document.createElement('div');el.id='rf563-interior-panel';document.body.append(el);}
    el.hidden=!title;
    if(title){el.replaceChildren();const b=document.createElement('strong');b.textContent=title;const s=document.createElement('span');s.textContent=desc||'';el.append(b,s);}
  }
  const oldUpdate=Field.prototype.update;
  Field.prototype.update=function(dt,inp,camera){
    const result=oldUpdate.call(this,dt,inp,camera);
    const a=this.__rf563Story;
    if(!a||!this.player)return result;
    a.delay=Math.max(0,a.delay-Math.max(0,Number(dt)||0));
    const p=this.player.pos;
    if(a.mode){
      for(const child of this.group.children){
        if(child===this.player.root||this.followers?.some(f=>f.root===child))continue;
        child.visible=false;
      }
      const exit=Math.hypot(p.x-a.center.x,p.z-(a.center.z+6));
      const lever=Math.hypot(p.x-(a.center.x+4),p.z-(a.center.z-3));
      const chest=Math.hypot(p.x-(a.center.x-4),p.z-(a.center.z-6));
      if(exit<2.1){this.prompt='入口へ戻る（J／斬）';if(inp?.attack&&a.delay<=0)leaveRoom(this);}
      else if(lever<2){this.prompt=a.locked?'レバーを引く（J／斬）':'解除済みの仕掛け';
        if(inp?.attack&&a.locked&&a.delay<=0){a.locked=false;a.gate.visible=false;a.chest.visible=!a.opened;a.lever.rotation.z=.58;a.delay=.7;updateInteriorUi('隠し扉が開いた','宝箱を探して回収しよう');}}
      else if(chest<2.1&&!a.locked){this.prompt=a.opened?'宝箱は空だ':'宝箱を開ける（J／斬）';
        if(inp?.attack&&!a.opened&&a.delay<=0){a.opened=true;a.chest.visible=false;a.delay=.8;claimReward(this,a.mode.index);this.o.onChest?.(35+Math.floor(this.o.chapter||0));updateInteriorUi('宝箱を発見','出口へ戻り、冒険を続けよう');}}
      else this.prompt='室内を探索する（レバー・宝箱・出口）';
    }else{
      const near=a.markers.map(m=>({...m,d:Math.hypot(p.x-m.x,p.z-m.z)})).sort((x,y)=>x.d-y.d)[0];
      if(near&&near.d<2.1){this.prompt=`${near.name}へ入る（J／斬）`;
        if(inp?.attack&&a.delay<=0)setRoom(this,near);}
    }
    return result;
  };
  const oldDisposeField=Field.prototype.dispose;
  Field.prototype.dispose=function(...args){
    const a=this.__rf563Story;
    if(a){
      a.room?.removeFromParent();
      for(const res of a.owned||[])res?.dispose?.();
      if(a.mode)document.body.classList.remove('rf563-story-interior');
      updateInteriorUi(null);
      this.__rf563Story=null;
    }
    try{window.RF564Interiors?.onDispose?.(this)}catch(e){console.warn('[RF564 interior cleanup]',e)}
    return oldDisposeField.apply(this,args);
  };
  window.RF563Spatial={active:true,version:'55.13',enterableBuildings:4,stageRadius:MAX_R};
}
