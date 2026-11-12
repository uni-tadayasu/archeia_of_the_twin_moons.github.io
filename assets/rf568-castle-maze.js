/* Riftfall Arena V55.19 — Sengoku-style wooden tenshu interior for Infinite Castle.
 * Real indoor castle floors, timber halls and ceilings, lighter sight-lines, AABB collision,
 * navigation, floor-local enemies and stairs. This module does NOT affect normal battles.
 */
import * as THREE from 'three';
const N=13, CELL=5.8, HALF=N*CELL/2;
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
 // Open a broad castle keep: central great hall, cross corridors and side halls.
 for(let r=4;r<=8;r++)for(let c=4;c<=8;c++)for(const v of cellsAround(r,c)){
  if(v.r<4||v.r>8||v.c<4||v.c>8)continue;
  tiles[at(r,c)]&=~v.wall;tiles[at(v.r,v.c)]&=~v.op;
 }
 // Main north-south and east-west interior corridors like a real wooden keep.
 for(let r=1;r<N-1;r++){
  const i=at(r,6);
  if(r<N-1){ tiles[i]&=~4; if(r+1<N) tiles[at(r+1,6)]&=~1; }
 }
 for(let c=1;c<N-1;c++){
  const i=at(6,c);
  if(c<N-1){ tiles[i]&=~2; if(c+1<N) tiles[at(6,c+1)]&=~8; }
 }
 // Side halls and audience rooms to reduce wall density and widen visibility.
 for(const [r0,r1,c0,c1] of [[2,4,8,10],[8,10,2,4],[2,4,2,4],[8,10,8,10]]){
  for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)for(const v of cellsAround(r,c)){
   if(v.r<r0||v.r>r1||v.c<c0||v.c>c1)continue;
   tiles[at(r,c)]&=~v.wall;tiles[at(v.r,v.c)]&=~v.op;
  }
 }
 // Viewing lanes through the keep: partly open partitions around the main hall.
 for(const [a,b] of [[at(3,6),at(4,6)],[at(8,6),at(9,6)],[at(6,3),at(6,4)],[at(6,8),at(6,9)]]){
  const ar=Math.floor(a/N),ac=a%N, br=Math.floor(b/N),bc=b%N;
  for(const v of cellsAround(ar,ac)) if(v.r===br&&v.c===bc){ tiles[a]&=~v.wall; tiles[b]&=~v.op; }
 }
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
 let exit=start;
 for(let i=0;i<N*N;i++)if(distances[i]>distances[exit])exit=i;
 const enemyCells=bfs.filter(i=>i!==start&&i!==exit&&distances[i]>3);
 for(let i=enemyCells.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[enemyCells[i],enemyCells[j]]=[enemyCells[j],enemyCells[i]];}
 const cellOf=(p)=>{
  const c=clamp(0,N-1,Math.floor((p.x+HALF)/CELL));
  const r=clamp(0,N-1,Math.floor((p.z+HALF)/CELL));return at(r,c);
 };
 return {floor,seed,N,CELL,HALF,tiles,start,exit,distances,bfs,enemyCells,route,cellOf,
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
 constructor(battle,{floor=1,seed=1}={}){
  this.battle=battle;this.scene=battle.scene;this.layout=null;this.group=null;this.owned=[];this.walls=[];
  this.visited=new Uint8Array(N*N);this.stair=null;this.hidden=[];this.map=null;this.counter=0;
  this.build(floor,seed);
 }
 build(floor,seed){
  this.clearLevel();
  this.layout=generateCastleLayout(floor,seed);this.visited=new Uint8Array(N*N);
  const l=this.layout;const low=/Android|iPhone|iPad/i.test(navigator.userAgent||'')||(navigator.deviceMemory||8)<=4;
  const group=new THREE.Group();group.name='RF568_InfiniteCastle_Enclosed_Maze';this.scene.add(group);this.group=group;
  const own=x=>(this.owned.push(x),x);
  const floorTex=own(canvasTexture(makeCanvas(384,384,(g,w,h)=>{
   g.fillStyle='#74664d';g.fillRect(0,0,w,h);
   for(let i=0;i<9;i++){
    g.fillStyle=i%2?'#8b785a':'#99886c';g.fillRect(0,i*43,w,40);
    g.strokeStyle='#b3a17d';g.lineWidth=2;g.strokeRect(0,i*43,w,40);
   }
   g.strokeStyle='rgba(31,20,14,.35)';g.lineWidth=4;
   for(let i=0;i<=6;i++){g.beginPath();g.moveTo(i*w/6,0);g.lineTo(i*w/6,h);g.stroke();}
  }),N*1.7,N*1.7));
  const roofTex=own(canvasTexture(makeCanvas(320,320,(g,w,h)=>{
   g.fillStyle='#9a896a';g.fillRect(0,0,w,h);
   g.strokeStyle='#382723';g.lineWidth=13;
   for(let i=0;i<5;i++){const t=i*80;g.strokeRect(t,t,80,80);g.beginPath();g.moveTo(t,0);g.lineTo(t,h);g.stroke();g.beginPath();g.moveTo(0,t);g.lineTo(w,t);g.stroke();}
   g.fillStyle='rgba(244,224,176,.19)';g.fillRect(4,4,w-8,h-8);
  }),N*1.5,N*1.5));
  const matFloor=own(makeMaterial(0xf5f0de,{map:floorTex,side:THREE.DoubleSide}));
  const matCeil=own(makeMaterial(0xd7bf96,{map:roofTex,side:THREE.DoubleSide}));
  const matWall=own(makeMaterial(floor%5===0?0xbcb1a3:0xb9ad92,{side:THREE.DoubleSide}));
  const matWood=own(makeMaterial(floor%10===0?0x503640:0x5d3926,{roughness:.72}));
  const matPlaster=own(makeMaterial(0xece0cc,{roughness:.95}));
  this.woodMaterial=matWood;
  const matGold=own(makeMaterial(0xb88b4a,{metalness:.45,roughness:.4}));
  const matLamp=own(makeMaterial(0xffd38b,{emissive:0xffa63d,emissiveIntensity:2.4}));
  const whole=N*CELL;
  const plane=own(new THREE.PlaneGeometry(whole+1.5,whole+1.5));
  const floorMesh=new THREE.Mesh(plane,matFloor);floorMesh.rotation.x=-Math.PI/2;floorMesh.position.y=.025;group.add(floorMesh);
  const ceil=new THREE.Mesh(own(new THREE.PlaneGeometry(whole+1.5,whole+1.5)),matCeil);
  ceil.rotation.x=-Math.PI/2;ceil.position.y=15.6;group.add(ceil);
  const addInstanced=(geometry,material,rows)=>{
   if(!rows.length)return;
   const geo=own(geometry);const m=new THREE.InstancedMesh(geo,material,rows.length);
   const dummy=new THREE.Object3D();rows.forEach(([x,y,z,sx,sy,sz],i)=>{
    dummy.position.set(x,y,z);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);
   });m.instanceMatrix.needsUpdate=true;m.frustumCulled=false;group.add(m);return m;
  };
  const outerPanels=[],innerPanels=[],frame=[],beams=[],caps=[],lattice=[];
  const outerH=15.1,innerH=6.6,wallD=.55;
  const pushWall=(x,z,w,d,outer=false)=>{
   const wall={x,z,w,d};this.walls.push(wall);
   const h=outer?outerH:innerH;
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
  for(let r=0;r<=N;r+=2){const z=r*CELL-HALF;beams.push([0,15.2,z,whole,.55,.35]);}
  for(let c=0;c<=N;c+=2){const x=c*CELL-HALF;beams.push([x,15.2,0,.35,.55,whole]);}
  addInstanced(new THREE.BoxGeometry(1,1,1),matWood,beams);
  // Non-blocking doorway headers make the fully enclosed fortress visibly Japanese.
  for(let r=1;r<N-1;r++)for(let c=1;c<N-1;c++){
   const i=at(r,c),p=l.centerOf(i);
   if(!(l.tiles[i]&2))caps.push([p.x+CELL/2,13.7,p.z,.38,.5,CELL]);
   if(!(l.tiles[i]&4))caps.push([p.x,13.7,p.z+CELL/2,CELL,.5,.38]);
  }
  addInstanced(new THREE.BoxGeometry(1,1,1),matGold,caps);
  const lampBases=[];const flames=[];
  for(let r=1;r<N-1;r+=3)for(let c=1;c<N-1;c+=3){
   const p=l.centerOf(at(r,c));lampBases.push([p.x,12.8,p.z,1.25,.3,1.25]);flames.push([p.x,12.48,p.z,.35,.25,.35]);
  }
  addInstanced(new THREE.BoxGeometry(1,1,1),matGold,lampBases);
  addInstanced(new THREE.SphereGeometry(.5,low?8:12,low?6:10),matLamp,flames);
  const ambient=new THREE.AmbientLight(0xcfb289,.72);group.add(ambient);
  const light=new THREE.PointLight(0xffcd89,low?.8:1.25,27,2);light.position.set(0,11,0);group.add(light);
  const hallLight=new THREE.PointLight(0xffdfad,low?.55:.9,36,2);hallLight.position.set(0,12.2,0);group.add(hallLight);
  // Room visibility is scoped to infinite mode; restore every hidden arena on leave.
  if(!this.hidden.length){for(const obj of this.scene.children){
   if(obj===group||!obj.isGroup||obj.visible===false)continue;
   if(obj.children?.some(x=>x?.geometry?.type==='CircleGeometry'&&Number(x.geometry?.parameters?.radius)>=45)){
    this.hidden.push([obj,obj.visible]);obj.visible=false;
   }
  }}
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
  const steps=Math.min(56,Math.max(1,Math.ceil(Math.hypot(dx,dz)/(CELL*.25))));
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
 setStair(show){
  if(this.stair){this.stair.removeFromParent();this.stair=null;}
  if(!show)return null;
  const p=this.layout.centerOf(this.layout.exit);const g=new THREE.Group();g.name='RF568_Castle_Stairway';g.position.set(p.x,0,p.z);
  const wood=this.woodMaterial;
  const gold=new THREE.MeshStandardMaterial({color:0xc9a56c,metalness:.4,roughness:.45});this.owned.push(gold);
  const steps=[];for(let i=0;i<7;i++){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(3.7,.4+i*.45,.48),wood||gold);
   mesh.position.set(0,.2+i*.23,-1.2+i*.48);g.add(mesh);this.owned.push(mesh.geometry);steps.push(mesh);
  }
  const light=new THREE.PointLight(0xffbd67,1.6,13,2);light.position.set(0,3,0);g.add(light);
  const banner=makeCanvas(256,128,(ctx,w,h)=>{
   ctx.fillStyle='rgba(24,13,18,.78)';ctx.fillRect(12,13,232,100);
   ctx.strokeStyle='#cda65f';ctx.lineWidth=5;ctx.strokeRect(14,15,228,96);
   ctx.font='bold 40px serif';ctx.textAlign='center';ctx.fillStyle='#fff1cb';ctx.fillText('上階への階段',128,78);
  });
  const tex=new THREE.CanvasTexture(banner);this.owned.push(tex);
  const mat=new THREE.SpriteMaterial({map:tex,depthWrite:false,transparent:true});this.owned.push(mat);
  const sprite=new THREE.Sprite(mat);sprite.position.set(0,4.6,0);sprite.scale.set(5.8,2.9,1);g.add(sprite);
  this.group.add(g);this.stair=g;return p;
 }
 updateMap(player,enemies=[],force=false){
  if(!this.map?.ctx)return;
  const t=performance.now();if(!force&&t-this.map.last<220)return;this.map.last=t;
  const ctx=this.map.ctx,l=this.layout,C=l.N,S=208/C;
  ctx.clearRect(0,0,208,208);ctx.fillStyle='#10182a';ctx.fillRect(0,0,208,208);
  if(player)this.visited[l.cellOf(player)]=1;
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
  if(this.stair){const i=l.exit;ctx.fillStyle='#ffe390';ctx.beginPath();ctx.arc(((i%C)+.5)*S,(Math.floor(i/C)+.5)*S,4.1,0,Math.PI*2);ctx.fill();}
  if(player){const px=(player.x+HALF)/CELL*S,pz=(player.z+HALF)/CELL*S;ctx.fillStyle='#7cdbff';ctx.beginPath();ctx.arc(px,pz,4.2,0,Math.PI*2);ctx.fill();}
 }
 startPoint(){return this.layout.centerOf(this.layout.start);}
 exitPoint(){return this.layout.centerOf(this.layout.exit);}
 clearLevel(){
  if(this.stair){this.stair.removeFromParent();this.stair=null;}
  if(this.group)this.group.removeFromParent();this.group=null;
  for(const item of this.owned)try{item.dispose?.()}catch{}
  this.owned=[];this.walls=[];this.buckets=[];
 }
 destroy(){this.clearLevel();for(const [obj,vis] of this.hidden)if(obj?.parent)obj.visible=vis;this.hidden=[];
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
  const center=this.camCenter;center.lerp(me.pos,1-Math.exp(-5*Math.min(.2,Math.max(0,dt))));
  const p=this.camera.position;
  const maze=this.rf568Maze;
  const probe=(dx,dz)=>maze.collision(center.x+dx,center.z+dz,.25);
  const wallCount=[probe(0,3),probe(3,0),probe(0,-3),probe(-3,0),probe(2.4,2.4),probe(-2.4,2.4),probe(2.4,-2.4),probe(-2.4,-2.4)].filter(Boolean).length;
  const nearby=this.fighters.filter(f=>f.team===1&&!f.dead&&Math.hypot(f.pos.x-center.x,f.pos.z-center.z)<6.5).length;
  const vel=(me.vel&&Number.isFinite(me.vel.x)&&Number.isFinite(me.vel.z))?me.vel:new THREE.Vector3(0,0,0);
  const move=Math.hypot(vel.x||0,vel.z||0);
  if(!this._rf568Facing)this._rf568Facing=new THREE.Vector3(0,0,1);
  if(move>.08){
   const wantFacing=new THREE.Vector3(vel.x||0,0,vel.z||0).normalize();
   this._rf568Facing.lerp(wantFacing,1-Math.exp(-6*Math.max(0,dt)));
  }
  let height=11.8,backward=this.camera.aspect<1?8.8:12.2,lookY=1.4,side=0;
  if(wallCount>=5){ height=15.6; backward=this.camera.aspect<1?5.8:7.2; lookY=1.1; }
  else if(nearby>=2){ height=10.1; backward=this.camera.aspect<1?7.6:10.6; side=1.7; lookY=1.5; }
  else if(move>.2){ height=12.8; backward=this.camera.aspect<1?7.6:10.9; lookY=1.3; }
  const face=this._rf568Facing;
  const sx=side*face.z, sz=-side*face.x;
  const tx=center.x-face.x*backward+sx, tz=center.z-face.z*backward+sz;
  const target=this._rf568Camera||(this._rf568Camera=new THREE.Vector3());
  target.set(tx,height,tz);
  p.lerp(target,1-Math.exp(-4.6*Math.max(0,dt)));
  this.camera.lookAt(center.x,lookY,center.z);
 };
}
