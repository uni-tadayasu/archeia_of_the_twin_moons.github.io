// RF_NEPT_V14_ADVENTURE
// RF_BATTLE_FIX_V9_1_20261109
// RF_GRAND_FOUR_20261108 gaizorg-adventure.js
/**
 * Riftfall Arena – Gaizorg Adventure (original extension, 2026-11-08).
 * Builds a small freely walkable rest camp, stage portal and a 10-battle chapter.
 * Runs inside the game's existing scene/battle system; no new renderer or audio loop.
 */
import { instantiateModel, disposeModel } from './model-runtime.js?v=rf-mobile-v7-20261109';
import { attachValgardMotion } from './valgard-motion.js?v=20261108-grand-four-v3';
// RF_OPERATOR_GIGANTES_ADVENTURE_20261108

const STAGE_PLAN = [
  {name:'熾火の門',stage:'moon',foes:['m0','m6'],hp:0.85,atk:.83,award:90},
  {name:'黒鉄の回廊',stage:'bamboo',foes:['m8','m16','m19'],hp:1.05,atk:.9,award:120},
  {name:'灼熱の砂海',stage:'desert',foes:['m12','m23','m31'],hp:1.18,atk:1,award:150},
  {name:'灰色の峡谷',stage:'frost',foes:['m34','m39','m47'],hp:1.35,atk:1.08,award:190},
  {name:'業火の陣地',stage:'ember',foes:['m51','m58','m66'],hp:1.48,atk:1.12,award:220},
  {name:'焦土の守護者',stage:'void',foes:['boss1','m63'],hp:1.7,atk:1.2,award:260},
  {name:'紅蓮に沈む都',stage:'heaven',foes:['boss3','m73','m77'],hp:1.85,atk:1.27,award:300},
  {name:'失われた王宮',stage:'moon',foes:['boss6','boss8'],hp:2.1,atk:1.34,award:360},
  {name:'竜王の最奥',stage:'desert',foes:['boss7','boss20','m96'],hp:2.35,atk:1.47,award:450},
  {name:'最終決戦・超甲獣ガイゾルグ',stage:'ember',foes:['gaizorg'],hp:2.25,atk:1.46,award:2000}
];
const KEY = 'arkeia-gaizorg-adventure-v1';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));

export function setupGaizorgAdventure(ctx){
  const {THREE, scene, camera, FIGHTERS, STAGES, assets, state, save,
    chiefUnlocked, operatorOnlyUnlocked, openSelect, goTitle, show, makeBattle, endBattle,
    beginBattle, buildHud, setStage, ensureAllModelsReady, playTrack, grant, persist, ui}=ctx;
  const $=(q)=>document.querySelector(q);
  let rest=null,activeStage=0,busy=false,alive=true;
  const saveData=()=>{try{localStorage.setItem(KEY,JSON.stringify({unlocked:progress.unlocked,cleared:progress.cleared,lastPlayer:progress.lastPlayer}));}catch{}};
  let progress={unlocked:1,cleared:false,lastPlayer:'rowen'};
  try{
    const d=JSON.parse(localStorage.getItem(KEY)||'{}');
    progress.unlocked=clamp(Math.floor(Number(d.unlocked)||1),1,11);
    progress.cleared=!!d.cleared;
    progress.lastPlayer=FIGHTERS[d.lastPlayer]?d.lastPlayer:'rowen';
  }catch{}

  const panel=document.createElement('div');panel.id='gaizorg-adventure-ui';panel.hidden=true;
  panel.innerHTML=`<div class="ga-title">ADVENTURE <small>十重の試練</small></div>
    <p class="ga-status"></p><div class="ga-actions">
      <button type="button" class="ga-warp">次のステージへワープ</button>
      <button type="button" class="ga-reset">最初から始める</button>
      <button type="button" class="ga-exit">タイトルへ戻る</button>
    </div><div class="ga-help">移動：WASD / 矢印 / 画面ボタン<br>Shift：走る（スマホは「走る」を長押し）<br>光る門の中へ進むと次のステージへ</div>
    <div class="ga-touch" aria-label="冒険の移動操作">
      <button data-axis="up" type="button">▲</button>
      <div><button data-axis="left" type="button">◀</button><button data-axis="down" type="button">▼</button><button data-axis="right" type="button">▶</button><button data-axis="run" type="button">走る</button></div>
    </div>`;
  document.body.append(panel);
  const status=panel.querySelector('.ga-status');
  const warpButton=panel.querySelector('.ga-warp');
  const touch={up:false,down:false,left:false,right:false,run:false};
  const keys={up:false,down:false,left:false,right:false,run:false};
  const directions={KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right',ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',ShiftLeft:'run',ShiftRight:'run'};
  window.addEventListener('keydown',e=>{
    if(!rest || state.mode!=='adventure' || e.target?.matches?.('input,textarea,[contenteditable]'))return;
    const dir=directions[e.code];if(dir){keys[dir]=true;e.preventDefault();}
  });
  window.addEventListener('keyup',e=>{const dir=directions[e.code];if(dir)keys[dir]=false;});
  window.addEventListener('blur',()=>{Object.keys(keys).forEach(k=>keys[k]=false);});
  panel.querySelectorAll('[data-axis]').forEach(button=>{
    const key=button.dataset.axis;
    button.addEventListener('pointerdown',e=>{touch[key]=true;button.setPointerCapture(e.pointerId);e.preventDefault();});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(ev,()=>{touch[key]=false;});
  });
  panel.querySelector('.ga-exit').addEventListener('click',()=>goTitle());
  panel.querySelector('.ga-reset').addEventListener('click',async()=>{
    if (busy||!rest)return;
    const yes=await rfAdventureDialog('最初から始めますか？','進行状況をステージ1に戻します。\n灯晶・所持品・強化は変更されません。',
      [['ステージ1に戻す',true,true],['キャンセル',false]]);
    if(yes!==true)return;
    rfFreshAdventure();
    await enterRest();
    ui.banner?.({name:'— 冒険を最初から —'},'ステージ1から再開できます');
  });
  warpButton.addEventListener('click',()=>enterPortal());
  // Current portal: display Adventure in the visible mode tiles, not the retired .menu.
  const titleMenu=$('#scr-title .portal-modes') || $('#scr-title .menu');
  let titleButton=document.getElementById('btn-adventure-mode');
  if(!titleButton){
    titleButton=document.createElement('button');titleButton.type='button';titleButton.id='btn-adventure-mode';
    if(titleMenu?.classList.contains('portal-modes')){
      titleButton.className='mode-tile';
      titleButton.innerHTML='<span class="mode-icon">07</span><span class="mode-main"><b>アドベンチャー</b><small>全10ステージ / 最終ボス：ガイゾルグ</small></span><span class="tile-arrow">›</span>';
    } else {
      titleButton.innerHTML='<span>アドベンチャー <small>ADVENTURE • 全10ステージ / 最終ボス：ガイゾルグ</small></span>';
    }
    (titleMenu || $('#scr-title') || document.body).append(titleButton);
  }
  // RF_ADVENTURE_RESTART_V18: Fresh start resets ONLY Adventure progress, never inventory/currency/upgrades.
  function rfAdventureDialog(title, message, choices) {
    return new Promise(resolve=>{
      const prev=document.activeElement;
      const overlay=document.createElement('div');
      overlay.style.cssText='position:fixed;inset:0;z-index:200100;display:grid;place-items:center;padding:16px;background:rgba(3,9,20,.78);pointer-events:auto';
      const card=document.createElement('div');card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');
      card.style.cssText='box-sizing:border-box;width:min(440px,calc(100vw - 24px));max-height:85dvh;overflow-y:auto;color:#eaf9ff;background:linear-gradient(130deg,#102e45,#0b1525);border:1px solid #8deaff;border-radius:12px;padding:20px;box-shadow:0 20px 60px #0009;font:14px/1.7 system-ui,sans-serif';
      const h=document.createElement('h2');h.style.cssText='margin:0 0 8px;font-size:20px';h.textContent=title;
      const p=document.createElement('p');p.style.cssText='white-space:pre-wrap;margin:0 0 14px';p.textContent=message;
      const actions=document.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:8px';
      let done=false;
      const close=value=>{if(done)return;done=true;overlay.remove();window.removeEventListener('keydown',onKey,true);prev?.focus?.();resolve(value);};
      const onKey=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(null);}else if(e.key==='Tab'){const list=[...card.querySelectorAll('button')];if(!list.length)return;const i=list.indexOf(document.activeElement);const k=(i+(e.shiftKey?-1:1)+list.length)%list.length;e.preventDefault();list[k].focus();}};
      for(const [label,value,danger] of choices){const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='flex:1 1 110px;border:1px solid #94dcec;background:'+(danger?'#713342':'#1a5265')+';color:#fff;padding:10px 9px;border-radius:8px;cursor:pointer;font-weight:bold';b.addEventListener('click',()=>close(value));actions.append(b);}
      card.append(h,p,actions);overlay.append(card);document.body.append(overlay);
      overlay.addEventListener('click',e=>{if(e.target===overlay)close(null);});
      window.addEventListener('keydown',onKey,true);actions.querySelector('button')?.focus();
    });
  }
  function rfFreshAdventure() {
    progress.unlocked=1;
    progress.cleared=false;
    activeStage=0;
    saveData();
  }
  function rfChooseHero() {
    state.mode='adventure';
    openSelect('冒険に出る戦士を選ぶ','アドベンチャー › 使用キャラクター',k=>start(k),{onBack:goTitle});
  }
  titleButton.addEventListener('click',async()=>{
    if(busy)return;
    const mode=await rfAdventureDialog('アドベンチャーモード',
      '進行状況：'+(progress.cleared?'全10ステージ踏破':'ステージ'+Math.min(10,progress.unlocked)+'まで解放')+'\n続きから遊ぶか、ステージ1からやり直すかを選択してください。',
      [['続きから','resume'],['最初から始める','fresh'],['キャンセル',null]]);
    if(mode==='fresh') {
      const accepted=await rfAdventureDialog('最初から始めますか？',
        'アドベンチャーのステージ進行のみステージ1に戻します。\n灯晶・キャラクター・強化・装備は消えません。',
        [['最初から始める',true,true],['戻る',false]]);
      if(accepted!==true)return;
      rfFreshAdventure();
    } else if(mode!=='resume') return;
    rfChooseHero();
  });


  // Register a safe runtime hook for original boss techniques. The base engine
  // handles damage and collision, while this draws layered illustration FX only.
  const texCanvas=(kind)=>{
    const can=document.createElement('canvas');can.width=can.height=256;const g=can.getContext('2d');
    if(!g)return null;
    const rr=g.createRadialGradient(128,128,0,128,128,122);
    if(kind==='flame'){
      rr.addColorStop(0,'rgba(255,254,214,1)');rr.addColorStop(.17,'rgba(255,205,70,.95)');
      rr.addColorStop(.44,'rgba(255,93,22,.73)');rr.addColorStop(.77,'rgba(185,19,8,.2)');rr.addColorStop(1,'rgba(0,0,0,0)');
    }else{
      rr.addColorStop(0,'rgba(255,254,225,.94)');rr.addColorStop(.18,'rgba(255,179,68,.73)');
      rr.addColorStop(.52,'rgba(231,49,19,.38)');rr.addColorStop(1,'rgba(0,0,0,0)');
    }
    g.fillStyle=rr;g.fillRect(0,0,256,256);
    g.save();g.translate(128,128);
    for(let i=0;i<20;i++){
      const ang=i*Math.PI/10;
      g.save();g.rotate(ang);g.fillStyle=i%2?'rgba(255,223,113,.55)':'rgba(255,93,15,.47)';
      g.beginPath();g.moveTo(-8,-15);g.quadraticCurveTo(0,-90,12,-116);g.quadraticCurveTo(8,-72,8,-8);g.closePath();g.fill();g.restore();
    }
    g.restore();
    const tx=new THREE.CanvasTexture(can);tx.colorSpace=THREE.SRGBColorSpace;return tx;
  };
  const fxTextures={flame:texCanvas('flame'),nova:texCanvas('nova')};
  function gaizorgCastFx(b,f,slot){
    if(!b || !b.fx || b.ended || !f || f.dead || f.key!=='gaizorg')return;
    const isNova=slot==='over'||slot==='hi'||slot==='s3'||slot==='f3';
    const base=isNova?8.8:slot==='s0'||slot==='f0'?5.2:4.1;
    const tex=fxTextures[isNova?'nova':'flame'];if(!tex)return;
    const target=b.nearestEnemy?.(f);const v=target?.pos||f.pos;
    const root=new THREE.Group(), sprites=[],mats=[];
    const count=isNova?6:slot==='s0'||slot==='f0'?4:3;
    for(let i=0;i<count;i++){
      const mat=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:0,color:i%2?0xffd39a:0xff6329,blending:THREE.AdditiveBlending,depthWrite:false});
      const spr=new THREE.Sprite(mat),a=i*Math.PI*2/count;
      spr.position.set(v.x+Math.cos(a)*(isNova?2.7:1.6),1.4+i*.38,v.z+Math.sin(a)*(isNova?2.7:1.6));
      spr.scale.set(base*(.75+i*.18),base*(.75+i*.18),1);
      root.add(spr);sprites.push(spr);mats.push(mat);
    }
    b.fx.add(root);let elapsed=0;
    b.addEffect(dt=>{
      elapsed+=dt;const k=clamp(elapsed/(isNova?1.6:.72),0,1);
      for(let i=0;i<sprites.length;i++){
        const sp=sprites[i];sp.material.opacity=.72*(1-k)*clamp(k*7,0,1);
        sp.scale.multiplyScalar(1+dt*(isNova?.8:.52));
        sp.material.rotation+=dt*(i%2?-.6:.6);
      }
      if(k<1)return true;
      root.removeFromParent();for(const m of mats)m.dispose();return false;
    });
  }
  const BattleProto=ctx.Battle?.prototype;
  if(BattleProto && !BattleProto.__gaizorgFlameFX){
    const orig=BattleProto.executeCast;
    BattleProto.executeCast=function(f,slot,net){
      const out=orig.call(this,f,slot,net);
      if(f?.key==='gaizorg' && !f.remoteAuth)gaizorgCastFx(this,f,slot);
      return out;
    };
    BattleProto.__gaizorgFlameFX=true;
  }

  function camp(){
    const group=new THREE.Group();scene.add(group);
    const owned=[];
    const mat=(color,emissive=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness:.73,metalness:.16,emissive,emissiveIntensity:emissive?.25:0});owned.push(m);return m;};
    const geo=(g)=>{owned.push(g);return g;};
    const ground=new THREE.Mesh(geo(new THREE.CylinderGeometry(22,22,1.1,64)),mat(0x403a37));ground.position.y=-.55;ground.receiveShadow=true;group.add(ground);
    const path=new THREE.Mesh(geo(new THREE.RingGeometry(4.6,5.1,64)),mat(0xb78455));path.rotation.x=-Math.PI/2;path.position.y=.02;group.add(path);
    const amber=mat(0xeab874,0xff7620),stone=mat(0x5a4f4f),gold=mat(0xc8a26c);
    for(let i=0;i<18;i++){
      const a=i*Math.PI/9,rr=15.5+(i%3);
      const rock=new THREE.Mesh(geo(new THREE.DodecahedronGeometry(.7+(i%3)*.22,0)),stone);
      rock.position.set(Math.sin(a)*rr,.3,Math.cos(a)*rr);group.add(rock);
    }
    for(const x of [-6.3,6.3]){
      const col=new THREE.Mesh(geo(new THREE.CylinderGeometry(.8,.95,5.3,12)),stone);col.position.set(x,2.6,-8.8);group.add(col);
      const head=new THREE.Mesh(geo(new THREE.SphereGeometry(1.0,20,12)),amber);head.position.set(x,5.4,-8.8);group.add(head);
    }
    const portal=new THREE.Group();portal.position.set(0,0,-9.5);group.add(portal);
    const portalM=new THREE.MeshBasicMaterial({color:0x8bdfff,transparent:true,opacity:.8,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false});owned.push(portalM);
    for(let k=0;k<3;k++){
      const ring=new THREE.Mesh(geo(new THREE.TorusGeometry(2.1+k*.28,.085,12,88)),portalM);
      ring.position.y=2.8;portal.add(ring);
    }
    const inner=new THREE.Mesh(geo(new THREE.CircleGeometry(1.95,64)),new THREE.MeshBasicMaterial({color:0x315d9f,transparent:true,opacity:.46,side:THREE.DoubleSide,depthWrite:false}));owned.push(inner.material);
    inner.position.y=2.8;inner.position.z=.03;portal.add(inner);
    const rune=new THREE.Mesh(geo(new THREE.RingGeometry(2.35,2.6,64)),new THREE.MeshBasicMaterial({color:0xffd18c,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}));owned.push(rune.material);
    rune.rotation.x=-Math.PI/2;rune.position.set(0,.08,-9.5);group.add(rune);
    const fireGeo=geo(new THREE.ConeGeometry(.6,2.2,20));
    for(const x of [-3,3]){
      const base=new THREE.Mesh(geo(new THREE.CylinderGeometry(1,1,.45,16)),gold);base.position.set(x,.2,3);group.add(base);
      const flame=new THREE.Mesh(fireGeo,amber);flame.position.set(x,1.45,3);group.add(flame);
    }
    const sky=new THREE.HemisphereLight(0xffd9bc,0x293c5e,1.7);group.add(sky);
    const warm=new THREE.PointLight(0xff8a35,45,28,2);warm.position.set(0,6,4);group.add(warm);
    return {group,portal,portalM,rune,owned};
  }
  function clearRest(){
    if(!rest)return;
    scene.remove(rest.group);
    if(rest.mixer)rest.mixer.stopAllAction();
    rest.motion?.stop();
    if(rest.instance)disposeModel(rest.instance,rest.mixer);
    for(const asset of rest.owned)asset?.dispose?.();
    rest=null;
    state.adventureRest=false;
    panel.hidden=true;
  }
  function drawStatus(text){status.textContent=text;}
  function stageTitle(index){return STAGE_PLAN[clamp(index,0,9)]?.name||'十重の試練';}
  async function start(key){
    if(busy)return;
    busy=true;
    try{
      if(key==='gaizorg' && !chiefUnlocked()){ui.banner({name:'使用権限がありません'},'ガイゾルグは運営長専用です');goTitle();return;}
      if(key==='valdarion' && !chiefUnlocked()){ui.banner({name:'使用権限がありません'},'ヴァルダリオンは運営長専用です');goTitle();return;}
      if(key==='nepterion' && !chiefUnlocked()){ui.banner({name:'使用権限がありません'},'ネプテリオンは運営長専用です');goTitle();return;}
      if(key==='operator_gigantes' && !operatorOnlyUnlocked()){ui.banner({name:'使用権限がありません'},'機神ギガンテスは運営専用です');goTitle();return;}
      if(!FIGHTERS[key])key='rowen';
      progress.lastPlayer=key;saveData(); state.myKey=key;
      await enterRest();
    }catch(error){console.error('[ADVENTURE]',error);clearRest();ui.banner({name:'冒険の準備に失敗しました'},error.message||'モデルを確認してください');goTitle();}
    finally{busy=false;}
  }
  async function enterRest(){
    const k=progress.lastPlayer;
    const ready=await ensureAllModelsReady([k]);if(!ready)throw Error('キャラクターのモデルが準備できませんでした');
    endBattle();clearRest();
    const arena=ctx.getArena();if(arena)arena.visible=false;
    const env=camp();
    const p=new THREE.Group();p.position.set(0,0,8);env.group.add(p);
    const def=FIGHTERS[k];const original=assets[k];
    const instance=instantiateModel(original,(def.height||1.8)*(k==='gaizorg'?1.1:1),k==='gaizorg'?null:def.tint);
    p.add(instance.wrapper);
    const mixer=new THREE.AnimationMixer(instance.model);
    const motion=attachValgardMotion(instance.model,k);
    const clips=original?.animations||[];
    const walk=clips.find(c=>/walk/i.test(c.name));
    const run=clips.find(c=>/run/i.test(c.name));
    const idle=clips.find(c=>/idle/i.test(c.name));
    rest={...env,p,instance,mixer,motion,walk,run,idle,action:null,owned:env.owned,pos:new THREE.Vector3(0,0,8),facing:0,portalHold:0};
    if(idle)rest.action=mixer.clipAction(idle).play();
    state.adventureRest=true;state.battle=null;state.field=null;state.mode='adventure';
    state.battleLoading=false;
    window.__rfMarkBattlePhase?.('field','アドベンチャー休憩所');
    show(null);panel.hidden=false;
    document.body.classList.add('gaizorg-adventure');
    const next=Math.min(10,progress.unlocked);
    drawStatus(progress.cleared?'全10ステージ制覇！ 再挑戦もできます。':`ステージ ${next}/10　${stageTitle(next-1)} に挑戦`);
    warpButton.textContent=progress.cleared?'最終決戦に再挑戦':'ワープしてステージ'+next+'へ';
    ctx.setFog?.(true);
    playTrack('adventure');
    camera.position.set(0,11,22);camera.lookAt(0,1,2);
  }
  function animation(moving,running=false){
    if(!rest)return;
    const clip=running?(rest.run||rest.walk||rest.idle):moving?(rest.walk||rest.run||rest.idle):rest.idle;
    if(!clip || rest.action?.getClip()===clip)return;
    const action=rest.mixer.clipAction(clip);action.reset().fadeIn(.18).play();
    rest.action?.fadeOut(.18);rest.action=action;
  }
  function update(dt,input){
    if(!rest || state.mode!=='adventure')return;
    if(state.paused)return;
    dt=clamp(dt,0,.05);
    let mx=Number(input?.mx)||0, mz=Number(input?.mz)||0;
    if(touch.left||keys.left)mx-=1;if(touch.right||keys.right)mx+=1;
    if(touch.up||keys.up)mz-=1;if(touch.down||keys.down)mz+=1;
    const len=Math.hypot(mx,mz),moving=len>.12;
    const running=moving && (touch.run || keys.run || (typeof input?.run==='boolean' && input.run));
    if(moving){
      mx/=Math.max(1,len);mz/=Math.max(1,len);
      const speed=(progress.lastPlayer==='gaizorg'?5.2:6)*(running?1.55:1);
      rest.pos.x=clamp(rest.pos.x+mx*speed*dt,-18,18);
      rest.pos.z=clamp(rest.pos.z+mz*speed*dt,-17,18);
      rest.facing=Math.atan2(mx,mz);
    }
    rest.p.position.copy(rest.pos);rest.p.rotation.y=rest.facing;
    animation(moving,running);rest.mixer.update(dt);
    rest.motion?.update(dt,moving?(running?'run':'walk'):false);
    // A little idle motion for models with no authored animation.
    if(!rest.walk && !rest.run && !rest.idle && !rest.motion)rest.instance.wrapper.position.y=Math.abs(Math.sin(performance.now()/170))*(moving?.09:.02);
    rest.portal.rotation.z+=dt*.45;
    rest.portalM.opacity=.65+.18*Math.sin(performance.now()*.004);
    rest.rune.rotation.z-=dt*.42;
    const distance=Math.hypot(rest.pos.x,rest.pos.z+9.5);
    rest.portalHold=(distance<2.8)?rest.portalHold+dt:0;
    if(rest.portalHold>.27){rest.portalHold=-100;enterPortal();}
    const offset=new THREE.Vector3(0,progress.lastPlayer==='gaizorg'?14:11,progress.lastPlayer==='gaizorg'?19:16);
    camera.position.lerp(rest.pos.clone().add(offset),1-Math.exp(-4*dt));
    camera.lookAt(rest.pos.x,2.2,rest.pos.z-2.8);
  }
  async function enterPortal(){
    if(busy || !rest)return;
    busy=true;
    const stageIndex=progress.cleared?9:clamp(progress.unlocked-1,0,9);
    const plan=STAGE_PLAN[stageIndex];
    try{
      warpButton.disabled=true; drawStatus('時空の門を通過中… '+plan.name);
      const keys=[progress.lastPlayer,...plan.foes];
      if(!(await ensureAllModelsReady(keys)))throw Error('戦士モデルの読み込みに失敗しました');
      if(!rest)return;
      clearRest();
      const st=STAGES.find(s=>s.id===plan.stage)||STAGES[0];
      setStage(st);const arena=ctx.getArena();if(arena)arena.visible=true;
      const b=makeBattle(null);
      b.add(progress.lastPlayer,{team:0,player:true,awk:save.awk,pos:[-5,1],
        name:FIGHTERS[progress.lastPlayer].name+'（あなた）',upg:ctx.upgFor(progress.lastPlayer),gear:ctx.gearFor(progress.lastPlayer)});
      plan.foes.forEach((k,i)=>{
        b.add(k,{team:1,cpu:.72+Math.min(i,2)*.08,hpMul:plan.hp*(k==='gaizorg'?1.9:1),atkMul:plan.atk,
          scale:k==='gaizorg'?1.85:1+(stageIndex>5?.12:0),facing:Math.PI,
          pos:plan.foes.length===1?[4,-2]:[4+Math.sin(i*2)*2,-2+(i-1)*2]});
      });
      activeStage=stageIndex;
      state.mode='adventure';
      beginBattle(stageIndex===9);
      playTrack('adventure');
      ui.banner({name:`— STAGE ${stageIndex+1}/10 —`},plan.name);
    }catch(err){
      console.warn('[ADVENTURE] Portal entry failed:',err);
      ui.banner({name:'ワープに失敗しました'},err.message||'再試行してください');
      state.battleLoading=false;
      if(rest)drawStatus('読み込みエラー。ワープを再試行してください。');
    }finally{busy=false;warpButton.disabled=false;}
  }
  async function finish(won){
    const stage=activeStage;
    const plan=STAGE_PLAN[stage];
    endBattle();
    if(won){
      grant(plan.award);
      if(stage===9){progress.cleared=true;progress.unlocked=11;}
      else progress.unlocked=Math.max(progress.unlocked,stage+2);
      saveData();
    }
    try{
      await enterRest();
      if(won && stage===9)ui.banner({name:'— 全十章 踏破 —'},'ガイゾルグを撃破！ おめでとうございます');
      else ui.banner({name:won?`— STAGE ${stage+1} CLEAR —`:'— 休憩所へ帰還 —'},won?`灯晶 +${plan.award} ／ 次はステージ${Math.min(10,stage+2)}`:'準備を整えて再挑戦');
    }catch(e){console.error(e);goTitle();}
  }
  function close(){clearRest();document.body.classList.remove('gaizorg-adventure');busy=false;}
  return {start,update,enterPortal,finish,close,STAGE_PLAN};
}
