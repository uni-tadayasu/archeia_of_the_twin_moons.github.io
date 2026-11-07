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
      const hpBar=new THREE.Group(); hpBar.position.y=2.65;
      const bgGeo=new THREE.PlaneGeometry(1.75,.2);
      const bgMat=new THREE.MeshBasicMaterial({color:0x082c42,opacity:.9,transparent:true,depthWrite:false,depthTest:false});
      const bg=new THREE.Mesh(bgGeo,bgMat);
      const hpGeo=new THREE.PlaneGeometry(1.68,.13);
      const hpMat=new THREE.MeshBasicMaterial({color:0xb5f5ff,depthWrite:false,depthTest:false});
      const fill=new THREE.Mesh(hpGeo,hpMat);fill.position.z=.014;
      bg.renderOrder=fill.renderOrder=100;
      hpBar.add(bg,fill);root.add(hpBar);
      owned.push(bgGeo,bgMat,hpGeo,hpMat);
      root.position.copy(start);b.scene.add(root);
      const maxHp=1;
      const echo={
        key:'valgard-ice-echo',name:'氷分身・ヴァルガルド',owner,root,owned,
        team:owner.team,pos:start,def:owner.def,scale:.92,radius:.45,
        hp:maxHp,maxHp,dead:false,__retired:false,remoteAuth:false,
        isPlayer:false,inv:0,guard:false,status:{},stun:0,action:null,y:0,
        facing:owner.facing,vel:new THREE.Vector3(),
        over:0,og:0,awakened:0,defMul:owner.defMul,atkMul:owner.atkMul*.46,
        focus:b.nearestEnemy(owner),attackIn:.26,fxIn:1.2,hpBar,fill,rig,animTime:0,attackPulse:0,
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
              b.meleeHit(echo,ECHO_RANGE,(owner.def?.light?.dmg||66)*.58,.3,3.1,null,
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
      const ratio=Math.max(0,Math.min(1,echo.hp/Math.max(1,echo.maxHp)));
      echo.fill.scale.x=Math.max(.001,ratio);
      echo.fill.position.x=-.84*(1-ratio);
      echo.hpBar.quaternion.copy(b.camera.quaternion);
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

})();
