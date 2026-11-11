/* Riftfall Arena V55.5 — contemporary CGI site, with no emoji UI icons.
   Additive visual module. Game transitions, click handlers, purchases and saved layouts stay intact. */
(() => {
  'use strict';
  if (window.__rf555ModernUI) return;
  window.__rf555ModernUI = true;
  const ART = 'assets/rf555/';
  const icons = {
    'rf552-infinite-rank':'<path d="M8 21h8M12 17v4M7 3h10v6a5 5 0 0 1-10 0V3Z"/><path d="M7 5H4v2a4 4 0 0 0 3 4M17 5h3v2a4 4 0 0 1-3 4"/>',
    'btn-castle':'<path d="M3 21V9l4-2 5 2 5-2 4 2v12M7 21V13h10v8M2 9h20M7 7V3h4v3M13 6V3h4v4"/>',
    'btn-forge':'<path d="M3 19l8-8M14 6l4-4 4 4-4 4M9 7l8 8M15 21l6-6"/><path d="M5 15l4 4"/>',
    'btn-shop':'<path d="M4 7h16l-1.5 13h-13L4 7ZM8 7V5a4 4 0 0 1 8 0v2"/>',
    'btn-mailbox':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    'btn-chief-mail':'<path d="M12 2 4 8v11l8 3 8-3V8L12 2Z"/><path d="m8 12 3 3 5-6"/>',
    'btn-options':'<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12m0-14.14-2.12 2.12m-9.9 9.9-2.12 2.12"/>',
    'btn-evmaker':'<path d="m12 2 2.6 6.4L21 11l-6.4 2.6L12 20l-2.6-6.4L3 11l6.4-2.6L12 2Z"/>',
  };
  const svg = body => '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">'+body+'</svg>';
  const artByMode = {
    story:'mode-story.webp',cpu:'mode-duel.webp',duo:'mode-coop.webp',
    'online-vs':'mode-duel.webp','online-coop':'mode-coop.webp',
    event:'mode-event.webp',infinite:'mode-endless.webp'
  };
  const emojiRange = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}](?:\uFE0F|\u200D)?/gu;
  const titles = {
    'btn-adventure-mode':'mode-story.webp',
    'btn-castle':'mode-castle.webp'
  };
  function applyVisuals(){
    const homepage=document.getElementById('scr-title');
    if(!homepage)return;
    for(const [id,shape] of Object.entries(icons)){
      const btn=document.getElementById(id);
      if(!btn)continue;
      const e=btn.querySelector('.service-icon');
      if(e && !e.dataset.rf555Symbol){e.innerHTML=svg(shape);e.dataset.rf555Symbol='1';}
    }
    for(const b of homepage.querySelectorAll('.mode-tile')){
      if(b.dataset.rf555ModeArt)continue;
      const image=artByMode[b.dataset.go]||titles[b.id];
      if(!image)continue;
      b.style.setProperty('--rf555-mode-art',`url("${ART+image}")`);
      b.dataset.rf555ModeArt=image;
    }
    const backgrounds=['world-sky.webp','world-frost.webp','world-grove.webp'];
    homepage.querySelectorAll('.world-gallery img').forEach((img,i)=>{
      if(img.dataset.rf555World)return;
      img.src=ART+backgrounds[i % backgrounds.length];
      img.dataset.rf555World='1';
    });
    const hero=document.querySelector('#scr-press .portal-intro');
    if(hero)hero.dataset.rf555Cinematic='1';
  }
  function removeDecorativeEmoji(root){
    if(!root || !root.isConnected)return;
    const tree=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const queue=[];let text;
    while((text=tree.nextNode())){
      const p=text.parentElement;
      if(!p || p.closest('script,style,textarea,[contenteditable],.rf555-allow-emoji,#chat-panel,#world-near,#world-friends,.cp-message,.chat-message,.mail-body'))continue;
      if(emojiRange.test(text.nodeValue||''))queue.push(text);
      emojiRange.lastIndex=0;
    }
    for(const n of queue){
      const clean=(n.nodeValue||'').replace(emojiRange,'').replace(/\uFE0F/g,'');
      if(clean!==n.nodeValue)n.nodeValue=clean;
    }
  }
  let pending=false;
  function refresh(){
    if(pending)return;pending=true;
    requestAnimationFrame(()=>{
      pending=false;
      applyVisuals();
      for(const id of ['scr-title','scr-press','scr-castle','scr-select','scr-lobby','scr-options','scr-forge','scr-shop']){
        const r=document.getElementById(id);
        if(r)removeDecorativeEmoji(r);
      }
    });
  }
  function boot(){
    applyVisuals();refresh();
    // Avoid observing the live battle HUD (which updates 60 times per second).
    // Only watch UI sections that may recreate service icons or decorative labels.
    const targets=['#scr-title .portal-services','#scr-title .portal-modes','#castle-content','#select-grid'];
    const observer=new MutationObserver(list=>{
      if(list.some(m=>m.type==='childList'))refresh();
    });
    for(const selector of targets){const e=document.querySelector(selector);if(e)observer.observe(e,{subtree:true,childList:true});}
    window.addEventListener('pageshow',refresh,{passive:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
