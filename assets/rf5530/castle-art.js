// Original timber, plaster and painted screen surfaces for the Infinite Castle.
const palette = {
  cedar: { fog: 0x30262a, floor: 0xe2c3a5, wood: 0x49312c, lacquer: 0x56302d, panel: 0xdbc7ac, gold: 0xa1885d },
  dusk: { fog: 0x272834, floor: 0xc8b7af, wood: 0x382e35, lacquer: 0x44303a, panel: 0xcec3bd, gold: 0xa78c65 },
  gold: { fog: 0x36282b, floor: 0xe5b28d, wood: 0x442d2c, lacquer: 0x672d2a, panel: 0xf2d29f, gold: 0xcaa66a }
};

export function castlePalette(floor) {
  return floor % 10 === 0 ? palette.gold : floor % 10 >= 6 ? palette.dusk : palette.cedar;
}

function paintTexture(THREE, width, height, paint, repeat = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) paint(ctx, width, height);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  if (repeat !== 1) {
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeat, repeat);
  }
  map.anisotropy = 2;
  return map;
}

export function castleTextures(THREE, cells) {
  let seed = 0x553041;
  const random = () => {
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
    return seed / 4294967296;
  };
  const grain = (g, w, h, count) => {
    for (let i = 0; i < count; i++) {
      const x = random()*w, y = random()*h, length = 12+random()*w*.41;
      g.strokeStyle = i%4 ? '#2f1e2128' : '#fff0cc29';
      g.lineWidth = .42+random();
      g.beginPath();
      g.moveTo(x,y);
      g.bezierCurveTo(x+length*.3,y-2,x+length*.7,y+2,x+length,y);
      g.stroke();
    }
  };
  const floor = paintTexture(THREE, 512, 512, (g,w,h) => {
    const shades = ['#896047','#a07757','#79513e','#966d51','#825840','#a37a5c','#8c634e','#967058'];
    for (let i = 0; i < 8; i++) {
      const y = i*64, gradient = g.createLinearGradient(0,y,0,y+64);
      gradient.addColorStop(0,'#3d2928');
      gradient.addColorStop(.045,shades[i]);
      gradient.addColorStop(.86,shades[i]);
      gradient.addColorStop(1,'#5c4236');
      g.fillStyle=gradient;
      g.fillRect(0,y,w,64);
      const joint=(i*139+53)%w;
      g.fillStyle='#44302f';
      g.fillRect(joint,y,1.8,63);
      g.fillStyle='#4f352f';
      g.fillRect(joint+6,y+7,2,2);
      g.fillRect(joint+6,y+54,2,2);
    }
    grain(g,w,h,830);
  }, cells*1.9);
  const timber = paintTexture(THREE, 256, 256, (g,w,h) => {
    const grad = g.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#846056');
    grad.addColorStop(.24,'#b38a73');
    grad.addColorStop(.69,'#927068');
    grad.addColorStop(1,'#71544c');
    g.fillStyle=grad;
    g.fillRect(0,0,w,h);
    grain(g,w,h,520);
  });
  const paper = paintTexture(THREE, 256, 256, (g,w,h) => {
    const grad = g.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#f0dec1');
    grad.addColorStop(.6,'#ead7b8');
    grad.addColorStop(1,'#c49e74');
    g.fillStyle=grad;
    g.fillRect(0,0,w,h);
    for(let i=0;i<2300;i++){
      g.fillStyle=i%2?'#fbf0ce44':'#75594726';
      g.fillRect(random()*w,random()*h,1+random()*2,1);
    }
    g.fillStyle='#4c3832';
    for(let i=0;i<=8;i++)g.fillRect(i*32-1.5,0,3,h);
    for(let i=0;i<=5;i++)g.fillRect(0,i*h/5-1.7,w,3.4);
    g.fillStyle='#352622';
    g.fillRect(0,h-23,w,23);
  });
  const tatami = paintTexture(THREE, 128, 128, (g,w,h) => {
    g.fillStyle='#a99970';
    g.fillRect(0,0,w,h);
    for(let y=3;y<h;y+=2){
      g.strokeStyle=y%4===1?'#bfaf87':'#8f805c';
      g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();
    }
    g.fillStyle='#665941';g.fillRect(0,0,5,h);g.fillRect(w-5,0,5,h);
    grain(g,w,h,160);
  });
  const screen = paintTexture(THREE, 512, 256, (g,w,h) => {
    const gold = g.createLinearGradient(0,0,w,h);
    gold.addColorStop(0,'#83705b');
    gold.addColorStop(.42,'#dfc489');
    gold.addColorStop(.79,'#b08b61');
    gold.addColorStop(1,'#746152');
    g.fillStyle=gold;g.fillRect(0,0,w,h);
    for(let i=0;i<680;i++){
      g.fillStyle=i%3?'#f6e6ab30':'#5b463338';
      g.fillRect(random()*w,random()*h,2+random()*4,1+random()*2);
    }
    g.fillStyle='#5c55505d';
    g.beginPath();g.moveTo(0,195);g.bezierCurveTo(80,82,144,185,225,122);g.bezierCurveTo(287,95,349,161,512,96);
    g.lineTo(512,256);g.lineTo(0,256);g.closePath();g.fill();
    g.strokeStyle='#453933';g.lineCap='round';
    for(const [x,y,dx,dy] of [[98,258,110,96],[413,258,424,121]]){
      g.lineWidth=12;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x-31,y-73,dx,dy);g.stroke();
      for(let i=0;i<9;i++){
        const v=dy+i*11, side=i%2?1:-1;
        g.lineWidth=4;g.beginPath();g.moveTo(dx-4,v+16);g.quadraticCurveTo(dx+side*24,v,dx+side*(31+i*4),v+4);g.stroke();
        g.fillStyle=i%2?'#55554c':'#434a44';
        g.beginPath();g.ellipse(dx+side*(35+i*4),v+3,18+i*1.2,6,side*.12,0,Math.PI*2);g.fill();
      }
    }
    g.fillStyle='#594637';
    for(let x=0;x<=w;x+=128)g.fillRect(x-1.5,0,3,h);
    g.fillRect(0,0,w,5);g.fillRect(0,h-5,w,5);
  });
  const flame = paintTexture(THREE, 96, 128, (g,w,h) => {
    const glow=g.createRadialGradient(w/2,h*.58,1,w/2,h*.58,w*.48);
    glow.addColorStop(0,'#fff6bddb');glow.addColorStop(.35,'#ffb85b75');glow.addColorStop(1,'#f25d2900');
    g.fillStyle=glow;g.fillRect(0,0,w,h);
    const fire=g.createLinearGradient(0,23,0,110);
    fire.addColorStop(0,'#ff7c3c17');fire.addColorStop(.45,'#ff9b53da');fire.addColorStop(.79,'#ffdf8df9');fire.addColorStop(1,'#f77932b7');
    g.fillStyle=fire;g.beginPath();g.moveTo(48,24);g.bezierCurveTo(38,55,26,70,34,91);
    g.bezierCurveTo(43,112,65,99,65,81);g.bezierCurveTo(64,64,50,58,48,24);g.fill();
  });
  return { floor, timber, paper, tatami, screen, flame };
}

export function castleInstances(THREE, group, own, name, geometry, material, rows) {
  if (!rows.length) return;
  const mesh = own(new THREE.InstancedMesh(geometry,material,rows.length));
  const dummy = new THREE.Object3D();
  for (const [i,[x,y,z,sx,sy,sz,yaw=0,pitch=0]] of rows.entries()) {
    dummy.position.set(x,y,z);
    dummy.scale.set(sx,sy,sz);
    dummy.rotation.set(pitch,yaw,0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate=true;
  mesh.name=name;
  group.add(mesh);
  return mesh;
}

export function buildCastleArchitecture(THREE, group, own, layout, textures, walls, ceiling, low) {
  const { N, CELL, HALF, floor } = layout;
  const c = castlePalette(floor);
  const mat = (color, opts={}) => own(new THREE.MeshStandardMaterial({color,roughness:.81,metalness:.015,...opts}));
  const wood = mat(c.wood,{map:textures.timber});
  const lacquer = mat(c.lacquer,{roughness:.63});
  const gold = mat(c.gold,{roughness:.53,metalness:.27});
  const paper = mat(c.panel,{map:textures.paper,emissive:0x695244,emissiveIntensity:.21});
  const wall = mat(0x9a8272,{roughness:.96});
  const tatami = mat(0xb0a37a,{map:textures.tatami});
  const screen = mat(0xf2d7ac,{map:textures.screen,emissive:0x5e4634,emissiveIntensity:.25,side:THREE.DoubleSide});
  const lamp = own(new THREE.MeshBasicMaterial({map:textures.flame,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,blending:THREE.AdditiveBlending}));
  const whole=N*CELL;
  const surface=own(new THREE.PlaneGeometry(whole+1.5,whole+1.5));
  const deck=new THREE.Mesh(surface,mat(c.floor,{map:textures.floor,roughness:.90}));
  deck.name='Cedar-plank deck';deck.rotation.x=-Math.PI/2;deck.position.y=.025;group.add(deck);
  const roof=new THREE.Mesh(surface,mat(0x403331,{side:THREE.BackSide,map:textures.timber}));
  roof.name='Dark ceiling';roof.rotation.x=-Math.PI/2;roof.position.y=ceiling;group.add(roof);
  const box=own(new THREE.BoxGeometry(1,1,1));
  const quad=own(new THREE.PlaneGeometry(1,1));
  const boxes=(name,material,rows)=>castleInstances(THREE,group,own,name,box,material,rows);
  const planes=(name,material,rows)=>castleInstances(THREE,group,own,name,quad,material,rows);
  const outside=[],dividers=[],timbers=[],columns=[],lintels=[],sockets=[],lamps=[],mats=[],screens=[],trims=[];
  const innerH=4.2, wallD=.55;
  const pushWall=(x,z,w,d,outer)=>{
    const h=outer?ceiling:innerH;
    walls.push({x,z,w,d,h});
    (outer?outside:dividers).push([x,h/2,z,w,h,d]);
    timbers.push([x,.56,z,w,.42,d+.08],[x,h-.26,z,w,.34,d+.08]);
    if(w>d){
      columns.push([x-w/2,h/2,z,.38,h,d+.11],[x+w/2,h/2,z,.38,h,d+.11]);
    }else{
      columns.push([x,h/2,z-d/2,w+.11,h,.38],[x,h/2,z+d/2,w+.11,h,.38]);
    }
  };
  for(let r=0;r<N;r++)for(let col=0;col<N;col++){
    const i=r*N+col, mask=layout.tiles[i], p=layout.centerOf(i);
    if(mask&2)pushWall(p.x+CELL/2,p.z,wallD,CELL+.04,col===N-1);
    if(mask&4)pushWall(p.x,p.z+CELL/2,CELL+.04,wallD,r===N-1);
    if(col===0&&(mask&8))pushWall(p.x-CELL/2,p.z,wallD,CELL+.04,true);
    if(r===0&&(mask&1))pushWall(p.x,p.z-CELL/2,CELL+.04,wallD,true);
    if(layout.roomAt(i)==='本丸')mats.push([p.x,.040,p.z,CELL-.13,.019,CELL-.13]);
  }
  for(let i=0;i<=N;i++){
    const coord=i*CELL-HALF;
    lintels.push([0,ceiling-.43,coord,whole,.51,.52],[coord,ceiling-.79,0,.53,.44,whole]);
  }
  const torch=(x,z,yaw)=>{
    sockets.push([x,2.23,z,.17,.61,.17],[x,2.56,z,.30,.13,.30]);
    lamps.push([x,2.94,z,.80,1.14,1,yaw]);
    if(!low)lamps.push([x,2.94,z,.80,1.14,1,yaw+Math.PI/2]);
  };
  function doorway(x,z,yaw,width){
    const dx=Math.cos(yaw)*width*.5,dz=-Math.sin(yaw)*width*.5;
    columns.push([x-dx,2.46,z-dz,.42,4.92,.42],[x+dx,2.46,z+dz,.42,4.92,.42]);
    lintels.push([x,4.78,z,width+.75,.47,.53,yaw]);
    trims.push([x,4.50,z,width+.36,.095,.49,yaw]);
    torch(x-dx,z-dz,yaw);torch(x+dx,z+dz,yaw);
  }
  const axis=Math.floor(N/2);
  for(const i of [1,3,5,7,9,11]){
    const v=layout.centerOf(i*N+axis), h=layout.centerOf(axis*N+i);
    doorway(v.x,v.z+CELL/2,0,CELL*.92);
    doorway(h.x+CELL/2,h.z,Math.PI/2,CELL*.92);
  }
  for(const col of [4,6,8]){
    const p=layout.centerOf(col);
    screens.push([p.x,2.52,-HALF+.31,6.2,4.65,1,0]);
    trims.push([p.x,.29,-HALF+.34,6.25,.15,.15]);
    torch(p.x-3.17,-HALF+.70,0);
  }
  // Low, cool ambient haze contrasts with the lacquer and warm sconce glow.
  group.add(new THREE.HemisphereLight(0xd8d5d4,0x6e555c,1.24));
  const lights=[[0,0,116],[-CELL*2.7,-CELL*2.8,110],[CELL*3,CELL*3,83]];
  for(const [x,z,power] of low?lights.slice(0,2):lights){
    const light=new THREE.PointLight(0xffbd7e,power,34,2);
    light.position.set(x,5.6,z);
    group.add(light);
  }
  boxes('Closed outer plaster walls',wall,outside);
  boxes('Shoji wall panels',paper,dividers);
  boxes('Timber rails',wood,timbers);
  boxes('Lacquer columns',lacquer,columns);
  boxes('Lintels and exposed ceiling beams',wood,lintels);
  boxes('Gilt fittings',gold,trims);
  boxes('Honmaru tatami inlay',tatami,mats);
  boxes('Iron torch brackets',wood,sockets);
  planes('Painted pine screens',screen,screens);
  planes('Sconce flames',lamp,lamps);
  return {wood,gold,lacquer,lamp};
}
