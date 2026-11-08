/* 双月のアルケイア — UI / ILLUSTRATED CG PATCH 2026-11-07
 * Replacement for existing arkeia-ui.js. Gameplay, saving, online rules unchanged.
 * Every painted texture is generated locally with Canvas 2D (no external asset URLs).
 */
(() => {
  'use strict';
  // Existing portal navigation and startup recovery are preserved.
  function jumpTo(id) {
    const section = document.getElementById(id);
    if (!section) return;
    const scroller = document.getElementById('scr-title');
    if (scroller?.classList.contains('on')) {
      scroller.scrollTo({ top: section.offsetTop - 74,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }
  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-portal-jump]');
    if (button) jumpTo(button.dataset.portalJump);
  });
  const bootStatus = document.getElementById('loading');
  const bootRetry = () => {
    if (window.__arkeiaBootOk || !bootStatus || document.getElementById('arkeia-boot-retry')) return;
    bootStatus.textContent = '起動を確認できません。通信状況をご確認ください。';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.id = 'arkeia-boot-retry'; retry.className = 'back';
    retry.textContent = '再読み込み';
    retry.addEventListener('click', (e) => { e.stopPropagation(); location.reload(); });
    bootStatus.insertAdjacentElement('afterend', retry);
  };
  setTimeout(bootRetry, 12000);
  window.addEventListener('arkeia-boot-ready', () => document.getElementById('arkeia-boot-retry')?.remove());
  const input = document.getElementById('select-search');
  const grid = document.getElementById('select-grid');
  const count = document.getElementById('select-counter');
  const empty = document.getElementById('select-empty');
  if (input && grid && count && empty) {
    let queued = false;
    const filter = () => {
      queued = false;
      const q = input.value.trim().normalize('NFKC').toLocaleLowerCase('ja');
      const cards = Array.from(grid.querySelectorAll('button.card'));
      let shown = 0;
      for (const card of cards) {
        const cardText = (card.dataset.search || card.textContent || '').normalize('NFKC').toLocaleLowerCase('ja');
        card.hidden = !!q && !cardText.includes(q);
        shown += !card.hidden ? 1 : 0;
      }
      count.textContent = `${shown} / ${cards.length} 件`;
      empty.hidden = shown > 0 || cards.length === 0;
    };
    const schedule = () => { if (!queued) { queued = true; queueMicrotask(filter); } };
    input.addEventListener('input', schedule);
    new MutationObserver(schedule).observe(grid, { childList: true, subtree: false });
    document.getElementById('select-back')?.addEventListener('click', () => { input.value = ''; });
    schedule();
  }

  // RIFT UI: attractive, sticky navigation. A floating back button provides
  // reliable fallback when the sticky header is enclosed by a centered .inner.
  const scrollStyle = document.createElement('style');
  scrollStyle.id = 'riftfall-premium-ui-20261108';
  scrollStyle.textContent = `
    :root {--rift-accent:#80dcff;--rift-glow:rgba(83,174,255,.32);--rift-gold:#e4c78d;}
    :root[data-rift-theme="ember"] {--rift-accent:#ffbd7b;--rift-glow:rgba(255,126,63,.3);--rift-gold:#ffddae;}
    :root[data-rift-theme="royal"] {--rift-accent:#c9b2ff;--rift-glow:rgba(152,119,255,.3);--rift-gold:#f2d598;}
    :root[data-rift-theme="frost"] {--rift-accent:#80dcff;--rift-glow:rgba(83,174,255,.32);--rift-gold:#e4c78d;}
    #ui .screen:not(#scr-press) {
      background:radial-gradient(ellipse at 18% 9%,var(--rift-glow),transparent 43%),
        radial-gradient(ellipse at 91% 83%,rgba(111,70,184,.16),transparent 40%),
        linear-gradient(165deg,rgba(6,17,34,.91),rgba(20,16,42,.94))!important;
      scrollbar-width:thin; scrollbar-color:var(--rift-accent) #172238;
    }
    #ui .screen .topbar,#ui .screen .inner > .topbar,
    #ui #scr-select .topbar,#ui #scr-lobby .topbar,#ui #scr-story .topbar,
    #ui #scr-result .topbar {
      position:sticky!important;top:0!important;bottom:auto!important;left:auto!important;right:auto!important;
      width:100%!important;z-index:180!important;isolation:isolate;
      background:linear-gradient(115deg,rgba(9,29,48,.985),rgba(26,24,51,.97))!important;
      border:1px solid rgba(213,192,143,.45)!important;
      border-radius:12px!important;padding:8px 12px!important;
      box-shadow:0 9px 30px #0308169e,0 0 25px var(--rift-glow)!important;
      backdrop-filter:blur(20px)!important;-webkit-backdrop-filter:blur(20px)!important;
    }
    #ui .screen .back,#ui .screen .topbar .back,#ui #select-back {
      position:relative!important;inset:auto!important;transform:none!important;
      border-radius:9px!important;border-color:var(--rift-gold)!important;
      color:#fff4de!important;box-shadow:0 0 0 1px #ffffff1c inset;
      min-height:38px;flex-shrink:0;
    }
    #ui #scr-title .portal-header {position:sticky!important;top:0!important;z-index:180!important;
      background:linear-gradient(120deg,rgba(10,25,42,.96),rgba(32,21,55,.95))!important;
      backdrop-filter:blur(18px)!important;-webkit-backdrop-filter:blur(18px)!important;}
    #ui .screen.on {touch-action:pan-y;overscroll-behavior-y:contain;scroll-padding-top:76px;}
    #ui .screen .inner {overflow:visible!important;}
    #ui .screen .card,#ui .screen .btn,#ui .screen .menu button {
      border-radius:12px!important;
      box-shadow:0 6px 22px rgba(0,7,23,.28),0 1px 0 rgba(255,255,255,.08) inset;
      transition:border-color .15s,box-shadow .15s,transform .16s,filter .16s;
    }
    #ui .screen .card:not(:disabled):hover,#ui .screen .btn:not(:disabled):hover,#ui .screen .menu button:not(:disabled):hover {
      box-shadow:0 12px 30px rgba(0,5,18,.5),0 0 20px var(--rift-glow);
      border-color:var(--rift-accent)!important;filter:brightness(1.06);
    }
    #ui .screen .card {position:relative;overflow:visible;}
    #ui .screen .label {color:#fff3dc;text-shadow:0 0 16px var(--rift-glow);border-color:var(--rift-gold);}
    #ui .screen .select-tools input {border-radius:10px;border-color:#c9bb9a!important;}
    :root[data-rift-density="compact"] #select-grid{gap:5px!important;grid-template-columns:repeat(auto-fill,minmax(118px,1fr))!important;}
    :root[data-rift-density="compact"] #select-grid .card{padding:6px!important;gap:2px!important;}
    .rift-card-favorite {position:absolute;right:7px;top:4px;display:grid;place-items:center;
      width:30px;height:30px;border-radius:50%;color:#6b5b7c;background:#fff5e8f2;
      border:1px solid rgba(50,41,68,.28);font:600 20px/1 system-ui,sans-serif;
      cursor:pointer;z-index:8;box-shadow:0 3px 7px #0002;}
    .rift-card-favorite[aria-pressed="true"] {color:#eab33e;background:#21324b;}
    .rift-is-filtered {display:none!important;}
    .rift-gift-button,.rift-utility button,.rift-filter-tools button,.rift-filter-tools select {
      cursor:pointer;font:600 12px/1.4 system-ui,sans-serif;color:#fff3de;
      border:1px solid rgba(213,191,149,.65);border-radius:11px;
      background:linear-gradient(150deg,rgba(34,52,79,.95),rgba(26,30,56,.96));
      padding:8px 10px;min-height:36px;
    }
    .rift-gift-button:hover,.rift-utility button:hover,.rift-filter-tools button:hover {border-color:var(--rift-accent);}
    .rift-gift-button {display:flex;align-items:center;justify-content:center;gap:9px;
      box-shadow:0 8px 24px #02071380,0 0 25px var(--rift-glow);width:100%;max-width:500px;margin:7px auto!important;}
    .rift-utility {position:fixed;bottom:calc(15px + env(safe-area-inset-bottom));right:calc(12px + env(safe-area-inset-right));
      z-index:10050;display:flex;gap:5px;flex-wrap:wrap;max-width:min(94vw,420px);justify-content:flex-end;pointer-events:auto;}
    .rift-utility[hidden],#rift-floating-back[hidden],#rift-gift-dialog[hidden],.rift-filter-tools[hidden]{display:none!important;}
    #rift-floating-back {position:fixed;top:calc(35px + env(safe-area-inset-top));
      left:calc(9px + env(safe-area-inset-left));z-index:10550;
      color:#fff5df;border:1px solid var(--rift-gold);border-radius:12px;
      padding:12px 16px;min-height:44px;background:rgba(11,27,45,.98);
      box-shadow:0 10px 30px #000b,0 0 18px var(--rift-glow);
      font:600 13px/1.3 system-ui,sans-serif;pointer-events:auto;}
    .rift-filter-tools{display:flex;flex-wrap:wrap;gap:7px;align-items:center;justify-content:center;
      width:100%;max-width:870px;margin:8px auto;padding:7px;border:1px solid #c0ab8055;
      background:linear-gradient(140deg,#162942e8,#24233ae8);border-radius:13px;}
    .rift-filter-tools button[aria-pressed="true"]{border-color:var(--rift-accent);background:#315370;}
    .rift-gift-dialog{position:fixed;inset:0;background:rgba(2,8,22,.8);z-index:12000;
      display:grid;place-items:center;padding:16px;pointer-events:auto;backdrop-filter:blur(8px);}
    .rift-gift-panel{position:relative;max-width:620px;width:100%;max-height:92vh;overflow:auto;
      background:radial-gradient(circle at 45% 0%,rgba(80,136,194,.23),transparent 50%),
        linear-gradient(150deg,#18253e,#111b35 65%,#242044);color:#fff2db;
      border:1px solid #d2ba88;border-radius:18px;padding:clamp(16px,3vw,26px);
      box-shadow:0 24px 70px #000c,0 0 40px var(--rift-glow);
      font-family:system-ui,'Hiragino Kaku Gothic ProN',sans-serif;}
    .rift-gift-panel h2{margin:2px 36px 8px 0;font-size:clamp(20px,4vw,28px);letter-spacing:.05em;}
    .rift-gift-panel p{line-height:1.65;color:#dbd7cf;}
    .rift-gift-close{position:absolute;top:11px;right:12px;cursor:pointer;color:#fff;
      background:#2f3652;border:1px solid #b6a47a;border-radius:9px;min-height:39px;min-width:39px;font-size:20px;}
    .rift-gift-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin:16px 0;}
    .rift-gift-card{border:1px solid #c9ad786d;border-radius:14px;padding:16px;
      background:linear-gradient(150deg,rgba(64,87,115,.35),rgba(24,29,57,.94));}
    .rift-gift-card b{display:block;font-size:16px;color:#ffe9be;margin-bottom:9px;}
    .rift-gift-card strong{font-size:24px;display:block;color:var(--rift-accent);}
    .rift-gift-card small{display:block;min-height:34px;color:#d9dcf0;line-height:1.55;margin-top:7px;}
    .rift-gift-card button{margin-top:10px;width:100%;padding:11px;border-radius:10px;
      background:#d3b87a;color:#121e31;border:0;font:700 13px/1.3 system-ui,sans-serif;cursor:pointer;}
    .rift-gift-card button:disabled{background:#38475d;color:#c1ccd7;cursor:default;}
    .rift-streak-track{display:flex;gap:7px;flex-wrap:wrap;align-items:center;justify-content:center;
      border:1px solid #d7c49450;background:#122137a6;border-radius:12px;padding:10px;}
    .rift-streak-day{min-width:56px;flex:1;text-align:center;color:#e9e4dc;font:600 11px/1.65 system-ui,sans-serif;
      padding:6px 2px;border:1px solid #6477926b;border-radius:9px;}
    .rift-streak-day[data-active="true"]{border-color:#e4c68c;color:#fff4bf;
      background:linear-gradient(145deg,#4e4655,#6b4b39);box-shadow:0 0 16px #e4b26c44;}
    .rift-streak-day b{display:block;font-size:15px;}
    #rift-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      z-index:13000;background:#132a41;color:#fff4da;border:1px solid var(--rift-gold);
      padding:10px 16px;border-radius:12px;box-shadow:0 8px 35px #0008;
      font:600 13px/1.5 system-ui,sans-serif;max-width:90vw;text-align:center;pointer-events:none;}
    #rift-toast[hidden]{display:none!important;}
    @media(max-width:640px){
      .rift-gift-grid{grid-template-columns:1fr;}
      .rift-utility{bottom:calc(8px + env(safe-area-inset-bottom));right:6px;left:6px;max-width:none;}
      .rift-utility button{padding:6px 8px;flex:1;white-space:nowrap;min-height:39px;}
      #rift-floating-back{top:calc(33px + env(safe-area-inset-top));min-height:43px;}
      #ui .screen .topbar{padding:8px 9px!important;}
    }
    @media(prefers-reduced-motion:reduce){#ui .screen .card,#ui .screen .btn{transition:none!important;}}
  `;
  document.head.appendChild(scrollStyle);

  // Stage selection -> real loading UI while main.js loads GLB models.
  // No fictitious percentage, no long blocking delay, and safe dismissal on model errors.
  function installStageLoadingScreen(){
    if(document.getElementById('arkeia-stage-loading'))return;
    const style=document.createElement('style');
    style.id='arkeia-stage-loading-css';
    style.textContent=`
      #arkeia-stage-loading[hidden]{display:none!important}
      #arkeia-stage-loading{position:fixed;inset:0;z-index:9998;display:grid;place-items:center;
        padding:clamp(16px,4vw,40px);overflow:auto;color:#f6f0e3;
        background:#07101d;isolation:isolate;font-family:serif;}
      #arkeia-stage-loading .sl-stage-art{position:absolute;inset:0;background-position:center;
        background-size:cover;opacity:.44;filter:saturate(.75) contrast(1.1) brightness(.8);z-index:-2}
      #arkeia-stage-loading .sl-vignette{position:absolute;inset:0;z-index:-1;
        background:radial-gradient(ellipse at 50% 40%,#162c42a0 0%,#081322ec 73%,#04090ffb 100%)}
      #arkeia-stage-loading .sl-center{position:relative;display:flex;flex-direction:column;
        align-items:center;justify-content:center;gap:15px;width:min(560px,100%);
        text-align:center;padding:24px 18px 30px}
      #arkeia-stage-loading .sl-mark{position:relative;width:112px;height:112px;margin:6px auto 16px}
      #arkeia-stage-loading .sl-mark::before,#arkeia-stage-loading .sl-mark::after{
        content:'';position:absolute;inset:9px;border:2px solid #b6e8ff99;
        border-radius:50%;box-shadow:0 0 18px #69caff5c,inset 0 0 14px #6aaaff22;
        animation:arkeia-loading-orbit 3.5s linear infinite}
      #arkeia-stage-loading .sl-mark::after{inset:0;border-color:#d7c38e84;
        border-style:dashed;animation-duration:5.5s;animation-direction:reverse}
      #arkeia-stage-loading .sl-moon{position:absolute;inset:24px;border-radius:50%;
        background:radial-gradient(circle at 33% 27%,#f8ffff,#9dceef 38%,#315176 72%,#0a192f 100%);
        box-shadow:0 0 23px #91d6ff80,0 0 65px #4ba6eb40}
      #arkeia-stage-loading .sl-kicker{font:600 10px/1.5 system-ui,sans-serif;letter-spacing:.36em;color:#c6c1ac}
      #arkeia-stage-loading .sl-title{font-size:clamp(26px,5vw,40px);font-weight:500;letter-spacing:.17em;
        line-height:1.4;text-shadow:0 2px 22px #000d}
      #arkeia-stage-loading .sl-stage{font-size:clamp(14px,2.2vw,19px);letter-spacing:.15em;color:#e5d3a8}
      #arkeia-stage-loading .sl-label{font:13px/1.8 system-ui,sans-serif;letter-spacing:.08em;color:#c7dce9}
      #arkeia-stage-loading .sl-track{position:relative;overflow:hidden;height:3px;width:min(340px,85%);
        border-radius:8px;background:#b5c9da30;margin:5px 0}
      #arkeia-stage-loading .sl-track::after{content:'';display:block;width:38%;height:100%;
        background:linear-gradient(90deg,transparent,#b8efff,#ddbd7f,transparent);
        animation:arkeia-loading-sweep 1.8s ease-in-out infinite}
      #arkeia-stage-loading .sl-dismiss{margin-top:10px;padding:9px 18px;border:1px solid #9ba6ac90;
        color:#f2e7d0;background:#102438bb;cursor:pointer;font-size:12px;letter-spacing:.1em;
        min-height:38px;border-radius:4px}
      #arkeia-stage-loading .sl-dismiss:hover{background:#1b3c57}
      @keyframes arkeia-loading-orbit{to{transform:rotate(360deg)}}
      @keyframes arkeia-loading-sweep{0%{transform:translateX(-130%)}100%{transform:translateX(380%)}}
      @media(prefers-reduced-motion:reduce){#arkeia-stage-loading *{animation:none!important}}
    `;
    document.head.appendChild(style);
    const overlay=document.createElement('div'); overlay.id='arkeia-stage-loading'; overlay.hidden=true;
    overlay.setAttribute('role','status'); overlay.setAttribute('aria-live','polite');
    overlay.innerHTML=`
      <div class="sl-stage-art" aria-hidden="true"></div><div class="sl-vignette" aria-hidden="true"></div>
      <div class="sl-center"><div class="sl-mark" aria-hidden="true"><div class="sl-moon"></div></div>
        <div class="sl-kicker">RIFTFALL ARENA · WORLD LOADING</div>
        <div class="sl-title">戦いの舞台へ</div><div class="sl-stage"></div>
        <div class="sl-track" aria-hidden="true"></div>
        <div class="sl-label">キャラクターとステージを読み込んでいます</div>
        <button type="button" class="sl-dismiss">ロード画面を閉じる</button></div>`;
    document.body.appendChild(overlay);
    const art=overlay.querySelector('.sl-stage-art'),title=overlay.querySelector('.sl-stage');
    const label=overlay.querySelector('.sl-label');
    const select=document.getElementById('scr-select');
    let openAt=0,hideTimer=0,noticeTimer=0,watcher=null,observer=null;
    const hide=()=>{
      clearTimeout(hideTimer);clearTimeout(noticeTimer);
      if(watcher)watcher.disconnect();watcher=null;
      overlay.hidden=true;overlay.removeAttribute('aria-busy');
    };
    const finish=()=>{
      if(overlay.hidden)return;
      clearTimeout(hideTimer);
      hideTimer=setTimeout(hide,Math.max(0,420-(performance.now()-openAt)));
    };
    const start=(tile)=>{
      if(!select?.classList.contains('on'))return;
      const heading=document.getElementById('select-label')?.textContent||'';
      if(!heading.includes('舞台'))return;
      clearTimeout(hideTimer);clearTimeout(noticeTimer);
      openAt=performance.now();
      title.textContent=tile.querySelector('b')?.textContent?.trim()||'新たな舞台';
      const pic=tile.querySelector('.sthumb');
      art.style.backgroundImage=pic?.style?.backgroundImage || '';
      label.textContent='キャラクターモデルとステージを読み込んでいます';
      overlay.hidden=false;overlay.setAttribute('aria-busy','true');
      if(watcher)watcher.disconnect();
      watcher=new MutationObserver(()=>{
        if(document.getElementById('arkeia-model-error')){hide();return;}
        if(!select.classList.contains('on'))finish();
      });
      watcher.observe(document.body,{childList:true});
      watcher.observe(select,{attributes:true,attributeFilter:['class']});
      noticeTimer=setTimeout(()=>{
        if(!overlay.hidden){label.textContent='読み込みが続いています。時間がかかる場合は接続状況をご確認ください。';}
      },12000);
    };
    overlay.querySelector('.sl-dismiss').addEventListener('click',hide);
    document.addEventListener('click',event=>{
      const tile=event.target.closest?.('#select-grid button.stage-tile');
      if(tile&&!tile.disabled)start(tile);
    },true);
    // When main.js transitions to gameplay, the selection section loses .on.
    // Cancel/return to menu or model load failure must not trap the player.
    window.addEventListener('pagehide',hide);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installStageLoadingScreen,{once:true});
  else installStageLoadingScreen();

  // Patch the SAME ESM module instances that main.js uses. This is visual only.
  const VISUAL_VERSION = 'painted-cg-20261107a';
  Promise.all([
    import('three'),
    import('./game.js?v=audio-cast-20261107d'),
    import('./field.js?v=audio-cast-20261107d')
  ]).then(([THREE, battleModule, worldModule]) => {
    installPaintedEffects(THREE, battleModule.Battle);
    installPaintedWorld(THREE, worldModule.Field);
    document.documentElement.dataset.illustratedPatch = VISUAL_VERSION;
  }).catch((error) => {
    // Non-essential art must never prevent the base game from starting.
    console.warn('[Arkeia] Illustrated CG patch could not initialize; using original graphics.', error);
  });

  function installPaintedEffects(THREE, Battle) {
    if (!Battle || Battle.prototype.__illustratedCG) return;
    Battle.prototype.__illustratedCG = true;
    const PALETTES = [
      ['#ff562c','#ffca70','#8f1839'], // flame
      ['#7eeaff','#ecfcff','#3777d8'], // ice
      ['#b386ff','#fff2a3','#6445bd'], // lightning
      ['#b2ffdf','#f6fff8','#3da8ba'], // wind
      ['#dcaa75','#fff1bf','#795e57'], // earth
      ['#fff0ac','#ffffff','#ddaa62'], // light
      ['#9b6cff','#e3acff','#271343'], // dark
      ['#54d5fa','#ddfdff','#2576ca'], // water
      ['#9df363','#f5ffd6','#7b37aa'], // poison
      ['#fb6d88','#ffd6e0','#6a0c36']  // blood
    ];
    const cache = new Map();
    let liveSprites = 0;
    const TWO_PI = Math.PI * 2;
    function rng(seed) {
      let z = seed >>> 0;
      return () => {
        z = (z + 0x6d2b79f5) >>> 0;
        let t = Math.imul(z ^ (z >>> 15), z | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    function paintedTexture(elem, slot) {
      const e = ((elem | 0) % 10 + 10) % 10, s = ((slot | 0) % 10 + 10) % 10;
      const key = e * 10 + s;
      if (cache.has(key)) return cache.get(key);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      const c = canvas.getContext('2d');
      if (!c) return null;
      const [base, pale, dark] = PALETTES[e];
      const r = rng(0x1f12cc80 + key * 9973);
      const col = (i) => [base, pale, dark][i % 3];
      c.translate(256, 256);
      c.lineCap = 'round'; c.lineJoin = 'round';
      function glowRing(rad, width, opacity, start=0, stop=TWO_PI) {
        c.save(); c.globalAlpha = opacity; c.strokeStyle = pale;
        c.shadowColor = base; c.shadowBlur = 25;
        c.lineWidth = width; c.beginPath(); c.arc(0, 0, rad, start, stop); c.stroke();
        c.shadowBlur = 0; c.globalAlpha *= 0.6; c.strokeStyle = base; c.lineWidth = Math.max(1, width * 0.32); c.stroke();
        c.restore();
      }
      function brush(x,y,rx,ry,color,alpha,turn=0) {
        c.save(); c.translate(x,y); c.rotate(turn); c.globalAlpha=alpha;
        const g=c.createRadialGradient(-rx*.18,-ry*.22,1,0,0,Math.max(rx,ry));
        g.addColorStop(0,pale); g.addColorStop(.32,color); g.addColorStop(.68,color); g.addColorStop(1,'rgba(0,0,0,0)');
        c.scale(rx/Math.max(rx,ry),ry/Math.max(rx,ry));
        c.fillStyle=g; c.beginPath(); c.arc(0,0,Math.max(rx,ry),0,TWO_PI); c.fill(); c.restore();
      }
      function ink(a1,rad,len,w,color,alpha) {
        c.save();c.rotate(a1);c.globalAlpha=alpha;
        c.strokeStyle=color; c.shadowBlur=13; c.shadowColor=base;c.lineWidth=w;
        c.beginPath();c.moveTo(rad,0);c.bezierCurveTo(rad+len*.2,-len*.16,rad+len*.8,len*.15,rad+len,0);c.stroke();
        c.shadowBlur=0;c.lineWidth=Math.max(1,w*.22);c.strokeStyle=pale;c.stroke();c.restore();
      }
      // All 100 elemental art frames are painted as translucent, layered brush work.
      if (s === 5) { // ancient illustrated CG magic seal
        glowRing(179,5,.94);glowRing(155,2,.72);glowRing(113,3,.86);glowRing(86,2,.56);
        c.save(); c.strokeStyle=pale; c.lineWidth=3; c.globalAlpha=.83;c.shadowBlur=12;c.shadowColor=base;
        for(let i=0;i<12;i++){
          const a=i*TWO_PI/12,b=a+TWO_PI/12;
          c.beginPath();c.moveTo(Math.cos(a)*175,Math.sin(a)*175);
          c.lineTo(Math.cos(b)*175,Math.sin(b)*175);
          c.lineTo(Math.cos(a+.37)*123,Math.sin(a+.37)*123); c.stroke();
          c.save();c.translate(Math.cos(a)*137,Math.sin(a)*137);c.rotate(a);
          c.beginPath();c.moveTo(-5,-8);c.lineTo(0,9);c.lineTo(5,-8);c.stroke();c.restore();
        }
        for(let i=0;i<6;i++){const a=i*TWO_PI/6;c.beginPath();c.moveTo(Math.cos(a)*82,Math.sin(a)*82);c.lineTo(Math.cos(a+2*TWO_PI/3)*82,Math.sin(a+2*TWO_PI/3)*82);c.stroke()}
        c.restore();
      } else if (s === 6 || s === 9) { // calligraphic slash and speed tail
        c.save();c.rotate(s===6?-.47:-.24);
        for(let j=0;j<5;j++){
          c.beginPath(); c.moveTo(-225+j*15,115+j*8);
          c.bezierCurveTo(-130,-150-j*17,110,-160+j*8,226,-72+j*15);
          c.lineWidth=(23-j*4);c.strokeStyle=j<2?pale:base;
          c.globalAlpha=.65-j*.085;c.shadowColor=base;c.shadowBlur=25;c.stroke();
        }
        c.restore();
        for(let i=0;i<30;i++){
          const a=(r()-.5)*1.7, rr=70+r()*145;
          brush(Math.cos(a)*rr,Math.sin(a)*rr,6+r()*24,1+r()*4,col(i),.25+r()*.4,a);
        }
      } else if (s === 4) { // radiating shock-ring
        glowRing(95,32,.43);glowRing(136,13,.78);glowRing(165,3,.6);
        for(let i=0;i<25;i++) ink(i*TWO_PI/25,160,15+r()*55,2+r()*8,col(i),.35+r()*.5);
      } else if(s===2){ // energy column / vertical ribbon
        for(let i=0;i<20;i++){
          c.save();c.translate((r()-.5)*135,0); c.globalAlpha=.1+r()*.45;
          c.strokeStyle=col(i);c.shadowBlur=17;c.shadowColor=base;c.lineWidth=3+r()*22;
          c.beginPath();c.moveTo((r()-.5)*40,235);c.bezierCurveTo(-70+r()*140,80,-80+r()*160,-80,(r()-.5)*100,-245);c.stroke();c.restore();
        }
        brush(0,0,75,175,base,.45);
      } else if(s===3){ // soft mist / elemental smoke
        for(let i=0;i<48;i++){
          const a=r()*TWO_PI,rr=Math.sqrt(r())*160;
          brush(Math.cos(a)*rr,Math.sin(a)*rr,25+r()*70,18+r()*70,col(i),.12+r()*.24,r()*TWO_PI);
        }
      } else if(s===1 || s===7){ // starburst / animated flecks
        brush(0,0,80,80,base,.85);
        for(let i=0;i<(s===1?54:34);i++){
          const a=r()*TWO_PI,rr=25+r()*120;
          ink(a,rr,20+r()*120,1+r()*9,col(i),.25+r()*.7);
          brush(Math.cos(a)*rr,Math.sin(a)*rr,5+r()*18,4+r()*19,col(i),.3+r()*.6,a);
        }
      } else if(s===8){ // painted explosion and residual embers
        brush(0,0,142,142,base,.78);
        for(let i=0;i<66;i++){
          const a=i*TWO_PI/66+r()*.19,rr=24+r()*90;
          ink(a,rr,40+r()*145,5+r()*23,col(i),.4+r()*.56);
        }
        glowRing(87,18,.64);
      } else { // orb / core: flowing element-specific shapes
        brush(0,0,110,117,base,.85); brush(-19,-25,64,74,pale,.5);
        for(let i=0;i<32;i++){
          const a=i*TWO_PI/32+(r()-.5)*.3,rr=40+r()*130;
          ink(a,rr,20+r()*80,2+r()*15,col(i),.22+r()*.65);
        }
        glowRing(81,5,.45);
      }
      // Chromatic painter's dust adds micro-detail without polygon facets.
      c.save();c.shadowBlur=8;c.shadowColor=pale;
      for(let i=0;i<75;i++){
        const a=r()*TWO_PI,rr=Math.sqrt(r())*225;
        c.globalAlpha=.12+r()*.42;c.fillStyle=i%3===0?pale:base;
        c.beginPath();c.ellipse(Math.cos(a)*rr,Math.sin(a)*rr,0.7+r()*3.7,0.7+r()*2.8,a,0,TWO_PI);c.fill();
      }
      c.restore();
      const t=new THREE.CanvasTexture(canvas);
      t.colorSpace=THREE.SRGBColorSpace;
      t.generateMipmaps=true; t.minFilter=THREE.LinearMipmapLinearFilter;
      t.magFilter=THREE.LinearFilter;t.anisotropy=2;
      cache.set(key,t);
      return t;
    }
    function spawn(b,pos,elem,slot,size,life,options={}){
      if(!b?.fx || !pos || !Number.isFinite(size) || size<=0 || liveSprites>=210)return null;
      const tex=paintedTexture(elem,slot);if(!tex)return null;
      const flat=!!options.flat;
      const op=THREE.MathUtils.clamp(options.op ?? 1,0,1);
      const matOptions={map:tex,transparent:true,opacity:op,depthWrite:false,
        blending:slot===3?THREE.NormalBlending:THREE.AdditiveBlending,
        side:THREE.DoubleSide,fog:false};
      const m=flat?new THREE.MeshBasicMaterial(matOptions):new THREE.SpriteMaterial(matOptions);
      const o=flat?new THREE.Mesh(new THREE.PlaneGeometry(1,1),m):new THREE.Sprite(m);
      o.userData.paintedFX=true;
      o.userData.trackedPaint=true;
      o.position.copy(pos);
      const base=Math.max(.1,size);
      o.scale.set(base,base,1);
      if(flat){o.rotation.x=-Math.PI/2;o.rotation.z=options.rot ?? Math.random()*TWO_PI;}
      else m.rotation=options.rot ?? 0;
      b.fx.add(o);
      liveSprites++;
      const grow=options.grow ?? 1.65;
      const spin=options.spin ?? 0;
      const rise=options.rise ?? 0;
      const duration=Math.max(.09,life||.35);
      let t=-(options.delay||0);
      o.visible=t>=0;
      b.addEffect((dt)=>{
        t+=dt;
        if(t<0)return true;
        o.visible=true;
        const k=Math.min(1,t/duration),u=1-Math.pow(1-k,2);
        const sc=base*(1+(grow-1)*u);
        o.scale.set(sc,sc,1);
        if(flat)o.rotation.z+=spin*dt;else m.rotation+=spin*dt;
        o.position.y+=rise*dt;
        const fade=options.hold?Math.min(1,(1-k)*3):Math.pow(1-k,1.35);
        m.opacity=op*Math.min(1,t*30)*fade;
        if(k>=1){b.fx.remove(o);if(flat)o.geometry.dispose();m.dispose();o.userData.trackedPaint=false;liveSprites=Math.max(0,liveSprites-1);return false;}
        return true;
      });
      return o;
    }
    function element(spec,fall=5){return ((Number(spec?.elem ?? fall)||0)%10+10)%10}
    function multi(b,pos,elem,power=1,mode='burst'){
      const P=Math.max(.25,Math.min(3,power));
      const p=pos.clone();
      if(mode==='chant'){
        spawn(b,new THREE.Vector3(p.x,.08,p.z),elem,5,3.5*P,.95,{flat:true,grow:1.23,spin:1.9,hold:true});
        spawn(b,p.clone().add(new THREE.Vector3(0,1.3,0)),elem,2,4.5*P,.8,{grow:1.3,op:.69});
        for(let i=0;i<3;i++)spawn(b,p.clone().add(new THREE.Vector3(0,.6+i*.9,0)),elem,7,2*P,.62,{delay:i*.12,grow:1.85,rise:1.4});
      }else if(mode==='slash'){
        spawn(b,p,elem,6,3.6*P,.28,{grow:1.25,spin:.8});
        spawn(b,p,elem,9,3.4*P,.38,{grow:1.6,op:.7});
        spawn(b,p,elem,1,1.65*P,.15,{grow:1.7});
      }else{
        spawn(b,p,elem,8,3.5*P,.55,{grow:1.95});
        spawn(b,p,elem,1,2.9*P,.24,{grow:1.55});
        spawn(b,new THREE.Vector3(p.x,.1,p.z),elem,4,1.9*P,.53,{flat:true,grow:2.6,op:.78});
        spawn(b,p,elem,3,3.2*P,.82,{grow:1.5,rise:.75,op:.5});
      }
    }
    const originalDispose = Battle.prototype.dispose;
    if(typeof originalDispose==='function')Battle.prototype.dispose=function(){
      this.fx?.traverse(o=>{
        if(o.userData?.trackedPaint){
          liveSprites=Math.max(0,liveSprites-1);
          o.userData.trackedPaint=false;
          o.material?.dispose();
          if(o.geometry?.type==='PlaneGeometry')o.geometry.dispose();
        }
      });
      return originalDispose.call(this);
    };
    Battle.prototype.fxPop=function(pos,elem,slot,size,life,options={}){
      return spawn(this,pos,elem,slot,size,life,options);
    };
    Battle.prototype.fx3d=function(pos,elem,power=1,color=0xffffff){
      multi(this,pos,elem,power,'burst');
      if(power>=1.4)this.flashLight?.(pos,color,.85,.24);
    };
    Battle.prototype.grandFx=function(pos,elem,color,power=1){
      multi(this,pos,elem,power,'chant');
      if(power>=1.5)spawn(this,pos.clone().add(new THREE.Vector3(0,1.7,0)),elem,8,4.1*power,.7,{grow:1.7,op:.72});
      this.flashLight?.(pos,color,Math.min(2,power),.38);
    };
    Battle.prototype.burstFx=function(pos,color,elem){
      multi(this,pos.clone().setY(Math.max(1,pos.y)),elem,1.6);
      this.shake=Math.max(this.shake||0,.28);
      this.flashLight?.(pos,color,1.15,.25);
    };
    Battle.prototype.burst=function(pos,color,size,spec){
      const e=element(spec,5),power=Math.min(2.5,Math.max(.4,size*.58));
      multi(this,pos,e,power);
      if(size>1)this.flashLight?.(pos,color,power,.25);
    };
    Battle.prototype.spark=function(pos,color,size){
      const e=6;
      spawn(this,pos,e,1,1.5*Math.max(.22,size),.2,{grow:2.3});
      spawn(this,pos,e,7,1.3*Math.max(.2,size),.27,{grow:1.7});
    };
    Battle.prototype.puff=function(pos,color,size){
      spawn(this,pos,3,3,1.55*Math.max(.22,size),.3,{grow:2.1,rise:.4,op:.55});
    };
    Battle.prototype.afterimage=function(f,color){
      multi(this,f.pos.clone().setY(1+f.y),element(f.def?.skills?.[0]),.68,'slash');
    };
    Battle.prototype.swingFx=function(f){
      const L=f.def?.light||{};
      const e=L.shots?9:element(f.def?.skills?.[0]);
      const reach=L.range||2.5;
      const dir=f.forward();
      const p=f.pos.clone().addScaledVector(dir,Math.min(2,reach*.47)).setY(1.15+f.y);
      multi(this,p,e,Math.max(.65,Math.min(1.75,reach/3)),'slash');
      if(L.spin)spawn(this,new THREE.Vector3(f.pos.x,.1,f.pos.z),e,4,reach*1.6,.42,{flat:true,grow:1.9,spin:7});
    };
    // Flying projectile collision/hit logic remains the original implementation.
    // Only the 3D solid in the newly created projectile root is replaced by paint.
    const originalProjectile=Battle.prototype.projectile;
    if(typeof originalProjectile==='function')Battle.prototype.projectile=function(f,spec,ang){
      const before=new Set(this.fx.children);
      const outcome=originalProjectile.call(this,f,spec,ang);
      const group=this.fx.children.find(o=>!before.has(o)&&o.isGroup&&o.children.some(ch=>ch.isMesh));
      if(group){
        for(const ch of group.children)if(ch.isMesh)ch.visible=false;
        const e=element(spec,9);
        const tex=paintedTexture(e,spec.visual==='laser'?2:0);
        if(tex){
          const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.96,
            depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
          const sz=Math.max(1.6,(spec.radius||1)*3.4);
          sprite.scale.set(sz,sz,1);sprite.userData.paintedFX=true;
          group.add(sprite);
        }
      }

      return outcome;
    };
    function warpFx(b,pos,color,elem,arriving=false){
      if(!b?.fx||!pos)return;
      const p=pos.clone();
      spawn(b,new THREE.Vector3(p.x,.08,p.z),elem,5,3.8,.34,{flat:true,grow:arriving?2.2:.7,spin:arriving?7:-7,op:.92});
      spawn(b,new THREE.Vector3(p.x,.12,p.z),elem,4,2.35,.48,{flat:true,grow:3.05,spin:arriving?-9:9,op:.7});
      spawn(b,p.clone().add(new THREE.Vector3(0,1.18,0)),elem,2,3.3,.4,{grow:arriving?1.9:1.3,op:.82});
      for(let i=0;i<3;i++)spawn(b,p.clone().add(new THREE.Vector3(0,.45+i*.5,0)),elem,i%2?7:3,1.2+i*.52,.24+i*.08,{delay:i*.03,grow:1.9,rise:arriving?.95:1.35,spin:(i%2?-1:1)*(arriving?4:6),op:.58});
      b.flashLight?.(p,color,arriving?1.25:1.05,.16);
    }
    const originalExecuteCast=Battle.prototype.executeCast;
    if(typeof originalExecuteCast==='function')Battle.prototype.executeCast=function(f,slot,net){
      const isValgard=f&&String(f.key||'').toLowerCase()==='valgard';
      const result=originalExecuteCast.call(this,f,slot,net);
      if(!isValgard||!f?.action||f.action.type!=='dash')return result;
      const dashSpec=f.action.spec||{};
      const foes=typeof this.enemiesOf==='function'?this.enemiesOf(f):[];
      let target=null;
      if(net&&Number.isFinite(net.tx)&&Number.isFinite(net.tz)&&foes.length){
        let best=Infinity;
        for(const foe of foes){
          const dx=(foe.pos?.x||0)-net.tx,dz=(foe.pos?.z||0)-net.tz;
          const dist=dx*dx+dz*dz;
          if(dist<best){best=dist;target=foe;}
        }
      }
      if(!target&&typeof this.nearestEnemy==='function')target=this.nearestEnemy(f);
      const color=dashSpec.color??f.def?.color??0x9b6cff;
      const elem=element(dashSpec,6);
      const source=f.pos.clone();
      warpFx(this,source,color,elem,false);
      if(target){
        const tf=typeof target.forward==='function'?target.forward():new THREE.Vector3(Math.sin(target.facing||0),0,Math.cos(target.facing||0));
        const backStep=Math.max(1.05,(target.radius||.45)+(f.radius||.45)+.22);
        const dest=target.pos.clone().addScaledVector(tf,-backStep);
        const face=target.pos.clone().sub(dest).setY(0);
        f.pos.copy(dest);
        f.netTarget?.copy?.(dest);
        if(f.root?.position)f.root.position.set(dest.x,f.y||0,dest.z);
        if(face.lengthSq()>1e-4){
          f.facing=Math.atan2(face.x,face.z);
          if(f.root)f.root.rotation.y=f.facing;
        }
        if(f.visual){f.visual.position.y=0;f.visual.rotation.y=0;}
        f.vel?.set?.(0,0,0);
        f.action=null;
        warpFx(this,dest,color,elem,true);
        spawn(this,source.clone().lerp(dest,.5).setY(1.18),elem,2,3.2,.18,{grow:1.3,op:.74});
        this.afterimage?.(f,color);
        this.shake=Math.max(this.shake||0,.32);
        this.applyHit?.(f,target,dashSpec.dmg??0,dashSpec.stun??.55,dashSpec.kb??9,dest,dashSpec);
      }else{
        f.vel?.set?.(0,0,0);
        f.action=null;
      }
      return result;
    };
  }


  /* VALGARD — ORIGINAL CELESTIAL THUNDER JUDGMENT
   * A new self-authored 2D-CG spell, not a recreation of copyrighted art,
   * speech, motion sequences or game data. Original celestial sigils,
   * branching blue-violet lightning and a painted suspended sword of light.
   * All gameplay collision stays in Battle.strikeAt; no physical 3D FX geometry.
   */
  Promise.all([
    import('three'),
    import('./game.js?v=audio-cast-20261107d'),
    import('./data.js?v=audio-cast-20261107d')
  ]).then(([THREE,combat,data]) => {
    installAstralJudgment(THREE,combat.Battle,data.FIGHTERS);
  }).catch(error=>console.warn('[Arkeia] Original celestial judgment unavailable.',error));

  function installAstralJudgment(THREE,Battle,FIGHTERS){
    if(!Battle || !FIGHTERS?.valgard || Battle.prototype.__astralJudgment20261107) return;
    Battle.prototype.__astralJudgment20261107=true;
    const spec=FIGHTERS.valgard.skills?.[2];
    const spearSpec=FIGHTERS.valgard.skills?.[0];
    if(!spec || !spearSpec) return;
    // Former Glacial Lance -> Astral Judgment (original homage, not direct asset reuse).
    Object.assign(spec,{
      name:'蒼天雷裁《アストラル・ジャッジメント》',
      kind:'astral_judgment_painted', elem:2, color:0xffb25d,
      cost:39,castTime:2.85,dmg:5400,radius:4.8,
      hitCount:12,windHits:10,lightHits:2,
      visual:'painted_judgment',vivid:true,
      description:'十重の雷衝で空へ打ち上げ、橙色の巨大断罪剣で貫き、大爆発を起こす上位術（基本総威力5400）'
    });
    // Former ice fang shockwave -> shining spear homage.
    Object.assign(spearSpec,{
      name:'光牢剣陣《ルミナス・レギオン》',
      kind:'shining_spear_painted', elem:5, color:0xd8f1ff,
      cost:24, castTime:1.55, dmg:3300, radius:3.8,
      hitCount:9, visual:'painted_shining_spear', vivid:true,
      description:'敵を強制的に宙へ拘束し、八重の光剣と最後の爆裂で断罪する光槍術（基本総威力3300）'
    });
    // 奥義: 二つの彩色天体が衝突し、灼熱と極寒の摩擦による連続攻撃。
    Object.assign(FIGHTERS.valgard.over,{
      name:'双星崩滅《ツイン・カタクリズム》',kind:'last_vanisher_painted',
      elem:2,color:0xffa85f,cost:0,castTime:2.15,dmg:8100,
      radius:7.5,hitCount:15,description:'青い天体と橙の天体が激突。14段の連続摩擦と終極爆裂（基本総威力8100）'
    });
    // Rear warp / forbidden ice spell / lesser healing, all in the same boss-tier scale.
    // These are original damage properties used by the base combat engine.
    Object.assign(FIGHTERS.valgard.skills[1], {
      dmg:1500, stun:.7, kb:9,
      description:'瞬時に敵の背後へ転移し、氷鋼の一撃を叩き込む。単発の高威力攻撃'
    });
    Object.assign(FIGHTERS.valgard.skills[3], {
      dmg:310, count:10, spread:3.2, radius:2.8,
      finalDmg:1500, finalRadius:7.8,
      description:'集中する十重の氷晶と最後の極寒の一撃。近距離で多段命中する禁呪'
    });
    if(FIGHTERS.valgard.skills[4]?.kind === 'heal') {
      Object.assign(FIGHTERS.valgard.skills[4], {heal:900, radius:5.5});
    }
    // 秘奥義 is NOT derived from the damaging over; this independently heals the caster.
    FIGHTERS.valgard.hi={
      name:'蒼星再誕《アース・リジェネシス》',kind:'blue_earth_painted',
      elem:7,color:0xa5e8ff,cost:0,castTime:2.45,
      heal:0,radius:0,hi:true,description:'蒼き星の祝福でヴァルガルド自身のHPを完全回復'
    };
    const TAU=Math.PI*2, maxConcurrent=2;
    const isTouch=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
    const S=isTouch?.75:1;
    const textures={};
    let active=0,prewarmScheduled=false;
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
    function rnd(seed){
      let k=seed>>>0;
      return ()=>{k=(Math.imul(k,1664525)+1013904223)>>>0;return k/4294967296;};
    }
    function canvasOf(w,h){
      const c=document.createElement('canvas');
      c.width=Math.max(32,Math.round(w*S));c.height=Math.max(32,Math.round(h*S));
      const g=c.getContext('2d');
      if(g)g.scale(c.width/w,c.height/h);
      return {c,g};
    }
    function stagePaint(id){
      const different={
        earth:[512,512],heaven:[512,512],boltA:[288,768],boltB:[288,768],
        boltC:[288,768],sword:[384,896],nova:[512,512],mist:[512,512],
        storm:[512,512],pillar:[256,768],
        celestialGate:[640,640],swordWings:[768,512],
        stormThreads:[512,512],sparkVeil:[512,512],
        shockHalo:[512,512],bladeWake:[384,896],
        sacredFlares:[512,512],
        planetWarm:[512,512],planetCold:[512,512],planetEarth:[512,512],friction:[512,512],
        iceCrown:[512,512],iceBurst:[512,512],warpRing:[512,512],royalSlash:[640,320],healBloom:[512,512]
      };
      const [w,h]=different[id];
      const {c,g}=canvasOf(w,h);
      if(!g) return null;
      const r=rnd(id==='sword'?11903:id.charCodeAt(0)*3107+21913);
      g.lineCap='round';g.lineJoin='round';
      const beam=(x,y,ra,stops)=>{
        const gr=g.createRadialGradient(x,y,1,x,y,ra);
        stops.forEach(([v,color])=>gr.addColorStop(v,color));return gr;
      };
      if(id==='earth'||id==='heaven'){
        const sky=id==='heaven',cx=256,cy=256;
        const scale=sky?.96:1;
        g.translate(cx,cy);g.scale(scale,scale);
        g.fillStyle=beam(0,0,245,[[0,sky?'rgba(238,248,255,.28)':'rgba(129,205,255,.25)'],[.55,'rgba(88,77,197,.09)'],[1,'rgba(30,28,90,0)']]);
        g.fillRect(-256,-256,512,512);
        for(let ring=0;ring<5;ring++){
          const rad=63+ring*34;
          g.save();g.shadowBlur=18+ring*2;g.shadowColor=ring%2?'#b3a1ff':'#75d7ff';
          g.strokeStyle=ring%2?'rgba(240,232,255,.84)':'rgba(129,227,255,.75)';
          g.lineWidth=ring%2?2.4:4.1;
          g.setLineDash(ring%2?[3,9]:[30,8]);
          g.beginPath();g.arc(0,0,rad,0,TAU);g.stroke();g.restore();
        }
        // Unique star tribunal: 12-sides, alternating curving glyphs, rather than runes from the source.
        for(let layer=0;layer<3;layer++){
          const n=layer===0?12:layer===1?8:5,rr=[166,117,56][layer];
          g.save();g.lineWidth=layer===0?2:3;
          g.strokeStyle=layer===0?'rgba(122,206,255,.92)':'rgba(249,236,255,.78)';
          g.shadowColor='#65bbff';g.shadowBlur=9;
          g.beginPath();
          for(let i=0;i<=n;i++){
            const a=TAU*i/n-Math.PI/2;
            const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
            i?g.lineTo(x,y):g.moveTo(x,y);
          }
          g.stroke();g.restore();
        }
        for(let i=0;i<24;i++){
          const a=TAU*i/24;
          g.save();g.translate(Math.cos(a)*203,Math.sin(a)*203);g.rotate(a);
          g.strokeStyle=i%2?'rgba(229,237,255,.85)':'rgba(137,231,255,.88)';
          g.lineWidth=1.8;
          g.beginPath();g.moveTo(-9,0);g.lineTo(0,-9-(i%3)*3);g.lineTo(9,0);g.lineTo(0,9+(i%3)*3);g.closePath();g.stroke();g.restore();
        }
        for(let i=0;i<55;i++){
          const a=r()*TAU,rr=46+r()*180;
          const x=Math.cos(a)*rr,y=Math.sin(a)*rr;
          g.fillStyle=i%2?'rgba(253,251,255,.75)':'rgba(96,200,255,.7)';
          g.beginPath();g.arc(x,y,.65+r()*1.8,0,TAU);g.fill();
        }
        g.fillStyle=beam(0,0,75,[[0,'rgba(244,251,255,.96)'],[.18,'rgba(163,224,255,.6)'],[1,'rgba(141,119,255,0)']]);
        g.fillRect(-75,-75,150,150);
      }else if(id==='planetWarm'||id==='planetCold'||id==='planetEarth'){
        // Original hand-painted CG planets. A 2D billboard, no expensive sphere geometry.
        const hot=id==='planetWarm', earth=id==='planetEarth', cx=256,cy=256,R=185;
        const glow=hot?['rgba(255,164,63,.40)','rgba(255,101,18,0)']:
          earth?['rgba(124,226,255,.42)','rgba(73,172,255,0)']:
            ['rgba(98,228,255,.44)','rgba(66,104,244,0)'];
        g.fillStyle=beam(cx,cy,251,[[0,glow[0]],[.65,glow[0]],[1,glow[1]]]);
        g.fillRect(0,0,512,512);
        g.save(); g.beginPath();g.arc(cx,cy,R,0,TAU);g.clip();
        const inner=g.createRadialGradient(174,143,9,259,267,286);
        if(hot){
          inner.addColorStop(0,'#fff2b3');inner.addColorStop(.26,'#ffc76c');
          inner.addColorStop(.54,'#e77835');inner.addColorStop(.85,'#a33e23');inner.addColorStop(1,'#43183e');
        }else if(earth){
          inner.addColorStop(0,'#c8f6ff');inner.addColorStop(.18,'#7bc8ea');
          inner.addColorStop(.55,'#167abb');inner.addColorStop(.8,'#074577');inner.addColorStop(1,'#06162d');
        }else{
          inner.addColorStop(0,'#ffffff');inner.addColorStop(.22,'#b4f7ff');
          inner.addColorStop(.55,'#429cda');inner.addColorStop(.83,'#20468d');inner.addColorStop(1,'#131c54');
        }
        g.fillStyle=inner;g.fillRect(cx-R,cy-R,R*2,R*2);
        if(earth){
          // Stylized hand-drawn continental silhouettes and inlaid island chains.
          g.fillStyle='#50b987';g.strokeStyle='#a5e1a1';g.lineWidth=2;
          const polygons=[
            [[112,177],[156,129],[199,119],[225,149],[212,178],[180,196],[171,235],[140,246],[121,222]],
            [[203,236],[230,234],[257,272],[250,309],[232,360],[211,383],[197,345],[205,297]],
            [[301,155],[347,145],[387,177],[417,217],[391,244],[352,229],[329,261],[287,243],[274,201]],
            [[355,287],[388,303],[403,340],[375,363],[337,336]],
          ];
          polygons.forEach((vertices,k)=>{
            g.beginPath(); vertices.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();
            g.fillStyle=k%2?'#429d6f':'#5cbd7f';g.fill();g.stroke();
          });
          // Painted weather fronts and thin cirrus over a blue planet.
          for(let i=0;i<27;i++){
            const yy=94+i*13,x=118+Math.sin(i*.75)*28;
            g.globalAlpha=.19+r()*.4;g.strokeStyle=i%3?'#ffffff':'#c9f9ff';
            g.lineWidth=1.6+r()*3.4;g.beginPath();g.moveTo(x,yy);
            g.bezierCurveTo(x+90,yy-25,x+180,yy+24,420,yy-12);g.stroke();
          }
          g.globalAlpha=1;
        }else{
          // Thin turbulent atmospheric bands and stylized glacial/lava cracks.
          for(let i=0;i<40;i++){
            const yy=92+i*9.1,x=90+(r()-.5)*40;
            g.globalAlpha=.10+r()*.30;g.lineWidth=1+r()*6;
            g.strokeStyle=hot?(i%3?'#ffdf86':'#ff623a'):(i%3?'#d5faff':'#6bd7ff');
            g.beginPath();g.moveTo(x,yy);
            g.bezierCurveTo(x+92,yy-22-r()*17,x+200,yy+23+r()*13,x+331,yy-8);g.stroke();
          }
          g.globalAlpha=1;
          for(let i=0;i<17;i++){
            const x=120+r()*260,y=112+r()*260,sz=5+r()*18;
            g.strokeStyle=hot?'rgba(255,239,190,.54)':'rgba(228,251,255,.53)';
            g.lineWidth=1.1+r()*1.7;g.beginPath();g.arc(x,y,sz,r()*TAU,r()*TAU+2.3);g.stroke();
          }
        }
        const night=g.createLinearGradient(90,145,430,395);
        night.addColorStop(0,'rgba(1,7,28,0)');night.addColorStop(.67,'rgba(1,7,28,.08)');
        night.addColorStop(1,'rgba(2,5,22,.57)');g.fillStyle=night;g.fillRect(62,60,390,397);
        g.restore();g.strokeStyle=hot?'rgba(255,234,174,.94)':earth?'rgba(157,237,255,.83)':'rgba(204,249,255,.9)';
        g.lineWidth=3.7;g.shadowColor=hot?'#ffb957':'#9adfff';g.shadowBlur=25;
        g.beginPath();g.arc(cx,cy,R,0,TAU);g.stroke();
      }else if(id==='friction'){
        // Illustrated friction plasma / sparks between the two opposing planets.
        g.fillStyle=beam(256,256,252,[[0,'rgba(255,255,239,.94)'],[.09,'rgba(255,225,144,.83)'],
          [.28,'rgba(242,156,97,.57)'],[.54,'rgba(137,205,255,.23)'],[1,'rgba(66,79,207,0)']]);
        g.fillRect(0,0,512,512);
        for(let i=0;i<64;i++){
          const a=(i/64)*TAU, len=70+r()*182, start=25+r()*38;
          g.save();g.translate(256,256);g.rotate(a);
          g.globalAlpha=.2+r()*.67;g.strokeStyle=i%2?'#ffc37d':'#b8eaff';
          g.lineWidth=1+r()*6;g.shadowColor=i%2?'#ffc084':'#8ccfff';g.shadowBlur=11;
          g.beginPath();g.moveTo(start,0);g.quadraticCurveTo(len*.51,-10+r()*20,len,0);g.stroke();g.restore();
        }
      }else if(id==='storm'){
        // A unique spiral storm painted with 2D calligraphic arcs and luminous filaments.
        const cx=256,cy=256;
        g.fillStyle=beam(cx,cy,252,[[0,'rgba(188,223,255,.27)'],[.34,'rgba(119,82,236,.18)'],[.7,'rgba(84,104,208,.09)'],[1,'rgba(53,39,108,0)']]);
        g.fillRect(0,0,512,512);
        for(let i=0;i<38;i++){
          const rr=50+i*4.6, start=(i*.371+r()*.22)*TAU, sweep=1.45+r()*.78;
          g.save();g.strokeStyle=i%3?'rgba(155,193,255,.47)':'rgba(250,245,255,.8)';
          g.lineWidth=.9+r()*4.3;g.shadowColor='#8d97ff';g.shadowBlur=5+r()*18;
          g.beginPath();g.arc(cx,cy,rr,start,start+sweep);g.stroke();g.restore();
        }
        for(let i=0;i<110;i++){
          const a=r()*TAU,rr=40+Math.sqrt(r())*188;
          g.save();g.translate(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);
          g.rotate(a+Math.PI/2);
          g.globalAlpha=.18+r()*.55;g.fillStyle=i%3?'#c9d9ff':'#f9fbff';
          g.beginPath();g.moveTo(-1,-1);g.quadraticCurveTo(4,-5,10+r()*15,0);
          g.quadraticCurveTo(4,4,-1,1);g.fill();g.restore();
        }
      }else if(id==='pillar'){
        // Wide luminous ray rendered as transparent painted light, not 3D polygons.
        const grd=g.createLinearGradient(0,0,256,0);
        grd.addColorStop(0,'rgba(107,67,201,0)');
        grd.addColorStop(.16,'rgba(113,96,242,.19)');
        grd.addColorStop(.31,'rgba(106,187,255,.55)');
        grd.addColorStop(.46,'rgba(253,255,255,.93)');
        grd.addColorStop(.55,'rgba(253,255,255,.97)');
        grd.addColorStop(.72,'rgba(143,201,255,.62)');
        grd.addColorStop(.88,'rgba(129,106,229,.18)');
        grd.addColorStop(1,'rgba(72,48,176,0)');
        g.fillStyle=grd;g.fillRect(0,0,256,768);
        for(let i=0;i<16;i++){
          const x=42+r()*170;
          g.save();g.globalAlpha=.18+r()*.42;g.lineWidth=1.2+r()*2.7;
          g.strokeStyle=i%3?'#e5faff':'#9eafff';
          g.shadowColor='#bcd5ff';g.shadowBlur=12;
          g.beginPath();g.moveTo(x+r()*18,0);
          g.bezierCurveTo(x-38+r()*25,222,x+35-r()*25,530,x-20+r()*35,768);
          g.stroke();g.restore();
        }
      }else if(id.startsWith('bolt')){
        const rr=rnd((id==='boltA'?11:id==='boltB'?23:37)*24637);
        const points=[];
        for(let i=0;i<=16;i++){
          const t=i/16;
          points.push([144+(rr()-.5)*(64+48*Math.sin(t*Math.PI)),10+t*742]);
        }
        const draw=(pts,width,color,blur)=>{
          g.save();g.lineWidth=width;g.strokeStyle=color;
          g.shadowColor=color;g.shadowBlur=blur;
          g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();g.restore();
        };
        draw(points,28,'rgba(96,90,255,.23)',45);
        draw(points,13,'rgba(67,184,255,.69)',24);
        draw(points,5,'rgba(235,247,255,.96)',12);
        for(let i=2;i<15;i+=3){
          const [bx,by]=points[i],sgn=i%2?-1:1;
          const fork=[[bx,by],[bx+sgn*(36+rr()*25),by+55],[bx+sgn*(60+rr()*35),by+130]];
          draw(fork,7,'rgba(129,163,255,.65)',16);
          draw(fork,2,'rgba(250,250,255,.90)',7);
        }
        g.fillStyle=beam(144,745,85,[[0,'rgba(255,255,255,.9)'],[.21,'rgba(155,215,255,.65)'],[1,'rgba(108,142,255,0)']]);
        g.fillRect(52,655,184,113);
      }else if(id==='sword'){
        const cx=192;
        // A wholly new celestial keyblade silhouette made of light, not a 3D mesh.
        const halo=beam(cx,383,180,[[0,'rgba(210,230,255,.85)'],[.22,'rgba(126,192,255,.45)'],[.58,'rgba(112,82,230,.15)'],[1,'rgba(91,74,210,0)']]);
        g.fillStyle=halo;g.fillRect(0,35,384,760);
        g.save();g.translate(cx,0);
        // Looming floating aurora eye above the hilt.
        g.strokeStyle='rgba(206,231,255,.90)';g.lineWidth=3;g.shadowBlur=26;g.shadowColor='#8fceff';
        g.beginPath();g.ellipse(0,97,50,17,0,0,TAU);g.stroke();
        g.beginPath();g.ellipse(0,97,72,25,-.05,0,TAU);g.stroke();
        const blade=g.createLinearGradient(-44,0,44,0);
        blade.addColorStop(0,'rgba(74,80,220,.05)');
        blade.addColorStop(.20,'rgba(72,177,255,.77)');
        blade.addColorStop(.47,'rgba(252,253,255,1)');
        blade.addColorStop(.57,'rgba(220,245,255,1)');
        blade.addColorStop(.85,'rgba(64,98,231,.8)');
        blade.addColorStop(1,'rgba(74,72,195,.05)');
        g.fillStyle=blade;g.shadowColor='#a4e5ff';g.shadowBlur=40;
        g.beginPath();g.moveTo(-28,250);g.lineTo(-39,435);g.lineTo(-26,604);
        g.quadraticCurveTo(-19,698,0,830);g.quadraticCurveTo(19,698,26,604);
        g.lineTo(39,435);g.lineTo(28,250);g.closePath();g.fill();
        g.shadowBlur=12;g.fillStyle='rgba(246,252,255,.94)';
        g.beginPath();g.moveTo(-5,259);g.lineTo(-10,544);g.lineTo(0,782);g.lineTo(10,544);g.lineTo(5,259);g.closePath();g.fill();
        // Asymmetric prism-clasped guard: independent original design.
        g.fillStyle=blade;g.shadowBlur=21;
        g.beginPath();g.moveTo(-20,251);g.lineTo(-115,237);g.lineTo(-144,204);
        g.lineTo(-114,265);g.lineTo(-44,292);g.lineTo(0,267);
        g.lineTo(46,296);g.lineTo(116,270);g.lineTo(146,198);
        g.lineTo(113,233);g.lineTo(19,251);g.closePath();g.fill();
        g.fillStyle='#a9e6ff';g.fillRect(-9,152,18,96);
        for(let i=0;i<5;i++){
          g.strokeStyle='rgba(244,250,255,.82)';g.lineWidth=3;
          g.beginPath();g.moveTo(-12,164+i*14);g.lineTo(12,171+i*14);g.stroke();
        }
        g.beginPath();g.moveTo(0,109);g.lineTo(18,127);g.lineTo(0,151);g.lineTo(-18,127);g.closePath();g.fill();
        g.restore();
        // Five feathery light flares and arcing thunder around the guardian sword.
        g.save();g.translate(cx,0);
        for(const side of [-1,1]){
          g.strokeStyle='rgba(241,248,255,.72)';g.lineWidth=3;
          g.shadowColor='#adbdff';g.shadowBlur=15;
          g.beginPath();g.moveTo(side*35,264);
          g.quadraticCurveTo(side*108,170,side*148,187);
          g.quadraticCurveTo(side*119,242,side*45,292);g.stroke();
          g.beginPath();g.moveTo(side*25,336);g.quadraticCurveTo(side*75,460,side*52,587);g.stroke();
          for(let i=0;i<4;i++){
            g.beginPath();g.moveTo(side*(25+i*6),273+i*31);
            g.lineTo(side*(88+i*5),230+i*35);g.stroke();
          }
        }
        g.restore();
      }else if(id==='nova'){
        const cx=256,cy=256;
        g.fillStyle=beam(cx,cy,248,[[0,'rgba(255,255,255,.99)'],[.1,'rgba(209,249,255,.98)'],[.26,'rgba(105,206,255,.78)'],[.5,'rgba(116,101,239,.47)'],[1,'rgba(95,97,196,0)']]);
        g.fillRect(0,0,512,512);
        for(let i=0;i<32;i++){
          const a=TAU*i/32,rr=228;
          g.save();g.translate(cx,cy);g.rotate(a);
          const lg=g.createLinearGradient(0,0,rr,0);
          lg.addColorStop(0,'rgba(245,253,255,.8)');lg.addColorStop(1,'rgba(133,153,245,0)');
          g.fillStyle=lg;g.beginPath();g.moveTo(0,-(i%2?3:5));g.lineTo(rr,0);g.lineTo(0,i%2?3:5);g.fill();g.restore();
        }
        g.strokeStyle='rgba(215,242,255,.97)';g.lineWidth=5;g.shadowColor='#8ecbff';g.shadowBlur=13;
        g.beginPath();g.arc(cx,cy,169,0,TAU);g.stroke();

      }else if(id==='celestialGate'){
        // Original illuminated sky-gate: arched spires, runic orbitals and layered aurora.
        const cx=320,cy=319;
        g.fillStyle=beam(cx,cy,305,[[0,'rgba(255,253,255,.58)'],[.19,'rgba(185,226,255,.41)'],[.55,'rgba(124,147,255,.20)'],[1,'rgba(52,59,153,0)']]);
        g.fillRect(0,0,640,640);
        for(let i=0;i<7;i++){
          const rad=80+i*28;
          g.save();g.strokeStyle=i%2?'rgba(155,226,255,.82)':'rgba(241,235,255,.8)';
          g.lineWidth=i%3===0?4:1.7;
          g.shadowColor=i%2?'#b3e1ff':'#b9a2ff';g.shadowBlur=15;
          g.beginPath();g.ellipse(cx,cy,rad,rad*.80,-.08,0,TAU);g.stroke();g.restore();
        }
        for(let i=0;i<16;i++){
          const a=(i/16)*TAU,xx=cx+Math.cos(a)*250,yy=cy+Math.sin(a)*204;
          g.save();g.translate(xx,yy);g.rotate(a+Math.PI*.5);
          g.strokeStyle='rgba(248,251,255,.75)';g.lineWidth=2;
          g.shadowColor='#72cfff';g.shadowBlur=8;
          g.beginPath();g.moveTo(0,-16);g.lineTo(9,0);g.lineTo(0,16);g.lineTo(-9,0);g.closePath();g.stroke();
          g.beginPath();g.moveTo(0,-10);g.lineTo(0,10);g.moveTo(-5,0);g.lineTo(5,0);g.stroke();g.restore();
        }
        for(let side of [-1,1]){
          g.save();g.translate(cx+side*235,cy+50);g.scale(side,1);
          g.strokeStyle='rgba(214,233,255,.75)';g.lineWidth=4;g.shadowColor='#a2bfff';g.shadowBlur=12;
          g.beginPath();g.moveTo(0,185);g.bezierCurveTo(5,-125,70,-165,80,-205);
          g.bezierCurveTo(100,-150,130,-115,142,35);g.stroke();
          for(let n=0;n<5;n++){
            g.strokeStyle='rgba(146,211,255,.55)';g.lineWidth=2;
            g.beginPath();g.moveTo(n*18,130-n*26);g.quadraticCurveTo(90+n*8,-20-n*33,140,-105+n*16);g.stroke();
          }
          g.restore();
        }
        for(let n=0;n<62;n++){
          const xx=cx+(r()-.5)*520,yy=cy+(r()-.5)*470;
          g.fillStyle=n%3?'rgba(212,234,255,.62)':'rgba(255,250,252,.86)';
          g.beginPath();g.arc(xx,yy,.5+r()*2.5,0,TAU);g.fill();
        }
      }else if(id==='swordWings'){
        // Two independent calligraphic wings of condensed light behind the final blade.
        g.fillStyle=beam(384,251,230,[[0,'rgba(255,255,255,.54)'],[.42,'rgba(180,215,255,.23)'],[1,'rgba(132,129,255,0)']]);
        g.fillRect(125,13,520,475);
        for(const side of [-1,1]){
          g.save();g.translate(384,256);g.scale(side,1);
          for(let i=0;i<16;i++){
            const x0=16+(i%4)*3, y0=(i-8)*7;
            const bx=210+(15-i)*9,by=-130+i*19;
            const ex=310+(15-i)*8,ey=-230+i*29;
            g.save();g.globalAlpha=.23+.68*(1-i/19);
            g.fillStyle=i%3===0?'rgba(255,255,255,.90)':i%2?'rgba(146,228,255,.82)':'rgba(178,172,255,.88)';
            g.strokeStyle='rgba(243,250,255,.72)';g.lineWidth=1.8;
            g.shadowColor='#83caff';g.shadowBlur=10;
            g.beginPath();g.moveTo(x0,y0);g.bezierCurveTo(100,-48+i*8,bx,by,ex,ey);
            g.bezierCurveTo(245,by+58,128,y0+24,x0,y0);g.closePath();g.fill();g.stroke();
            g.restore();
          }
          g.restore();
        }
        const cross=g.createLinearGradient(0,0,768,0);
        cross.addColorStop(0,'rgba(115,196,255,0)');cross.addColorStop(.5,'rgba(250,252,255,.75)');cross.addColorStop(1,'rgba(115,196,255,0)');
        g.fillStyle=cross;g.fillRect(0,249,768,4);
      }else if(id==='stormThreads'){
        // Rotating electrical wind — ink-brush curls, glowing wake and branch filaments.
        const cx=256,cy=256;
        g.fillStyle=beam(cx,cy,252,[[0,'rgba(238,247,255,.15)'],[.47,'rgba(158,155,255,.24)'],[.82,'rgba(77,145,240,.12)'],[1,'rgba(65,90,190,0)']]);
        g.fillRect(0,0,512,512);
        for(let i=0;i<45;i++){
          const a=(i/45)*TAU*4,rr=44+i*4.8;
          const x1=cx+Math.cos(a)*rr,y1=cy+Math.sin(a)*rr;
          const x2=cx+Math.cos(a+.60)*(rr+25),y2=cy+Math.sin(a+.60)*(rr+25);
          g.save();g.strokeStyle=i%5===0?'rgba(251,252,255,.93)':'rgba(160,211,255,.67)';
          g.lineWidth=i%6===0?4:1.4;g.shadowColor='#b4c6ff';g.shadowBlur=9;
          g.beginPath();g.moveTo(x1,y1);g.quadraticCurveTo(cx+Math.cos(a+.24)*(rr+15),cy+Math.sin(a+.24)*(rr+15),x2,y2);g.stroke();g.restore();
        }
        for(let i=0;i<45;i++){
          const a=r()*TAU,rr=r()*210;
          const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;
          g.save();g.globalAlpha=.14+r()*.62;g.strokeStyle=i%2?'#ecf9ff':'#8ea6ff';g.lineWidth=.9+r()*2;
          g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a+1.4)*(10+r()*25),y+Math.sin(a+1.4)*(10+r()*25));g.stroke();g.restore();
        }
      }else if(id==='sparkVeil'){
        // Fine incandescent flecks, no geometry-per-particle in the 3D scene.
        for(let i=0;i<145;i++){
          const a=r()*TAU,rr=Math.sqrt(r())*242;
          const x=256+Math.cos(a)*rr,y=256+Math.sin(a)*rr;
          g.save();g.globalAlpha=.2+r()*.74;
          g.strokeStyle=i%4===0?'rgba(255,244,229,.94)':i%3===0?'rgba(164,183,255,.88)':'rgba(210,241,255,.92)';
          g.lineWidth=.8+r()*1.35;g.shadowColor='#b5dcff';g.shadowBlur=3+r()*6;
          const m=2+r()*8;
          g.beginPath();g.moveTo(x-m,y);g.lineTo(x+m,y);g.moveTo(x,y-m*.5);g.lineTo(x,y+m*.5);g.stroke();g.restore();
        }
      }else if(id==='shockHalo'){
        // Multiple painterly blast rings and peripheral ray spikes.
        const cx=256,cy=256;
        g.fillStyle=beam(cx,cy,243,[[0,'rgba(252,255,255,.94)'],[.13,'rgba(172,226,255,.80)'],[.40,'rgba(142,136,243,.16)'],[1,'rgba(105,120,255,0)']]);
        g.fillRect(0,0,512,512);
        for(let k=0;k<4;k++){
          const rad=78+k*43;g.save();g.shadowColor=k%2?'#a697ff':'#d9efff';g.shadowBlur=20;
          g.strokeStyle=k%2?'rgba(149,173,255,.72)':'rgba(238,252,255,.94)';g.lineWidth=8-k*1.4;
          g.beginPath();
          for(let i=0;i<=90;i++){
            const a=i/90*TAU;
            const variance=1+.028*Math.sin(a*(10+k))+.017*Math.sin(a*(17-k));
            const x=cx+Math.cos(a)*rad*variance,y=cy+Math.sin(a)*rad*variance;
            i?g.lineTo(x,y):g.moveTo(x,y);
          }
          g.stroke();g.restore();
        }
        for(let i=0;i<40;i++){
          const a=TAU*i/40,len=18+r()*41,rad=175+r()*15;
          g.save();g.strokeStyle=i%2?'rgba(250,250,255,.85)':'rgba(128,206,255,.7)';
          g.lineWidth=1+r()*2.3;g.shadowColor='#bcd6ff';g.shadowBlur=5;
          g.beginPath();g.moveTo(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad);
          g.lineTo(cx+Math.cos(a)*(rad+len),cy+Math.sin(a)*(rad+len));g.stroke();g.restore();
        }
      }else if(id==='bladeWake'){
        // A painted vertical energy trail that accompanies the falling sword.
        const gr=g.createLinearGradient(0,0,384,0);
        gr.addColorStop(0,'rgba(92,91,214,0)');gr.addColorStop(.18,'rgba(121,156,244,.19)');
        gr.addColorStop(.39,'rgba(169,224,255,.59)');gr.addColorStop(.5,'rgba(255,255,255,.92)');
        gr.addColorStop(.63,'rgba(162,221,255,.56)');gr.addColorStop(.82,'rgba(114,118,239,.20)');gr.addColorStop(1,'rgba(92,91,214,0)');
        g.fillStyle=gr;g.fillRect(0,0,384,896);
        for(let i=0;i<25;i++){
          const x=80+r()*230;
          g.save();g.strokeStyle=i%3?'rgba(210,236,255,.46)':'rgba(251,251,255,.79)';g.lineWidth=.8+r()*2.6;
          g.shadowColor='#a5dfff';g.shadowBlur=11;
          g.beginPath();g.moveTo(x,-20);g.bezierCurveTo(x-30+r()*60,310,x+50-r()*90,590,x-12+r()*28,920);g.stroke();g.restore();
        }
      }else if(id==='sacredFlares'){
        // Blooming starburst: pale cyan to soft gold, tapered rays and light-petals.
        const cx=256,cy=256;
        g.fillStyle=beam(cx,cy,248,[[0,'rgba(255,255,255,.95)'],[.18,'rgba(229,249,255,.60)'],[.50,'rgba(155,188,255,.16)'],[1,'rgba(85,88,202,0)']]);
        g.fillRect(0,0,512,512);
        for(let i=0;i<36;i++){
          const a=TAU*i/36,ra=32+r()*40,rb=170+r()*76;
          g.save();g.rotate(0);g.globalAlpha=.21+r()*.43;
          g.fillStyle=i%5===0?'#f8ebd0':i%2?'#bdefff':'#eff2ff';
          g.shadowColor='#a8d7ff';g.shadowBlur=12;
          g.beginPath();g.moveTo(cx+Math.cos(a-.015)*ra,cy+Math.sin(a-.015)*ra);
          g.lineTo(cx+Math.cos(a)*rb,cy+Math.sin(a)*rb);
          g.lineTo(cx+Math.cos(a+.015)*ra,cy+Math.sin(a+.015)*ra);g.closePath();g.fill();g.restore();
        }
      }else if(id==='iceCrown'){
        const cx=256,cy=256;
        g.fillStyle=beam(cx,cy,220,[[0,'rgba(237,251,255,.96)'],[.22,'rgba(183,238,255,.80)'],[.58,'rgba(79,176,255,.22)'],[1,'rgba(18,52,108,0)']]);
        g.fillRect(0,0,512,512);
        g.save();g.translate(cx,cy);
        for(let i=0;i<14;i++){
          g.rotate(TAU/14);
          g.fillStyle=i%2?'rgba(229,251,255,.93)':'rgba(150,226,255,.88)';
          g.beginPath();g.moveTo(0,-198);g.lineTo(18,-82);g.lineTo(-18,-82);g.closePath();g.fill();
        }
        g.restore();
        g.strokeStyle='rgba(237,250,255,.92)';g.lineWidth=8;g.setLineDash([24,10]);
        g.beginPath();g.arc(cx,cy,152,0,TAU);g.stroke();
        g.setLineDash([]);g.strokeStyle='rgba(96,202,255,.65)';g.lineWidth=18;
        g.beginPath();g.arc(cx,cy,116,0,TAU);g.stroke();
      }else if(id==='iceBurst'){
        g.translate(256,256);
        for(let i=0;i<22;i++){
          const a=(i/22)*TAU, len=120+(i%4)*26;
          g.save(); g.rotate(a);
          const gr=g.createLinearGradient(0,-12,len,12);
          gr.addColorStop(0,'rgba(255,255,255,.98)'); gr.addColorStop(.45,'rgba(179,240,255,.86)'); gr.addColorStop(1,'rgba(56,153,255,0)');
          g.fillStyle=gr; g.beginPath();
          g.moveTo(0,-10); g.lineTo(len,0); g.lineTo(0,10); g.lineTo(48,0); g.closePath(); g.fill();
          g.restore();
        }
        g.setTransform(1,0,0,1,0,0);
        g.fillStyle=beam(256,256,94,[[0,'rgba(255,255,255,.96)'],[.45,'rgba(174,237,255,.65)'],[1,'rgba(0,0,0,0)']]);
        g.fillRect(0,0,512,512);
      }else if(id==='warpRing'){
        for(let i=0;i<3;i++){
          const r0=70+i*55; g.strokeStyle=i%2?'rgba(176,236,255,.82)':'rgba(93,173,255,.75)'; g.lineWidth=18-i*4;
          g.setLineDash(i%2?[12,10]:[30,14]); g.beginPath(); g.arc(256,256,r0,0,TAU); g.stroke();
        }
        g.setLineDash([]); g.strokeStyle='rgba(244,252,255,.90)'; g.lineWidth=6; g.beginPath(); g.arc(256,256,56,0,TAU); g.stroke();
        g.fillStyle=beam(256,256,190,[[0,'rgba(255,255,255,.26)'],[.56,'rgba(133,221,255,.12)'],[1,'rgba(0,0,0,0)']]); g.fillRect(0,0,512,512);
      }else if(id==='royalSlash'){
        g.translate(320,160); g.rotate(-.18);
        for(let k=0;k<3;k++){
          g.strokeStyle=k===0?'rgba(255,255,255,.96)':(k===1?'rgba(154,227,255,.85)':'rgba(61,146,255,.45)');
          g.lineWidth=k===0?22:(k===1?40:68);
          g.beginPath(); g.moveTo(-250,-42+k*2); g.bezierCurveTo(-120,-92,40,16,270,22+k*5); g.stroke();
        }
        g.setTransform(1,0,0,1,0,0);
        g.fillStyle=beam(338,170,170,[[0,'rgba(255,255,255,.45)'],[.35,'rgba(157,232,255,.22)'],[1,'rgba(0,0,0,0)']]); g.fillRect(0,0,640,320);
      }else if(id==='healBloom'){
        g.translate(256,256);
        for(let i=0;i<10;i++){
          g.rotate(TAU/10); g.fillStyle=i%2?'rgba(212,248,255,.90)':'rgba(130,214,255,.82)';
          g.beginPath(); g.moveTo(0,-18); g.bezierCurveTo(50,-120,88,-154,0,-220); g.bezierCurveTo(-88,-154,-50,-120,0,-18); g.fill();
        }
        g.setTransform(1,0,0,1,0,0);
        g.fillStyle=beam(256,256,210,[[0,'rgba(255,255,255,.85)'],[.35,'rgba(165,240,255,.55)'],[1,'rgba(0,0,0,0)']]); g.fillRect(0,0,512,512);
      }
      else if(id==='mist'){
        const cx=256,cy=256;
        for(let i=0;i<120;i++){
          const x=r()*512,y=r()*512,ra=16+r()*66;
          g.globalAlpha=.05+r()*.12;
          g.fillStyle=beam(x,y,ra,[[0,r()<.5?'rgba(155,213,255,.62)':'rgba(200,180,255,.62)'],[1,'rgba(65,130,237,0)']]);
          g.fillRect(x-ra,y-ra,ra*2,ra*2);
        }
        g.globalAlpha=1;
      }
      const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
      t.minFilter=THREE.LinearMipmapLinearFilter;
      t.magFilter=THREE.LinearFilter;t.generateMipmaps=true;
      return t;
    }
    function tex(id){
      if(!textures[id])textures[id]=stagePaint(id);
      return textures[id];
    }
    function warmup(){
      if(prewarmScheduled)return;prewarmScheduled=true;
      const order=['earth','heaven','storm','celestialGate','swordWings','boltA','boltB','boltC',
        'sparkVeil','stormThreads','shockHalo','bladeWake','sacredFlares','sword','nova','mist','pillar',
        'planetWarm','planetCold','planetEarth','friction','iceCrown','iceBurst','warpRing','royalSlash','healBloom'];
      let cursor=0;
      const step=(deadline)=>{
        let made=0;
        while(cursor<order.length && made<2 && (!deadline||deadline.timeRemaining()>3)){
          tex(order[cursor++]);made++;
        }
        if(cursor<order.length) schedule(step);
      };
      schedule(step);
    }
    function schedule(fn){
      if(typeof requestIdleCallback==='function')requestIdleCallback(fn,{timeout:2000});
      else setTimeout(()=>fn({timeRemaining:()=>50}),30);
    }
    warmup();

    function findTarget(b,f,net){
      if(net && Number.isFinite(net.tx) && Number.isFinite(net.tz)){
        const foes=typeof b.enemiesOf==='function'?b.enemiesOf(f):[];
        let best=null,bestD=Infinity;
        for(const foe of foes){
          if(!foe||foe.dead)continue;
          const dx=(foe.pos?.x||0)-net.tx,dz=(foe.pos?.z||0)-net.tz,d=dx*dx+dz*dz;
          if(d<bestD){bestD=d;best=foe;}
        }
        if(best)return best;
      }
      return typeof b.nearestEnemy==='function'?b.nearestEnemy(f):null;
    }
    function holdTarget(target,lift,stun=.32){
      if(!target||target.dead)return;
      target.stun=Math.max(target.stun||0,stun);
      target.guard=false; target.action=null; target.vel?.set?.(0,0,0);
      if(target.visual) target.visual.position.y=lift;
    }
    function releaseTarget(target){
      if(target?.visual) target.visual.position.y=0;
    }
    function guaranteedHit(b,f,target,attack){
      if(!target || target.dead || !target.pos || typeof target.receive !== 'function')return 0;
      // Only the local simulation can change health. Remote entities are cosmetic.
      if(f.remoteAuth || target.remoteAuth)return 0;
      const dx=target.pos.x-f.pos.x,dz=target.pos.z-f.pos.z;
      const len=Math.hypot(dx,dz)||1,kb=Number(attack.kb)||0;
      const attackStat=clamp(Number(f.atkMul)||1,.5,8);
      let incoming=Math.max(0,Math.round((Number(attack.dmg)||0)*attackStat));
      if(!attack.finisher){
        // Multi-stage cinema: keep the target alive until the last sword / blast.
        // This avoids a weak foe ending the battle before the finale can appear.
        const def=Math.max(.02,Number(target.defMul)||1);
        const effect=def*(target.status?.curse?1.3:1)*(target.awakened>0?.5:1);
        const safe=Math.max(0,Math.floor((Math.max(0,target.hp-1)-.5)/Math.max(.02,effect)));
        incoming=Math.min(incoming,safe);
      }
      if(incoming<=0){
        target.stun=Math.max(Number(target.stun)||0,Math.min(.65,Number(attack.stun)||.28));
        target.guard=false;
        target.vel?.set?.(0,0,0);
        return 0;
      }
      const dealt=target.receive(incoming,Number(attack.stun)||0,dx/len*kb,dz/len*kb);
      if(attack.showDamage && Number(dealt)>0)
        b.ui?.popup?.(target.pos,Math.round(dealt),attack.finisher?'#ffdfac':'#c5eaff');
      return dealt;
    }
    function performShiningSpear(b,f,net,scale=1){
      if(!b?.fx || b.ended || !f || f.dead)return;
      const target=findTarget(b,f,net); if(!target) return;
      const x=target.pos.x,z=target.pos.z;
      const HOLY={kind:'shining-spear',elem:5,color:0xf5fbff};
      const hits=[...Array(8)].map((_,i)=>({at:.70+i*.14,dmg:225,stun:.42,kb:0,spec:HOLY,radius:2.1,showDamage:i%2===0}))
        .concat([{at:2.08,dmg:1500,stun:1.2,kb:10,spec:HOLY,radius:4.8,finisher:true,showDamage:true}]);
      const root=new THREE.Group(); b.fx.add(root);
      const mats=[], geos=[];
      const add=(id,pos,sx,sy,flat=false,opacity=1,additive=true)=>{
        const texture=tex(id); if(!texture) return null;
        const opts={map:texture,color:0xffffff,transparent:true,opacity,depthWrite:false,
          depthTest:flat,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
          fog:false,side:THREE.DoubleSide};
        const mat=flat?new THREE.MeshBasicMaterial(opts):new THREE.SpriteMaterial(opts);
        const obj=flat?new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat):new THREE.Sprite(mat);
        obj.position.copy(pos); obj.scale.set(sx,sy,1); obj.renderOrder=flat?5:6;
        if(flat)obj.rotation.x=-Math.PI/2;
        root.add(obj); mats.push(mat); if(flat)geos.push(obj.geometry); return obj;
      };
      const ring=add('earth',new THREE.Vector3(x,.08,z),6.8,6.8,true,0);
      const prison=add('celestialGate',new THREE.Vector3(x,4.0,z),11.2,10.4,false,0,false);
      const burst=add('nova',new THREE.Vector3(x,2.4,z),2.4,2.4,false,0);
      const halo=add('shockHalo',new THREE.Vector3(x,.14,z),3.1,3.1,true,0);
      const mist=add('mist',new THREE.Vector3(x,1.4,z),7.2,4.5,false,0);
      const swords=[0,1,2,3,4,5,6,7].map(i=>add('sword',new THREE.Vector3(x,3.0,z),3.2,8.2,false,0,false));
      for(const s of swords){ if(s?.material?.color) s.material.color.setHex(0xf7faff); }
      let cleaned=false,elapsed=0,next=0;
      const cleanup=()=>{ if(cleaned)return; cleaned=true; releaseTarget(target); b.__astralFxCleanups?.delete(cleanup);root.removeFromParent(); for(const m of mats)m.dispose(); for(const g of geos)g.dispose(); };
      (b.__astralFxCleanups ||= new Set()).add(cleanup);
      if(f.isPlayer)b.ui.cutin?.(f,'光牢剣陣','LUMINOUS LEGION');
      b.ui.sfx?.('zap');
      b.addEffect(dt=>{
        if(cleaned)return false;
        dt=clamp(Number(dt)||0,0,.065); elapsed+=dt; const t=elapsed;
        const lift=2.75*clamp((t-.36)/.48,0,1)*(1-clamp((t-2.04)/.26,0,1));
        holdTarget(target,lift,.5);
        root.position.set((target.pos?.x||x)-x,0,(target.pos?.z||z)-z);
        if(ring){ ring.material.opacity=.82*clamp(t/.35,0,1)*(1-clamp((t-2.16)/.38,0,1)); ring.rotation.z+=dt*.45; ring.scale.setScalar(6.8*(.6+.4*clamp(t/.5,0,1))); }
        if(prison){ prison.material.opacity=.75*clamp((t-.1)/.35,0,1)*(1-clamp((t-2.12)/.35,0,1)); prison.material.rotation+=dt*.22; prison.position.y=3.5+lift*.7; }
        if(mist){ mist.material.opacity=.42*clamp((t-.2)/.5,0,1)*(1-clamp((t-2.1)/.5,0,1)); mist.position.y=1.4+lift*.3; }
        swords.forEach((s,i)=>{
          if(!s)return; const appear=t-(.52+i*.07); const ang=(Math.PI*2*i/8)+t*.18;
          const rr=Math.max(.5,4.8-appear*6.4); const yy=2.1+lift+(i%2?.35:-.1);
          s.position.set(x+Math.cos(ang)*rr,yy,z+Math.sin(ang)*rr);
          s.material.opacity=appear>-.08 && appear<.42 ? .95*(1-clamp((appear-.02)/.32,0,1)) : 0;
          s.scale.set(3.2,8.2+Math.sin(t*8+i)*.2,1);
        });
        while(next<hits.length && t>=hits[next].at){
          const idx=next++, attack=hits[idx]; guaranteedHit(b,f,target,{...attack,dmg:Math.round(attack.dmg*scale)});
          if(idx<8){ b.ui.sfx?.('zap'); b.fxPop?.(new THREE.Vector3(target.pos.x,1.4+lift,target.pos.z),5,1,2.0,.22,{grow:1.55,op:.84}); }
          else { b.ui.flash?.(); b.ui.sfx?.('burst'); b.fxPop?.(new THREE.Vector3(target.pos.x,1.2,target.pos.z),5,8,8.8,.58,{grow:2.4,op:.92}); b.flashLight?.(new THREE.Vector3(target.pos.x,2.2,target.pos.z),0xffffff,1.9,.42); b.shake=Math.max(b.shake||0,.9); }
        }
        const post=clamp((t-2.08)/.8,0,1);
        if(halo){ halo.material.opacity=(next>=9)?.95*Math.pow(1-post,1.35):0; halo.scale.setScalar(3.1+18*post); }
        if(burst){ burst.material.opacity=(next>=9)?.97*Math.pow(1-post,1.45):0; burst.scale.set(2.4+12*post,2.4+12*post,1); burst.position.y=2.4+lift*.15; }
        if(t>=2.85){ cleanup(); return false; }
        return true;
      });
    }
    function perform(b,f,net,scale=1){
      if(!b?.fx || b.ended || !f || f.dead)return;
      const target=findTarget(b,f,net);
      const fw=typeof f.forward==='function'?f.forward():new THREE.Vector3(Math.sin(f.facing||0),0,Math.cos(f.facing||0));
      const x=target?.pos?.x??(f.pos.x+fw.x*5), z=target?.pos?.z??(f.pos.z+fw.z*5);
      const THUNDER={kind:'judgment-thunder',elem:3,color:0xa6b8ff};
      const SWORD={kind:'judgment-sword',elem:5,color:0xffb25d};
      const EXPLODE={kind:'judgment-burst',elem:5,color:0xffdf9f};
      const attacks=[];
      for(let i=0;i<10;i++)attacks.push({at:.68+i*.13,dmg:255,stun:.42,kb:0,spec:THUNDER,radius:2.4,showDamage:i%3===0});
      attacks.push({at:2.18,dmg:1000,stun:.78,kb:0,spec:SWORD,radius:3.0,showDamage:true});
      attacks.push({at:2.54,dmg:1850,stun:1.28,kb:12,spec:EXPLODE,radius:6.0,finisher:true,showDamage:true});
      const root=new THREE.Group(); b.fx.add(root); active++;
      const mats=[], shapes=[];
      const add=(id,pos,sx,sy,flat=false,opacity=1,additive=true)=>{
        const texture=tex(id); if(!texture)return null;
        const opts={map:texture,color:0xffffff,transparent:true,opacity,depthWrite:false,
          depthTest:flat,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
          fog:false,side:THREE.DoubleSide};
        const mat=flat?new THREE.MeshBasicMaterial(opts):new THREE.SpriteMaterial(opts);
        const obj=flat?new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat):new THREE.Sprite(mat);
        obj.position.copy(pos); obj.scale.set(sx,sy,1); obj.renderOrder=flat?5:6;
        if(flat)obj.rotation.x=-Math.PI/2;
        root.add(obj); mats.push(mat); if(flat)shapes.push(obj.geometry); return obj;
      };
      const ground=add('earth',new THREE.Vector3(x,.08,z),7.4,7.4,true,0);
      const gate=add('celestialGate',new THREE.Vector3(x,8.5,z),15.2,14.2,false,0,false);
      const vortex=add('stormThreads',new THREE.Vector3(x,.14,z),10.2,10.2,true,0);
      const pillar=add('pillar',new THREE.Vector3(x,6.2,z),6.4,18.0,false,0);
      const storm=add('storm',new THREE.Vector3(x,8.5,z),13.4,8.7,false,0);
      const sword=add('sword',new THREE.Vector3(x,23.0,z),8.2,20.8,false,0,false);
      const bladeWake=add('bladeWake',new THREE.Vector3(x,13.2,z),8.6,20.8,false,0);
      const wings=add('swordWings',new THREE.Vector3(x,15.4,z),19.6,10.6,false,0,false);
      const halo=add('shockHalo',new THREE.Vector3(x,.14,z),3.2,3.2,true,0);
      const flare=add('nova',new THREE.Vector3(x,1.4,z),3,3,false,0);
      const mist=add('mist',new THREE.Vector3(x,2.6,z),10.8,6.4,false,0);
      const bolts=[0,1,2,3,4,5,6,7,8,9].map(i=>add(i%3===0?'boltA':i%3===1?'boltB':'boltC',new THREE.Vector3(x,5.8,z),3.1,10.8,false,0));
      for(const s of [sword,bladeWake,wings,pillar]){ if(s?.material?.color) s.material.color.setHex(s===pillar?0xffcb7d:0xff9f42); }
      let cleaned=false,elapsed=0,next=0;
      const cleanup=()=>{
        if(cleaned)return; cleaned=true; releaseTarget(target); b.__astralFxCleanups?.delete(cleanup);
        root.removeFromParent(); for(const m of mats)m.dispose(); for(const g of shapes)g.dispose(); active=Math.max(0,active-1);
      };
      (b.__astralFxCleanups ||= new Set()).add(cleanup);
      if(f.isPlayer)b.ui.cutin?.(f,'蒼天雷裁','ASTRAL JUDGMENT');
      b.ui.sfx?.('zap'); b.flashLight?.(new THREE.Vector3(x,2.2,z),0xffb25d,1.2,.45);
      const DURATION=4.0;
      b.addEffect(dt=>{
        if(cleaned)return false; if(!root.parent){cleanup();return false;}
        dt=clamp(Number(dt)||0,0,.065); elapsed+=dt; const t=elapsed;
        root.position.set((target?.pos?.x||x)-x,0,(target?.pos?.z||z)-z);
        const phaseIn=clamp(t/.55,0,1), longFade=1-clamp((t-2.9)/.8,0,1);
        const lift=target ? (3.1*clamp((t-.62)/1.12,0,1)*(1-clamp((t-2.18)/.28,0,1)) + .08*Math.sin(t*36)) : 0;
        if(target) holdTarget(target, lift, .55);
        if(ground){ ground.material.opacity=.8*phaseIn*longFade; ground.rotation.z+=dt*.42; ground.scale.setScalar(7.4*(.45+.55*phaseIn)); }
        if(gate){ gate.material.opacity=.82*phaseIn*longFade; gate.material.rotation+=dt*.13; gate.position.y=8.5+lift*.4; }
        if(vortex){ vortex.material.opacity=.72*clamp((t-.1)/.3,0,1)*longFade; vortex.rotation.z-=dt*1.2; }
        if(storm){ storm.material.opacity=.36*clamp((t-.2)/.3,0,1)*longFade; storm.position.y=8.5+Math.sin(t*2)*.4; }
        if(mist){ mist.material.opacity=.46*clamp((t-.3)/.4,0,1)*(1-clamp((t-2.65)/1.1,0,1)); mist.position.y=2.6+lift*.3; }
        bolts.forEach((b0,i)=>{
          if(!b0)return; const local=t-(.62+i*.13); b0.material.opacity=local>=-.05 && local<.26 ? .98*(1-clamp((local-.02)/.18,0,1)) : 0;
          const angle=(i/10)*Math.PI*2+t*1.2, rr=.45+i*.05;
          b0.position.x=x+Math.cos(angle)*rr; b0.position.z=z+Math.sin(angle)*rr; b0.position.y=5.8+lift*.45;
        });
        const drop=1-Math.pow(1-clamp((t-1.86)/.46,0,1),3);
        if(sword){ sword.material.opacity=clamp((t-1.45)/.3,0,1)*(1-clamp((t-2.72)/.35,0,1)); sword.position.y=23.0-drop*20.3; }
        if(bladeWake){ bladeWake.material.opacity=.7*clamp((t-1.62)/.28,0,1)*(1-clamp((t-2.72)/.4,0,1)); bladeWake.position.y=13.2-drop*9.8; }
        if(wings){ wings.material.opacity=.84*clamp((t-1.3)/.42,0,1)*(1-clamp((t-2.55)/.55,0,1)); wings.position.y=15.4-drop*10.7; }
        if(pillar){ pillar.material.opacity=.64*clamp((t-.5)/.4,0,1)*(1-clamp((t-2.62)/.55,0,1)); }
        while(next<attacks.length && t>=attacks[next].at){
          const i=next++, attack=attacks[i];
          if(target) guaranteedHit(b,f,target,{...attack,dmg:Math.round(attack.dmg*scale)}); else if(typeof b.strikeAt==='function') b.strikeAt(f,x,z,attack.radius,attack.dmg,attack.stun,attack.kb,attack.spec);
          if(i<10){
            b.ui.sfx?.('zap'); b.fxPop?.(new THREE.Vector3((target?.pos?.x||x),1.4+lift,(target?.pos?.z||z)),2,1,2.3,.18,{grow:1.6,op:.78}); b.shake=Math.max(b.shake||0,.2);
          }else if(i===10){
            b.ui.sfx?.('burst'); b.fxPop?.(new THREE.Vector3((target?.pos?.x||x),1.7+lift*.5,(target?.pos?.z||z)),5,8,5.8,.26,{grow:1.45,op:.88}); b.flashLight?.(new THREE.Vector3((target?.pos?.x||x),2.6,(target?.pos?.z||z)),0xffa24a,1.4,.25);
          }else{
            b.ui.flash?.(); b.ui.sfx?.('burst'); b.fxPop?.(new THREE.Vector3((target?.pos?.x||x),1.1,(target?.pos?.z||z)),5,8,13.2,.64,{grow:2.8,op:.95}); b.flashLight?.(new THREE.Vector3((target?.pos?.x||x),2.0,(target?.pos?.z||z)),0xfff1d2,2.2,.48); b.shake=Math.max(b.shake||0,1.1);
          }
        }
        const post=clamp((t-2.54)/.95,0,1);
        if(halo){ halo.material.opacity=(next>=12)?.96*Math.pow(1-post,1.35):0; halo.scale.setScalar(3.2+26*post); }
        if(flare){ flare.material.opacity=(next>=12)?.98*Math.pow(1-post,1.45):(next>=11?.15:0); flare.scale.set(3+16*post,3+16*post,1); }
        if(t>=DURATION){ cleanup(); return false; }
        return true;
      });
    }

    function performLastVanisher(b,f,net){
      if(!b?.fx || b.ended || !f || f.dead)return;
      const target=findTarget(b,f,net);
      const fw=typeof f.forward==='function'?f.forward():new THREE.Vector3(Math.sin(f.facing||0),0,Math.cos(f.facing||0));
      const x=target?.pos?.x??(f.pos.x+fw.x*4.5),z=target?.pos?.z??(f.pos.z+fw.z*4.5);
      const FRICTION={kind:'last-vanisher-friction',elem:2,color:0xffa55e};
      const FINAL={kind:'last-vanisher-blast',elem:5,color:0xffe7ac};
      // 14 hot-and-cold friction pulses followed by one devastating crash.
      const hits=Array.from({length:14},(_,i)=>({at:1.01+i*.16,dmg:375,stun:.42,kb:0,spec:FRICTION,radius:4.2,showDamage:i%3===0}));
      hits.push({at:3.42,dmg:2850,stun:1.3,kb:13,spec:FINAL,radius:7.5,finisher:true,showDamage:true});
      const root=new THREE.Group();b.fx.add(root);const mats=[],geos=[];
      const add=(id,pos,w,h,flat=false)=>{
        const texture=tex(id);if(!texture)return null;
        const options={map:texture,transparent:true,opacity:0,color:0xffffff,depthWrite:false,
          depthTest:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false};
        const material=flat?new THREE.MeshBasicMaterial(options):new THREE.SpriteMaterial(options);
        const object=flat?new THREE.Mesh(new THREE.PlaneGeometry(1,1),material):new THREE.Sprite(material);
        object.position.copy(pos);object.scale.set(w,h,1);object.renderOrder=9;
        if(flat)object.rotation.x=-Math.PI/2;
        root.add(object);mats.push(material);if(flat)geos.push(object.geometry);return object;
      };
      const sky=add('planetCold',new THREE.Vector3(x+1.1,15,z),9.1,9.1);
      const fire=add('planetWarm',new THREE.Vector3(x-1.1,.45,z),9.1,9.1);
      const energy=add('friction',new THREE.Vector3(x,4.5,z),9.8,9.8);
      const storm=add('stormThreads',new THREE.Vector3(x,.11,z),11.7,11.7,true);
      const sigil=add('earth',new THREE.Vector3(x,.075,z),9.4,9.4,true);
      const flash=add('nova',new THREE.Vector3(x,4.4,z),4.2,4.2);
      const halo=add('shockHalo',new THREE.Vector3(x,.17,z),4.3,4.3,true);
      let elapsed=0,next=0,cleaned=false;
      const clean=()=>{
        if(cleaned)return;cleaned=true;releaseTarget(target);
        b.__astralFxCleanups?.delete(clean);root.removeFromParent();
        for(const m of mats)m.dispose();for(const g of geos)g.dispose();
      };
      (b.__astralFxCleanups ||= new Set()).add(clean);
      b.ui.cutin?.(f,'双星崩滅','TWIN CATACLYSM');
      b.ui.sfx?.('burst');
      b.addEffect(dt=>{
        if(cleaned)return false;
        if(!root.parent){clean();return false;}
        elapsed+=clamp(Number(dt)||0,0,.065);const t=elapsed;
        const xp=target?.pos?.x??x,zp=target?.pos?.z??z;
        root.position.set(xp-x,0,zp-z);
        const clash=clamp((t-.10)/.95,0,1),grind=clamp((t-1.02)/.22,0,1);
        const vanish=1-clamp((t-3.46)/.8,0,1);
        if(target&&!target.dead && t<3.42)holdTarget(target,.28*Math.sin(t*22),.36);
        if(sky){sky.material.opacity=.96*clamp(t/.28,0,1)*vanish;
          sky.position.y=15-clash*10.4+.13*Math.sin(t*10)*grind;
          sky.position.x=x+1.2*(1-clash);sky.material.rotation+=dt*.35;
        }
        if(fire){fire.material.opacity=.95*clamp(t/.28,0,1)*vanish;
          fire.position.y=.55+clash*3.85-.13*Math.sin(t*11)*grind;
          fire.position.x=x-1.2*(1-clash);fire.material.rotation-=dt*.42;
        }
        if(energy){energy.material.opacity=.83*grind*vanish;
          energy.material.rotation+=dt*3.2;energy.scale.set(9.8*(.79+.19*Math.sin(t*18)),9.8*(.83+.13*Math.cos(t*14)),1);
        }
        if(storm){storm.material.opacity=.7*clamp((t-.16)/.58,0,1)*vanish;
          storm.rotation.z+=dt*2.7;storm.scale.setScalar(11.7*(.77+.2*clash));
        }
        if(sigil){sigil.material.opacity=.52*clamp(t/.44,0,1)*vanish;sigil.rotation.z-=dt*.73;}
        while(next<hits.length && t>=hits[next].at){
          const index=next++,hit=hits[index];
          if(target)guaranteedHit(b,f,target,hit);
          else b.strikeAt?.(f,x,z,hit.radius,hit.dmg,hit.stun,hit.kb,hit.spec);
          if(index<14){
            if(index%2===0)b.ui.sfx?.('zap');
            b.flashLight?.(new THREE.Vector3(xp,3.3,zp),index%2?0x77d6ff:0xff9d50,.8,.17);
            if(index%3===0)b.fxPop?.(new THREE.Vector3(xp,4.1,zp),index%2?1:0,1,2.1,.22,{grow:2.2,op:.68});
          }else{
            b.ui.flash?.();b.ui.sfx?.('burst');b.shake=Math.max(b.shake||0,1.15);
            b.flashLight?.(new THREE.Vector3(xp,3.6,zp),0xffeac6,2.2,.54);
            b.fxPop?.(new THREE.Vector3(xp,2.4,zp),0,8,13.6,.72,{grow:2.4,op:.95});
            b.fxPop?.(new THREE.Vector3(xp,.16,zp),5,4,9.3,.65,{flat:true,grow:3.3,op:.83});
          }
        }
        const post=clamp((t-3.42)/1.0,0,1);
        if(flash){flash.material.opacity=(next>=15)?.97*Math.pow(1-post,1.2):0;
          flash.scale.set(4.2+23*post,4.2+23*post,1);
        }
        if(halo){halo.material.opacity=(next>=15)?.94*Math.pow(1-post,1.35):0;
          halo.scale.setScalar(4.3+24*post);
        }
        if(t>=4.65){clean();return false;}return true;
      });
    }

    function showCastingCircle(b,f,slot){
      if(!b?.fx || !f || f.dead) return;
      const root=new THREE.Group(); b.fx.add(root);
      const mats=[], geos=[];
      const add=(id,pos,w,h,flat=false,op=1,color=0xffffff,additive=true)=>{
        const map=tex(id); if(!map) return null;
        const opts={map,transparent:true,opacity:op,color,depthWrite:false,depthTest:flat,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,side:THREE.DoubleSide,fog:false};
        const material=flat?new THREE.MeshBasicMaterial(opts):new THREE.SpriteMaterial(opts);
        const obj=flat?new THREE.Mesh(new THREE.PlaneGeometry(1,1),material):new THREE.Sprite(material);
        obj.position.copy(pos); obj.scale.set(w,h,1); obj.renderOrder=flat?5:8; if(flat)obj.rotation.x=-Math.PI/2;
        root.add(obj); mats.push(material); if(flat)geos.push(obj.geometry); return obj;
      };
      const baseX=f.pos.x, baseZ=f.pos.z;
      const spec=(slot==='over')?f.def?.over:(slot==='hi')?f.def?.hi:/^[sf](\d+)$/.test(slot)?f.def?.skills?.[+slot.slice(1)]:null;
      const dur=clamp((Number(spec?.castTime)||1.2)+0.35, .8, 3.2);
      const ring=add('heaven',new THREE.Vector3(baseX,.08,baseZ),4.7,4.7,true,0,0xdff7ff);
      const gate=add('celestialGate',new THREE.Vector3(baseX,2.8,baseZ),7.1,7.1,false,0,0xffffff,false);
      const mist=add('mist',new THREE.Vector3(baseX,1.8,baseZ),5.3,4.1,false,0,0xffffff,true);
      let elapsed=0, cleaned=false;
      const clean=()=>{ if(cleaned)return; cleaned=true; root.removeFromParent(); for(const m of mats)m.dispose(); for(const g of geos)g.dispose(); };
      b.addEffect(dt=>{
        if(cleaned)return false;
        elapsed+=clamp(Number(dt)||0,0,.065);
        root.position.set(f.pos.x-baseX,0,f.pos.z-baseZ);
        const fadeIn=clamp(elapsed/.18,0,1), fadeOut=1-clamp((elapsed-(dur-.35))/.35,0,1);
        if(ring){ ring.material.opacity=.64*fadeIn*fadeOut; ring.rotation.z+=dt*.9; ring.scale.setScalar(4.7*(.84+.18*fadeIn)); }
        if(gate){ gate.material.opacity=.42*fadeIn*fadeOut; gate.material.rotation+=dt*.13; gate.position.y=2.8+.15*Math.sin(elapsed*3); }
        if(mist){ mist.material.opacity=.18*fadeIn*fadeOut; mist.position.y=1.8+.10*Math.sin(elapsed*5); }
        if(elapsed>=dur||f.dead){ clean(); return false; }
        return true;
      });
    }
    function performValgardCinematic(b,f,slot,net){
      if(!b?.fx || !f || f.dead || b.ended) return;
      const mode=(slot==='s1'||slot==='f1')?'warp':(slot==='s3'||slot==='f3')?'ice':(slot==='s4'||slot==='f4')?'heal':null;
      if(!mode) return;
      const target=(mode==='warp'||mode==='ice')?findTarget(b,f,net):null;
      const root=new THREE.Group(); b.fx.add(root);
      const mats=[], geos=[];
      const add=(id,pos,w,h,flat=false,op=1,color=0xffffff,additive=true)=>{
        const map=tex(id); if(!map) return null;
        const opts={map,transparent:true,opacity:op,color,depthWrite:false,depthTest:flat,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,side:THREE.DoubleSide,fog:false};
        const material=flat?new THREE.MeshBasicMaterial(opts):new THREE.SpriteMaterial(opts);
        const obj=flat?new THREE.Mesh(new THREE.PlaneGeometry(1,1),material):new THREE.Sprite(material);
        obj.position.copy(pos); obj.scale.set(w,h,1); obj.renderOrder=flat?5:8; if(flat)obj.rotation.x=-Math.PI/2;
        root.add(obj); mats.push(material); if(flat)geos.push(obj.geometry); return obj;
      };
      let a1=null,a2=null,a3=null,a4=null;
      if(mode==='warp'){
        const pos=target?.pos||f.pos;
        a1=add('warpRing',new THREE.Vector3(f.pos.x,.1,f.pos.z),3.2,3.2,true,0);
        a2=add('warpRing',new THREE.Vector3(pos.x,.1,pos.z),3.6,3.6,true,0);
        a3=add('royalSlash',new THREE.Vector3(pos.x,1.35,pos.z),7.6,3.8,false,0);
        a4=add('bladeWake',new THREE.Vector3(pos.x,1.8,pos.z),4.8,7.4,false,0);
      }else if(mode==='ice'){
        const pos=target?.pos || new THREE.Vector3(f.pos.x+(Math.sin(f.facing||0)*3.5),0,f.pos.z+(Math.cos(f.facing||0)*3.5));
        a1=add('iceCrown',new THREE.Vector3(pos.x,3.2,pos.z),6.2,6.2,false,0);
        a2=add('iceBurst',new THREE.Vector3(pos.x,1.6,pos.z),6.8,6.8,false,0);
        a3=add('pillar',new THREE.Vector3(pos.x,3.6,pos.z),4.2,12.8,false,0,0xcdefff);
        a4=add('shockHalo',new THREE.Vector3(pos.x,.12,pos.z),3.2,3.2,true,0,0xd9f7ff);
      }else if(mode==='heal'){
        a1=add('healBloom',new THREE.Vector3(f.pos.x,2.7,f.pos.z),8.2,8.2,false,0);
        a2=add('planetEarth',new THREE.Vector3(f.pos.x,6.8,f.pos.z-3.6),11.8,11.8,false,0);
        a3=add('shockHalo',new THREE.Vector3(f.pos.x,.12,f.pos.z),3.6,3.6,true,0,0xbef5ff);
      }
      let elapsed=0, cleaned=false;
      const clean=()=>{ if(cleaned)return; cleaned=true; root.removeFromParent(); for(const m of mats)m.dispose(); for(const g of geos)g.dispose(); };
      b.addEffect(dt=>{
        if(cleaned)return false;
        elapsed+=clamp(Number(dt)||0,0,.065);
        const t=elapsed, fadeIn=clamp(t/.22,0,1), fadeOut=1-clamp((t-1.15)/.42,0,1);
        if(mode==='warp'){
          const pos=target?.pos||f.pos;
          if(a1){ a1.material.opacity=.84*fadeIn*fadeOut; a1.position.set(f.pos.x,.1,f.pos.z); a1.scale.setScalar(3.2+.9*t); a1.rotation.z+=dt*1.6; }
          if(a2){ a2.material.opacity=.9*clamp((t-.08)/.18,0,1)*fadeOut; a2.position.set(pos.x,.1,pos.z); a2.scale.setScalar(3.6+1.2*t); a2.rotation.z-=dt*1.9; }
          if(a3){ a3.material.opacity=.98*clamp((t-.16)/.14,0,1)*(1-clamp((t-.68)/.28,0,1)); a3.position.set(pos.x,1.35,pos.z); }
          if(a4){ a4.material.opacity=.75*clamp((t-.2)/.12,0,1)*(1-clamp((t-.7)/.28,0,1)); a4.position.set(pos.x,1.8,pos.z); }
        }else if(mode==='ice'){
          const pos=target?.pos || new THREE.Vector3(f.pos.x+(Math.sin(f.facing||0)*3.5),0,f.pos.z+(Math.cos(f.facing||0)*3.5));
          if(a1){ a1.material.opacity=.82*fadeIn*fadeOut; a1.material.rotation+=dt*.22; a1.position.set(pos.x,3.2,pos.z); }
          if(a2){ a2.material.opacity=.9*clamp((t-.18)/.25,0,1)*(1-clamp((t-.9)/.28,0,1)); a2.position.set(pos.x,1.6,pos.z); a2.scale.setScalar(6.8*(.8+.25*Math.sin(t*10))); }
          if(a3){ a3.material.opacity=.45*clamp((t-.08)/.2,0,1)*fadeOut; a3.position.set(pos.x,3.6,pos.z); }
          if(a4){ a4.material.opacity=.88*clamp((t-.14)/.14,0,1)*(1-clamp((t-.96)/.3,0,1)); a4.position.set(pos.x,.12,pos.z); a4.scale.setScalar(3.2+5.8*clamp((t-.2)/.9,0,1)); }
        }else if(mode==='heal'){
          if(a1){ a1.material.opacity=.82*fadeIn*fadeOut; a1.material.rotation+=dt*.1; a1.position.set(f.pos.x,2.7,f.pos.z); }
          if(a2){ a2.material.opacity=.78*fadeIn*fadeOut; a2.material.rotation+=dt*.06; a2.position.set(f.pos.x,6.8,f.pos.z-3.6); }
          if(a3){ a3.material.opacity=.64*fadeIn*fadeOut; a3.position.set(f.pos.x,.12,f.pos.z); a3.scale.setScalar(3.6+5*clamp(t/1.3,0,1)); }
        }
        if(t>=1.6 || f.dead){ clean(); return false; }
        return true;
      });
    }

    function performEvolvedFollowVisual(b,f,slot,net){
      if(!b?.fx || !f || f.dead || !/^f\d+$/.test(slot)) return;
      const idx=+slot.slice(1);
      const spec=f.def?.skills?.[idx]||{};
      const elem=Number(spec.elem)||0;
      const name=`${spec.name||''}`;
      const kind=`${spec.kind||''}`;
      const actor=`${f.key||f.id||f.name||'fighter'}`;
      const support=/heal|cure|regen|earth|再生|回復|healer/i.test(name+kind);
      const target=findTarget(b,f,net);
      const point=support?f.pos:(target?.pos || new THREE.Vector3(f.pos.x+(Math.sin(f.facing||0)*3.8),0,f.pos.z+(Math.cos(f.facing||0)*3.8)));
      const hash=(str)=>{ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; };
      let seed=hash(`${actor}|${slot}|${name}|${kind}|${elem}`);
      const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      const root=new THREE.Group(); b.fx.add(root);
      const mats=[], geos=[];
      const palette=[
        [0xe8f7ff,0x9adfff,0x5eacff],[0xfff0bd,0xffc86b,0xff9153],[0xf3e3ff,0xcbabff,0x8a64ff],
        [0xc9ffff,0x6be0ff,0x249dff],[0xffc6d9,0xff7db0,0xf05d92],[0xeaf5ff,0xd8ecff,0x9dc8ff],
        [0xdfffd9,0x9dff96,0x4fd763],[0xffdeb9,0xffaf63,0xff6d2e],[0xd9fff1,0x84f0d1,0x2bc0a4],[0xffd9f5,0xff98e1,0xd45cff]
      ];
      const [c0,c1,c2]=palette[elem]||palette[seed%palette.length];
      const tintPick=(arr,ofs=0)=>arr[(Math.floor(rand()*arr.length)+ofs)%arr.length];
      const make=(id,pos,w,h,flat=false,op=1,color=0xffffff,additive=true)=>{
        const map=tex(id); if(!map) return null;
        const opts={map,transparent:true,opacity:op,color,depthWrite:false,depthTest:flat,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,side:THREE.DoubleSide,fog:false};
        const mat=flat?new THREE.MeshBasicMaterial(opts):new THREE.SpriteMaterial(opts);
        const obj=flat?new THREE.Mesh(new THREE.PlaneGeometry(1,1),mat):new THREE.Sprite(mat);
        obj.position.copy(pos); obj.scale.set(w,h,1); obj.renderOrder=flat?5:8; if(flat)obj.rotation.x=-Math.PI/2;
        root.add(obj); mats.push(mat); if(flat) geos.push(obj.geometry); return obj;
      };
      const floorPool=['heaven','earth','warpRing','shockHalo'];
      const crownPool=['celestialGate','sparkVeil','storm','stormThreads','swordWings','sacredFlares','iceCrown'];
      const finPool=['bladeWake','royalSlash','boltA','boltB','boltC','pillar','iceBurst','nova','sword'];
      const accentPool=['mist','healBloom','planetWarm','planetCold','planetEarth','friction'];
      const floorAId=tintPick(floorPool);
      let floorBId=tintPick(floorPool,1); if(floorBId===floorAId) floorBId=floorPool[(floorPool.indexOf(floorAId)+1)%floorPool.length];
      const crownId=tintPick(crownPool), finAId=tintPick(finPool), finBId=tintPick(finPool,2), accentId=tintPick(accentPool);
      const attackModes=['cross','meteor','prison','orbit','spiral','judgment','cascade','bloom'];
      const supportModes=['sanctuary','rebirth','constellation','bloom'];
      const mode=support?supportModes[seed%supportModes.length]:attackModes[seed%attackModes.length];
      const floorA=make(floorAId,new THREE.Vector3(point.x,.08,point.z),5.2+rand()*2.4,5.2+rand()*2.4,true,0,c1,true);
      const floorB=make(floorBId,new THREE.Vector3(point.x,.09,point.z),4.0+rand()*1.8,4.0+rand()*1.8,true,0,c0,true);
      const veil=make(crownId,new THREE.Vector3(point.x,2.4,point.z),6.2+rand()*2.5,6.2+rand()*2.5,false,0,c1,true);
      const mist=make('mist',new THREE.Vector3(point.x,1.4,point.z),5.5+rand()*1.8,4.2+rand()*1.3,false,0,c0,true);
      const accent=make(accentId,new THREE.Vector3(point.x,support?2.8:2.0,point.z),6.0+rand()*4.2,6.0+rand()*4.2,false,0,c0,true);
      const finA=make(finAId,new THREE.Vector3(point.x,1.8,point.z),4.8+rand()*3.0,4.8+rand()*4.8,false,0,c2,true);
      const finB=make(finBId,new THREE.Vector3(point.x,2.4,point.z),4.2+rand()*4.0,4.2+rand()*4.0,false,0,c1,true);
      const finC=make(rand()>.5?'boltC':'pillar',new THREE.Vector3(point.x,4.2,point.z),2.4+rand()*2.4,8.0+rand()*5.0,false,0,c0,true);
      const satellites=[];
      const satCount=(support?4:5)+(seed%3);
      const satPool=support?['healBloom','sparkVeil','shockHalo','planetEarth','nova']:['bladeWake','boltA','boltB','sacredFlares','stormThreads','iceBurst','royalSlash'];
      for(let i=0;i<satCount;i++){
        const tid=satPool[(i+Math.floor(rand()*satPool.length))%satPool.length];
        const sp=make(tid,new THREE.Vector3(point.x,1.2+rand()*2.8,point.z),1.2+rand()*2.1,1.2+rand()*2.1,false,0,i%2?c0:c1,true);
        satellites.push({sp, r:1.4+rand()*2.9, h:.9+rand()*3.8, speed:(.7+rand()*1.8)*(i%2?-1:1), phase:rand()*TAU, grow:.8+rand()*1.6});
      }
      const petals=[];
      const trailCount=3+(seed%4);
      for(let i=0;i<trailCount;i++){
        const sp=make((i+seed)%2?'sparkVeil':'sacredFlares', new THREE.Vector3(point.x,2.0,point.z), 1.6+rand()*2.4,1.6+rand()*2.4,false,0,i%2?c1:c2,true);
        petals.push({sp, drift:(rand()-.5)*1.8, rise:.5+rand()*1.6, phase:rand()*TAU});
      }
      let elapsed=0, cleaned=false;
      const clean=()=>{ if(cleaned) return; cleaned=true; root.removeFromParent(); for(const m of mats)m.dispose(); for(const g of geos)g.dispose(); };
      b.addEffect(dt=>{
        if(cleaned) return false;
        dt=clamp(Number(dt)||0,0,.065); elapsed+=dt;
        const t=elapsed, fadeIn=clamp(t/.18,0,1), fadeOut=1-clamp((t-1.15)/.55,0,1);
        const live=support?f.pos:(target?.pos || point); const px=live.x, pz=live.z;
        const pulse=.75+.25*Math.sin(t*(4.2+(seed%5)));
        if(floorA){ floorA.position.set(px,.08,pz); floorA.material.opacity=.78*fadeIn*fadeOut; floorA.rotation.z+=dt*(.7+(seed%5)*.09); floorA.scale.setScalar((5.2+(seed%7)*.18) * (.82+.16*pulse)); }
        if(floorB){ floorB.position.set(px,.09,pz); floorB.material.opacity=.62*fadeIn*fadeOut; floorB.rotation.z-=dt*(1.0+(seed%7)*.11); floorB.scale.setScalar((4.2+(seed%5)*.23) * (.88+.18*Math.sin(t*3.4+1.1))); }
        if(veil){ veil.position.set(px,2.25 + .12*Math.sin(t*4.4),pz); veil.material.opacity=.44*fadeIn*fadeOut; veil.material.rotation += dt*(mode==='spiral'||mode==='constellation' ? -.34 : .22); veil.scale.set((6.2+(seed%6)*.25)*(.92+.10*pulse),(6.2+(seed%4)*.42)*(.92+.10*pulse),1); }
        if(mist){ mist.position.set(px,1.28+.18*Math.sin(t*5.1),pz); mist.material.opacity=.20*fadeIn*fadeOut; }
        if(accent){ accent.position.set(px, support?2.7:2.0, pz); accent.material.opacity=(support ? .82 : .48)*clamp((t-.08)/.18,0,1)*(mode==='rebirth' ? fadeOut*1.08 : fadeOut); accent.material.rotation += dt*(.06+(seed%5)*.03); accent.scale.set((6.0+(seed%9)*.36)*(.86+.16*fadeIn),(6.0+(seed%7)*.34)*(.86+.16*fadeIn),1); }
        if(finA){
          let y=1.9, rot=0, op=.75*clamp((t-.14)/.12,0,1)*(1-clamp((t-.88)/.26,0,1));
          if(mode==='meteor'){ y=3.8-2.2*clamp((t-.1)/.34,0,1); rot=t*2.1; }
          else if(mode==='cross'){ rot=.75+t*.2; }
          else if(mode==='orbit'){ rot=t*1.4; }
          else if(mode==='judgment'){ y=4.6-2.9*clamp((t-.18)/.42,0,1); rot=-.12; }
          else if(mode==='prison'){ y=2.3+Math.sin(t*10)*.2; rot=t*.6; }
          else if(mode==='bloom' || mode==='sanctuary'){ y=2.1+.3*Math.sin(t*5); rot=-t*.24; }
          finA.position.set(px,y,pz); finA.material.opacity=op; finA.material.rotation=rot;
        }
        if(finB){
          let y=1.4, op=.88*clamp((t-.2)/.14,0,1)*(1-clamp((t-.96)/.26,0,1));
          if(mode==='cascade') y=2.9-1.3*clamp((t-.15)/.32,0,1);
          else if(mode==='spiral') y=1.4+.6*Math.sin(t*7+1.2);
          else if(mode==='rebirth') y=2.8+.3*Math.cos(t*4);
          finB.position.set(px,y,pz); finB.material.opacity=op; finB.material.rotation += (mode==='cross' ? -dt*1.0 : dt*.42);
        }
        if(finC){
          const appear=clamp((t-.08)/.12,0,1), vanish=(1-clamp((t-.74)/.26,0,1));
          finC.position.set(px + (mode==='cross' ? Math.sin(t*8)*.35 : 0), mode==='judgment' ? 4.8-1.4*clamp((t-.14)/.35,0,1) : 4.2, pz);
          finC.material.opacity=(support ? 0 : .72)*appear*vanish;
          finC.scale.set(finC.scale.x, (8.0+(seed%6)) * (.92+.18*appear),1);
        }
        satellites.forEach((s,i)=>{
          if(!s.sp) return;
          const a=s.phase+t*s.speed;
          let x=px, y=s.h, z=pz;
          if(mode==='orbit' || mode==='constellation'){
            x+=Math.cos(a)*s.r; z+=Math.sin(a)*s.r; y=1.0+s.h*.45+.35*Math.sin(a*1.6);
          }else if(mode==='spiral' || mode==='rebirth'){
            const rr=s.r*(1-clamp((t-.15)/1.1,0,1)*.45); x+=Math.cos(a+t*.8)*rr; z+=Math.sin(a+t*.8)*rr; y=1.0+s.h*clamp((t/.9),0,1);
          }else if(mode==='meteor' || mode==='cascade'){
            x+=Math.cos(a)*(.5+s.r*.38); z+=Math.sin(a)*(.5+s.r*.38); y=4.8 - ((t*2.4+i*.22)%(4.6+s.h*.1));
          }else if(mode==='prison'){
            x+=Math.cos(a)*(2.0+s.r*.25); z+=Math.sin(a)*(2.0+s.r*.25); y=.8+s.h*.5;
          }else if(mode==='cross'){
            x+=Math.sin(a*1.5)*(1.1+s.r*.3); z+=Math.sin(a)*(1.1+s.r*.3); y=1.4+s.h*.35;
          }else if(mode==='bloom' || mode==='sanctuary'){
            x+=Math.cos(a)*(1.0+s.r*.25); z+=Math.sin(a)*(1.0+s.r*.25); y=1.2+s.h*.38+.22*Math.sin(t*5+i);
          }else if(mode==='judgment'){
            x+=Math.sin(a)*.8; z+=Math.cos(a)*.8; y=5.1-((t*1.9+i*.18)%(3.6+s.h*.1));
          }
          s.sp.position.set(x,y,z);
          s.sp.material.opacity=(support ? .66 : .74)*fadeIn*fadeOut*(.6+.4*Math.sin(t*4+i));
          s.sp.material.rotation += dt*(.16+s.grow*.12)*(i%2?1:-1);
          const sc=s.grow*(.82+.18*Math.sin(t*6+i)); s.sp.scale.set(sc*1.7,sc*1.7,1);
        });
        petals.forEach((p,i)=>{
          if(!p.sp) return;
          let x=px + Math.sin(t*2.6 + p.phase) * (1.2+i*.32) + p.drift*t*.35;
          let z=pz + Math.cos(t*2.2 + p.phase) * (1.2+i*.28) - p.drift*t*.24;
          let y=1.0 + p.rise*t + .25*Math.sin(t*6+p.phase);
          if(support){ x=px + Math.cos(t*2.1+p.phase)*(1.0+i*.2); z=pz + Math.sin(t*2.1+p.phase)*(1.0+i*.2); y=1.1+p.rise*.45*t; }
          p.sp.position.set(x,y,z);
          p.sp.material.opacity=.28*fadeOut*(1-clamp((t-1.0)/.45,0,1));
          p.sp.material.rotation += dt*(.5+i*.08);
        });
        if(t>=1.72 || f.dead){ clean(); return false; }
        return true;
      });
    }

    function performBlueEarth(b,f){
      if(!b?.fx || b.ended || !f || f.dead)return;
      const healed=Math.max(0,Math.round(f.maxHp-f.hp));
      f.hp=f.maxHp; // Full restoration immediately, independent of skill strength.
      b.ui.popup?.(f.pos,'HP完全回復 ＋'+healed.toLocaleString('ja-JP'),'#b8f6ff');
      const root=new THREE.Group();b.fx.add(root);const mats=[],geos=[];
      const add=(id,pos,w,h,flat=false)=>{
        const map=tex(id);if(!map)return null;
        const opts={map,transparent:true,opacity:0,color:0xffffff,depthWrite:false,
          depthTest:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false};
        const material=flat?new THREE.MeshBasicMaterial(opts):new THREE.SpriteMaterial(opts);
        const obj=flat?new THREE.Mesh(new THREE.PlaneGeometry(1,1),material):new THREE.Sprite(material);
        obj.position.copy(pos);obj.scale.set(w,h,1);obj.renderOrder=flat?5:-12;
        if(flat)obj.rotation.x=-Math.PI/2;
        root.add(obj);mats.push(material);if(flat)geos.push(obj.geometry);return obj;
      };
      // The illustrated Earth dominates the background behind the healer.
      const homeX=f.pos.x,homeZ=f.pos.z;
      const planet=add('planetEarth',new THREE.Vector3(homeX,7,homeZ-4),17.8,17.8);
      const ring=add('heaven',new THREE.Vector3(f.pos.x,.06,f.pos.z),7.5,7.5,true);
      const glow=add('nova',new THREE.Vector3(f.pos.x,2.7,f.pos.z),6.2,8.1);
      const halo=add('shockHalo',new THREE.Vector3(f.pos.x,.08,f.pos.z),3.1,3.1,true);
      let elapsed=0,cleaned=false;
      const clean=()=>{if(cleaned)return;cleaned=true;b.__astralFxCleanups?.delete(clean);
        root.removeFromParent();for(const m of mats)m.dispose();for(const g of geos)g.dispose();};
      (b.__astralFxCleanups ||= new Set()).add(clean);
      b.ui.cutin?.(f,'蒼星再誕','EARTH REGENESIS');
      b.ui.sfx?.('skill',{elem:7,color:0x8de8ff});
      b.flashLight?.(f.pos.clone().setY(2),0x96ecff,1.6,.65);
      b.addEffect(dt=>{
        if(cleaned)return false;
        elapsed+=clamp(Number(dt)||0,0,.065);const t=elapsed;
        root.position.set(f.pos.x-homeX,0,f.pos.z-homeZ);
        const inK=clamp(t/.65,0,1),outK=1-clamp((t-2.65)/.85,0,1);
        if(planet){planet.material.opacity=.89*inK*outK;planet.material.rotation+=dt*.08;
          planet.scale.set(17.8*(.82+.18*inK),17.8*(.82+.18*inK),1);
        }
        if(ring){ring.material.opacity=.81*inK*outK;ring.rotation.z+=dt*.9;
          ring.scale.setScalar(7.5*(.65+.5*inK));
        }
        if(glow){glow.material.opacity=.55*inK*outK;glow.material.rotation-=dt*.15;}
        if(halo){halo.material.opacity=.48*inK*outK;halo.scale.setScalar(3.1+7*clamp(t/3,0,1));}
        if(t>=3.6){clean();return false;}return true;
      });
    }
    const previousDispose=Battle.prototype.dispose;
    Battle.prototype.dispose=function(...args){
      for(const clean of [...(this.__astralFxCleanups||[])])clean();
      this.__astralFxCleanups?.clear();
      return previousDispose?.apply(this,args);
    };
    // Dedicated synthesized Valgard calls. Playback follows the user's
    // audio settings; Chrome/Edge uses the installed Japanese TTS voice.
    // Only skill usage, not a recurring per-frame effect.
    let nextLineAt=0;
    function sayValgardLine(line){
      try{
        if(typeof window==='undefined' || !window.speechSynthesis ||
           typeof SpeechSynthesisUtterance==='undefined')return;
        if(window.localStorage?.getItem('arkeia-muted')==='1')return;
        const volume=clamp((+(window.localStorage?.getItem('arkeia-voice-volume')??75))/100,0,1);
        if(volume===0)return;
        const now=performance.now();
        if(now<nextLineAt)return;
        nextLineAt=now+1050;
        const utterance=new SpeechSynthesisUtterance(line);
        utterance.lang='ja-JP';utterance.rate=.82;utterance.pitch=.58;
        utterance.volume=volume*.92;
        const options=window.speechSynthesis.getVoices?.()||[];
        const japanese=options.filter(v=>/^ja(?:-|_)/i.test(v.lang||''));
        if(japanese.length)utterance.voice=japanese.find(v=>v.localService)||japanese[0];
        window.speechSynthesis.speak(utterance);
      }catch(error){console.warn('[Arkeia] Japanese cast voice unavailable.',error);}
    }
    const previous=Battle.prototype.executeCast;
    Battle.prototype.executeCast=function(f,slot,net){
      const selectedAstral=!!f && f.key==='valgard' && (slot==='s2'||slot==='f2') && f.def?.skills?.[2]?.kind==='astral_judgment_painted';
      const selectedSpear=!!f && f.key==='valgard' && (slot==='s0'||slot==='f0') && f.def?.skills?.[0]?.kind==='shining_spear_painted';
      const selectedLast=!!f && f.key==='valgard' && slot==='over' && f.def?.over?.kind==='last_vanisher_painted';
      const selectedBlue=!!f && f.key==='valgard' && slot==='hi' && f.def?.hi?.kind==='blue_earth_painted';
      const outcome=previous.call(this,f,slot,net);
      if(f && !f.remoteAuth && !this.net && (slot==='over'||slot==='hi'||/^[sf]\d+$/.test(slot))){
        showCastingCircle(this,f,slot);
        if(/^f\d+$/.test(slot)) performEvolvedFollowVisual(this,f,slot,net);
      }
      if(f?.key==='valgard' && !f.remoteAuth && !this.net && (slot==='over'||slot==='hi'||/^[sf]\d+$/.test(slot))){
        sayValgardLine(selectedAstral?'力の違いを見せてやる':selectedSpear?'これはよけられまい':'これでどうだ');
        performValgardCinematic(this,f,slot,net);
      }
      if(selectedSpear)performShiningSpear(this,f,net,slot==='f0'?.65:1);
      if(selectedAstral)perform(this,f,net,slot==='f2'?.65:1);
      if(selectedLast)performLastVanisher(this,f,net);
      if(selectedBlue)performBlueEarth(this,f);
      return outcome;
    };
  }

  function installPaintedWorld(THREE,Field){
    if(!Field||Field.prototype.__illustratedCG)return;
    Field.prototype.__illustratedCG=true;
    const cv=document.createElement('canvas');cv.width=8;cv.height=1;
    const gc=cv.getContext('2d');
    ['#3b455b','#758199','#c4cad7','#f8f5e8'].forEach((color,i)=>{gc.fillStyle=color;gc.fillRect(i*2,0,2,1)});
    const gradient=new THREE.CanvasTexture(cv);
    gradient.magFilter=THREE.NearestFilter; gradient.minFilter=THREE.NearestFilter;
    gradient.colorSpace=THREE.NoColorSpace;
    // Environment materials adopt 4-band painted lighting, while keeping
    // collision geometry, original textures and map-based world generation.
    Field.prototype.std=function(color,extra={}){
      const m=new THREE.MeshToonMaterial({
        color,gradientMap:gradient, map:extra.map||null,
        emissive:extra.emissive??0x000000,
        emissiveIntensity:extra.emissiveIntensity??0,
        transparent:!!extra.transparent,opacity:extra.opacity??1,
        side:extra.side??THREE.FrontSide,
        depthWrite:extra.depthWrite??true,
        vertexColors:!!extra.vertexColors,
        wireframe:!!extra.wireframe,
        alphaTest:extra.alphaTest??0
      });
      return this.mat(m);
    };
    function foliageTex(pine){
      const c=document.createElement('canvas');c.width=256;c.height=360;
      const ctx=c.getContext('2d');
      const r=(seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296})(pine?449:990);
      ctx.lineCap='round';ctx.lineJoin='round';
      // Painted ink edge, pale center and textured brush highlights.
      ctx.strokeStyle='#474e55';ctx.lineWidth=9;
      ctx.beginPath();ctx.moveTo(128,338);ctx.lineTo(128,pine?128:155);ctx.stroke();
      ctx.strokeStyle='#c0c4c7';ctx.lineWidth=5;ctx.stroke();
      const blobs=pine?180:275;
      for(let i=0;i<blobs;i++){
        let x,y,w,h;
        if(pine){
          y=65+r()*230;
          const t=(y-62)/244;
          x=128+(r()-.5)*(16+t*165);
          w=7+r()*18;h=9+r()*25;
        }else{
          const a=r()*Math.PI*2,rr=Math.sqrt(r());
          x=128+Math.cos(a)*rr*95;y=158+Math.sin(a)*rr*111;
          w=8+r()*23;h=7+r()*18;
        }
        const shade=Math.floor(168+r()*88);
        ctx.save();ctx.globalAlpha=.2+r()*.65;
        ctx.fillStyle=`rgb(${shade},${shade},${shade})`;
        ctx.beginPath();ctx.ellipse(x,y,w,h,(r()-.5)*.8,0,Math.PI*2);ctx.fill();ctx.restore();
      }
      for(let i=0;i<60;i++){
        const x=40+r()*178,y=(pine?74:64)+r()*(pine?220:204);
        ctx.save();ctx.globalAlpha=.1+r()*.4;ctx.strokeStyle='#ffffff';ctx.lineWidth=1+r()*3;
        ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x+5,y-8,x+12,y-5);ctx.stroke();ctx.restore();
      }
      const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
      tex.minFilter=THREE.LinearMipmapLinearFilter;
      return tex;
    }
    const pineTexture=foliageTex(true),roundTexture=foliageTex(false);
    function makeFoliage(field,items,texture,round){
      if(!items.length)return;
      const geo=field.geo(new THREE.PlaneGeometry(round?5.7:5,round?5.8:6.5));
      const mat=field.mat(new THREE.MeshBasicMaterial({map:texture,transparent:true,
        opacity:.98,side:THREE.DoubleSide,alphaTest:.13,depthWrite:true}));
      const baseColor=field.B.crowns;
      const matrices=[new THREE.Matrix4(),new THREE.Matrix4()];
      const variants=[0,Math.PI/2];
      for(let plane=0;plane<2;plane++){
        const im=new THREE.InstancedMesh(geo,mat,items.length);
        im.frustumCulled=false;
        const quaternion=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),variants[plane]);
        items.forEach(([x,z,k],i)=>{
          const pos=new THREE.Vector3(x,(round?3.15:3.12)*k,z);
          const scale=new THREE.Vector3(k,k,1);
          matrices[plane].compose(pos,quaternion,scale);
          im.setMatrixAt(i,matrices[plane]);
          const cc=new THREE.Color(baseColor[i%baseColor.length]);
          im.setColorAt(i,cc);
        });
        im.instanceMatrix.needsUpdate=true;
        if(im.instanceColor)im.instanceColor.needsUpdate=true;
        im.renderOrder=1;field.group.add(im);
      }
    }
    const originalWilds=Field.prototype.buildWilds;
    Field.prototype.buildWilds=function(){
      originalWilds.call(this);
      const all=Array.isArray(this.treePts)?this.treePts:[];
      if(!all.length)return;
      const pine=this.group.children.find(o=>o.isInstancedMesh&&o.geometry?.type==='ConeGeometry'&&o.geometry?.parameters?.radialSegments===7);
      const count=Math.min(all.length,pine?.count??0);
      if(count<1)return;
      const roundCount=all.length-count;
      // Replace the angular treetops by real 2D-painted crossed foliage.
      for(const obj of this.group.children){
        if(!obj.isInstancedMesh)continue;
        const g=obj.geometry;
        if(g?.type==='ConeGeometry'&&obj.count===count&&g.parameters?.radialSegments===7)obj.visible=false;
        if(roundCount&&g?.type==='IcosahedronGeometry'&&obj.count===roundCount&&
           (Math.abs((g.parameters?.radius||0)-1.7)<.01||Math.abs((g.parameters?.radius||0)-1.1)<.01))obj.visible=false;
      }
      makeFoliage(this,all.slice(0,count),pineTexture,false);
      makeFoliage(this,all.slice(count),roundTexture,true);
    };
    // Story panorama: hand-drawn sky, washes of cloud and layered distant ridges.
    function panoramaTex(B){
      const c=document.createElement('canvas');c.width=1024;c.height=512;
      const g=c.getContext('2d');
      const sky=new THREE.Color(B.sky),horizon=new THREE.Color(B.gnd);
      const toHex=(v)=>'#'+v.getHexString();
      const grad=g.createLinearGradient(0,0,0,512);
      grad.addColorStop(0,toHex(sky.clone().multiplyScalar(.55)));
      grad.addColorStop(.48,toHex(sky));grad.addColorStop(.77,toHex(sky.clone().lerp(new THREE.Color(0xffead7),.28)));
      grad.addColorStop(1,toHex(horizon.clone().lerp(sky,.5)));
      g.fillStyle=grad;g.fillRect(0,0,1024,512);
      let seed=707;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
      for(let layer=0;layer<3;layer++){
        g.fillStyle=toHex(horizon.clone().lerp(sky,.35+layer*.17));
        g.globalAlpha=.25+layer*.13;g.beginPath();g.moveTo(0,512);
        const y=340+layer*45;
        for(let x=0;x<=1024;x+=28)g.lineTo(x,y-40*rnd()-20*Math.sin(x*.014+layer*2));
        g.lineTo(1024,512);g.fill();
      }
      g.globalAlpha=1;
      for(let i=0;i<65;i++){
        const x=rnd()*1024,y=40+rnd()*210,w=30+rnd()*150,h=5+rnd()*20;
        g.globalAlpha=.04+rnd()*.11;g.fillStyle='#fffaf2';g.beginPath();g.ellipse(x,y,w,h,-.13,0,2*Math.PI);g.fill();
      }
      g.globalAlpha=1;
      const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
      tex.wrapS=THREE.RepeatWrapping;return tex;
    }
    const originalGround=Field.prototype.buildGround;
    Field.prototype.buildGround=function(){
      originalGround.call(this);
      const tex=panoramaTex(this.B);this.own.push(tex);
      const geo=this.geo(new THREE.CylinderGeometry(103,103,92,48,1,true));
      const mat=this.mat(new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,
        depthWrite:false,depthTest:true,fog:false}));
      const sky=new THREE.Mesh(geo,mat);
      sky.position.set(0,15,0);
      sky.renderOrder=-20;
      this.group.add(sky);
      this.illustratedSky=sky;
    };
    const originalUpdate=Field.prototype.update;
    Field.prototype.update=function(dt,inp,camera){
      const result=originalUpdate.call(this,dt,inp,camera);
      // Follow the player to maintain parallax at every chapter and location.
      if(this.illustratedSky&&this.player){
        this.illustratedSky.position.x=this.player.pos.x;
        this.illustratedSky.position.z=this.player.pos.z;
      }
      return result;
    };
  }

  /* ARKEIA CHARACTER PROGRESSION 2026-11-07
   * Integrated in arkeia-ui.js: all FIGHTERS, unlimited BigInt levels,
   * battle EXP, persistent local records and interactive player UI.
   * It never changes the game's existing save format or battle network packets.
   */
  Promise.all([
    import('./game.js?v=audio-cast-20261107d'),
    import('./data.js?v=audio-cast-20261107d')
  ]).then(([combat, data]) => {
    installCharacterProgression(combat.Battle, data.FIGHTERS);
  }).catch((error) => {
    console.warn('[Arkeia] Character EXP system could not initialize.', error);
  });

  function installCharacterProgression(Battle, FIGHTERS) {
    if (!Battle || !FIGHTERS || Battle.prototype.__characterExpV1) return;
    Battle.prototype.__characterExpV1 = true;
    const STORAGE_KEY = 'arkeia-character-exp-v1';
    const VALID_KEYS = Object.keys(FIGHTERS);
    const NAME_TO_KEY = new Map(VALID_KEYS.map((key) => [FIGHTERS[key].name, key]));
    const experience = Object.create(null);
    const MAX_DECIMAL_DIGITS = 2500; // Reject malformed/untrusted enormous strings; no gameplay level cap.
    const decimal = (value) => typeof value === 'string' && /^\d+$/.test(value) && value.length <= MAX_DECIMAL_DIGITS;
    const asExp = (value) => decimal(String(value)) ? BigInt(value) : 0n;
    let savedRecords;
    try { savedRecords = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { savedRecords = {}; }
    for (const key of VALID_KEYS) {
      const raw = savedRecords?.[key];
      experience[key] = asExp(typeof raw === 'object' && raw ? raw.exp : raw ?? '0');
    }
    const toText = (num) => BigInt(num).toLocaleString('ja-JP');
    const costOf = (level) => 100n + 42n * level + 5n * level * level;
    // Exact cumulative EXP for Lv.1 -> Lv.N. Binary search makes huge levels practical.
    function totalAt(level) {
      const n = level - 1n;
      return 100n * n + 21n * n * (n + 1n) +
        (5n * n * (n + 1n) * (2n * n + 1n)) / 6n;
    }
    function levelOf(exp) {
      if (exp < costOf(1n)) return 1n;
      let low = 1n, high = 2n;
      while (totalAt(high) <= exp) { low = high; high *= 2n; }
      while (high - low > 1n) {
        const middle = (high + low) / 2n;
        if (totalAt(middle) <= exp) low = middle;
        else high = middle;
      }
      return low;
    }
    function snapshot(key) {
      const exp = experience[key] ?? 0n;
      const level = levelOf(exp), start = totalAt(level), next = costOf(level);
      const within = exp - start;
      const percent = Number((1000n * within) / next) / 10;
      return { exp, level, within, next, percent };
    }
    // Gentle, never explicitly capped local growth. PvP uses original combat values.
    function levelBonus(level) {
      const number = Number(level);
      const str = Number.isFinite(number) ? '' : String(level);
      const logarithm = Number.isFinite(number) ? Math.log(number) :
        Math.log(Number(str.slice(0, 12))) + (str.length - 12) * Math.LN10;
      const hp = 1 + Math.max(0, logarithm) * 0.065;
      const atk = 1 + Math.max(0, logarithm) * 0.044;
      const def = 1 / (1 + Math.max(0, logarithm) * 0.033);
      return { hp, atk, def };
    }
    function persistExperience() {
      try {
        const data = {};
        for (const key of VALID_KEYS) if (experience[key] > 0n) data[key] = String(experience[key]);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch (err) {
        console.warn('[Arkeia] EXP could not be saved to this browser.', err);
        return false;
      }
    }
    function giveExp(key, amount) {
      if (!(key in FIGHTERS)) return null;
      const before = snapshot(key);
      experience[key] += BigInt(Math.max(0, Math.floor(amount)));
      const after = snapshot(key);
      return { key, before, after, gained: amount, raised: after.level > before.level };
    }

    const addOld = Battle.prototype.add;
    Battle.prototype.add = function (key, options) {
      const fighter = addOld.call(this, key, options);
      fighter.__arkeiaTrainingKey = key;
      // Only locally owned allies get level bonuses. Remote PvP remains fair.
      if (fighter.team === 0 && !fighter.remoteAuth && !this.net && FIGHTERS[key]) {
        const lv = snapshot(key).level, bonus = levelBonus(lv);
        fighter.__arkeiaLevel = lv;
        fighter.atkMul *= bonus.atk;
        fighter.defMul *= bonus.def;
        fighter.maxHp = Math.max(1, Math.round(fighter.maxHp * bonus.hp));
        fighter.hp = fighter.maxHp;
      }
      return fighter;
    };
    const updateOld = Battle.prototype.update;
    Battle.prototype.update = function (...args) {
      const value = updateOld.apply(this, args);
      if (!this.ended || this.__arkeiaExpGiven) return value;
      this.__arkeiaExpGiven = true;
      const owned = [...new Set(this.fighters.filter((f) => f.team === 0 && !f.remoteAuth &&
        f.__arkeiaTrainingKey && FIGHTERS[f.__arkeiaTrainingKey]).map((f) => f.__arkeiaTrainingKey))];
      if (owned.length === 0) return value;
      const victory = this.fighters.some((f) => f.team === 0 && !f.dead);
      const foes = this.fighters.filter((f) => f.team !== 0);
      let chapter = 0;
      try { chapter = Math.max(0, Math.floor(JSON.parse(localStorage.getItem('arkeia-save-v1') || '{}').chapter || 0)); } catch {}
      const count = Math.max(1, foes.length);
      const hpWeight = Math.min(600, Math.round(foes.reduce((sum, f) => sum + (Number(f.maxHp) || 0), 0) / 80));
      const reward = victory
        ? 95 + count * 40 + hpWeight + Math.min(chapter * 5, 650)
        : 22 + count * 9 + Math.round(hpWeight * .1);
      const records = owned.map((key) => giveExp(key, reward)).filter(Boolean);
      if (records.length) {
        const saved = persistExperience();
        updateAllLevelLabels();
        notifyReward(records, reward, victory, saved);
      }
      return value;
    };

    const css = document.createElement('style');
    css.id = 'arkeia-level-styles';
    css.textContent = `
      .arkeia-lv-chip { display:inline-flex;align-items:center;gap:5px;flex-wrap:wrap;color:#ffe8b0;
        font:700 12px/1.6 system-ui,sans-serif;letter-spacing:.01em; }
      .arkeia-lv-progress {display:block;width:100%;height:5px;border:0;border-radius:6px;
        overflow:hidden;accent-color:#e1bc78;}
      .arkeia-lv-panel{display:flex;flex-direction:column;gap:5px;width:100%;margin-top:7px;padding:8px 10px;
        border:1px solid #b59a6333;border-radius:5px;background:#0b1427b8;}
      .arkeia-lv-panel small{font:11px/1.4 system-ui,sans-serif;color:#ccc5b5;}
      .arkeia-lv-action{border:1px solid #bba273!important;border-radius:4px;background:#27344b!important;
        color:#ffebc4!important;padding:7px 12px!important;font:600 12px/1.45 system-ui,sans-serif;cursor:pointer;}
      #arkeia-lv-modal{position:fixed;inset:0;z-index:99999;display:flex;justify-content:center;align-items:center;
        background:#030913e8;pointer-events:auto;padding:clamp(8px,3vw,28px);}
      #arkeia-lv-modal[hidden]{display:none!important;}
      .arkeia-lv-window{width:min(840px,100%);max-height:min(92dvh,920px);overflow-y:auto;
        background:linear-gradient(160deg,#192840,#0b1524);color:#f9efda;border:1px solid #ae915c;
        box-shadow:0 22px 65px #000a;padding:clamp(12px,3vw,24px);touch-action:pan-y;overscroll-behavior:contain;}
      .arkeia-lv-window h2{margin:0 0 8px;font-size:clamp(20px,4vw,28px);font-family:serif;}
      .arkeia-lv-help{color:#c2c8d3;font:12px/1.9 system-ui,sans-serif;margin:8px 0 14px;}
      .arkeia-lv-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0;}
      .arkeia-lv-toolbar input{width:min(300px,100%);flex:1;min-width:140px;color:#fff6e2;background:#08121f;
        border:1px solid #91764c;padding:9px;border-radius:4px;touch-action:auto;font-size:16px;}
      .arkeia-lv-rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(295px,100%),1fr));gap:8px;}
      .arkeia-lv-record{padding:12px;border:1px solid #8575546b;border-radius:6px;background:#17263b;min-width:0;}
      .arkeia-lv-record strong{display:block;font-size:15px;line-height:1.5;}
      .arkeia-lv-record p{font:11px/1.6 system-ui,sans-serif;color:#c1c7d3;margin:5px 0;overflow-wrap:anywhere;}
      #arkeia-exp-toast{position:fixed;bottom:calc(12px + env(safe-area-inset-bottom));left:50%;z-index:9989;
        transform:translateX(-50%);max-width:min(520px,94vw);pointer-events:none;text-align:center;
        border:1px solid #cba96b;background:#0b1622f4;color:#ffeac0;padding:10px 15px;
        font:600 13px/1.8 system-ui,sans-serif;box-shadow:0 5px 35px #0009;}
      .arkeia-exp-summary{border:1px solid #c0a47488;padding:12px 14px;border-radius:5px;
        background:#24334a;margin:8px auto 12px;color:#ffebbd;font:600 13px/1.7 system-ui,sans-serif;}
      @media(max-width:560px){ .arkeia-lv-action{font-size:11px!important} }
    `;
    document.head.appendChild(css);

    function makePanel(key) {
      const s = snapshot(key), panel = document.createElement('div');
      panel.className = 'arkeia-lv-panel';
      const label = document.createElement('span');
      label.className = 'arkeia-lv-chip'; label.textContent = `Lv. ${toText(s.level)}`;
      const stat = document.createElement('small');
      stat.textContent = `EXP ${toText(s.within)} / ${toText(s.next)}（次まで ${toText(s.next-s.within)}）`;
      const bar = document.createElement('progress');
      bar.className = 'arkeia-lv-progress'; bar.max = 100; bar.value = s.percent;
      bar.setAttribute('aria-label', `${FIGHTERS[key].name} レベル経験値進捗 ${s.percent}%`);
      panel.append(label, stat, bar);
      return panel;
    }
    function makeLevelButton() {
      const button = document.createElement('button');
      button.type='button';button.className='arkeia-lv-action';
      button.textContent='✦ キャラクターレベル・EXP';
      button.addEventListener('click', () => showModal());
      return button;
    }
    const titleAccount = document.querySelector('#scr-title .portal-account');
    const forgeBar = document.querySelector('#scr-forge .topbar');
    if (titleAccount) titleAccount.append(makeLevelButton());
    if (forgeBar) forgeBar.append(makeLevelButton());

    const modal = document.createElement('section');
    modal.id='arkeia-lv-modal';modal.hidden=true;
    modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-labelledby','arkeia-lv-heading');
    const windowEl=document.createElement('div'); windowEl.className='arkeia-lv-window';
    const heading=document.createElement('h2');heading.id='arkeia-lv-heading';heading.textContent='キャラクター成長記録';
    const help=document.createElement('p');help.className='arkeia-lv-help';
    help.textContent='全キャラクター Lv.1から開始。戦闘に参加すると勝利・敗北に応じて経験値を獲得。レベル上限なし。レベルによる能力上昇はオフライン戦のみ適用されます。';
    const toolbar=document.createElement('div');toolbar.className='arkeia-lv-toolbar';
    const search=document.createElement('input');search.type='search';search.placeholder='名前・称号で検索';search.setAttribute('aria-label','キャラクター検索');
    const close=document.createElement('button');close.type='button';close.className='arkeia-lv-action';close.textContent='戻る・閉じる';
    close.addEventListener('click',()=>{modal.hidden=true;search.value='';});
    toolbar.append(search,close);
    const rows=document.createElement('div');rows.className='arkeia-lv-rows';
    windowEl.append(heading,help,toolbar,rows);modal.append(windowEl);
    modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!modal.hidden){modal.hidden=true;e.stopImmediatePropagation();}
    },true);
    document.querySelector('#ui')?.append(modal);
    function renderModal() {
      const q=search.value.normalize('NFKC').trim().toLocaleLowerCase('ja');
      const keys=VALID_KEYS.filter(k=>!q||`${FIGHTERS[k].name} ${FIGHTERS[k].title} ${k}`.normalize('NFKC').toLocaleLowerCase('ja').includes(q));
      keys.sort((a,b)=>{
        const x=snapshot(a).level,y=snapshot(b).level;
        return x===y?FIGHTERS[a].name.localeCompare(FIGHTERS[b].name,'ja') : x>y?-1:1;
      });
      const fragment=document.createDocumentFragment();
      for(const key of keys){
        const d=FIGHTERS[key],record=document.createElement('article');
        record.className='arkeia-lv-record';
        const h=document.createElement('strong');h.textContent=d.name;
        const sub=document.createElement('p');sub.textContent=d.title||key;
        const panel=makePanel(key);
        const b=levelBonus(snapshot(key).level);
        const perks=document.createElement('p');
        perks.textContent=`オフライン能力：最大HP ×${b.hp.toFixed(2)} ／ 攻撃 ×${b.atk.toFixed(2)} ／ 被ダメージ ×${b.def.toFixed(2)}`;
        record.append(h,sub,panel,perks);fragment.append(record);
      }
      rows.replaceChildren(fragment);
    }
    search.addEventListener('input',renderModal);
    function showModal(){renderModal();modal.hidden=false;search.focus({preventScroll:true});}

    // Selection cards, party slot headers and forge labels are often rebuilt by main.js.
    // Observe only their container's immediate child list: level labels won't loop.
    function tagCards() {
      const grid = document.getElementById('select-grid');
      if(!grid)return;
      for(const card of grid.children){
        if(!card.matches('button.card') || card.querySelector('.arkeia-lv-panel'))continue;
        const name=card.querySelector('b')?.textContent?.trim();
        const key=NAME_TO_KEY.get(name);
        if(key)card.append(makePanel(key));
      }
    }
    function tagParty() {
      const slots=document.getElementById('party-slots');
      if(!slots)return;
      for(const slot of slots.children){
        if(slot.querySelector('.arkeia-lv-chip'))continue;
        const name=slot.querySelector('.party-slot-head strong')?.textContent?.trim();
        const key=NAME_TO_KEY.get(name);
        if(key){
          const text=document.createElement('span'); text.className='arkeia-lv-chip';
          text.textContent=`Lv. ${toText(snapshot(key).level)}`;
          slot.querySelector('.party-slot-head')?.append(text);
        }
      }
    }
    function tagForge() {
      const list = document.getElementById('forge-list');
      if(list){for(const chip of list.children){
        if(!chip.matches('button')||chip.querySelector('.arkeia-lv-chip'))continue;
        const key=VALID_KEYS.find(k=>chip.textContent.startsWith(FIGHTERS[k].name));
        if(!key)continue;
        const tag=document.createElement('span');tag.className='arkeia-lv-chip';
        tag.textContent=`　Lv.${toText(snapshot(key).level)}`;
        chip.append(tag);
      }}
      const rows = document.getElementById('forge-rows');
      const heading = document.getElementById('forge-name');
      if(rows && heading){
        const name=heading.textContent.split('　')[0].trim();const key=NAME_TO_KEY.get(name);
        let info=document.getElementById('arkeia-forge-level');
        if(key){
          if(!info){info=document.createElement('div');info.id='arkeia-forge-level';rows.parentNode?.insertBefore(info,rows);}
          if(info.dataset.key!==key){info.dataset.key=key;info.replaceChildren(makePanel(key));}
        }
      }
    }
    const scheduleTag=()=>{if(pending)return;pending=true;queueMicrotask(()=>{
      pending=false;tagCards();tagParty();tagForge();
    });};
    let pending=false;
    for(const id of ['select-grid','party-slots','forge-list']){
      const node=document.getElementById(id);
      if(node)new MutationObserver(scheduleTag).observe(node,{childList:true});
    }
    const forgeName=document.getElementById('forge-name');
    if(forgeName)new MutationObserver(scheduleTag).observe(forgeName,{childList:true,characterData:true,subtree:true});
    scheduleTag();

    function updateAllLevelLabels() {
      for(const item of document.querySelectorAll('#select-grid .arkeia-lv-panel'))item.remove();
      for(const item of document.querySelectorAll('#party-slots .arkeia-lv-chip'))item.remove();
      for(const item of document.querySelectorAll('#forge-list .arkeia-lv-chip'))item.remove();
      document.getElementById('arkeia-forge-level')?.remove();
      scheduleTag();
      if(!modal.hidden)renderModal();
    }
    let toastTimeout;
    function notifyReward(records, reward, won, saved) {
      const leveled=records.filter(x=>x.raised);
      const summary=`${won?'勝利':'敗北'}：参加者 ${records.length}人に EXP +${toText(BigInt(reward))}`;
      const rise=leveled.length?` ／ ${leveled.slice(0,3).map(x=>`${FIGHTERS[x.key].name} Lv.${toText(x.after.level)}`).join('・')}${leveled.length>3?' ほか':''}`:'';
      let toast=document.getElementById('arkeia-exp-toast');
      if(!toast){toast=document.createElement('div');toast.id='arkeia-exp-toast';toast.setAttribute('role','status');document.querySelector('#ui')?.append(toast);}
      toast.textContent=summary+rise+(saved?'':'（保存できませんでした）');
      toast.hidden=false;clearTimeout(toastTimeout);
      toastTimeout=setTimeout(()=>{toast.hidden=true;},5000);
      const result=document.getElementById('scr-result');
      const holder=document.getElementById('res-reward');
      if(result && holder){
        let panel=document.getElementById('arkeia-exp-summary');
        if(!panel){panel=document.createElement('div');panel.id='arkeia-exp-summary';panel.className='arkeia-exp-summary';holder.insertAdjacentElement('afterend',panel);}
        panel.textContent=summary+rise;
        // Story encounter may return directly to field; only show when result opens.
      }
    }
    window.addEventListener('storage',e=>{
      if(e.key!==STORAGE_KEY)return;
      try {
        const data=JSON.parse(e.newValue||'{}');
        for(const key of VALID_KEYS)experience[key]=asExp(data?.[key]??'0');
        updateAllLevelLabels();
      }catch{}
    });
  }


  /* VALGARD / ORIGINAL 3D MODEL ICE ECHO 2026-11-07
   * One-hit ice decoy uses the *actual in-game Valgard GLB mesh hierarchy*.
   * Preparation is scheduled during idle time, never at the attack keypress.
   * Geometry, textures and mesh buffers are reused; only lightweight blue
   * materials and a separate skeleton (when present) are copied once per battle.
   * Echo is still an independent proxy, NEVER an extra core Fighter.
   * Ice seal / frozen enemies / 30s duration are unchanged.
   */
  import('./game.js?v=audio-cast-20261107d').then(combat => {
    installValgardIceEcho(combat.Battle, combat.Fighter);
  }).catch(error => console.warn('[Arkeia] Valgard ice echo unavailable:', error));

  function installValgardIceEcho(Battle, Fighter) {
    if (!Battle || !Fighter || Battle.prototype.__valgardIceEchoV2) return;
    Battle.prototype.__valgardIceEchoV2 = true;
    const ICE = 0x9ceaff;
    const HP_RATIO = 0.60;
    const MAX_ACTIVE = 1;
    const THREE_MODULE = Promise.all([
      import('three'),
      import('three/addons/utils/SkeletonUtils.js')
    ]).then(([THREE, SkeletonUtils]) => ({THREE, SkeletonUtils}));
    let assetPromise = null;

    function iceAssets() {
      if (assetPromise) return assetPromise;
      assetPromise = THREE_MODULE.then(({THREE, SkeletonUtils}) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const g = canvas.getContext('2d');
        if (!g) return { THREE, SkeletonUtils, texture: null, sealTexture: null };
        const c = 128, TAU = Math.PI * 2;
        const aura = g.createRadialGradient(c,c,6,c,c,124);
        aura.addColorStop(0,'rgba(233,254,255,.83)');
        aura.addColorStop(.18,'rgba(95,209,255,.38)');
        aura.addColorStop(.47,'rgba(86,132,244,.18)');
        aura.addColorStop(.8,'rgba(84,174,255,.08)');
        aura.addColorStop(1,'rgba(0,90,220,0)');
        g.fillStyle = aura; g.fillRect(0,0,256,256);
        g.translate(c,c);
        g.strokeStyle='#d9fbff';g.lineCap='round';
        for(let j=0;j<3;j++){
          g.beginPath();g.arc(0,0,36+j*29,j*.65,TAU-.3-j*.52);
          g.globalAlpha=.64-j*.13;g.lineWidth=3.3-j*.55;g.shadowBlur=15;g.shadowColor='#6df2ff';g.stroke();
        }
        g.shadowBlur=7;g.globalAlpha=.9;g.lineWidth=2;
        for(let i=0;i<12;i++){
          const a=TAU*i/12,rad=i%2?68:84;
          g.beginPath();g.moveTo(Math.cos(a)*53,Math.sin(a)*53);
          g.lineTo(Math.cos(a)*rad,Math.sin(a)*rad);
          g.stroke();
          const x=Math.cos(a)*rad,y=Math.sin(a)*rad;
          g.beginPath();g.moveTo(x-6,y-3);g.lineTo(x,y-12);g.lineTo(x+5,y-3);g.stroke();
        }
        g.globalAlpha=1;g.shadowBlur=0;
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        // A separately painted magic circle, drawn once and reused by all casters.
        const spell=document.createElement('canvas');spell.width=spell.height=512;
        const ink=spell.getContext('2d');
        let sealTexture=null;
        if(ink){
          const TAU=Math.PI*2,C=256;
          ink.translate(C,C); ink.lineCap='round'; ink.lineJoin='round';
          const halo=ink.createRadialGradient(0,0,18,0,0,251);
          halo.addColorStop(0,'rgba(208,248,255,.10)');
          halo.addColorStop(.49,'rgba(64,182,255,.15)');
          halo.addColorStop(.78,'rgba(40,106,227,.12)');
          halo.addColorStop(1,'rgba(10,45,150,0)');
          ink.fillStyle=halo;ink.fillRect(-256,-256,512,512);
          ink.shadowColor='#87eaff';ink.shadowBlur=20;
          for(let j=0;j<5;j++){
            ink.globalAlpha=[.85,.33,.76,.45,.78][j];
            ink.strokeStyle=j%2?'#5ac8ff':'#ddf9ff';
            ink.lineWidth=[3.5,2.3,4.2,2,3.4][j];
            ink.beginPath();ink.arc(0,0,[226,210,178,133,83][j],0,TAU);ink.stroke();
          }
          ink.globalAlpha=.92;ink.shadowBlur=5;ink.lineWidth=3;
          for(let i=0;i<12;i++){
            const a=i*TAU/12;
            ink.save();ink.rotate(a);
            ink.strokeStyle=i%2?'#b8f6ff':'#61c6ff';
            ink.beginPath();ink.moveTo(0,-221);ink.lineTo(0,-180);ink.stroke();
            ink.beginPath();ink.moveTo(-13,-194);ink.lineTo(0,-176);ink.lineTo(13,-194);ink.stroke();
            ink.beginPath();ink.moveTo(0,-166);ink.lineTo(13,-145);ink.lineTo(0,-124);ink.lineTo(-13,-145);ink.closePath();ink.stroke();
            ink.restore();
          }
          for(let i=0;i<6;i++){
            ink.save();ink.rotate(i*TAU/6);
            ink.strokeStyle='#edfcff';ink.lineWidth=5;ink.shadowBlur=12;
            ink.beginPath();ink.moveTo(0,-18);ink.lineTo(0,-111);ink.stroke();
            for(const y of [-55,-89]){
              ink.beginPath();ink.moveTo(0,y);ink.lineTo(-19,y+18);ink.moveTo(0,y);ink.lineTo(19,y+18);ink.stroke();
            }
            ink.restore();
          }
          ink.globalAlpha=1;ink.shadowBlur=0;
          sealTexture=new THREE.CanvasTexture(spell);
          sealTexture.colorSpace=THREE.SRGBColorSpace;
          sealTexture.minFilter=THREE.LinearMipmapLinearFilter;
        }
        // Original Valgard mesh and textures already exist in the battle's cached model.
        return { THREE, SkeletonUtils, texture, sealTexture };
      });
      return assetPromise;
    }
    // Source geometry preparation is deferred until browser idle time.
    // The attack handler never clones the original 3D model.
    let runtime = null;
    iceAssets().then(value => { runtime = value; }).catch(() => {});

    // Real Valgard GLB / blue ice echo. Never construct a fake armor shape.
    const ECHO_RANGE=2.35, ECHO_SPEED=7.3;
    const ECHO_RESPAWN=1.25;
    function makeOriginalBlueCopy(owner){
      const rt=runtime, original=owner?.modelInstance?.wrapper;
      if(!rt?.THREE || !original) return null;
      // Source scene is already loaded and placed on the real Valgard.
      // Shared buffers/textures + no new GLB fetch or 3D geometry generation.
      let skinned=false,sourceMeshCount=0;
      original.traverse(node=>{
        if(node.isSkinnedMesh)skinned=true;
        if(node.isMesh)sourceMeshCount++;
      });
      if(sourceMeshCount<1) return null;
      const clone=skinned
        ? rt.SkeletonUtils.clone(original)
        : original.clone(true);
      const materialCache=new Map(),materials=[];
      const frostColor=new rt.THREE.Color(0x60d6ff);
      const frostGlow=new rt.THREE.Color(0x276da5);
      const blueMaterial=source=>{
        if(!source) return source;
        if(materialCache.has(source))return materialCache.get(source);
        const material=source.clone();
        // Every body/armor/fur/weapon part receives a full icy-blue tint,
        // retaining all actual textures and the exact geometry silhouette.
        if(material.color) material.color.copy(frostColor);
        if(material.emissive){
          material.emissive.copy(frostGlow);
          material.emissiveIntensity=Math.max(.24,Math.min(.48,material.emissiveIntensity||.32));
        }
        if(material.metalness!=null)material.metalness=Math.min(.32,material.metalness);
        if(material.roughness!=null)material.roughness=Math.max(.48,material.roughness);
        // Opaque where original was opaque: no transparent overdraw on many meshes.
        material.depthWrite=true;
        materialCache.set(source,material);
        materials.push(material);
        return material;
      };
      clone.traverse(node=>{
        if(!node.isMesh)return;
        node.material=Array.isArray(node.material)
          ? node.material.map(blueMaterial)
          : blueMaterial(node.material);
        node.castShadow=false;
        node.receiveShadow=false;
        if(node.isSkinnedMesh)node.frustumCulled=false;
      });
      // Match the source skeleton pose without creating a second AnimationMixer.
      const sourceBones=[],destBones=[];
      if(skinned){
        original.traverse(node=>{if(node.isBone)sourceBones.push(node)});
        clone.traverse(node=>{if(node.isBone)destBones.push(node)});
      }
      clone.userData.isAuthenticValgardIceCopy=true;
      return {
        model:clone,materials,meshCount:sourceMeshCount,
        bones:sourceBones.length===destBones.length
          ? sourceBones.map((bone,i)=>[bone,destBones[i]]) : [],
        poseIn:.1,
        basePosition:clone.position.clone(),
        baseRotation:clone.rotation.clone()
      };
    }
    function scheduleEchoModel(owner){
      if(!owner || owner.__iceEchoBlueCopy || owner.__iceEchoPreparing ||
        owner.__iceEchoModelFailed || owner.remoteAuth || owner.battle?.net)return;
      owner.__iceEchoPreparing=true;
      // Defer the single exact skeleton copy out of the gameplay key handler.
      Promise.resolve(iceAssets()).then(value=>{
        runtime=value;
        const work=()=>{
          try{
            const b=owner.battle;
            if(b?.ended || !b?.fighters?.includes(owner) || owner.dead)return;
            owner.__iceEchoBlueCopy=makeOriginalBlueCopy(owner);
            if(!owner.__iceEchoBlueCopy)throw Error('Valgard source model unavailable');
          }catch(error){
            owner.__iceEchoModelFailed=true;
            console.warn('[Valgard ice echo] Real model could not be prepared',error);
          }finally{owner.__iceEchoPreparing=false;}
        };
        if(typeof requestIdleCallback==='function')requestIdleCallback(work,{timeout:800});
        else setTimeout(work,0);
      }).catch(error=>{
        owner.__iceEchoPreparing=false;
        owner.__iceEchoModelFailed=true;
        console.warn('[Valgard ice echo] Preload failed',error);
      });
    }
    function buildIce3d(THREE,root,owner){
      const cache=owner?.__iceEchoBlueCopy;
      if(!cache?.model)return null;
      root.add(cache.model);
      cache.model.position.copy(cache.basePosition);
      cache.model.rotation.copy(cache.baseRotation);
      return {
        native:true,model:cache.model,core:cache.model,
        baseY:cache.basePosition.y,baseRotZ:cache.baseRotation.z,
        sourceBones:cache.bones,poseIn:cache.poseIn
      };
    }
    function echoes(b){return (b.__valgardEchoes ||= new Set());}
    function disposeEcho(b,echo,shatter=false){
      if(!echo || echo.__retired)return;
      echo.__retired=true;
      echo.dead=true;
      if(echo.owner?.__iceEcho===echo){
        echo.owner.__iceEcho=null;
        echo.owner.__iceEchoReadyAt=performance.now()/1000+ECHO_RESPAWN;
      }
      b.__valgardEchoes?.delete(echo);
      echo.root?.removeFromParent();
      for(const asset of echo.owned||[])asset?.dispose?.();
      echo.owned=[];
      if(shatter){
        showIceFX(b,echo.pos,0.85,true);
        b.ui.popup?.(echo.pos,'氷分身が砕け散った','#b9f5ff');
      }
    }
    function createEcho(owner){
      const b=owner?.battle,THREE=runtime?.THREE;
      if(!b || !THREE || b.ended || b.net || owner.dead || owner.stun>0 || !b.fighters.includes(owner))return;
      if(owner.__iceEcho && !owner.__iceEcho.dead && !owner.__iceEcho.__retired){
        owner.__iceEcho.focus=b.nearestEnemy(owner);
        return;
      }
      if(performance.now()/1000<(owner.__iceEchoReadyAt||0))return;
      const group=echoes(b);
      if(group.size>=MAX_ACTIVE)return;
      const fwd=owner.forward();
      const start=owner.pos.clone().addScaledVector(new THREE.Vector3(fwd.z,0,-fwd.x),1.5);
      const distance=Math.hypot(start.x,start.z);
      if(distance>11.8)start.multiplyScalar(11.8/distance);
      const owned=[],root=new THREE.Group();
      // Exact 3D model is already prepared. No synchronous clone at keypress.
      const rig=buildIce3d(THREE,root,owner);
      if(!rig)return;
      if(runtime.texture){
        const auraMat=new THREE.SpriteMaterial({map:runtime.texture,color:0x8ce3ff,
          transparent:true,opacity:.54,blending:THREE.AdditiveBlending,depthWrite:false,fog:false});
        const aura=new THREE.Sprite(auraMat);
        aura.position.y=1.13;aura.scale.set(3.2,3.65,1);
        root.add(aura);owned.push(auraMat);
        const floorGeo=new THREE.PlaneGeometry(2.45,2.45);
        const floorMat=new THREE.MeshBasicMaterial({map:runtime.texture,color:0xb0f2ff,
          transparent:true,opacity:.7,side:THREE.DoubleSide,
          blending:THREE.AdditiveBlending,depthWrite:false});
        const floor=new THREE.Mesh(floorGeo,floorMat);
        floor.rotation.x=-Math.PI/2;floor.position.y=.05;
        root.add(floor);owned.push(floorGeo,floorMat);
        root.userData.iceAura=aura;root.userData.iceFloor=floor;
      }
      // One-hit ephemeral ice duplicate: do not construct or render any HP bar.
      // This also removes 2 meshes, 2 geometries and 2 materials per summon.
      root.position.copy(start);b.scene.add(root);
      const maxHp=1;
      const echo={
        key:'valgard-ice-echo',name:'氷分身・ヴァルガルド',owner,root,owned,
        team:owner.team,pos:start,def:owner.def,scale:.92,radius:.45,
        hp:maxHp,maxHp,dead:false,__retired:false,remoteAuth:false,
        isPlayer:false,inv:0,guard:false,status:{},stun:0,action:null,y:0,
        facing:owner.facing,vel:new THREE.Vector3(),
        over:0,og:0,awakened:0,defMul:owner.defMul,atkMul:owner.atkMul*.65,
        focus:b.nearestEnemy(owner),attackIn:.26,fxIn:1.2,rig,animTime:0,attackPulse:0,
        forward(){return new THREE.Vector3(Math.sin(this.facing),0,Math.cos(this.facing));},
        receive(damage,stun,kx,kz){
          if(this.dead||this.__retired)return 0;
          const taken=Math.max(1,Math.round(Math.max(0,Number(damage)||0)));
          this.hp=0;
          this.stun=Math.max(this.stun,Math.max(0,Number(stun)||0));
          this.vel.set(Number(kx)||0,0,Number(kz)||0);
          this.dead=true;
          return taken;
        },
        applyStatus(key){
          if(this.dead||this.__retired)return;
          if(key==='freeze'||key==='petrify'){this.status[key]=Math.max(this.status[key]||0,1.2);this.stun=Math.max(this.stun,1.2);}
          else if(key==='slow'||key==='para'||key==='blind'||key==='silence')this.status[key]=2;
        }
      };
      owner.__iceEcho=echo;group.add(echo);
      showIceFX(b,start,.68);
      b.ui.popup?.(start,'氷分身（1回被弾で消滅）','#a2eeff');
      b.ui.sfx?.('skill',{elem:1,color:ICE});
    }
    function tickEcho(b,echo,dt){
      if(!echo || echo.__retired)return;
      const owner=echo.owner;
      if(!owner||owner.dead||!b.fighters.includes(owner)||b.ended){disposeEcho(b,echo,false);return;}
      if(echo.dead||echo.hp<=0){disposeEcho(b,echo,true);return;}
      dt=Math.min(.05,Math.max(0,Number(dt)||0));
      for(const key of Object.keys(echo.status)){
        echo.status[key]-=dt;
        if(echo.status[key]<=0)delete echo.status[key];
      }
      echo.stun=Math.max(0,echo.stun-dt);
      echo.attackIn=Math.max(0,echo.attackIn-dt);
      echo.fxIn-=dt;
      const valid=target=>target&&!target.dead&&target.hp>0&&target.team!==echo.team&&b.fighters.includes(target);
      const target=valid(echo.focus)?echo.focus:b.nearestEnemy(echo);
      echo.focus=target;
      if(target){
        const dx=target.pos.x-echo.pos.x,dz=target.pos.z-echo.pos.z;
        const dist=Math.hypot(dx,dz);
        if(dist>.0001){
          echo.facing=Math.atan2(dx,dz);
          if(echo.stun<=0&&!echo.status.freeze&&!echo.status.petrify){
            if(dist>ECHO_RANGE*.73){
              const speed=Math.min(ECHO_SPEED*dt,Math.max(0,dist-ECHO_RANGE*.7));
              echo.pos.x+=dx/dist*speed;
              echo.pos.z+=dz/dist*speed;
            }
            if(dist<ECHO_RANGE+(target.radius||.4)&&echo.attackIn<=0){
              echo.attackIn=.86;
              echo.attackPulse=.30;
              b.meleeHit(echo,ECHO_RANGE,420,.3,3.1,null,
                {kind:'echo',elem:1,color:ICE});
              // Capped low-cost hand-painted impact, never a new fighter/model.
              b.fxPop?.(echo.pos.clone().setY(1.18),1,6,2.25,.25,{grow:1.45,op:.85});
            }
          }
        }
      }
      const distance=Math.hypot(echo.pos.x,echo.pos.z);
      if(distance>12.2)echo.pos.multiplyScalar(12.2/distance);
      echo.root.position.copy(echo.pos);
      echo.root.rotation.y=echo.facing;
      // Exact original model. Reuse the original pose at low cadence.
      echo.animTime+=dt;
      echo.attackPulse=Math.max(0,(echo.attackPulse||0)-dt);
      const rig=echo.rig;
      if(rig?.native){
        const moving=!!target&&echo.stun<=0&&echo.pos.distanceTo(target.pos)>ECHO_RANGE*.78;
        rig.model.position.y=rig.baseY+(moving?.025:.009)*Math.sin(echo.animTime*8);
        rig.model.rotation.z=rig.baseRotZ+(echo.attackPulse>0
          ? .035*Math.sin((1-echo.attackPulse/.30)*Math.PI) : 0);
        if(rig.sourceBones?.length){
          rig.poseIn-=dt;
          if(rig.poseIn<=0){
            rig.poseIn=.1; // 10fps bone pose mirroring; no second mixer.
            for(const [srcBone,dstBone] of rig.sourceBones){
              dstBone.position.copy(srcBone.position);
              dstBone.quaternion.copy(srcBone.quaternion);
              dstBone.scale.copy(srcBone.scale);
            }
          }
        }
      }
      const seconds=b.fxClock||0;
      const aura=echo.root.userData.iceAura;
      const floor=echo.root.userData.iceFloor;
      if(aura)aura.material.opacity=.47+.08*Math.sin(seconds*4.5);
      if(floor)floor.rotation.z=seconds*.9;
      if(echo.fxIn<=0){
        echo.fxIn=1.35;
        b.fxPop?.(echo.pos.clone().setY(.55),1,7,.87,.35,{rise:.65,grow:1.3,op:.32});
      }
    }
    function showIceFX(b, pos, power = 1, breaking = false) {
      if (!b || !pos) return;
      const THREE = runtime?.THREE;
      if (!THREE) return;
      const at = pos.clone();
      const q = at.clone().setY(.10);
      b.fxPop?.(q,1,5,4.2*power,.82,{flat:true,grow:breaking?2.8:1.5,spin:breaking?-6:6,op:.86});
      b.fxPop?.(q.clone().setY(.16),1,4,2.4*power,.54,{flat:true,grow:2.2,spin:breaking?8:-8,op:.7});
      b.fxPop?.(at.clone().setY(1.15),1,2,3.0*power,.65,{grow:breaking?2.4:1.75,spin:5,op:.83});
      for(let i=0;i<5;i++){
        const a=i*Math.PI*2/5+Math.random()*.24;
        b.fxPop?.(new THREE.Vector3(at.x+Math.cos(a)*.95, .4+Math.random()*1.4, at.z+Math.sin(a)*.95),1,i%3===0?8:7, (1+Math.random()*.6)*power,.45+i*.04,{grow:2,rise:breaking?2.2:1.2,spin:(i%2?1:-1)*4,op:.7});
      }
      b.flashLight?.(at.clone().setY(1.2),ICE,breaking?1.4:1.8,.45);
      if (breaking) b.shake=Math.max(b.shake||0,.22);
    }


    // Prepare the real model once during the battle's intro/idle time.
    const battleAddBeforeEcho=Battle.prototype.add;
    Battle.prototype.add=function(key,options){
      const fighter=battleAddBeforeEcho.call(this,key,options);
      if(key==='valgard' && !fighter.remoteAuth && !this.net)
        scheduleEchoModel(fighter);
      return fighter;
    };
    // Normal slash summons/re-aims; no Fighter is constructed for the echo.
    const startLightOriginal=Fighter.prototype.startLight;
    Fighter.prototype.startLight=function(...args){
      if(this.key!=='valgard'||this.__isValgardIceEcho||this.remoteAuth||this.battle?.net||!runtime?.THREE)
        return startLightOriginal.apply(this,args);
      const b=this.battle;
      if(this.__iceEchoModelFailed){
        b?.ui?.popup?.(this.pos,'氷分身モデルの準備に失敗しました','#b9eeff');
        return startLightOriginal.apply(this,args);
      }
      if(!this.__iceEchoBlueCopy) scheduleEchoModel(this);
      if(this.dead||this.stun>0||b?.ended)return;
      const now=performance.now()/1000;
      this.faceNearest?.(9);
      this.action={type:'cast',t:0,dur:.4};
      this.vel.set(0,0,0);
      const active=this.__iceEcho;
      if(active&&!active.dead&&!active.__retired){
        active.focus=b.nearestEnemy(this);
        if(now>(this.__iceEchoCommandAt||0)){
          b.ui.popup?.(this.pos,'氷分身・追尾指令','#b4edff');
          this.__iceEchoCommandAt=now+.85;
        }
        return;
      }
      this.__iceEcho=null;
      if(this.__iceEchoQueued||now<(this.__iceEchoReadyAt||0))return;
      this.__iceEchoQueued=true;
    };
    // Include the proxy in enemy targeting/hits, but NEVER in Battle.fighters.
    // The original 3D fighter update / resurrection / camera loops stay untouched.
    const originalEnemiesOf=Battle.prototype.enemiesOf;
    Battle.prototype.enemiesOf=function(actor){
      const result=originalEnemiesOf.call(this,actor);
      if(this.net||!actor)return result;
      for(const echo of this.__valgardEchoes||[]){
        if(!echo.__retired&&!echo.dead&&echo.hp>0&&echo.team!==actor.team)result.push(echo);
      }
      return result;
    };

    // -------------------- VALGARD FROST SEAL --------------------
    // One press starts 30 seconds of freezing, immune to incoming damage.
    // No cooldown; pressing again refreshes the timer without adding a mesh.
    const GLYPH_RADIUS=4.1;
    const SEAL_DURATION=30.0;
    const FREEZE_IMMUNITY=2.5;
    function applySealVisual(t){
      if(!t?.visual || t.__iceSealVisual || !runtime?.THREE) return;
      const swaps=[];
      t.visual.traverse(node=>{
        if(!node?.isMesh || !node.material) return;
        const originals=Array.isArray(node.material)?node.material:[node.material];
        const clones=originals.map(src=>{
          const m=src.clone();
          if(m.color) m.color.lerp(new runtime.THREE.Color(0xb8f4ff),0.74);
          if('transparent' in m) m.transparent=true;
          if('opacity' in m) m.opacity=Math.min(m.opacity ?? 1,0.92);
          if(m.emissive){m.emissive.setHex(0x67dfff);m.emissiveIntensity=Math.max(0.42,m.emissiveIntensity||0);} 
          return m;
        });
        swaps.push([node,node.material,clones]);
        node.material=Array.isArray(node.material)?clones:clones[0];
      });
      t.__iceSealVisual=swaps;
    }
    function clearSealVisual(t){
      const swaps=t?.__iceSealVisual;
      if(!swaps) return;
      for(const [node,original,clones] of swaps){
        node.material=original;
        for(const m of clones) m?.dispose?.();
      }
      t.__iceSealVisual=null;
    }
    function thawTarget(t,owner=null){
      if(!t?.__iceSealOwner||(owner&&t.__iceSealOwner!==owner))return;
      if(t.status)delete t.status.freeze;
      // Undo only the seal's remaining restraint, without altering other DOTs.
      if((t.stun||0)>0)t.stun=Math.min(t.stun,.04);
      t.__iceSealOwner=null;
      clearSealVisual(t);
      t.__iceSealImmuneUntil=performance.now()/1000+FREEZE_IMMUNITY;
      t.battle?.fxPop?.(t.pos.clone().setY(1.2),1,8,1.8,.28,{grow:1.55,op:.55});
    }
    function stopSeal(f){
      const seal=f?.__iceSeal;
      if(!seal)return;
      seal.root.removeFromParent();
      seal.mat.dispose();seal.geo.dispose();
      f.__iceSeal=null;
      // Seal ends on its scheduled expiry; previously frozen enemies may thaw
      // when their remaining status expires or when they are hit.
    }
    function startSeal(f,now){
      const THREE=runtime?.THREE;if(!THREE||!runtime?.sealTexture)return false;
      // Zero cooldown: re-tapping an active seal only renews its full lifetime.
      if(f.__iceSeal){
        f.__iceSeal.started=now;
        f.__iceSeal.expires=now+SEAL_DURATION;
        f.battle?.ui.popup?.(f.pos,'氷結封印陣・30秒に延長','#b9f7ff');
        return true;
      }
      const geo=new THREE.PlaneGeometry(GLYPH_RADIUS*2,GLYPH_RADIUS*2);
      const mat=new THREE.MeshBasicMaterial({map:runtime.sealTexture,color:0xc7f5ff,
        transparent:true,opacity:.86,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
        depthWrite:false,depthTest:true,fog:false});
      const root=new THREE.Mesh(geo,mat);
      root.rotation.x=-Math.PI/2;root.position.y=.065;root.renderOrder=4;
      f.root.add(root);
      f.__iceSeal={root,mat,geo,started:now,expires:now+SEAL_DURATION,fx:0};
      f.battle?.ui.popup?.(f.pos,`氷結封印陣：${SEAL_DURATION}秒持続`,'#bcf5ff');
      f.battle?.fxPop?.(f.pos.clone().setY(.1),1,5,4.8,.56,{flat:true,grow:1.2,spin:2.5,op:.8});
      f.battle?.flashLight?.(f.pos.clone().setY(.8),ICE,.95,.22);
      return true;
    }
    const updateFighterOriginal=Fighter.prototype.update;
    Fighter.prototype.update=function(dt,input){
      if(this.key!=='valgard'||this.__isValgardIceEcho||this.remoteAuth||this.battle?.net)
        return updateFighterOriginal.call(this,dt,input);
      const now=performance.now()/1000;
      const pressed=!!input?.guard;
      const edge=pressed&&!this.__iceSealGuardWasDown;
      this.__iceSealGuardWasDown=pressed;
      // Never enter the engine's ordinary damage-reduction guard stance.
      if(pressed)input={...input,guard:false};
      const outcome=updateFighterOriginal.call(this,dt,input);
      this.guard=false;
      if(this.guardMesh)this.guardMesh.visible=false;
      // Damage never cancels the 30-second seal. Only natural expiry/death ends it.
      if(this.__iceSeal&&(this.dead||now>=this.__iceSeal.expires))stopSeal(this);
      if(edge&&!this.dead&&this.stun<=0&&this.y<=.15){
        startSeal(this,now);
      }
      const seal=this.__iceSeal;
      if(!seal)return outcome;
      seal.fx-=(Math.max(0,dt)||0);
      seal.mat.opacity=.7+.16*Math.sin((now-seal.started)*5);
      seal.root.rotation.z+=dt*.55;
      if(seal.fx<=0){
        seal.fx=.72;
        const p=this.pos.clone().setY(.2+Math.random()*1.05);
        p.x+=(Math.random()-.5)*GLYPH_RADIUS*1.3;
        p.z+=(Math.random()-.5)*GLYPH_RADIUS*1.3;
        this.battle.fxPop?.(p,1,7,.8,.37,{rise:.52,grow:1.35,op:.33});
      }
      for(const target of this.battle.enemiesOf(this)){
        if(!target||target.dead||target.remoteAuth||target.awakened>0)continue;
        if(now<(target.__iceSealImmuneUntil||0))continue;
        const d=Math.hypot(target.pos.x-this.pos.x,target.pos.z-this.pos.z);
        if(d>GLYPH_RADIUS+(target.radius||.4))continue;
        if(target.__iceSealOwner===this && target.status?.freeze>0){
          applySealVisual(target);
          target.stun=Math.max(target.stun,.25);
          target.guard=false;
          target.action=null;
          target.vel?.set?.(0,0,0);
          continue;
        }
        if(target.status?.freeze>0)continue;
        target.applyStatus?.('freeze');
        if(target.status?.freeze>0){
          target.__iceSealOwner=this;
          applySealVisual(target);
          target.stun=Math.max(target.stun,.25);
          target.guard=false;
          target.action=null;
          target.vel?.set?.(0,0,0);
          this.battle.fxPop?.(target.pos.clone().setY(1.1),1,2,2.1,.32,{grow:1.5,op:.6});
          this.battle.ui.popup?.(target.pos,'氷結封印','#a6f4ff');
        }
      }
      return outcome;
    };
    // Hits thaw a frozen enemy, but NEVER interrupt the caster's ice circle.
    const receiveWithEcho=Fighter.prototype.receive;
    Fighter.prototype.receive=function(...args){
      const received=receiveWithEcho.apply(this,args);
      if(received>0 && this.__iceSealOwner)thawTarget(this);
      return received;
    };
    const genericFighterUpdate=Fighter.prototype.update;
    Fighter.prototype.update=function(dt,input){
      if(this.__iceSealOwner && this.status?.freeze>0){
        const locked={...(input||{}),mx:0,mz:0,guard:false,attack:false,skill:false,skill2:false,heal:false,over:false,jump:false,skillIdx:null};
        this.action=null;
        this.guard=false;
        this.stun=Math.max(this.stun,.25);
        this.vel?.set?.(0,0,0);
        const out=genericFighterUpdate.call(this,dt,locked);
        this.action=null;
        this.guard=false;
        this.vel?.set?.(0,0,0);
        applySealVisual(this);
        return out;
      }
      if(this.__iceSealVisual && !(this.__iceSealOwner && this.status?.freeze>0)) clearSealVisual(this);
      return genericFighterUpdate.call(this,dt,input);
    };

    const updateOriginal=Battle.prototype.update;
    Battle.prototype.update=function(rawDt,playerInput){
      // Retire echoes before AI target selection if their owner is defeated.
      for(const echo of [...(this.__valgardEchoes||[])]){
        if(echo.owner.dead||echo.hp<=0||echo.dead)disposeEcho(this,echo,!echo.owner.dead);
      }
      const result=updateOriginal.call(this,rawDt,playerInput);
      for(const owner of this.fighters){
        if(owner.key!=='valgard'||owner.remoteAuth||this.net)continue;
        if(!owner.__iceEchoBlueCopy&&!owner.__iceEchoModelFailed)
          scheduleEchoModel(owner);
        if(owner.__iceEchoModelFailed)owner.__iceEchoQueued=false;
        if(owner.__iceEchoQueued && owner.__iceEchoBlueCopy){
          owner.__iceEchoQueued=false;
          createEcho(owner);
        }
      }
      for(const echo of [...(this.__valgardEchoes||[])])tickEcho(this,echo,rawDt);
      // Detect naturally expired freeze so later hits do not clear unrelated stuns.
      for(const target of this.fighters){
        if(target.__iceSealOwner && !target.status?.freeze){
          target.__iceSealOwner=null;
          clearSealVisual(target);
        } else if(target.__iceSealOwner && target.status?.freeze>0){
          applySealVisual(target);
        }
      }
      const labels=(this.__valgardUiClock=(this.__valgardUiClock||0)+Math.max(0,rawDt||0));
      if(labels>.3){
        this.__valgardUiClock=0;
        const actor=this.fighters.find(f=>f.isPlayer);
        const mine=actor?.key==='valgard'&&!this.net;
        const attack=document.querySelector('#tbtns button[data-act="attack"]');
        if(attack){
          const text=mine?'氷分身':'斬';
          if(attack.textContent!==text){attack.textContent=text;attack.setAttribute('aria-label',mine?'氷分身を召喚・追尾指示':'通常攻撃');attack.style.fontSize=mine?'clamp(9px,2.2vmin,12px)':'';}
        }
        const guard=document.querySelector('#tbtns button[data-act="guard"]');
        if(guard){
          const now=performance.now()/1000;
          const active=actor?.__iceSeal;
          const remaining=active?Math.max(0,Math.ceil(active.expires-now)):0;
          const text=!mine?'構':active?`結界${remaining}秒`:'氷結陣';
          if(guard.textContent!==text){guard.textContent=text;guard.style.fontSize=mine?'clamp(9px,2.2vmin,12px)':'';}
          guard.setAttribute('aria-label',!mine?'ガード':active?`氷結封印陣：残り${remaining}秒、再押下で30秒へ延長`:'氷結封印陣：クールダウンなし、1回押すと30秒間展開');
          guard.setAttribute('aria-pressed',mine&&!!active?'true':'false');
        }
      }
      return result;
    };
    const disposeOriginal=Battle.prototype.dispose;
    Battle.prototype.dispose=function(...args){
      for(const f of this.fighters||[]){
        if(f.__iceSeal)stopSeal(f,false);
        if(f.__iceSealOwner)f.__iceSealOwner=null;
        clearSealVisual(f);
        f.__iceEchoQueued=false;
      }
      for(const echo of [...(this.__valgardEchoes||[])])disposeEcho(this,echo,false);
      for(const f of this.fighters||[]){
        const cache=f.__iceEchoBlueCopy;
        if(cache){
          cache.model.removeFromParent();
          for(const material of cache.materials)material.dispose();
          if(cache.bones.length){
            cache.model.traverse(node=>{
              if(node.isSkinnedMesh)node.skeleton?.dispose?.();
            });
          }
          f.__iceEchoBlueCopy=null;
        }
      }
      return disposeOriginal.apply(this,args);
    };

  }

  // Premium menu utilities, accessible navigation and locally-persisted gifts.
  // This is an opt-in overlay over the existing game, not a replacement for its logic.
  (() => {
    const safeGet = (key, fallback = '') => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
    const safeSet = (key, val) => { try { localStorage.setItem(key, val); return true; } catch { return false; } };
    const fromJson = (text, fallback) => { try { return JSON.parse(text) ?? fallback; } catch { return fallback; } };
    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
    const JST_MS = 9 * 3600000;
    const TIMED_MS = 30 * 60000;
    const TIMED_REWARD = 120;
    const DAILY_REWARDS = [300, 350, 400, 450, 550, 700, 1200];
    const SAVE_KEY = 'arkeia-save-v1';
    const GIFT_KEY = 'riftfall-gifts-v2';
    const FAV_KEY = 'riftfall-ui-favorites-v1';
    const RECENT_KEY = 'riftfall-ui-recent-v1';
    const THEME_KEY = 'riftfall-ui-theme-v1';
    const DENSITY_KEY = 'riftfall-ui-density-v1';
    const dayJST = (ms) => Math.floor((ms + JST_MS) / 86400000);
    const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
    const int = (value, min, max) => Math.min(max, Math.max(min, Math.trunc(num(value))));
    const format = (value) => Math.floor(value).toLocaleString('ja-JP');
    const duration = (ms) => {
      const s = Math.max(0, Math.ceil(ms / 1000));
      return `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}時間 ` : ''}${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}分${String(s % 60).padStart(2, '0')}秒`;
    };
    function toast(message) {
      const el = document.getElementById('rift-toast');
      if (!el) return;
      el.textContent = String(message);
      el.hidden = false;
      clearTimeout(toast.token);
      toast.token = setTimeout(() => { el.hidden = true; }, 3500);
    }
    const themeNames = ['frost', 'royal', 'ember'];
    let theme = safeGet(THEME_KEY, 'frost');
    if (!themeNames.includes(theme)) theme = 'frost';
    let density = safeGet(DENSITY_KEY, 'comfortable');
    if (!['comfortable', 'compact'].includes(density)) density = 'comfortable';
    document.documentElement.dataset.riftTheme = theme;
    document.documentElement.dataset.riftDensity = density;
    const toastEl = document.createElement('div');
    toastEl.id = 'rift-toast'; toastEl.setAttribute('role', 'status'); toastEl.hidden = true;
    document.body.appendChild(toastEl);

    // Reliable floating fallback for all menu Back buttons, even when .topbar
    // cannot remain sticky due to ancestor positioning or browser quirks.
    const floatBack = document.createElement('button');
    floatBack.id = 'rift-floating-back'; floatBack.type = 'button';
    floatBack.textContent = '‹ 戻る'; floatBack.hidden = true;
    floatBack.addEventListener('click', () => {
      const current = $('#ui .screen.on');
      const original = current?.querySelector('.topbar .back:not([disabled]), .portal-header .back:not([disabled])');
      if (original && !original.hidden) original.click();
    });
    document.body.append(floatBack);

    const tools = document.createElement('nav');
    tools.className = 'rift-utility'; tools.id = 'rift-utility';
    tools.setAttribute('aria-label', 'メニュー便利操作'); tools.hidden = true;
    tools.innerHTML = '<button type="button" data-ui-act="gift">🎁 贈り物</button>' +
      '<button type="button" data-ui-act="search">⌕ 検索</button>' +
      '<button type="button" data-ui-act="density">▦ 表示切替</button>' +
      '<button type="button" data-ui-act="theme">✦ 色変更</button>' +
      '<button type="button" data-ui-act="top">↑ 上へ</button>';
    document.body.append(tools);

    function currentScreen() { return $('#ui .screen.on'); }
    function updateToolbar() {
      const current = currentScreen();
      const allowed = !!current && !['scr-press', 'scr-story'].includes(current.id);
      tools.hidden = !allowed || !!$('#rift-gift-dialog:not([hidden])');
      const original = current?.querySelector('.topbar .back:not([disabled]), .portal-header .back:not([disabled])');
      const rect = original?.getBoundingClientRect();
      const isVisible = !!(rect && rect.width > 0 && rect.height > 0 && rect.top >= 12 && rect.bottom <= window.innerHeight - 5);
      floatBack.hidden = !original || !allowed || isVisible || !!$('#rift-gift-dialog:not([hidden])');
      if (original && !floatBack.hidden) floatBack.textContent = `‹ ${original.textContent?.trim() || '戻る'}`;
      const search = $('[data-ui-act="search"]', tools);
      if (search) search.hidden = current?.id !== 'scr-select';
      const up = $('[data-ui-act="top"]', tools);
      if (up) up.hidden = !current || current.scrollTop < 90;
    }
    let queuedLayout = false;
    const scheduleToolbar = () => {
      if (queuedLayout) return;
      queuedLayout = true;
      requestAnimationFrame(() => { queuedLayout = false; updateToolbar(); });
    };
    document.addEventListener('scroll', scheduleToolbar, true);
    window.addEventListener('resize', scheduleToolbar);
    document.addEventListener('click', scheduleToolbar);
    new MutationObserver(scheduleToolbar).observe($('#ui') || document.body, {
      attributes: true, subtree: true, attributeFilter: ['class', 'hidden']
    });
    tools.addEventListener('click', (event) => {
      const action = event.target.closest('button')?.dataset.uiAct;
      if (!action) return;
      const screen = currentScreen();
      if (action === 'gift') openGift();
      if (action === 'search') { $('#select-search')?.focus(); $('#select-search')?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      if (action === 'top') screen?.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      if (action === 'density') {
        density = density === 'compact' ? 'comfortable' : 'compact';
        document.documentElement.dataset.riftDensity = density;
        safeSet(DENSITY_KEY, density);
        toast(density === 'compact' ? 'コンパクト表示に変更' : 'ゆったり表示に変更');
      }
      if (action === 'theme') {
        theme = themeNames[(themeNames.indexOf(theme) + 1) % themeNames.length];
        document.documentElement.dataset.riftTheme = theme;
        safeSet(THEME_KEY, theme);
        const label = { frost: '氷晶', royal: '星宮', ember: '紅焔' }[theme];
        toast(`テーマを「${label}」に変更`);
      }
      scheduleToolbar();
    });

    // Search, favorites, sorting, recent selections: applies to dynamically
    // inserted stage cards and fighter cards without changing their click logic.
    const favorites = new Set(fromJson(safeGet(FAV_KEY, '[]'), []).filter(v => typeof v === 'string').slice(0, 1000));
    let recents = fromJson(safeGet(RECENT_KEY, '[]'), []).filter(v => typeof v === 'string').slice(0, 40);
    let filterMode = 'all';
    let sortMode = 'original';
    const cardOrder = new WeakMap();
    let orderCounter = 0;
    const grid = $('#select-grid');
    const filterTools = document.createElement('div');
    filterTools.className = 'rift-filter-tools'; filterTools.setAttribute('aria-label', 'カード一覧表示');
    filterTools.innerHTML = '<button type="button" data-filter="all" aria-pressed="true">すべて</button>' +
      '<button type="button" data-filter="favorites" aria-pressed="false">★ お気に入り</button>' +
      '<button type="button" data-filter="recent" aria-pressed="false">◷ 最近選択</button>' +
      '<select aria-label="並び順" id="rift-sort"><option value="original">通常の並び順</option>' +
      '<option value="name">名前順</option><option value="favorites">お気に入り優先</option></select>';
    const selectTools = $('#scr-select .select-tools');
    if (selectTools?.parentNode) selectTools.insertAdjacentElement('afterend', filterTools);
    else if (grid?.parentNode) grid.parentNode.insertBefore(filterTools, grid);
    function cardId(card) {
      if (card.dataset.riftId) return card.dataset.riftId;
      const b = card.querySelector('b');
      const name = b?.textContent?.trim() || card.dataset.search || card.textContent?.slice(0, 30) || 'unknown';
      const title = card.querySelector('em')?.textContent?.trim() || '';
      card.dataset.riftId = `${card.classList.contains('stage-tile') ? 'stage' : 'fighter'}:${name}:${title}`;
      return card.dataset.riftId;
    }
    function saveFavorites() { safeSet(FAV_KEY, JSON.stringify([...favorites].slice(0, 1000))); }
    function refreshFilters() {
      if (!grid) return;
      const cards = $$('.card', grid);
      const searchValue = ($('#select-search')?.value || '').trim().toLocaleLowerCase();
      let count = 0;
      cards.forEach((card, index) => {
        const key = cardId(card);
        if (!cardOrder.has(card)) cardOrder.set(card, ++orderCounter);
        const star = $('.rift-card-favorite', card);
        if (star) { star.setAttribute('aria-pressed', favorites.has(key) ? 'true' : 'false'); star.textContent = favorites.has(key) ? '★' : '☆'; }
        const allowed = filterMode === 'favorites' ? favorites.has(key) : filterMode === 'recent' ? recents.includes(key) : true;
        const text = `${card.dataset.search || ''} ${card.textContent || ''}`.toLocaleLowerCase();
        const matched = !searchValue || text.includes(searchValue);
        card.classList.toggle('rift-is-filtered', !allowed || !matched);
        const baseOrder = cardOrder.get(card) || index;
        card.style.order = String(sortMode === 'name' ? 10000 : sortMode === 'favorites' ? (favorites.has(key) ? 0 : 100000) + baseOrder : baseOrder);
        if (!card.hidden && !card.classList.contains('rift-is-filtered')) count++;
      });
      if (sortMode === 'name') {
        const sorted = cards.slice().sort((a, b) => cardId(a).localeCompare(cardId(b), 'ja'));
        sorted.forEach((c, i) => { c.style.order = String(i); });
      }
      const ctr = $('#select-counter'); if (ctr) ctr.textContent = `${count} / ${cards.length} 件`;
      const empty = $('#select-empty'); if (empty) empty.hidden = !(cards.length && count === 0);
    }
    function attachCards() {
      if (!grid) return;
      for (const card of $$('.card', grid)) {
        if (card.dataset.riftEnhanced) continue;
        card.dataset.riftEnhanced = '1';
        const key = cardId(card);
        const fav = document.createElement('span');
        fav.className = 'rift-card-favorite'; fav.setAttribute('role', 'button'); fav.tabIndex = 0;
        fav.setAttribute('aria-label', 'お気に入りに登録・解除');
        fav.textContent = favorites.has(key) ? '★' : '☆';
        fav.setAttribute('aria-pressed', favorites.has(key) ? 'true' : 'false');
        function toggle(event) {
          event.preventDefault(); event.stopPropagation();
          if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
          saveFavorites(); refreshFilters();
          toast(favorites.has(key) ? 'お気に入りに追加しました' : 'お気に入りを解除しました');
        }
        fav.addEventListener('click', toggle);
        fav.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') toggle(event);
        });
        card.appendChild(fav);
        card.addEventListener('click', event => {
          if (event.defaultPrevented || card.disabled) return;
          recents = [key, ...recents.filter(x => x !== key)].slice(0, 30);
          safeSet(RECENT_KEY, JSON.stringify(recents));
        });
      }
      refreshFilters();
    }
    filterTools.addEventListener('click', event => {
      const b = event.target.closest('button[data-filter]'); if (!b) return;
      filterMode = b.dataset.filter;
      $$('[data-filter]', filterTools).forEach(el => el.setAttribute('aria-pressed', String(el.dataset.filter === filterMode)));
      refreshFilters();
    });
    $('#rift-sort')?.addEventListener('change', event => { sortMode = event.target.value; refreshFilters(); });
    $('#select-search')?.addEventListener('input', () => setTimeout(refreshFilters, 0));
    if (grid) {
      new MutationObserver(() => { attachCards(); }).observe(grid, { childList: true });
      attachCards();
    }

    // Daily (JST calendar day) and elapsed-time gifts credited into the
    // existing local shard save. Reload once after claiming because main.js
    // holds save in its module closure and must reload that updated snapshot.
    const readSave = () => fromJson(safeGet(SAVE_KEY, '{}'), {});
    const giftDefault = (now) => ({ dailyKey: -1, streak: 0, nextTimedAt: now + TIMED_MS, lastObservedAt: now });
    function readGifts(now) {
      const sidecar = fromJson(safeGet(GIFT_KEY, '{}'), {});
      const carried = readSave()?.giftClaims || {};
      const pick = (name, initial) => Math.max(num(sidecar[name]), num(carried[name]), initial);
      return {
        dailyKey: Math.trunc(pick('dailyKey', -1)),
        streak: int(sidecar.dailyKey >= carried.dailyKey ? sidecar.streak : carried.streak, 0, 7),
        nextTimedAt: pick('nextTimedAt', now + (sidecar.nextTimedAt || carried.nextTimedAt ? 0 : TIMED_MS)),
        lastObservedAt: pick('lastObservedAt', now)
      };
    }
    if (!safeGet(GIFT_KEY)) safeSet(GIFT_KEY, JSON.stringify(giftDefault(Date.now())));
    function giftSnapshot() {
      const now = Date.now(), gift = readGifts(now);
      const stable = now + 60 * 1000 >= gift.lastObservedAt;
      const day = dayJST(now);
      const isDaily = stable && day > gift.dailyKey;
      const upcomingStreak = day === gift.dailyKey + 1 ? Math.min(7, gift.streak + 1) : 1;
      const currentStreak = isDaily ? upcomingStreak : gift.streak;
      return { now, day, gift, stable, isDaily, nextTimed: stable && now >= gift.nextTimedAt,
        currentStreak, dailyReward: DAILY_REWARDS[Math.max(0, currentStreak - 1)] };
    }
    let claiming = false;
    function grantGift(kind) {
      if (claiming) return;
      const snapshot = giftSnapshot();
      if (!snapshot.stable) { toast('端末の時刻を確認してください'); renderGifts(); return; }
      const isDaily = kind === 'daily';
      if (isDaily ? !snapshot.isDaily : !snapshot.nextTimed) { toast('まだ受け取れません'); return; }
      const currentSave = readSave();
      const shardBalance = int(currentSave.shards, 0, 999999);
      const amount = isDaily ? snapshot.dailyReward : TIMED_REWARD;
      if (shardBalance + amount > 999999) { toast('灯晶の上限に近いため、先に灯晶を使ってください'); return; }
      claiming = true;
      const gifts = { ...snapshot.gift, lastObservedAt: snapshot.now };
      if (isDaily) {
        gifts.dailyKey = snapshot.day;
        gifts.streak = snapshot.currentStreak;
      } else gifts.nextTimedAt = snapshot.now + TIMED_MS;
      const updated = { ...currentSave, shards: shardBalance + amount, giftClaims: gifts };
      const previousSave = safeGet(SAVE_KEY, '{}');
      const previousGift = safeGet(GIFT_KEY, '{}');
      if (!safeSet(SAVE_KEY, JSON.stringify(updated)) || !safeSet(GIFT_KEY, JSON.stringify(gifts))) {
        safeSet(SAVE_KEY, previousSave);
        safeSet(GIFT_KEY, previousGift);
        claiming = false; toast('保存できませんでした。ブラウザの保存容量・設定を確認してください'); return;
      }
      // Existing account sync is maintained by the original game. This flag
      // merely marks a pending local change; server validation is not implied.
      if ((safeGet('arkeia-sync') || '').length === 12) safeSet('arkeia-sync-dirty', '1');
      const count = $('#title-shards'); if (count) count.textContent = `灯晶　${format(updated.shards)}`;
      toast(`灯晶 +${format(amount)} を獲得しました！ 保存を反映します`);
      renderGifts();
      setTimeout(() => window.location.reload(), 950);
    }
    const dialog = document.createElement('div');
    dialog.className = 'rift-gift-dialog'; dialog.id = 'rift-gift-dialog'; dialog.hidden = true;
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', '贈り物の受取');
    dialog.innerHTML = '<div class="rift-gift-panel"><button class="rift-gift-close" type="button" aria-label="閉じる">×</button>' +
      '<h2>✦ 天晶の贈り物</h2><p>毎日の冒険と、時間の経過に感謝を。灯晶を受け取って旅の準備を整えましょう。</p>' +
      '<div class="rift-gift-grid"><section class="rift-gift-card"><b>☀ デイリープレゼント</b>' +
      '<strong id="rift-daily-reward">—</strong><small id="rift-daily-time">準備中...</small>' +
      '<button type="button" id="rift-claim-daily">デイリーを受け取る</button></section>' +
      '<section class="rift-gift-card"><b>⌛ 時間経過プレゼント</b><strong>灯晶 +120</strong>' +
      '<small id="rift-timed-time">準備中...</small><button type="button" id="rift-claim-timed">時間報酬を受け取る</button></section></div>' +
      '<div id="rift-streak-track" class="rift-streak-track" aria-label="連続ログイン報酬"></div>' +
      '<p style="font-size:12px">毎日0時（日本時間）に更新。時間報酬は30分ごとに受取可能です。受取後、保存内容の反映のためゲームを再読み込みします。</p>' +
      '<p style="font-size:11px;color:#e6bf91">※ブラウザのローカルセーブで管理します。端末時刻の変更や複数端末間の厳密な不正受取防止にはサーバー側の対応が必要です。</p></div>';
    document.body.append(dialog);
    let previousFocus = null;
    function closeGift() {
      dialog.hidden = true;
      previousFocus?.focus?.();
      scheduleToolbar();
    }
    function openGift() {
      previousFocus = document.activeElement;
      dialog.hidden = false;
      renderGifts();
      $('.rift-gift-close', dialog)?.focus();
      scheduleToolbar();
    }
    dialog.addEventListener('click', (event) => { if (event.target === dialog) closeGift(); });
    $('.rift-gift-close', dialog)?.addEventListener('click', closeGift);
    $('#rift-claim-daily')?.addEventListener('click', () => grantGift('daily'));
    $('#rift-claim-timed')?.addEventListener('click', () => grantGift('timed'));
    function renderGifts() {
      const s = giftSnapshot();
      const daily = $('#rift-daily-reward');
      const dailyTime = $('#rift-daily-time');
      const timedTime = $('#rift-timed-time');
      const dBtn = $('#rift-claim-daily');
      const tBtn = $('#rift-claim-timed');
      if (daily) daily.textContent = `灯晶 +${format(s.dailyReward)}`;
      if (dailyTime) dailyTime.textContent = !s.stable ? '端末時刻に異常があります' :
        s.isDaily ? `受取可能 ／ 連続 ${s.currentStreak}日目` : `本日受取済み ／ 次の更新まで ${duration(((s.day + 1) * 86400000 - JST_MS) - s.now)}`;
      if (timedTime) timedTime.textContent = !s.stable ? '端末時刻に異常があります' :
        s.nextTimed ? '受取可能 ／ 30分ごとに更新' : `次のプレゼントまで ${duration(s.gift.nextTimedAt - s.now)}`;
      if (dBtn) dBtn.disabled = claiming || !s.isDaily;
      if (tBtn) tBtn.disabled = claiming || !s.nextTimed;
      const streakTrack = $('#rift-streak-track');
      if (streakTrack && streakTrack.children.length !== 7) {
        for (let i = 0; i < 7; i++) {
          const day = document.createElement('span');
          day.className = 'rift-streak-day';
          day.innerHTML = `${i + 1}日目 <b>+${format(DAILY_REWARDS[i])}</b>`;
          streakTrack.append(day);
        }
      }
      if (streakTrack) [...streakTrack.children].forEach((el, i) => {
        el.dataset.active = String(i + 1 === s.currentStreak);
      });
      const titleBtn = $('#rift-title-gift');
      if (titleBtn) titleBtn.textContent = (s.isDaily || s.nextTimed) ?
        '🎁 受け取り可能なプレゼントがあります' : '🎁 デイリー・時間プレゼントを確認';
    }
    const title = $('#scr-title');
    if (title && !$('#rift-title-gift')) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'rift-gift-button'; btn.id = 'rift-title-gift';
      btn.addEventListener('click', openGift);
      const inner = $('.inner', title);
      const anchor = $('.menu', inner || title);
      if (anchor) anchor.insertAdjacentElement('beforebegin', btn);
      else (inner || title).appendChild(btn);
    }
    renderGifts();
    setInterval(() => { if (!dialog.hidden || currentScreen()?.id === 'scr-title') renderGifts(); }, 1000);
    window.addEventListener('storage', (event) => {
      if ([GIFT_KEY, SAVE_KEY].includes(event.key)) renderGifts();
      if (event.key === FAV_KEY) { const list = fromJson(event.newValue, []); favorites.clear(); list.forEach(x => favorites.add(x)); refreshFilters(); }
    });
    document.addEventListener('keydown', event => {
      const k = event.key.toLowerCase();
      if (event.key === 'Escape') {
        if (!dialog.hidden) { event.preventDefault(); closeGift(); return; }
        if (event.target?.matches?.('input, textarea, select')) { event.target.blur(); return; }
        const back = currentScreen()?.querySelector('.topbar .back:not([disabled])');
        if (back) { event.preventDefault(); back.click(); }
      }
      if ((event.ctrlKey || event.metaKey) && k === 'k') {
        if ($('#scr-select.on') && $('#select-search')) { event.preventDefault(); $('#select-search').focus(); }
      }
      if (event.altKey && k === 'g' && currentScreen()) { event.preventDefault(); openGift(); }
    });
    scheduleToolbar();
  })();

})();
