// RF554_MOBILE_VIEWPORT_KEYBOARD_AND_HUD_20261111
// Extends the V55.3 focus fix without disabling pinch zoom, changing saved control locations,
// touching player records, or modifying combat code.
(() => {
  'use strict';
  if (window.__rf554MobileResponsive) return;
  window.__rf554MobileResponsive = true;

  const root = document.documentElement;
  const body = document.body;
  const isMobile = window.matchMedia?.('(pointer:coarse)').matches ||
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const vv = window.visualViewport;
  const viewportMeta = document.querySelector('meta[name="viewport"]');
  const originalMeta = viewportMeta?.getAttribute('content') ||
    'width=device-width, initial-scale=1, viewport-fit=cover';
  const isEditable = el => el instanceof Element && (
    el.matches('textarea,select,[contenteditable="true"],[role="textbox"]') ||
    (el.matches('input') && !el.matches('input[type=checkbox],input[type=radio],input[type=range],input[type=button],input[type=submit],input[type=file],input[type=color]'))
  );
  const clamp = (v,lo,hi) => Math.min(hi,Math.max(lo,v));
  let editing = false;
  let focusedAt = 0;
  let lastBlurredAt = 0;
  let beforeScale = 1;
  let userPinched = false;
  let raf = 0;
  let restoreToken = 0;
  let layoutViewportHeight = Math.max(1,window.innerHeight);

  if (isMobile) body.classList.add('rf554-mobile');
  const activePointers = new Set();
  document.addEventListener('pointerdown', e => {
    if(e.pointerType !== 'touch') return;
    activePointers.add(e.pointerId);
    if(editing && activePointers.size > 1) userPinched=true;
  }, {passive:true,capture:true});
  for (const event of ['pointerup','pointercancel']) document.addEventListener(event, e => {
    activePointers.delete(e.pointerId);
  }, {passive:true,capture:true});
  document.addEventListener('touchstart',e=>{if(editing && e.touches.length>1)userPinched=true;},{passive:true,capture:true});

  function updateViewport(){
    raf=0;
    const width = Math.max(1,window.innerWidth||root.clientWidth||360);
    const fullHeight = Math.max(1,window.innerHeight||root.clientHeight||640);
    if(!editing)layoutViewportHeight = fullHeight;
    const visibleHeight = clamp(Number(vv?.height)||fullHeight,1,Math.max(fullHeight,layoutViewportHeight));
    const top = Math.max(0,Number(vv?.offsetTop)||0);
    const keyboardReduced = editing && visibleHeight < layoutViewportHeight - Math.min(100,layoutViewportHeight*.17);
    // CSS variables are used by menus/dialogs, not the WebGL canvas.
    root.style.setProperty('--rf554-viewport-width',Math.round(width)+'px');
    root.style.setProperty('--rf554-visible-height',Math.round(visibleHeight)+'px');
    root.style.setProperty('--rf554-visible-half',Math.round(visibleHeight/2)+'px');
    root.style.setProperty('--rf554-layout-height',Math.round(layoutViewportHeight)+'px');
    root.style.setProperty('--rf554-view-top',Math.round(top)+'px');
    root.style.setProperty('--rf554-keyboard-space',Math.max(0,Math.round(layoutViewportHeight-visibleHeight-top))+'px');
    root.classList.toggle('rf554-keyboard-open',isMobile && editing);
    body.classList.toggle('rf554-keyboard-open',isMobile && editing);
    body.classList.toggle('rf554-keyboard-raised',isMobile && keyboardReduced);
  }
  function scheduleViewport(){
    if(raf)return;
    raf=requestAnimationFrame(updateViewport);
  }
  function keepFieldVisible(){
    if(!editing || !isEditable(document.activeElement))return;
    const el=document.activeElement;
    // Move only the nearest already-scrollable panel, not the entire game/canvas.
    let parent=el.parentElement;
    while(parent && parent!==document.body){
      const c=getComputedStyle(parent);
      if(/auto|scroll/.test(c.overflowY) && parent.scrollHeight>parent.clientHeight+2){
        const er=el.getBoundingClientRect(),pr=parent.getBoundingClientRect();
        if(er.bottom>pr.bottom-10)parent.scrollTop+=er.bottom-pr.bottom+12;
        if(er.top<pr.top+10)parent.scrollTop-=pr.top-er.top+12;
        break;
      }
      parent=parent.parentElement;
    }
  }
  function focusStarted(){
    ++restoreToken;
    const wasEditing=editing;
    editing=true;focusedAt=Date.now();
    if(!wasEditing){userPinched=false;beforeScale=vv?.scale||1;}
    layoutViewportHeight=Math.max(layoutViewportHeight,window.innerHeight||0);
    scheduleViewport();
    setTimeout(()=>{scheduleViewport();keepFieldVisible();},100);
    setTimeout(()=>{scheduleViewport();keepFieldVisible();},330);
  }
  function zoomRecovery(){
    if(!isMobile || !ios || !viewportMeta || userPinched || beforeScale>=1.04)return;
    const scale=Number(vv?.scale)||1;
    if(scale <= Math.max(1.075,beforeScale+.07) || Date.now()-lastBlurredAt>4500)return;
    // Recover only browser-triggered focus zoom, and immediately restore pinch-zoom access.
    const original=viewportMeta.getAttribute('content')||originalMeta;
    const clean=original.replace(/(?:^|,)\s*maximum-scale\s*=\s*[^,]+/ig,'').replace(/,\s*,/g,',').trim();
    viewportMeta.setAttribute('content',clean+', maximum-scale=1');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      viewportMeta.setAttribute('content',original);
      window.dispatchEvent(new Event('resize'));
    }));
  }
  function focusEnded(){
    lastBlurredAt=Date.now();
    const token=++restoreToken;
    setTimeout(()=>{
      if(token!==restoreToken||isEditable(document.activeElement))return;
      editing=false;
      root.classList.remove('rf554-keyboard-open');
      body.classList.remove('rf554-keyboard-open','rf554-keyboard-raised');
      scheduleViewport();
      document.dispatchEvent(new CustomEvent('rf554-keyboard-closed'));
      // Wait for WebKit's keyboard close animation without resetting user pinch zoom.
      [220,520,920].forEach(ms=>setTimeout(()=>{
        if(token!==restoreToken||editing)return;
        zoomRecovery();scheduleViewport();
      },ms));
    },70);
  }
  if(isMobile){
    document.addEventListener('focusin',e=>{if(isEditable(e.target))focusStarted();},true);
    document.addEventListener('focusout',e=>{if(isEditable(e.target))focusEnded();},true);
  }
  vv?.addEventListener('resize',scheduleViewport,{passive:true});
  vv?.addEventListener('scroll',scheduleViewport,{passive:true});
  window.addEventListener('resize',scheduleViewport,{passive:true});
  window.addEventListener('orientationchange',()=>{
    layoutViewportHeight=window.innerHeight||layoutViewportHeight;
    scheduleViewport();
    setTimeout(scheduleViewport,150);
    setTimeout(scheduleViewport,420);
  },{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleViewport();});
  scheduleViewport();

  // Monitor 4-player and multi-enemy HUD only when fighters are added/removed.
  let hudRaf=0;
  function updateHudDensity(){
    hudRaf=0;
    const left=document.querySelectorAll('#hud-left .plate').length;
    const right=document.querySelectorAll('#hud-right .plate').length;
    body.classList.toggle('rf554-hud-crowded',Math.max(left,right)>=4);
    body.classList.toggle('rf554-hud-very-crowded',Math.max(left,right)>=7);
    root.style.setProperty('--rf554-ally-count',String(left));
    root.style.setProperty('--rf554-foe-count',String(right));
  }
  function scheduleHud(){if(!hudRaf)hudRaf=requestAnimationFrame(updateHudDensity);}
  const hudLeft=document.getElementById('hud-left');
  const hudRight=document.getElementById('hud-right');
  if(hudLeft || hudRight){
    const obs=new MutationObserver(scheduleHud);
    if(hudLeft)obs.observe(hudLeft,{childList:true});
    if(hudRight)obs.observe(hudRight,{childList:true});
    scheduleHud();
  }
  // Read-only diagnostic. No account / chat / character data is returned.
  window.rf554LayoutDiagnostics=()=>{
    const w=root.clientWidth,h=window.innerHeight;
    const visible = el => !!el?.getClientRects()?.length && getComputedStyle(el).visibility!=='hidden';
    const activeScreen=document.querySelector('#ui .screen.on');
    const controls=[...document.querySelectorAll('#touch.active #joy,#touch.active #tbtns button')].filter(visible);
    const outOfBounds=controls.filter(el=>{
      const r=el.getBoundingClientRect();return r.left < -2 || r.right > w+2 || r.top < -2 || r.bottom > h+2;
    }).map(el=>el.id||el.dataset.act||el.tagName);
    return {version:'55.4',screen:activeScreen?.id||null,viewport:[w,h],visualHeight:Math.round(vv?.height||h),keyboard:editing,allyCount:Number(root.style.getPropertyValue('--rf554-ally-count')||0),outOfBounds};
  };
})();
