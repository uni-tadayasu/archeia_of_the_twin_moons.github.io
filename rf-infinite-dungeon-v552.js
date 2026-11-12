// Riftfall Arena V55.2 — 無限天守 / Endless Castle (original, independent game mode).
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
 let run=null, interval=0, advanceTimer=0, serverQueue=Promise.resolve(), pendingStart=null;
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
  const crowd=w?`  │  敵兵 ${w.spawned}/${w.total}`:'';
  node.textContent=`無限天守  第${run.floor.toLocaleString('ja-JP')}層  │  ${RANK(run.cleared+1)}級  │  HP ${Math.round(hp??run.hp??0)}${crowd}  │  ${endlessElapsedText(elapsed())}`;
 }
 function record(){
  if(!run)return;
  setBest({floor:run.cleared,timeMs:elapsed(),name:myName(),key:run.key,at:NOW()});
 }
 function stopTimers(){clearInterval(interval);clearTimeout(advanceTimer);interval=0;advanceTimer=0;}
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
 async function startFloor(){
  const cur=run;if(!cur||cur.transition)return;
  cur.transition=true;
  try {
    const floor=cur.floor;
    const enemies=foeKeys(floor,cur.seed);
    // RF566: use a small reusable pool of enemy GLBs for dense waves.
    const rng=RNG(((cur.seed>>>0)+Math.imul(floor,2246822519))>>>0);
    const minionPool=ENEMY_ROSTER.filter(k=>FIGHTERS[k]&&!FIGHTERS[k].hidden);
    const minions=[];
    for(let i=0;i<Math.min(3,minionPool.length);i++)minions.push(minionPool[Math.floor(rng()*minionPool.length)]);
    const pool=[...new Set([...enemies,...minions])];
    if(!(await ensureAllModelsReady([cur.key,...pool])))throw Error('階層のモデルを準備できませんでした。');
    if(cur!==run||state.mode!=='infinite')return;
    const stage=STAGES[((floor-1)*3+Math.floor((floor-1)/10))%STAGES.length]||STAGES[0];
    setStage(stage);
    const b=makeBattle(null);
    const me=b.add(cur.key,{team:0,player:true,awk:save.awk,netId:'endless-self',pos:[-4,3],
      name:FIGHTERS[cur.key].name+'（挑戦者）',upg:upgFor(cur.key),gear:gearFor(cur.key)});
    if(cur.hp!==null){me.hp=Math.max(1,Math.min(me.maxHp,Math.floor(cur.hp)));}
    cur.hp=me.hp;
    const hpScale=Math.min(5000,1+(floor-1)*.22),atkScale=Math.min(100,1+(floor-1)*.035);
    const isBoss=floor%10===0;
    const mobile=/Android|iPhone|iPad/i.test(navigator.userAgent||'') || (navigator.deviceMemory||8)<=4;
    const limit=mobile?5:9; // simultaneous live enemies, not total enemies
    const total=mobile?Math.min(18,11+Math.floor(floor/12)):Math.min(32,18+Math.floor(floor/5));
    const initial=isBoss?Math.min(3,limit):Math.min(mobile?4:5,limit);
    let created=0, elapsedSince=0, previous={x:me.pos.x,z:me.pos.z}, distanceSince=0, batches=0;
    const addEnemies=(count,first=false)=>{
      const player=b.fighters.find(f=>f.isPlayer&&!f.dead);
      const origin=player?.pos || {x:-4,z:3};
      const n=Math.min(Math.max(0,count),total-created);
      for(let i=0;i<n;i++){
        const bossFighter=isBoss && created===0;
        const key=bossFighter?enemies[0]:pool[Math.floor(rng()*pool.length)]||enemies[0];
        const ang=(created*2.399963+floor*0.18+rng()*0.9);
        const d=first ? 9+rng()*5 : 10+rng()*10;
        const x=Math.max(-44,Math.min(44,origin.x+Math.cos(ang)*d));
        const z=Math.max(-44,Math.min(44,origin.z+Math.sin(ang)*d));
        b.add(key,{team:1,cpu:foeCpu(Math.min(1,.56+floor*.006)),
          hpMul:foeHp(hpScale*(bossFighter?2.0:0.53)),
          atkMul:atkScale*(bossFighter?1:0.72),
          pos:[x,z],facing:Math.atan2(origin.x-x,origin.z-z),
          name:bossFighter?`第${floor}層・守護者 ${FIGHTERS[key].name}`:`第${floor}層・敵兵 ${FIGHTERS[key].name}`});
        created++;
      }
      if(!first && n){batches++;ui.banner({name:`— 第${floor}層　増援部隊 —`},`${n}体が進軍！　撃破 ${created-n}/${total}`);}
    };
    addEnemies(initial,true);
    // This callback runs once per frame *after combat updates but before win judging*.
    // Reaching new parts of the map brings reinforcements, with a safety fallback
    // at low enemy counts so the player never gets stuck on a cleared floor.
    b.rf566EndlessWave={
      floor, total, get spawned(){return created;},
      tick(dt){
        if(cur!==run||b.ended||!Number.isFinite(dt)||dt<=0)return;
        const player=b.fighters.find(f=>f.isPlayer&&!f.dead);
        if(!player)return;
        elapsedSince+=Math.min(.25,dt);
        if(previous){distanceSince+=Math.min(6,Math.hypot(player.pos.x-previous.x,player.pos.z-previous.z));}
        previous={x:player.pos.x,z:player.pos.z};
        const alive=b.fighters.filter(f=>f.team===1&&!f.dead).length;
        const remaining=total-created;
        if(!remaining)return;
        const travelReady=distanceSince>=11 && elapsedSince>=2.6;
        const enemyCleared=alive<=1;
        const sparse=alive<Math.min(3,limit) && elapsedSince>=5;
        if(!travelReady&&!enemyCleared&&!sparse)return;
        if(alive>=limit)return;
        const count=Math.min(remaining,limit-alive, mobile?3:4);
        addEnemies(count);
        elapsedSince=0;distanceSince=0;
      }
    };
    beginBattle(isBoss);
    ui.banner({name:`— 無限天守  第${floor.toLocaleString('ja-JP')}層 —`},floor%10===0?'十階ごとの守護者が待ち受ける':'残りHPを維持してさらに奥へ');
    uiTick();
  }catch(e){
    console.error('[V55.2 無限天守]',e);
    if(cur===run){
      const errorText='階層の生成に失敗しました。到達記録は保存されます。';
      finish(false,errorText);
      rfBattleStartError(e);
    }
  }finally{cur.transition=false;}
 }
 async function launch(key){
  if(!FIGHTERS[key])throw Error('使用できないキャラクターです。');
  stop(false);
  state.mode='infinite';state.myKey=key;
  run={key,floor:1,cleared:0,seed:crypto.getRandomValues(new Uint32Array(1))[0]||1,
    hp:null,startedAt:NOW(),transition:false,serverRun:null};
  state.endlessRun=run;
  interval=setInterval(uiTick,300);
  tryRemoteStart();
  await startFloor();
 }
 function finish(won,reason=''){
  if(!run)return;
  const local=run;
  if(state.battle){const me=state.battle.fighters.find(f=>f.isPlayer);if(me)local.hp=Math.max(0,Math.floor(me.hp));}
  record();remoteFinish(local);stopTimers();run=null;state.endlessRun=null;
  const note=reason||(won?'まだ先へ続くはずの回廊を踏破しました。':'体力が尽き、無限天守の探索が終了しました。');
  showResult(`無限天守  第${local.cleared.toLocaleString('ja-JP')}層踏破`,
    `${note}\n到達階層: ${local.floor.toLocaleString('ja-JP')}層 ／ ランク: ${RANK(local.cleared+1)} ／ 記録: ${endlessElapsedText(NOW()-local.startedAt)}`,
    '最高記録はランキングから確認できます',false,false);
  uiTick();
 }
 function onEnd(won){
  const cur=run;if(!cur)return;
  const f=state.battle?.fighters.find(x=>x.isPlayer);
  if(!won||!f||f.dead||f.hp<=0){finish(false);return;}
  if(cur.transition)return;
  cur.hp=Math.max(1,Math.floor(f.hp));
  cur.cleared=cur.floor;
  record();checkpoint(cur.cleared);
  cur.floor+=1;
  endBattle();
  ui.banner({name:`— 第${cur.cleared.toLocaleString('ja-JP')}層 踏破！ —`},`次の階層へ / HP ${cur.hp} / ${endlessElapsedText(elapsed())}`);
  uiTick();
  advanceTimer=setTimeout(()=>{advanceTimer=0;if(cur===run)void startFloor();},950);
 }
 function stop(submit=true){
  if(!run){stopTimers();uiTick();return;}
  if(submit){record();remoteFinish(run);}
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
