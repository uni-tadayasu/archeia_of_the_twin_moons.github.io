
/* RF47 : one-line UI label fitting with ellipsis + accessible full-title fallback */
(()=>{
'use strict';
if(window.__rf47TextFit)return;
window.__rf47TextFit=true;
const root=document.getElementById('ui');
if(!root)return;
const SCOPES=[
 '.screen.on :is(.crumb,.label,.back,.btn,.chip,.card b,.card em,.card small,.mode-tile b,.mode-tile small,.portal-topnav button,.portal-services button b,.portal-services button small,.portal-hero h1,.portal-hero h1 span,.hero-kicker,.brand-type,.world-gallery button span,.section-heading h2,.section-heading span,.overview-panel h2,.portal-hero-bottom span,#res-title,#story-chapter)',
 '.screen.on .menu button:not(:has(small)):not(:has(b))',
 '.screen.on .menu button :is(b,small,span)',
 '#hud :is(.plate b,#field-region,#field-obj,#field-prompt,#btn-pause)',
 '#skillname :is(.sn-name,.sn-who,.sn-kind)',
 '#cutin :is(.ci-title,.ci-who)',
 '#banner :is(b,i)',
 '#tbtns button'
].join(',');
const originalStyle=new WeakMap();
function measure(el){
 if(!el.isConnected||!el.getClientRects().length)return;
 const computed=getComputedStyle(el);
 if(computed.display==='none'||computed.visibility==='hidden'||!el.textContent.trim())return;
 let record=originalStyle.get(el);
 if(!record){record={value:el.style.getPropertyValue('font-size'),priority:el.style.getPropertyPriority('font-size'),title:el.getAttribute('title')};originalStyle.set(el,record);}
 if(record.value)el.style.setProperty('font-size',record.value,record.priority);
 else el.style.removeProperty('font-size');
 const base=parseFloat(getComputedStyle(el).fontSize);
 if(!Number.isFinite(base)||base<8)return;
 const width=el.clientWidth;
 if(width<20)return;
 const isTitle=el.matches('h1,h2,h3,.label,.sn-name,.ci-title,#banner b');
 const isSmall=el.matches('.card small,.mode-tile small,.portal-services small');
 const floor=isTitle?Math.min(17,base):isSmall?Math.min(10,base):Math.min(11,base);
 let required=el.scrollWidth;
 if(required<=width+1){
  if(el.dataset.rf47Overflow==='yes'){el.removeAttribute('data-rf47-overflow');if(record.title===null)el.removeAttribute('title');else el.setAttribute('title',record.title);}
  return;
 }
 let size=Math.max(floor,Math.min(base,base*(width-3)/Math.max(required,1)*.97));
 for(let i=0;i<4;i++){
  el.style.setProperty('font-size',size.toFixed(2)+'px','important');
  required=el.scrollWidth;
  if(required<=width+1||size<=floor+.05)break;
  size=Math.max(floor,size*(width-2)/required*.98);
 }
 if(el.scrollWidth>el.clientWidth+2){
  if(!el.hasAttribute('title'))el.setAttribute('title',el.textContent.trim().replace(/\s+/g,' ').slice(0,300));
  el.dataset.rf47Overflow='yes';
 }else if(el.dataset.rf47Overflow==='yes'){
  el.removeAttribute('data-rf47-overflow');
  if(record.title===null)el.removeAttribute('title');else el.setAttribute('title',record.title);
 }
}
let timer=null;
function fit(){
 timer=null;
 const nodes=root.querySelectorAll(SCOPES);
 let count=0;
 for(const el of nodes){
  if(count>360)break;
  measure(el);count++;
 }
 const vv=window.visualViewport;
 const width=Math.round(vv?.width||window.innerWidth||document.documentElement.clientWidth);
 const height=Math.round(vv?.height||window.innerHeight);
 document.documentElement.style.setProperty('--rf47-visible-height',height+'px');
 document.documentElement.classList.toggle('rf47-phone',width<=600);
 document.documentElement.classList.toggle('rf47-landscape',width>height);
}
function schedule(){
 if(timer!==null)return;
 timer=setTimeout(()=>requestAnimationFrame(fit),140);
}
const observer=new MutationObserver(schedule);
observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
if('ResizeObserver' in window){const ro=new ResizeObserver(schedule);ro.observe(root);for(const e of root.querySelectorAll('.screen'))ro.observe(e);}
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('orientationchange',schedule,{passive:true});
window.visualViewport?.addEventListener('resize',schedule,{passive:true});
document.addEventListener('visibilitychange',schedule);
document.fonts?.ready?.then(schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});
else schedule();
window.rf47FitText=()=>{schedule();return 'scheduled'};
})();
