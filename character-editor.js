// RF_CHIEF_CHAR_EDITOR_V29_SAVE_CONFIRM — reliable save, accessible in-game confirmation.
// All mutations are authorized again on the server. No local-only admin fallback.
import { api, apiEnabled, verifyToken } from './api.js';

const VERSION='rf-chief-editor-v29-20261110';
const STAT_FIELDS=[
  ['hp','最大HP',1,200000,1],['speed','移動速度',.1,30,.05],
  ['power','攻撃倍率',.1,20,.01],['armor','被ダメージ倍率',.01,5,.01],
  ['height','表示身長',.1,12,.05],['overGain','奥義蓄積倍率',.1,12,.05],
  ['fluxMul','灯力回復倍率',.1,12,.05]
];
const SKILL_FIELDS=[
  ['name','技名','text',0,42],['dmg','威力','number',0,100000],
  ['cost','消費灯力','number',0,100],['radius','範囲','number',0,100],
  ['castTime','詠唱秒数','number',0,30]
];
const TEXT_FIELDS=[['name','キャラクター名',40],['title','肩書き',90],['attribute','属性',16]];
const FIELDS=new Set([...STAT_FIELDS.map(v=>v[0]),...TEXT_FIELDS.map(v=>v[0])]);
const DEFAULT_STAT_VALUES=Object.freeze({hp:1000,speed:5,power:1,armor:1,height:1.8,overGain:1,fluxMul:1});
const SKILL_KEYS=new Set(SKILL_FIELDS.map(v=>v[0]));
const baseSnapshot=new Map();
let activeOverlays=Object.create(null), revision=0, lastFetch=0, panel=null, busy=false;
let FIGHTERS=null, chiefCheck=()=>false, tokenOf=()=>'', inBattle=()=>false;
const $=sel=>document.querySelector(sel);
const make=(tag,cls='',content=null)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==null)e.textContent=content;return e;};
const clone=o=>JSON.parse(JSON.stringify(o));
const original=(key)=>baseSnapshot.get(key);
function recordOriginal(){
  for(const [key,d] of Object.entries(FIGHTERS)){
    if(!d||typeof d!=='object')continue;
    const fields={};for(const k of FIELDS)if(d[k]!==undefined) fields[k]=d[k];
    const slim=(v)=>{const out={};for(const k of SKILL_KEYS)if(v?.[k]!==undefined)out[k]=v[k];return out;};
    baseSnapshot.set(key,{...fields,skills:(d.skills||[]).map(slim),over:slim(d.over),hi:slim(d.hi)});
  }
}
function applyPublic(map){
  if(!map||typeof map!=='object'||Array.isArray(map))return;
  // Restore only controlled fields before applying latest overrides; model, textures, locks untouched.
  for(const [key,original] of baseSnapshot){
    const d=FIGHTERS[key];if(!d)continue;
    for(const k of FIELDS){if(k in original)d[k]=original[k];}
    for(let i=0;i<original.skills.length;i++){
      if(!d.skills?.[i])continue;
      for(const k of SKILL_KEYS)if(k in original.skills[i])d.skills[i][k]=original.skills[i][k];
    }
    for(const type of ['over','hi'])if(d[type])for(const k of SKILL_KEYS)if(k in original[type])d[type][k]=original[type][k];
  }
  for(const [key,patch] of Object.entries(map)){
    const d=FIGHTERS[key];if(!d||!patch||typeof patch!=='object')continue;
    for(const k of FIELDS)if(Object.hasOwn(patch,k))d[k]=patch[k];
    if(Array.isArray(patch.skills))patch.skills.forEach((p,i)=>{
      if(!d.skills?.[i]||!p)return;
      for(const k of SKILL_KEYS)if(Object.hasOwn(p,k))d.skills[i][k]=p[k];
    });
    for(const type of ['over','hi'])if(d[type]&&patch[type])for(const k of SKILL_KEYS)if(Object.hasOwn(patch[type],k))d[type][k]=patch[type][k];
  }
  activeOverlays=clone(map);
}
async function syncPublic(force=false){
  if(!apiEnabled()||inBattle()||(!force&&Date.now()-lastFetch<30000))return;
  const r=await api('/characters/overrides',{});
  if(!r.ok||!r.overrides||!Number.isSafeInteger(r.revision))throw Error('編集データを取得できません（Workerの更新を確認してください）');
  if(revision!==r.revision||!lastFetch)applyPublic(r.overrides);
  revision=r.revision;lastFetch=Date.now();
}
async function authorized(){
  if(!apiEnabled()||!chiefCheck())return false;
  const token=tokenOf();
  const role=await verifyToken(token,'role').catch(()=>null);
  return role?.r==='chief';
}
function formGroup(label,control){const l=make('label','rf-ce-field');l.append(make('span','',label),control);return l;}
function textInput(value,max=50){const e=make('input');e.type='text';e.maxLength=max;e.value=String(value??'');return e;}
function numberInput(value,min,max,step=1){const e=make('input');e.type='number';e.min=min;e.max=max;
  // Existing skills use values such as 0.26, 1.08. A fixed 0.05 step silently blocks submit.
  e.step='any';e.value=Number.isFinite(+value)?String(value):String(min);return e;}
function collectNumbers(inputs){
  const r={};for(const [k,info] of inputs){if(info.type==='text'){r[k]=info.el.value.trim();continue;}
    if(!String(info.el.value).trim())throw Error(info.label+'を入力してください');
    const v=Number(info.el.value);if(!Number.isFinite(v)||v<info.min||v>info.max)throw Error(info.label+'は'+info.min+'～'+info.max+'で入力してください');
    r[k]=v;
  }return r;
}

// Save and reset confirmations are real game UI, not window.confirm().
// Buttons stay keyboard-accessible, escape cancels, and no native form validation suppresses events.
let rfEditorConfirmId=0;
function editorConfirm(title,description,actionText='確定する',danger=false){
  return new Promise(resolve=>{
    const id='rf-ce-confirm-title-'+(++rfEditorConfirmId);
    const lastFocus=document.activeElement;
    const overlay=make('div','rf-ce-confirm-overlay');
    const dialog=make('section','rf-ce-confirm-card');
    dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-labelledby',id);
    const header=make('h3','',title);header.id=id;
    const detail=make('p','',description);
    const actions=make('div','rf-ce-confirm-actions');
    const no=make('button','rf-ce-confirm-cancel','キャンセル');no.type='button';
    const yes=make('button',danger?'rf-ce-confirm-danger':'rf-ce-confirm-accept',actionText);yes.type='button';
    actions.append(no,yes);dialog.append(header,detail,actions);overlay.append(dialog);document.body.append(overlay);
    let finished=false;
    const finish=(answer)=>{
      if(finished)return;finished=true;overlay.remove();
      document.removeEventListener('keydown',keyHandler,true);
      try{lastFocus?.focus?.();}catch{}
      resolve(answer);
    };
    const keyHandler=(e)=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false);}
      if(e.key==='Tab'){
        const items=[no,yes];const i=items.indexOf(document.activeElement);
        const next=(i+(e.shiftKey?-1:1)+items.length)%items.length;
        e.preventDefault();items[next].focus();
      }
    };
    no.addEventListener('click',()=>finish(false));yes.addEventListener('click',()=>finish(true));
    overlay.addEventListener('click',e=>{if(e.target===overlay)finish(false);});
    document.addEventListener('keydown',keyHandler,true);
    no.focus();
  });
}
// Only send differences relative to the game's original definitions. This avoids
// accidentally submitting empty attributes or changing unspecified default stats.
function rfEditedPatch(key,inputs,skillInputs){
  const base=original(key)||{};
  const raw=collectNumbers(inputs),patch={};
  for(const [k,v] of Object.entries(raw)){
    if(k==='name'&&!v)throw Error('キャラクター名を入力してください');
    if(typeof v==='string'&&!v)continue; // Empty optional title/attribute = original value
    if(base[k]===undefined){
      const defaultValue=DEFAULT_STAT_VALUES[k];
      if(v!==defaultValue)patch[k]=v;
    }else if(v!==base[k])patch[k]=v;
  }
  for(const {type,index,items} of skillInputs){
    const origSpec=type==='skills'?base.skills?.[index]:base[type];
    if(!origSpec)continue;
    const rawSkill=collectNumbers(items),changed={};
    for(const [k,v] of Object.entries(rawSkill)){
      if(k==='name'&&!v)throw Error('技名を入力してください');
      if(v!==origSpec[k])changed[k]=v;
    }
    if(Object.keys(changed).length){
      if(type==='skills'){patch.skills ||= [];patch.skills[index]=changed;}
      else patch[type]=changed;
    }
  }
  return patch;
}

function createPanel(){
  const root=make('div','rf-ce-root');root.id='rf-chief-character-editor';root.hidden=true;
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','運営長専用キャラクター編集');
  const shell=make('div','rf-ce-shell');
  const head=make('header','rf-ce-header');
  const heading=make('div');heading.append(make('small','','CHIEF COMMAND · PRIVATE EDITOR'),make('h2','','キャラクター編集'));heading.querySelector('h2').style.margin='3px 0 0';
  const close=make('button','rf-ce-outline','閉じる');close.type='button';close.addEventListener('click',()=>closePanel());head.append(heading,close);
  const info=make('p','rf-ce-note','変更内容はCloudflare Workerに保存され、全プレイヤーの次回戦闘に反映されます。モデル・画像・役職権限は編集できません。');
  const content=make('div','rf-ce-content');const left=make('aside','rf-ce-list');const right=make('form','rf-ce-form');right.autocomplete='off';right.id='rf-ce-edit-form';right.noValidate=true;
  const search=textInput('',45);search.placeholder='キャラクター名・キーで検索';search.setAttribute('aria-label','キャラクター検索');
  const list=make('div','rf-ce-list-items');left.append(search,list);
  const status=make('div','rf-ce-status','');status.setAttribute('role','status');
  const actions=make('div','rf-ce-actions');
  const save=make('button','rf-ce-primary','変更内容を全員へ保存');save.type='button';
  const reset=make('button','rf-ce-outline','このキャラを初期設定に戻す');reset.type='button';
  const refresh=make('button','rf-ce-outline','サーバーから再読込');refresh.type='button';
  actions.append(save,reset,refresh);content.append(left,right);shell.append(head,info,content,actions,status);root.append(shell);document.body.append(root);
  let selected='',inputs=new Map(),skillInputs=[];
  const tell=(msg,type='')=>{status.textContent=msg;status.dataset.type=type;};
  function select(key){
    if(!FIGHTERS[key])return;selected=key;right.replaceChildren();inputs=new Map();skillInputs=[];
    const d=FIGHTERS[key],base=original(key),ov=activeOverlays[key]||{};
    const title=make('div','rf-ce-char-title');
    const name=make('strong','',d.name||key);const sub=make('small','',key+' · '+(d.special==='chief'?'運営長専用':d.special==='operator'?'運営専用':'キャラクター'));
    title.append(name,sub);right.append(title);
    if(d.face){const img=make('img','rf-ce-portrait');img.alt=d.name||key;img.loading='lazy';img.src=d.face;right.append(img);}
    const listText=make('div','rf-ce-fields');
    for(const [k,label,max] of TEXT_FIELDS){const e=textInput(ov[k]??base[k]??d[k],max);inputs.set(k,{type:'text',label,el:e});listText.append(formGroup(label,e));}
    right.append(make('h3','','基本情報'),listText);
    const listNumber=make('div','rf-ce-fields');
    for(const [k,label,min,max,step] of STAT_FIELDS){const v=ov[k]??base[k]??d[k]??DEFAULT_STAT_VALUES[k]??min;const e=numberInput(v,min,max,step);inputs.set(k,{type:'number',min,max,label,el:e});listNumber.append(formGroup(label,e));}
    right.append(make('h3','','能力値'),listNumber);
    right.append(make('h3','','技・魔法の設定'));
    const skillSection=make('div','rf-ce-skills');
    function addSkills(label,type,index=0){
      const origSpec=type==='skills'?base.skills[index]:base[type];
      const activeSpec=type==='skills'?(ov.skills?.[index]||{}):(ov[type]||{});
      const actualSpec=type==='skills'?d.skills?.[index]:d[type];
      if(!actualSpec||!origSpec)return;
      const group=make('details','rf-ce-skill');const summary=make('summary','',label+' · '+(actualSpec.name||'技'));group.append(summary);
      const fields=make('div','rf-ce-fields');const items=new Map();
      for(const [k,n,kind,min,max] of SKILL_FIELDS){
        if(!(k in origSpec)&&k!=='name')continue;
        const e=kind==='text'?textInput(activeSpec[k]??origSpec[k]??'',max):numberInput(activeSpec[k]??origSpec[k]??min,min,max,.05);
        items.set(k,{type:kind==='text'?'text':'number',min,max,label:n,el:e});fields.append(formGroup(n,e));
      }
      group.append(fields);skillSection.append(group);skillInputs.push({type,index,items});
    }
    for(let i=0;i<(d.skills?.length||0);i++)addSkills('通常技 '+(i+1),'skills',i);
    addSkills('奥義','over');addSkills('秘奥義','hi');right.append(skillSection);
    list.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.key===key));
    tell('編集内容は保存ボタンを押すまで反映されません。');
  }
  function renderList(){
    const q=search.value.toLocaleLowerCase('ja');list.replaceChildren();
    const all=Object.entries(FIGHTERS).filter(([k,d])=>d&&!d.hidden&&((d.name||'').toLocaleLowerCase('ja').includes(q)||k.includes(q))).sort((a,b)=>String(a[1].name).localeCompare(String(b[1].name),'ja'));
    for(const [key,d] of all.slice(0,300)){const b=make('button','rf-ce-character',d.name||key);b.type='button';b.dataset.key=key;b.title=key;b.classList.toggle('active',key===selected);b.addEventListener('click',()=>select(key));list.append(b);}
    if(!all.length)list.append(make('p','rf-ce-note','一致するキャラクターがありません。'));
  }
  search.addEventListener('input',renderList);
  function controlsDisabled(disabled){save.disabled=reset.disabled=refresh.disabled=disabled;}
  async function saveChanges(){
    if(busy)return;
    if(!selected){tell('先に編集するキャラクターを選んでください。','error');return;}
    busy=true;controlsDisabled(true);tell('入力内容を確認しています…');
    const key=selected;
    try{
      if(inBattle())throw Error('戦闘中は編集できません。戦闘終了後に保存してください');
      const patch=rfEditedPatch(key,inputs,skillInputs);
      const all=clone(activeOverlays);
      if(Object.keys(patch).length)all[key]=patch;else delete all[key];
      if(JSON.stringify(all)===JSON.stringify(activeOverlays)){
        tell('変更はありません。入力値はすでに保存済みです。');return;
      }
      const confirmed=await editorConfirm('キャラクター編集を保存しますか？',
        '「'+(FIGHTERS[key]?.name||key)+'」の設定をサーバーに保存し、全プレイヤーの次の戦闘から反映します。',
        '変更を保存する');
      if(!confirmed){tell('保存をキャンセルしました。');return;}
      tell('運営長の権限を確認しています…');
      if(!(await authorized()))throw Error('運営長の認証が必要です。設定から再認証してください');
      tell('サーバーへ保存中…');
      const r=await api('/chief/characters/save',{token:tokenOf(),revision,overrides:all});
      if(!r.ok){
        if(r.error==='stale')throw Error('別の編集が先に保存されました。「サーバーから再読込」を押してからやり直してください');
        if(r.error==='invalid_character_values')throw Error('サーバーが設定値を拒否しました。技の数と入力値、Workerの更新を確認してください');
        if(r.error==='denied')throw Error('運営長の認証が無効です。再認証してください');
        if(r.status===404)throw Error('保存APIが見つかりません。server/worker.jsのデプロイを確認してください');
        throw Error('保存できませんでした（'+(r.error||('HTTP '+r.status))+'）');
      }
      // A successful save must be reported even if the follow-up GET temporarily fails.
      applyPublic(all);revision=Number.isSafeInteger(r.revision)?r.revision:revision+1;lastFetch=0;
      let reloaded=true;
      try{await syncPublic(true);}catch(e){reloaded=false;console.warn('[Character editor] save succeeded, refresh failed:',e);}
      renderList();select(key);
      tell(reloaded?'保存しました。次の戦闘から全プレイヤーに反映されます。':'保存は成功しました。最新データの再読込だけ失敗したため、通信が回復したら再読込してください。','success');
    }catch(err){console.warn('[Character editor] save:',err);tell(err.message||String(err),'error');}
    finally{busy=false;controlsDisabled(false);}
  }
  // Direct click means the UI always responds—even if a browser considers a pre-existing value step-mismatched.
  save.addEventListener('click',()=>{void saveChanges();});
  right.addEventListener('submit',e=>{e.preventDefault();void saveChanges();});
  reset.addEventListener('click',async()=>{
    if(busy)return;
    if(!selected){tell('先にキャラクターを選んでください。','error');return;}
    busy=true;controlsDisabled(true);
    const key=selected;
    try{
      const all=clone(activeOverlays);
      if(!Object.hasOwn(all,key)){tell('このキャラクターには保存済みの変更がありません。');return;}
      const confirmed=await editorConfirm('初期設定に戻しますか？',
        '「'+(FIGHTERS[key]?.name||key)+'」に保存された編集内容を削除し、ゲーム本来の能力値と技へ戻します。',
        '初期設定に戻す',true);
      if(!confirmed){tell('初期化をキャンセルしました。');return;}
      tell('運営長の権限を確認しています…');
      if(!(await authorized()))throw Error('運営長の認証が必要です。設定から再認証してください');
      if(inBattle())throw Error('戦闘中は編集できません。戦闘終了後に実行してください');
      delete all[key];tell('サーバーへ初期化内容を保存中…');
      const r=await api('/chief/characters/save',{token:tokenOf(),revision,overrides:all});
      if(!r.ok)throw Error(r.error==='stale'?'別の編集が先に保存されました。再読込してからやり直してください':'初期化に失敗しました（'+(r.error||r.status)+'）');
      applyPublic(all);revision=Number.isSafeInteger(r.revision)?r.revision:revision+1;lastFetch=0;
      let reloaded=true;
      try{await syncPublic(true);}catch(e){reloaded=false;console.warn('[Character editor] reset succeeded, refresh failed:',e);}
      renderList();select(key);
      tell(reloaded?'初期設定へ戻しました。':'初期設定の保存は成功しましたが、再読込に失敗しました。','success');
    }catch(err){console.warn('[Character editor] reset:',err);tell(err.message||String(err),'error');}
    finally{busy=false;controlsDisabled(false);}
  });
  refresh.addEventListener('click',async()=>{try{await syncPublic(true);renderList();select(selected);tell('最新データを取得しました。','success');}catch(e){tell(e.message,'error');}});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closePanel();}});
  return {root,tell,open:async()=>{root.hidden=false;document.body.classList.add('rf-character-editor-open');try{await syncPublic(true);renderList();select(selected&&FIGHTERS[selected]?selected:Object.keys(FIGHTERS)[0]);}catch(e){tell(e.message,'error');}},close:()=>{root.hidden=true;document.body.classList.remove('rf-character-editor-open');}};
}
function closePanel(){panel?.close();}
export function initChiefCharacterEditor(options){
  if(!options?.FIGHTERS||typeof document==='undefined')return;
  FIGHTERS=options.FIGHTERS;chiefCheck=options.isChief||(()=>false);tokenOf=options.roleToken||(()=> '');inBattle=options.inBattle||(()=>false);
  if(!document.getElementById('rf-chief-editor-css')){const link=document.createElement('link');link.id='rf-chief-editor-css';link.rel='stylesheet';link.href=new URL('./character-editor.css?v='+VERSION,import.meta.url).href;document.head.append(link);}
  recordOriginal();
  const mount=()=>{
    if($('#btn-chief-character-editor'))return;
    const menu=$('#scr-title .portal-services')||$('#scr-title .menu')||$('#scr-title');if(!menu)return;
    const b=make('button','', '');b.type='button';b.id='btn-chief-character-editor';b.hidden=true;
    b.append(make('span','service-icon','✧'),make('b','','キャラクター編集'),make('small','','運営長専用・全戦士の設定'));
    const before=$('#btn-invade');if(before?.parentElement===menu)menu.insertBefore(b,before);else menu.append(b);
    let verifiedToken='';let verified=false,checking=false;
    async function updateVisibility(){
      const tok=tokenOf();if(!apiEnabled()||!chiefCheck()||!tok){b.hidden=true;verified=false;verifiedToken='';if(panel&&!panel.root.hidden)closePanel();return;}
      if(tok===verifiedToken){verified=await authorized();b.hidden=!verified;if(!verified&&panel&&!panel.root.hidden)closePanel();return;}
      if(checking)return;checking=true;
      try{verified=await authorized();verifiedToken=tok;b.hidden=!verified;if(!verified&&panel&&!panel.root.hidden)closePanel();}
      finally{checking=false;}
    }
    b.addEventListener('click',async()=>{if(!(await authorized())){b.hidden=true;return;}panel ||= createPanel();await panel.open();});
    updateVisibility();setInterval(updateVisibility,1700);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  // The public endpoint is read-only. Everyone receives published balancing changes.
  syncPublic(true).catch(e=>console.warn('[Character overrides]',e.message));
  setInterval(()=>{if(!document.hidden)syncPublic().catch(()=>{});},120000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncPublic(true).catch(()=>{});});
}
