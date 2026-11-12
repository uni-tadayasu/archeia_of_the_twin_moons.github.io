// Riftfall Arena V55.18 — 無限天守: full enclosed 3D castle maze, action combat, stairs to next floor only after total annihilation.
import { CastleMazeWorld, installCastleBattleNavigation } from './assets/rf568-castle-maze.js?v=55.20';
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
   ui,syncCodeNow,apiEnabled,api,myName,getArena}=c;
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
  const crowd=run.transition?'  │  全敵撃破！階段へ':w?`  │  残敵 ${w.remaining}/${w.total}`:'';
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
  const local=run,starting=pendingStart;if(!local?.serverRun&&!starting)return;
  serverQueue=serverQueue.catch(()=>null).then(async()=>{
    if(starting)await starting;
    if(!local.serverRun)return;
    try{await remoteUrl('/infinite/progress',{code:syncCodeNow(),name:myName(),runId:local.serverRun,floor});}
    catch(e){console.warn('[無限天守] 階層送信保留',e)}
  });
 }
 function remoteFinish(local){
  if(!local)return;
  const starting=pendingStart;
  serverQueue=serverQueue.catch(()=>null).then(async()=>{
    if(starting)await starting;
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
 // A physical staircase lives inside the castle's farthest reachable chamber.
 function removeStairs(cur){
  if(!cur)return;
  cur.battle?.rf568Maze?.setStair(false);
  cur.stairs=null;
  document.getElementById('rf568-endless-stair-hint')?.remove();
 }
 function showStairs(cur,b,player){
  removeStairs(cur);
  const maze=b.rf568Maze;
  const target=maze?.setStair(true);
  if(!target)throw Error('城内の階段を設置できませんでした。');
  cur.stairs={x:target.x,z:target.z,ready:Math.hypot(player.pos.x-target.x,player.pos.z-target.z)>=2.25};
  const hint=document.createElement('div');hint.id='rf568-endless-stair-hint';
  hint.textContent=`全区画の敵を殲滅！ 城内図の金色の階段まで進むと第${cur.floor}層へ`;
  document.body.append(hint);
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
   const enemyPool=ENEMY_ROSTER.filter(k=>FIGHTERS[k]&&!FIGHTERS[k].hidden);
   const minions=Array.from({length:Math.min(4,enemyPool.length)},()=>enemyPool[Math.floor(rng()*enemyPool.length)]);
   const pool=[...new Set([...enemies,...minions])];
   if(!(await ensureAllModelsReady([cur.key,...pool])))throw Error('階層のモデルを準備できませんでした。');
   if(cur!==run||state.mode!=='infinite')return;
   let b=cur.battle;
   if(!b){
    // The original circular arena is exclusively for story/event/adventure battles.
    const stage=STAGES.find(s=>/天守|城|castle|和風|palace/i.test(`${s.name} ${s.id}`))||STAGES[0];
    setStage(stage);b=makeBattle(null);cur.battle=b;
    installCastleBattleNavigation(b.constructor);
    b.rf568Maze=new CastleMazeWorld(b,{floor,seed:cur.seed,arena:getArena()});
    const p=b.rf568Maze.startPoint();
    const me=b.add(cur.key,{team:0,player:true,awk:save.awk,netId:'endless-self',pos:[p.x,p.z],
      name:FIGHTERS[cur.key].name+'（挑戦者）',upg:upgFor(cur.key),gear:gearFor(cur.key)});
    if(cur.hp!==null)me.hp=Math.max(1,Math.min(me.maxHp,Math.floor(cur.hp)));
   }else{
    if(b!==state.battle)return;
    removeStairs(cur);
    b.rf568Maze.build(floor,cur.seed); // Same Battle / Fighter, a NEW enclosed maze floor.
    const me=b.fighters.find(f=>f.isPlayer&&!f.dead);
    if(!me)throw Error('挑戦者の戦闘状態を引き継げませんでした。');
    const p=b.rf568Maze.startPoint();
    me.pos.set(p.x,0,p.z);me.vel?.set?.(0,0,0);me.sync?.();
    b.camCenter?.copy?.(me.pos); // no lengthy camera pan through walls after ascending
   }
   removeDead(b,10);
   if(b.fighters.some(f=>f.team===1&&!f.dead))throw Error('前の階層の敵が残っています。');
   const me=b.fighters.find(f=>f.isPlayer&&!f.dead);
   if(!me)throw Error('挑戦者のデータがありません。');
   cur.hp=me.hp;
   const maze=b.rf568Maze;
   const hpScale=Math.min(5000,1+(floor-1)*.22),atkScale=Math.min(100,1+(floor-1)*.035);
   const isBoss=floor%10===0;
   const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent||'')||(navigator.deviceMemory||8)<=4;
   const maxActive=mobile?5:8;
   const total=mobile?Math.min(30,20+Math.floor(floor/13)):Math.min(48,28+Math.floor(floor/9));
   const positions=[...maze.layout.enemyCells];
   const central=6*13+6;
   if(isBoss){const ix=positions.indexOf(central);if(ix>=0)positions.splice(ix,1);positions.unshift(central);}
   // A full-floor roster exists at once, even though models load only as approached.
   // No enemy teleports back into a colosseum; all locations are fixed maze cells.
   const pending=Array.from({length:total},(_,i)=>{
    const cell=positions[i%positions.length]??central;
    const point=maze.layout.centerOf(cell);
    const key=(isBoss&&i===0)?enemies[0]:(pool[Math.floor(rng()*pool.length)]||enemies[0]);
    return {cell,point,key,boss:isBoss&&i===0};
   });
   const created={value:0},defeated={value:0};
   const spawn=(unit)=>{
    const p=unit.point;
    const f=b.add(unit.key,{team:1,cpu:foeCpu(Math.min(1,.56+floor*.006)),
      hpMul:foeHp(hpScale*(unit.boss?2.2:.55)),atkMul:atkScale*(unit.boss?1:.74),
      pos:[p.x,p.z],facing:Math.atan2(me.pos.x-p.x,me.pos.z-p.z),
      name:unit.boss?`第${floor}層・守護者 ${FIGHTERS[unit.key].name}`:`第${floor}層・敵兵 ${FIGHTERS[unit.key].name}`});
    if(cur.startedBattle)addHudPlate(f);
    created.value++;
   };
   let progressClock=0;
   const wave={
    holdVictory:true,floor,total,get spawned(){return created.value;},get remaining(){return pending.length+b.fighters.filter(f=>f.team===1&&!f.dead).length;},
    tick(dt){
     if(cur!==run||b.ended||!Number.isFinite(dt)||dt<=0)return;
     const player=b.fighters.find(f=>f.isPlayer&&!f.dead);if(!player)return;
     removeDead(b,Math.min(.25,dt));
     if(cur.transition){
      if(cur.stairs){
       const near=Math.hypot(player.pos.x-cur.stairs.x,player.pos.z-cur.stairs.z)<2.25;
       if(!near)cur.stairs.ready=true;
       if(near&&cur.stairs.ready&&!cur.loading)void startFloor();
      }
      maze.updateMap(player.pos,b.fighters.filter(f=>f.team===1&&!f.dead).map(f=>f.pos),false);
      return;
     }
     progressClock+=Math.min(.25,dt);
     // Populate rooms and corridors as the player explores. Enemies in distant
     // rooms remain assigned to those rooms until approached.
     if(progressClock>=.28){
      progressClock=0;
      let alive=b.fighters.filter(f=>f.team===1&&!f.dead).length;
      for(let i=pending.length-1;i>=0&&alive<maxActive;i--){
       const u=pending[i];const d=Math.hypot(player.pos.x-u.point.x,player.pos.z-u.point.z);
       if(d>(u.boss?23:19))continue;
       pending.splice(i,1);spawn(u);alive++;
      }
     }
     const live=b.fighters.filter(f=>f.team===1&&!f.dead);
     const marks=[...pending.map(u=>u.point),...live.map(f=>f.pos)];
     maze.updateMap(player.pos,marks);
     if(!pending.length&&!live.length)completeFloor(cur,b);
    }
   };
   b.rf566EndlessWave=wave;
   // Before the battle starts, put only nearby enemies into the current room.
   let initially=0;
   for(let i=pending.length-1;i>=0&&initially<maxActive;i--){
    const u=pending[i];if(Math.hypot(me.pos.x-u.point.x,me.pos.z-u.point.z)>19)continue;
    pending.splice(i,1);spawn(u);initially++;
   }
   if(!cur.startedBattle){beginBattle(false);cur.startedBattle=true;}
   else{b.ended=false;b.intro=.5;} // No result screen or new arena.
   cur.transition=false;
   ui.banner({name:`— 無限天守　第${floor.toLocaleString('ja-JP')}層 —`},
     isBoss?'城の奥に守護者が潜む。全領域の敵を倒して階段を探せ。':'部屋と廊下を探索し、全区画の敵を倒して階段へ');
   maze.updateMap(me.pos,[...pending.map(u=>u.point),...b.fighters.filter(f=>f.team===1&&!f.dead).map(f=>f.pos)],true);
   uiTick();
  }catch(e){
   console.error('[V55.18 無限天守]',e);
   if(cur===run)finish(false,'城内の生成に失敗しました。到達記録は保存されます。');
  }finally{cur.loading=false;if(cur===run)state.battleLoading=false;}
 }
 async function launch(key){
  if(!FIGHTERS[key])throw Error('使用できないキャラクターです。');
  stop(false);
  pendingStart=null;
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
  record();remoteFinish(local);removeStairs(local);
  local.battle?.rf568Maze?.destroy?.();if(local.battle)local.battle.rf568Maze=null;
  endBattle();stopTimers();run=null;state.endlessRun=null;
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
  if(b?.rf566EndlessWave?.remaining!==0){finish(false,'この階層の戦闘を続けられませんでした。');return;}
  b.ended=false;
  if(!cur.transition)completeFloor(cur,b);
 }
 function stop(submit=true){
  if(!run){stopTimers();uiTick();return;}
  if(submit){record();remoteFinish(run);}
  removeStairs(run);
  run.battle?.rf568Maze?.destroy?.();if(run.battle)run.battle.rf568Maze=null;
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
