/* Riftfall Arena V55.14 — actual enterable interiors, town daily-life activities,
   filmic world atmosphere, smooth scenery, and room transitions.
   Additive: preserves original dungeon collision, field enemies, 100-story progress,
   multiplayer presence and server-backed item/account logic. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Field } from '../field.js?v=55.21';
import { instantiateModel,disposeModel } from '../model-runtime.js?v=rf-minamoto-v48-20261111';

if(!window.__rf564WorldLife){
 window.__rf564WorldLife=true;
 const small=/Android|iPhone|iPad/i.test(navigator.userAgent)||(navigator.deviceMemory||8)<=4;
 const imageLoader=new THREE.TextureLoader(), art=new Map();
 const days=['朝','昼','夕方','夜'];
 const titles=['民家','工房','古書の館','旅籠','茶屋','薬屋','鍛冶場','研究所','集会所','宿屋'];
 const activities=[
   [['食卓','今日の食事は焼き立てのパンと温かなスープ。旅の疲れを癒やそう。'],['暖炉','炎の向こうに町の家族の暮らしが見える。']],
   [['作業台','木工職人が道具を磨いている。ここでは武器の修繕が日課だ。'],['道具棚','使い込まれた工具と材料がきれいに並んでいる。']],
   [['本棚','古い歴史書には、この土地を守った旅人の伝説が綴られている。'],['書き物机','机には手書きの世界地図が広げられている。']],
   [['客間','旅籠の客間には、旅人たちの荷物が丁寧に並べられている。'],['食事場','香ばしい夕食の匂いが漂っている。']],
   [['茶釜','湯気が立ち、旅路の合間に心が落ち着く。'],['茶席','静かな茶席で、町の噂話に耳を傾ける。']],
   [['薬棚','野草や薬草が日付ごとに整理されている。'],['調合台','薬師が小さな瓶を振り、治療薬の配合を確かめている。']],
   [['鍛冶炉','熱い炉の中で、赤い鉄がゆっくりと輝く。'],['金床','鍛冶師の鎚が規則正しい音を立てる。']],
   [['研究机','古代の文献と結晶の記録が積み重ねられている。'],['観測器','双月の動きに合わせて装置が静かに回転している。']],
   [['掲示板','旅人の依頼や町の行事が丁寧に掲示されている。'],['会議机','住民たちが街道の安全を相談している。']],
   [['客室','柔らかな寝具と小さな灯りが旅人を迎える。'],['受付','宿帳には遠方から訪れた旅人の名前が並んでいる。']]
 ];
 const palette=[
   {walls:0x8d6e57,wood:0x5f4736,accent:0xe1bf88,image:'japanese-palace.webp'},
   {walls:0x766d62,wood:0x453e39,accent:0xf0c26b,image:'japanese-corridor.webp'},
   {walls:0x777f90,wood:0x453b50,accent:0xcdb4ef,image:'western-cathedral.webp'},
   {walls:0x87716c,wood:0x6b3c3a,accent:0xffdb9b,image:'western-throne.webp'},
   {walls:0x978577,wood:0x614a36,accent:0xd9e2b7,image:'japanese-palace.webp'},
   {walls:0x718c82,wood:0x324c4b,accent:0x9be2c4,image:'ruins-sunlight.webp'},
   {walls:0x64677a,wood:0x30343b,accent:0xffb67c,image:'cave-embers.webp'},
   {walls:0x536885,wood:0x293950,accent:0x91caff,image:'cave-crystals.webp'},
   {walls:0x73747b,wood:0x494850,accent:0xe5d9ba,image:'ruins-moonlit.webp'},
   {walls:0x81716c,wood:0x553e44,accent:0xf6cba1,image:'western-throne.webp'}
 ];
 const cacheArt=name=>{
   if(!art.has(name)){
     const t=imageLoader.load('assets/rf562/'+name);
     t.colorSpace=THREE.SRGBColorSpace;
     t.anisotropy=small?2:4;
     art.set(name,t);
   }
   return art.get(name);
 };
 function uiForTime(){
   let e=document.getElementById('rf564-life-status');
   if(!e){
     e=document.createElement('div');e.id='rf564-life-status';e.setAttribute('aria-live','off');
     document.body.append(e);
   }
   return e;
 }
 function phase(){
   // An accelerated illustrative day; affects lighting and town-only narration.
   const tick=Math.floor(Date.now()/150000) % 4;
   return Math.max(0,tick);
 }
 function transition(kind,caption){
   let e=document.getElementById('rf564-room-transition');
   if(!e){e=document.createElement('div');e.id='rf564-room-transition';e.setAttribute('aria-hidden','true');
     const title=document.createElement('b');e.append(title);document.body.append(e);}
   e.querySelector('b').textContent=caption|| (kind==='enter'?'室内に移動':'町へ戻る');
   e.classList.remove('rf564-transition-show','rf564-transition-out');
   void e.offsetWidth;
   e.classList.add('rf564-transition-show');
   clearTimeout(e.__rf564Timer);
   e.__rf564Timer=setTimeout(()=>e.classList.add('rf564-transition-out'),310);
 }
 function clearDecor(a){
   const x=a?.rf564Life;
   if(!x)return;
   if(x.actor){
     x.actor.mixer?.stopAllAction();
     try{disposeModel(x.actor.instance,x.actor.mixer)}catch{}
   }
   x.group?.removeFromParent();
   for(const r of x.owned){try{r.dispose?.()}catch{}}
   a.rf564Life=null;
 }
 function makeDecor(field,marker){
   const a=field.__rf563Story;
   if(!a)return;
   clearDecor(a);
   const index=marker.index%palette.length,p=palette[index],group=new THREE.Group(),owned=[];
   group.name='RF564_Interior_'+marker.index;
   a.room.add(group);
   const material=(color,metal=0.05,rough=0.78)=>{
     const m=new THREE.MeshStandardMaterial({color,metalness:metal,roughness:rough});owned.push(m);return m;};
   const wood=material(p.wood),stone=material(p.walls),gilt=material(p.accent,0.26,0.54),cloth=material(new THREE.Color(p.wood).lerp(new THREE.Color(p.accent),.36));
   const box=(w,h,d,m,x,y,z,r=.1)=>{
     const g=new RoundedBoxGeometry(w,h,d,small?2:3,Math.min(r,Math.min(w,h,d)*.25));owned.push(g);
     const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=false;o.receiveShadow=false;group.add(o);return o;
   };
   const disk=(rt,rb,h,m,x,y,z,seg=20)=>{
     const g=new THREE.CylinderGeometry(rt,rb,h,small?12:seg);owned.push(g);
     const o=new THREE.Mesh(g,m);o.position.set(x,y,z);group.add(o);return o;
   };
   // Actual furniture visible in front of the CG background, without sharp box silhouettes.
   box(4.4,.28,2.4,wood,0,.93,-2.0,.11);for(const x of [-1.7,1.7])for(const z of [-2.7,-1.3])disk(.12,.17,.85,stone,x,.43,z);
   box(3.5,.22,1.4,cloth,-4,.52,1.0,.1);box(3.5,.45,.37,wood,-4,.95,1.58,.08);
   box(2.4,2.9,.5,wood,4.7,1.47,-5,.10); // bookcase / cupboard
   for(const y of [.55,1.4,2.25])box(2.25,.13,.7,gilt,4.7,y,-4.55,.04);
   for(let i=0;i<5;i++)box(.26,.72,.3,material([0x9a503d,0x586c8f,0x756895,0x6b905e,0xa7a08a][i],.02,.92),3.9+i*.39,1.81,-4.4,.05);
   // Decorative curved arches and lanterns smooth the interior silhouette.
   for(const x of [-6,6]){
     const geo=new THREE.TorusGeometry(.62,.10,small?8:12,small?20:32,Math.PI);owned.push(geo);
     const arch=new THREE.Mesh(geo,gilt);arch.position.set(x,4.8,-6.7);group.add(arch);
     const globeGeo=new THREE.SphereGeometry(.26,small?12:20,small?8:14);owned.push(globeGeo);
     const globe=new THREE.Mesh(globeGeo,material(0xffddb2,.02,.22));globe.position.set(x,4.4,-6.7);group.add(globe);
   }
   // Each building changes the actual interior set, not merely the caption.
   if(index===1||index===6){
     disk(.85,.95,.9,stone,-4,.46,-3.1);disk(.65,.75,.16,gilt,-4,.99,-3.1);
     box(1.5,1.5,1,wood,5,.8,2,.12);
   }else if(index===2||index===7){
     for(let i=0;i<5;i++)box(.25,1.4,.6,material([0x624f72,0x765a48,0x4d6a79][i%3]),-5+i*.44,1.55,-3.8,.05);
     disk(.8,.8,.12,gilt,-4,.93,-3.7);
   }else if(index===4){
     disk(.73,.85,.8,stone,2.3,.4,1.65);disk(.55,.60,.20,gilt,2.3,.85,1.65);
   }else if(index===5){
     for(let i=0;i<6;i++){
       const g=new THREE.SphereGeometry(.19,small?10:16,small?8:12);owned.push(g);
       const jar=new THREE.Mesh(g,material([0x8ac0a5,0xb9a1e6,0xe3b68c][i%3],.05,.28));jar.position.set(3.8+i*.3,2.65,-4.5);group.add(jar);
     }
   }
   if(a.back?.material){
     a.back.material.map=cacheArt(p.image);
     a.back.material.needsUpdate=true;
   }
   if(a.lamp?.color)a.lamp.color.setHex(p.accent);
   // Original source is an animated, rigged GLB from the existing loaded NPC roster.
   let actor=null;
   try{
     const keys=field.o?.npcKeys||[],key=keys[(marker.index*3+field.o.chapter)%keys.length],gltf=field.o.assets?.[key];
     if(gltf?.scene){
       const instance=instantiateModel(gltf,1.72,null);
       instance.wrapper.position.set(2.5,0,-5.1);group.add(instance.wrapper);
       const mixer=new THREE.AnimationMixer(instance.model);
       const idle=(gltf.animations||[]).find(x=>/idle|wait|stand/i.test(x.name))||(gltf.animations||[])[0];
       if(idle)mixer.clipAction(idle).play();
       actor={instance,mixer,key};
     }
   }catch(error){console.warn('[RF564 NPC interior]',error)}
   a.rf564Life={index,owned,group,actor,interactions:[
     {x:0,z:-1.3,title:activities[index][0][0],message:activities[index][0][1]},
     {x:-4,z:1.35,title:activities[index][1][0],message:activities[index][1][1]},
     {x:2.5,z:-4.2,title:'住民と会話',message:`${marker.name}の住民が、旅先の出来事や今日の暮らしを語ってくれた。`}
   ]};
 }
 function notifyLife(title,message){
   const panel=document.getElementById('rf563-interior-panel');
   if(!panel)return;
   const b=panel.querySelector('strong'),s=panel.querySelector('span');
   if(b)b.textContent=title;
   if(s)s.textContent=message;
   panel.hidden=false;
 }
 window.RF564Interiors={
   onEnter(field,marker){
     makeDecor(field,marker);transition('enter',`${marker.name}・室内へ`);
     document.body.classList.add('rf564-life-indoor');
   },
   onLeave(field){
     transition('leave','町の通りへ');
     document.body.classList.remove('rf564-life-indoor');
     clearDecor(field.__rf563Story);
   },
   onDispose(field){
     clearDecor(field.__rf563Story);
     document.body.classList.remove('rf564-life-indoor');
   }
 };
 const oldTown=Field.prototype.buildTown;
 Field.prototype.buildTown=function(...args){
   const result=oldTown.apply(this,args);
   if(this.__rf563Story){
     this.__rf563Story.markers.forEach((m,i)=>{m.name=titles[i%titles.length]});
   }
   return result;
 };
 const oldWilds=Field.prototype.buildWilds;
 Field.prototype.buildWilds=function(...args){
   const result=oldWilds.apply(this,args);
   // Preserve texture, instancing and collision; only soften visibly angular silhouettes.
   try{
     this.group.traverse(node=>{
       if(!node.isInstancedMesh || !node.geometry)return;
       const g=node.geometry;
       if(g.type==='ConeGeometry' && (g.parameters?.radialSegments||0)<11){
         node.geometry=this.geo(new THREE.ConeGeometry(g.parameters.radius,g.parameters.height,small?12:22,g.parameters.heightSegments||1,!!g.parameters.openEnded));
       }else if(g.type==='DodecahedronGeometry' && (g.parameters?.detail||0)===0){
         node.geometry=this.geo(new THREE.SphereGeometry(g.parameters.radius||1,small?12:20,small?8:14));
       }
     });
   }catch(error){console.warn('[RF564 smooth foliage]',error)}
   return result;
 };
 const oldUpdate=Field.prototype.update;
 Field.prototype.update=function(dt,inp,camera){
   const result=oldUpdate.call(this,dt,inp,camera);
   const a=this.__rf563Story;
   if(a?.mode && a.rf564Life){
     const d=a.rf564Life;
     d.actor?.mixer?.update(Math.max(0,dt));
     const p=this.player?.pos;
     if(p){
       let near=null,nearest=Infinity;
       for(const it of d.interactions){
         const dis=Math.hypot(p.x-a.center.x-it.x,p.z-a.center.z-it.z);
         if(dis<nearest && dis<1.9){near=it;nearest=dis;}
       }
       const quest=/^(?:入口へ戻る|レバーを引く|宝箱を開ける|宝箱は空|解除済みの仕掛け)/.test(this.prompt||'');
       if(near && !quest){
         this.prompt=`${near.title}を調べる（J／斬）`;
         if(inp?.attack && a.delay<=0){
           a.delay=.65;
           notifyLife(near.title,near.message);
         }
       }
     }
   }
   if(!this.__rf564LifeTicker){this.__rf564LifeTicker=0;this.__rf564LifePhase=-1;}
   this.__rf564LifeTicker+=Math.max(0,dt);
   if(this.__rf564LifeTicker>.7){
     this.__rf564LifeTicker=0;
     const ph=phase();
     const name=this.B?.name||'世界';
     const status=uiForTime();
     status.textContent=`${name}の旅路　｜　${days[ph]}　｜　${a?.mode?a.mode.name:(this.region||this.townName||'世界探索')}`;
     document.body.dataset.rf564Biome=name;
     document.body.dataset.rf564Period=String(ph);
     if(this.__rf564LifePhase!==ph){
       this.__rf564LifePhase=ph;
       const cur=ph===3?.82:ph===2?.9:1;
       if(a?.lamp)a.lamp.intensity=small?1.6*cur:2.5*cur;
     }
   }
   return result;
 };
 const oldDispose=Field.prototype.dispose;
 Field.prototype.dispose=function(...args){
   document.body.classList.remove('rf564-life-indoor');
   delete document.body.dataset.rf564Biome;
   delete document.body.dataset.rf564Period;
   document.getElementById('rf564-life-status')?.remove();
   return oldDispose.apply(this,args);
 };
 window.RF564WorldLife={version:'55.14',buildingKinds:titles.length,hasTransitions:true,hasDailyLife:true};
}
