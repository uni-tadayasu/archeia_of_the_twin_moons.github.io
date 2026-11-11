/* Riftfall Arena V55.8 — accessible, responsive next-gen illustration UI.
 * Presentation only. No writes to game save / server / economy / battle rules.
 * All game navigation continues to use the original controls and listeners.
 */
(() => {
 'use strict';
 if (window.__rf558UltimateUI) return;
 window.__rf558UltimateUI=true;
 const KEY='rf558-visual-settings-v1';
 const STORAGE_VERSION=1;
 const root=document.documentElement;
 const reduceMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
 const mobile=window.matchMedia?.('(pointer: coarse)').matches||false;
 const cssSupports=Boolean(window.CSS?.supports);
 const presets=new Set(['cinema','vivid','calm']);
 const defaults={preset:'cinema',density:'comfortable',scale:100,contrast:false,motion:reduceMotion?'reduced':'normal'};
 const $=(selector,scope=document)=>scope.querySelector(selector);
 const $$=(selector,scope=document)=>[...scope.querySelectorAll(selector)];
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const later=cb=>typeof requestAnimationFrame==='function'?requestAnimationFrame(cb):setTimeout(cb,0);
 let opts={...defaults},pending=false,hudObserver=null,layoutTimer=0;
 function restore(){
  try{
   const got=JSON.parse(localStorage.getItem(KEY)||'null');
   if(got?.v===STORAGE_VERSION){
    const src=got.settings||{};
    if(presets.has(src.preset))opts.preset=src.preset;
    if(['comfortable','compact'].includes(src.density))opts.density=src.density;
    if(Number.isFinite(src.scale))opts.scale=clamp(Math.round(src.scale),90,120);
    opts.contrast=src.contrast===true;
    if(['normal','reduced'].includes(src.motion))opts.motion=src.motion;
   }
  }catch{ /* privacy / disabled storage: defaults remain */ }
 }
 function persist(){
  try{localStorage.setItem(KEY,JSON.stringify({v:STORAGE_VERSION,settings:opts}));}catch{}
 }
 function quality(){
  try{return window.RF556Graphics?.profile?.()||'balanced';}catch{return 'balanced';}
 }
 function apply(){
  root.dataset.rf558Tone=opts.preset;
  root.style.setProperty('--rf8-size',String(opts.scale/100));
  document.body?.classList.toggle('rf558-compact',opts.density==='compact');
  document.body?.classList.toggle('rf558-high-contrast',opts.contrast);
  document.body?.classList.toggle('rf558-no-effects',opts.motion==='reduced'||reduceMotion);
  document.body?.classList.toggle('rf558-low-power',quality()==='economy');
  const form=$('#rf558-controls');
  if(form){
   const tone=$('#rf558-tone',form);if(tone && tone.value!==opts.preset)tone.value=opts.preset;
   const density=$('#rf558-density',form);if(density && density.value!==opts.density)density.value=opts.density;
   const scale=$('#rf558-scale',form);if(scale && scale.value!==String(opts.scale))scale.value=String(opts.scale);
   const output=$('#rf558-scale-value',form);if(output)output.textContent=opts.scale+'％';
   const contrast=$('#rf558-contrast',form);if(contrast)contrast.checked=opts.contrast;
   const motion=$('#rf558-motion',form);if(motion)motion.checked=opts.motion==='reduced';
  }
 }
 function iconMarkup(kind){
  // All icons are vector paths, not emoji. No external font or library.
  const paths={
   story:'<path d="M4 5.5c2-1.2 5.4-1.4 8 0v13c-2.6-1.3-6-1.1-8 0zm8 0c2.5-1.5 5.8-1.2 8 0v13c-2.2-1.2-5.5-1.5-8 0z"/>',
   sword:'<path d="M4 20l15-15-1.8-1.8L2.2 18.2zM14 8l3 3M6.5 17.5l2.5 2.5"/>',
   duet:'<circle cx="7.2" cy="7" r="2.7"/><circle cx="16.8" cy="7" r="2.7"/><path d="M2.8 20v-4c0-2.5 1.9-4.3 4.4-4.3s4.2 1.8 4.2 4.3v4m1-3c0-2.2 2-4.2 4.4-4.2s4.4 2 4.4 4.2v3"/>',
   duel:'<path d="M4 4l16 16M20 4 4 20M4 4h5M4 4v5m16-5h-5m5 0v5M4 20h5m-5 0v-5m16 5h-5m5 0v-5"/>',
   online:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18m-9-9c-3 3-3.5 7-3.5 9s.5 6 3.5 9m0-18c3 3 3.5 7 3.5 9s-.5 6-3.5 9"/>',
   event:'<path d="M12 2c4 4 2 6 4.5 9.5C19 15.5 16.8 21 12 22c-4.6 0-7-4.2-4.7-8 2-3.3 3-5.2 4.7-12zM12 11c-1.8 2.2-3.6 3.6-2.5 6 1.4 2.1 4.2 1.9 5.1 0 .9-2-1.7-3.7-2.6-6z"/>',
   infinite:'<path d="M12 5V2m-7 5V4m14 3V4M5 9h14M5 9v12m14-12v12M4 21h16M8 21v-7h8v7"/>',
   adventure:'<path d="m12 2 8 8-8 12-8-12zM4 10h16M12 2v20"/>',
   castle:'<path d="M2 22V8h4V3h4v5h4V3h4v5h4v14M2 12h20M9 22v-6h6v6M2 22h20"/>',
   medal:'<circle cx="12" cy="14" r="5"/><path d="m7 3 3 5m7-5-3 5M5 3h4l3 5 3-5h4m-7 9v4m-2-2h4"/>',
   shield:'<path d="M12 2 4 5v6c0 5 3.4 8.6 8 11 4.6-2.4 8-6 8-11V5zM9 12l2 2 4-4"/>',
   forge:'<path d="M14 4 4 14m0-5 6 6m-6 3 3 3m6-17 7 7m-7-1 3 3M3 21h5M15 3l6 6"/>',
   bag:'<path d="M4 8h16l-1 13H5zM8 8V6a4 4 0 0 1 8 0v2M8 13v2m8-2v2"/>',
   mail:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>',
   settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2m0-14-2 2M7 17l-2 2"/>',
   chat:'<path d="M3 4h18v13H8l-5 4zM7 9h10m-10 4h7"/>',
   user:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/>',
   star:'<path d="m12 2 2.8 6.1L22 9l-5.3 4.8L18 21l-6-3.5L6 21l1.3-7.2L2 9l7.2-.9z"/>',
   bolt:'<path d="M13 2 5 13h6l-1 9 9-12h-6z"/>',
   home:'<path d="m3 11 9-7 9 7v10h-7v-7h-4v7H3z"/>',
   moon:'<path d="M21 14a9 9 0 0 1-11-11 9 9 0 1 0 11 11z"/>'
  };
  const geometry=paths[kind]||paths.star;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" aria-hidden="true" focusable="false">'+geometry+'</svg>';
 }
 function addIcons(){
  const modes={story:'story',cpu:'sword',duo:'duet','online-vs':'duel','online-coop':'online',event:'event',infinite:'infinite'};
  for(const button of $$('.portal-modes .mode-tile')){
   if(button.dataset.rf558Icon==='1')continue;
   const name=modes[button.dataset.go]|| (button.id==='btn-adventure-mode'?'adventure':null);
   if(!name)continue;
   const icon=button.querySelector('.mode-icon');
   if(icon){icon.innerHTML=iconMarkup(name);icon.setAttribute('aria-hidden','true');}
   button.dataset.rf558Icon='1';
  }
  const services={'rf552-infinite-rank':'medal','btn-castle':'castle','btn-forge':'forge','btn-shop':'bag','btn-mailbox':'mail','btn-options':'settings','btn-chief-mail':'mail','btn-evmaker':'event','btn-invade':'shield'};
  for(const [id,icon] of Object.entries(services)){
   const button=document.getElementById(id);
   if(!button ||button.dataset.rf558Icon==='1')continue;
   const container=button.querySelector('.service-icon');
   if(container){container.innerHTML=iconMarkup(icon);container.setAttribute('aria-hidden','true');}
   button.dataset.rf558Icon='1';
  }
  const brand=$('#scr-title .brand-seal');
  if(brand && !brand.dataset.rf558Icon){brand.textContent='';brand.dataset.rf558Icon='1';brand.setAttribute('aria-hidden','true');}
 }
 function addModelRetry(){
  const tools=$('#scr-select .select-tools');
  if(!tools||$('#rf558-model-refresh'))return;
  const button=document.createElement('button');button.id='rf558-model-refresh';button.type='button';
  button.className='rf558-model-refresh';button.textContent='3Dモデル画像を再取得';
  button.title='表示できなかったキャラクターの実モデル画像を再撮影します';
  button.addEventListener('click',()=>{
   const cards=$$('#select-grid button.card[data-rf556-portrait="fallback"]');
   for(const card of cards)card.removeAttribute('data-rf556-portrait');
   window.RF556Portraits?.refresh?.();
   button.textContent=cards.length?'再読み込みを開始しました':'モデル画像を確認しました';
   setTimeout(()=>{button.textContent='3Dモデル画像を再取得';},1600);
  });
  tools.append(button);
 }
 function annotatePortraits(){
  const cards=$$('#select-grid button.card:not(.stage-tile)');
  for(const card of cards){
   if(card.dataset.rf558Card==='1')continue;
   const img=card.querySelector('img.face');if(!img)continue;
   card.dataset.rf558Card='1';
   img.decoding='async';img.loading='lazy';
   img.addEventListener('error',()=>{card.dataset.rf558Image='unavailable';},{once:true});
   img.addEventListener('load',()=>{card.dataset.rf558Image='ready';},{passive:true});
  }
 }
 function selectNav(){
  const visible=$('#scr-title')?.classList.contains('on');
  if(!visible)return;
  const anchors=$$('#scr-title [data-portal-jump]');
  const scr=$('#scr-title');if(!scr)return;
  let active='portal-start',score=Infinity;
  const top=scr.getBoundingClientRect().top;
  for(const id of ['portal-start','portal-feature','portal-play','portal-services']){
   const el=document.getElementById(id);if(!el)continue;
   const y=el.getBoundingClientRect().top-top;
   const dist=Math.abs(y-95);
   if(dist<score){score=dist;active=id;}
  }
  for(const b of anchors){b.classList.toggle('rf558-nav-selected',b.dataset.portalJump===active);}
  for(const b of $$('#rf557-mobile-nav button')){
   const name=b.textContent.trim();
   const is=(name==='トップ'&&active==='portal-start')||(name==='モード'&&active==='portal-play');
   if(is)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  }
 }
 function densityHUD(){
  const left=$('#hud-left'),right=$('#hud-right');
  if(!left || !right || !document.body)return;
  const n=left.querySelectorAll('.plate').length + right.querySelectorAll('.plate').length;
  document.body.classList.toggle('rf558-crowded',n>=6 || left.querySelectorAll('.plate').length>=4 || right.querySelectorAll('.plate').length>=4);
  left.dataset.rf558Count=String(left.querySelectorAll('.plate').length);
  right.dataset.rf558Count=String(right.querySelectorAll('.plate').length);
 }
 function improveImages(){
  for(const img of $$('#scr-title .world-gallery img')){
   img.decoding='async';img.loading='lazy';
   if(!img.alt)img.alt='ワールドのCG背景';
  }
 }
 function scan(){
  if(pending)return;
  pending=true;
  later(()=>{pending=false;addIcons();addModelRetry();annotatePortraits();densityHUD();selectNav();improveImages();});
 }
 function makeSettings(){
  const scr=$('#scr-options .inner');if(!scr || $('#rf558-controls'))return;
  const panel=document.createElement('section');panel.id='rf558-controls';panel.className='rf558-settings';
  panel.setAttribute('aria-label','CGイラストレーション・表示設定');
  const heading=document.createElement('h3');heading.textContent='画面の見た目を調整';
  const help=document.createElement('p');help.textContent='映像演出・文字サイズ・表示密度のみを変更します。戦闘能力・保存データ・オンラインのルールには影響しません。';
  const row=document.createElement('div');row.className='rf558-row';
  const option=(tag,id,label,choices)=>{
   const wrapper=document.createElement('label');wrapper.htmlFor=id;wrapper.append(document.createTextNode(label));
   const input=document.createElement(tag);input.id=id;
   for(const [value,name] of choices||[]){const opt=document.createElement('option');opt.value=value;opt.textContent=name;input.append(opt);}
   wrapper.append(input);return {wrapper,input};
  };
  const tone=option('select','rf558-tone','CGの色味',[['cinema','映画調・深い陰影'],['vivid','鮮やかなCG'],['calm','落ち着いたCG']]);
  const density=option('select','rf558-density','UIの表示密度',[['comfortable','標準・ゆったり'],['compact','コンパクト']]);
  row.append(tone.wrapper,density.wrapper);
  const scale=option('input','rf558-scale','文字・UIの大きさ');
  scale.input.type='range';scale.input.min='90';scale.input.max='120';scale.input.step='5';
  const value=document.createElement('output');value.id='rf558-scale-value';scale.wrapper.append(value);
  const checks=document.createElement('div');checks.className='rf558-row';
  const checkbox=(id,label)=>{const outer=document.createElement('label');outer.style.display='flex';outer.style.alignItems='center';outer.style.gap='10px';
   const input=document.createElement('input');input.id=id;input.type='checkbox';input.style.minHeight='20px';input.style.width='20px';input.style.flex='none';
   outer.append(input,document.createTextNode(label));return {outer,input};};
  const contrast=checkbox('rf558-contrast','文字を見やすくする');
  const motion=checkbox('rf558-motion','演出の動きを抑える');
  checks.append(contrast.outer,motion.outer);
  const tools=document.createElement('div');tools.className='rf558-tools';
  const reset=document.createElement('button');reset.type='button';reset.textContent='表示を標準に戻す';
  const refresh=document.createElement('button');refresh.type='button';refresh.textContent='表示を再調整';
  tools.append(reset,refresh);
  const status=document.createElement('p');status.id='rf558-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  status.textContent='PC・スマホ両対応。タッチボタンの個別配置は従来の設定を引き継ぎます。';
  panel.append(heading,help,row,scale.wrapper,checks,tools,status);
  const optTitle=scr.querySelector('.label');if(optTitle)optTitle.after(panel);else scr.prepend(panel);
  tone.input.addEventListener('change',()=>{opts.preset=tone.input.value;apply();persist();});
  density.input.addEventListener('change',()=>{opts.density=density.input.value;apply();persist();});
  scale.input.addEventListener('input',()=>{opts.scale=clamp(Number(scale.input.value)||100,90,120);apply();persist();});
  contrast.input.addEventListener('change',()=>{opts.contrast=contrast.input.checked;apply();persist();});
  motion.input.addEventListener('change',()=>{opts.motion=motion.input.checked?'reduced':'normal';apply();persist();});
  reset.addEventListener('click',()=>{opts={...defaults};apply();persist();status.textContent='表示設定を標準に戻しました。';});
  refresh.addEventListener('click',()=>{viewport();scan();status.textContent='画面の位置とサイズを再確認しました。';});
  apply();
 }
 function viewport(){
  const vv=window.visualViewport;
  const editable=document.activeElement?.matches?.('input:not([type=range]):not([type=checkbox]), textarea, select, [contenteditable="true"]') || false;
  const keyboard=mobile && editable && vv && (window.innerHeight-vv.height)>100;
  document.body?.classList.toggle('rf558-keyboard',Boolean(keyboard));
  root.style.setProperty('--rf8-viewport',Math.max(220,Math.round(vv?.height||window.innerHeight))+'px');
 }
 function audit(){
  const screen=$$('.screen.on')[0]||null;
  const nodes=screen?[...screen.querySelectorAll('button,input,select,textarea')].filter(el=>el.getClientRects().length).slice(0,180):[];
  const w=document.documentElement.clientWidth||innerWidth;
  const overflow=nodes.filter(el=>{const r=el.getBoundingClientRect();return r.left<-2||r.right>w+2;});
  return {version:'55.8',screen:screen?.id||'',viewport:[innerWidth,innerHeight],visualViewport:window.visualViewport?[Math.round(window.visualViewport.width),Math.round(window.visualViewport.height)]:null,overflowCount:overflow.length,overflowIds:overflow.map(el=>el.id||el.className||el.tagName).slice(0,15),hud:[Number($('#hud-left')?.dataset.rf558Count||0),Number($('#hud-right')?.dataset.rf558Count||0)],visualQuality:quality()};
 }
 function init(){
  if(!document.body)return;
  document.body.classList.add('rf558-ultimate');
  restore();apply();makeSettings();scan();viewport();
  for(const id of ['hud-left','hud-right','select-grid']){
   const el=document.getElementById(id);if(!el)continue;
   new MutationObserver(scan).observe(el,{childList:true,subtree:id==='select-grid'?false:false});
  }
  for(const id of ['scr-title','scr-select','scr-options']){
   const el=document.getElementById(id);if(!el)continue;
   new MutationObserver(()=>{scan();if(id==='scr-options')makeSettings();}).observe(el,{attributes:true,attributeFilter:['class']});
  }
  const title=$('#scr-title');if(title)title.addEventListener('scroll',()=>{if(!pending)later(selectNav);},{passive:true});
  document.addEventListener('focusin',viewport,true);
  document.addEventListener('focusout',()=>{[180,550].forEach(ms=>setTimeout(viewport,ms));},true);
  window.visualViewport?.addEventListener('resize',viewport,{passive:true});
  window.addEventListener('resize',()=>{clearTimeout(layoutTimer);layoutTimer=setTimeout(()=>{viewport();scan();},80);},{passive:true});
  window.addEventListener('orientationchange',()=>{setTimeout(()=>{viewport();scan();},300);},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan();});
  window.addEventListener('rf556-visual-quality',()=>{apply();scan();});
  window.RF558Ultimate={version:'55.8',settings:()=>({...opts}),audit,refresh:scan};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
