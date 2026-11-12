/* Riftfall Arena V55.19 — Sengoku-style wooden tenshu interior for Infinite Castle.
 * Real indoor castle floors, timber halls and ceilings, lighter sight-lines, AABB collision,
 * navigation, floor-local enemies and stairs. This module does NOT affect normal battles.
 */
import * as THREE from 'three';
import { approachYaw } from './rf-camera-v5520.js';
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
 openRoom(5,7,0,12);
 openRoom(1,12,5,7);
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
  if((r>=5&&r<=7)||(c>=5&&c<=7))return '長回廊';
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
function makeMaterial(color,opts={}){return new THREE.MeshStandardMaterial({color,roughness:.83,metalness:.015,...opts});}
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
  this.visited=new Uint8Array(N*N);this.stair=null;this.arena=arena;this.arenaWasVisible=arena?.visible;this.map=null;this.fog=this.scene.fog?.clone();
  if(arena)arena.visible=false;
  this.build(floor,seed);
 }
 build(floor,seed){
  this.clearLevel();
  this.battle.rfCastleCameraReady=false;
  if(this.scene.fog){this.scene.fog.color.set(0x382825);this.scene.fog.near=17;this.scene.fog.far=61;}
  this.layout=generateCastleLayout(floor,seed);this.visited=new Uint8Array(N*N);
  const l=this.layout;const low=/Android|iPhone|iPad/i.test(navigator.userAgent||'')||(navigator.deviceMemory||8)<=4;
  const group=new THREE.Group();group.name='RF568_InfiniteCastle_Enclosed_Maze';this.scene.add(group);this.group=group;
  const own=x=>(this.owned.push(x),x);
  const random=rngFor(0x552020);
  function paintGrain(g,w,h,count){
   for(let i=0;i<count;i++){
    const x=random()*w,y=random()*h,len=16+random()*w*.46;
    g.strokeStyle=i%3?'rgba(58,25,15,.16)':'rgba(254,216,166,.15)';
    g.lineWidth=.6+random();
    g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+len*.3,y-3,x+len*.7,y+3,x+len,y);g.stroke();
   }
  }
  const floorTex=own(canvasTexture(makeCanvas(512,512,(g,w,h)=>{
   const shades=['#775039','#916444','#84573a','#9a6b47','#6b462f','#815137','#986d49','#77513c'];
   for(let i=0;i<16;i++){
    const y=i*32,grad=g.createLinearGradient(0,y,0,y+32);
    grad.addColorStop(0,'#422b20');grad.addColorStop(.09,shades[i%8]);
    grad.addColorStop(.92,shades[i%8]);grad.addColorStop(1,'#523624');
    g.fillStyle=grad;g.fillRect(0,y,w,32);
    g.fillStyle='#4c3228';g.fillRect(i*197%w,y,2,31);
   }
   paintGrain(g,w,h,1250);
  }),N*1.1,N*1.1));
  const roofTex=own(canvasTexture(makeCanvas(384,384,(g,w,h)=>{
   g.fillStyle='#4f3427';g.fillRect(0,0,w,h);
   for(let y=0;y<h;y+=96)for(let x=0;x<w;x+=96){
    const grad=g.createLinearGradient(x,y,x+96,y+96);
    grad.addColorStop(0,'#89684c');grad.addColorStop(1,'#473123');
    g.fillStyle=grad;g.fillRect(x+5,y+5,86,86);
    g.strokeStyle='#a47954';g.strokeRect(x+9,y+9,78,78);
   }
   paintGrain(g,w,h,500);
  }),N,N));
  const paperTex=own(canvasTexture(makeCanvas(256,256,(g,w,h)=>{
   const grad=g.createLinearGradient(0,0,0,h);
   grad.addColorStop(0,'#f6e8ca');grad.addColorStop(.65,'#e3c596');grad.addColorStop(1,'#ab7953');
   g.fillStyle=grad;g.fillRect(0,0,w,h);
   for(let i=0;i<5000;i++){g.fillStyle=i%2?'#fbf0ce36':'#77493122';g.fillRect(random()*w,random()*h,1+random()*2,1);}
   g.fillStyle='#543f31';
   for(let x=0;x<=w;x+=64)g.fillRect(x?x-2:x,0,4,h);
   for(let y=0;y<h;y+=54)g.fillRect(0,y,w,4);
  })));
  const matFloor=own(makeMaterial(0xf8e3c9,{map:floorTex}));
  const matCeil=own(makeMaterial(0xd8bc96,{map:roofTex,side:THREE.BackSide}));
  const matWall=own(makeMaterial(0xbb9676));
  const matWood=own(makeMaterial(floor%10===0?0x512c2b:0x563627));
  const matPlaster=own(makeMaterial(0xf7e5ca,{map:paperTex,roughness:.95,emissive:0x644224,emissiveIntensity:.16}));
  const matLacquer=own(makeMaterial(0x843d30,{roughness:.55}));
  const matTatami=own(makeMaterial(0x777456,{map:floorTex,roughness:1}));
  this.woodMaterial=matWood;
  const matGold=own(makeMaterial(0xb88b4a,{metalness:.45,roughness:.4}));
  const matLamp=own(makeMaterial(0xffd38b,{emissive:0xffa63d,emissiveIntensity:2.4}));
  const whole=N*CELL;
  const plane=own(new THREE.PlaneGeometry(whole+1.5,whole+1.5));
  const floorMesh=new THREE.Mesh(plane,matFloor);floorMesh.rotation.x=-Math.PI/2;floorMesh.position.y=.025;group.add(floorMesh);
  const ceil=new THREE.Mesh(own(new THREE.PlaneGeometry(whole+1.5,whole+1.5)),matCeil);
  ceil.rotation.x=-Math.PI/2;ceil.position.y=CEILING;group.add(ceil);
  const addInstanced=(geometry,material,rows)=>{
   if(!rows.length)return;
   const geo=own(geometry);const m=new THREE.InstancedMesh(geo,material,rows.length);
   const dummy=new THREE.Object3D();rows.forEach(([x,y,z,sx,sy,sz],i)=>{
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);
   });m.instanceMatrix.needsUpdate=true;m.frustumCulled=false;group.add(m);return m;
  };
  const outerPanels=[],innerPanels=[],frame=[],beams=[],caps=[],lattice=[];
  const outerH=CEILING,innerH=4.2,wallD=.55;
  const pushWall=(x,z,w,d,outer=false)=>{
   const h=outer?outerH:innerH;
   this.walls.push({x,z,w,d,h});
   (outer?outerPanels:innerPanels).push([x,h/2,z,w,h,d]);
   frame.push([x,.65,z,w,.34,d+.05]);
   frame.push([x,h-.22,z,w,.28,d+.06]);
   // Continuous carved timber columns at each panel end.
   if(w>d){frame.push([x-w/2,h/2,z,.31,h,d+.08],[x+w/2,h/2,z,.31,h,d+.08]);}
   else{frame.push([x,h/2,z-d/2,w+.08,h,.31],[x,h/2,z+d/2,w+.08,h,.31]);}
   if(!outer){
    lattice.push([x,h+.46,z,w,.12,d+.02]);
    lattice.push([x,h+1.0,z,w,.10,d+.02]);
   }
  };
  // Boundary walls + every real closed passage; interior partitions stay lower so the player can see.
  for(let r=0;r<N;r++)for(let c=0;c<N;c++){
   const v=l.tiles[at(r,c)],p=l.centerOf(at(r,c));
   if(v&2)pushWall(p.x+CELL/2,p.z,wallD,CELL+.04,c===N-1);
   if(v&4)pushWall(p.x,p.z+CELL/2,CELL+.04,wallD,r===N-1);
   if(c===0&&(v&8))pushWall(p.x-CELL/2,p.z,wallD,CELL+.04,true);
   if(r===0&&(v&1))pushWall(p.x,p.z-CELL/2,CELL+.04,wallD,true);
  }
  addInstanced(new THREE.BoxGeometry(1,1,1),matWall,outerPanels);
  addInstanced(new THREE.BoxGeometry(1,1,1),matPlaster,innerPanels);
  addInstanced(new THREE.BoxGeometry(1,1,1),matWood,frame);
  addInstanced(new THREE.BoxGeometry(1,1,1),matWood,lattice);
  for(let r=0;r<=N;r++){const z=r*CELL-HALF;beams.push([0,CEILING-.35,z,whole,.48,.44]);}
  for(let c=0;c<=N;c++){const x=c*CELL-HALF;beams.push([x,CEILING-.64,0,.48,.5,whole]);}
  addInstanced(new THREE.BoxGeometry(1,1,1),matWood,beams);
  const posts=[],mats=[],lanterns=[],bases=[];
  for(let r=0;r<4;r++)for(let c=4;c<=8;c++){
   const p=l.centerOf(at(r,c));mats.push([p.x,.04,p.z,CELL-.1,.02,CELL-.1]);
  }
  for(const r of [3,8,11]){
   const z=l.centerOf(at(r,6)).z;
   caps.push([0,6.8,z,CELL*2.8,.55,.48]);
   posts.push([-CELL*1.4,3.5,z,.58,7,.58],[CELL*1.4,3.5,z,.58,7,.58]);
  }
  for(const [r,c] of [[4,4],[4,8],[8,4],[8,8],[1,4],[1,8],[5,1],[7,1],[5,11],[7,11]]){
   const p=l.centerOf(at(r,c));posts.push([p.x-CELL*.43,CEILING/2,p.z-CELL*.43,.62,CEILING,.62]);
  }
  addInstanced(new THREE.BoxGeometry(1,1,1),matLacquer,posts);
  addInstanced(new THREE.BoxGeometry(1,1,1),matTatami,mats);
  addInstanced(new THREE.BoxGeometry(1,1,1),matWood,caps);
  for(let r=1;r<N-1;r+=2)for(let c=1;c<N-1;c+=3){
   const p=l.centerOf(at(r,c)),y=l.roomAt(at(r,c))==='大広間'?8.4:6.9;
   bases.push([p.x,y+.38,p.z,1.1,.16,1.1],[p.x,y-.36,p.z,1.1,.13,1.1],[p.x,(y+CEILING)/2,p.z,.075,CEILING-y,.075]);
   lanterns.push([p.x,y,p.z,.96,.72,.96]);
  }
  addInstanced(new THREE.BoxGeometry(1,1,1),matWood,bases);
  addInstanced(new THREE.BoxGeometry(1,1,1),matLamp,lanterns);
  group.add(new THREE.HemisphereLight(0xffe0ae,0x755356,1.08));
  for(const [x,z,power] of [[0,0,105],[-CELL*3,-CELL*3,75],[CELL*3,CELL*3,80]]){
   const light=new THREE.PointLight(0xffbc78,low?power*.65:power,35,2);
   light.position.set(x,6.3,z);group.add(light);
  }
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
  target.set(clamp(-HALF+.6,HALF-.6,target.x),clamp(2.5,CEILING-1.1,target.y),clamp(-HALF+.6,HALF-.6,target.z));
  const dx=target.x-look.x,dy=target.y-look.y,dz=target.z-look.z;
  const count=Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/.35));
  for(let i=1;i<=count;i++){
   const t=i/count,x=look.x+dx*t,y=look.y+dy*t,z=look.z+dz*t;
   if(!this.buckets[this.layout.cellOf({x,z})].some(w=>y<w.h+.28&&Math.abs(x-w.x)<w.w/2+.32&&Math.abs(z-w.z)<w.d/2+.32))continue;
   const k=(i-1)/count;
   target.set(look.x+dx*k,Math.max(2.5,look.y+dy*k),look.z+dz*k);
   break;
  }
 }
 setStair(show){
  const p=this.exitPoint();
  if(!this.stair){
   const g=new THREE.Group();g.name='Infinite Castle stair room';g.position.set(p.x,0,p.z);
   const gold=makeMaterial(0xc9a56c,{metalness:.45});this.owned.push(gold);
   const box=(w,h,d,mat,x,y,z)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    this.owned.push(mesh.geometry);mesh.position.set(x,y,z);g.add(mesh);return mesh;
   };
   for(let i=0;i<9;i++){
    const h=.34+i*.29;
    box(4.5,h,.51,this.woodMaterial,0,h/2,2-i*.51);
    box(4.56,.05,.1,gold,0,h,2.24-i*.51);
    if(i%2===0)for(const side of [-1,1])box(.2,.95,.2,this.woodMaterial,side*2.35,h+.48,2-i*.51);
   }
   for(const side of [-1,1])box(.17,.16,5.05,this.woodMaterial,side*2.35,2.36,-.04).rotation.x=Math.atan2(.29,.51);
   const gate=box(4.9,2.9,.28,this.woodMaterial,0,1.46,2.75);
   const tex=canvasTexture(makeCanvas(256,128,g=>{
    g.fillStyle='#211814';g.fillRect(12,14,232,100);
    g.strokeStyle='#d1ad6b';g.lineWidth=4;g.strokeRect(14,15,228,96);
    g.font='bold 36px serif';g.textAlign='center';g.fillStyle='#fff1cb';g.fillText('上階への階段',128,78);
   }));
   const material=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});this.owned.push(tex,material);
   const sign=new THREE.Sprite(material);sign.position.set(0,4.6,0);sign.scale.set(5.8,2.9,1);g.add(sign);
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
  this.stair=null;
  if(this.group)this.group.removeFromParent();this.group=null;
  for(const item of this.owned)try{item.dispose?.()}catch{}
  this.owned=[];this.walls=[];this.buckets=[];
 }
 destroy(){this.clearLevel();
  if(this.arena?.parent)this.arena.visible=this.arenaWasVisible;
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
  const me=this.fighters.find(f=>f.isPlayer&&!f.dead);
  if(!me)return oldCamera.call(this,dt);
  const maze=this.rf568Maze,center=this.camCenter;
  const t=1-Math.exp(-5*Math.min(.2,Math.max(0,dt)));
  if(!this.rfCastleCameraReady)center.copy(me.pos);
  else center.lerp(me.pos,t);
  const look=(this.rfCastleLook||=new THREE.Vector3()).set(center.x,1.45,center.z);
  const room=maze.layout.roomAt(maze.layout.cellOf(me.pos));
  const hall=room==='大広間'||room==='本丸';
  const near=this.fighters.some(f=>f.team===1&&!f.dead&&f.pos.distanceToSquared(me.pos)<45);
  if(this.rfCameraView?.yaw==null&&Math.hypot(me.vel.x,me.vel.z)>.3)this.rfCastleYaw=approachYaw(this.rfCastleYaw??0,me.vel.x,me.vel.z,t);
  const yaw=this.rfCameraView?.yaw??this.rfCastleYaw??0;
  const dist=(hall?12.6:near?9.2:10.4)*(this.camera.aspect<1?.83:1);
  const target=(this._rf568Camera||=new THREE.Vector3()).set(center.x+Math.sin(yaw)*dist,hall?11.8:near?8.8:10.4,center.z+Math.cos(yaw)*dist);
  maze.clipCamera(look,target);
  const pos=this.camera.position;
  if(!this.rfCastleCameraReady){pos.copy(target);this.rfCastleCameraReady=true;}
  else pos.lerp(target,t);
  maze.clipCamera(look,pos);this.camera.lookAt(look);
 };
}
