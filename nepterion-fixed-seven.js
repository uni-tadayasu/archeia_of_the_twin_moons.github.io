const KEY='nepterion';
const LABELS=[
 ['氷結護陣','CG魔方陣で凍結'],
 ['蒼海防環','防御2倍リング'],
 ['蒼眼凍条','両目青色レーザー'],
 ['乱潮蒼弾','青い光線弾乱射'],
 ['蒼海自癒','青い玉の自動回復'],
 ['剛海巨拳','巨大パンチ'],
 ['海皇穿滅','巨大ドリル']
];
let queue=-1, hud=null, getState=null;
function playable(){
  const s=getState?.();
  if(!s?.battle||s.paused||document.querySelector('.screen.on')) return null;
  return s.battle.fighters?.find(f=>f.key===KEY && f.isPlayer && !f.remoteAuth && !f.dead)||null;
}
function choose(i){
  const f=playable(); if(!f) return;
  if(i<0||i>6) return;
  if(i===6 && (f.awakened<=0 || f.over<100)){ f.battle?.ui?.popup?.(f.pos,'秘奥義は覚醒中・奥義100で使用','#9aefff'); return; }
  queue=i;
}
function makeHud(){
  if(hud||typeof document==='undefined') return;
  const style=document.createElement('style');
  style.id='rf-nep-seven-style-v24';
  style.textContent=`#rf-nep-seven{position:fixed;right:10px;top:88px;width:min(300px,40vw);z-index:9000;pointer-events:auto;background:rgba(5,24,44,.52);backdrop-filter:blur(3px);border:1px solid rgba(112,218,255,.52);border-radius:9px;box-shadow:0 12px 38px #001b32a0;padding:8px;color:#c9f4ff;font-family:system-ui,sans-serif;display:none}#rf-nep-seven header{font-size:11px;letter-spacing:.04em;margin:0 0 6px;color:#8fe3ff}#rf-nep-seven .rf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}#rf-nep-seven button{white-space:normal;min-height:39px;padding:5px 4px;background:linear-gradient(135deg,rgba(18,60,102,.72),rgba(18,72,110,.68));border:1px solid rgba(77,150,200,.64);border-radius:6px;color:white;font:600 11px/1.3 system-ui;cursor:pointer}#rf-nep-seven button:active{background:#328fd1}#rf-nep-seven button small{display:block;color:#a6dffe;font-size:10px;font-weight:400}#rf-nep-seven button[data-index="6"]{background:linear-gradient(125deg,rgba(23,80,173,.72),rgba(109,71,170,.70))}#rf-nep-seven button:disabled{opacity:.45;cursor:not-allowed}@media(max-width:700px){#rf-nep-seven{top:auto;bottom:103px;right:5px;width:min(210px,48vw);padding:5px}#rf-nep-seven header{font-size:10px}#rf-nep-seven button{font-size:10px;min-height:31px;padding:2px}#rf-nep-seven button small{font-size:9px}}`;
  document.head.append(style);
  hud=document.createElement('section'); hud.id='rf-nep-seven'; hud.setAttribute('aria-label','ネプテリオン固定七技');
  const title=document.createElement('header'); title.textContent='ネプテリオン｜7固定コマンド'; hud.append(title);
  const grid=document.createElement('div'); grid.className='rf-grid';
  LABELS.forEach(([name,short],i)=>{
    const button=document.createElement('button'); button.type='button'; button.dataset.index=String(i);
    button.textContent=(i+1)+' · '+name;
    const sub=document.createElement('small');
    sub.textContent = (i===0?'Shift/I・1 · ':i===1?'J/Space・2 · ':i===2?'K/X・3 · ':i===3?'U/V・4 · ':i===4?'H・5 · ':i===5?'L/C・6 · ':'7 · ') + short;
    button.append(sub); button.addEventListener('click',ev=>{ev.preventDefault();choose(i)}); grid.append(button);
  });
  hud.append(grid); document.body.append(hud);
  setInterval(()=>{
    const f=playable(); hud.style.display=f?'block':'none';
    if(f){ const hi=hud.querySelector('[data-index="6"]'); if(hi) hi.disabled=f.awakened<=0||f.over<100; }
  },180);
}
export function installNepterionFixedSeven({ Fighter, FIGHTERS, state }){
  if(!Fighter?.prototype || Fighter.prototype.__rfNepSevenV24) return;
  Fighter.prototype.__rfNepSevenV24=true;
  const spec=FIGHTERS?.[KEY];
  if(spec){
    spec.skills = spec.skills?.slice?.(0,5) || spec.skills;
    delete spec.pool;
    spec.fixedSlots = true;
  }
  getState = typeof state==='function' ? state : ()=>state;
  if(typeof window!=='undefined'){
    window.addEventListener('keydown', e=>{
      if(e.repeat || e.altKey || e.ctrlKey || e.metaKey || !playable()) return;
      if(/^(Digit|Numpad)[1-7]$/.test(e.code)){ choose(Number(e.code.slice(-1))-1); e.preventDefault(); }
    }, true);
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', makeHud, {once:true});
    else makeHud();
  }
  const baseUpdate=Fighter.prototype.update;
  Fighter.prototype.update=function(dt,input){
    if(this.key!==KEY || this.remoteAuth) return baseUpdate.call(this,dt,input);
    const next={...(input||{})};
    if(this.isPlayer && queue>=0){
      next.guard=next.attack=next.skill=next.skill2=next.heal=next.over=false;
      next.skillIdx=null;
      if(queue===0) next.guard=true;
      else if(queue===1) next.attack=true;
      else if(queue===2) next.skill=true;
      else if(queue===3) next.skill2=true;
      else if(queue===4) next.heal=true;
      else { next.over=true; this._rfNepFinisher=queue; }
      queue=-1;
    } else {
      // Preserve standard fixed commands.
      if(next.over) this._rfNepFinisher = 5;
    }
    try { return baseUpdate.call(this,dt,next); }
    finally { if(this.key===KEY && this._rfNepFinisher==null) this._rfNepFinisher=5; }
  };
}
