/* V55.5: actual-GLB thumbnails for ALL dynamically listed fighters.
   No generated/repainted character look; original outfit, face, colors and geometry preserved.
   One GPU preview context, one model decode at a time; no artificial look-alike replacement. */
import * as THREE from 'three';
import {FIGHTERS} from '../data.js?v=rf-minamoto-v48-20261111';
import {loadModel,instantiateModel,disposeModel} from '../model-runtime.js?v=rf-minamoto-v48-20261111';
const id='rf555-model-portrait';
if(!window[id]){
 window[id]=true;
 const cache=new Map(),pending=new Map(),requested=[];
 const W=256,H=342;
 let worker=false,renderer=null,observer=null,gpuBroken=false;
 const isMobile=matchMedia?.('(pointer: coarse)')?.matches||/Android|iPhone|iPad/i.test(navigator.userAgent);
 const delay=()=>new Promise(r=>{
  if(typeof requestIdleCallback==='function')requestIdleCallback(()=>r(),{timeout:1000});
  else setTimeout(r,32);
 });
 function view(){
  if(renderer)return renderer;
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power',preserveDrawingBuffer:false});
  renderer.setPixelRatio(1);renderer.setSize(W,H,false);
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.13;
  return renderer;
 }
 function toUrl(canvas){
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
   if(!blob)return reject(Error('WebP画像の書き出しに失敗'));
   resolve(URL.createObjectURL(blob));
  },'image/webp',.86));
 }
 async function makePortrait(key){
  const def=FIGHTERS[key];
  if(!def?.model)throw Error('No GLB model');
  const gltf=await loadModel(def.model);
  if(!gltf?.scene)throw Error('Invalid GLB model');
  const scene=new THREE.Scene();let inst=null;
  try{
   inst=instantiateModel(gltf,3.8,null);
   scene.add(inst.wrapper);
   inst.wrapper.updateMatrixWorld(true);
   const box=new THREE.Box3().setFromObject(inst.wrapper);
   const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
   if(!Number.isFinite(size.y)||size.y<=0)throw Error('Invalid model bounds');
   const camera=new THREE.PerspectiveCamera(34,W/H,.05,800);
   const v=THREE.MathUtils.degToRad(camera.fov/2);
   const ext=Math.max(size.x,size.z*.85);
   const distance=Math.max(size.y/(2*Math.tan(v)),ext/(2*Math.tan(v)*W/H))*1.27;
   camera.position.set(center.x+distance*.13,center.y+size.y*.055,center.z+distance);
   camera.lookAt(center.x,center.y+size.y*.035,center.z);
   scene.add(new THREE.HemisphereLight(0xeaf6ff,0x3b4567,2.15));
   const keyLight=new THREE.DirectionalLight(0xffffff,3.2);keyLight.position.set(5,9,7);scene.add(keyLight);
   const rim=new THREE.DirectionalLight(0x9fb9ff,2.4);rim.position.set(-4,6,-8);scene.add(rim);
   view().render(scene,camera);
   return await toUrl(renderer.domElement);
  }finally{
   if(inst)disposeModel(inst);
  }
 }
 function put(card,key,url){
  if(!card?.isConnected)return;
  let img=card.querySelector('img.face');
  if(!img){img=document.createElement('img');img.className='face';img.alt='';img.loading='lazy';const label=card.querySelector('b');if(label)label.before(img);else card.prepend(img);}
  img.src=url;img.loading='lazy';img.decoding='async';img.alt=(FIGHTERS[key]?.name||key)+'の実際の3Dモデルプレビュー';
  img.style.filter='none';img.style.imageRendering='auto';
  card.dataset.rf555Portrait='done';
 }
 async function run(){
  if(worker)return;worker=true;
  try{
   while(requested.length){
    const {key,card}=requested.shift();
    if(!card.isConnected)continue;
    if(cache.has(key)){put(card,key,cache.get(key));continue;}
    if(gpuBroken){card.dataset.rf555Portrait='unavailable';continue;}
    try{
      await delay();
      // Skip work while title menu, battle, or settings is on screen.
      if(!document.getElementById('scr-select')?.classList.contains('on')){
       delete card.dataset.rf555Portrait;continue;
      }
      const url=await makePortrait(key);
      cache.set(key,url);put(card,key,url);
      // Keep small thumbnails in the session; source GLB material is disposed after rendering.
    }catch(e){
      card.dataset.rf555Portrait='fallback';
      if(/WebGL|context|GL_/.test(String(e?.message||e)))gpuBroken=true;
      console.warn('[V55.5 model portrait]',key,e?.message||e);
    }
   }
  }finally{worker=false;}
 }
 function queue(card){
  if(!card || card.dataset.rf555Portrait || card.dataset.exactPortrait==='done')return;
  const key=card.dataset.rf53Key||card.dataset.specialKey||card.dataset.fighterId;
  const def=FIGHTERS[key];
  if(!def?.model)return;
  if(cache.has(key)){put(card,key,cache.get(key));return;}
  card.dataset.rf555Portrait='loading';
  requested.push({card,key});run();
 }
 function onCards(){
  const grid=document.getElementById('select-grid');if(!grid)return;
  for(const card of grid.querySelectorAll('button.card:not(.stage-tile)')){
   if(card.dataset.rf555Portrait)continue;
   if(observer){card.dataset.rf555Portrait='observing';observer.observe(card);}
   else queue(card);
  }
 }
 function start(){
  const grid=document.getElementById('select-grid');if(!grid)return;
  if(typeof IntersectionObserver==='function'){
   observer=new IntersectionObserver(entries=>{
     for(const e of entries){if(!e.isIntersecting)continue;observer.unobserve(e.target);
       if(e.target.dataset.rf555Portrait==='observing')delete e.target.dataset.rf555Portrait;
       queue(e.target);
     }
   },{root:null,rootMargin:isMobile?'80px':'160px',threshold:.01});
  }
  const watch=new MutationObserver(onCards);watch.observe(grid,{subtree:false,childList:true});
  grid.addEventListener('pointerover',onCards,{passive:true});
  document.getElementById('scr-select')?.addEventListener('scroll',onCards,{passive:true});
  onCards();
  window.addEventListener('pagehide',()=>{
   for(const v of cache.values())URL.revokeObjectURL(v);
   renderer?.dispose();renderer?.forceContextLoss?.();renderer=null;
  },{once:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
}
