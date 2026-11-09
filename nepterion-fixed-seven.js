// RF_NEPT_SEVEN_FIXED_V17
// 5 named spells + separate Over + separate Hi = exactly seven fixed commands.
// J/Space/guard are not counted as spells; guard's 30-second circle remains intact.
const KEY='nepterion';
const LABELS=[
 ['蒼帝海刃','アクア・レギオン'],
 ['蒼潮瞬穿','タイダル・ブレイカー'],
 ['海神圧界','アビス・インパクト'],
 ['零式禁水呪','深淵千海葬'],
 ['聖潮再生','エターナル・オーシャン'],
 ['神海終極魔法','ワールド・オーシャン'],
 ['超越創世水魔法','エターナル・アビス・ゼロ']
];
let queue=-1, hud=null, getState=null;
function playable(){
 const s=getState?.();
 if(!s?.battle||s.paused||document.querySelector('.screen.on'))return null;
 return s.battle.fighters?.find(f=>f.key===KEY && f.isPlayer && !f.remoteAuth && !f.dead)||null;
}
function choose(i){
 const f=playable();if(!f)return;
 if(i<0||i>6)return;
 if(i===6 && (f.awakened<=0 || f.over<100)){
   f.battle?.ui?.popup?.(f.pos,'秘奥義は覚醒中・奥義100で使用','#9aefff');return;
 }
 queue=i;
}
function makeHud(){
 if(hud||typeof document==='undefined')return;
 const style=document.createElement('style');
 style.id='rf-nep-seven-style-v17';
 style.textContent=`#rf-nep-seven{position:fixed;right:10px;top:88px;width:min(290px,39vw);z-index:9000;pointer-events:auto;background:rgba(5,24,44,.89);border:1px solid #70daff;border-radius:9px;box-shadow:0 12px 38px #001b32c9;padding:8px;color:#c9f4ff;font-family:system-ui,sans-serif;display:none}#rf-nep-seven header{font-size:11px;letter-spacing:.04em;margin:0 0 6px;color:#8fe3ff}#rf-nep-seven .rf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}#rf-nep-seven button{white-space:normal;min-height:39px;padding:5px 4px;background:linear-gradient(135deg,#123c66,#12486e);border:1px solid #4d96c8;border-radius:6px;color:white;font:600 11px/1.3 system-ui;cursor:pointer}#rf-nep-seven button:active{background:#328fd1}#rf-nep-seven button small{display:block;color:#a6dffe;font-size:10px;font-weight:400}#rf-nep-seven button[data-index="6"]{background:linear-gradient(125deg,#1750ad,#6d47aa)}#rf-nep-seven button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:700px){#rf-nep-seven{top:auto;bottom:103px;right:5px;width:min(210px,48vw);padding:5px}#rf-nep-seven header{font-size:10px}#rf-nep-seven button{font-size:10px;min-height:31px;padding:2px}#rf-nep-seven button small{font-size:9px}}`;
 document.head.append(style);
 hud=document.createElement('section');hud.id='rf-nep-seven';hud.setAttribute('aria-label','ネプテリオン固定七技');
 const title=document.createElement('header');title.textContent='水神術式｜7固定コマンド（Shift/I＝氷結護陣）';hud.append(title);
 const grid=document.createElement('div');grid.className='rf-grid';
 LABELS.forEach(([name,short],i)=>{
  const button=document.createElement('button');button.type='button';button.dataset.index=String(i);
  button.textContent=(i+1)+' · '+name;
  const sub=document.createElement('small');sub.textContent=(i===0?'K/X · ':i===1?'U/V · ':i===4?'H · ':i===5?'L/C · ':'')+short;
  button.append(sub);button.addEventListener('click',ev=>{ev.preventDefault();choose(i)});
  grid.append(button);
 });
 hud.append(grid);document.body.append(hud);
 setInterval(()=>{
   const f=playable();hud.style.display=f?'block':'none';
   if(f){const hi=hud.querySelector('[data-index="6"]');hi.disabled=f.awakened<=0||f.over<100;}
 },180);
}
export function installNepterionFixedSeven({Fighter,FIGHTERS,state}){
 if(!Fighter?.prototype||Fighter.prototype.__rfNepSevenV17)return;
 Fighter.prototype.__rfNepSevenV17=true;
 const spec=FIGHTERS?.[KEY];
 if(spec){
   // The original 11-spell rotating pool was what made K/U change techniques.
   // Keep the first five (including fixed slot 4 healing) and both finishers.
   spec.skills=spec.skills.slice(0,5);
   delete spec.pool;
   spec.fixedSlots=true;
 }
 getState=typeof state==='function'?state:()=>state;
 if(typeof window!=='undefined'){
   window.addEventListener('keydown', e=>{
     if(e.repeat || e.altKey || e.ctrlKey || e.metaKey || !playable())return;
     if(/^(Digit|Numpad)[1-7]$/.test(e.code)){
       const n=Number(e.code.slice(-1))-1;
       choose(n);e.preventDefault();
     }
   },true);
   if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',makeHud,{once:true});
   else makeHud();
 }
 const baseSkill=Fighter.prototype.startSkill;
 Fighter.prototype.startSkill=function(i,hold,...rest){
   // Avoid randomized hold-to-follow for the seven fixed commands.
   if(this.key===KEY && hold==='cpu')hold=null;
   return baseSkill.call(this,i,hold,...rest);
 };
 const baseOver=Fighter.prototype.startOver;
 Fighter.prototype.startOver=function(...args){
   if(this.key!==KEY)return baseOver.apply(this,args);
   if(this.over<100||this.dead)return;
   const slot=this._rfNepFinisher===6?'hi':'over';
   if(slot==='hi' && this.awakened<=0){this.battle.ui?.popup?.(this.pos,'秘奥義：覚醒状態が必要','#6adfff');return;}
   this.over=0;
   this.faceNearest(14);
   this.battle.cast(this,slot);
 };
 const baseUpdate=Fighter.prototype.update;
 Fighter.prototype.update=function(dt,input){
   if(this.key!==KEY || this.remoteAuth)return baseUpdate.call(this,dt,input);
   // Existing K/U/H/L controls are remapped to fixed slots, independent of movement.
   const next={...(input||{})};
   const wanted=(this.isPlayer&&queue>=0)?queue:(next.skill?0:next.skill2?1:next.heal?4:next.over?5:-1);
   if(wanted>=0){
     if(this.isPlayer && queue>=0)queue=-1;
     next.skill=next.skill2=next.heal=next.over=false;
     if(wanted<=4){next.skillIdx=wanted;}
     else{next.over=true;this._rfNepFinisher=wanted;}
   }
   try{return baseUpdate.call(this,dt,next)}
   finally{this._rfNepFinisher=5;}
 };
}
