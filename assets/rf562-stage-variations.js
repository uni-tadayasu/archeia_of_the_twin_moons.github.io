/* Riftfall Arena V55.12 — Immersive stage variety and safe presentation.
   No changes to combat simulation, ranked scoring, network code or save format. */
(()=>{
 'use strict';
 if(window.__rf562StageReady)return;
 window.__rf562StageReady=true;
 const $=s=>document.querySelector(s);
 const read=(store,key,defaultValue)=>{try{return window[store].getItem(key)??defaultValue}catch{return defaultValue}};
 const write=(store,key,value)=>{try{window[store].setItem(key,value)}catch{}};
 const SELECT='rf562-scene-choice',MOTION='rf562-stage-motion';
 const themes=['japanese','western','cave','ruins'];
 const names={japanese:['城内広間','月光の大奥','奥御殿の廊下'],western:['騎士の大広間','月光の聖堂','王座の間'],cave:['結晶洞窟','氷晶洞','深炎洞'],ruins:['遺跡の回廊','光降る神殿','月影の祭壇']};
 const kinds={japanese:'和風',western:'洋風',cave:'洞窟',ruins:'遺跡'};
 let lastKey='',queued=false;
 function motion(){const user=read('localStorage',MOTION,'auto');const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;return user==='off'||(user==='auto'&&reduced)?'off':'on'}
 function getSelector(){return $('#rf561-infinite-theme')}
 function chosen(){const v=read('localStorage',SELECT,'auto');return ['auto','1','2','3'].includes(v)?v:'auto'}
 function floorNumber(){
  const value=($('#rf552-endless-hud')?.textContent||'').replace(/,/g,'');
  const m=value.match(/第\s*([0-9]+)\s*層/u);
  return m?Math.max(1,Number(m[1])):1;
 }
 function castleFloor(){
  const headings=[...document.querySelectorAll('#castle-content h2,#castle-content h3')];
  const heading=headings.find(el=>/防衛ダンジョン/.test(el.textContent||''));
  const value=(heading?.textContent||'').replace(/,/g,'');
  const m=value.match(/第\s*([0-9]+)\s*[\/／]/u);
  return m?Math.max(1,Number(m[1])):1;
 }
 function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h>>>0}
 function activeTheme(){
  const body=document.body;
  for(const theme of themes)if(body.classList.contains('rf561-scene-'+theme))return theme;
  return null;
 }
 function raidStyle(){
  const host=$('#castle-content');
  const stage=host?.querySelector('.rf561-raid-scene');
  if(!stage)return null;
  // Prefer the targeted castle's style if the user is currently viewing it.
  const style=stage.classList.contains('west')?'western':stage.classList.contains('wa')?'japanese':null;
  if(style)write('sessionStorage','rf562-last-raid-style',style);
  return style||read('sessionStorage','rf562-last-raid-style','japanese');
 }
 function regionKey(){return $('#field-region')?.textContent?.trim()||''}
 function variationFor(theme){
  if(theme==='japanese'||theme==='western'){
   if(raidStyle() && $('#scr-castle')?.classList.contains('on'))return (castleFloor()-1)%3;
   const selected=chosen();
   return selected!=='auto'?Number(selected)-1:(floorNumber()-1)%3;
  }
  return hash(regionKey())%3;
 }
 function ensureChooser(){
  const host=getSelector();if(!host||$('#rf562-variant-picker'))return;
  const outer=document.createElement('div');outer.id='rf562-variant-picker';
  const label=document.createElement('label');label.htmlFor='rf562-stage-select';label.textContent='CGステージ演出';
  const sel=document.createElement('select');sel.id='rf562-stage-select';sel.setAttribute('aria-label','無限天守の城内背景バリエーション');
  for(const [value,text] of [['auto','自動（階層ごと）'],['1','第一景'],['2','第二景'],['3','第三景']]){
   const o=document.createElement('option');o.value=value;o.textContent=text;sel.append(o);
  }
  sel.value=chosen();sel.addEventListener('change',()=>{write('localStorage',SELECT,sel.value);schedule();});
  const caption=document.createElement('small');caption.textContent='和風／洋風の選択を保持。背景演出のみ変更';
  outer.append(label,sel,caption);host.append(outer);
  if(!$('#rf562-stage-name')){
   const output=document.createElement('output');output.id='rf562-stage-name';output.setAttribute('aria-live','polite');host.append(output);
  }
 }
 function ensureOptions(){
  const options=$('#scr-options .inner');if(!options||$('#rf562-motion-panel'))return;
  const box=document.createElement('section');box.id='rf562-motion-panel';
  const title=document.createElement('strong');title.textContent='ダンジョン背景演出';
  const sel=document.createElement('select');sel.id='rf562-motion-select';sel.setAttribute('aria-label','ステージ背景の動き');
  for(const [value,text] of [['auto','自動（端末設定を尊重）'],['on','奥行き演出を有効にする'],['off','省電力・静止表示']]){
   const o=document.createElement('option');o.value=value;o.textContent=text;sel.append(o);
  }
  sel.value=read('localStorage',MOTION,'auto');
  sel.addEventListener('change',()=>{write('localStorage',MOTION,sel.value);schedule();});
  const note=document.createElement('small');note.textContent='映像のみ変更し、当たり判定やキャラ能力には影響しません';
  box.append(title,sel,note);options.append(box);
 }
 function status(){
  const inf=$('#rf552-endless-hud');
  const root=document.getElementById('rf561-scene-backdrop');
  const visible=inf && !inf.hidden && getComputedStyle(inf).display!=='none';
  const theme=activeTheme();
  const inside=!!root && document.body.classList.contains('rf561-scene-on');
  const castleRaid=!!$('#castle-content .rf561-raid-scene')&&$('#scr-castle')?.classList.contains('on');
  if(castleRaid){
   const style=raidStyle()||'japanese';
   const floor=castleFloor();
   return {theme:style,variant:(floor-1)%3,floor,castleRaid:true};
  }
  if(!inside||!theme)return null;
  const floor=visible?floorNumber():0;
  return {theme,variant:variationFor(theme),floor,castleRaid:false};
 }
 function apply(){
  queued=false;ensureChooser();ensureOptions();
  const cur=status();
  const state=cur?`${cur.theme}:${cur.variant}:${cur.floor}:${motion()}`:'inactive';
  if(state===lastKey)return;lastKey=state;
  for(const theme of themes)document.body.classList.remove('rf562-'+theme+'-1','rf562-'+theme+'-2','rf562-'+theme+'-3');
  const raid=$('#castle-content .rf561-raid-scene');
  if(raid){raid.dataset.rf562Variant=String(cur?.castleRaid?cur.variant+1:(castleFloor()-1)%3+1);}
  if(cur){
   document.body.classList.add(`rf562-${cur.theme}-${cur.variant+1}`);
   document.body.dataset.rf562Stage=`${cur.theme}-${cur.variant+1}`;
   const host=getSelector();const note=host?.querySelector('#rf562-stage-name');
   if(note)note.textContent=`${kinds[cur.theme]}・${names[cur.theme][cur.variant]}`;
  }else delete document.body.dataset.rf562Stage;
  document.body.classList.toggle('rf562-motion-off',motion()==='off');
  document.body.classList.toggle('rf562-motion-on',motion()==='on');
 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(apply)}
 function boot(){
  ensureChooser();ensureOptions();
  const host=getSelector();if(host&&!$('#rf562-stage-name')){
   const status=document.createElement('output');status.id='rf562-stage-name';status.setAttribute('aria-live','polite');host.append(status);
  }
  const infinite=$('#rf552-endless-hud');
  if(infinite)new MutationObserver(schedule).observe(infinite,{attributes:true,characterData:true,childList:true,subtree:true,attributeFilter:['hidden','style']});
  const castle=$('#castle-content');
  if(castle)new MutationObserver(schedule).observe(castle,{childList:true,subtree:false});
  const region=$('#field-region');
  if(region)new MutationObserver(schedule).observe(region,{characterData:true,childList:true,subtree:true});
  for(const ev of ['resize','orientationchange','pageshow'])window.addEventListener(ev,schedule,{passive:true});
  document.addEventListener('visibilitychange',schedule,{passive:true});
  document.addEventListener('click',schedule,{passive:true});
  setInterval(()=>{if(!document.hidden)schedule()},1100);
  window.RF562Stage={refresh:schedule,choose:(value)=>{if(['auto','1','2','3'].includes(String(value))){write('localStorage',SELECT,String(value));const x=$('#rf562-stage-select');if(x)x.value=String(value);schedule();}}};
  schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
