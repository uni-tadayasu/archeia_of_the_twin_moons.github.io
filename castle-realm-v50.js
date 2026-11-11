// RF55_EVENT_BGM_20261111
// RF54_FIX_20261111
// Riftfall Castle Realm V50 - browser UI, all rules enforced by Cloudflare Worker.
import {api,apiEnabled} from './api.js';
export function initCastleRealm({save,persist,FIGHTERS,canUse,show,goTitle,state,playerName,syncCodeNow,setCastleMusic,roleToken,roleKind,syncBefore,markSynced,syncVer}){
const ui=document.getElementById('castle-content'),enter=document.getElementById('btn-castle');
if(!ui||!enter)return;
const S={castle:null,list:[],raid:null,fighter:'',target:'',busy:false,pendingLoot:0,notice:''};
const fmt=n=>Number(n||0).toLocaleString('ja-JP');
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
const errorMap={sync:'未同期のセーブデータがあるため処理を停止しました。旅支度から同期後、もう一度お試しください。',castle_not_ready:'サーバーの拠点機能が利用できません。Cloudflare Workerの再デプロイとDurable Objectsの設定を確認してください。',already_exists:'拠点はすでに建設されています。再読込してください。',no_castle:'まだ拠点がありません。',not_found:'対象の拠点または攻城戦が見つかりません。',nosync:'旅支度から同期コードを設定し、セーブを同期してください。',shield:'この城は現在、襲撃保護中です。',new_castle:'新しい城は一定時間保護されています。',cooldown:'この城へは24時間以内に再襲撃できません。',under_attack:'ほかのプレイヤーが攻略中です。',already_active:'先に進行中のダンジョンを終えてください。',shards:'灯晶が不足しています。',fighter_locked:'選択した領主・戦士は使用できません。',level_max:'城は最大レベルです。',too_fast:'攻撃間隔を空けてください。',not_ready:'奥義ゲージが不足しています。',mail_retry:'報酬処理中です。「受け取りを再試行」を押してください。'};
async function request(name,body={}){
if(!apiEnabled())throw Error('拠点機能にはCloudflare Workersとの通信が必要です。');
const code=syncCodeNow();
if(code.length!==12)throw Error(errorMap.nosync);
// Synchronize pending player progress before any server balance is read or changed.
let release=null;
try{
 if(!['list','raid/current'].includes(name))release=await syncBefore?.();
 const out=await api('/castle/'+name,{code,name:playerName(),token:roleToken?.()||'',...body});
 if(!out?.ok)throw Error(errorMap[out?.error]||('通信エラー：'+(out?.error||'server')));
 const receipt=out.result||out;
 if(typeof receipt.data==='string'&&Number.isSafeInteger(receipt.ver)&&Number.isSafeInteger(receipt.shards))updateBalance(receipt.shards,receipt.ver,receipt.data);
 return out;
}finally{release?.()}
}
async function run(fn){if(S.busy)return;S.busy=true;render();try{await fn();}catch(e){S.notice=e?.message||String(e);}finally{S.busy=false;render();}}
// RF55_CASTLE_CHARACTER_SEARCH_20261111 — show every visible character in search, without granting locked assets.
const RF55_CHIEF_ONLY=new Set(['valgard','gaizorg','valdarion','valgard2','maou','maou_shade','uninomiya_tadayasu','fujiwara_nobuyori','udaijin','kinosaki_sanmi','nepterion']);
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
function selectFighter(current){
 const select=node('select','cr-select');
 select.setAttribute('aria-label','攻城戦で使用するキャラクター');
 select.dataset.rf55Searchable='1';
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
const c=S.castle;
if(!c){
 ui.append(heading('拠点を建設する'),line('和風か洋風を選び、使えるキャラクターを領主に任命します。'));
 const types=node('select','cr-select');for(const [id,name] of [['wa','和風・城下町'],['west','洋風・城塞都市']]){const opt=node('option','',name);opt.value=id;types.append(opt)}
 const lord=selectFighter(S.fighter);if(!S.fighter&&lord.options.length)S.fighter=lord.value;
 types.onchange=()=>{const preview=document.getElementById('castle-preview');preview?.replaceWith(stylePreview(types.value,1));document.querySelector('.cr-castle-scene').id='castle-preview'};
 const preview=stylePreview(types.value,1);preview.id='castle-preview';
 ui.append(preview,line('拠点の種類'),types,line('初代領主'),lord,
   button('この拠点を建設する',()=>run(async()=>{if(![...lord.options].some(o=>o.value===lord.value&&!o.disabled))throw Error('使用できる領主を選択してください。');
const r=await request('create',{style:types.value,lord:lord.value});S.castle=r.castle;updateBalance(r.shards,r.ver,r.data);S.notice='拠点が完成しました。'}),'cr-accent'));
}else{
 const style=c.style==='wa'?'和風':'洋風',next=c.nextCost;
 ui.append(row(node('strong','','Lv'+c.level+'　'+style+'の拠点'),node('span','cr-small','防衛ダンジョン '+c.floors+'階層')));
 ui.append(stylePreview(c.style,c.level),line('城は10レベルごとに外観が豪華になり、ダンジョンが1階層増えます。'));
 const lordName=FIGHTERS[c.lord]?.name||c.lord;ui.append(line('領主：'+lordName+'　／　所持灯晶：'+fmt(save.shards)));
 if(c.shieldUntil>Date.now())ui.append(line('保護期間：'+new Date(c.shieldUntil).toLocaleString('ja-JP')+'まで'));
 const actionRow=row();
 actionRow.append(button(c.level<100?'城をレベルアップ（'+fmt(next)+'灯晶）':'城 Lv100 到達',()=>run(async()=>{const r=await request('level');S.castle=r.castle;updateBalance(r.shards,r.ver,r.data);S.notice='城Lv'+r.castle.level+'に強化しました。'}),'cr-accent'));
 if(c.level>=100)actionRow.firstChild.disabled=true;
 actionRow.append(button('状態を更新',()=>run(refresh)));ui.append(actionRow);
 const lord=selectFighter(c.lord);ui.append(heading('領主キャラクター'),lord,button('領主を変更',()=>run(async()=>{if(![...lord.options].some(o=>o.value===lord.value&&!o.disabled))throw Error('使用できる領主を選択してください。');
const r=await request('lord',{lord:lord.value});S.castle=r.castle;S.notice='領主を変更しました。'})));
}
ui.append(heading('攻城可能な拠点'),line('勝利すると防衛側の灯晶残高の10％を獲得できます。防衛側の領主を倒す必要があります。'));
if(!S.list.length)ui.append(line('現在、攻城可能な拠点がありません。'));
for(const c of S.list){
 const card=node('div','cr-target');
 card.append(node('strong','',(c.style==='wa'?'🏯 ':'🏰 ')+c.name+'　Lv'+c.level),node('small','','・'+c.floors+'階層・'+(c.protected?'保護中':'襲撃可能')));
 const b=button(c.protected?'保護中':'襲撃する',()=>renderChooseRaid(c));b.disabled=c.protected||S.busy;
 card.append(b);ui.append(card);
}
ui.append(button('拠点一覧を再取得',()=>run(refresh)));
if(S.pendingLoot>0)ui.append(line('保管庫に未受取の戦利品：'+fmt(S.pendingLoot)+'灯晶'));
ui.append(button('システムメールを開く',()=>{document.getElementById('btn-mailbox')?.click();}));
}
function renderChooseRaid(c){
ui.replaceChildren();ui.append(heading(c.name+' の城へ攻撃'),line('防衛ダンジョン：'+c.floors+'階層。最深部の領主を倒して勝利してください。'));
const fighter=selectFighter(S.fighter||'rowen');const back=button('戻る',render);
if(![...fighter.options].some(o=>!o.disabled))ui.append(line('攻城戦に出せるキャラクターがありません。購入状態と運営権限をご確認ください。'));
ui.append(stylePreview(c.style,c.level),line('出撃するキャラクター'),fighter,
button('ダンジョンへ出撃',()=>run(async()=>{const chosen=[...fighter.options].find(o=>o.value===fighter.value&&!o.disabled);
if(!chosen)throw Error('使用権限のあるキャラクターを選んでください。');
S.fighter=chosen.value;const r=await request('raid/start',{targetPid:c.pid,fighter:chosen.value});S.raid=r.raid;setCastleMusic?.(true);S.notice='ダンジョンへの侵入を開始しました。'}),'cr-accent'),back);
}
function renderRaid(){
const r=S.raid;if(!r)return;
ui.append(heading('防衛ダンジョン　第'+r.floor+'/'+r.floors+'階層'));
ui.append(node('div','cr-battle-icon',r.floor===r.floors?'👑 ⚔':'⚔ 🐉'));
ui.append(line('敵：'+(r.enemyName||'防衛モンスター')+'　／　城Lv '+r.castleLevel));
ui.append(line('階層難度：'+r.floor+'/'+r.floors+'、敵攻撃力 '+fmt(r.enemyAttack)+'、防御係数 '+Number(r.defenseFactor||1).toFixed(2)));
ui.append(meter('あなたのHP',r.attackerHp,r.maxHp),meter('敵のHP',r.enemyHp,r.maxEnemyHp),line('奥義ゲージ：'+r.charge+'％'));
ui.append(node('div','cr-log',r.lastLog||''));
if(r.status==='active'){
 const acts=row();for(const [name,id] of [['斬る','attack'],['強技','skill'],['防御','guard'],['回復','heal'],['奥義','over']]){
 const b=button(name,()=>run(async()=>{const t=await request('raid/act',{raidId:r.id,action:id});S.raid=t.raid;if(t.raid?.status!=='active')setCastleMusic?.(false);
 if(t.result){updateBalance(t.result.shards,t.result.ver,t.result.data);S.notice='勝利！ 灯晶 '+fmt(t.result.amount)+' を獲得しました。';}
 else if(t.settlementPending)S.notice='勝利しました。戦利品の確定を再試行してください。';
 }));b.disabled=S.busy;acts.append(b);
 }ui.append(acts);
}else if(r.status==='won'){
 ui.append(heading('攻城戦勝利'));
 ui.append(button('戦利品を受け取る／再試行',()=>run(async()=>{const t=await request('raid/claim',{raidId:r.id});updateBalance(t.shards,t.ver,t.data);S.raid=null;await refresh();S.notice='灯晶 '+fmt(t.amount)+' を獲得しました。'}),'cr-accent'));
}else ui.append(heading('攻城戦終了：'+(r.status==='lost'?'敗退':'時間切れ')));
ui.append(button('拠点管理へ戻る',()=>run(async()=>{setCastleMusic?.(false);S.raid=null;await refresh();})));
}
async function refresh(){
 const me=await request('self');S.castle=me.castle;S.pendingLoot=me.pendingLoot||0;
 if(Number.isFinite(me.shards)){updateBalance(me.shards,me.ver,me.data);}
 const castles=await request('list');S.list=castles.castles||[];
 const current=await request('raid/current').catch(()=>null);
 S.raid=(current?.raid&&['active','won'].includes(current.raid.status))?current.raid:null;
setCastleMusic?.(S.raid?.status==='active');
}
enter.addEventListener('click',()=>{if(state.battle){note('戦闘中は拠点を開けません');return;}show('scr-castle');run(refresh)});
document.getElementById('castle-back')?.addEventListener('click',()=>{setCastleMusic?.(false);goTitle()});
return {refresh,open:()=>enter.click()};
}
