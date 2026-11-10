// V39 藤原信頼・運営長専用出力調整
export function installFujiwaraChief({Fighter,Battle,isChief,state}){
 const key='rf39_fujiwara_strength';
 const chief=()=>{try{return !!isChief();}catch{return false;}};
 const value=()=>Math.max(0,Math.min(100,Number(localStorage.getItem(key)??100)));
 const original=Battle.prototype.applyHit;
 Battle.prototype.applyHit=function(attacker,target,damage,...args){
  if(attacker?.key==='fujiwara_nobuyori'&&!attacker.remoteAuth){
   damage=Math.max(0,Math.round((Number(damage)||0)*(chief()?value():100)/100));
   if(!damage)return false;
  }
  return original.call(this,attacker,target,damage,...args);
 };
 const render=()=>{
  const host=document.querySelector('#scr-options .inner');if(!host)return;
  let section=document.querySelector('#rf39-fujiwara-admin');
  if(!section){
   section=document.createElement('section');section.id='rf39-fujiwara-admin';
   section.style.cssText='margin:20px 0;padding:15px;border:2px solid #bca2e6;border-radius:12px;background:#201936;color:#fff';
   section.innerHTML='<h3>藤原信頼・運営長専用設定</h3><p>強さ（攻撃ダメージ）を5段階で調整します。</p><div id="rf39-strength"></div><p id="rf39-selected"></p><button type="button" id="rf39-max">強化と限界突破を最大化</button><p id="rf39-msg" style="font-size:12px">セーブデータの形式に一致する項目だけを変更します。</p>';
   host.appendChild(section);
   for(const percent of [100,75,50,25,0]){
    const b=document.createElement('button');b.type='button';b.textContent=percent+'%';
    b.style.cssText='margin:3px;padding:8px;border-radius:5px';
    b.onclick=()=>{if(!chief())return;localStorage.setItem(key,String(percent));document.querySelector('#rf39-selected').textContent='出力：'+percent+'%';};
    section.querySelector('#rf39-strength').appendChild(b);
   }
   section.querySelector('#rf39-max').onclick=()=>{
    if(!chief())return;
    const s=state?.()||{},save=s.save||s.playerSave||s.profile||{};
    let count=0;
    for(const group of [save.fighters,save.characters,save.units,save.heroes,save.upgrades,save.enhancements]){
     const obj=group?.fujiwara_nobuyori;if(!obj||typeof obj!=='object')continue;
     for(const [k,v] of Object.entries(obj)){
      if(typeof v==='number'&&/limit|break|突破/i.test(k)){obj[k]=Math.max(v,10);count++;}
      else if(typeof v==='number'&&/upgrade|enhance|forge|強化/i.test(k)){obj[k]=Math.max(v,55);count++;}
      else if(v&&typeof v==='object'&&/upgrade|enhance|forge|強化/i.test(k)){for(const [kk,vv] of Object.entries(v)){if(typeof vv==='number'){v[kk]=Math.max(55,vv);count++;}}}
     }
    }
    section.querySelector('#rf39-msg').textContent=count?'対応する '+count+' 項目を更新しました。通常のセーブ操作を行ってください。':'既存セーブ構造が未対応のため、安全のため最大化は未適用です。';
   };
  }
  section.hidden=!chief();
  const x=section.querySelector('#rf39-selected');if(x)x.textContent='出力：'+value()+'%';
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
 setInterval(render,1500);
}