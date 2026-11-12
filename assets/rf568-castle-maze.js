/* Riftfall Arena — enclosed timber keep for Infinite Castle.
 * Continuous corridors connect the main keep, halls, side rooms and the ascent.
 */
import * as THREE from 'three';
import { buildCastleArchitecture, castleInstances, castlePalette, castleTextures } from './rf5530/castle-art.js?v=55.30';
const N=13, CELL=7.2, HALF=N*CELL/2, CEILING=13.5;
const D=[[-1,0,1,4],[0,1,2,8],[1,0,4,1],[0,-1,8,2]]; // N/E/S/W: dr,dc,wall,opposite
const rngFor=seed=>()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
const clamp=(a,b,n)=>Math.max(a,Math.min(b,n));
const at=(r,c)=>r*N+c;
const valid=(r,c)=>r>=0&&c>=0&&r<N&&c<N;
const cellCenter=(r,c)=>({x:(c+.5)*CELL-HALF,z:(r+.5)*CELL-HALF});
const cellsAround=(r,c)=>D.map(([dr,dc,wall,op],d)=>({r:r+dr,c:c+dc,wall,op,d})).filter(v=>valid(v.r,v.c));
export function generateCastleLayout(floor,seed){
 const random=rngFor((((seed>>>0)^Math.imul(floor,0x9e3779b1))>>>0)||1);
 const tiles=Array.from({length:N*N},()=>15);
 const seen=new Uint8Array(N*N),stack=[at(1,1)];seen[at(1,1)]=1;
 while(stack.length){
  const i=stack[stack.length-1],r=Math.floor(i/N),c=i%N;
  const candidates=cellsAround(r,c).filter(v=>!seen[at(v.r,v.c)]);
  if(!candidates.length){stack.pop();continue;}
  const v=candidates[Math.floor(random()*candidates.length)],j=at(v.r,v.c);
  tiles[i]&=~v.wall;tiles[j]&=~v.op;seen[j]=1;stack.push(j);
 }
 // Connected maze with shortcuts, side rooms and wide intersection chambers.
 const shortcuts=0.18+Math.min(.13,floor*.0011);
 for(let r=1;r<N-1;r++)for(let c=1;c<N-1;c++)for(const v of cellsAround(r,c)){
  if(v.d!==1&&v.d!==2)continue;
  if(random()<shortcuts){tiles[at(r,c)]&=~v.wall;tiles[at(v.r,v.c)]&=~v.op;}
 }
 function openRoom(r0,r1,c0,c1){
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)for(const v of cellsAround(r,c)){
   if(v.r<r0||v.r>r1||v.c<c0||v.c>c1)continue;
   tiles[at(r,c)]&=~v.wall;tiles[at(v.r,v.c)]&=~v.op;
  }
 }
 openRoom(0,3,4,8);
 openRoom(4,8,4,8);
 openRoom(6,6,0,12);
 openRoom(1,12,6,6);
 for(const [r0,r1,c0,c1] of [[0,2,0,2],[0,2,10,12],[10,12,0,2],[10,12,10,12]])openRoom(r0,r1,c0,c1);
 const start=at(1,1);
 function route(startIndex,endIndex){
  const prev=new Int16Array(N*N).fill(-1),queue=[startIndex];prev[startIndex]=startIndex;
  for(let head=0;head<queue.length;head++){
   const i=queue[head];if(i===endIndex)break;
   const r=Math.floor(i/N),c=i%N;
   for(const v of cellsAround(r,c)){
    if(tiles[i]&v.wall)continue;
    const j=at(v.r,v.c);if(prev[j]>=0)continue;prev[j]=i;queue.push(j);
   }
  }
  if(prev[endIndex]<0)return [];
  const path=[];for(let cur=endIndex;;cur=prev[cur]){path.push(cur);if(cur===startIndex)break;}
  return path.reverse();
 }
 const distances=new Int16Array(N*N).fill(-1);distances[start]=0;
 const bfs=[start];for(let head=0;head<bfs.length;head++){
  const i=bfs[head],r=Math.floor(i/N),c=i%N;
  for(const v of cellsAround(r,c))if(!(tiles[i]&v.wall)){
   const j=at(v.r,v.c);if(distances[j]===-1){distances[j]=distances[i]+1;bfs.push(j);}
  }
 }
 const exit=[at(11,11),at(11,1),at(1,11)].reduce((a,b)=>distances[b]>distances[a]?b:a);
 const inStair=i=>Math.abs(Math.floor(i/N)-Math.floor(exit/N))<=1&&Math.abs(i%N-exit%N)<=1;
 const enemyCells=bfs.filter(i=>!inStair(i)&&distances[i]>3);
 function roomAt(i){
  const r=Math.floor(i/N),c=i%N;
  if(inStair(i))return '階段室';
  if(r<=3&&c>=4&&c<=8)return '本丸';
  if(r>=4&&r<=8&&c>=4&&c<=8)return '大広間';
  if(r===6||c===6)return '長回廊';
  return '脇の間';
 }
 for(let i=enemyCells.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[enemyCells[i],enemyCells[j]]=[enemyCells[j],enemyCells[i]];}
 const cellOf=(p)=>{
  const c=clamp(0,N-1,Math.floor((p.x+HALF)/CELL));
  const r=clamp(0,N-1,Math.floor((p.z+HALF)/CELL));return at(r,c);
 };
 return {floor,seed,N,CELL,HALF,tiles,start,exit,distances,bfs,enemyCells,route,cellOf,roomAt,
  centerOf:(i)=>cellCenter(Math.floor(i/N),i%N),
  linked:(i,j)=>route(i,j).length>0};
}

const makeCanvas=(w,h,paint)=>{
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;
 const ctx=cv.getContext('2d');if(ctx)paint(ctx,w,h);return cv;
};
function canvasTexture(canvas,repeatX=1,repeatY=1){
 const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeatX,repeatY);
 t.anisotropy=2;return t;
}
function makeNavigationUI(layout){
 const root=document.createElement('div');root.id='rf568-maze-map';root.setAttribute('aria-label','無限天守・迷路地図');
 const title=document.createElement('div');title.className='rf568-map-title';title.textContent='天守 城内図';
 const canvas=document.createElement('canvas');canvas.width=208;canvas.height=208;
 const hint=document.createElement('div');hint.className='rf568-map-hint';hint.textContent='赤：敵兵　金：階段';
 root.append(title,canvas,hint);document.body.append(root);
 return {root,canvas,ctx:canvas.getContext('2d'),last:0};
}
/** Persistent floor-world, owned by a Battle but rebuilt in place at staircase crossings. */
export class CastleMazeWorld {
 constructor(battle,{floor=1,seed=1,arena=null}={}){
  this.battle=battle;this.scene=battle.scene;this.layout=null;this.group=null;this.owned=[];this.walls=[];
  this.baseCameraFov=battle.camera?.isPerspectiveCamera?battle.camera.fov:null;
  this.visited=new Uint8Array(N*N);this.stair=null;this.arena=arena;this.arenaWasVisible=arena?.visible;this.map=null;this.fog=this.scene.fog?.clone();
  this.textures=castleTextures(THREE,N);
  this.outdoorLights=this.scene.children.filter(light=>light.isDirectionalLight||light.isHemisphereLight).map(light=>[light,light.intensity]);
  this.outdoorEnvironment=this.scene.environmentIntensity;
  for(const [light,intensity] of this.outdoorLights)light.intensity=intensity*.32;
  this.scene.environmentIntensity=this.outdoorEnvironment*.40;
  if(arena)arena.visible=false;
  try{this.build(floor,seed);}catch(error){this.destroy();throw error;}
 }
 build(floor,seed){
  this.clearLevel();
  this.battle.rfCastleCameraReady=false;
  if(this.scene.fog){this.scene.fog.color.set(castlePalette(floor).fog);this.scene.fog.near=13;this.scene.fog.far=55;}
  this.layout=generateCastleLayout(floor,seed);
  this.visited=new Uint8Array(N*N);
  const l=this.layout;
  const low=/Android|iPhone|iPad/i.test(navigator.userAgent||'')||(navigator.deviceMemory||8)<=4;
  const group=new THREE.Group();group.name='RF568_InfiniteCastle_Enclosed_Maze';this.scene.add(group);this.group=group;
  const own=resource=>(this.owned.push(resource),resource);
  this.architecture=buildCastleArchitecture(THREE,group,own,l,this.textures,this.walls,CEILING,low);
  this.setStair(false);
  this.indexWalls();
  if(!this.map)this.map=makeNavigationUI(l);
  this.map.title=this.map.root?.querySelector?.('.rf568-map-title');
  if(this.map.title)this.map.title.textContent=`天守 第${floor}層・城内図`;
  document.body.classList.add('rf568-infinite-maze');
  this.updateMap(null,[],true);
 }
 indexWalls(){
  // Each tile checks only walls next to its own square and the 8 surrounding squares.
  const l=this.layout;this.buckets=Array.from({length:N*N},()=>[]);
  for(const w of this.walls){
   const x0=clamp(0,N-1,Math.floor((w.x-w.w/2-2+HALF)/CELL));
   const x1=clamp(0,N-1,Math.floor((w.x+w.w/2+2+HALF)/CELL));
   const z0=clamp(0,N-1,Math.floor((w.z-w.d/2-2+HALF)/CELL));
   const z1=clamp(0,N-1,Math.floor((w.z+w.d/2+2+HALF)/CELL));
   for(let r=z0;r<=z1;r++)for(let c=x0;c<=x1;c++)this.buckets[at(r,c)].push(w);
  }
 }
 collision(x,z,r){
  if(x< -HALF+r || x>HALF-r||z< -HALF+r||z>HALF-r)return true;
  const walls=this.buckets[this.layout.cellOf({x,z})]||[];
  for(const w of walls){
   const cx=clamp(w.x-w.w/2,w.x+w.w/2,x),cz=clamp(w.z-w.d/2,w.z+w.d/2,z);
   if((x-cx)**2+(z-cz)**2<r*r)return true;
  }
  return false;
 }
 resolve(pos,r=0.5,previous=null){
  if(!previous)return;
  const radius=clamp(.32,1.05,r);
  const oldX=previous.x,oldZ=previous.z,dx=pos.x-oldX,dz=pos.z-oldZ;
  let x=oldX,z=oldZ;
  const steps=Math.min(400,Math.max(1,Math.ceil(Math.hypot(dx,dz)/.42)));
  for(let k=0;k<steps;k++){
   const nx=x+dx/steps,nz=z+dz/steps;
   if(!this.collision(nx,z,radius))x=nx;
   if(!this.collision(x,nz,radius))z=nz;
  }
  pos.x=x;pos.z=z;
 }
 lineClear(a,b){
  const d=Math.hypot(a.x-b.x,a.z-b.z);const steps=Math.max(1,Math.ceil(d/.53));
  for(let i=1;i<steps;i++){
   const t=i/steps;
   if(this.collision(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.12))return false;
  }
  return true;
 }
 routeNext(a,b){
  const l=this.layout,s=l.cellOf(a),t=l.cellOf(b);
  if(s===t)return {x:b.x,z:b.z};
  const path=l.route(s,t);if(path.length<2)return null;
  let i=path[1],p=l.centerOf(i);
  if(Math.hypot(a.x-p.x,a.z-p.z)<1.5&&path.length>2) {i=path[2];p=l.centerOf(i);}
  return p;
 }
 clipCamera(look,target){
  const maxY=CEILING-1.1;
  const bound=HALF-.6, rayX=target.x-look.x, rayZ=target.z-look.z;
  const height=clamp(2.5,maxY,target.y);
  const rangeSquared=rayX**2+rayZ**2+(height-look.y)**2;
  // Lift the camera as its horizontal orbit shortens, within the ceiling clearance.
  const liftedY=(x,z)=>clamp(2.5,maxY,look.y+Math.sqrt(Math.max(0,rangeSquared-x*x-z*z)));
  const travel=(start,delta)=>delta===0?Infinity:((delta>0?bound:-bound)-start)/delta;
  const limit=clamp(0,1,Math.min(travel(look.x,rayX),travel(look.z,rayZ)));
  const dx=rayX*limit,dz=rayZ*limit;
  target.set(look.x+dx,limit<1?liftedY(dx,dz):height,look.z+dz);
  const count=Math.max(1,Math.ceil(Math.hypot(dx,target.y-look.y,dz)/.35));
  for(let i=1;i<=count;i++){
   const t=i/count,x=look.x+dx*t,z=look.z+dz*t;
   let clearance=0;
   for(const wall of this.buckets[this.layout.cellOf({x,z})]){
    if(Math.abs(x-wall.x)<wall.w/2+.32&&Math.abs(z-wall.z)<wall.d/2+.32)clearance=Math.max(clearance,wall.h+.32);
   }
   const y=look.y+(target.y-look.y)*t;
   if(y>=clearance)continue;
   const raisedY=look.y+(clearance-look.y)/t;
   if(raisedY<=maxY){
    target.y=raisedY;
    continue;
   }
   const k=(i-1)/count;
   target.set(look.x+dx*k,liftedY(dx*k,dz*k),look.z+dz*k);
   break;
  }
 }
 setStair(show){
  const p=this.exitPoint();
  if(!this.stair){
   const g=new THREE.Group();g.name='Infinite Castle stair room';g.position.set(p.x,0,p.z);
   const route=this.layout.route(this.layout.start,this.layout.exit);
   const entrance=this.layout.centerOf(route[route.length-2]);
   g.rotation.y=Math.atan2(entrance.x-p.x,entrance.z-p.z);
   const own=resource=>(this.owned.push(resource),resource);
   const box=own(new THREE.BoxGeometry(1,1,1));
   const quad=own(new THREE.PlaneGeometry(1,1));
   const {wood,gold,lacquer,lamp}=this.architecture;
   const steps=[],nosings=[],posts=[],flames=[];
   for(let i=0;i<14;i++){
    const height=.33+i*.31,z=2.65-i*.42;
    steps.push([0,height/2,z,4.1,height,.43]);
    nosings.push([0,height+.012,z+.19,4.12,.031,.065]);
    if(i%4===0)for(const side of [-1,1]){
     posts.push([side*2.2,height+.63,z,.19,1.26,.19]);
     if(i%8===0)flames.push([side*2.2,height+1.56,z,.75,1.06,1,side*.18]);
    }
   }
   for(const side of [-1,1])posts.push([side*2.2,3.15,-.08,.16,.16,7.06,0,Math.atan2(.31,.42)]);
   for(const z of [2.9,-2.75]){
    const h=z>0?5.22:8.01;
    posts.push([-2.48,h/2,z,.43,h,.47],[2.48,h/2,z,.43,h,.47],[0,h,z,5.45,.53,.57]);
   }
   castleInstances(THREE,g,own,'Cedar stair treads',box,wood,steps);
   castleInstances(THREE,g,own,'Stair nosing',box,gold,nosings);
   castleInstances(THREE,g,own,'Stair portal and handrails',box,lacquer,posts);
   castleInstances(THREE,g,own,'Stair torches',quad,lamp,flames);
   const gate=new THREE.Group();gate.name='Locked stair gate';
   const bars=[[0,.32,3.14,4.83,.48,.37],[0,3.7,3.14,4.83,.48,.37],[0,1.97,3.14,4.83,.15,.36]];
   for(let i=-4;i<=4;i++)bars.push([i*.49,2,3.14,.16,3.60,.28]);
   castleInstances(THREE,gate,own,'Locked stair gate bars',box,wood,bars);g.add(gate);
   const tex=own(canvasTexture(makeCanvas(256,128,g=>{
    g.fillStyle='#241d22';g.fillRect(12,17,232,92);
    g.strokeStyle='#bd9a67';g.lineWidth=3;g.strokeRect(15,20,226,86);
    g.font='bold 33px serif';g.textAlign='center';g.fillStyle='#fff1cb';g.fillText('上階への階段',128,76);
   })));
   const material=own(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
   const sign=new THREE.Sprite(material);sign.position.set(0,5.8,2.9);sign.scale.set(4.55,2.27,1);g.add(sign);
   this.group.add(g);this.stair={gate,sign,open:false};
  }
  this.stair.open=show;this.stair.gate.visible=!show;this.stair.sign.visible=show;
  return show?p:null;
 }
 updateMap(player,enemies=[],force=false){
  if(!this.map?.ctx)return;
  const t=performance.now();if(!force&&t-this.map.last<220)return;this.map.last=t;
  const ctx=this.map.ctx,l=this.layout,C=l.N,S=208/C;
  ctx.clearRect(0,0,208,208);ctx.fillStyle='#10182a';ctx.fillRect(0,0,208,208);
  if(player)this.visited[l.cellOf(player)]=1;
  if(this.map.title&&player)this.map.title.textContent="第"+l.floor+"層 · "+l.roomAt(l.cellOf(player));
  for(let i=0;i<C*C;i++){
   const r=Math.floor(i/C),c=i%C,x=c*S,z=r*S;
   const near=player&&Math.hypot(c-(l.cellOf(player)%C),r-Math.floor(l.cellOf(player)/C))<3.3;
   const visible=this.visited[i]||near;
   if(!visible)continue;
   ctx.fillStyle=this.visited[i]?'#5d5044':'#342e35';ctx.fillRect(x+.5,z+.5,S-1,S-1);
   ctx.strokeStyle='#e1cbab';ctx.lineWidth=1.7;
   const walls=l.tiles[i];ctx.beginPath();if(walls&1){ctx.moveTo(x,z);ctx.lineTo(x+S,z);}
   if(walls&2){ctx.moveTo(x+S,z);ctx.lineTo(x+S,z+S);}
   if(walls&4){ctx.moveTo(x,z+S);ctx.lineTo(x+S,z+S);}
   if(walls&8){ctx.moveTo(x,z);ctx.lineTo(x,z+S);}
   ctx.stroke();
  }
  for(const e of enemies){const i=l.cellOf(e);ctx.fillStyle='#ff6267';ctx.beginPath();ctx.arc(((i%C)+.5)*S,(Math.floor(i/C)+.5)*S,2.5,0,Math.PI*2);ctx.fill();}
  if(this.stair?.open){const i=l.exit;ctx.fillStyle='#ffe390';ctx.beginPath();ctx.arc(((i%C)+.5)*S,(Math.floor(i/C)+.5)*S,4.1,0,Math.PI*2);ctx.fill();}
  if(player){const px=(player.x+HALF)/CELL*S,pz=(player.z+HALF)/CELL*S;ctx.fillStyle='#7cdbff';ctx.beginPath();ctx.arc(px,pz,4.2,0,Math.PI*2);ctx.fill();}
 }
 startPoint(){return this.layout.centerOf(this.layout.start);}
 exitPoint(){return this.layout.centerOf(this.layout.exit);}
 clearLevel(){
  this.stair=null;this.architecture=null;
  if(this.group)this.group.removeFromParent();this.group=null;
  for(const item of this.owned)try{item.dispose?.()}catch{}
  this.owned=[];this.walls=[];this.buckets=[];
 }
 destroy(){this.clearLevel();
  const camera=this.battle.camera;
  if(this.baseCameraFov!==null&&camera.fov!==this.baseCameraFov){
   camera.fov=this.baseCameraFov;
   camera.updateProjectionMatrix();
  }
  if(this.arena?.parent)this.arena.visible=this.arenaWasVisible;
  for(const [light,intensity] of this.outdoorLights)light.intensity=intensity;
  this.scene.environmentIntensity=this.outdoorEnvironment;
  for(const map of Object.values(this.textures||{}))map.dispose();
  this.textures=null;
  if(this.fog&&this.scene.fog){this.scene.fog.color.copy(this.fog.color);this.scene.fog.near=this.fog.near;this.scene.fog.far=this.fog.far;}
  this.map?.root?.remove();this.map=null;document.body.classList.remove('rf568-infinite-maze');
 }
}

/** Only installed for a Battle whose rf568Maze is present. Other modes untouched. */
export function installCastleBattleNavigation(Battle){
 if(Battle.prototype.__rf568NavInstalled)return;Battle.prototype.__rf568NavInstalled=true;
 const oldAI=Battle.prototype.aiInput;
 Battle.prototype.aiInput=function(f,dt){
  const inp=oldAI.call(this,f,dt),maze=this.rf568Maze;
  if(!maze||!f.cpu||f.dead)return inp;
  const target=this.nearestEnemy(f);if(!target)return inp;
  const dist=Math.hypot(target.pos.x-f.pos.x,target.pos.z-f.pos.z);
  const visible=maze.lineClear(f.pos,target.pos);
  if(!visible||dist>4.5){
   const next=maze.routeNext(f.pos,target.pos);
   if(next){const dx=next.x-f.pos.x,dz=next.z-f.pos.z,d=Math.hypot(dx,dz);
    if(d>.15){inp.mx=dx/d;inp.mz=dz/d;}}
  }
  if(!visible){inp.attack=false;delete inp.skillIdx;inp.over=false;}
  return inp;
 };
 const oldHit=Battle.prototype.applyHit;
 Battle.prototype.applyHit=function(att,tgt,...args){
  if(this.rf568Maze && att?.pos && tgt?.pos && !this.rf568Maze.lineClear(att.pos,tgt.pos))return;
  return oldHit.call(this,att,tgt,...args);
 };
 const oldCamera=Battle.prototype.updateCamera;
 Battle.prototype.updateCamera=function(dt){
  if(!this.rf568Maze)return oldCamera.call(this,dt);
  const me=this.fighters.find(f=>f.isPlayer);
  if(!me)return oldCamera.call(this,dt);
  const maze=this.rf568Maze,center=this.camCenter,camera=this.camera;
  const t=1-Math.exp(-5*Math.min(.2,Math.max(0,dt)));
  const ready=this.rfCastleCameraReady;
  if(ready)center.lerp(me.pos,t);
  else center.copy(me.pos);
  const look=(this.rfCastleLook||=new THREE.Vector3()).set(center.x,1.45,center.z);
  // Automatic framing follows the fighter, with a fixed heading for screen-relative steering.
  const requestedYaw=this.rfCameraView?.yaw??0;
  const turn=ready?requestedYaw-this.rfCastleYaw:0;
  const yaw=ready?this.rfCastleYaw+Math.atan2(Math.sin(turn),Math.cos(turn))*t:requestedYaw;
  const distance=10.4*clamp(.83,1,.72+camera.aspect*.28);
  const height=10.4;
  const referenceRange=Math.hypot(distance,height-look.y);
  const pos=camera.position.set(center.x+Math.sin(yaw)*distance,height,center.z+Math.cos(yaw)*distance);
  maze.clipCamera(look,pos);

  // Match the visible span at the focus point, even when a wall shortens the orbit.
  const baseFov=maze.baseCameraFov;
  if(baseFov!==null){
   const halfAngle=Math.tan(THREE.MathUtils.degToRad(baseFov/2));
   const fitted=THREE.MathUtils.radToDeg(2*Math.atan(halfAngle*referenceRange/pos.distanceTo(look)));
   const fov=clamp(baseFov-10,baseFov+22,fitted);
   if(Math.abs(camera.fov-fov)>.05){
    camera.fov=fov;
    camera.updateProjectionMatrix();
   }
  }
  const pitch=-Math.atan2(pos.y-look.y,Math.hypot(pos.x-look.x,pos.z-look.z));
  camera.rotation.set(pitch,yaw,0,'YXZ');
  camera.updateMatrixWorld();
  this.rfCastleYaw=yaw;
  this.rfCastleCameraReady=true;
 };
}
