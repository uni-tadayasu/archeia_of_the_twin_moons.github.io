// RF553_CASTLE_NAME_BULK_MOBILE_20261111
// RF55_EVENT_BGM_20261111
// RF54_FIX_20261111
// Riftfall Castle Realm V50 - browser UI, all rules enforced by Cloudflare Worker.
import {api,apiEnabled} from './api.js';
export function initCastleRealm({save,persist,FIGHTERS,canUse,show,goTitle,state,playerName,syncCodeNow,setCastleMusic,roleToken,roleKind,syncBefore,markSynced,syncVer,startBattle,endBattle}){
const ui=document.getElementById('castle-content'),enter=document.getElementById('btn-castle');
if(!ui||!enter)return;
const S={castle:null,list:[],raid:null,fighter:'',target:null,busy:false,pendingLoot:0,notice:'',bossFloor:1};
let encounter=null;
const fmt=n=>Number(n||0).toLocaleString('ja-JP');
// RF553_CASTLE_NAME_BULK_MOBILE_20261111 — preview only; the Worker alone checks the real cost and wallet.
const RF553_COST=lv=>500+350*lv;
function rf553ValidCastleName(v){
 const s=String(v??'').trim().replace(/\s+/g,' ');
 return Array.from(s).length>=1&&Array.from(s).length<=20&&/^[\p{L}\p{N}々ー・＿_\- ]+$/u.test(s);
}
function rf553BulkEstimate(lv,balance,val){
 const quantity=val==='max'?100-lv:Number(val);
 let count=0,cost=0;
 if(!Number.isInteger(quantity)||quantity<1||quantity>100)return {count:0,cost:0};
 if(lv+quantity>100)return {count:0,cost:0,limit:true};
 for(let i=lv;i<lv+quantity;i++){
  const step=RF553_COST(i);
  if(cost+step>balance){if(val!=='max')return {count:0,cost:0,short:true};break;}
  cost+=step;count++;
 }
 return {count,cost};
}
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const row=(...children)=>{const e=node('div','cr-row');children.forEach(c=>e.append(c));return e};
const line=(t)=>node('p','cr-note',t);
function button(text,callback,cls=''){const b=node('button','cr-button '+cls,text);b.type='button';
b.onclick=async()=>{if(/建設する|レベルアップ|領主を変更|ダンジョンへ出撃/.test(text)){
 const message='「'+text+'」を実行しますか？';
 const accepted=window.rf51Confirm?await window.rf51Confirm('拠点操作の確認',message,'実行する'):window.confirm(message);
 if(!accepted)return;
}
return callback?.()};
return b;}
function heading(text){return node('h3','cr-title',text);}
function note(text){S.notice=text;const n=document.getElementById('castle-notice');if(n)n.textContent=text;}
function allowEdit(){return !S.busy}
const errorMap={invalid_floor:'階層は1〜10階から選択してください。',castle_publish_pending:'保存しました。一覧への反映は再読み込みで確認できます。',sync:'未同期のセーブデータがあるため処理を停止しました。旅支度から同期後、もう一度お試しください。',castle_not_ready:'サーバーの拠点機能が利用できません。Cloudflare Workerの再デプロイとDurable Objectsの設定を確認してください。',already_exists:'拠点はすでに建設されています。再読込してください。',no_castle:'まだ拠点がありません。',not_found:'対象の拠点または攻城戦が見つかりません。',nosync:'旅支度から同期コードを設定し、セーブを同期してください。',shield:'この城は現在、襲撃保護中です。',new_castle:'新しい城は一定時間保護されています。',cooldown:'この城へは24時間以内に再襲撃できません。',under_attack:'ほかのプレイヤーが攻略中です。',already_active:'先に進行中のダンジョンを終えてください。',shards:'灯晶が不足しています。',fighter_locked:'選択した領主・戦士は使用できません。',level_max:'城は最大レベルです。',invalid_castle_name:'拠点名は1〜20文字の文字・数字・空白・中点・長音・ハイフンで入力してください。',invalid_count:'一括強化のレベル数が正しくありません。',too_fast:'攻撃間隔を空けてください。',not_ready:'奥義ゲージが不足しています。',mail_retry:'報酬処理中です。「受け取りを再試行」を押してください。'};
async function request(name,body={}){
if(!apiEnabled())throw Error('拠点機能にはCloudflare Workersとの通信が必要です。');
const code=syncCodeNow();
if(code.length!==12)throw Error(errorMap.nosync);
// Synchronize pending player progress before any server balance is read or changed.
let release=null;
try{
 if(!['list','raid/current','raid/act','raid/leave','boss'].includes(name))release=await syncBefore?.();
 const out=await api('/castle/'+name,{code,name:playerName(),token:roleToken?.()||'',...body});
 if(!out.ok){
  const update=out.status===404&&out.error==='not_found'&&name==='boss';
  const error=Error(errorMap[out.error]||(update?'Cloudflare WorkerをV55.20へ更新してください。':'通信エラー：'+(out.error||'server')));
  error.detail=out;throw error;
 }
 const receipt=out.result||out;
 if(typeof receipt.data==='string'&&Number.isSafeInteger(receipt.ver)&&Number.isSafeInteger(receipt.shards))updateBalance(receipt.shards,receipt.ver,receipt.data);
 return out;
}finally{release?.()}
}
async function run(fn){if(S.busy)return;S.busy=true;render();try{await fn();}catch(e){S.notice=e?.message||String(e);}finally{S.busy=false;render();}}
// RF55_CASTLE_CHARACTER_SEARCH_20261111 — show every visible character in search, without granting locked assets.
const RF55_CHIEF_ONLY=new Set(['valgard','gaizorg','valdarion','valgard2','maou','maou_shade','uninomiya_tadayasu','fujiwara_nobuyori','udaijin','kinosaki_sanmi','nepterion','tenshi']);
function rf55DisabledReason(key,d){
 if(d.enemy)return '敵専用';
 if(key==='maou_shade')return '敵専用';
 if(RF55_CHIEF_ONLY.has(key)&&roleKind?.()!=='chief')return '運営長専用';
 if(!canUse(key))return d.special?'権限が必要':(d.shop||d.shardPrice?'未購入':'未解放');
 if(d.shop&&key!=='minamoto_yoritomo'&&!save.chars?.includes(key))return '購入記録が必要';
 return '';
}
function roster(){
 return Object.entries(FIGHTERS).filter(([k,d])=>d&&!d.hidden&&typeof d.name==='string')
 .sort((a,b)=>{
  const aLock=!!rf55DisabledReason(a[0],a[1]),bLock=!!rf55DisabledReason(b[0],b[1]);
  return Number(aLock)-Number(bLock)||a[1].name.localeCompare(b[1].name,'ja');
 });
}
function selectFighter(current,allowDefault=false){
 const select=node('select','cr-select');
 select.setAttribute('aria-label','攻城戦で使用するキャラクター');
 select.dataset.rf55Searchable='1';
 if(allowDefault){
  const option=node('option','','既定の防衛ボスを使う');option.value='';select.append(option);
 }
 const records=roster();
 for(const [key,d] of records){
  const reason=rf55DisabledReason(key,d);
  const n=window.rf53Library?.displayName?.(key)||d.name;
  const option=node('option','',n+(reason?'【'+reason+'】':''));
  option.value=key;option.disabled=!!reason;option.dataset.rf55Reason=reason;
  select.append(option);
 }
 const candidates=[...select.options].filter(o=>!o.disabled);
 const selected=candidates.find(o=>o.value===current)||candidates[0];
 if(selected)select.value=selected.value;
 else select.selectedIndex=-1;
 return select;
}
function stylePreview(style,level){
const tier=Math.min(10,Math.floor(level/10));
const scene=node('div','cr-castle-scene cr-'+(style==='wa'?'wa':'west')+' cr-tier-'+tier);
scene.append(node('div','cr-sky',tier>=7?'✦  ✧  ✦  ✧':''),node('div','cr-tower',style==='wa'?'🏯':'🏰'),node('div','cr-walls','▰ ▰ ▰ ▰ ▰'));
if(tier>=1)scene.append(node('div','cr-fort-extra','✦ 城壁拡張'));
if(tier>=3)scene.append(node('div','cr-fort-extra cr-extra2','✧ 見張り塔'));
if(tier>=5)scene.append(node('div','cr-fort-extra cr-extra3','⚔ 防衛陣'));
if(tier>=8)scene.append(node('div','cr-fort-extra cr-extra4','✦ 王城の威光'));
return scene;
}
function updateBalance(n,ver,data){
 if(!Number.isSafeInteger(n)||n<0||n>999999||!Number.isSafeInteger(ver)||ver<syncVer())return false;
 if(localStorage.getItem('arkeia-sync-dirty'))return false;
 let pend=[];try{pend=JSON.parse(localStorage.getItem('arkeia-sync-pend')||'[]')}catch{return false}
 if(Array.isArray(pend)&&pend.length)return false;
 if(typeof data!=='string')return false;
 let remote;try{remote=JSON.parse(data)}catch{return false}
 if(!remote||remote.pid!==save.pid||remote.shards!==n)return false;
 const chars=Array.isArray(save.chars)?save.chars:[];
 const prefs=save.rfCharacterPrefs||{},buyId=save.buyId;
 Object.assign(save,remote);
 save.chars=[...new Set([...(Array.isArray(remote.chars)?remote.chars:[]),...chars])];
 save.buyId=buyId;
 save.rfCharacterPrefs={...(remote.rfCharacterPrefs||{})};
 for(const [k,v] of Object.entries(prefs))if((v?.at||0)>=(save.rfCharacterPrefs[k]?.at||0))save.rfCharacterPrefs[k]=v;
 persist(false);markSynced(ver,Date.now(),n);return true;
}
function meter(label,amount,max){const wrap=node('div','cr-meter');wrap.append(node('div','',label+' '+fmt(amount)+' / '+fmt(max)));
const back=node('div','cr-meter-bg');const value=node('div','cr-meter-fill');value.style.width=Math.max(0,Math.min(100,(amount/Math.max(1,max))*100))+'%';back.append(value);wrap.append(back);return wrap;}
function render(){
if(!ui)return;ui.replaceChildren();ui.append(node('h2','cr-heading','双月領国 ─ 拠点と攻城戦'));
const message=node('div','cr-notice',S.notice);message.id='castle-notice';ui.append(message);
if(S.raid){renderRaid();return;}
if(S.target){renderChooseRaid(S.target);return;}
const c=S.castle;
if(!c){
 ui.append(heading('拠点を建設する'),line('和風か洋風を選び、使えるキャラクターを領主に任命します。'));
 const types=node('select','cr-select');for(const [id,name] of [['wa','和風・城下町'],['west','洋風・城塞都市']]){const opt=node('option','',name);opt.value=id;types.append(opt)}
 const lord=selectFighter(S.fighter);if(!S.fighter&&lord.options.length)S.fighter=lord.value;
 const castleName=node('input','cr-select');castleName.type='text';castleName.maxLength=20;castleName.autocomplete='off';
 castleName.placeholder='例：双月の本丸';castleName.value=(String(playerName?.()||'旅人').slice(0,12)+'の城').slice(0,20);
 castleName.setAttribute('aria-label','新しい拠点名');
 types.onchange=()=>{const preview=document.getElementById('castle-preview');preview?.replaceWith(stylePreview(types.value,1));document.querySelector('.cr-castle-scene').id='castle-preview'};
 const preview=stylePreview(types.value,1);preview.id='castle-preview';
 ui.append(preview,line('拠点名（最大20文字）'),castleName,line('拠点の種類'),types,line('初代領主'),lord,
   button('この拠点を建設する',()=>run(async()=>{if(![...lord.options].some(o=>o.value===lord.value&&!o.disabled))throw Error('使用できる領主を選択してください。');
const name=castleName.value.trim().replace(/\s+/g,' ');
if(!rf553ValidCastleName(name))throw Error(errorMap.invalid_castle_name);
const r=await request('create',{style:types.value,lord:lord.value,castleName:name});S.castle=r.castle;updateBalance(r.shards,r.ver,r.data);S.notice='拠点が完成しました。'}),'cr-accent'));
}else{
 const style=c.style==='wa'?'和風':'洋風',next=c.nextCost;
 ui.append(row(node('strong','',(c.name||playerName?.()||'双月の拠点')+'　Lv'+c.level+'　'+style),node('span','cr-small','防衛ダンジョン '+c.floors+'階層')));
 ui.append(stylePreview(c.style,c.level),line('城は10レベルごとに外観が豪華になります。防衛ダンジョンは最大10階です。'));
 const lordName=FIGHTERS[c.lord]?.name||c.lord;ui.append(line('領主：'+lordName+'　／　所持灯晶：'+fmt(save.shards)));
 const nameInput=node('input','cr-select');nameInput.type='text';nameInput.autocomplete='off';nameInput.maxLength=20;
 nameInput.value=c.name||String(playerName?.()||'旅人');nameInput.placeholder='拠点の新しい名前';
 nameInput.setAttribute('aria-label','拠点名を入力');
 ui.append(heading('拠点名を設定・変更'),line('攻城戦の拠点一覧に表示される名前です。'),nameInput,
 button('拠点名を変更',()=>run(async()=>{
  const desired=nameInput.value.trim().replace(/\s+/g,' ');
  if(!rf553ValidCastleName(desired))throw Error(errorMap.invalid_castle_name);
  const r=await request('name',{castleName:desired});S.castle=r.castle;
  S.notice='拠点名を「'+r.castle.name+'」に変更しました。';
 })));

 if(c.shieldUntil>Date.now())ui.append(line('保護期間：'+new Date(c.shieldUntil).toLocaleString('ja-JP')+'まで'));
 const actionRow=row();
 actionRow.append(button(c.level<100?'城をレベルアップ（'+fmt(next)+'灯晶）':'城 Lv100 到達',()=>run(async()=>{const r=await request('level');S.castle=r.castle;updateBalance(r.shards,r.ver,r.data);S.notice='城Lv'+r.castle.level+'に強化しました。'}),'cr-accent'));
 if(c.level>=100)actionRow.firstChild.disabled=true;
 actionRow.append(button('状態を更新',()=>run(refresh)));ui.append(actionRow);
 const bulkSelect=node('select','cr-select');bulkSelect.setAttribute('aria-label','一括で強化するレベル数');
 for(const [value,label] of [['5','5レベル'],['10','10レベル'],['20','20レベル'],['50','50レベル'],['max','所持灯晶で可能な最大数']]){
  const option=node('option','',label);option.value=value;bulkSelect.append(option);
 }
 const bulkPreview=line('');
 const bulkAction=button('まとめてレベルアップ',()=>run(async()=>{
  const value=bulkSelect.value;
  const r=await request('level-bulk',value==='max'?{maxAffordable:true}:{count:Number(value)});
  S.castle=r.castle;updateBalance(r.shards,r.ver,r.data);
  S.notice='Lv'+c.level+' → Lv'+r.castle.level+'（'+r.applied+'レベル）、灯晶 '+fmt(r.cost)+' を消費しました。';
 }),'cr-accent');
 const previewBulk=()=>{
  const p=rf553BulkEstimate(c.level,Number(save.shards)||0,bulkSelect.value);
  const ok=c.level<100&&p.count>0;
  bulkPreview.textContent=ok?('Lv'+c.level+' → Lv'+(c.level+p.count)+'　／　消費見込み '+fmt(p.cost)+' 灯晶'):
   (c.level>=100?'最大Lv100です。':p.limit?'Lv100の上限を超えます。':'灯晶が不足しています。');
  bulkAction.disabled=!ok||S.busy;
 };
 bulkSelect.addEventListener('change',previewBulk);
 ui.append(heading('拠点レベルの一括強化'),line('サーバーで合計費用を計算します。指定段階に不足する場合は引き落としません。'),bulkSelect,bulkPreview,bulkAction);
 previewBulk();

 const lord=selectFighter(c.lord);ui.append(heading('領主キャラクター'),lord,button('領主を変更',()=>run(async()=>{if(![...lord.options].some(o=>o.value===lord.value&&!o.disabled))throw Error('使用できる領主を選択してください。');
const r=await request('lord',{lord:lord.value});S.castle=r.castle;S.notice='領主を変更しました。'})));
 renderBossSetup(c);
}
ui.append(heading('攻城可能な拠点'),line('勝利すると防衛側の灯晶残高の10％を獲得できます。最上階の防衛ボスを倒す必要があります。'));
if(!S.list.length)ui.append(line('現在、攻城可能な拠点がありません。'));
for(const c of S.list){
 const card=node('div','cr-target');
 card.append(node('strong','',(c.style==='wa'?'🏯 ':'🏰 ')+c.name+'　Lv'+c.level),node('small','','・'+c.floors+'階層・'+(c.protected?'保護中':'襲撃可能')));
 const b=button(c.protected?'保護中':'襲撃する',()=>{S.target=c;S.notice='';render();});b.disabled=c.protected||S.busy;
 card.append(b);ui.append(card);
}
ui.append(button('拠点一覧を再取得',()=>run(refresh)));
if(S.pendingLoot>0)ui.append(line('保管庫に未受取の戦利品：'+fmt(S.pendingLoot)+'灯晶'));
ui.append(button('システムメールを開く',()=>{document.getElementById('btn-mailbox')?.click();}));
}
function renderBossSetup(c){
 const floor=node('select','cr-select');
 floor.id='rf5520-boss-floor';floor.setAttribute('aria-label','防衛ボスを設定する階');
 for(let n=1;n<=10;n++){
  const name=FIGHTERS[c.bossPlan?.[n-1]]?.name||'既定';
  const option=node('option','','第'+n+'階　'+name+(n>c.floors?'（未開放）':''));
  option.value=String(n);floor.append(option);
 }
 floor.value=String(S.bossFloor);
 floor.onchange=()=>{S.bossFloor=Number(floor.value);render();document.getElementById(floor.id)?.focus({preventScroll:true});};
 const boss=selectFighter(c.bossPlan?.[S.bossFloor-1]||'',true);
 boss.setAttribute('aria-label','第'+S.bossFloor+'階の防衛ボス');
 const saveBoss=button('第'+S.bossFloor+'階の防衛ボスを保存',()=>run(async()=>{
  if(!boss.selectedOptions[0]||boss.selectedOptions[0].disabled)throw Error('使用できる防衛ボスを選んでください。');
  const r=await request('boss',{floor:S.bossFloor,boss:boss.value||null});
  S.castle=r.castle;S.notice='第'+S.bossFloor+'階の防衛ボスを保存しました。';
 }),'cr-accent');
 saveBoss.disabled=S.busy;
 const section=node('section','cr-defense');
 section.append(heading('階層別の防衛ボス'),line('未開放の階も設定できます。最上階が既定の場合は領主が守ります。'),floor,boss,saveBoss);
 ui.append(section);
}

function renderChooseRaid(c){
 ui.append(heading(c.name+' の城へ出撃'),line('防衛ダンジョン：'+c.floors+'階。各階の防衛ボスと円形闘技場で戦います。'));
 const fighter=selectFighter(S.fighter||'rowen');
 const enter=button('第1階へ出撃',()=>run(async()=>{
  const chosen=fighter.selectedOptions[0];
  if(!chosen||chosen.disabled)throw Error('使用できる戦士を選んでください。');
  S.fighter=chosen.value;
  const r=await request('raid/arena',{targetPid:c.pid,fighter:chosen.value});
  S.raid=r.raid;S.notice='';setCastleMusic?.(true);
  await launch();
 }),'cr-accent');
 enter.disabled=S.busy||fighter.selectedIndex<0;
 ui.append(stylePreview(c.style,c.level),line('出撃するキャラクター'),fighter,enter,
  button('拠点一覧へ戻る',()=>{S.target=null;S.notice='';render();}));
}

function returnFromFight(){
 encounter=null;endBattle();show('scr-castle');render();
}
function accept(reply,session){
 if(!reply?.raid||(session&&encounter!==session))return;
 S.raid=reply.raid;
 if(session)session.raid=S.raid;
 if(reply.result){
  updateBalance(reply.result.shards,reply.result.ver,reply.result.data);
  S.raid.paid=true;S.notice='勝利！ 灯晶 '+fmt(reply.result.amount)+' を獲得しました。';
 }else if(reply.settlementPending)S.notice='戦利品の確定を再試行してください。';
 if(S.raid.status!=='active')setCastleMusic?.(false);
 if(session&&(S.raid.status!=='active'||S.raid.floor!==session.floor))returnFromFight();
}
async function act(session,action){
 const r=session.raid,now=performance.now();
 if(encounter!==session||session.busy||r.status!=='active'||now<session.next||
   (action==='skill'&&now<session.skill)||(action==='over'&&r.charge<100)||(action==='heal'&&r.healsLeft<=0))return;
 session.busy=true;session.next=now+730;
 try{
  const out=await request('raid/act',{raidId:r.id,action,floor:r.floor,turn:r.turn});
  if(action==='skill')session.skill=now+1550;
  accept(out,session);
 }catch(e){
  if(e.detail?.raid)accept(e.detail,session);
  else if(encounter===session){
   S.notice='通信が止まりました。進行を確認して再開してください。';
   returnFromFight();
   try{
    const current=await request('raid/current',{raidId:r.id});
    if(S.raid?.id===r.id&&!encounter){accept(current);render();}
   }catch{}
  }
 }finally{session.busy=false;}
}
async function launch(){
 const raid=S.raid;
 if(raid?.combat!=='action'||raid.status!=='active')return;
 const session={raid,floor:raid.floor,busy:false,next:0,skill:0,action:name=>act(session,name)};
 encounter=session;
 try{
  if(!(await startBattle(session))&&encounter===session){encounter=null;S.notice='準備後に、もう一度出撃してください。';}
 }catch(e){if(encounter===session){returnFromFight();throw e;}}
}
function retreat(){
 if(encounter){returnFromFight();return;}
 if(S.raid?.status!=='active')return;
 return run(async()=>{
  accept(await request('raid/leave',{raidId:S.raid.id}));
  if(S.raid.status==='retreated'){S.notice=S.raid.lastLog;S.raid=null;}
 });
}
function renderRaid(){
 const r=S.raid;
 ui.append(heading('防衛ダンジョン　第'+r.floor+'/'+r.floors+'階'),
  line('防衛ボス　'+r.enemyName+'　／　城Lv '+r.castleLevel),
  meter('あなたのHP',r.attackerHp,r.maxHp),meter('防衛側のHP',r.enemyHp,r.maxEnemyHp),node('div','cr-log',r.lastLog||''));
 if(r.status==='active'){
  if(r.combat==='action'){
   const enter=button('第'+r.floor+'階の闘技場へ',()=>run(launch),'cr-accent');
   enter.disabled=S.busy;
   ui.append(line('移動して攻撃を当て、敵の攻撃を回避・防御します。回復は各階で1回です。'),enter);
  }else{
   const acts=row();
   for(const [name,id] of [['斬る','attack'],['強技','skill'],['防御','guard'],['回復','heal'],['奥義','over']]){
    const b=button(name,()=>run(async()=>accept(await request('raid/act',{raidId:r.id,action:id}))));
    b.disabled=S.busy;acts.append(b);
   }
   ui.append(acts);
  }
  const leave=button('この攻城戦から撤退',retreat);leave.disabled=S.busy;ui.append(leave);
  return;
 }
 if(r.status==='won'){
  ui.append(heading('攻城戦勝利'));
  if(!r.paid)ui.append(button('戦利品を受け取る／再試行',()=>run(async()=>{
   const t=await request('raid/claim',{raidId:r.id});updateBalance(t.shards,t.ver,t.data);
   r.paid=true;S.notice='灯晶 '+fmt(t.amount)+' を獲得しました。';
  }),'cr-accent'));
 }else ui.append(heading(r.status==='lost'?'攻城戦敗退':'攻城戦終了'));
 ui.append(button(S.target?'出撃準備へ戻る':'拠点管理へ戻る',()=>{S.raid=null;render();}));
}
async function refresh(){
 const me=await request('self');S.castle=me.castle;S.pendingLoot=me.pendingLoot||0;
 if(Number.isFinite(me.shards))updateBalance(me.shards,me.ver,me.data);
 S.list=(await request('list')).castles||[];
 const r=(await request('raid/current').catch(()=>null))?.raid;
 S.raid=r&&['active','won'].includes(r.status)?r:null;
 S.target=S.raid?S.list.find(c=>c.pid===S.raid.targetPid)||null:null;
 setCastleMusic?.(S.raid?.status==='active');
}
enter.addEventListener('click',()=>{
 if(state.battle)return;
 state.mode='castle';show('scr-castle');run(refresh);
});
document.getElementById('castle-back')?.addEventListener('click',()=>{
 if(S.target&&!S.raid){S.target=null;render();return;}
 setCastleMusic?.(false);goTitle();
});
return {refresh,open:()=>enter.click(),retreat,onBattleEnd:()=>{if(encounter)returnFromFight();}};
}
