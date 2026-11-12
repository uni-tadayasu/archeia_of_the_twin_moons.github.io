/* V55.11: cosmetic stage adapter. No changes to scoring, characters, or multiplayer. */
(()=>{
'use strict';
const CONTAINER='rf561-scene-backdrop';
const STYLE='rf561-infinite-style';
const RAID='rf561-last-target-style';
const VALID=new Set(['japanese','western']);
const $=s=>document.querySelector(s);
const on=(e,s,f)=>e?.addEventListener(s,f,{passive:s!=='click'});
const modeClasses=['rf561-scene-japanese','rf561-scene-western','rf561-scene-cave','rf561-scene-ruins'];
const safeGet=(which,key)=>{try{return window[which].getItem(key)}catch{return null}};
let theme=safeGet('localStorage',STYLE)==='western'?'western':'japanese';
let lastRaidStyle=safeGet('sessionStorage',RAID)==='west'?'west':'wa';
let lastMode='';
const fieldWords=/洞窟|洞穴|氷窟|地下|坑道|迷宮|王墓|神殿|祠|遺跡|古城|砦|聖堂|水晶宮|神宮|社|塔|cave|dungeon|temple|ruin/i;
const caveWords=/洞窟|洞穴|氷窟|地下|坑道|迷宮|墓|洞|cave|dungeon/i;
function makeLayer(){
 const host=$('#game-container');if(!host)return;
 let layer=document.getElementById(CONTAINER);if(layer)return layer;
 layer=document.createElement('div');layer.id=CONTAINER;layer.setAttribute('aria-hidden','true');
 for(const kind of ['japanese','western','cave','ruins']){const el=document.createElement('div');el.className='rf561-bg '+kind;layer.append(el);}
 host.prepend(layer);return layer;
}
function isShown(el){return !!el&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';}
function apply(themeName){
 const active=!!themeName;
 if(themeName===lastMode && document.body.classList.contains('rf561-scene-on')===active)return;
 lastMode=themeName||'';
 document.body.classList.toggle('rf561-scene-on',active);
 modeClasses.forEach(name=>document.body.classList.toggle(name,name==='rf561-scene-'+themeName));
}
function markRaidStyle(){
 const el=$('#castle-content .cr-castle-scene.cr-west,#castle-content .cr-castle-scene.cr-wa');
 if(el){lastRaidStyle=el.classList.contains('cr-west')?'west':'wa';try{sessionStorage.setItem(RAID,lastRaidStyle)}catch{}}
}
function raidScreen(){
 const host=$('#castle-content');if(!host)return false;
 const heading=[...host.querySelectorAll('h2,h3')].find(el=>/防衛ダンジョン.+第|防衛ダンジョン\s*第/u.test(el.textContent));
 if(!heading)return false;
 if(host.querySelector('.rf561-raid-scene'))return true;
 const style=lastRaidStyle;
 const number=(heading.textContent.match(/第\s*([\d,]+)\s*[/／]\s*([\d,]+)\s*階層/)||[]);
 const layer=document.createElement('figure');layer.className='rf561-raid-scene '+style;
 const cap=document.createElement('figcaption');
 const title=document.createElement('b');title.textContent=style==='wa'?'和風・城内決戦':'洋風・城内決戦';
 const info=document.createElement('span');info.textContent=number.length?`第${number[1]}/${number[2]}階層`:'防衛ダンジョン';
 cap.append(title,info);layer.append(cap);heading.insertAdjacentElement('afterend',layer);
 return true;
}
function ensureInfiniteChoice(){
 const btn=$('[data-go="infinite"]');if(!btn)return;
 const host=btn.closest('#portal-modes,.portal-modes')||btn.parentElement;
 if(!host||$('#rf561-infinite-theme'))return;
 const block=document.createElement('div');block.id='rf561-infinite-theme';
 const b=document.createElement('b');b.textContent='無限天守：城内CG背景';
 const group=document.createElement('div');group.className='rf561-buttons';
 for(const [val,label] of [['japanese','和風'],['western','洋風']]){
  const option=document.createElement('button');option.type='button';option.textContent=label;option.dataset.rf561Theme=val;
  option.setAttribute('aria-pressed',String(theme===val));
  option.addEventListener('click',()=>{theme=val;try{localStorage.setItem(STYLE,val)}catch{};group.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===option)));schedule();});
  group.append(option);
 }
 const note=document.createElement('small');note.textContent='背景のみ変更。階層・残りHP・ランキングはそのまま';
 block.append(b,group,note);host.after(block);
}
function determine(){
 const infinite=$('#rf552-endless-hud');
 // Infinite stage visibility is an authoritative indicator of an active run.
 if(infinite && !infinite.hidden && isShown(infinite))return theme;
 const castle=$('#scr-castle');
 if(castle?.classList.contains('on')){markRaidStyle();raidScreen();return '';} // own castle uses DOM backdrop
 const field=$('#field-hud');
 if(document.body.classList.contains('field-mode')&&isShown(field)){
  const region=($('#field-region')?.textContent||'').trim();
  if(fieldWords.test(region))return caveWords.test(region)?'cave':'ruins';
 }
 return '';
}
let scheduled=false;
function refresh(){
 scheduled=false;makeLayer();ensureInfiniteChoice();
 try{apply(determine());}catch(err){console.warn('[RF561 stage]',err)}
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(refresh)}
function boot(){
 makeLayer();ensureInfiniteChoice();
 const castle=$('#castle-content');
 if(castle){
  const mo=new MutationObserver(()=>schedule());mo.observe(castle,{childList:true,subtree:false});
  on(castle,'click',()=>{markRaidStyle();schedule()});
 }
 const infinite=$('#rf552-endless-hud');
 if(infinite)new MutationObserver(schedule).observe(infinite,{attributes:true,attributeFilter:['hidden']});
 const region=$('#field-region');
 if(region)new MutationObserver(schedule).observe(region,{childList:true,characterData:true,subtree:true});
 on(window,'resize',schedule);on(window,'orientationchange',schedule);
 on(document,'click',schedule);
 document.addEventListener('visibilitychange',schedule,{passive:true});
 // Main game's screen/HUD state is lexical: sample only for state transitions.
 setInterval(schedule,900);
 refresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
