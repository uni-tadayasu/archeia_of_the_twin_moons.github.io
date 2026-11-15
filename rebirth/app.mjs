import {ROSTER,STAGES,MODES,CHAPTERS,getEncounter} from './catalog.mjs';
import {loadSave,saveGame,applyReward,exportSave,importSave,purchaseUpgrade,upgradeCost,boostFighter} from './save.mjs';
import {Combat} from './combat.mjs';
import {InputController} from './input.mjs';
import {GameAudio} from './audio.mjs';

const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Math.floor(Number(n)||0).toLocaleString('ja-JP');
const clock=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
let save=loadSave(), mode='story', chosen=ROSTER.find(f=>f.id===save.selectedFighter)||ROSTER[0],stage='moon',view='home',sim=null,renderer=null,paused=false,loading=false,run=null,raf=0,last=0,hudTime=0,toastTimer,dialogueResolve=null;
let continueRequested=false,healthCarry=null,adventureIndex=0,endlessIndex=0;
const audio=new GameAudio();audio.setVolume(save.settings.volume,save.settings.sfxVolume);audio.track('home');
const input=new InputController($('world-canvas'),{onPause:pause});

function persist(){if(!saveGame(save))toast('この環境では保存できません。設定からセーブを書き出せます。');updateProfile();}
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),4200);}
function show(name){view=name;$('site-header').hidden=['play','dialogue','result'].includes(name);for(const id of ['home','select','play','dialogue','result'])$(id+'-view').hidden=id!==name;document.body.dataset.view=name;input.setActive(name==='play'&&!paused&&!loading);window.scrollTo({top:0});}
function updateProfile(){ $('shard-count').textContent=fmt(save.shards);$('profile-name').textContent=save.nickname; document.body.classList.toggle('reduce-motion',save.settings.reducedMotion); }
function renderHome(){
  updateProfile(); const current=MODES.find(m=>m.id===mode)||MODES[0];
  $('mode-grid').innerHTML=MODES.map((m,i)=>`<button type="button" class="mode-card ${m.id===mode?'active':''}" data-mode="${m.id}" aria-pressed="${m.id===mode}"><img src="${escape(m.image)}" alt="" loading="lazy"><span class="mode-number">0${i+1}</span><span class="mode-card-copy"><small>${escape(m.kicker||m.id.toUpperCase())}</small><h3>${escape(m.name)}</h3><p>${escape(m.description)}</p></span><span class="mode-arrow" aria-hidden="true">↗</span></button>`).join('');
  $('mode-label').textContent=current.name;$('hero-description').textContent=current.description;
  $('start-button').innerHTML=`<span>新たに${mode==='endless'?'挑戦する':'旅を始める'}</span><span aria-hidden="true">→</span>`;
  const progress=mode==='story'?save.storyChapter:mode==='adventure'?save.adventureStage:0;
  $('continue-button').hidden=!(progress>0&&progress<(mode==='story'?CHAPTERS.length:10));
  $('continue-button').textContent=`続きから · ${mode==='story'?'第 '+(progress+1)+' 章':'第 '+(progress+1)+' 面'}`;
  const progressNode=$('home-progress');if(progressNode)progressNode.textContent=save.wins?`${fmt(save.wins)} 勝利 · 最高 ${fmt(save.bestFloor)} 階`:'まだ見ぬ物語が、あなたを待つ。';
}
function selectMode(id){mode=id;continueRequested=false;renderHome();audio.unlock();}
function openSelection(continuing=false){continueRequested=continuing;renderSelection();show('select');$('select-back').focus();audio.unlock();}
function renderSelection(){
  renderCharacters();renderDetail();renderStages();$('difficulty').value=save.settings.difficulty;$('difficulty-value').textContent=save.settings.difficulty+'%';
  const h=$('selection-mode');if(h)h.textContent=(MODES.find(m=>m.id===mode)?.name||'出撃準備');
}
function renderCharacters(){
 const term=$('character-search').value.trim().toLowerCase();const list=ROSTER.filter(f=>`${f.name} ${f.title} ${f.element||''}`.toLowerCase().includes(term));
 $('character-grid').innerHTML=list.map(f=>`<button type="button" class="character-card ${f.id===chosen.id?'selected':''}" data-fighter="${f.id}" aria-pressed="${f.id===chosen.id}"><img src="${escape(f.face)}" alt="" loading="lazy"><span><small>${escape(f.element||'戦士')}</small><b>${escape(f.name)}</b></span>${save.favorites.includes(f.id)?'<i class="favorite-star" aria-label="お気に入り">✧</i>':''}</button>`).join('')||'<p class="empty-state">該当する戦士はいません。</p>';
}
function renderDetail(){
 const f=boostFighter(chosen,save);const skills=[f.light,...f.skills.slice(0,4),f.over].filter(Boolean);
 $('character-detail').innerHTML=`<div class="fighter-art"><img src="${escape(f.face)}" alt="${escape(f.name)}"></div><div class="fighter-info"><p class="eyebrow">${escape(f.title)}</p><h2>${escape(f.name)}</h2><div class="fighter-stats"><span>体力<strong>${fmt(f.hp)}</strong></span><span>機動力<strong>${Number(f.speed).toFixed(1)}</strong></span><span>属性<strong>${escape(f.element||'無')}</strong></span></div><div class="fighter-skills">${skills.map((s,i)=>`<span>${i===0?'通常':i===5?'奥義':'技 '+i}<b>${escape(s.name||'連撃')}</b></span>`).join('')}</div><button type="button" class="text-button" id="favorite-button">${save.favorites.includes(f.id)?'✧ お気に入り登録済み':'＋ お気に入りに登録'}</button></div>`;
 $('favorite-button').onclick=()=>{save.favorites=save.favorites.includes(chosen.id)?save.favorites.filter(id=>id!==chosen.id):[...save.favorites,chosen.id];persist();renderCharacters();renderDetail();};
}
function renderStages(){
 const fixed=mode!=='duel';const index=continueRequested?(mode==='story'?save.storyChapter:save.adventureStage):0;
 if(fixed)stage=getEncounter(mode,index,chosen.id).stage;
 $('stage-grid').innerHTML=STAGES.map(s=>`<button type="button" class="stage-card ${s.id===stage?'selected':''}" data-stage="${s.id}" aria-pressed="${s.id===stage}" ${fixed?'disabled':''}><img src="${escape(s.image)}" alt="" loading="lazy"><span><small>${escape(s.subtitle||s.id.toUpperCase())}</small><b>${escape(s.name)}</b></span></button>`).join('');
 const note=$('stage-note');if(note)note.textContent=fixed?'舞台は物語・進行に合わせて移り変わります。':'好きな舞台で、戦い方を磨く。';
}
function runId(){return globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;}
async function begin(index=0,carry=null){
 if(loading)return;loading=true;paused=false;input.setActive(false);save.selectedFighter=chosen.id;save.settings.difficulty=Number($('difficulty').value)||50;persist();
 const encounter=getEncounter(mode,index,chosen.id);if(mode!=='duel')stage=encounter.stage;
 run={id:runId(),index,encounter};healthCarry=carry;
 try{
  if(mode==='story')await dialogue(CHAPTERS[index]?.before||[],CHAPTERS[index]?.title||'物語');
  if(mode==='adventure'&&index===0)await dialogue([{who:'灯守',text:'双月の灯を繋ぐ、十の旅路。第五の地に休息所がある。剣も、体力も、大切に。'}],'灯脈を辿る旅');
  show('play');input.setActive(false);$('battle-message').innerHTML='<span>旅の支度をしています</span><progress id="asset-progress" max="1" value="0"></progress><small id="asset-message">舞台と戦士を読み込み中…</small>';$('battle-message').classList.add('visible');
  $('pause-button').disabled=true;
  const fighter=boostFighter(chosen,save);
  sim=new Combat({fighter,enemies:encounter.enemies,mode,difficulty:save.settings.difficulty,stage,seed:(Date.now()%2147483647),wave:index+1});
  if(carry!==null)sim.player.hp=Math.max(1,Math.min(sim.player.maxHp,carry));
  if(!renderer){const {WorldRenderer}=await import('./renderer.mjs');renderer=new WorldRenderer($('world-canvas'),{quality:save.settings.quality,reducedMotion:save.settings.reducedMotion});}
  renderer.setQuality(save.settings.quality);
  await renderer.prepare([fighter,...encounter.enemies],stage,(value,message)=>{if($('asset-progress'))$('asset-progress').value=Number(value)||0;if(message&&$('asset-message'))$('asset-message').textContent=message;});
  renderer.resize();renderSkillBar();audio.track(mode==='story'?'duel':mode);audio.resume();audio.unlock();
  $('objective').textContent=encounter.title;$('player-name').textContent=chosen.name;$('pause-button').disabled=false;
  $('battle-message').innerHTML=`<span>${escape(encounter.title)}</span><small>${mode==='duel'?'相手の攻撃予告を見極めよう':'灯を繋ぎ、この道を切り拓け'}</small>`;
  setTimeout(()=>{if(view==='play'&&!loading)$('battle-message').classList.remove('visible');},2200);
  loading=false;input.setActive(true);if(document.hidden)pause();last=performance.now();hudTime=0;cancelAnimationFrame(raf);frame(last);
 }catch(error){
  console.error('Rebirth launch failed',error);loading=false;sim=null;renderer?.dispose();renderer=null;show('select');toast(/WebGL/i.test(error.message)?'3D描画を利用できません。ブラウザのハードウェアアクセラレーションを確認してください。':'読み込みに失敗しました。通信を確認して、もう一度出撃してください。');
  const n=$('stage-note');if(n)n.textContent=/WebGL/i.test(error.message)?'このブラウザではWebGL 2が無効です。ハードウェアアクセラレーションを有効にして再起動するか、別の対応ブラウザでお試しください。':`読み込みエラー: ${String(error.message||error).slice(0,180)}`;
 }finally{$('launch-button').disabled=false;}
}
function dialogue(lines,title){
 if(!lines.length)return Promise.resolve();show('dialogue');audio.track('story');audio.unlock();let i=0;
 return new Promise(resolve=>{const finish=()=>{dialogueResolve=null;$('dialogue-next').onclick=null;$('dialogue-skip').onclick=null;resolve();};dialogueResolve=finish;const display=()=>{$('dialogue-chapter').textContent=title;$('dialogue-name').textContent=lines[i].who||lines[i].name||'語り';$('dialogue-text').textContent=lines[i].text;$('dialogue-next').textContent=i===lines.length-1?'出発する →':'次へ →';};$('dialogue-next').onclick=()=>{i++;if(i>=lines.length)finish();else display();};$('dialogue-skip').onclick=finish;display();$('dialogue-next').focus();});
}
function renderSkillBar(){
 const f=sim.player.def||chosen;
 const actions=[['attack','J','連撃'],['skill','K',(f.skills?.[0]?.name||'技A')+' / '+(f.skills?.[1]?.name||'移動技')],['skill2','I',(f.skills?.[2]?.name||'技B')+' / '+(f.skills?.[3]?.name||'移動技')],['over','L',f.over?.name||'奥義'],['heal','H','回復'],['guard','SHIFT','防御'],['dash','SPACE','回避']];
 $('skill-bar').innerHTML=actions.map(([act,key,name])=>`<button type="button" class="skill-slot" data-skill="${act}" title="${escape(name)}"><kbd>${key}</kbd><b>${escape(name)}</b><small data-cooldown="${act}"></small></button>`).join('');
 $('skill-bar').querySelectorAll('button').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);input.held.add(b.dataset.skill);input.pulses.add(b.dataset.skill);});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>input.held.delete(b.dataset.skill));});
}
function frame(now){
 if(!sim||view!=='play')return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
 if(!paused&&!loading){sim.update(dt,input.sample());for(const event of sim.drainEvents())processEvent(event);}
 try{renderer.render(sim,paused?0:dt);}catch(error){console.error(error);home();toast(error.message||'描画を継続できません。画質を下げて再出撃してください。');return;}hudTime+=dt;if(hudTime>.08){renderHUD();hudTime=0;}
 if(!paused&&!loading&&sim.status!=='playing'){finishBattle();return;}
 raf=requestAnimationFrame(frame);
}
function processEvent(e){
 if(e.type==='damage'||e.type==='kill')audio.effect(e.type);
 if(e.type==='action'&&(e.actorId===sim.player.id||e.team===0)){
  const name=e.name||e.actionName;if(name&&e.action!=='attack'){const n=$('battle-message');n.innerHTML=`<span>${escape(name)}</span>`;n.classList.add('visible');setTimeout(()=>{if(view==='play'&&!loading)n.classList.remove('visible');},850);}
 }
 if(e.type==='damage'){
  const node=document.createElement('span');node.className='damage-number '+(e.targetId===sim.player.id?'received':'');node.textContent=fmt(e.amount||e.damage);
  let position=null;if(renderer?.project)position=renderer.project(e.x||0,e.z||0,2.1);
  node.style.left=position?position.x+'px':`${46+Math.random()*12}%`;node.style.top=position?position.y+'px':`${38+Math.random()*12}%`;
  $('damage-numbers').append(node);setTimeout(()=>node.remove(),850);if($('damage-numbers').childElementCount>30)$('damage-numbers').firstChild.remove();
 }
}
function renderHUD(){
 if(!sim)return;const p=sim.player;
 $('hp-fill').style.width=Math.max(0,p.hp/p.maxHp*100)+'%';$('hp-text').textContent=`${fmt(p.hp)} / ${fmt(p.maxHp)}`;
 $('energy-fill').style.width=Math.max(0,Math.min(100,p.energy/(p.maxEnergy||100)*100))+'%';$('ultimate-fill').style.width=Math.min(100,p.ultimate||0)+'%';
 $('battle-time').textContent=clock(sim.elapsed);$('enemy-count').textContent=sim.foes.filter(e=>!e.dead).length;
 $('combo-count').textContent=(sim.combo||0)>1?`${sim.combo} CHAIN`:'';
 for(const b of $('skill-bar').children){const act=b.dataset.skill;let cd=act==='skill'?p.skillCooldowns?.[0]:act==='skill2'?p.skillCooldowns?.[1]:act==='dash'?p.dodgeCooldown:act==='heal'?p.healCooldown:0;b.querySelector('small').textContent=cd>0?Number(cd).toFixed(1)+'s':act==='over'?Math.floor(p.ultimate||0)+'%':'';b.classList.toggle('ready',act==='over'&&p.ultimate>=100);b.classList.toggle('cooling',cd>0);}
 const map=$('minimap'),c=map.getContext('2d'),w=map.width,h=map.height,b=sim.bounds;
 c.clearRect(0,0,w,h);c.fillStyle='rgba(8,15,25,.7)';c.fillRect(0,0,w,h);c.strokeStyle='rgba(215,185,129,.28)';c.strokeRect(8,8,w-16,h-16);
 const to=(x,z)=>[8+(x-b.minX)/(b.maxX-b.minX)*(w-16),8+(z-b.minZ)/(b.maxZ-b.minZ)*(h-16)];
 for(const e of sim.entities){if(e.dead)continue;const [x,y]=to(e.x,e.z);c.fillStyle=e===p?'#ffe0a3':'#e97574';c.beginPath();c.arc(x,y,e===p?3.5:2.2,0,Math.PI*2);c.fill();}
}
function pause(){if(view!=='play'||loading||!sim||sim.status!=='playing')return;paused=true;input.setActive(false);audio.suspend();$('pause-dialog').showModal();$('resume-button').focus();}
function resume(){if(view!=='play')return;$('pause-dialog').close();paused=false;input.setActive(true);audio.resume();last=performance.now();}
async function finishBattle(){
 input.setActive(false);loading=false;const victory=sim.status==='victory',result=applyReward(save,{runId:run.id,mode,index:run.index,kills:sim.kills||0,victory,seconds:sim.elapsed,healthRatio:sim.player.hp/sim.player.maxHp});save=result.state;persist();healthCarry=sim.player.hp;
 if(mode==='story'&&victory)await dialogue(CHAPTERS[run.index]?.after||[],CHAPTERS[run.index]?.title||'物語');
 if(mode==='adventure'&&victory&&run.encounter.restAfter){healthCarry=sim.player.maxHp;await dialogue([{who:'灯守',text:'ここは旅人の休息所。温かな灯が傷を癒す。体力は全回復した。次の五つの地へ、歩みを進めよう。'}],'第五の地 · 灯の休息所');}
 show('result');audio.track('victory');$('result-title').textContent=victory?'道は、拓かれた。':'灯は、まだ消えない。';$('result-subtitle').textContent=victory?(run.encounter.isFinal?'旅の終着点へ。新たな旅も、ここから始まる。':run.encounter.title+' · 踏破'):'戦いを振り返り、ふたたび挑もう。';
 $('result-stats').innerHTML=`<div><span>獲得した灯晶</span><strong>＋${fmt(result.reward)}</strong></div><div><span>討伐</span><strong>${fmt(sim.kills)}</strong></div><div><span>戦闘時間</span><strong>${clock(sim.elapsed)}</strong></div><div><span>残り体力</span><strong>${Math.max(0,Math.ceil(sim.player.hp/sim.player.maxHp*100))}%</strong></div>`;
 $('result-next').hidden=!victory||mode==='duel'||Boolean(run.encounter.isFinal);
 $('result-retry').textContent=mode==='endless'?'第一階から挑み直す':'もう一度挑む';
 $('result-next').textContent=mode==='endless'?`第 ${run.index+2} 階へ →`:'次の地へ →';$('result-next').disabled=false;$('result-retry').disabled=false;$('result-home').focus();
}
function home(){cancelAnimationFrame(raf);input.setActive(false);$('pause-dialog').close();paused=false;sim=null;renderer?.dispose();renderer=null;healthCarry=null;$('damage-numbers').replaceChildren();audio.resume();audio.track('home');renderHome();show('home');}
function openSettings(){
 $('quality-select').value=save.settings.quality;$('volume-input').value=save.settings.volume;$('motion-input').checked=save.settings.reducedMotion;$('nickname-input').value=save.nickname;
 $('settings-note').textContent='新章の進行と灯晶はこのブラウザに保存されます。オンライン版のセーブ・通貨は専用入口で引き続き利用できます。';$('settings-dialog').showModal();
}
function saveSettings(){save.nickname=$('nickname-input').value.trim().slice(0,20)||'旅人';save.settings.quality=$('quality-select').value;save.settings.volume=Number($('volume-input').value);save.settings.reducedMotion=$('motion-input').checked;audio.setVolume(save.settings.volume,save.settings.sfxVolume);persist();$('settings-dialog').close();}
function openRecords(){
 const history=save.history||[];$('records-content').innerHTML=`<div class="record-summary"><div><span>勝利</span><strong>${fmt(save.wins)}</strong></div><div><span>最高到達階</span><strong>${fmt(save.bestFloor)}</strong></div><div><span>累計討伐</span><strong>${fmt(save.kills)}</strong></div></div><h3>灯の鍛錬</h3><p class="muted">獲得した灯晶で、全戦士の力を育てる。</p><div class="upgrade-grid">${[['vitality','体力強化','体力 ＋5%'],['power','攻撃強化','与えるダメージ ＋4%']].map(([key,label,note])=>`<button class="upgrade-card" data-upgrade="${key}" type="button"><span>${label} Lv.${save.upgrades[key]||0}</span><b>${note}</b><small>${upgradeCost(save.upgrades[key])?fmt(upgradeCost(save.upgrades[key]))+' 灯晶':'最大強化'}</small></button>`).join('')}</div><h3>旅の記録</h3><div class="history-list">${history.length?history.slice(-8).reverse().map(h=>`<div><span>${escape(MODES.find(m=>m.id===h.mode)?.name||h.mode)} · ${Number(h.index)+1}</span><b>${h.victory?'踏破':'挑戦'}</b><small>${clock(h.seconds||0)}</small></div>`).join(''):'<p class="muted">まだ記録はありません。最初の旅に出よう。</p>'}</div>`;
 $('records-content').querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>{const r=purchaseUpgrade(save,b.dataset.upgrade);if(r.success){save=r.state;persist();openRecords();toast('鍛錬が完了しました。');}else toast(r.reason||'灯晶が足りないか、最大レベルです。');});
 if(!$('records-dialog').open)$('records-dialog').showModal();
}

$('mode-grid').addEventListener('click',e=>{const b=e.target.closest('[data-mode]');if(b)selectMode(b.dataset.mode);});
$('start-button').onclick=()=>openSelection(false);$('continue-button').onclick=()=>openSelection(true);$('roster-button').onclick=()=>openSelection(false);
$('select-back').onclick=()=>{renderHome();show('home');};$('character-search').oninput=renderCharacters;
$('character-grid').onclick=e=>{const b=e.target.closest('[data-fighter]');if(b){chosen=ROSTER.find(f=>f.id===b.dataset.fighter);renderCharacters();renderDetail();}};
$('stage-grid').onclick=e=>{const b=e.target.closest('[data-stage]');if(b&&!b.disabled){stage=b.dataset.stage;renderStages();}};
$('difficulty').oninput=()=>{$('difficulty-value').textContent=$('difficulty').value+'%';};
$('launch-button').onclick=()=>{if(loading)return;$('launch-button').disabled=true;const index=continueRequested?(mode==='story'?save.storyChapter:mode==='adventure'?save.adventureStage:0):0;adventureIndex=index;endlessIndex=index;void begin(index,continueRequested&&mode==='adventure'&&save.adventureHp!==null?boostFighter(chosen,save).hp*save.adventureHp:null);};
$('pause-button').onclick=pause;$('resume-button').onclick=resume;$('quit-button').onclick=home;
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
$('result-home').onclick=home;$('result-retry').onclick=()=>{if(loading)return;$('result-retry').disabled=true;void begin(mode==='endless'?0:run.index);};
$('result-next').onclick=()=>{if(loading)return;$('result-next').disabled=true;const next=run.index+1;void begin(next,mode==='endless'||mode==='adventure'?healthCarry:null);};
$('settings-button').onclick=openSettings;$('settings-close').onclick=saveSettings;
$('volume-input').oninput=()=>audio.setVolume(Number($('volume-input').value),save.settings.sfxVolume);
$('settings-dialog').addEventListener('cancel',()=>audio.setVolume(save.settings.volume,save.settings.sfxVolume));
$('records-button').onclick=openRecords;$('records-close').onclick=()=>$('records-dialog').close();
$('export-save').onclick=()=>{const blob=new Blob([exportSave(save)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Archeia_Rebirth_Save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);};
$('import-save').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw Error('セーブファイルが大きすぎます。');const restored=importSave(await file.text());save=restored;chosen=ROSTER.find(f=>f.id===save.selectedFighter)||ROSTER[0];persist();renderHome();openSettings();toast('セーブを読み込みました。');}catch(error){toast(error.message||'有効なセーブデータではありません。');}e.target.value='';};
window.addEventListener('resize',()=>renderer?.resize());
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(view==='play')pause();audio.suspend();}else if(!paused)audio.resume();});
window.addEventListener('pagehide',()=>{input.reset();audio.suspend();});
window.addEventListener('pageshow',()=>{if(!paused)audio.resume();});
window.addEventListener('error',e=>{if(e.message?.includes('WebGL'))toast('描画の準備に失敗しました。設定で画質を下げて再度お試しください。');});
renderHome();show('home');$('start-button').disabled=false;
const boot=$('boot-status');if(boot)boot.remove();
