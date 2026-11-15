// Crafted scenery and atmosphere for the original world. The controller owns
// only presentation resources; collision, camera and world geometry stay intact.
const THEMES = Object.freeze({
  moon: { name:'月影の御苑', kind:'garden', stone:0x71828a, wood:0x422d2a, roof:0x344856, metal:0xb59a68, glow:0xffc884, haze:0x9ac4d7, mote:0xffdfa4, roughness:.78 },
  bamboo: { name:'灯籠の竹庭', kind:'garden', stone:0x65756c, wood:0x47372e, roof:0x3d5249, metal:0x9a9668, glow:0xffd892, haze:0x92baab, mote:0xc4ed9d, roughness:.83 },
  frost: { name:'氷晶の聖域', kind:'crystal', stone:0x9daeb9, wood:0x527183, roof:0x607e98, metal:0xaedbe2, glow:0xa7e6ff, haze:0xb5d2e9, mote:0xe2f7ff, roughness:.64 },
  desert: { name:'砂金の回廊', kind:'ruins', stone:0xb29a78, wood:0x725240, roof:0x8e7054, metal:0xc1a777, glow:0xffd5a0, haze:0xc8b59b, mote:0xffe0b3, roughness:.92 },
  heaven: { name:'白金の光廊', kind:'ruins', stone:0xc9c6b4, wood:0x918b72, roof:0x879caa, metal:0xc5ab6a, glow:0xffe8bb, haze:0xd5dbd6, mote:0xffefbd, roughness:.75 },
  ember: { name:'燠の結晶祭壇', kind:'crystal', stone:0x554b4b, wood:0x5e3432, roof:0x4c3f49, metal:0xac7959, glow:0xff9c64, haze:0x996e73, mote:0xffb27a, roughness:.88 },
  void: { name:'紫月の祭壇', kind:'ruins', stone:0x6b687e, wood:0x494054, roof:0x585470, metal:0xaaa0c5, glow:0xc8b8ff, haze:0x9996bd, mote:0xc7c2ff, roughness:.8 }
});

export function celestialTheme(stage = {}) {
  if (THEMES[stage.id]) return stage.id;
  if (/bamboo/.test(stage.sky || '') || stage.pshape === 'bamboo') return 'bamboo';
  if (/frost/.test(stage.sky || '')) return 'frost';
  if (/heaven/.test(stage.sky || '')) return 'heaven';
  if (stage.rim === 0xff5a2a || stage.pshape === 'spire') return 'ember';
  if (/desert/.test(stage.sky || '')) return 'desert';
  return stage.cshape === 'torus' ? 'void' : 'moon';
}

export function celestialBudget(quality, isTouch = false) {
  const tier = ['low', 'standard', 'high', 'ultra'].includes(quality) ? quality : 'standard';
  return tier === 'low' ? { tier, segments:24, lamps:4, particles:0, mist:0, detailed:false }
    : (tier === 'high' || tier === 'ultra') && !isTouch ? { tier, segments:tier==='ultra'?80:64, lamps:8, particles:128, mist:5, detailed:true }
      : { tier, segments:40, lamps:6, particles:56, mist:3, detailed:false };
}

const finite = (number, fallback = 0) => Number.isFinite(number) ? number : fallback;
function randomSequence(seed = 5217) {
  let value = seed >>> 0;
  return () => ((value = (Math.imul(value,1664525) + 1013904223) >>> 0) / 4294967296);
}

// Scalar surface and volume data, deliberately linear rather than color images.
function dataMap(THREE, kind, size = 64) {
  const bytes = new Uint8Array(size * size * 4), random = randomSequence(1717);
  for (let y=0; y<size; y++) for (let x=0; x<size; x++) {
    const i=(y*size+x)*4, u=x/(size-1), v=y/(size-1);
    const radius=Math.hypot((u-.5)*2,(v-.5)*2);
    const density=Math.max(0,1-radius);
    const grain=.5+.22*Math.sin(u*Math.PI*8)*Math.cos(v*Math.PI*6)+.12*Math.sin((u+v)*Math.PI*20);
    const value=kind==='roughness' ? 182+Math.floor(random()*42+grain*22) : 255;
    bytes[i]=bytes[i+1]=bytes[i+2]=value;
    bytes[i+3]=kind==='roughness' ? 255 : Math.round(255*Math.pow(density,kind==='mist'?1.8:3)*(kind==='mist'?grain:1));
  }
  const map=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat);
  map.colorSpace=THREE.NoColorSpace;
  map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearFilter;
  map.wrapS=map.wrapT=kind==='roughness'?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
  map.needsUpdate=true;
  return map;
}

// Curved, overhanging hip roof with a real underside and continuous UVs.
function pavilionRoof(THREE, width, depth, rise, segments) {
  const positions=[],uvs=[],indices=[];
  for(let side=0;side<4;side++) {
    const start=positions.length/3;
    for(let row=0;row<=5;row++) for(let col=0;col<=segments;col++) {
      const t=row/5,s=col/segments*2-1,k=.12+.88*t;
      let x,z;
      if(side===0){x=s*width*.5*k;z=depth*.5*k;}
      else if(side===1){x=width*.5*k;z=-s*depth*.5*k;}
      else if(side===2){x=-s*width*.5*k;z=-depth*.5*k;}
      else {x=-width*.5*k;z=s*depth*.5*k;}
      positions.push(x,rise*(1-t)+Math.pow(t,5)*.38,z);
      uvs.push(col/segments,t);
      if(row<5&&col<segments){const a=start+row*(segments+1)+col,b=a+segments+1;indices.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);
  geometry.computeVertexNormals();return geometry;
}

export function createCelestialStage(THREE, {
  scene, arena, floor, lights = {}, getQuality = () => 'standard', isTouch = false,
  loader = new THREE.TextureLoader(), radius = 13
} = {}) {
  if (!scene || !arena) throw new TypeError('Celestial stage requires the original scene and arena');
  const R=Math.max(4,finite(radius,13));
  const root=new THREE.Group();root.name='Celestial stage · owned presentation';root.visible=false;scene.add(root);
  const scenery=new THREE.Group(),air=new THREE.Group();root.add(scenery,air);
  const resources=new Set(),textures=new Map(),releasedTextures=new WeakSet(),sectors=[],mist=[];
  const roughness=dataMap(THREE,'roughness'),moteMap=dataMap(THREE,'mote',32),mistMap=dataMap(THREE,'mist');
  const originalFloor=floor?.material ? { material:floor.material, roughness:floor.material.roughness, map:floor.material.roughnessMap } : null;
  let stage=null,theme='moon',budget=celestialBudget(getQuality(),isTouch),stamp='',disposed=false,time=0,points=null,particleData=null,particleBase=null,worldRoot=null,worldMaterials=[];
  let lastStats={ context:'inactive', sceneryVisible:false, particleCount:0 },sceneryTriangles=0,sceneryDrawCalls=0;
  const own=value=>(resources.add(value),value);

  function texture(path) {
    if(textures.has(path))return textures.get(path);
    const map=loader.load(path, loaded => {if(disposed&&!releasedTextures.has(loaded)){releasedTextures.add(loaded);loaded.dispose();}},undefined,()=>{});
    map.colorSpace=path.includes('normal')?THREE.NoColorSpace:THREE.SRGBColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=isTouch?2:4;
    textures.set(path,map);return map;
  }
  function material(color,extra={}) {
    return own(new THREE.MeshStandardMaterial({color,roughness:.8,metalness:0,...extra}));
  }
  function mesh(parent,geometry,mat,x=0,y=0,z=0,rotation=0) {
    own(geometry);const object=new THREE.Mesh(geometry,mat);object.position.set(x,y,z);object.rotation.y=rotation;parent.add(object);return object;
  }
  function instances(parent,name,geometry,mat,placements) {
    own(geometry);const object=new THREE.InstancedMesh(geometry,mat,placements.length);object.name=name;
    const transform=new THREE.Object3D();
    placements.forEach((p,i)=>{transform.position.set(p[0],p[1],p[2]);transform.rotation.set(p[6]||0,p[7]||0,p[8]||0);transform.scale.set(p[3]??1,p[4]??1,p[5]??1);transform.updateMatrix();object.setMatrixAt(i,transform.matrix);});
    object.instanceMatrix.needsUpdate=true;object.computeBoundingSphere();parent.add(object);own(object);return object;
  }
  function sector(x,z) {
    const group=new THREE.Group();group.position.set(x,0,z);group.userData.celestialScenery=true;scenery.add(group);sectors.push(group);return group;
  }
  function clearScenery() {
    scenery.clear();air.clear();sectors.length=mist.length=0;
    for(const resource of resources)resource.dispose();resources.clear();points=null;particleData=null;particleBase=null;
  }
  function makeLanterns(colors,stone,metal,wood,glow) {
    const posts=[],foot=[],caps=[],windows=[],bars=[];
    for(let i=0;i<budget.lamps;i++) {
      const angle=(i+.5)/budget.lamps*Math.PI*2;
      const x=Math.sin(angle)*(R+1.55),z=Math.cos(angle)*(R+1.55);
      foot.push([x,.1,z,1.15,.2,1.15]);posts.push([x,.68,z,.2,1.15,.2]);caps.push([x,1.38,z,.66,.17,.66],[x,2.1,z,.85,.2,.85]);windows.push([x,1.72,z,.52,.62,.52]);
      for(const dx of [-.29,.29])for(const dz of [-.29,.29])bars.push([x+dx,1.73,z+dz,.045,.7,.045]);
    }
    instances(scenery,'Carved stone lantern plinths',new THREE.CylinderGeometry(.5,.58,1,8),stone,foot);
    instances(scenery,'Lantern timber stems',new THREE.CylinderGeometry(.5,.5,1,12),wood,posts);
    instances(scenery,'Lantern copper cornices',new THREE.CylinderGeometry(.5,.65,1,8),metal,caps);
    instances(scenery,'Luminous paper lantern chambers',new THREE.BoxGeometry(1,1,1),glow,windows);
    instances(scenery,'Fine lantern ribs',new THREE.BoxGeometry(1,1,1),wood,bars);
  }
  function buildGarden(colors,stone,metal,wood,roof,glow) {
    const rear=sector(0,-R-5.1),beams=[],posts=[];
    for(const x of [-4.6,4.6]) {
      posts.push([x,2.45,0,.34,4.9,.34]);
      mesh(rear,new THREE.CylinderGeometry(.53,.65,.3,16),stone,x,.15,0);
      for(const y of [1,3.6,4.4])mesh(rear,new THREE.CylinderGeometry(.4,.4,.08,16),metal,x,y,0);
    }
    beams.push([0,3.55,0,10.3,.26,.35],[0,4.6,0,10.8,.35,.58]);
    instances(rear,'Timber shrine gate supports',new THREE.CylinderGeometry(.5,.58,1,20),wood,posts);
    instances(rear,'Mortise gate cross beams',new THREE.BoxGeometry(1,1,1),wood,beams);
    mesh(rear,pavilionRoof(THREE,12.3,3.1,1.05,budget.detailed?18:10),roof,0,4.72,0);
    mesh(rear,new THREE.BoxGeometry(11.8,.12,.14),metal,0,5.85,0);
    // A carved plaque is anchored to the beam; gold ribs catch the same moonlight.
    mesh(rear,new THREE.BoxGeometry(.9,1.15,.16),wood,0,4,0.3);
    mesh(rear,new THREE.TorusGeometry(.26,.025,6,32),metal,0,4,.395).rotation.x=0;
    for(const side of [-1,1]) {
      const pavilion=sector(side*(R+4.2),-6.5), pillars=[];
      mesh(pavilion,new THREE.BoxGeometry(4.3,.3,4.4),stone,0,.08,0);
      mesh(pavilion,new THREE.BoxGeometry(3.8,.19,3.9),wood,0,.32,0);
      for(const x of [-1.55,1.55])for(const z of [-1.55,1.55])pillars.push([x,1.9,z,.18,3.2,.18]);
      instances(pavilion,'Veranda turned posts',new THREE.CylinderGeometry(.5,.58,1,16),wood,pillars);
      mesh(pavilion,pavilionRoof(THREE,5.1,5.2,1.4,budget.detailed?16:8),roof,0,3.52,0);
      mesh(pavilion,new THREE.SphereGeometry(.21,16,12),metal,0,5.05,0);
      mesh(pavilion,new THREE.CylinderGeometry(.36,.36,.8,16),glow,0,2.85,0);
      if(budget.detailed){
        const balusters=[];
        for(let i=-4;i<=4;i++)balusters.push([i*.36,.85,-1.62,.055,.9,.055]);
        instances(pavilion,'Veranda balustrade joinery',new THREE.BoxGeometry(1,1,1),wood,balusters);
        mesh(pavilion,new THREE.BoxGeometry(3.6,.09,.1),metal,0,1.3,-1.62);
      }
    }
    const reeds=[],nodes=[],random=randomSequence(814);
    for(const side of [-1,1])for(let i=0;i<(budget.detailed?24:12);i++) {
      const x=side*(R+2.4+random()*2),z=-6-random()*7,h=2.8+random()*2.6;
      reeds.push([x,h*.5,z,.075,h,.075,0,0,(random()-.5)*.12]);
      for(let j=1;j<5;j++)nodes.push([x,h*j/5,z,.12,.055,.12]);
    }
    const bamboo=material(theme==='bamboo'?0x425b40:0x535b48,{roughness:.88});
    instances(scenery,'Layered bamboo grove',new THREE.CylinderGeometry(.8,1,1,8),bamboo,reeds);
    if(budget.detailed)instances(scenery,'Bamboo nodes',new THREE.CylinderGeometry(1,1,1,8),wood,nodes);
  }
  function buildRuins(colors,stone,metal,glow) {
    const rear=sector(0,-R-5.5),columns=[],capital=[];
    const profile=[new THREE.Vector2(.67,0),new THREE.Vector2(.72,.13),new THREE.Vector2(.58,.27),new THREE.Vector2(.42,.43),new THREE.Vector2(.36,3.7),new THREE.Vector2(.48,3.85),new THREE.Vector2(.65,3.98)];
    for(const x of [-8,-4,4,8]) {columns.push([x,.1,0,1,1+(Math.abs(x)===4?.3:0),1]);capital.push([x,.18,0,1.55,.36,1.55]);}
    instances(rear,'Turned ruin columns',new THREE.LatheGeometry(profile,budget.segments),stone,columns);
    instances(rear,'Carved column bases',new THREE.BoxGeometry(1,1,1),stone,capital);
    const blocks=[];
    for(let i=0;i<13;i++){const a=i/12*Math.PI;blocks.push([Math.cos(a)*4,4.95+Math.sin(a)*3.25,0,.8,.6,.8,0,0,a-Math.PI/2]);}
    instances(rear,'Vaulted stone arch with individual voussoirs',new THREE.BoxGeometry(1,1,1),stone,blocks);
    const arch=mesh(rear,new THREE.TorusGeometry(3.8,.045,8,budget.segments,Math.PI),metal,0,4.95,.46);
    arch.scale.y=.82;
    for(const x of [-8,8])mesh(rear,new THREE.SphereGeometry(.18,16,12),glow,x,4.25,0);
    // Scattered masonry remains below ankle height and outside the original field.
    const rubble=[],random=randomSequence(389);
    for(let i=0;i<(budget.detailed?28:12);i++){const a=random()*Math.PI*2,r=R+1.4+random()*3;rubble.push([Math.cos(a)*r,.08,Math.sin(a)*r,.3+random()*.6,.16,.3+random()*.6,0,random()*3,0]);}
    instances(scenery,'Weathered edge masonry',new THREE.BoxGeometry(1,1,1),stone,rubble);
  }
  function buildCrystals(colors,stone,metal) {
    const crystal=material(colors.glow,{roughness:.22,metalness:.2,emissive:colors.glow,emissiveIntensity:.16});
    const dark=material(colors.roof,{roughness:.66});
    const profile=[new THREE.Vector2(.18,0),new THREE.Vector2(.42,.18),new THREE.Vector2(.4,1.9),new THREE.Vector2(.05,2.7),new THREE.Vector2(0,2.8)];
    const placements=[],bases=[],random=randomSequence(885);
    for(let n=0;n<5;n++) {
      const angle=-Math.PI*.8+n*Math.PI*.4,x=Math.sin(angle)*(R+3),z=-Math.abs(Math.cos(angle))*(R+3);
      bases.push([x,.3,z,2.4,.55,2.3]);
      for(let j=0;j<5;j++)placements.push([x+(random()-.5)*1.5,.25,z+(random()-.5)*1.5,.65+random()*.8,.7+random()*1.5,.65+random()*.8,(random()-.5)*.3,random()*3,(random()-.5)*.3]);
    }
    instances(scenery,'Stone beds under crystal outcrops',new THREE.SphereGeometry(1,16,10),dark,bases);
    instances(scenery,'Quartz crystal gardens',new THREE.LatheGeometry(profile,8),crystal,placements);
    const rear=sector(0,-R-6);
    const altar=mesh(rear,new THREE.CylinderGeometry(2.9,3.3,.4,32),stone,0,.2,0);
    mesh(rear,new THREE.TorusGeometry(2.6,.07,8,64),metal,0,.42,0).rotation.x=Math.PI/2;
    mesh(rear,new THREE.LatheGeometry(profile,8),crystal,0,.4,0).scale.set(1.3,2.1,1.3);
    altar.userData.celestialScenery=true;
  }
  function buildAtmosphere(colors) {
    const count=128,random=randomSequence(192);
    particleData=new Float32Array(count*3);particleBase=new Float32Array(count*4);
    for(let i=0;i<count;i++){particleBase[i*4]=random()*Math.PI*2;particleBase[i*4+1]=3+random()*15;particleBase[i*4+2]=.5+random()*6;particleBase[i*4+3]=random()*Math.PI*2;}
    const geometry=own(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.BufferAttribute(particleData,3));
    geometry.setDrawRange(0,budget.particles);
    const mat=own(new THREE.PointsMaterial({color:colors.mote,map:moteMap,size:theme==='frost'?.13:.095,transparent:true,opacity:.65,depthWrite:false,blending:THREE.AdditiveBlending,fog:true}));
    points=new THREE.Points(geometry,mat);points.frustumCulled=false;points.name='Sparse fireflies and airborne dust';air.add(points);
    for(let i=0;i<budget.mist;i++) {
      const material=own(new THREE.SpriteMaterial({map:mistMap,color:colors.haze,opacity:.105,depthWrite:false,fog:true}));
      const sprite=new THREE.Sprite(material);sprite.name='Low drifting courtyard mist';
      sprite.position.set((i-2)*7,.85,-R-1-(i%2)*3);sprite.scale.set(15,3.3,1);sprite.userData.baseX=sprite.position.x;
      mist.push(sprite);scenery.add(sprite);
    }
  }
  function build() {
    clearScenery();
    const c=THEMES[theme],normal=budget.tier==='low'?null:texture('assets/rf556/terrain-normal.webp');
    const stone=material(c.stone,{map:texture('assets/tex-cobble.webp'),roughness:c.roughness,roughnessMap:roughness,normalMap:budget.tier==='low'?null:normal,normalScale:new THREE.Vector2(.12,.12)});
    const wood=material(c.wood,{map:texture('assets/tex-house-wall.webp'),roughness:.83});
    const roof=material(c.roof,{map:texture('assets/tex-roof.webp'),roughness:.64,metalness:.12,side:THREE.DoubleSide});
    const metal=material(c.metal,{metalness:.65,roughness:.38});
    const glow=material(c.glow,{emissive:c.glow,emissiveIntensity:.8,roughness:.56});
    // Continuous grounded terrace, below the existing playable floor. Every
    // upright prop is outside the radius: it cannot introduce a false obstacle.
    const outerRadius=R+10,terraceGeometry=new THREE.RingGeometry(R-.1,outerRadius,budget.segments);
    const positions=terraceGeometry.attributes.position,uv=terraceGeometry.attributes.uv;
    // Meter-scaled UVs keep individual paving stones readable across the wide
    // apron; every pavilion, lamp and grove has continuous ground beneath it.
    for(let i=0;i<positions.count;i++)uv.setXY(i,positions.getX(i)/5,positions.getY(i)/5);
    const terrace=mesh(scenery,terraceGeometry,stone,0,-.035,0);
    terrace.name='Continuous stone courtyard apron';
    terrace.rotation.x=-Math.PI/2;
    mesh(scenery,new THREE.CylinderGeometry(outerRadius,outerRadius+.25,.95,budget.segments,1,true),stone,0,-.52,0);
    const joints=[];
    for(let i=0;i<budget.segments;i++){const a=i/budget.segments*Math.PI*2;joints.push([Math.sin(a)*(outerRadius-.15),.01,Math.cos(a)*(outerRadius-.15),.85,.12,.32,0,a,0]);}
    instances(scenery,'Dressed stone terrace edging',new THREE.BoxGeometry(1,1,1),stone,joints);
    makeLanterns(c,stone,metal,wood,glow);
    if(c.kind==='garden')buildGarden(c,stone,metal,wood,roof,glow);
    else if(c.kind==='crystal')buildCrystals(c,stone,metal);
    else buildRuins(c,stone,metal,glow);
    buildAtmosphere(c);
    sceneryTriangles=0;sceneryDrawCalls=0;
    scenery.traverse(object=>{if(object.isMesh){sceneryDrawCalls++;sceneryTriangles+=((object.geometry.index?.count||object.geometry.attributes.position?.count||0)/3)*(object.isInstancedMesh?object.count:1);}});
    if(originalFloor){originalFloor.material.roughness=c.roughness;originalFloor.material.roughnessMap=budget.tier==='low'?originalFloor.map:roughness;originalFloor.material.needsUpdate=true;}
    stamp=theme+':'+budget.tier+':'+budget.detailed;
  }

  function restoreWorld() {
    for(const record of worldMaterials){if(record.object.material===record.copy)record.object.material=record.source;for(const mat of record.owned)mat.dispose();}
    worldMaterials=[];worldRoot=null;
  }
  function finishWorld(group) {
    if(group===worldRoot)return;
    restoreWorld();worldRoot=group;
    if(!group||budget.tier==='low')return;
    const visit=object=>{
      if(object.userData?.arkeiaModel||object.isSkinnedMesh)return;
      if(object.isMesh && (object.geometry?.type==='PlaneGeometry'||object.geometry?.type==='BoxGeometry') && worldMaterials.length<160){
        const source=object.material,list=Array.isArray(source)?source:[source],owned=[];
        const copies=list.map(mat=>{
          if(!mat?.isMeshStandardMaterial||!mat.map||mat.roughnessMap)return mat;
          const copy=mat.clone();copy.roughnessMap=roughness;copy.roughness=Math.max(.68,Math.min(.94,mat.roughness));owned.push(copy);return copy;
        });
        if(owned.length){const copy=Array.isArray(source)?copies:copies[0];object.material=copy;worldMaterials.push({object,source,copy,owned});}
      }
      for(const child of object.children||[])visit(child);
    };
    visit(group);
  }

  return {
    setStage(next) {
      if(disposed||!next)return;
      stage=next;theme=celestialTheme(next);budget=celestialBudget(getQuality(),isTouch);
      if(stamp!==theme+':'+budget.tier+':'+budget.detailed)build();
      // Warm key / cool rim is shared with the original fighters. Light objects
      // and positions stay owned by main and the castle's dimming controller.
      if(lights.moon?.color)lights.moon.color.lerp(new THREE.Color(0xffedda),.09);
      if(lights.edge?.color)lights.edge.color.lerp(new THREE.Color(THEMES[theme].haze),.22);
    },
    update(dt,{battle=null,field=null,active=false,paused=false,camera=null,reducedMotion=false}={}) {
      if(disposed||!stage)return;
      const next=celestialBudget(getQuality(),isTouch);
      if(next.tier!==budget.tier||next.detailed!==budget.detailed){budget=next;build();restoreWorld();}
      const maze=battle?.rf568Maze,sideView=battle?.storyII,interior=field?.__rf563Story?.mode;
      const context=maze?'castle':sideView?'sideview':field&&!battle?'field':'arena';
      const visible=Boolean(active || paused&&(battle||field)),showScenery=visible&&arena.visible&&context==='arena';
      root.visible=visible;scenery.visible=showScenery;
      const group=maze?.group || (context==='field'?field?.group:null);
      finishWorld(group);
      const anchor=context==='field'?field?.player?.pos:maze?battle?.fighters?.find(f=>f.isPlayer)?.pos:null;
      if(anchor&&Number.isFinite(anchor.x)&&Number.isFinite(anchor.z))air.position.set(anchor.x,0,anchor.z);
      else air.position.set(0,0,0);
      const count=visible&&!sideView?Math.min(budget.particles,maze||interior?24:context==='field'?64:128):0;
      points.geometry.setDrawRange(0,count);air.visible=count>0;
      if(!paused&&!reducedMotion)time+=Math.min(.05,Math.max(0,finite(dt)));
      const range=maze||interior ? .23 : context==='field' ? .72 : 1;
      for(let i=0;i<count;i++){
        const a=particleBase[i*4],r=particleBase[i*4+1]*range,p=particleBase[i*4+3];
        particleData[i*3]=Math.cos(a)*r+Math.sin(time*.19+p)*.3;
        const height=maze?2.6:6,drift=particleBase[i*4+2]+(theme==='frost'?-time*.14:time*.075);
        particleData[i*3+1]=.35+((drift%height)+height)%height;
        particleData[i*3+2]=Math.sin(a)*r+Math.cos(time*.16+p)*.25;
      }
      if(count)points.geometry.attributes.position.needsUpdate=true;
      for(let i=0;i<mist.length;i++){mist[i].position.x=mist[i].userData.baseX+Math.sin(time*.08+i)*1.1;mist[i].material.opacity=.075+Math.sin(time*.13+i)*.018;}
      // Hide the near-side tall architecture when orbiting behind it. The far
      // scenery retains real perspective/parallax without masking the fighters.
      if(camera&&showScenery)for(const group of sectors)group.visible=group.position.x*camera.position.x+group.position.z*camera.position.z<R*R*.24;
      lastStats={context,sceneryVisible:showScenery,particleCount:count};
    },
    stats() {return {...lastStats,theme,stageName:THEMES[theme].name,quality:budget.tier,sceneryTriangles:disposed?0:sceneryTriangles,sceneryDrawCalls:disposed?0:sceneryDrawCalls,ownedResources:resources.size,textureCount:disposed?0:textures.size+3,worldMaterials:worldMaterials.length,disposed};},
    dispose() {
      if(disposed)return;disposed=true;restoreWorld();clearScenery();root.removeFromParent();
      for(const map of textures.values()){releasedTextures.add(map);map.dispose();}textures.clear();roughness.dispose();moteMap.dispose();mistMap.dispose();
      if(originalFloor){originalFloor.material.roughness=originalFloor.roughness;originalFloor.material.roughnessMap=originalFloor.map;originalFloor.material.needsUpdate=true;}
      lastStats={context:'inactive',sceneryVisible:false,particleCount:0};
    }
  };
}
