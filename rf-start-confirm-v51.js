/* RF51 — startup selection, reversible new game, universal high-impact confirmations */
(()=>{
'use strict';
if(window.__rf51ConfirmInstalled)return;
window.__rf51ConfirmInstalled=true;
const SAVE='arkeia-save-v1',BACKUP='rf51-start-backup';
let open=null,bypassStart=false;
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;}
function menu(title,description,actions){
 return new Promise(resolve=>{
  if(open){resolve(null);return;}
  const back=el('div','rf51-overlay'),box=el('section','rf51-panel');
  box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-labelledby','rf51-title');
  const head=el('h2','rf51-title',title);head.id='rf51-title';
  const message=el('p','rf51-message',description);
  const buttons=el('div','rf51-buttons');
  const prev=document.activeElement;
  const done=(id)=>{
   if(open!==back)return;
   document.removeEventListener('keydown',onKey,true);
   back.remove();open=null;
   if(prev?.isConnected)prev.focus({preventScroll:true});
   resolve(id);
  };
  function onKey(ev){
   if(ev.key==='Escape'){ev.preventDefault();ev.stopPropagation();done(null);return;}
   if(ev.key==='Tab'){
    const list=[...buttons.querySelectorAll('button:not([disabled])')];
    const i=list.indexOf(document.activeElement);
    if(ev.shiftKey&&i<=0){ev.preventDefault();list[list.length-1]?.focus();}
    if(!ev.shiftKey&&i===list.length-1){ev.preventDefault();list[0]?.focus();}
   }
  }
  for(const action of actions){
   const b=el('button','rf51-option'+(action.danger?' rf51-danger':'')+(action.primary?' rf51-primary':''),action.label);
   b.type='button';b.disabled=!!action.disabled;b.addEventListener('click',()=>done(action.id));
   buttons.append(b);
  }
  const x=el('button','rf51-close','×');x.type='button';x.setAttribute('aria-label','閉じる');x.addEventListener('click',()=>done(null));
  box.append(x,head,message,buttons);back.append(box);document.body.append(back);open=back;
  document.addEventListener('keydown',onKey,true);
  const first=buttons.querySelector('.rf51-primary:not([disabled])')||buttons.querySelector('button:not([disabled])');
  first?.focus({preventScroll:true});
 });
}
window.rf51Confirm=async(title,text,yes='実行する')=>await menu(title,text,[
 {id:'cancel',label:'戻る',primary:true},{id:'ok',label:yes,danger:true}
])==='ok';
function record(){
 const snapshot={};for(let i=0;i<localStorage.length;i++){
  const k=localStorage.key(i);if(k===SAVE||k==='arkeia-sync'||k.startsWith('arkeia-sync-'))snapshot[k]=localStorage.getItem(k);
 }
 return snapshot;
}
function clearProgress(){
 const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k===SAVE||k==='arkeia-sync'||k.startsWith('arkeia-sync-'))keys.push(k);}
 keys.forEach(k=>localStorage.removeItem(k));
}
function isPress(){return document.getElementById('scr-press')?.classList.contains('on');}
function continueGame(){
 bypassStart=true;
 try{document.getElementById('press-start')?.click();}
 finally{bypassStart=false;}
}
async function chooseStart(){
 if(open||!isPress())return;
 let hasSave=false,hasBackup=false;
 try{hasSave=!!localStorage.getItem(SAVE);hasBackup=!!localStorage.getItem(BACKUP);}catch{}
 const decision=await menu('冒険の開始方法',hasSave?
  '現在のセーブを引き継ぐか、バックアップを残して新しい冒険を始めるか選んでください。':
  '新しい冒険を始めます。以前のセーブがあればバックアップから復元できます。',[
 {id:'continue',label:hasSave?'続きからプレイ':'ゲームを始める',primary:true},
 {id:'new',label:'最初からプレイ',danger:hasSave},
 {id:'restore',label:'前のセーブを復元',disabled:!hasBackup},
 {id:'cancel',label:'タイトルへ戻る'}
 ]);
 if(decision==='continue'){continueGame();return;}
 if(decision==='new'){
  const ok=await window.rf51Confirm('新しい冒険を開始','現在の端末セーブと同期設定をバックアップしてから、新しい冒険を始めます。既存のオンラインデータは消去しません。ほかのゲームタブは閉じてください。','バックアップして開始');
  if(!ok)return;
  try{
   const snap=record();
   localStorage.setItem(BACKUP,JSON.stringify({snapshot:snap,at:Date.now()}));
   // Only reset local save/sync keys; server-side accounts and balances stay untouched.
   clearProgress();location.reload();
  }catch(e){await menu('保存できませんでした',String(e?.message||e),[{id:'close',label:'閉じる',primary:true}]);}
  return;
 }
 if(decision==='restore'){
  const ok=await window.rf51Confirm('セーブデータの復元','バックアップの進行データと同期設定を復元します。現在の端末のデータを置き換えます。','復元する');
  if(!ok)return;
  try{
   const saved=JSON.parse(localStorage.getItem(BACKUP)||'null');
   if(!saved?.snapshot||typeof saved.snapshot!=='object')throw Error('バックアップがありません。');
   const current=record();
   localStorage.setItem('rf51-current-before-restore',JSON.stringify({snapshot:current,at:Date.now()}));
   clearProgress();
   for(const [k,v]of Object.entries(saved.snapshot))if(typeof v==='string')localStorage.setItem(k,v);
   location.reload();
  }catch(e){await menu('復元できませんでした',String(e?.message||e),[{id:'close',label:'閉じる',primary:true}]);}
 }
}
document.addEventListener('pointerdown',ev=>{
 if(!isPress()||!ev.target.closest('#scr-press')||bypassStart)return;
 ev.preventDefault();ev.stopImmediatePropagation();void chooseStart();
},true);
document.addEventListener('keydown',ev=>{
 if(isPress()&&!open&&!bypassStart&&['Enter',' ','Spacebar'].includes(ev.key)){
  ev.preventDefault();ev.stopImmediatePropagation();void chooseStart();
 }
},true);
function riskyButton(button){
 if(button.closest('#rf51-overlay,#scr-castle,#mailbox-dialog'))return null;
 if(button.dataset.rf51Confirmed==='skip')return null;
 const id=button.id||'';
 const label=String(button.textContent||button.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim().slice(0,100);
 if(id==='btn-quit')return {title:'戦闘から離脱しますか？',message:'戦闘を終了してメニューへ戻ります。'};
 if(/^(?:[ぁ-ん]*)(?:購入(?:する)?|買う|一括強化|強化(?:する)?|限界突破|寄付(?:する)?|追放|退会|解散|売却|破棄|削除|初期化|リセット|送信(?:する)?|返金|キャンセル確定)/.test(label)&&!/(購入済|確認済|購入履歴)/.test(label))
  return {title:'この操作を実行しますか？',message:'「'+label+'」を実行します。灯晶・所持品・共有データに影響する場合があります。'};
 if(/(?:delete|remove|kick|disband|reset|refund|purchase|buy|donate|send-all)/i.test(id))
  return {title:'重要な操作の確認',message:'「'+(label||id)+'」を実行します。内容を確認してください。'};
 return null;
}
const bypass=new WeakSet();
document.addEventListener('click',ev=>{
 if(!ev.isTrusted)return;
 const btn=ev.target.closest?.('button,input[type=submit],[role=button]');
 if(!btn||bypass.has(btn))return;
 if(isPress()&&btn.closest('#scr-press')&&!bypassStart){
  ev.preventDefault();ev.stopImmediatePropagation();void chooseStart();return;
 }
 const risk=riskyButton(btn);
 if(!risk)return;
 ev.preventDefault();ev.stopImmediatePropagation();
 void window.rf51Confirm(risk.title,risk.message,'実行する').then(ok=>{
  if(!ok||!btn.isConnected)return;
  bypass.add(btn);
  try{btn.click();}finally{bypass.delete(btn);}
 });
},true);
})();