/* Riftfall Arena V55.14 — cinematic original Sengoku-inspired battlefield architecture.
 * Keeps the original combat radius/AI/network authority intact; the circular
 * ARENA decoration is hidden only while a fight is active. */
import * as THREE from 'three';
import { Battle, ARENA_R } from '../game.js?v=rf553-chief-cpu-20261111';

if(!window.__rf564BattleStage){
 window.__rf564BattleStage=true;
 const compact=/Android|iPhone|iPad/i.test(navigator.userAgent)||(navigator.deviceMemory||8)<=4;
 const rawLimit=Math.max(18,Math.min(48,Number(ARENA_R)||48));
 const quality=()=>document.documentElement.dataset.rf556UiQuality==='low'?'low':'normal';
 const opt={japanese:{wood:0x553b37,light:0xffcd83,cloth:0x8f202b,metal:0xc8ab6f},
  western:{wood:0x3b465b,light:0xf7d7a4,cloth:0x414f92,metal:0xd8c8a2},
  cave:{wood:0x455161,light:0x95d6fa,cloth:0x3a6785,metal:0xb1d1dd},
  ruins:{wood:0x626675,light:0xffe1aa,cloth:0x4e6989,metal:0xd8ceac}};
 const determine=()=>{
   const name=document.getElementById('rf563-space-label')?.textContent||'';
   if(name.includes('和風'))return 'japanese';
   if(name.includes('洋風'))return 'western';
   if(name.includes('洞窟'))return 'cave';
   if(name.includes('遺跡'))return 'ruins';
   const stage=document.body.dataset.rf562Stage||'';
   for(const k of Object.keys(opt))if(stage.startsWith(k))return k;
   return 'japanese';
 };
 function hideCircularDecoration(battle){
   const hidden=[];
   for(const g of battle.scene.children){
     if(g===battle.__rf563Room||!g?.children)continue;
     const floor=g.children.find(x=>x.isMesh && x.geometry?.type==='CircleGeometry' && Number(x.geometry.parameters?.radius)>=rawLimit-1);
     if(!floor)continue;
     for(const c of g.children){
       if(!c.isMesh)continue;
       const type=c.geometry?.type;
       const rad=Number(c.geometry?.parameters?.radius)||0;
       if((type==='CircleGeometry'||type==='TorusGeometry') && rad>=rawLimit-1){
         hidden.push([c,c.visible]);c.visible=false;
       }
     }
   }
   return hidden;
 }
 function build(battle){
   if(battle.rf568Maze || battle.__rf564Arena)return;
   const room=battle.__rf563Room;
   if(!room)return;
   const kind=determine(),colors=opt[kind],scene=new THREE.Group();
   scene.name='RF564_Cinematic_3D_Battlefield';room.add(scene);
   const owned=[],flags=[];
   const metal=new THREE.MeshStandardMaterial({color:colors.metal,metalness:.44,roughness:.5});
   const timber=new THREE.MeshStandardMaterial({color:colors.wood,metalness:.05,roughness:.85});
   const cloth=new THREE.MeshStandardMaterial({color:colors.cloth,roughness:.92,side:THREE.DoubleSide});
   const lamp=new THREE.MeshStandardMaterial({color:colors.light,emissive:colors.light,emissiveIntensity:1.4,roughness:.24});
   owned.push(metal,timber,cloth,lamp);
   const mesh=(geo,mat,x,y,z,rot=0)=>{owned.push(geo);const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.y=rot;scene.add(m);return m;};
   const cyl=(r1,r2,h,mat,x,y,z)=>mesh(new THREE.CylinderGeometry(r1,r2,h,compact?14:24),mat,x,y,z);
   const ball=(r,mat,x,y,z)=>mesh(new THREE.SphereGeometry(r,compact?12:24,compact?8:16),mat,x,y,z);
   const wing=rawLimit+2.6;
   // A grand gate and covered corridors outside gameplay bounds. The player
   // still collides with the original combat field, never with these props.
   const gateBack=-wing+.15;
   for(const side of [-1,1]){
     const x=side*7.5;
     cyl(.7,.92,8.6,timber,x,4.3,gateBack);
     cyl(.9,.98,.24,metal,x,8.7,gateBack);
     // Suspended war banners, hand-curved for a fabric silhouette.
     const count=compact?3:5;
     for(let i=0;i<count;i++){
       const bz=-wing+2+(i+.5)*(2*wing-3)/count;
       const xx=side*(wing-2.7);
       cyl(.12,.15,5.7,timber,xx,2.9,bz);
       ball(.18,metal,xx,5.8,bz);
       const width=1.35,height=2.2;
       const geo=new THREE.PlaneGeometry(width,height,compact?5:8,compact?6:10);
       // Curved cloth: small wave generated only once (then animated as a whole).
       const a=geo.getAttribute('position');
       for(let k=0;k<a.count;k++){
         const px=a.getX(k),py=a.getY(k);
         a.setZ(k,Math.sin(px*3+py*1.3)*.13+(px/width)*.07);
       }
       geo.computeVertexNormals();
       const flag=mesh(geo,cloth,xx+side*.75,4.15,bz,side<0?Math.PI*.48:-Math.PI*.48);
       flag.userData.wobble=bz;
       flags.push(flag);
     }
   }
   // Roof beams and wall inlays use smooth cylindrical profiles; polygon faceting
   // of prior box pillars is intentionally less visible from the battle camera.
   for(let i=-2;i<=2;i++){
     const x=i*4.8;
     cyl(.12,.12,12,timber,x,8.4,gateBack);
     const finial=ball(.28,metal,x,9.4,gateBack);
     finial.scale.set(1,.45,1);
   }
   // Gate arch (tunnel effect), framed behind the fighters.
   const arch=mesh(new THREE.TorusGeometry(5.8,.3,compact?9:14,compact?22:42,Math.PI),metal,0,6.2,gateBack+.23);
   arch.rotation.z=0;
   const cap=mesh(new THREE.TorusGeometry(5.1,.095,compact?7:10,compact?20:38,Math.PI),lamp,0,6.2,gateBack+.28);
   cap.rotation.z=0;
   // Diffuse light globes in place of faceted fire polygons.
   for(let i=-2;i<=2;i++){
     const x=i*4.4;
     ball(.24,lamp,x,7,gateBack+.52);
   }
   if(!compact && quality()!=='low'){
     const fill=new THREE.PointLight(colors.light,1.15,20,2);fill.position.set(0,5,gateBack+3);
     scene.add(fill);
   }
   // RF566: distant battlefield districts, not a circular arena enclosure.
   // Instanced architecture is kept near the outside lanes so movement stays clear.
   const laneMat=new THREE.MeshStandardMaterial({color:kind==='japanese'?0x665342:0x6f7580,roughness:.93,metalness:.02,transparent:true,opacity:.83});
   const lane=new THREE.Mesh(new THREE.PlaneGeometry(rawLimit*1.7,13),laneMat);
   lane.rotation.x=-Math.PI/2;lane.position.set(0,.133,1);scene.add(lane);
   owned.push(lane.geometry,laneMat);
   const longPath=new THREE.Mesh(new THREE.PlaneGeometry(12,rawLimit*1.7),laneMat);
   longPath.rotation.x=-Math.PI/2;longPath.position.set(-5,.138,1);scene.add(longPath);
   owned.push(longPath.geometry);
   for(const side of [-1,1]){
     for(let i=0;i<3;i++){
       const z=(i-1)*rawLimit*.68;
       const x=side*(rawLimit-5.5);
       const m=cyl(.27,.33,5.8,timber,x,2.9,z);
       ball(.37,metal,x,5.8,z);
       const strip=mesh(new THREE.PlaneGeometry(1.4,1.9),cloth,x+side*.65,4.5,z,.24*side);
       flags.push(strip);
     }
   }
   const hidden=hideCircularDecoration(battle);
   battle.__rf564Arena={room,scene,owned,flags,hidden,kind};
   document.body.classList.add('rf564-battle-live');
   document.body.dataset.rf564BattleTheme=kind;
 }
 const prevAdd=Battle.prototype.add;
 Battle.prototype.add=function(...args){
   const result=prevAdd.apply(this,args);
   if(!this.__rf564Arena){
     try{build(this)}catch(err){console.warn('[RF564 battlefield]',err)}
   }
   return result;
 };
 const prevUpdate=Battle.prototype.update;
 Battle.prototype.update=function(dt,...args){
   const result=prevUpdate.call(this,dt,...args);
   const a=this.__rf564Arena;
   if(a && Number.isFinite(dt)){
     a.t=(a.t||0)+Math.max(0,dt);
     for(let i=0;i<a.flags.length;i++){
       const flag=a.flags[i];
       flag.rotation.z=Math.sin(a.t*1.7+i*.73)*.05;
     }
   }
   return result;
 };
 const prevDispose=Battle.prototype.dispose;
 Battle.prototype.dispose=function(...args){
   const a=this.__rf564Arena;
   if(a){
     for(const [m,visible] of a.hidden){if(m?.parent)m.visible=visible;}
     a.scene.removeFromParent();
     for(const item of a.owned)try{item.dispose()}catch{}
     this.__rf564Arena=null;
   }
   document.body.classList.remove('rf564-battle-live');
   delete document.body.dataset.rf564BattleTheme;
   return prevDispose.apply(this,args);
 };
 window.RF564Battle={version:'55.14',circleTrimHidden:true,hasCastleGate:true,style:determine};
}
