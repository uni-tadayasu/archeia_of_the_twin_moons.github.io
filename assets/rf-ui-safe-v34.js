/* Riftfall Arena V34 – passive responsive UI coordinator.
   Never changes combat input, 3D meshes, skills, roles or saved data. */
(() => {
  'use strict';
  if (window.__rfUILayoutV34) return;
  window.__rfUILayoutV34 = true;
  document.body.classList.add('rf-ui-layout-v34');
  const $ = id => document.getElementById(id);
  const visible = el => {
    if (!el || el.hidden || !el.isConnected) return false;
    const st = getComputedStyle(el), r = el.getBoundingClientRect();
    return st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  function applyPreviewLabels() {
    const table = document.querySelector('#rf-chief-character-editor .rf-ce-bulk-table');
    if (!table || table.dataset.rfLabels === String(table.rows.length)) return;
    const heads = Array.from(table.querySelectorAll('thead th'), x => x.textContent.trim());
    for (const row of table.tBodies[0]?.rows || []) {
      Array.from(row.cells).forEach((cell, i) => {
        if (heads[i]) cell.dataset.rfLabel = heads[i];
      });
    }
    table.dataset.rfLabels = String(table.rows.length);
  }
  let queued = false;
  function measure() {
    queued = false;
    const body = document.body;
    const touch = $('touch');
    const buttons = $('tbtns');
    const isTouch = visible(touch) && visible(buttons) && touch.classList.contains('active');
    body.classList.toggle('rf-ui-touch-active',isTouch);
    if (isTouch) {
      const rects=[...buttons.querySelectorAll('button[data-act]')].filter(visible).map(b=>b.getBoundingClientRect());
      const nearestTop=rects.length?Math.min(...rects.map(r=>r.top)):buttons.getBoundingClientRect().top;
      const bottom = Math.max(70, Math.round(window.innerHeight - nearestTop + 10));
      const value = bottom + 'px';
      if (body.style.getPropertyValue('--rf-ui-controls-space') !== value)
        body.style.setProperty('--rf-ui-controls-space',value);
    }
    const chat = $('chat-panel');
    const isChatOpen = visible(chat);
    body.classList.toggle('rf-ui-chat-open',isChatOpen);
    const general = $('rf-ce-battle-slots');
    const special = ['rf-nep-seven','rf-gaiz-six'].some(id => visible($(id)));
    body.classList.toggle('rf-ui-two-skill-panels',visible(general) && special);
    applyPreviewLabels();
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(measure);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',schedule,{once:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
  // Global DOM observer only watches direct children (editor and fixed panels);
  // no per-frame game scene or chat message mutation scanning.
  const bodyObserver = new MutationObserver(schedule);
  bodyObserver.observe(document.body,{childList:true,attributes:true,attributeFilter:['class']});
  const editorObserver = new MutationObserver(applyPreviewLabels);
  let observedPreview = null;
  const checkEditor = () => {
    const preview = document.querySelector('#rf-chief-character-editor .rf-ce-bulk-preview');
    if (preview !== observedPreview) {
      editorObserver.disconnect(); observedPreview=preview;
      if (preview) editorObserver.observe(preview,{childList:true,subtree:true});
    }
  };
  // Small, inert check while game active; browsers clear it on navigation.
  setInterval(()=>{
    if(document.hidden)return;
    checkEditor();
    // Existing panels change their [hidden] and inline style without events.
    schedule();
  },1000);
  checkEditor();schedule();
  // Diagnostic report for manual UI debugging; does not alter the page.
  window.RiftfallUILayoutAudit = () => {
    const out=[];
    for(const sel of ['#scr-title .portal-wrap','#select-grid','#party-bar','#forge-list',
        '#chat-panel','#rf-chief-character-editor .rf-ce-shell','#rf-ce-battle-slots',
        '#rf-nep-seven','#rf-gaiz-six','#gaizorg-adventure-ui','#world-panel']) {
      const el=document.querySelector(sel);if(!visible(el))continue;
      const r=el.getBoundingClientRect();
      const overflow = r.right>window.innerWidth+2 || r.left<-2;
      out.push({element:sel,left:Math.round(r.left),right:Math.round(r.right),
        width:Math.round(r.width),screen:window.innerWidth,overflow});
    }
    return out;
  };
})();
