/* RF49: fit compact labels and handle responsive device viewport changes.
   Does not mutate character models, move user-customized touch controls or modify gameplay. */
(()=>{
 'use strict';
 if(window.__rf49Responsive)return;
 window.__rf49Responsive=true;
 const root=document.documentElement;
 const ui=document.getElementById('ui');
 if(!ui)return;
 const compactSelectors=[
   '.screen.on .back','.screen.on .topbar .crumb','.screen.on .label',
   '.screen.on .portal-topnav button','.screen.on .portal-hero h1 span',
   '.screen.on .portal-services button b','.screen.on .portal-services button small',
   '.screen.on .portal-modes button b','.screen.on .mode-tile b',
   '.screen.on .card b','.screen.on .card em',
   '.screen.on .party-slot-head strong','.screen.on .party-picker-choice strong',
   '.screen.on .stage-tag','.screen.on #res-title',
   '#hud .plate b','#field-hud #field-region',
   '#skillname .sn-name','#cutin .ci-title','#banner b',
 ].join(',');
 const data=new WeakMap();
 let scheduled=false,lastWidth=0,lastHeight=0,observer=null;
 const raf=window.requestAnimationFrame?.bind(window)||((fn)=>setTimeout(fn,0));
 function visible(el){const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden'&&!!el.getClientRects().length&&el.getBoundingClientRect().width>4;}
 function directText(el){
   // Text inside buttons with icons/subtitles may be laid out separately.
   const children=[...el.children].filter(x=>getComputedStyle(x).display!=='none');
   if(children.length>1)return '';
   return (el.textContent||'').replace(/\s+/g,' ').trim();
 }
 function fit(el){
   if(!el.isConnected||!visible(el))return;
   const raw=directText(el);
   if(!raw)return;
   let rec=data.get(el);
   if(!rec){rec={inlineFont:el.style.getPropertyValue('font-size'),priority:el.style.getPropertyPriority('font-size')};data.set(el,rec);}
   if(rec.inlineFont)el.style.setProperty('font-size',rec.inlineFont,rec.priority);else el.style.removeProperty('font-size');
   el.classList.remove('rf49-compact-wrap');
   const s=getComputedStyle(el);
   const base=parseFloat(s.fontSize);if(!Number.isFinite(base)||base<9)return;
   const box=el.getBoundingClientRect();
   const cw=box.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)-parseFloat(s.borderLeftWidth)-parseFloat(s.borderRightWidth);
   if(cw<20)return;
   // Canvas measures real Japanese glyphs and letter spacing without forcing DOM layout thrashing.
   const canvas=fit._canvas||(fit._canvas=document.createElement('canvas'));
   const ctx=canvas.getContext('2d');if(!ctx)return;
   ctx.font=s.fontStyle+' '+s.fontWeight+' '+base+'px '+s.fontFamily;
   const spacing=parseFloat(s.letterSpacing)||0;
   const required=ctx.measureText(raw).width+Math.max(0,raw.length-1)*spacing;
   if(required>cw+1){
     const min=el.matches('.label,#res-title,#skillname .sn-name,#cutin .ci-title')?14:el.matches('.card b,.party-slot-head strong')?12:11;
     const target=Math.max(min,base*Math.max(0.1,(cw-2)/required));
     if(target+0.5<base){el.style.setProperty('font-size',target.toFixed(2)+'px','important');}
     if(required*target/base>cw+2)el.classList.add('rf49-compact-wrap');
   }
 }
 function viewport(){
  const vv=window.visualViewport;
  const w=Math.round(vv?.width||window.innerWidth||root.clientWidth);
  const h=Math.round(vv?.height||window.innerHeight||root.clientHeight);
  if(w!==lastWidth||h!==lastHeight){
   lastWidth=w;lastHeight=h;
   root.style.setProperty('--rf49-view-height',h+'px');
   root.classList.toggle('rf49-phone',w<=600);
   root.classList.toggle('rf49-short',h<=560);
   root.classList.toggle('rf49-landscape',w>h);
  }
  const editor=document.querySelector('#rf45-layout-editor:not([hidden]) .rf45-editor-head');
  if(editor)root.style.setProperty('--rf49-editor-head-height',Math.min(h*.31,editor.getBoundingClientRect().height+10)+'px');
 }
 function run(){
  scheduled=false;viewport();
  const nodes=ui.querySelectorAll(compactSelectors);
  let i=0;
  for(const el of nodes){if(++i>640)break;fit(el);}
 }
 function schedule(){
  if(scheduled)return;
  scheduled=true;
  raf(run);
 }
 observer=new MutationObserver((changes)=>{
   // Rebuild after visible screen changes and dynamically inserted shop/character cards.
   // Avoid looping on font-size writes by not watching style/class on child labels.
   if(changes.some(c=>c.type==='childList'||(c.type==='attributes'&&c.target.classList?.contains('screen'))))schedule();
 });
 observer.observe(ui,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
 let rObserver=null;
 if('ResizeObserver' in window){rObserver=new ResizeObserver(schedule);rObserver.observe(root);}
 window.addEventListener('resize',schedule,{passive:true});
 window.addEventListener('orientationchange',schedule,{passive:true});
 window.visualViewport?.addEventListener('resize',schedule,{passive:true});
 document.addEventListener('visibilitychange',schedule);
 document.fonts?.ready?.then(schedule);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
 // Read-only troubleshooting, without logging personal data or needing devtools to run the game.
 window.rf49LayoutDiagnostics=()=>{
  const screen=document.querySelector('#ui .screen.on');
  if(!screen)return {screen:null};
  const vw=document.documentElement.clientWidth;
  const bad=[...screen.querySelectorAll('button,img,.card,.label,.portal-controls,input,select')]
   .filter(el=>visible(el)&&((el.getBoundingClientRect().left<-4)||(el.getBoundingClientRect().right>vw+4)))
   .slice(0,20).map(el=>({tag:el.tagName,id:el.id,className:typeof el.className==='string'?el.className.slice(0,45):''}));
  return {screen:screen.id,viewport:[vw,window.innerHeight],outOfBounds:bad};
 };
})();
