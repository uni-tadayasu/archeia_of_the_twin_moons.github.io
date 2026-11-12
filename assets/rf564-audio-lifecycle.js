/* Riftfall Arena V55.14 — mobile background-audio safety.
 * Installed BEFORE the game's main module. Intercepts every HTML media play
 * and tracks AudioContext instances to prevent music continuing after tab/app hides.
 * Never changes sound selection, volume, save keys, role keys or sync state.
 */
(()=>{
  'use strict';
  if(window.__rf564AudioLifecycle) return;
  const media=new Set();
  const contexts=new Set();
  const NativeAudio=window.Audio;
  const mediaProto=window.HTMLMediaElement?.prototype;
  const nativePlay=mediaProto?.play;
  const nativePause=mediaProto?.pause;
  let blocked=document.hidden || document.visibilityState==='hidden';
  let closed=false;
  let prevented=0;
  const isBlocked=()=>blocked||closed||document.hidden||document.visibilityState==='hidden';
  const safePause=(element)=>{try{
    if(element && typeof element.pause==='function'){
      if(nativePause && element instanceof HTMLMediaElement) nativePause.call(element);
      else element.pause();
    }
  }catch{}};
  if(mediaProto && typeof nativePlay==='function'){
    mediaProto.play=function(...args){
      media.add(this);
      if(isBlocked()){
        prevented++;
        safePause(this);
        // Native play() normally returns a Promise; keep that contract for callers.
        return Promise.resolve();
      }
      const result=nativePlay.apply(this,args);
      if(result && typeof result.then==='function')result.then(()=>{
        // A play() promise may resolve AFTER the app has been backgrounded.
        if(isBlocked())safePause(this);
      },()=>{});
      return result;
    };
  }
  if(typeof NativeAudio==='function'){
    function GuardedAudio(...args){
      // The original game's title and story-intro BGM use one shared MP3.
      // Redirect that one title file to the user-supplied menu theme without
      // replacing the main.js module or affecting battle/field/boss tracks.
      if(typeof args[0]==='string' && /(?:^|\/)title-theme\.mp3(?:[?#]|$)/i.test(args[0])){
        args[0]='assets/audio/aishiteirukara.mp3?v=20261112-v564b-menu-20261112';
      }
      const el=new NativeAudio(...args);
      media.add(el);
      return el;
    }
    GuardedAudio.prototype=NativeAudio.prototype;
    try{Object.setPrototypeOf(GuardedAudio,NativeAudio)}catch{}
    window.Audio=GuardedAudio;
  }
  const wired=new Set();
  for(const name of ['AudioContext','webkitAudioContext']){
    const Base=window[name];
    if(typeof Base!=='function')continue;
    const proto=Base.prototype;
    if(!wired.has(proto)){
      wired.add(proto);
      const originalResume=proto.resume;
      if(typeof originalResume==='function'){
        try{proto.resume=function(...args){
          contexts.add(this);
          if(isBlocked()){
            try{this.suspend?.().catch?.(()=>{});}catch{}
            return Promise.resolve();
          }
          return originalResume.apply(this,args);
        };}catch{}
      }
    }
    function GuardedContext(...args){
      const ctx=new Base(...args);
      contexts.add(ctx);
      if(isBlocked())try{ctx.suspend?.().catch?.(()=>{})}catch{}
      return ctx;
    }
    GuardedContext.prototype=proto;
    try{Object.setPrototypeOf(GuardedContext,Base)}catch{}
    try{window[name]=GuardedContext;}catch{}
  }
  function halt(reason){
    blocked=true;
    for(const el of document.querySelectorAll?.('audio,video')||[])media.add(el);
    for(const el of media)safePause(el);
    for(const ctx of contexts){
      if(ctx.state==='closed'||ctx.state==='suspended')continue;
      try{ctx.suspend?.().catch?.(()=>{})}catch{}
    }
    try{window.speechSynthesis?.cancel?.()}catch{}
    document.documentElement.dataset.rf564Audio='paused';
    window.dispatchEvent(new CustomEvent('rf564:audio-paused',{detail:{reason}}));
  }
  function wake(){
    if(closed || document.hidden || document.visibilityState==='hidden')return;
    if(typeof document.hasFocus==='function' && !document.hasFocus())return;
    blocked=false;
    document.documentElement.dataset.rf564Audio='ready';
    // The game already restores the selected BGM on visibility/focus.
    // Restore Web Audio's context without forcibly replaying stale BGM elements.
    for(const ctx of contexts){
      if(ctx.state==='suspended'){
        try{ctx.resume?.().catch?.(()=>{})}catch{}
      }
    }
    window.dispatchEvent(new Event('rf564:audio-ready'));
  }
  document.addEventListener('visibilitychange',()=>document.hidden?halt('visibility-hidden'):wake(),{capture:true});
  window.addEventListener('pagehide',()=>{closed=true;halt('pagehide');},{capture:true});
  window.addEventListener('pageshow',()=>{closed=false;if(document.hidden)halt('pageshow-hidden');else wake();},{capture:true});
  window.addEventListener('blur',()=>halt('window-blur'),{capture:true});
  window.addEventListener('focus',wake,{capture:true});
  document.addEventListener('freeze',()=>halt('freeze'),{capture:true});
  document.addEventListener('resume',wake,{capture:true});
  // Some mobile browsers skip window.blur when entering recent-apps view;
  // this also handles delayed play() calls and tab discard suspensions.
  window.addEventListener('beforeunload',()=>{closed=true;halt('beforeunload')},{capture:true});
  document.addEventListener('pointerdown',()=>{if(!document.hidden)wake();},{capture:true,passive:true});
  window.__rf564AudioLifecycle={version:'55.14',halt,wake,
    get paused(){return isBlocked()},get registeredMedia(){return media.size},
    get registeredContexts(){return contexts.size},get preventedPlays(){return prevented}};
  if(isBlocked())halt('initial-hidden');
})();
