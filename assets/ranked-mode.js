import { API_BASE } from '../config.js';
import { playMotion, animateStatic } from './riftfall-motion-v5521.js';

const protocol='riftfall-ranked-v1';
const reconnectText='サーバーに再接続しています…';
const formats=new Intl.NumberFormat('ja-JP');
const fmt=n=>formats.format(n||0);
const tiers={bronze:'ブロンズ',silver:'シルバー',gold:'ゴールド',platinum:'プラチナ',master:'マスター'};
const tierNameAt=(definitions,points)=>{
  for(let index=(definitions?.length||0)-1;index>=0;index--){
    const [,name,threshold]=definitions[index];
    if(points>=threshold)return name;
  }
  return '';
};
const reasonLabels={ko:'KO',time:'時間切れ',retire:'リタイア',disconnect:'接続時間切れ',no_contest:'無効試合'};
const errorLabels={
  nosync:'旅支度でこの端末のセーブを同期してください。',
  rank_unavailable:'ランクマッチのサーバー準備中です。',
  rank_session:'接続の有効期限が切れました。もう一度お試しください。',
  rank_fighter:'その戦士はランクマッチで選べません。',
  rank_join_unknown:'検索の受付を確認できませんでした。状態を再確認しています。',
  limit:'少し時間をおいてからお試しください。',
  'not found':'ランクマッチのサーバー準備中です。'
};
const label=error=>errorLabels[error?.message]||'サーバーに接続できません。通信を確認して再試行してください。';
const $=id=>document.getElementById(id);
const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
const row=(values,heading=false)=>{
  const tr=document.createElement('tr');
  values.forEach((value,i)=>{
    const cell=document.createElement(heading&&i===0?'th':'td');
    if (heading&&i===0)cell.scope='row';
    cell.textContent=value;tr.append(cell);
  });
  return tr;
};
const moves={light:['light','light2','heavy'],dash:['dash'],bolt:['cast'],over:['over'],heal:['cast']};
let projectileTexture=null;

function createView(THREE,battle,match) {
  const actors=[];
  const group=new THREE.Group();
  group.name='Ranked projectiles';
  battle.scene.add(group);
  const bolts=new Map();
  const poses=[null,null];
  for (const [i,player] of match.players.entries()) {
    const local=i===match.seat;
    const actor=battle.add(player.fighter,{team:local?0:1,player:local,pos:[i===0?-4:4,0],
      facing:i===0?Math.PI/2:-Math.PI/2,name:player.name+(player.bot?' ［BOT］':'')});
    actor.hp=actor.maxHp=1000;
    actor.awk=0;
    actors.push(actor);
  }
  let snapshot=null,round=0;
  function effect(e,now) {
    const a=actors[e.seat];
    if (!a) return;
    if (e.kind==='move'&&moves[e.move]) {
      const names=moves[e.move];
      const name=names[e.move==='light'?Math.min(2,e.step||0):0];
      poses[e.seat]={name,end:now+e.duration,duration:e.duration/1000};
      if (e.move==='light') battle.swingFx(a);
      else {
        const spec=e.move==='over'?a.def.over:e.move==='bolt'?a.def.skills[2]:a.def.skills[0];
        battle.castFx(a,spec?.color??a.def.color,spec);
      }
      battle.ui.sfx(e.move==='light'?'swing':e.move==='over'?'burst':'ui');
    } else if (e.kind==='hit') {
      const point=a.pos.clone().setY(1+a.y);
      battle.spark(point,e.guard?0xa5d8ef:0xffd2a2,e.guard ? .7 : 1.15);
      battle.ui.popup(a.pos,e.guard?'防 '+e.damage:String(e.damage),e.guard?'#ace5fb':'#ffe2a5');
      battle.ui.sfx(e.guard?'guard':'hit');
      if (!e.guard) {
        a.hitFlash=.10;
        if (!poses[e.seat] || poses[e.seat].end<now) poses[e.seat]={name:'hit',end:now+300,duration:.30};
      }
    } else if (e.kind==='heal') {
      battle.grandFx(a.pos,3,0x94e8bb,.7);
      battle.ui.popup(a.pos,'+'+e.healed,'#9cf0b1');
    }
  }
  function apply(message) {
    const now=performance.now();
    if (round!==message.round) {
      round=message.round;
      poses.fill(null);
      message.fighters.forEach((f,i)=>{
        actors[i].pos.set(f.x,0,f.z);actors[i].y=f.y;actors[i].facing=f.facing;
        actors[i].motionPlaying=null;actors[i].mixer?.stopAllAction();
      });
    }
    snapshot=message;
    for (const e of message.events) effect(e,now);
    const current=new Set();
    for (const state of message.bolts) {
      current.add(state.id);
      if (!bolts.has(state.id)) {
        projectileTexture ||= new THREE.TextureLoader().load('assets/rf558/luminous-flare.webp');
        projectileTexture.colorSpace=THREE.SRGBColorSpace;
        const color=actors[state.seat].def.color;
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:projectileTexture,color,
          transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
        sprite.scale.set(1.95,1.45,1);
        sprite.position.set(state.x,1.05,state.z);
        group.add(sprite);
        bolts.set(state.id,{sprite,x:state.x,z:state.z});
      }
      const bolt=bolts.get(state.id);
      bolt.x=state.x;bolt.z=state.z;
    }
    for (const [id,bolt] of bolts) {
      if (current.has(id)) continue;
      bolt.sprite.removeFromParent();bolt.sprite.material.dispose();bolts.delete(id);
    }
  }
  function tick(dt) {
    if (!snapshot) return;
    const now=performance.now(),mix=1-Math.exp(-20*dt);
    snapshot.fighters.forEach((f,i)=>{
      const a=actors[i];
      a.pos.x+=(f.x-a.pos.x)*mix;a.pos.z+=(f.z-a.pos.z)*mix;
      a.y+=(f.y-a.y)*mix;
      a.facing+=Math.atan2(Math.sin(f.facing-a.facing),Math.cos(f.facing-a.facing))*mix;
      a.hp=f.hp;a.flux=f.energy;a.over=f.over;a.guard=f.guard;a.dead=f.hp===0;a.moving=f.moving;
      const pose=poses[i];
      const playing=pose&&now<pose.end;
      const name=a.dead?'death':playing?pose.name:a.y>.1?'jump':a.guard?'guard':a.moving?'run':'idle';
      playMotion(a,name,{token:playing?pose:null,duration:playing?pose.duration:0});
      a.mixer?.update(dt);
      a.motionDt=dt;
      a.sync();
      animateStatic(a,dt,{moving:f.moving,fast:true,guard:f.guard});
    });
    for (const {sprite,x,z} of bolts.values()) {
      sprite.position.x+=(x-sprite.position.x)*mix;sprite.position.z+=(z-sprite.position.z)*mix;
    }
    battle.presentation?.tick(dt);
    battle.updateCamera(dt);
  }
  function dispose() {
    for (const {sprite} of bolts.values()) sprite.material.dispose();
    bolts.clear();group.clear();group.removeFromParent();
  }
  return {apply,tick,dispose};
}

export function createRankedMode({
  THREE,FIGHTERS,api,apiEnabled,code,name,roleToken,show,goTitle,options,chooseFighter,loadFighter,makeBattle,endBattle,buildHud,playTrack
}) {
  const el=Object.fromEntries([
    'screen','back','sync','choose','fighter','portrait','join','setup','queue','cancel','status','wait',
    'profile','tier','points','progress','next','stats','board','top','empty','refresh','history','history-wrap',
    'result','heading','delta','reason','retry','leave','vote','live','timer','connection','opponents'
  ].map(key=>[key,key==='screen'?$('scr-ranked'):$('ranked-'+key)]));
  let active=false, generation=0, session=null, selected='', queue=false, busy=false, cancelling=false;
  let request=null, timer=0, reconnect=0, connectionDeadline=0, socket=null, match=null, last=null, view=null, loadStarted=false, battleMounted=false;
  let sendClock=0, seq=0, edges=0, saidReady=false, pendingLeave=false, retireFromFight=false, finishing=false, retryWanted=false;
  let recentBoard=null, boardGeneration=0;
  const notice=text=>setText(el.status,text);
  function lobby() {
    show('scr-ranked');playTrack('ranked');
  }
  function ui() {
    const matchInProgress=!!match;
    const showingResult=matchInProgress&&last?.phase==='result';
    el.setup.hidden=queue||matchInProgress;
    el.queue.hidden=!(queue||(matchInProgress&&(!last||last.phase==='ready')));
    el.result.hidden=!showingResult;
    el.board.hidden=queue||matchInProgress;
    el.sync.hidden=code().length===12&&!!session;
    el.choose.disabled=busy||!session?.fighters.length;
    el.join.disabled=busy||!session||!selected;
    el.cancel.disabled=cancelling||pendingLeave;
    el.cancel.textContent=matchInProgress?'対戦準備をやめる':'検索を取り消す';
    el.back.disabled=finishing;
    el.live.hidden=!view||showingResult;
    const character=FIGHTERS[selected];
    setText(el.fighter,character?.name||'戦士を選択');
    el.portrait.hidden=!character?.face;
    if (character?.face && el.portrait.getAttribute('src')!==character.face) el.portrait.src=character.face;
  }
  async function authorize() {
    if (!apiEnabled()) throw Error('rank_unavailable');
    const syncCode=code(), nickname=name(), role=roleToken?.()||'';
    if (syncCode.length!==12) throw Error('nosync');
    if (session?.code===syncCode&&session.name===nickname&&session.role===role&&session.expires>Date.now()+60000) return session;
    const r=await api('/rank/session',{code:syncCode,name:nickname,role});
    if (!r.ok) throw Error(r.error||'rank_session');
    const fighters=r.fighters.filter(key=>FIGHTERS[key]?.model);
    session={code:syncCode,name:nickname,role,token:r.token,expires:r.expires,fighters};
    if (!fighters.includes(selected)) selected=fighters[0]||'';
    return session;
  }
  async function post(action,payload={}) {
    let auth=await authorize();
    const send=async()=>{
      try {
        return await api('/rank/'+action,{...payload,token:auth.token});
      } catch(error) {
        if(action==='join')throw Error('rank_join_unknown');
        throw error;
      }
    };
    let r=await send();
    if (r.status===401) {
      if(session===auth)session=null;
      auth=await authorize();
      r=await send();
    }
    if (!r.ok) throw Error(r.error||'rank_unavailable');
    return r;
  }
  function renderBoard(board) {
    recentBoard=board;
    const me=board.me;
    const tier=me?.tier||'bronze';
    const score=me?.points||0;
    el.profile.dataset.tier=tier;
    setText(el.tier,tiers[tier]||tiers.bronze);
    setText(el.points,fmt(score)+' pt');
    const current=board.tiers?.find(t=>t[0]===tier);
    const next=board.tiers?.find(t=>t[2]>score);
    el.progress.max=next?next[2]-(current?.[2]||0):1;
    el.progress.value=next?score-(current?.[2]||0):1;
    setText(el.next,next?'次の'+next[1]+'まで '+fmt(next[2]-score)+' pt':'最高ランク到達');
    setText(el.stats,me?.played?
      (me.place?'世界 '+fmt(me.place)+'位 ／ ':'')+me.wins+'勝 '+me.losses+'敗 '+me.draws+'分 ／ 最高 '+fmt(me.peak)+' pt'+(me.streak>1?' ／ '+me.streak+'連勝':'')+(me.botWins?' ／ ボット '+me.botWins+'勝':''):
      '初戦の結果から世界順位が表示されます。');
    const leaders=Array.isArray(board.top)?board.top:[];
    el.empty.hidden=leaders.length>0;
    el.top.replaceChildren(...leaders.map(p=>row([p.place,p.name,tiers[p.tier],fmt(p.points),p.wins],true)));
    const recent=Array.isArray(board.recent)?board.recent:[];
    el['history-wrap'].hidden=!recent.length;
    el.history.replaceChildren(...recent.map(p=>row([
      p.opponent+(p.bot?' ［BOT］':''),{win:'勝利',loss:'敗北',draw:'引き分け'}[p.outcome],
      (p.change>0?'+':'')+p.change+' pt'
    ],true)));
  }
  async function refreshBoard() {
    const version=++boardGeneration;
    el.refresh.disabled=true;
    try {
      if (!apiEnabled()) throw Error('rank_unavailable');
      let auth=null;
      if(code().length===12) {
        try { auth=await authorize(); } catch(error) { if(active&&!match&&!queue)notice(label(error)); }
      }
      const r=await api('/rank/board',auth?{token:auth.token}:{});
      if (!r.ok) throw Error(r.error||'rank_unavailable');
      if (active&&version===boardGeneration) renderBoard(r);
    } catch(error) {
      if(active&&version===boardGeneration&&!match&&!queue)notice(label(error));
    } finally {
      if(version===boardGeneration){el.refresh.disabled=false;if(active)ui();}
    }
  }
  function planPoll() {
    clearTimeout(timer);
    if (active&&queue&&!match&&!cancelling) timer=setTimeout(()=>void poll('status'),1900);
  }
  async function poll(action) {
    if (!active||request||cancelling) return;
    const version=generation;
    const pending=post(action,action==='join'?{fighter:selected}:{});
    request=pending;
    try {
      const r=await pending;
      if (!active||version!==generation||cancelling) return;
      if (r.state==='matched') enterMatch(r);
      else if (r.state==='searching') {
        queue=true;
        setText(el.wait,r.waited+'秒');
        notice(r.waited>=60?'対戦相手を検索中です。候補がいない場合はボット戦の抽選が行われます。':'世界の対戦相手を検索しています。');
      } else {
        if(queue)notice('検索は終了しました。もう一度検索できます。');
        queue=false;
      }
    } catch(error) {
      if(!active||version!==generation||cancelling)return;
      if(action==='join'&&error?.message!=='rank_join_unknown')queue=false;
      notice(label(error));
    } finally {
      if (request===pending) request=null;
      if(active&&version===generation){ui();planPoll();}
    }
  }
  async function cancelSearch(toTitle=false) {
    if(cancelling) return;
    cancelling=true;clearTimeout(timer);ui();
    const version=generation;
    try {
      if (request) await request.catch(()=>{});
      const r=await post('cancel');
      if (!active||generation!==version) return;
      if (r.state==='matched') { pendingLeave=true;enterMatch(r);return; }
      queue=false;
      notice('検索を取り消しました。');
      if (toTitle) goTitle();
    } catch(error) {
      if(active&&version===generation)notice(label(error));
    } finally { cancelling=false;if(active&&version===generation){ui();planPoll();} }
  }
  function command(type) {
    if (!socket||socket.readyState!==WebSocket.OPEN||!last) return false;
    socket.send(JSON.stringify({type,round:last.round}));
    return true;
  }
  function renderResult(message) {
    const result=message.result;
    const me=match.seat;
    const bot=match.players[1-me].bot;
    const headline=result.winner===null?(result.reason==='no_contest'?'無効試合':'引き分け'):result.winner===me?'勝利':'敗北';
    setText(el.heading,headline);
    const diff=result.change[me];
    const points=result.points[me];
    setText(el.delta,(diff>0?'+':'')+diff+' pt ／ 現在 '+fmt(points)+' pt');
    el.delta.dataset.change=diff>0?'up':diff<0?'down':'even';
    const oldTier=tierNameAt(recentBoard?.tiers,result.before[me]);
    const newTier=tierNameAt(recentBoard?.tiers,points);
    const change=oldTier&&newTier&&oldTier!==newTier?' ／ '+newTier+(diff>0?'へ昇格':'へ降格'):'';
    setText(el.reason,(reasonLabels[result.reason]||'試合終了')+
      (result.botLimit?' ／ 本日のボット戦ポイント上限に到達':change));
    const voted=message.votes[me];
    el.retry.disabled=!!voted||retryWanted||finishing;
    el.leave.disabled=finishing;
    const seconds=Math.max(0,Math.ceil((message.deadline-message.now)/1000));
    setText(el.vote,(voted?'再挑戦を送信済み。':bot?'ボットは再挑戦に同意します。':
      message.votes[1-me]?'相手が再挑戦を希望しています。':'双方が再挑戦を選ぶと次の試合へ進みます。')+' 残り'+seconds+'秒');
  }
  function applyMessage(message) {
    const prior=last;
    last=message;
    if (message.phase==='closed') {
      const status=message.reason==='declined'?'対戦を終了しました。':
        message.reason==='not_ready'?'準備時間が終了しました。':'再挑戦の受付を終了しました。';
      return returnToLobby(status);
    }
    if (pendingLeave && retireFromFight && message.phase==='result') {
      pendingLeave=false;retireFromFight=false;finishing=false;
    }
    if (pendingLeave) {
      if (message.phase==='settling') return;
      if (!finishing && command('leave')) finishing=true;
      if (message.phase!=='result') return;
    }
    if (message.phase==='ready' && view && !saidReady) saidReady=command('ready');
    if (prior?.round!==message.round) { retryWanted=false;edges=0; }
    if (message.phase==='countdown'||message.phase==='fight'||message.phase==='settling') {
      if (view && document.querySelector('.screen.on')) show(null);
      const seconds=message.phase==='countdown'?Math.ceil((message.deadline-message.now)/1000):
        Math.ceil(message.timeLeft/1000);
      setText(el.timer,message.phase==='countdown'?'開始まで '+Math.max(1,seconds):
        Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'));
      setText(el.connection,message.phase==='settling'?'結果を確定中…':
        message.connected.every(Boolean)?'':'相手の再接続を待っています');
    }
    view?.apply(message);
    if(message.phase==='ready'){
      if(prior?.phase==='countdown'&&view)setText(el.connection,'相手の再接続を待っています');
      notice(view?'相手の準備を待っています。':'対戦相手が見つかりました。戦士のモデルを準備中です。');
    }
    if (message.phase==='result') {
      if (prior?.phase!=='result') {
        finishing=false;
        lobby();
        void refreshBoard();
      }
      renderResult(message);
    }
    ui();
  }
  function waitForSocketState(offer) {
    if(connectionDeadline)return;
    connectionDeadline=setTimeout(()=>{
      if(active&&match===offer)returnToLobby(last?'対戦への再接続ができませんでした。':'対戦に接続できませんでした。');
    },27000);
  }
  function startSocket() {
    if (!active||!match) return;
    const current=match;
    const url=new URL(API_BASE.replace(/\/$/,'')+'/rank/socket/'+current.id);
    url.protocol=url.protocol==='https:'?'wss:':'ws:';
    const ws=new WebSocket(url,[protocol,'rf-'+current.ticket]);
    socket=ws;
    ws.addEventListener('open',()=>{
      if(socket!==ws)return;
      saidReady=false;retryWanted=false;seq=0;edges=0;
    });
    ws.addEventListener('message',event=>{
      if(socket!==ws||!active||match!==current)return;
      let message;
      try { message=JSON.parse(event.data); } catch {return;}
      if(message?.type!=='state')return;
      if(connectionDeadline){
        clearTimeout(connectionDeadline);connectionDeadline=0;
        setText(el.connection,'');
        if(el.status.textContent===reconnectText)notice('');
      }
      applyMessage(message);
    });
    ws.addEventListener('close',event=>{
      if(socket!==ws||!active||match!==current)return;
      socket=null;finishing=false;
      if(event.code===4001)return returnToLobby('この対戦は別のタブまたは端末で開かれました。');
      if(last?.phase==='result')el.retry.disabled=true;
      setText(el.connection,reconnectText);
      notice(reconnectText);
      waitForSocketState(current);
      clearTimeout(reconnect);reconnect=setTimeout(startSocket,850);
    });
  }
  function enterMatch(offer) {
    clearTimeout(timer);queue=false;match=offer;last=null;
    setText(el.wait,'');el.cancel.disabled=pendingLeave;
    setText(el.opponents,offer.players.map(p=>p.name+(p.bot?' ［BOT］':'')).join(' ／ '));
    notice(pendingLeave?'対戦準備を取り消しています…':'対戦相手が見つかりました。');
    lobby();ui();
    waitForSocketState(offer);
    try {startSocket();} catch {returnToLobby('対戦接続を開始できませんでした。');return;}
    if (!pendingLeave&&!loadStarted) void prepareMatch(offer);
  }
  async function prepareMatch(offer) {
    loadStarted=true;
    try {
      for (const key of new Set(offer.players.map(p=>p.fighter))) {
        if (!await loadFighter(key)) throw Error('model');
        if (!active||match!==offer||pendingLeave)return;
      }
      const battle=makeBattle();
      battleMounted=true;
      view=createView(THREE,battle,offer);
      buildHud();
      if(last){
        view.apply({...last,events:[]});
        if(last.phase==='ready') saidReady=command('ready');
        if(['countdown','fight','settling'].includes(last.phase))show(null);
      }
      ui();
    } catch {
      if(match!==offer)return;
      notice('戦士の3Dモデルを準備できませんでした。対戦準備を取り消しています。');
      pendingLeave=true;
      command('leave');
      ui();
    }
  }
  function resetMatch() {
    clearTimeout(reconnect);clearTimeout(connectionDeadline);clearTimeout(timer);
    connectionDeadline=0;
    const old=socket;
    socket=null;match=null;last=null;
    if(old&&old.readyState<=WebSocket.OPEN)old.close();
    view?.dispose();
    if(battleMounted)endBattle();
    battleMounted=false;view=null;loadStarted=false;saidReady=false;pendingLeave=false;retireFromFight=false;retryWanted=false;finishing=false;
    sendClock=0;seq=0;edges=0;queue=false;
    setText(el.opponents,'');setText(el.connection,'');
  }
  function returnToLobby(message) {
    resetMatch();
    if(!active)return;
    lobby();notice(message);ui();void refreshBoard();
  }
  async function open() {
    active=true;generation++;
    lobby();ui();notice('ランクマッチを確認しています…');
    const version=generation;
    busy=true;ui();
    try {
      if (code().length===12) {
        await authorize();
        if (!active||version!==generation)return;
        notice('');
        await poll('status');
      } else notice('対戦を始めるには、この端末のセーブを同期してください。');
    } catch(error) {
      if(active&&version===generation)notice(label(error));
    } finally {
      if(active&&version===generation){busy=false;ui();void refreshBoard();}
    }
  }
  async function askRetire() {
    if (!match||pendingLeave||finishing) return;
    if (last?.phase==='fight') {
      const accepted=await window.rf51Confirm?.('ランク戦からリタイアしますか？','敗北として試合を終えます。対人戦ではポイントが減る場合があります。','リタイアする');
      if(!accepted||!match||last?.phase!=='fight')return;
    }
    retireFromFight=last?.phase==='fight';
    pendingLeave=true;finishing=command('leave');
    notice('退出を処理しています…');
    ui();
  }
  el.join.addEventListener('click',()=>{
    if(!active||busy||!selected||queue||match)return;
    queue=true;
    notice('世界の対戦相手を検索しています。');setText(el.wait,'0秒');ui();void poll('join');
  });
  el.refresh.addEventListener('click',()=>void refreshBoard());
  el.sync.addEventListener('click',()=>{close();options();});
  el.choose.addEventListener('click',()=>chooseFighter(session.fighters,key=>{
    selected=key;lobby();ui();
  },()=>{lobby();ui();}));
  el.cancel.addEventListener('click',()=>{if(match)void askRetire();else void cancelSearch();});
  el.back.addEventListener('click',()=>{if(match)void askRetire();else if(queue)void cancelSearch(true);else goTitle();});
  el.retry.addEventListener('click',()=>{
    if(last?.phase!=='result'||retryWanted||pendingLeave)return;
    retryWanted=command('retry');el.retry.disabled=retryWanted;
  });
  el.leave.addEventListener('click',()=>void askRetire());
  function close() {
    active=false;generation++;boardGeneration++;
    busy=false;cancelling=false;request=null;
    resetMatch();el.live.hidden=true;el.refresh.disabled=false;
  }
  function tick(dt,input) {
    if(!input)edges=0;
    if(!view)return;
    view.tick(dt);
    if(last?.phase!=='fight'||!socket||socket.readyState!==WebSocket.OPEN)return;
    const values=input||{};
    edges|=(values.attack?1:0)|(values.skill?2:0)|(values.skill2?4:0)|
      (values.over?8:0)|(values.heal?16:0)|(values.jump?32:0);
    sendClock+=dt;
    if(sendClock<.049||socket.bufferedAmount>16384)return;
    socket.send(JSON.stringify({type:'input',round:last.round,seq:seq++,
      mx:values.mx||0,mz:values.mz||0,guard:!!values.guard,edges}));
    edges=0;sendClock=0;
  }
  return {open,close,tick,askRetire};
}
