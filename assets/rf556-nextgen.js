/* RIFTFALL ARENA V55.6: non-destructive UI experience layer.
   All event handlers of game modes remain in the original scripts. */
(() => {
 'use strict';
 if(window.__rf556NextgenUI) return;
 window.__rf556NextgenUI = true;
 const root=document.documentElement, storageKey='rf556-visual-profile';
 const reducedMotion=matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const coarse=matchMedia?.('(pointer: coarse)')?.matches;
 const lowMemory=(Number(navigator.deviceMemory)||8)<=4;
 const highCost=!!navigator.connection?.saveData;
 const defaultProfile=(coarse || lowMemory || highCost)?'balanced':'quality';
 const profiles=new Set(['quality','balanced','economy']);
 function getProfile(){try{const p=localStorage.getItem(storageKey);return profiles.has(p)?p:defaultProfile;}catch{return defaultProfile;}}
 let profile=getProfile();
 function applyProfile(){
   root.dataset.rf556UiQuality=profile==='quality'?'high':profile==='balanced'?'medium':'low';
   root.classList.toggle('rf556-reduced-motion',!!reducedMotion);
   window.RF556Graphics={
     profile:()=>profile,
     spriteLimit:()=>profile==='economy'?(coarse?8:16):profile==='balanced'?(coarse?18:34):(coarse?26:58),
     fieldDetail:()=>profile==='economy'?(coarse?6:10):profile==='balanced'?(coarse?10:16):(coarse?14:24),
     effectsEnabled:()=>profile!=='economy',
   };
   window.dispatchEvent(new CustomEvent('rf556-visual-quality',{detail:{profile}}));
 }
 function setProfile(p){if(!profiles.has(p))return;profile=p;try{localStorage.setItem(storageKey,p);}catch{};applyProfile();}
 applyProfile();
 const svg={
   story:'<path d="M5 5.5h5.1c1 0 1.7.5 1.9 1.2.2-.7.9-1.2 1.9-1.2H19v13h-5.1c-1 0-1.7.3-1.9.9-.2-.6-.9-.9-1.9-.9H5z"/><path d="M12 7v11"/>',
   cpu:'<path d="M4 20 18 6l2-2-3 1-13 13zM14 9l2 2M9 14l2 2"/><path d="m6 17-2 4 4-2"/>',
   duo:'<circle cx="8" cy="7" r="3"/><circle cx="17" cy="9" r="2.6"/><path d="M2.5 20v-3c0-3 2.4-5.3 5.5-5.3s5.5 2.3 5.5 5.3v3zM14.2 14.5c3.8-2.2 7.3 1.4 7.3 5.5"/>',
   'online-vs':'<path d="M4 5l16 14M20 5 4 19M4 5l5 1-3 5M20 5l-5 1 3 5M4 19l5-1-3-5M20 19l-5-1 3-5"/>',
   'online-coop':'<circle cx="6" cy="8" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="12" cy="6" r="2.5"/><path d="M1 19v-2c0-2.4 2-4.4 4.5-4.4M23 19v-2c0-2.4-2-4.4-4.5-4.4M5.5 20v-2c0-3.1 2.9-5.5 6.5-5.5s6.5 2.4 6.5 5.5v2z"/>',
   event:'<path d="M12 2 4.5 13h5.2l-1 9L20 9h-6l1-7z"/>',
   infinite:'<path d="M4.5 21V8L12 3l7.5 5v13H4.5zM8 11h8M8 14h8M8 17h8M11 21v-4h2v4"/>',
   castle:'<path d="M2 21h20M4 21V9h3V5h3v4h4V5h3v4h3v12M8 21v-6h8v6M4 13h16"/>',
   adventure:'<path d="m3 17 5-8 4 5 3-6 6 10M3 21h18M5 9l2-4 2 4M15 5l2-3 2 3"/>',
 };
 const icon=(path)=>`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
 function annotateModes(){
   const home=document.getElementById('scr-title');if(!home)return;
   for(const button of home.querySelectorAll('.mode-tile')){
     if(button.dataset.rf556Icon)continue;
     const path=svg[button.dataset.go]|| (button.id==='btn-adventure-mode'?svg.adventure:null);if(!path)continue;
     const box=button.querySelector('.mode-icon');if(!box)continue;
     box.replaceChildren();box.innerHTML=icon(path);
     box.setAttribute('aria-hidden','true');button.dataset.rf556Icon='1';
   }
 }
 function makeSettings(){
   const screen=document.getElementById('scr-options');if(!screen || document.getElementById('rf556-quality'))return;
   const target=screen.querySelector('.inner')||screen;
   const row=document.createElement('section');row.className='rf556-setting';
   const title=document.createElement('label');title.htmlFor='rf556-quality';title.textContent='映像品質・CGエフェクト';
   const p=document.createElement('p');p.textContent='スマホの発熱やフリーズがある場合は「標準」または「省電力」を選択。バトルの技の強さや攻撃判定は変わりません。';
   const select=document.createElement('select');select.id='rf556-quality';
   for(const [v,t] of [['quality','最高品質（高性能PC向け）'],['balanced','標準（スマホ推奨）'],['economy','省電力（軽量化）']]){
     const o=document.createElement('option');o.value=v;o.textContent=t;select.append(o);
   }
   select.value=profile;select.addEventListener('change',()=>setProfile(select.value));
   const note=document.createElement('p');note.id='rf556-quality-note';note.textContent='表示に応じたCG粒子数を調節します。通信・セーブ・役職・キャラクター能力は変更しません。';
   row.append(title,select,p,note);
   const old=screen.querySelector('#opt-diff');
   if(old?.parentElement)old.parentElement.insertBefore(row,old.nextSibling);else target.append(row);
 }
 let repaint=false;
 function scan(){
   if(repaint)return;repaint=true;
   requestAnimationFrame(()=>{repaint=false;annotateModes();makeSettings();});
 }
 function setup(){
   document.body.classList.add('rf556-nextgen');
   annotateModes();makeSettings();
   const selected=document.getElementById('scr-title');
   if(selected){new MutationObserver(changes=>{if(changes.some(c=>c.type==='childList'))scan();}).observe(selected,{childList:true,subtree:false});}
   const settings=document.getElementById('scr-options');
   if(settings){new MutationObserver(changes=>{if(changes.some(c=>c.type==='childList'))scan();}).observe(settings,{childList:true,subtree:false});}
   // Keep a stable keyboard-free available-height variable; never force viewport zoom.
   let last='';const update=()=>{
     const vv=window.visualViewport;
     const h=Math.round(vv?.height||window.innerHeight);
     const keyboard=!!document.activeElement?.matches?.('input:not([type="range"]),textarea,[contenteditable="true"]');
     const next=`${h}px:${keyboard}`;if(next===last)return;last=next;
     root.style.setProperty('--rf556-visible-height',`${h}px`);
     root.classList.toggle('rf556-input-focus',keyboard);
   };
   window.visualViewport?.addEventListener('resize',update,{passive:true});
   window.addEventListener('orientationchange',update,{passive:true});
   window.addEventListener('resize',update,{passive:true});
   document.addEventListener('focusin',update,{passive:true});
   document.addEventListener('focusout',()=>requestAnimationFrame(update),{passive:true});
   update();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
