
/* RIFTFALL V46: viewport adaptation without mutating V45 draggable controls */
(()=>{
'use strict';
if(window.__rf46ResponsiveLoaded)return;
window.__rf46ResponsiveLoaded=true;
const root=document.documentElement;
let queued=false;
function update(){
  queued=false;
  const vv=window.visualViewport;
  const width=Math.round(vv?.width||window.innerWidth||root.clientWidth);
  const height=Math.round(vv?.height||window.innerHeight||root.clientHeight);
  if(!width||!height)return;
  root.style.setProperty('--rf46-visible-h',height+'px');
  root.classList.toggle('rf46-mobile',width<=600);
  root.classList.toggle('rf46-short',height<=540);
  root.classList.toggle('rf46-landscape',width>height);
}
function schedule(){if(queued)return;queued=true;requestAnimationFrame(update);}
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('orientationchange',schedule,{passive:true});
window.visualViewport?.addEventListener('resize',schedule,{passive:true});
window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
document.addEventListener('visibilitychange',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});else update();
window.rf46LayoutCheck=()=>({
viewport:[document.documentElement.clientWidth,window.innerHeight],
overflow:[...document.querySelectorAll('#ui .screen.on *')]
.filter(e=>{const v=getComputedStyle(e);return v.display!=='none'&&v.visibility!=='hidden'&&e.clientWidth>0&&e.scrollWidth>e.clientWidth+6})
.slice(0,20).map(e=>({element:e.tagName,id:e.id,classes:typeof e.className==='string'?e.className.slice(0,50):''}))
});
})();
