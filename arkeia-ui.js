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

  // Back/return controls are NORMAL CONTENT, not sticky or viewport-fixed.
  // They scroll away with their own menu; no click behaviour is modified.
  const scrollStyle = document.createElement('style');
  scrollStyle.id = 'illustrated-patch-scrolling-back';
  scrollStyle.textContent = `
    #ui .screen .topbar, #ui .screen .topbar:has(> .back),
    #ui #scr-lobby .topbar, #ui #scr-result .topbar, #ui #scr-story .topbar {
      position:relative !important; top:auto !important; bottom:auto !important;
      left:auto !important; right:auto !important; backdrop-filter:none !important;
      -webkit-backdrop-filter:none !important; z-index:2 !important;
    }
    #ui .screen .back, #ui .screen .topbar .back, #ui #select-back {
      position:static !important; inset:auto !important; transform:none;
    }
    #scr-title .portal-header { position:relative !important; top:auto !important; }
    #ui .screen.on { touch-action:pan-y; overscroll-behavior-y:contain; }
    @media(max-width:680px){#ui .screen .topbar{flex-shrink:0}}
  `;
  document.head.appendChild(scrollStyle);

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
})();
