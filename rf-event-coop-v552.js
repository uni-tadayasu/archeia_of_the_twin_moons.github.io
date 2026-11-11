// Riftfall Arena V55.2 — event-specific 2–4-person online co-op.
// Presence and combat replication reuse the existing InstantDB connection.
const TEXT = (v, max=24) => [...String(v ?? '').replace(/[<>\u0000-\u001f]/g, '')].slice(0,max).join('');
const INT = (v,min,max,def=min) => Number.isSafeInteger(Number(v)) ? Math.max(min,Math.min(max,Number(v))) : def;
const HASH = s => {let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
const RNG = seed => () => {seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296};

export function createEventCoopV552(c) {
  const {state, save, FIGHTERS, ROSTER, ENEMY_ROSTER, BOSS_ROSTER, STAGES, connect, activeEvent, evCleared,
    ensureAllModelsReady, makeBattle, beginBattle, setStage, upgFor, gearFor, foeCpu, foeHp, evLv,
    refreshProfile, verifyPeer, verifyPeerProfs, peerKeyOf, peerOpts, rfBattleStartError, ui} = c;
  const $ = id => document.getElementById(id);
  let joinedAt=0, latest={}, members=[], current=null, loading=false, clock=0, lastHostId='';
  let myIdentity=null;
  const isMode=()=>state.mode==='event-coop';
  const online=()=>isMode()?state.online:null;
  const myId=()=>state.net?.myId||'';
  const week=()=>activeEvent().week;
  const cap=()=>Math.min(8,evCleared()+1);
  const localPresence=()=>({
    id:myId(), name:online()?.name||'旅人', fk:state.myKey, mode:'event-coop', pid:save.pid,
    ready:true, joinedAt, evWeek:week(), evCap:cap(), evLv:online()?.selectedLevel||1,
    evPhase:online()?.started?'battle':'lobby',
    evRun:current?.runId||'', evSeed:current?.seed||0, evStart:current?.startedAt||0,
    evParty:current?.party||[]
  });
  function getMembers(){
    const list=Object.values(latest).filter(p=>p?.mode==='event-coop'&&p.ready&&p.evWeek===week()&&p.id);
    if(myId()&&!list.some(p=>p.id===myId())) list.push(localPresence());
    list.sort((a,b)=>(a.joinedAt||0)-(b.joinedAt||0)||a.id.localeCompare(b.id));
    return list;
  }
  function publish(){
    const o=online();if(!o||!state.net)return;
    const b=state.battle,me=b?.fighters.find(f=>f.isPlayer);
    state.net.publish({
      ...localPresence(),
      prof:c.profToken(state.myKey),
      x:me?.pos.x||0,z:me?.pos.z||0,ry:me?.facing||0,
      hp:me?.hp||0,mv:!!me?.moving
    });
  }
  function render(){
    if(!isMode()||!online())return;
    const all=getMembers(), active=all.slice(0,4);members=active;
    const id=myId(), hasSeat=active.some(p=>p.id===id), host=active[0];
    const list=$('rf552-coop-members'), start=$('rf552-coop-start'), picker=$('rf552-coop-level'), info=$('lobby-status');
    if(!hasSeat){
      info.textContent='この合言葉のルームは4人満員です。別の合言葉を指定してください。';
      state.net?.leave();state.net=null;state.online=null;
      $('btn-join').disabled=false;
      return;
    }
    if(list){list.replaceChildren();active.forEach((p,i)=>{
      const el=document.createElement('li');el.textContent=`${i+1}. ${TEXT(p.name,12)} — ${TEXT(FIGHTERS[p.fk]?.name||'旅人',22)}${p.id===host.id?' 【部屋主】':''}${p.id===id?'（あなた）':''}`;
      list.append(el);
    });}
    if(info&&!online().started) info.textContent=`参加 ${active.length}/4人　合言葉: ${$('lobby-room').value}　${host.id===id?'部屋主は開始できます':'部屋主の開始を待っています'}`;
    const maxCap=Math.min(...active.map(p=>INT(p.evCap,1,8,1)));
    if(picker){
      picker.hidden=host.id!==id;
      [...picker.options].forEach(o=>o.disabled=(Number(o.value)>maxCap));
      if(Number(picker.value)>maxCap)picker.value=String(maxCap);
      online().selectedLevel=INT(picker.value,1,maxCap,1);
    }
    if(start){start.hidden=host.id!==id;start.disabled=active.length<2||active.length>4||loading;}
    const help=$('rf552-coop-help');if(help)help.textContent=`挑戦可能: 第${maxCap}段階まで（参加者の解放状況に合わせます）。2〜4人で開始できます。`;
  }
  function acceptPacket(p){
    const o=online();if(!o||o.started||loading||!p||p.kind!=='start')return false;
    const all=getMembers().slice(0,4);const h=all[0];
    if(!h||(p.from&&p.from!==p.host)||p.host!==h.id||p.week!==week()||!Array.isArray(p.party)||p.party.length<2||p.party.length>4)return false;
    if(!p.party.includes(myId()))return false;
    if(!p.party.every(id=>all.some(a=>a.id===id)))return false;
    if(new Set(p.party).size!==p.party.length)return false;
    const maxCap=Math.min(...all.filter(a=>p.party.includes(a.id)).map(a=>INT(a.evCap,1,8,1)));
    return p.lv>=1&&p.lv<=maxCap&&p.seed>0&&p.runId&&/^evt-[a-z0-9-]{8,50}$/i.test(p.runId);
  }
  function onSignal(p){
    if(acceptPacket(p))void startBattle(p).catch(rfBattleStartError);
  }
  async function startBattle(packet){
    if(loading||online()?.started)return;
    loading=true;
    try {
      const o=online();if(!o)return;
      current={...packet,party:[...packet.party]};o.started=true;o.startedAt=packet.startedAt||Date.now();
      state.eventRun={...activeEvent(),lv:packet.lv};
      state.battleLoading=true;
      publish(); // Presence retains the start packet if the topic message is missed.
      const rnd=RNG(packet.seed>>>0);
      const playerData=packet.party.map(id=>id===myId()?localPresence():latest[id]).filter(Boolean);
      if(playerData.length!==packet.party.length)throw Error('参加者情報が揃っていません。再接続してください。');
      const ev=state.eventRun.ev;
      const enemies=[];
      for(const [kind,n] of ev.foes||[])for(let i=0;i<Math.min(8,n);i++) {
        const pick=arr=>arr[Math.floor(rnd()*arr.length)];
        const key=kind==='mob'?pick(ENEMY_ROSTER):kind==='boss'?pick(BOSS_ROSTER):kind==='roster'?pick(ROSTER):kind==='mirror'?playerData[Math.floor(rnd()*playerData.length)].fk:kind;
        if(FIGHTERS[key])enemies.push(key);
      }
      if(!enemies.length)enemies.push(BOSS_ROSTER[0]||'seraphel');
      const models=[...playerData.map(p=>p.fk),...enemies].filter(k=>FIGHTERS[k]);
      if(!(await ensureAllModelsReady(models)))throw Error('3Dモデルを準備できませんでした。');
      if(!isMode()||!online()?.started||current?.runId!==packet.runId)return;
      for(const p of playerData)if(p.id!==myId())await verifyPeer(p);
      setStage(STAGES[ev.stage%STAGES.length]||STAGES[0]);
      const b=makeBattle(state.net);
      const host=packet.party[0]===myId();lastHostId=packet.party[0];
      playerData.forEach((p,i)=>{
        const pos=[-5.6+(i%2)*2.4,-3.5+Math.floor(i/2)*3.2];
        if(p.id===myId()) b.add(state.myKey,{team:0,player:true,awk:save.awk,netId:myId(),pos,name:o.name+'（あなた）',upg:upgFor(state.myKey),gear:gearFor(state.myKey)});
        else {
          const key=peerKeyOf(p.id,p.fk);
          b.add(key,{team:0,remote:true,netId:p.id,pos,name:TEXT(p.name,12),hpMul:1.15,...peerOpts(p.id,key)});
        }
      });
      const L=evLv(packet.lv), scale=1+Math.max(0,playerData.length-1)*.38;
      enemies.forEach((key,i)=>{
        const a=(i/Math.max(1,enemies.length))*Math.PI*2;
        b.add(key,{team:1,cpu:host?foeCpu(.75):0,remote:!host,netId:'evt'+i,
          hpMul:foeHp(ev.hp*L.hp)*scale,atkMul:ev.atk*L.atk*(1+(playerData.length-1)*.08),
          scale:ev.scale||1,facing:Math.PI,pos:[4+Math.cos(a)*2.5,-1+Math.sin(a)*2.5]});
      });
      beginBattle(true);
      ui.banner({name:`— ${playerData.length}人協力・第${packet.lv}段階 —`},ev.name);
      publish();
    }catch(e){
      if(online())online().started=false;
      state.battleLoading=false;
      current=null;
      throw e;
    }finally{loading=false;}
  }
  async function hostStart(){
    const o=online(), all=getMembers().slice(0,4);if(!o||o.started||loading||all[0]?.id!==myId())return;
    if(all.length<2){$('lobby-status').textContent='2人以上集まると開始できます。';return;}
    const maxCap=Math.min(...all.map(p=>INT(p.evCap,1,8,1)));
    const lv=INT($('rf552-coop-level')?.value,1,8,1);
    if(lv>maxCap){$('lobby-status').textContent='ほかの参加者がこの段階を解放していません。';return;}
    const packet={kind:'start',host:myId(),party:all.map(p=>p.id),week:week(),lv,
      seed:crypto.getRandomValues(new Uint32Array(1))[0]||1,
      runId:'evt-'+crypto.randomUUID(),startedAt:Date.now()};
    if(!acceptPacket(packet))return;
    state.net.signal(packet);
    await startBattle(packet);
  }
  function onPeers(peers){
    if(!isMode()||!online())return;
    latest=peers||{};verifyPeerProfs(peers,'eventcoop');
    if(!online()?.started){
      render();
      const host=getMembers()[0];
      if(host?.evPhase==='battle'&&host.evRun&&host.evParty?.length){
        onSignal({kind:'start',host:host.id,party:host.evParty,runId:host.evRun,
          week:host.evWeek,lv:host.evLv,seed:host.evSeed,startedAt:host.evStart||Date.now()});
      }
      return;
    }
    const b=state.battle;if(!b||!current)return;
    const aliveIds=current.party.filter(id=>id===myId()||latest[id]);
    const hostId=aliveIds[0]||'';
    if(lastHostId!==hostId){
      lastHostId=hostId;
      for(const f of b.fighters.filter(f=>f.netId?.startsWith('evt'))){
        const local=hostId===myId();f.remoteAuth=!local;
        // RF553_CHIEF_GLOBAL_CPU_20261111 — also apply global CPU AI level when host migration happens.
        const cp=Math.min(100,Math.max(1,Number(window.rf553CpuPercent?.()??100)));
        f.cpu=local?{level:Math.max(.02,foeCpu(.75)*(.08+.92*cp/100)),t:0,strafe:0,wantGuard:false}:null;
      }
      if(hostId)ui.banner({name:'— 協力戦の管理者を引き継ぎました —'},'戦闘続行');
    }
    for(const p of current.party){
      if(p===myId())continue;
      const f=b.fighters.find(f=>f.netId===p&&f.remoteAuth);if(!f)continue;
      const remote=latest[p];
      if(!remote){f.hp=0;f.dead=true;continue;}
      f.netTarget.set(remote.x,0,remote.z);f.netFacing=remote.ry;f.netMoving=remote.mv;
      f.hp=Math.max(0,Math.min(f.maxHp,remote.hp));f.dead=f.hp<=0;
    }
  }
  function onEnemy(e){
    const o=online();if(!o?.started||!current||e?.from!==lastHostId||!/^evt\d{1,2}$/.test(e.id))return;
    const f=state.battle?.fighters.find(f=>f.netId===e.id&&f.remoteAuth);
    if(!f)return;
    f.netTarget.set(e.x,0,e.z);f.netFacing=e.ry;f.netMoving=e.mv;
    f.hp=Math.max(0,Math.min(f.maxHp,e.hp));f.dead=f.hp<=0;
  }
  function tick(dt){
    if(!online()?.started||!state.net||!state.battle)return;
    clock+=dt;if(clock<.12)return;clock=0;
    publish();
    if(lastHostId===myId())for(const f of state.battle.fighters.filter(f=>f.netId?.startsWith('evt'))){
      state.net.enemy({id:f.netId,x:f.pos.x,z:f.pos.z,ry:f.facing,hp:f.hp,mv:!!f.moving});
    }
  }
  async function join(){
    const room=($('lobby-room')?.value||'').replace(/[^a-z0-9]/gi,'').slice(0,12);
    const name=TEXT($('lobby-name')?.value?.trim()||'旅人',12);
    if(!room){$('lobby-status').textContent='合言葉は英数字で入力してください。';return;}
    $('btn-join').disabled=true;$('lobby-status').textContent='協力ルームに接続しています…';
    try{
      if(state.net){state.net.leave();state.net=null;}
      joinedAt=Date.now();latest={};current=null;clock=0;
      const net=await connect('event-coop',room+'w'+week(),{
        onPeers,onCast:c.onCast,onHit:c.onHit,onSignal,onEnemy
      });
      if(!isMode()){net.leave();return;}
      state.net=net;
      state.online={name,started:false,selectedLevel:1,joinedAt};
      history.replaceState({},'',`?room=${encodeURIComponent(room)}`);
      if(c.apiEnabled())await refreshProfile(state.myKey).catch(()=>{});
      publish();render();
    }catch(e){
      console.error('[Riftfall V55.2 Event Co-op]',e);
      $('lobby-status').textContent='接続できませんでした。回線と合言葉を確認してください。';
      $('btn-join').disabled=false;
    }
  }
  function prepare(){
    latest={};members=[];current=null;loading=false;clock=0;
    const wrap=$('rf552-event-coop');if(wrap)wrap.hidden=false;
    const lv=$('rf552-coop-level');
    if(lv){lv.replaceChildren();for(let i=1;i<=8;i++){const op=document.createElement('option');op.value=String(i);op.textContent=`第${i}段階`;lv.append(op);}}
    const params=new URLSearchParams(location.search);
    const input=$('lobby-room');input.value=(params.get('room')||Math.random().toString(36).slice(2,9)).replace(/[^a-z0-9]/gi,'').slice(0,12);
    $('lobby-mode').textContent='週替わりイベント — 最大4人協力';
    $('lobby-status').textContent='合言葉を共有して2〜4人で集合してください。部屋主が出撃します。';
    $('btn-join').disabled=false;
    const list=$('rf552-coop-members');if(list)list.replaceChildren();
    if(lv)lv.value='1';
    if($('rf552-coop-start')){$('rf552-coop-start').hidden=true;$('rf552-coop-start').onclick=hostStart;}
    if(lv)lv.onchange=()=>{if(online()){online().selectedLevel=Number(lv.value);publish();}};
    c.show('scr-lobby');
  }
  function close(){
    latest={};members=[];current=null;loading=false;clock=0;joinedAt=0;lastHostId='';
    if($('rf552-event-coop'))$('rf552-event-coop').hidden=true;
  }
  function finished(){clock=0;if(online())online().completed=true;}
  return {prepare,join,onPeers,onSignal,onEnemy,tick,close,finished};
}
