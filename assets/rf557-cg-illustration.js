/* RIFTFALL ARENA V55.7 — CGI illustration UX layer.
 * Additive DOM/CSS only: never overrides gameplay, network, save or role logic.
 * Existing game buttons are still the single sources of truth for actions. */
(() => {
  'use strict';
  if (window.__rf557CGIllustrationUI) return;
  window.__rf557CGIllustrationUI = true;
  const root = document.documentElement;
  root.classList.add('rf557-cg');
  let pending = false;
  let observing = false;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const $ = (q, el=document) => el.querySelector(q);

  function hudDensity() {
    const left = $('#hud-left'), right = $('#hud-right');
    if (!left || !right || !document.body) return;
    const friendly = left.querySelectorAll('.plate').length;
    const enemies = right.querySelectorAll('.plate').length;
    const many = friendly >= 4 || enemies >= 4 || friendly+enemies >= 6;
    document.body.classList.toggle('rf557-many-actors', many);
    left.dataset.rf557Count = String(friendly);
    right.dataset.rf557Count = String(enemies);
  }

  // An optional lower thumb-navigation appears only on the menu.
  // Each action goes through an existing game's actual button or navigation.
  function buildMobileNav() {
    if ($('#rf557-mobile-nav')) return;
    const title = $('#scr-title');
    if (!title) return;
    const nav = document.createElement('nav');
    nav.id = 'rf557-mobile-nav';
    nav.className = 'rf557-mobile-nav';
    nav.setAttribute('aria-label', 'スマホ用のメニュー移動');
    const items = [
      {label:'トップ', target:'portal-start', icon:'home'},
      {label:'モード', target:'portal-play', icon:'sword'},
      {label:'旅支度', action:'btn-options', icon:'settings'},
      {label:'攻城戦', action:'btn-castle', icon:'castle'},
    ];
    const shapes = {
      home:'<path d="m3 11 9-7 9 7v10h-7v-7h-4v7H3z"/>',
      sword:'<path d="M5 19 19 5m-11 0 11 11M18 3l3 3M3 18l3 3"/>',
      settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2m0-14-2 2M7 17l-2 2"/>',
      castle:'<path d="M3 21V8h4V4h3v4h4V4h3v4h4v13H3zM8 21v-6h8v6M3 12h18"/>',
    };
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rf557-mobile-nav-button';
      btn.setAttribute('aria-label', item.label);
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+shapes[item.icon]+'</svg><span></span>';
      btn.querySelector('span').textContent = item.label;
      btn.addEventListener('click', () => {
        if (item.target) {
          document.getElementById(item.target)?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'start'});
        } else if (item.action) {
          const original = document.getElementById(item.action);
          if (original && !original.hidden && !original.disabled) original.click();
        }
      });
      nav.append(btn);
    }
    document.body.append(nav);
  }

  // Use an actual navigation/animation state, never obscure a running battle.
  function updateMenuVisibility() {
    const active = !!$('#scr-title')?.classList.contains('on');
    root.classList.toggle('rf557-on-menu', active);
    const nav = $('#rf557-mobile-nav');
    if (nav) {
      nav.hidden = !active;
      nav.setAttribute('aria-hidden', String(!active));
      nav.querySelectorAll('button').forEach(btn => btn.tabIndex = active ? 0 : -1);
    }
  }

  function annotateModes() {
    const title=$('#scr-title');if(!title)return;
    for(const b of title.querySelectorAll('.mode-tile')){
      if(b.dataset.rf557Mode)continue;
      b.dataset.rf557Mode=b.dataset.go||b.id||'mode';
    }
  }

  function addGraphicQualityNote() {
    const existing=$('#rf556-quality-note');
    if (existing && !existing.dataset.rf557Advice) {
      existing.dataset.rf557Advice='1';
      existing.textContent='CG表現は「最高品質／標準／省電力」で自動調整。性能・端末温度に応じて選択できます。戦闘判定や通信には影響しません。';
    }
  }

  function schedule() {
    if(pending)return;
    pending=true;
    requestAnimationFrame(()=>{
      pending=false;
      hudDensity();annotateModes();
      updateMenuVisibility();addGraphicQualityNote();
    });
  }

  function initialize() {
    document.body.classList.add('rf557-cg-body');
    buildMobileNav();
    // Check users changing screens; only observe a limited DOM surface.
    for(const id of ['scr-title','scr-press','scr-options','scr-select','scr-castle']){
      const el=document.getElementById(id);
      if(!el)continue;
      new MutationObserver(schedule).observe(el,{attributes:true,attributeFilter:['class']});
    }
    const grid=$('#select-grid');
    if(grid)new MutationObserver(schedule).observe(grid,{childList:true});
    for(const id of ['hud-left','hud-right']){
      const el=document.getElementById(id);
      if(el)new MutationObserver(schedule).observe(el,{childList:true});
    }
    const settings=$('#scr-options');
    if(settings)new MutationObserver(schedule).observe(settings,{childList:true,subtree:false});
    const title=$('#scr-title');
    if(title)new MutationObserver(schedule).observe(title,{childList:true,subtree:false});
    window.addEventListener('pageshow',schedule,{passive:true});
    window.addEventListener('orientationchange',schedule,{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule();});
    schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});
  else initialize();
})();
