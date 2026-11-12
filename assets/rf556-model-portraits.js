import * as THREE from 'three';
import {FIGHTERS,ROSTER} from '../data.js?v=rf-minamoto-v48-20261111';
import {loadModel,instantiateModel,disposeModel} from '../model-runtime.js?v=rf-minamoto-v48-20261111';
import {assignUniqueAppearances} from '../appearance-data.js';
import {applyCharacterVariant,disposeCharacterVariant} from '../character-variants.js';
import {finishIllustratedModel} from './rf5520-illustrated-material.js?v=55.21';
if(!window.__rf561PortraitAppearanceApplied){
  if(!window.__rf561AppearanceReady) assignUniqueAppearances(Object.fromEntries(ROSTER.filter(key=>FIGHTERS[key]).map(key=>[key,FIGHTERS[key]])));
  window.__rf561PortraitAppearanceApplied=true;
}
if(!window.__rf556Portraits){
 window.__rf556Portraits=true;
 const DB='rf556-model-portraits';
 const lowMemory=(Number(navigator.deviceMemory)||8)<=4;
 const mobile=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
 const conserve=mobile||lowMemory||navigator.connection?.saveData;
 // V55.7: higher definition real-GLB captures on desktop; preserve mobile budget and old cache.
 const W=(mobile||lowMemory)?240:384,H=(mobile||lowMemory)?320:512;
 // RF558_TEXTURE_COLOR_REPAIR — discard stale GLB captures generated with inverted atlas UVs.
 const CACHE_VER=conserve?'rf5521-portrait-mobile':'rf5521-portrait-desktop';
 const completed=new Map(),busyKeys=new Map();
 let renderer=null,locked=false,queue=[],observer=null;
 let lastFailure='',dbPromise=null;
 const pause=()=>new Promise(ok=>setTimeout(ok,mobile?160:60));
 const keyOf=el=>el.dataset.rf53Key||el.dataset.specialKey||el.dataset.fighterId||el.closest('[data-special-key]')?.dataset.specialKey||'';
 const isOpen=()=>!!document.getElementById('scr-select')?.classList.contains('on');
 const STORE='images';
 function openDB(){
  if(!('indexedDB' in window))return Promise.resolve(null);
  if(dbPromise)return dbPromise;
  dbPromise=new Promise(resolve=>{
   try{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE);};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null);
   }catch{resolve(null);}
  });return dbPromise;
 }
 async function getBlob(key){
  const db=await openDB();if(!db)return null;
  return new Promise(resolve=>{try{const req=db.transaction(STORE,'readonly').objectStore(STORE).get(key);
   req.onsuccess=()=>resolve(req.result instanceof Blob?req.result:null);req.onerror=()=>resolve(null);
  }catch{resolve(null);}});
 }
 async function putBlob(key,blob){
  const db=await openDB();if(!db)return;
  try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(blob,key);}catch{}
 }
 function readyRenderer(){
  if(renderer)return renderer;
  renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
  renderer.setPixelRatio(1);renderer.setSize(W,H,false);
  renderer.setClearColor(0,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
  renderer.domElement.addEventListener('webglcontextlost',()=>{renderer=null;lastFailure='WebGL context lost';},{once:true});
  return renderer;
 }
 async function renderGLB(key){
  const def=FIGHTERS[key];if(!def?.model)throw Error('3Dモデル未設定');
  const gltf=await loadModel(def.model);
  if(!gltf?.scene)throw Error('GLBモデルのロードに失敗');
  const scene=new THREE.Scene();let instance=null;
  try{
   instance=instantiateModel(gltf,3.8,null);
   if(def.appearance)applyCharacterVariant(instance.model,def);
   finishIllustratedModel(instance,key);
   scene.add(instance.wrapper);
   instance.wrapper.updateMatrixWorld(true);
   const bb=new THREE.Box3().setFromObject(instance.wrapper);
   const size=bb.getSize(new THREE.Vector3()),center=bb.getCenter(new THREE.Vector3());
   if(!Number.isFinite(size.y)||size.y<.01)throw Error('3Dモデルのサイズが不正');
   const aspect=W/H,fov=33,camera=new THREE.PerspectiveCamera(fov,aspect,.08,900);
   const rad=THREE.MathUtils.degToRad(fov*.5);
   const width=Math.max(size.x,size.z*.75);
   const distance=Math.max(size.y/(2*Math.tan(rad)),width/(2*Math.tan(rad)*aspect))*1.34;
   camera.position.set(center.x+distance*.12,center.y+size.y*.07,center.z+distance);
   camera.lookAt(center.x,center.y+size.y*.035,center.z);
   scene.add(new THREE.HemisphereLight(0xeaf3ff,0x685147,1.68));
   const sun=new THREE.DirectionalLight(0xffebd9,2.8);sun.position.set(4,7,9);scene.add(sun);
   const rim=new THREE.DirectionalLight(0xa0c9ef,1.95);rim.position.set(-5,5,-7);scene.add(rim);
   const r=readyRenderer();r.render(scene,camera);
   const blob=await new Promise((resolve,reject)=>r.domElement.toBlob(v=>v?resolve(v):reject(Error('WebP画像の書き出しに失敗')),'image/webp',mobile ? 0.84 : 0.89));
   if(blob.size<500)throw Error('空白の画像が出力されました');
   return blob;
  }finally{
   if(instance){disposeCharacterVariant(instance.model);disposeModel(instance);}
  }
 }
 function paint(card,key,url){
  if(!card.isConnected || card.disabled || key!==keyOf(card) || !FIGHTERS[key])return;
  const img=card.querySelector('img.face');
  if(!img)return;
  img.src=url;img.decoding='async';img.alt=FIGHTERS[key].name+' — 実際の3Dモデルを撮影したプレビュー';
  img.style.imageRendering='auto';
  card.dataset.rf556Portrait='done';
  card.removeAttribute('aria-busy');
 }
 function label(card,key,state){
  card.dataset.rf556Portrait=state;
  if(state==='loading')card.setAttribute('aria-busy','true');else card.removeAttribute('aria-busy');
 }
 async function acquire(key,automatic=false){
  if(completed.has(key))return completed.get(key);
  if(busyKeys.has(key)){
   const pending=await busyKeys.get(key);
   if(pending||automatic)return pending;
  }
  const model=FIGHTERS[key]?.model;
  if(!model)throw Error('3Dモデル未設定');
  const cacheKey=CACHE_VER+':'+key+':'+(FIGHTERS[key]?.appearance?.id||model);
  const work=(async()=>{
    let blob=await getBlob(cacheKey);
    if(!blob){
      if(automatic&&conserve)return null;
      blob=await renderGLB(key);
      await putBlob(cacheKey,blob);
    }
    const url=URL.createObjectURL(blob);
    completed.set(key,url);return url;
  })();
  busyKeys.set(key,work);
  try{return await work;}finally{busyKeys.delete(key);}
 }
 async function drain(){
  if(locked)return;
  locked=true;
  try{
   while(queue.length){
    if(!isOpen() || document.hidden)break;
    const {card,key}=queue.shift();
    if(!card.isConnected || card.disabled || key!==keyOf(card))continue;
    try{
     await pause();
     if(!isOpen() || !card.isConnected){card.removeAttribute('aria-busy');delete card.dataset.rf556Portrait;continue;}
     const url=await acquire(key,!!card.querySelector('img.face')?.getAttribute('src'));
     if(url)paint(card,key,url);
     else label(card,key,'fallback');
    }catch(e){
     label(card,key,'fallback');
     if(String(e?.message||e)!==lastFailure){lastFailure=String(e?.message||e);console.warn('[V55.6 model portrait]',key,lastFailure);}
    }
   }
  }finally{locked=false;}
 }
 function schedule(card){
  if(!card?.isConnected||card.disabled)return;
  const key=keyOf(card),fighter=FIGHTERS[key];
  if(!fighter)return;
  if(!fighter.model){label(card,key,'fallback');return;}
  if(completed.has(key)){paint(card,key,completed.get(key));return;}
  if(card.dataset.rf556Portrait==='loading' || card.dataset.rf556Portrait==='done')return;
  label(card,key,'loading');queue.push({card,key});drain();
 }
 function examine(){
  const grid=document.getElementById('select-grid');if(!grid)return;
  for(const card of grid.querySelectorAll('button.card:not(.stage-tile):not(:disabled)')){
   if(['done','loading','observing','fallback'].includes(card.dataset.rf556Portrait))continue;
   if(observer){card.dataset.rf556Portrait='observing';observer.observe(card);}else schedule(card);
  }
 }
 function init(){
  const grid=document.getElementById('select-grid');if(!grid)return;
  if('IntersectionObserver' in window){
   observer=new IntersectionObserver(records=>{
    for(const item of records){if(!item.isIntersecting)continue;
     observer.unobserve(item.target);
     if(item.target.dataset.rf556Portrait==='observing')delete item.target.dataset.rf556Portrait;
     schedule(item.target);
    }
   },{root:null,rootMargin:lowMemory?'0px 0px 45px 0px':'0px 0px 140px 0px',threshold:.01});
  }
  const mutations=new MutationObserver(items=>{
   if(items.some(it=>it.type==='childList'))requestAnimationFrame(examine);
  });
  mutations.observe(grid,{childList:true,subtree:false});
  const selection=document.getElementById('scr-select');
  if(selection){
   new MutationObserver(()=>{if(isOpen()){examine();drain();}}).observe(selection,{attributes:true,attributeFilter:['class']});
   selection.addEventListener('scroll',()=>{if(isOpen())examine();},{passive:true});
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && isOpen()){examine();drain();}});
  window.addEventListener('pagehide',event=>{
   if(event.persisted)return;
   completed.forEach(url=>URL.revokeObjectURL(url));completed.clear();
   renderer?.dispose();renderer?.forceContextLoss?.();renderer=null;
  });
  examine();
  function retryFailed(){
   const grid=document.getElementById('select-grid');if(!grid)return;
   for(const card of grid.querySelectorAll('button.card')){
    if(card.dataset.rf556Portrait==='fallback'){
     delete card.dataset.rf556Portrait;
     const key=keyOf(card);if(key&&completed.has(key)){URL.revokeObjectURL(completed.get(key));completed.delete(key);}
    }
   }
   lastFailure='';examine();drain();
  }
  window.RF556Portraits={get:acquire,refresh:examine,retryFailed};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}
