/** Automatically creates character-select WebP thumbnails from the *real* GLB.
 * No AI repainting, mesh substitutions or tinting. The original models are
 * loaded through the game's own verified WebP/glTF pipeline. */
import { FIGHTERS } from './data.js?v=20261108-maou-green-v6';
import { loadModel } from './model-runtime.js?v=20261108-maou-green-v6';
import { renderExactPortrait } from './glb-portrait.js?v=20261108-maou-green-v6';

const EXACT_KEYS=['gaizorg','valdarion','valgard','operator_gigantes','chief','maou'];
const result=new Map(),pending=new Map();
const sourceMap=new Map(EXACT_KEYS.map(k=>[FIGHTERS[k]?.name,k]).filter(([n])=>n));
function getExactWebp(key){
  if(result.has(key))return Promise.resolve(result.get(key));
  if(pending.has(key))return pending.get(key);
  const fighter=FIGHTERS[key];if(!fighter?.model)return Promise.reject(Error('モデルがありません'));
  const promise=loadModel(fighter.model)
    .then(gltf=>renderExactPortrait(gltf,key))
    .then(url=>{result.set(key,url);return url})
    .finally(()=>pending.delete(key));
  pending.set(key,promise);return promise;
}
// Render only on-screen selection tiles. Loading every 20–25MB GLB at once
// would stall mobile browsers and create expensive simultaneous WebGL contexts.
let visibleObserver=null;
function loadCard(card){
  if(card.disabled || card.dataset.exactPortrait==='done'||card.dataset.exactPortrait==='loading')return;
  const displayName=card.querySelector('b')?.textContent?.trim();
  const key=sourceMap.get(displayName);
  if(!key)return;
  const img=card.querySelector('img.face');if(!img)return;
  card.dataset.exactPortrait='loading';
  getExactWebp(key).then(url=>{
    if(!url || !card.isConnected)return;
    if(!FIGHTERS[key].originalSelectFace)FIGHTERS[key].originalSelectFace=FIGHTERS[key].face;
    FIGHTERS[key].face=url;
    img.src=url;
    img.alt=`${displayName}（実際の3Dモデルから生成したWebP画像）`;
    img.style.filter='none';img.style.imageRendering='auto';
    card.dataset.exactPortrait='done';
  }).catch(error=>{
    delete card.dataset.exactPortrait;
    console.warn('[Exact GLB Portrait]',key,error?.message||error);
  });
}
function updateCards(){
  const grid=document.getElementById('select-grid');if(!grid)return;
  for(const card of grid.querySelectorAll('button.card')){
    if(card.disabled || card.dataset.exactPortrait)continue;
    if(visibleObserver){
      card.dataset.exactPortrait='observing';
      visibleObserver.observe(card);
    }else loadCard(card);
  }
}
function init(){
  const grid=document.getElementById('select-grid');if(!grid)return;
  if(typeof IntersectionObserver==='function'){
    visibleObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        visibleObserver.unobserve(entry.target);
        if(entry.target.dataset.exactPortrait==='observing')delete entry.target.dataset.exactPortrait;
        loadCard(entry.target);
      }
    },{rootMargin:'180px',threshold:.01});
  }
  const observer=new MutationObserver(updateCards);
  observer.observe(grid,{childList:true,subtree:true});
  grid.addEventListener('pointerover',updateCards,{passive:true});
  updateCards();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
export {getExactWebp};
