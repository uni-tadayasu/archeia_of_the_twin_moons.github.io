/* Riftfall Arena V55.18 — mobile background-audio safety + uninterrupted foreground UI.
 * Installed BEFORE the game's main module. Intercepts every HTML media play
 * and tracks AudioContext instances to prevent music continuing after tab/app hides.
 * Never changes sound selection, volume, save keys, role keys or sync state.
 */
(()=>{
  'use strict';
  if(window.__rf564AudioLifecycle) return;
  const media=new Set();
  const contexts=new Set();
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
  function releaseMedia(event){
    const el=event.currentTarget;
    if(event.type==='pause' && !el.paused)return;
    media.delete(el);
    el.removeEventListener('pause',releaseMedia);
    el.removeEventListener('ended',releaseMedia);
    el.removeEventListener('error',releaseMedia);
  }
  if(mediaProto && typeof nativePlay==='function'){
    mediaProto.play=function(...args){
      if(isBlocked()){
        prevented++;
        safePause(this);
        // Native play() normally returns a Promise; keep that contract for callers.
        return Promise.resolve();
      }
      const result=nativePlay.apply(this,args);
      if(!media.has(this)){
        media.add(this);
        this.addEventListener('pause',releaseMedia);
        this.addEventListener('ended',releaseMedia);
        this.addEventListener('error',releaseMedia);
      }
      if(result && typeof result.then==='function')result.then(()=>{
        if(isBlocked())safePause(this);
      },()=>{if(this.paused)releaseMedia({currentTarget:this,type:'pause'});});
      return result;
    };
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
    for(const el of document.querySelectorAll?.('audio,video')||[])safePause(el);
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
    // Visible UI focus changes do not count as app backgrounding.
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
  // Clicking controls, opening native UI and focus moving between widgets can
  // transiently dispatch blur even while the game is fully visible. Pausing
  // every Audio element here caused a silent gap for almost every menu action.
  // Real backgrounding is handled by visibilitychange/pagehide/freeze instead.
  window.addEventListener('blur',()=>{
    if(document.hidden || document.visibilityState==='hidden')halt('window-hidden');
  },{capture:true});
  window.addEventListener('focus',wake,{capture:true});
  document.addEventListener('freeze',()=>halt('freeze'),{capture:true});
  document.addEventListener('resume',wake,{capture:true});
  // Some mobile browsers skip window.blur when entering recent-apps view;
  // this also handles delayed play() calls and tab discard suspensions.
  window.addEventListener('beforeunload',()=>{closed=true;halt('beforeunload')},{capture:true});
  document.addEventListener('pointerdown',()=>{if(!document.hidden)wake();},{capture:true,passive:true});
  window.__rf564AudioLifecycle={version:'55.30',halt,wake,
    get paused(){return isBlocked()},get registeredMedia(){return media.size},
    get registeredContexts(){return contexts.size},get preventedPlays(){return prevented}};
  if(isBlocked())halt('initial-hidden');
})();
