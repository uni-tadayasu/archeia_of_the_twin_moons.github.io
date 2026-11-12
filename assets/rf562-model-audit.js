/* RF562: on-demand readable roster/appearance audit. No save mutations. */
import {FIGHTERS,ROSTER} from '../data.js?v=rf-minamoto-v48-20261111';
import {assignUniqueAppearances} from '../appearance-data.js';
(()=>{
 'use strict';
 if(window.__rf562AuditReady)return;
 window.__rf562AuditReady=true;
 const $=s=>document.querySelector(s);
 function audit(){
  const roster=ROSTER.filter(k=>FIGHTERS[k]);
  const count=new Map(),variants=[];const ids=new Set();let noModel=0;
  for(const key of roster){
   const d=FIGHTERS[key];if(!d.model)noModel++;
   const src=(d.model||'').split(/[?#]/)[0];count.set(src,(count.get(src)||0)+1);
   if(d.appearance?.id){variants.push(key);ids.add(d.appearance.id)}
  }
  const shared=[...count].filter(([,n])=>n>1).map(([name,n])=>({source:name,count:n}));
  return {roster:roster.length,baseModels:count.size,variantRecords:variants.length,uniqueVariantIDs:ids.size,missingModels:noModel,sharedSources:shared};
 }
 function ui(){
  const host=$('#scr-options .inner');if(!host||$('#rf562-model-audit'))return;
  const box=document.createElement('div');box.id='rf562-model-audit';box.style.cssText='display:flex;flex-direction:column;gap:8px;padding:12px 16px;margin-top:12px;border:1px solid rgba(155,194,233,.25);border-radius:12px;background:rgba(10,20,34,.7);color:#e9f4ff;max-width:100%';
  const heading=document.createElement('strong');heading.textContent='一般キャラクター外見チェック';
  const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='人数・外見データを点検';button.style.cssText='max-width:360px;min-height:42px';
  const retry=document.createElement('button');retry.type='button';retry.className='btn ghost';retry.textContent='モデル画像を再読み込み';retry.style.cssText='max-width:360px;min-height:42px';
  const text=document.createElement('small');text.id='rf562-audit-output';text.setAttribute('aria-live','polite');text.textContent='必要な場合だけ点検できます。全GLBの読み込みは行いません。';
  button.addEventListener('click',()=>{const r=audit();text.textContent=`一般キャラ ${r.roster}人 / 基本GLB ${r.baseModels}種 / 固有外見データ ${r.variantRecords}件（ID重複 ${r.variantRecords-r.uniqueVariantIDs}件） / モデル未指定 ${r.missingModels}件。基本GLBは共有しています。`;});
  retry.addEventListener('click',()=>{window.RF556Portraits?.retryFailed?.();text.textContent='失敗した選択画像の再取得を指示しました。キャラクター選択画面へ戻ってください。';});
  box.append(heading,button,retry,text);host.append(box);
 }
 function boot(){ui();window.RF562Audit={check:audit,retry:()=>window.RF556Portraits?.retryFailed?.()}}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
