// RF_NEPTERION_FIXED_BOOK_V26 — replaces the old seven-command rotation.
// Preserve the exported function name for compatibility with existing main.js.
const KEY='nepterion';
const ITEMS=[
 ['氷界魔法陣','Shift / I','guard'],
 ['潮刃・零斬','J / Z','attack'],
 ['蒼眼双流','K / 1','s0'],
 ['氷河星群','U / 2','s1'],
 ['命潮再生','H / 3','s2'],
 ['大海嘯','4','s3'],
 ['万象水護','5','s4'],
 ['深淵渦葬','6','s5'],
 ['蒼龍水槍','7','s6'],
 ['絶対氷縛','8','s7'],
 ['氷晶星雨','9','s8'],
 ['海皇天瀑','F','s9'],
 ['水神裂界','G','s10'],
 ['万海終式','T','s11'],
 ['覇海終極・奥義','L / 0','over'],
 ['創世絶海・秘奥義','B','hi']
];
let getState=null,queued=null,holder=null,panel=null,button=null;
function playable(){const s=getState?.();if(!s?.battle||s.paused||document.querySelector('.screen.on'))return null;
  return s.battle.fighters?.find(f=>f.key===KEY&&f.isPlayer&&!f.remoteAuth&&!f.dead)||null;}
function choose(id){const f=playable();if(!f)return;
  if(id==='hi' && (f.awakened<=0 || f.over<100)){f.battle.ui?.popup?.(f.pos,'秘奥義は覚醒中・奥義100で使用','#91eaff');return;}
  queued=id;
}
function buildHUD(){if(typeof document==='undefined'||holder)return;
  const style=document.createElement('style');style.id='rf-nep-v26-ui';
  style.textContent=`#rf-nep-v26-launch{position:fixed;right:max(6px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));z-index:8950;border:1px solid #8deaff;color:#f0faff;border-radius:22px;background:rgba(11,49,76,.52);backdrop-filter:blur(5px);padding:7px 13px;font:700 12px system-ui;pointer-events:auto;cursor:pointer}#rf-nep-v26{position:fixed;right:max(8px,env(safe-area-inset-right));top:max(72px,calc(env(safe-area-inset-top) + 64px));z-index:8949;width:min(360px,calc(100vw - 16px));max-height:min(64dvh,580px);overflow:auto;box-sizing:border-box;background:rgba(8,35,57,.58);backdrop-filter:blur(6px);border:1px solid rgba(109,225,255,.65);color:#e5f9ff;border-radius:10px;box-shadow:0 12px 28px #06162399;padding:8px;font:11px/1.45 system-ui;pointer-events:auto}#rf-nep-v26[hidden],#rf-nep-v26-launch[hidden]{display:none!important}#rf-nep-v26 .rfn-heading{margin:2px 0 8px;font-weight:800;font-size:13px;letter-spacing:.03em}#rf-nep-v26 .rfn-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}#rf-nep-v26 button{min-width:0;min-height:43px;padding:4px 5px;border:1px solid #85bedc90;border-radius:6px;background:#143e6680;color:#f4faff;font:700 11px/1.3 system-ui;cursor:pointer;overflow-wrap:anywhere}#rf-nep-v26 button small{display:block;font:400 10px system-ui;color:#a7e5ff;margin-top:2px}#rf-nep-v26 button:disabled{opacity:.38}@media(max-width:650px){#rf-nep-v26{top:max(55px,calc(env(safe-area-inset-top) + 40px));right:5px;width:min(280px,72vw);max-height:46dvh}#rf-nep-v26 button{min-height:36px;font-size:10px}#rf-nep-v26 button small{font-size:9px}#rf-nep-v26-launch{top:max(35px,calc(env(safe-area-inset-top) + 24px));bottom:auto;right:5px}}body:has(#chat-panel:not([hidden])) #rf-nep-v26,body:has(#chat-panel:not([hidden])) #rf-nep-v26-launch{display:none!important}`;
  document.head.append(style);
  holder=document.createElement('div');
  button=document.createElement('button');button.type='button';button.id='rf-nep-v26-launch';button.textContent='水術・16';button.hidden=true;
  panel=document.createElement('section');panel.id='rf-nep-v26';panel.hidden=true;panel.setAttribute('aria-label','ネプテリオン固定水術');
  const h=document.createElement('div');h.className='rfn-heading';h.textContent='蒼海神皇｜最高位水術・固定16コマンド';panel.append(h);
  const grid=document.createElement('div');grid.className='rfn-grid';
  for(const [label,key,id] of ITEMS){const b=document.createElement('button');b.type='button';b.textContent=label;
    const s=document.createElement('small');s.textContent=key;b.append(s);b.dataset.spell=id;
    b.addEventListener('click',()=>{choose(id);panel.hidden=true;});grid.append(b);}
  panel.append(grid);holder.append(button,panel);document.body.append(holder);
  button.addEventListener('click',()=>{panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));});
  setInterval(()=>{const f=playable();button.hidden=!f;if(!f)panel.hidden=true;
    if(f)panel.querySelector('[data-spell="hi"]').disabled=f.awakened<=0||f.over<100;
  },220);
}
export function installNepterionFixedSeven({Fighter,FIGHTERS,state}){
  if(!Fighter?.prototype||Fighter.prototype.__rfNepFixedV26)return;
  Fighter.prototype.__rfNepFixedV26=true;
  getState=typeof state==='function'?state:()=>state;
  if(FIGHTERS?.[KEY]){delete FIGHTERS[KEY].pool;FIGHTERS[KEY].fixedSlots=true;}
  if(typeof window!=='undefined'){
    const keys={Digit0:'over',Numpad0:'over',KeyF:'s9',KeyG:'s10',KeyT:'s11',KeyB:'hi'};
    for(let i=1;i<=9;i++){keys['Digit'+i]='s'+(i-1);keys['Numpad'+i]='s'+(i-1);}
    window.addEventListener('keydown',e=>{if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||!playable())return;
      if(document.activeElement?.matches?.('input,textarea,select,[contenteditable]'))return;
      const id=keys[e.code];if(id){e.preventDefault();choose(id);}
    },true);
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildHUD,{once:true});else buildHUD();
  }
  const baseSkill=Fighter.prototype.startSkill;
  Fighter.prototype.startSkill=function(i,hold,follow){
    if(this.key===KEY)return baseSkill.call(this,i,null,false); // no changing spells on long hold
    return baseSkill.call(this,i,hold,follow);
  };
  const baseUpdate=Fighter.prototype.update;
  Fighter.prototype.update=function(dt,input){
    if(this.key!==KEY||this.remoteAuth)return baseUpdate.call(this,dt,input);
    const next={...(input||{})};let chosen=null;
    if(this.isPlayer&&queued!==null){chosen=queued;queued=null;}
    else if(next.skill)chosen='s0';
    else if(next.skill2)chosen='s1';
    else if(next.heal)chosen='s2';
    else if(next.over)chosen='over';
    if(chosen!==null){
      next.guard=next.attack=next.skill=next.skill2=next.heal=next.over=false;
      next.skillIdx=null;
      if(chosen==='guard')next.guard=true;
      else if(chosen==='attack')next.attack=true;
      else if(chosen==='over'||chosen==='hi'){this._rfNepFinisher=chosen;next.over=true;}
      else if(/^s(?:[0-9]|1[01])$/.test(chosen))next.skillIdx=Number(chosen.slice(1));
    }
    try{return baseUpdate.call(this,dt,next);}finally{this._rfNepFinisher=null;}
  };
}
