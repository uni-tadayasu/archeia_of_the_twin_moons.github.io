// Riftfall Arena V55.17 — 無限天守: battle stays alive across floors, no arena re-entry.
import * as THREE from 'three';
// No upper floor count. Only a living player's remaining HP carries to the next floor.
const NOW=()=>Date.now();
const RNG=seed=>()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296};
const RANK=f=>f>=1000?'無窮':f>=300?'天帝':f>=100?'伝説':f>=50?'達人':f>=20?'金':f>=10?'銀':'銅';
export const endlessElapsedText=ms=>{
 const s=Math.max(0,Math.floor((Number(ms)||0)/1000)),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
 return (h?`${h}時間 `:'')+`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};
export const endlessSort=(a,b)=>b.floor-a.floor||a.timeMs-b.timeMs||a.at-b.at;

export function createInfiniteDungeonV552(c){
 const {state,save,FIGHTERS,STAGES,ROSTER,ENEMY_ROSTER,BOSS_ROSTER,ensureAllModelsReady,
   setStage,makeBattle,endBattle,beginBattle,foeCpu,foeHp,upgFor,gearFor,showResult,
   ui,syncCodeNow,apiEnabled,api,myName,rfBattleStartError}=c;
 let run=null, interval=0, serverQueue=Promise.resolve(), pendingStart=null;
 const $=id=>document.getElementById(id);
 function best(){try{return JSON.parse(localStorage.getItem('rf552-infinite-best')||'null')}catch{return null}}
 function setBest(info){
  if(!info||!Number.isSafeInteger(info.floor))return;
  const old=best();if(!old||endlessSort(info,old)<0){
    try{localStorage.setItem('rf552-infinite-best',JSON.stringify(info))}catch{}
  }
 }
 function elapsed(){return run?Math.max(0,NOW()-run.startedAt):0}
 function uiTick(){
  const node=$('rf552-endless-hud');if(!node)return;
  if(!run){node.hidden=true;return;}
  node.hidden=false;
  const hp=state.battle?.fighters.find(f=>f.isPlayer)?.hp;
  const w=state.battle?.rf566EndlessWave;
  const crowd=run.transition?'  │  上階への階段 開放':w?`  │  敵兵 ${w.spawned}/${w.total}`:'';
  node.textContent=`無限天守  第${run.floor.toLocaleString('ja-JP')}層  │  ${RANK(run.cleared+1)}級  │  HP ${Math.round(hp??run.hp??0)}${crowd}  │  ${endlessElapsedText(elapsed())}`;
 }
 function record(){
  if(!run)return;
  setBest({floor:run.cleared,timeMs:elapsed(),name:myName(),key:run.key,at:NOW()});
 }
 function stopTimers(){clearInterval(interval);interval=0;}
 function remoteUrl(path,data){return api(path,data)}
 function tryRemoteStart(){
  if(!apiEnabled()||syncCodeNow().length!==12)return;
  const local=run;
  pendingStart=remoteUrl('/infinite/start',{code:syncCodeNow(),name:myName(),fighter:run.key})
   .then(result=>{
     if(result?.ok&&result.runId) local.serverRun=result.runId;
     return result;
   }).catch(err=>{console.warn('[無限天守] ランキング登録はローカルのみ:',err?.message||err);return null;});
  serverQueue=pendingStart.catch(()=>null);
 }
 function checkpoint(floor){
  const local=run;if(!local?.serverRun&&!pendingStart)return;
  serverQueue=serverQueue.catch(()=>null).then(async()=>{
    if(pendingStart)await pendingStart;
    if(!local.serverRun)return;
    try{await remoteUrl('/infinite/progress',{code:syncCodeNow(),name:myName(),runId:local.serverRun,floor});}
    catch(e){console.warn('[無限天守] 階層送信保留',e)}
  });
 }
 function remoteFinish(local){
  if(!local)return;
  serverQueue=serverQueue.catch(()=>null).then(async()=>{
    if(pendingStart)await pendingStart;
    if(!local.serverRun)return;
    try{await remoteUrl('/infinite/finish',{code:syncCodeNow(),name:myName(),runId:local.serverRun});}
    catch(e){console.warn('[無限天守] ランキング反映失敗',e)}
  });
 }
 function foeKeys(floor,seed){
  const rand=RNG(((seed>>>0)+Math.imul(floor,2654435761))>>>0);
  const boss=floor%10===0;
  const count=boss?1:Math.min(3,1+Math.floor((floor-1)/7));
  const pool=(boss?BOSS_ROSTER:floor%5===0?ROSTER:ENEMY_ROSTER).filter(k=>FIGHTERS[k]&&!FIGHTERS[k].hidden);
  const fallback=FIGHTERS.rowen?'rowen':Object.keys(FIGHTERS)[0];
  return Array.from({length:count},()=>pool[Math.floor(rand()*pool.length)]||fallback);
 }
 // Painted sprite staircase marker. This is a traversal cue, NOT another battle arena.
 function removeStairs(cur){
  if(!cur?.stairs)return;
  try{cur.stairs.sprite.removeFromParent();cur.stairs.material.dispose();cur.stairs.texture.dispose();}catch{}
  cur.stairs.hint?.remove();
  cur.stairs=null;
 }
 function showStairs(cur,b,player){
  removeStairs(cur);
  const x0=player.pos.x,z0=player.pos.z;
  const length=Math.hypot(x0,z0),dx=length>9?-x0/length:0,dz=length>9?-z0/length:1;
  let x=x0+dx*7,z=z0+dz*7;
  const r=Math.hypot(x,z);if(r>40){x*=40/r;z*=40/r;}
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const g=canvas.getContext('2d');
  if(g){
   const halo=g.createRadialGradient(128,120,5,128,120,121);
   halo.addColorStop(0,'rgba(255,249,205,.95)');halo.addColorStop(.26,'rgba(255,210,103,.76)');
   halo.addColorStop(.65,'rgba(189,99,250,.27)');halo.addColorStop(1,'rgba(115,68,206,0)');
   g.fillStyle=halo;g.fillRect(0,0,256,256);
   g.lineCap='round';g.lineJoin='round';g.strokeStyle='#fff0c4';g.shadowColor='#ffc85a';g.shadowBlur=17;g.lineWidth=7;
   g.beginPath();g.moveTo(49,171);g.lineTo(207,171);g.moveTo(64,154);g.lineTo(192,154);
   g.moveTo(80,137);g.lineTo(176,137);g.moveTo(98,120);g.lineTo(159,120);g.stroke();
   g.beginPath();g.moveTo(128,102);g.lineTo(128,45);g.moveTo(104,68);g.lineTo(128,43);g.lineTo(151,68);g.stroke();
   g.font='bold 19px serif';g.textAlign='center';g.shadowBlur=7;g.fillStyle='#ffffff';g.fillText('上層へ',128,210);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,opacity:.94});
  const sprite=new THREE.Sprite(material);sprite.scale.set(5.4,5.4,1);sprite.position.set(x,3,z);
  b.scene.add(sprite);
  const hint=document.createElement('div');hint.id='rf567-endless-stair-hint';
  hint.style.cssText='position:fixed;left:50%;bottom:max(100px,13vh);transform:translateX(-50%);z-index:37;max-width:90vw;padding:9px 16px;border:1px solid #d8b36e;border-radius:12px;background:rgba(11,10,28,.85);box-shadow:0 0 22px #c9a56e44;color:#fff5dc;font:600 14px/1.5 system-ui,sans-serif;text-align:center;pointer-events:none;';
  hint.textContent=`第${cur.cleared}層踏破！ 階段に近づくと第${cur.floor}層へ（自動進行も可能）`;
  document.body.append(hint);
  cur.stairs={x,z,sprite,texture,material,hint};
 }
 function addHudPlate(f){
  if(f.hudPlate)return;
  const right=$('hud-right');if(!right)return;
  const plate=document.createElement('div');plate.className='plate';
  const name=document.createElement('b');name.textContent=f.name;
  const bar=document.createElement('i'),fill=document.createElement('u');bar.append(fill);
  plate.append(name,bar);f.hudPlate=plate;f.hudFill=fill;f.hudLabel=name;right.append(plate);
 }
 function removeDead(b,dt=10){
  for(const f of [...b.fighters]){
   if(f.team!==1||!f.dead)continue;
   f._rf567DeathAge=(f._rf567DeathAge||0)+dt;
   if(f._rf567DeathAge>=1.0){
    if(typeof b.retireFighter==='function')b.retireFighter(f);
    else {f.hudPlate?.remove();f.root?.removeFromParent();b.fighters.splice(b.fighters.indexOf(f),1);}
   }
  }
 }
 function completeFloor(cur,b){
  if(cur!==run||cur.transition||cur.loading||state.mode!=='infinite')return;
  const me=b.fighters.find(f=>f.isPlayer&&!f.dead);
  if(!me||me.hp<=0)return;
  cur.hp=Math.max(1,Math.floor(me.hp));
  cur.cleared=cur.floor;
  record();checkpoint(cur.cleared);
  cur.floor+=1;
  cur.transition=true;
  const wave=b.rf566EndlessWave;
  if(wave){wave.waiting=true;wave.waitSeconds=0;}
  showStairs(cur,b,me);
  ui.banner({name:`— 第${cur.cleared.toLocaleString('ja-JP')}層 踏破！ —`},
    `HP ${cur.hp} 維持 / 上階への階段が開放 / 次は第${cur.floor}層`);
  uiTick();
 }
 async function startFloor(){
  const cur=run;if(!cur||cur.loading)return;
  cur.loading=true;cur.transition=true;
  try{
   const floor=cur.floor;
   const enemies=foeKeys(floor,cur.seed);
   const rng=RNG(((cur.seed>>>0)+Math.imul(floor,2246822519))>>>0);
   const minionPool=ENEMY_ROSTER.filter(k=>FIGHTERS[k]&&!FIGHTERS[k].hidden);
   const minions=[];
   for(let i=0;i<Math.min(3,minionPool.length);i++)minions.push(minionPool[Math.floor(rng()*minionPool.length)]);
   const pool=[...new Set([...enemies,...minions])];
   if(!(await ensureAllModelsReady([cur.key,...pool])))throw Error('階層のモデルを準備できませんでした。');
   if(cur!==run||state.mode!=='infinite')return;
   let b=cur.battle;
   if(!b){
    // Enter the castle ONCE. All following floors reuse this battle, scene and camera.
    const stage=STAGES.find(s=>/天守|城|castle|和風|palace/i.test(`${s.name} ${s.id}`))||STAGES[0];
    setStage(stage);
    b=makeBattle(null);cur.battle=b;
    const me=b.add(cur.key,{team:0,player:true,awk:save.awk,netId:'endless-self',pos:[-4,3],
     name:FIGHTERS[cur.key].name+'（挑戦者）',upg:upgFor(cur.key),gear:gearFor(cur.key)});
    if(cur.hp!==null)me.hp=Math.max(1,Math.min(me.maxHp,Math.floor(cur.hp)));
   }else if(b!==state.battle){return;}
   removeStairs(cur);
   removeDead(b,10); // No dead enemy clones accumulate across limitless floors.
   if(b.fighters.some(f=>f.team===1&&!f.dead))throw Error('前の階層の敵が残っています。');
   const me=b.fighters.find(f=>f.isPlayer&&!f.dead);
   if(!me)throw Error('挑戦者の戦闘状態を引き継げませんでした。');
   cur.hp=me.hp; // HP and other player state stay on the SAME Fighter instance.
   const hpScale=Math.min(5000,1+(floor-1)*.22),atkScale=Math.min(100,1+(floor-1)*.035);
   const isBoss=floor%10===0;
   const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent||'') || (navigator.deviceMemory||8)<=4;
   const limit=mobile?5:9;
   const total=mobile?Math.min(18,11+Math.floor(floor/12)):Math.min(32,18+Math.floor(floor/5));
   const initial=isBoss?Math.min(3,limit):Math.min(mobile?4:5,limit);
   let created=0,elapsedSince=0,previous={x:me.pos.x,z:me.pos.z},distanceSince=0;
   const addEnemies=(count,first=false)=>{
    const player=b.fighters.find(f=>f.isPlayer&&!f.dead);
    const origin=player?.pos||{x:-4,z:3};
    const n=Math.min(Math.max(0,count),total-created);
    for(let i=0;i<n;i++){
     const bossFighter=isBoss&&created===0;
     const key=bossFighter?enemies[0]:(pool[Math.floor(rng()*pool.length)]||enemies[0]);
     const ang=(created*2.399963+floor*.18+rng()*.9);
     const d=first?9+rng()*5:10+rng()*10;
     let x=origin.x+Math.cos(ang)*d,z=origin.z+Math.sin(ang)*d;
     const radius=Math.hypot(x,z);if(radius>43){x*=43/radius;z*=43/radius;}
     const fighter=b.add(key,{team:1,cpu:foeCpu(Math.min(1,.56+floor*.006)),
       hpMul:foeHp(hpScale*(bossFighter?2.0:.53)),atkMul:atkScale*(bossFighter?1:.72),
       pos:[x,z],facing:Math.atan2(origin.x-x,origin.z-z),
       name:bossFighter?`第${floor}層・守護者 ${FIGHTERS[key].name}`:`第${floor}層・敵兵 ${FIGHTERS[key].name}`});
     if(cur.startedBattle)addHudPlate(fighter);
     created++;
    }
    if(!first&&n)ui.banner({name:`— 第${floor}層　増援部隊 —`},`${n}体が進軍！ 残り ${total-created}体`);
   };
   addEnemies(initial,true);
   const wave={
    holdVictory:true,floor,total,get spawned(){return created;},waiting:false,waitSeconds:0,
    tick(dt){
     if(cur!==run||b.ended||!Number.isFinite(dt)||dt<=0)return;
     const player=b.fighters.find(f=>f.isPlayer&&!f.dead);
     if(!player)return;
     removeDead(b,Math.min(.25,dt));
     if(cur.transition){
      if(this.waiting){
       this.waitSeconds+=Math.min(.25,dt);
       const step=cur.stairs;
       const reached=step&&Math.hypot(player.pos.x-step.x,player.pos.z-step.z)<=3.1;
       if(reached||this.waitSeconds>=4.0){
        this.waiting=false; // prevents repeated async starts
        void startFloor();
       }
      }
      return;
     }
     elapsedSince+=Math.min(.25,dt);
     distanceSince+=Math.min(6,Math.hypot(player.pos.x-previous.x,player.pos.z-previous.z));
     previous={x:player.pos.x,z:player.pos.z};
     const alive=b.fighters.filter(f=>f.team===1&&!f.dead).length;
     const remaining=total-created;
     if(!remaining){if(alive===0)completeFloor(cur,b);return;}
     const travelReady=distanceSince>=11&&elapsedSince>=2.6;
     const enemyCleared=alive<=1;
     const sparse=alive<Math.min(3,limit)&&elapsedSince>=5;
     if(!travelReady&&!enemyCleared&&!sparse)return;
     if(alive>=limit)return;
     addEnemies(Math.min(remaining,limit-alive,mobile?3:4));
     elapsedSince=0;distanceSince=0;
    }
   };
   b.rf566EndlessWave=wave;
   if(!cur.startedBattle){
    beginBattle(isBoss);cur.startedBattle=true;
   }else{
    // No beginBattle(), makeBattle(), endBattle(), screen swap or new arena here.
    b.ended=false;b.intro=.35;
   }
   cur.transition=false;
   ui.banner({name:`— 無限天守　第${floor.toLocaleString('ja-JP')}層 —`},
     isBoss?'上層の守護者が待ち受ける':`新たな敵軍が出現 / 前階からHP ${Math.round(me.hp)} を引継ぎ`);
   uiTick();
  }catch(e){
   console.error('[V55.17 無限天守]',e);
   if(cur===run){
    finish(false,'階層の生成に失敗しました。到達記録は保存されます。');
    rfBattleStartError(e);
   }
  }finally{cur.loading=false;}
 }
 async function launch(key){
  if(!FIGHTERS[key])throw Error('使用できないキャラクターです。');
  stop(false);
  state.mode='infinite';state.myKey=key;
  run={key,floor:1,cleared:0,seed:crypto.getRandomValues(new Uint32Array(1))[0]||1,
    hp:null,startedAt:NOW(),transition:false,loading:false,startedBattle:false,stairs:null,battle:null,serverRun:null};
  state.endlessRun=run;
  interval=setInterval(uiTick,300);
  tryRemoteStart();
  await startFloor();
 }
 function finish(won,reason=''){
  if(!run)return;
  const local=run;
  if(state.battle){const me=state.battle.fighters.find(f=>f.isPlayer);if(me)local.hp=Math.max(0,Math.floor(me.hp));}
  record();remoteFinish(local);removeStairs(local);stopTimers();run=null;state.endlessRun=null;
  const note=reason||(won?'まだ先へ続くはずの回廊を踏破しました。':'体力が尽き、無限天守の探索が終了しました。');
  showResult(`無限天守  第${local.cleared.toLocaleString('ja-JP')}層踏破`,
    `${note}\n到達階層: ${local.floor.toLocaleString('ja-JP')}層 ／ ランク: ${RANK(local.cleared+1)} ／ 記録: ${endlessElapsedText(NOW()-local.startedAt)}`,
    '最高記録はランキングから確認できます',false,false);
  uiTick();
 }
 function onEnd(won){
  const cur=run;if(!cur)return;
  const b=state.battle;
  const me=b?.fighters.find(x=>x.isPlayer);
  if(!won||!me||me.dead||me.hp<=0){finish(false);return;}
  // Safety fallback for legacy battle-end callbacks; usually victory is handled
  // directly by the continuous-wave tick before the Battle victory checker.
  if(b)b.ended=false;
  if(!cur.transition)completeFloor(cur,b);
 }
 function stop(submit=true){
  if(!run){stopTimers();uiTick();return;}
  if(submit){record();remoteFinish(run);}
  removeStairs(run);
  run=null;state.endlessRun=null;stopTimers();uiTick();
 }
 function openLeaderboard(){
  let dialog=$('rf552-infinite-board');
  if(!dialog){dialog=document.createElement('div');dialog.id='rf552-infinite-board';document.body.append(dialog);}
  dialog.replaceChildren();dialog.className='rf552-board-backdrop';
  const wrap=document.createElement('section');wrap.className='rf552-board';
  const head=document.createElement('h2');head.textContent='無限天守 ── 到達階層ランキング';
  const sub=document.createElement('p');sub.textContent='順位は到達階層が高い順。同階層なら所要時間が短い順です。';
  const local=document.createElement('p');const value=best();
  local.textContent=value?`この端末の最高記録：第${value.floor}層踏破 / ${endlessElapsedText(value.timeMs)} / ${RANK(value.floor+1)}`:'この端末にはまだ到達記録がありません。';
  const status=document.createElement('p');status.textContent='世界ランキングを取得しています…';
  const entries=document.createElement('ol');entries.className='rf552-rank-list';
  const close=document.createElement('button');close.type='button';close.className='btn mini';close.textContent='閉じる';
  close.onclick=()=>dialog.remove();dialog.onclick=e=>{if(e.target===dialog)dialog.remove()};
  wrap.append(head,sub,local,status,entries,close);dialog.append(wrap);
  if(!apiEnabled()){status.textContent='サーバーが未設定です。この端末の記録のみ表示しています。';return;}
  remoteUrl('/infinite/board',{}).then(data=>{
    if(!dialog.isConnected)return;
    if(!data?.ok||!Array.isArray(data.rows))throw Error('ランキングを取得できませんでした。');
    status.textContent=`世界ランキング 上位${data.rows.length}人（同期コード登録済みの記録）`;
    entries.replaceChildren();
    data.rows.forEach((v,i)=>{
      const item=document.createElement('li');
      item.textContent=`${i+1}位｜${String(v.name||'旅人').slice(0,12)}｜${v.floor}層｜${endlessElapsedText(v.timeMs)}｜${RANK(v.floor+1)}`;
      entries.append(item);
    });
    if(!data.rows.length)status.textContent='まだ世界記録はありません。最初の挑戦者になりましょう。';
  }).catch(e=>status.textContent='世界ランキングを取得できませんでした（ローカル記録は残っています）。');
 }
 return {launch,onEnd,stop,openLeaderboard,get active(){return run;},get best(){return best();}};
}
