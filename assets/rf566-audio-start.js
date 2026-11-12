/* Riftfall Arena V55.16 — best-effort autoplay for all BGM transitions.
 * Browsers may block sound without a user gesture; do not bypass restrictions.
 * Captures the *same* title Audio instance that main.js owns. No duplicate track.
 * Once the user genuinely interacts, main.js unlockAudio() handles every BGM.
 */
(()=>{
 'use strict';
 if(window.__rf566AudioStart)return;
 window.__rf566AudioStart=true;
 const Native=window.Audio;
 if(typeof Native!=='function')return;
 let titleAudio=null,attempted=false,playing=false,blocked=false;
 const safeAutoplay=()=>{
   if(!titleAudio || !document.body || document.hidden || document.visibilityState==='hidden')return;
   if(!document.querySelector('#scr-press.on,#scr-title.on'))return;
   if(!titleAudio.paused){playing=true;return;}
   if(attempted)return;
   attempted=true;
   let result;
   try{result=titleAudio.play();}
   catch(e){blocked=true;showHint();return;}
   if(result&&typeof result.then==='function')result.then(()=>{
     playing=true;blocked=false;hideHint();
   }).catch((error)=>{
     blocked=true;
     if(error?.name==='NotAllowedError')showHint();
   });
 };
 function showHint(){
   if(!blocked)return;
   let el=document.getElementById('rf566-audio-gesture');
   if(!el){el=document.createElement('div');el.id='rf566-audio-gesture';el.textContent='音楽を有効にするには画面をタップ';document.body?.append(el);}
 }
 function hideHint(){document.getElementById('rf566-audio-gesture')?.remove();}
 function AudioV566(...args){
   const element=new Native(...args);
   const src=String(args[0]||'') || element.currentSrc || element.src || '';
   if(/(?:^|\/)(?:title-theme|aishiteirukara)\.mp3(?:[?#]|$)/i.test(src)){
     titleAudio=element;
     if(document.readyState!=='loading')queueMicrotask(safeAutoplay);
   }
   return element;
 }
 AudioV566.prototype=Native.prototype;
 try{Object.setPrototypeOf(AudioV566,Native)}catch{}
 window.Audio=AudioV566;
 document.addEventListener('DOMContentLoaded',()=>queueMicrotask(safeAutoplay),{once:true});
 window.addEventListener('load',safeAutoplay,{once:true});
 window.addEventListener('arkeia-boot-ready',safeAutoplay,{once:true});
 // A *real* user gesture unlocks every BGM in the main engine, not this wrapper.
 // Do not synthesize an input event (that would be blocked by mobile browsers).
 const onGesture=()=>{hideHint();blocked=false;};
 window.addEventListener('pointerdown',onGesture,{capture:true,passive:true});
 window.addEventListener('keydown',onGesture,{capture:true,passive:true});
 document.addEventListener('visibilitychange',()=>{
   if(document.hidden){attempted=false;hideHint();}
   else if(!playing){attempted=false;setTimeout(safeAutoplay,120);}
 },{passive:true});
 window.RF566AutoAudio={get autoplaySucceeded(){return playing},get requiresGesture(){return blocked},tryAutoplay(){attempted=false;safeAutoplay();}};
})();
