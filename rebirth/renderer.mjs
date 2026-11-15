import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { MeshoptDecoder } from '../assets/vendor/meshopt_decoder.module.js';

const ROOT = new URL('../', import.meta.url);
const asset = path => new URL(String(path).replace(/^\.\//, ''), ROOT).href;
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const QUALITY = {
  low: { ratio: 1, shadows: false, particles: 60 },
  balanced: { ratio: 1.5, shadows: true, particles: 120 },
  high: { ratio: 2, shadows: true, particles: 180 },
};
const STAGES = {
  moon: { fog: 0x222939, ground: 0x777c88, sky: 'assets/rf5525/moonkeep-wide.webp', leaf: '#b25137', light: 0xffdbab, mist: 0x829cab },
  river: { fog: 0x193b40, ground: 0x687e71, sky: 'assets/rf5523/river-path.webp', leaf: '#54847a', light: 0xe8f2cd, mist: 0x74bcb0 },
  keep: { fog: 0x30252e, ground: 0xa67c66, sky: 'assets/rf562/japanese-palace.webp', leaf: '#b86743', light: 0xffd49c, mist: 0x907e8a },
  frost: { fog: 0x283d53, ground: 0xa7c4cf, sky: 'assets/frost-aurora-sky.webp', leaf: '#a7d5d7', light: 0xc9efff, mist: 0xa0c8e0 },
};

function paintedTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('描画用キャンバスを作成できませんでした。');
  paint(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function randomFrom(seed = 377) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
function glowTexture() {
  return paintedTexture(128, (ctx, n) => {
    const glow = ctx.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
    glow.addColorStop(0, '#fffde9'); glow.addColorStop(.13, '#fff6ccdd');
    glow.addColorStop(.4, '#ffc76555'); glow.addColorStop(1, '#ffb64500');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, n, n);
  });
}
function ringTexture() {
  return paintedTexture(512, (ctx, n) => {
    ctx.translate(n / 2, n / 2); ctx.strokeStyle = '#fff8dc';
    [210, 196, 155].forEach((r, i) => {ctx.lineWidth = i ? 2 : 4;ctx.beginPath();ctx.arc(0, 0, r, 0, TAU);ctx.stroke();});
    for(let i = 0; i < 24; i++) {
      ctx.save();ctx.rotate(TAU * i / 24);ctx.lineWidth = 2;
      ctx.beginPath();ctx.moveTo(166, -4);ctx.lineTo(187, 0);ctx.lineTo(166, 4);ctx.stroke();
      if(i % 3 === 0) {ctx.strokeRect(202, -5, 14, 10);}
      ctx.restore();
    }
    for(let i = 0; i < 6; i++) {
      ctx.save();ctx.rotate(TAU * i / 6);ctx.lineWidth = 2;
      ctx.beginPath();ctx.moveTo(0, 0);ctx.lineTo(133, -70);ctx.lineTo(133, 70);ctx.closePath();ctx.stroke();ctx.restore();
    }
    ctx.lineWidth = 5;ctx.beginPath();ctx.arc(0, 0, 21, 0, TAU);ctx.stroke();
  });
}
function slashTexture() {
  return paintedTexture(512, (ctx, n) => {
    ctx.translate(n/2,n/2);const gradient=ctx.createLinearGradient(-220,100,220,-100);
    gradient.addColorStop(0,'#ffffff00');gradient.addColorStop(.45,'#ffeacdbb');gradient.addColorStop(.75,'#fffffff5');gradient.addColorStop(1,'#fff9e21a');
    ctx.fillStyle=gradient;ctx.shadowBlur=16;ctx.shadowColor='#fff2cb';
    ctx.beginPath();ctx.moveTo(-232,115);ctx.bezierCurveTo(-175,-156,108,-214,235,-30);ctx.bezierCurveTo(95,-138,-120,-100,-232,115);ctx.fill();
    ctx.shadowBlur=0;ctx.strokeStyle='#fff9e5dd';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-208,83);ctx.bezierCurveTo(-135,-127,105,-176,218,-30);ctx.stroke();
    for(let i=0;i<12;i++){ctx.strokeStyle=`rgba(255,240,210,${.7-i*.035})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-166+i*28,-30-i%3*27);ctx.lineTo(-145+i*28,-49-i%3*27);ctx.stroke();}
  });
}
function treeTexture(leaf) {
  return paintedTexture(768, (ctx, n) => {
    const rnd = randomFrom(1273);
    ctx.lineCap = 'round';
    const branch = (x, y, length, angle, width, depth) => {
      const endX = x + Math.sin(angle) * length, endY = y - Math.cos(angle) * length;
      ctx.strokeStyle = depth > 2 ? '#4b3b3b' : '#554146';ctx.lineWidth = width;
      ctx.beginPath();ctx.moveTo(x, y);ctx.quadraticCurveTo(x - 10, y - length * .6, endX, endY);ctx.stroke();
      ctx.strokeStyle = '#9f877866';ctx.lineWidth = Math.max(1, width * .18);
      ctx.beginPath();ctx.moveTo(x + width * .22, y);ctx.lineTo(endX + 2, endY);ctx.stroke();
      if(depth > 0) {
        branch(endX, endY, length * .68, angle - .4 - rnd() * .22, width * .63, depth - 1);
        branch(endX, endY, length * .63, angle + .42 + rnd() * .22, width * .61, depth - 1);
      } else {
        for(let i = 0; i < 72; i++) {
          const lx = endX + (rnd() - .5) * 118, ly = endY + (rnd() - .5) * 60;
          ctx.globalAlpha = .3 + rnd() * .6;ctx.fillStyle = leaf;
          ctx.beginPath();ctx.ellipse(lx, ly, 3 + rnd() * 8, 2 + rnd() * 3, rnd() * TAU, 0, TAU);ctx.fill();
          if(i % 7 === 0){ctx.fillStyle = '#edc78c';ctx.fillRect(lx, ly, 3, 2);}
        }
        ctx.globalAlpha = 1;
      }
    };
    branch(n / 2, n - 10, 230, -.05, 38, 4);
  });
}
function lanternTexture() {
  return paintedTexture(256, (ctx, n) => {
    const grd = ctx.createRadialGradient(128, 110, 0, 128, 110, 113);
    grd.addColorStop(0,'#ffc06c88');grd.addColorStop(1,'#f9a33800');
    ctx.fillStyle=grd;ctx.fillRect(0,0,n,n);
    ctx.fillStyle='#49372f';ctx.fillRect(121, 112, 14, 140);
    ctx.fillStyle='#6e5442';ctx.fillRect(126, 111, 5, 140);
    ctx.fillStyle='#2b2527';ctx.beginPath();ctx.moveTo(83, 71);ctx.lineTo(128, 49);ctx.lineTo(173, 71);ctx.closePath();ctx.fill();
    ctx.fillStyle='#74513b';ctx.fillRect(91, 75, 74, 9);ctx.fillRect(91, 139, 74, 9);
    const light=ctx.createLinearGradient(102, 80, 152, 130);light.addColorStop(0,'#d58b46');light.addColorStop(.5,'#fff1a8');light.addColorStop(1,'#d88b42');
    ctx.fillStyle=light;ctx.fillRect(101, 84, 54, 55);
    ctx.fillStyle='#70412d';for(const x of [99,125,153])ctx.fillRect(x,83,3,57);
    ctx.fillRect(99,110,57,3);
  });
}
function woodTexture() {
  return paintedTexture(512, (ctx, n) => {
    const rnd = randomFrom(855);ctx.fillStyle='#6d493d';ctx.fillRect(0,0,n,n);
    for(let j = 0; j < 10; j++) {
      const y = j * n / 10;
      ctx.fillStyle=j % 3 ? '#785343' : '#8a604b';ctx.fillRect(0,y,n,49);
      ctx.fillStyle='#30262b';ctx.fillRect(0,y,n,2);
      for(let i=0;i<55;i++) {
        ctx.strokeStyle=i % 2 ? '#d0a38419' : '#22181f2b';ctx.lineWidth=.5 + rnd();
        ctx.beginPath();const x=rnd()*n;const yy=y+rnd()*50;ctx.moveTo(x,yy);ctx.bezierCurveTo(x+40,yy-2,x+70,yy+2,x+100,yy);ctx.stroke();
      }
    }
  });
}

export class WorldRenderer {
  constructor(canvas, { quality = 'balanced', reducedMotion = false } = {}) {
    this.canvas = canvas; this.reducedMotion = reducedMotion;this.quality = QUALITY[quality] ? quality : 'balanced';
    this.renderer = new THREE.WebGLRenderer({canvas, antialias:quality !== 'low', alpha:false, powerPreference:'high-performance'});
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.28;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(43,1,.1,180);
    this.camera.position.set(0,20,19);this.camera.lookAt(0,0,0);
    this.environment = new THREE.Group();this.characters = new THREE.Group();this.effects = new THREE.Group();
    this.scene.add(this.environment,this.characters,this.effects);
    this.actors = new Map();this.models = new Map();this.resources = new Set();this.textureLoader = new THREE.TextureLoader();
    this.textureCache = new Map();this.effectObjects = new Map();this.projectileObjects = new Map();
    this.focus = new THREE.Vector3();this.elapsed=0;this.disposed=false;this.preparation=0;this.prepared=false;
    this.glow = this.own(glowTexture());this.ring = this.own(ringTexture());this.slash = this.own(slashTexture());this.environmentOwned=new Set();
    this.draco = new DRACOLoader().setDecoderPath(asset('assets/vendor/draco/')).setWorkerLimit(2);
    this.loader = new GLTFLoader().setDRACOLoader(this.draco).setMeshoptDecoder(MeshoptDecoder);
    this.hemi = new THREE.HemisphereLight(0xc3d6ff,0x665143,2.1);this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe2c6,3.25);this.sun.position.set(-12,24,12);this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-24;this.sun.shadow.camera.right=24;
    this.sun.shadow.camera.top=24;this.sun.shadow.camera.bottom=-24;this.sun.shadow.camera.near=1;this.sun.shadow.camera.far=75;
    this.sun.shadow.bias=-.0006;this.sun.shadow.normalBias=.025;this.scene.add(this.sun,this.sun.target);
    const rim=new THREE.DirectionalLight(0x7bbfff,1.8);rim.position.set(8,9,-15);this.scene.add(rim);
    this.resizeObserver=typeof ResizeObserver==='function' ? new ResizeObserver(()=>this.resize()) : null;
    this.resizeObserver?.observe(canvas);this.setQuality(this.quality);this.resize();
    this.contextLost = event => {event.preventDefault();this.contextError='描画が中断されました。メニューに戻り、画質を「軽量」に変更してください。';};
    canvas.addEventListener('webglcontextlost',this.contextLost);
  }
  own(object) {this.resources.add(object);return object;}
  async texture(path) {
    if(!this.textureCache.has(path)) this.textureCache.set(path,this.textureLoader.loadAsync(asset(path)).then(texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,this.renderer.capabilities.getMaxAnisotropy());return this.own(texture);
    }));
    return this.textureCache.get(path);
  }
  async prepare(defs, stage = 'moon', onProgress = () => {}) {
    const generation=++this.preparation;this.prepared=false;
    const definitions=(Array.isArray(defs)?defs:Object.values(defs||{})).filter(Boolean);
    const paths=[...new Set(definitions.map(def=>def.model).filter(Boolean))];
    if(!paths.length)throw new Error('読み込む戦士のモデルがありません。');
    // Old encounters do not retain dozens of full skeleton/texture sets during a long run.
    this.clearActors();
    const required=new Set(paths);
    if(this.models.size>6) for(const [path,model] of this.models)if(!required.has(path)){this.disposeTemplate(model);this.models.delete(path);}
    onProgress(0,'世界を描画しています');
    await this.buildEnvironment(STAGES[stage]?stage:'moon');
    let complete=0;
    // Sequential model preparation bounds peak memory on mobile and makes progress meaningful.
    for(const path of paths) {
      if(this.disposed||generation!==this.preparation)return;
      if(!this.models.has(path)) {
        try {
          const gltf=await this.loader.loadAsync(asset(path));
          if(this.disposed||generation!==this.preparation){this.disposeTemplate(gltf);return;}
          if(!gltf.scene)throw new Error('モデルのシーンが空です');
          gltf.scene.updateMatrixWorld(true);
          const box=new THREE.Box3().setFromObject(gltf.scene,true);
          if(!Number.isFinite(box.max.y)||box.max.y-box.min.y<.001)throw new Error('モデルの形状を確認できません');
          const clips=gltf.animations.map(clip=>{
            const copy=clip.clone();
            // Locomotion stays controlled by the simulation, including while blending clips.
            for(const track of copy.tracks) if(/(?:Hips|Root|root)\.position$/.test(track.name)) {
              for(let j=0;j<track.values.length;j+=3){track.values[j]=track.values[0];track.values[j+2]=track.values[2];}
            }
            return copy;
          });
          this.models.set(path,{scene:gltf.scene,box,clips});
        } catch(error) {throw new Error(`戦士の読込に失敗しました（${String(path).split('/').pop()}）。通信を確認して再試行してください。`,{cause:error});}
      }
      onProgress(.15 + (++complete/paths.length)*.85,`戦士を準備しています ${complete} / ${paths.length}`);
    }
    if(this.disposed||generation!==this.preparation)return;
    this.clearActors();this.focus.set(0,0,0);this.cameraReady=false;this.prepared=true;
  }
  async buildEnvironment(stage) {
    if(this.stage===stage && this.environment.children.length) {
      this.clearEffects();return;
    }
    for(const resource of this.environmentOwned){resource.dispose?.();this.resources.delete(resource);}
    this.environmentOwned.clear();const priorResources=new Set(this.resources);
    this.stage=stage;this.stagePalette=STAGES[stage];const palette=this.stagePalette;
    for(const object of [...this.environment.children])this.environment.remove(object);
    this.clearEffects();
    this.scene.background=new THREE.Color(palette.fog);this.scene.fog=new THREE.FogExp2(palette.fog,.017);
    this.sun.color.setHex(palette.light);
    const [floorMap,skyMap]=await Promise.all([this.texture('assets/arena-floor.webp'),this.texture(palette.sky)]);
    if(this.disposed)return;
    const floorTexture=stage==='keep'?this.own(woodTexture()):floorMap.clone();
    if(stage!=='keep')this.own(floorTexture);
    floorTexture.wrapS=floorTexture.wrapT=THREE.RepeatWrapping;floorTexture.repeat.set(stage==='keep'?8:12,stage==='keep'?15:20);floorTexture.needsUpdate=true;
    const ground=this.own(new THREE.MeshStandardMaterial({map:floorTexture,color:palette.ground,roughness:.91,metalness:.03}));
    const floor=new THREE.Mesh(this.own(new THREE.PlaneGeometry(68,94)),ground);floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;this.environment.add(floor);
    // An authored CG panorama is framed behind a freely traversable 3D foreground.
    const backdrop=new THREE.Mesh(this.own(new THREE.PlaneGeometry(142,68)),this.own(new THREE.MeshBasicMaterial({map:skyMap,color:0xb2b7bf,fog:false})));
    backdrop.position.set(0,23,-63);this.environment.add(backdrop);
    const edge=this.own(new THREE.MeshStandardMaterial({color:stage==='keep'?0x412a28:0x434753,roughness:.95}));
    for(const x of [-23,23]) {
      const curb=new THREE.Mesh(this.own(new THREE.BoxGeometry(.7,.48,66)),edge);curb.position.set(x,.15,0);curb.receiveShadow=true;this.environment.add(curb);
      for(let z=-30;z<=30;z+=4){const post=new THREE.Mesh(this.own(new THREE.BoxGeometry(.65,1.0,.65)),edge);post.position.set(x,.52,z);post.castShadow=true;this.environment.add(post);}
    }
    const tree=this.own(treeTexture(palette.leaf));const lantern=this.own(lanternTexture());
    const treeMaterial=this.own(new THREE.MeshBasicMaterial({map:tree,transparent:true,alphaTest:.12,side:THREE.DoubleSide,color:0xb3bac5,depthWrite:true}));
    const lampMaterial=this.own(new THREE.SpriteMaterial({map:lantern,transparent:true,depthWrite:false,color:0xffffff}));
    for(let i=0;i<18;i++) {
      const side=i%2?-1:1;const z=-36+Math.floor(i/2)*8.6;
      const plant=new THREE.Mesh(this.own(new THREE.PlaneGeometry(14,14)),treeMaterial);plant.position.set(side*(26+(i%3)*2),6.8,z);plant.rotation.y=side*-.13;this.environment.add(plant);
      if(i<16){const lamp=new THREE.Sprite(lampMaterial);lamp.scale.set(4.1,4.1,1);lamp.position.set(side*21,1.85,z+3);this.environment.add(lamp);}
    }
    this.addGate(stage);
    if(stage==='river') {
      const water=new THREE.Mesh(this.own(new THREE.PlaneGeometry(8,90)),this.own(new THREE.MeshStandardMaterial({color:0x5b9898,metalness:.38,roughness:.2,transparent:true,opacity:.82})));
      water.rotation.x=-Math.PI/2;water.position.set(-29,.04,0);this.environment.add(water);
    }
    const rnd=randomFrom(574);const count=180;const positions=new Float32Array(count*3);
    for(let i=0;i<count;i++){positions[i*3]=(rnd()-.5)*60;positions[i*3+1]=.5+rnd()*10;positions[i*3+2]=(rnd()-.5)*80;}
    const geometry=this.own(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const material=this.own(new THREE.PointsMaterial({color:stage==='frost'?0xe3ffff:0xffddae,size:stage==='frost'?.08:.055,map:this.glow,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false}));
    this.ambientParticles=new THREE.Points(geometry,material);this.environment.add(this.ambientParticles);
    this.obstacleGroup=new THREE.Group();this.environment.add(this.obstacleGroup);this.obstacleSignature='';
    const sharedTextures=new Set(await Promise.all(this.textureCache.values()));
    for(const resource of this.resources)if(!priorResources.has(resource)&&!sharedTextures.has(resource))this.environmentOwned.add(resource);
  }
  addGate(stage) {
    const wood=this.own(new THREE.MeshStandardMaterial({color:stage==='frost'?0x5e7181:0x73372b,roughness:.83}));
    const gold=this.own(new THREE.MeshStandardMaterial({color:0xa78a58,metalness:.5,roughness:.49}));
    const stone=this.own(new THREE.MeshStandardMaterial({color:0x666771,roughness:.9}));
    const block=(w,h,d,x,y,z,material)=>{const mesh=new THREE.Mesh(this.own(new THREE.BoxGeometry(w,h,d)),material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;this.environment.add(mesh);return mesh;};
    for(const x of [-8,8]) {block(1.0,11,1.1,x,5.5,-36,wood);block(1.8,.7,1.8,x,.35,-36,stone);block(1.05,.3,1.15,x,2,-36,gold);}
    block(20,.7,1.2,0,8.3,-36,wood);block(23,.8,2,0,11,-36,wood);block(23.4,.23,2.2,0,11.5,-36,gold);
    block(2.4,2.6,.3,0,9.6,-35.3,wood);block(1.5,1.9,.05,0,9.6,-35.08,gold);
    if(stage==='keep')for(const side of [-1,1])for(let z=-25;z<=25;z+=12){block(.9,8,.9,side*23.5,4,z,wood);block(2,.4,12,side*23.5,7.8,z,wood);}
  }
  updateObstacles(obstacles=[]) {
    const signature=JSON.stringify(obstacles);
    if(signature===this.obstacleSignature)return;this.obstacleSignature=signature;this.obstacleGroup.clear();
    const material=this.own(new THREE.MeshStandardMaterial({color:this.stage==='keep'?0x765341:0x637078,roughness:.9}));
    for(const obstacle of obstacles) {
      const x=obstacle.x??((obstacle.minX??0)+(obstacle.maxX??0))/2;
      const z=obstacle.z??((obstacle.minZ??0)+(obstacle.maxZ??0))/2;
      const radius=obstacle.radius??obstacle.r;
      const w=obstacle.width??obstacle.w??((obstacle.maxX??x+1)-(obstacle.minX??x-1));
      const d=obstacle.depth??obstacle.h??((obstacle.maxZ??z+1)-(obstacle.minZ??z-1));
      const geometry=radius?new THREE.IcosahedronGeometry(radius,2):new THREE.BoxGeometry(Math.max(.2,w),1.1,Math.max(.2,d));
      const mesh=new THREE.Mesh(this.own(geometry),material);mesh.position.set(x,radius?radius*.45:.55,z);if(radius)mesh.scale.y=.75;mesh.castShadow=true;mesh.receiveShadow=true;this.obstacleGroup.add(mesh);
    }
  }
  actor(entity,isPlayer) {
    if(this.actors.has(entity.id))return this.actors.get(entity.id);
    const def=entity.def||{};const template=this.models.get(def.model);
    if(!template)throw new Error(`戦士 ${def.name||entity.key} のモデルが準備されていません。再試行してください。`);
    const group=new THREE.Group();const orient=new THREE.Group();const model=cloneSkeleton(template.scene);
    const size=template.box.getSize(new THREE.Vector3());const height=clamp(Number(def.height)||1.85,1.3,3.2);const scale=height/size.y;
    const inner=new THREE.Group();inner.scale.setScalar(scale);
    model.position.x-= (template.box.min.x+template.box.max.x)*.5;
    model.position.y-= template.box.min.y;
    model.position.z-= (template.box.min.z+template.box.max.z)*.5;
    inner.add(model);orient.add(inner);group.add(orient);this.characters.add(group);
    const materials=[];
    model.traverse(node=>{
      if(!node.isMesh)return;node.castShadow=true;node.receiveShadow=false;node.frustumCulled=false;
      const duplicate=original=>{const material=original.clone();if('roughness'in material)material.roughness=Math.max(.55,material.roughness);if('metalness'in material)material.metalness=Math.min(.25,material.metalness);materials.push(material);return material;};
      node.material=Array.isArray(node.material)?node.material.map(duplicate):duplicate(node.material);
    });
    const shadow=new THREE.Mesh(this.own(new THREE.PlaneGeometry(2.4,2.4)),this.own(new THREE.MeshBasicMaterial({map:this.glow,color:0x000000,transparent:true,opacity:.58,depthWrite:false})));
    shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;group.add(shadow);
    const ring=new THREE.Mesh(this.own(new THREE.RingGeometry(.66,.72,64)),this.own(new THREE.MeshBasicMaterial({color:isPlayer?0xe5d7a6:0xdb7565,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false})));
    ring.rotation.x=-Math.PI/2;ring.position.y=.035;group.add(ring);
    const hpCanvas=document.createElement('canvas');hpCanvas.width=128;hpCanvas.height=16;
    const hpTexture=this.own(new THREE.CanvasTexture(hpCanvas));const hpSprite=new THREE.Sprite(this.own(new THREE.SpriteMaterial({map:hpTexture,depthTest:false,transparent:true})));
    hpSprite.scale.set(1.7,.21,1);hpSprite.position.y=height+.38;group.add(hpSprite);
    const mixer=new THREE.AnimationMixer(model);const clips=new Map(template.clips.map(clip=>[clip.name,mixer.clipAction(clip)]));
    const actor={group,orient,model,mixer,clips,materials,ring,hpCanvas,hpTexture,hpSprite,isPlayer,lastHp:-1,lastState:'',activeAction:null,previous:new THREE.Vector2(entity.x,entity.z),height,death:0};
    this.actors.set(entity.id,actor);return actor;
  }
  animate(actor,entity,dt) {
    const moved=actor.previous.distanceTo(new THREE.Vector2(entity.x,entity.z));actor.previous.set(entity.x,entity.z);
    const state=entity.dead?'dead':entity.state||'idle';
    let candidates=['Sword_Idle','Idle'];
    if(state==='dead')candidates=['Death01','Hit_Knockback'];
    else if(/dash|dodge|roll/.test(state))candidates=['Roll','Shield_Dash','Run'];
    else if(/attack|slash|combo/.test(state))candidates=['Sword_Attack','Sword_Regular_Combo','Punch_Jab'];
    else if(/skill|cast|over|ultimate|heal/.test(state))candidates=['Spell_Simple_Shoot','Spell_Simple_Enter','OverhandThrow'];
    else if(/guard|block/.test(state))candidates=['Sword_Block','Idle_Shield_Loop'];
    else if(/hurt|stun/.test(state))candidates=['Hit_Chest','Hit_Head'];
    else if(moved>.002)candidates=['Run','Walk'];
    const key=candidates.find(name=>actor.clips.has(name))||actor.clips.keys().next().value;
    if(key&&key!==actor.lastState) {
      const action=actor.clips.get(key);action.reset();action.setEffectiveTimeScale(/Sword_Attack/.test(key)?1.6:1);
      action.setLoop(state==='dead'?THREE.LoopOnce:THREE.LoopRepeat,state==='dead'?1:Infinity);action.clampWhenFinished=state==='dead';
      action.fadeIn(.13).play();if(actor.activeAction)actor.activeAction.fadeOut(.13);actor.activeAction=action;actor.lastState=key;
    }
    actor.mixer.update(dt);
    const facing=typeof entity.facing==='number'?entity.facing:Math.atan2(entity.facing?.x||0,entity.facing?.z||1);
    const delta=Math.atan2(Math.sin(facing-actor.orient.rotation.y),Math.cos(facing-actor.orient.rotation.y));
    actor.orient.rotation.y+=delta*Math.min(1,dt*16);
    actor.group.position.set(entity.x,entity.y||0,entity.z);
    if(entity.dead){actor.death+=dt;actor.group.visible=actor.death<2.5;actor.hpSprite.visible=false;actor.ring.visible=false;}else {actor.death=0;actor.group.visible=true;}
    for(const material of actor.materials) if(material.emissive){material.emissive.setHex(0xffffff);material.emissiveIntensity=entity.hitFlash>0?.5:0;}
    if(actor.lastHp!==entity.hp){
      actor.lastHp=entity.hp;const ctx=actor.hpCanvas.getContext('2d');ctx.clearRect(0,0,128,16);ctx.fillStyle='#111621dd';ctx.fillRect(0,0,128,16);
      ctx.fillStyle=actor.isPlayer?'#d9c798':'#e29a8c';ctx.fillRect(2,2,124*clamp(entity.hp/entity.maxHp,0,1),12);actor.hpTexture.needsUpdate=true;
    }
  }
  effect(effect) {
    if(this.effectObjects.has(effect.id))return this.effectObjects.get(effect.id);
    const kind=effect.kind||'burst';const slash=kind==='slash';const seal=/shock|ring|area|ultimate|over|heal|telegraph|guard/.test(kind);
    const material=this.own(new THREE.MeshBasicMaterial({map:slash?this.slash:seal?this.ring:this.glow,color:effect.color??0xffdc99,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
    const mesh=new THREE.Mesh(this.own(new THREE.PlaneGeometry(1,1)),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.08;this.effects.add(mesh);
    const entry={mesh,material,seal,slash};this.effectObjects.set(effect.id,entry);return entry;
  }
  updateEffects(combat) {
    const seen=new Set();
    for(const effect of (combat.effects||[]).slice(-80)) {
      seen.add(effect.id);const entry=this.effect(effect);const progress=1-clamp(effect.life/(effect.maxLife||effect.life||1),0,1);
      const size=Math.max(.5,(effect.radius||1)*(entry.seal?2.5:3)*(entry.seal?.65+progress*.4:1));
      entry.mesh.position.set(effect.x,entry.slash?.85:.06+(entry.seal?0:Math.sin(progress*Math.PI)*.5),effect.z);
      entry.mesh.scale.setScalar(size);entry.mesh.rotation.z=entry.slash?-(effect.facing||0)+(this.reducedMotion?0:progress*1.1):this.reducedMotion?0:progress*.65;
      entry.material.opacity=effect.kind==='telegraph'?.3+progress*.6:Math.max(0,(1-progress)*.85);entry.material.color.set(effect.color??0xffdc99);
    }
    for(const [id,entry]of this.effectObjects)if(!seen.has(id)){entry.mesh.removeFromParent();entry.mesh.geometry.dispose();entry.material.dispose();this.resources.delete(entry.mesh.geometry);this.resources.delete(entry.material);this.effectObjects.delete(id);}
    const shots=new Set();
    for(const shot of (combat.projectiles||[]).slice(0,96)) {
      shots.add(shot.id);let sprite=this.projectileObjects.get(shot.id);
      if(!sprite){sprite=new THREE.Sprite(this.own(new THREE.SpriteMaterial({map:this.glow,color:shot.color??0x8bd8ff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false})));this.effects.add(sprite);this.projectileObjects.set(shot.id,sprite);}
      sprite.position.set(shot.x,shot.y??1,shot.z);sprite.scale.setScalar(Math.max(.5,(shot.radius||.3)*3.5));
    }
    for(const [id,sprite]of this.projectileObjects)if(!shots.has(id)){sprite.removeFromParent();sprite.material.dispose();this.resources.delete(sprite.material);this.projectileObjects.delete(id);}
  }
  render(combat,dt=1/60) {
    if(this.disposed)return;if(this.contextError)throw new Error(this.contextError);if(!combat||!this.prepared)return;
    dt=clamp(dt,0,.1);this.elapsed+=dt;this.updateObstacles(combat.obstacles);
    for(const entity of combat.entities||[]) {const actor=this.actor(entity,entity===combat.player);if(actor)this.animate(actor,entity,dt);}
    this.updateEffects(combat);
    const player=combat.player;
    if(player) {
      const desired=new THREE.Vector3(player.x,0,player.z-2);
      if(!this.cameraReady){this.focus.copy(desired);this.cameraReady=true;}else this.focus.lerp(desired,1-Math.exp(-dt*5));
      const portrait=this.camera.aspect<.8;const distance=portrait?1.28:1;
      this.camera.position.set(this.focus.x,14*distance,this.focus.z+12*distance);this.camera.lookAt(this.focus.x,.3,this.focus.z);
      this.sun.position.set(this.focus.x-12,24,this.focus.z+12);this.sun.target.position.set(this.focus.x,0,this.focus.z);
    }
    if(this.ambientParticles&&!this.reducedMotion){const position=this.ambientParticles.geometry.attributes.position;for(let i=0;i<position.count;i++){position.array[i*3+1]-=dt*(this.stage==='frost'?.5:.08);if(position.array[i*3+1]<.2)position.array[i*3+1]=10;}position.needsUpdate=true;}
    this.renderer.render(this.scene,this.camera);
  }
  project(x,z,y=2.1) {
    const point=new THREE.Vector3(x,y,z).project(this.camera);
    const width=this.canvas.clientWidth||this.canvas.width||1;
    const height=this.canvas.clientHeight||this.canvas.height||1;
    return {x:(point.x*.5+.5)*width,y:(-point.y*.5+.5)*height,visible:point.z>=-1&&point.z<=1&&Math.abs(point.x)<=1.1&&Math.abs(point.y)<=1.1};
  }
  disposeTemplate(template) {
    const released=new Set();
    template.scene.traverse(node=>{
      if(node.geometry&&!released.has(node.geometry)){node.geometry.dispose();released.add(node.geometry);}
      if(node.isSkinnedMesh)node.skeleton?.dispose();
      for(const material of Array.isArray(node.material)?node.material:[node.material])if(material&&!released.has(material)){
        for(const value of Object.values(material))if(value?.isTexture&&!released.has(value)){value.dispose();released.add(value);}
        material.dispose();released.add(material);
      }
    });
  }
  resize() {
    if(this.disposed)return;const width=Math.max(1,this.canvas.clientWidth||window.innerWidth);const height=Math.max(1,this.canvas.clientHeight||window.innerHeight);
    this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();
  }
  setQuality(quality='balanced') {
    this.quality=QUALITY[quality]?quality:'balanced';const setting=QUALITY[this.quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,setting.ratio));this.renderer.shadowMap.enabled=setting.shadows;
    this.resize();
  }
  clearEffects() {
    for(const entry of this.effectObjects.values()) {entry.mesh.geometry.dispose();entry.material.dispose();this.resources.delete(entry.mesh.geometry);this.resources.delete(entry.material);}
    for(const sprite of this.projectileObjects.values()){sprite.material.dispose();this.resources.delete(sprite.material);}
    this.effects.clear();this.effectObjects.clear();this.projectileObjects.clear();
  }
  clearActors() {
    for(const actor of this.actors.values()) {
      actor.mixer.stopAllAction();actor.mixer.uncacheRoot(actor.model);
      for(const material of actor.materials)material.dispose();
      actor.group.traverse(node=>{
        if(node.isSkinnedMesh)node.skeleton?.dispose();
        if(node.geometry&&this.resources.has(node.geometry)){node.geometry.dispose();this.resources.delete(node.geometry);}
        for(const material of Array.isArray(node.material)?node.material:[node.material])if(this.resources.has(material)){material.dispose();this.resources.delete(material);}
      });
      actor.hpTexture.dispose();this.resources.delete(actor.hpTexture);actor.group.removeFromParent();
    }
    this.actors.clear();
  }
  dispose() {
    if(this.disposed)return;this.disposed=true;this.preparation++;this.resizeObserver?.disconnect();this.canvas.removeEventListener('webglcontextlost',this.contextLost);
    this.clearActors();
    const disposed=new Set();
    for(const {scene} of this.models.values())scene.traverse(node=>{if(node.geometry&&!disposed.has(node.geometry)){node.geometry.dispose();disposed.add(node.geometry);}for(const material of Array.isArray(node.material)?node.material:[node.material])if(material&&!disposed.has(material)){for(const value of Object.values(material))if(value?.isTexture&&!disposed.has(value)){value.dispose();disposed.add(value);}material.dispose();disposed.add(material);}});
    for(const resource of this.resources)if(!disposed.has(resource))resource.dispose?.();
    this.resources.clear();this.models.clear();this.scene.clear();this.draco.dispose();this.renderer.dispose();
  }
}
