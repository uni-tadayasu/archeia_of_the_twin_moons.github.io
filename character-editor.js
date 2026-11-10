// RF_CHIEF_CHAR_EDITOR_V32_BULK_TEMPLATES — reliable save, accessible in-game confirmation.
// All mutations are authorized again on the server. No local-only admin fallback.
import { api, apiEnabled, verifyToken } from './api.js';

const VERSION='rf-chief-editor-v32-20261110';
const SKILL_FIELDS=[
 ['name','技・魔法名','text',0,42],['kind','技の種類','select',0,0],
 ['visual','CG・立体演出の種類','select',0,0],['elem','技の属性','select',0,9],['color','魔法色','color',0,0xffffff],
 ['dmg','威力','number',0,100000],['cost','消費灯力','number',0,100],
 ['radius','攻撃・効果範囲','number',0.1,100],['castTime','詠唱秒数','number',0,30],
 ['speed','弾速・突進速度','number',1,150],['dur','突進時間（秒）','number',0.05,10],
 ['count','弾数・落下回数','number',1,24],['spread','散布半径','number',0,40],
 ['spreadAng','弾の広がり（ラジアン）','number',0,3.14],
 ['delay','落下開始まで（秒）','number',0,10],['interval','攻撃間隔（秒）','number',0.01,3],
 ['chain','連続発射間隔（秒）','number',0,1],['trail','軌跡の間隔（秒）','number',0.01,1],
 ['heal','回復量','number',0,100000],
 ['stun','怯み時間（秒）','number',0,5],['kb','吹き飛ばし','number',0,30],
 ['shape','エフェクト形状番号','number',0,99],
 ['finalDmg','締めの一撃の威力','number',0,100000],['finalRadius','締めの一撃の範囲','number',0.1,100],
 ['double','衝撃波を二重発動','checkbox',0,1]
];
const SKILL_TYPES=[
 ['projectile','飛び道具・魔力弾'],['shockwave','衝撃波・周囲攻撃'],
 ['dash','突進・斬り抜け'],['rain','範囲降下・魔法雨'],
 ['judgment','多段魔法＋最終爆発'],['implode','吸引・爆発'],['heal','回復魔法']
];
const SKILL_KINDS=new Set(SKILL_TYPES.map(([id])=>id));
const ELEMENTS=[
 ['炎',0,0xff6535],['氷',1,0x51d6ff],['雷',2,0xffe55d],['風',3,0x58e8ab],
 ['地',4,0xc8a16e],['光',5,0xffd877],['闇',6,0xb77aff],['水',7,0x458cff],
 ['毒',8,0x9cdb56],['血',9,0xe65d78]
];
const VISUALS=[['orb','魔力球'],['spear','魔法槍'],['laser','光線'],['meteor','巨大隕石・水塊'],
 ['blade','斬撃'],['sword','剣'],['nova','大爆発'],['pillar','魔法柱'],['bigsword','巨大剣'],['bolt','稲妻']];
const KINDS_DESCRIPTION={
 projectile:'前方へ飛ぶ弾。弾速・弾数・広がり角を設定します。',
 shockwave:'自分を中心に広がる衝撃波。',
 dash:'移動しながら攻撃する技。速度・突進時間を指定します。',
 rain:'相手の周囲へ落下する魔法。発数・散布半径・間隔を設定します。',
 judgment:'連続落下と大爆発の多段魔法。',
 implode:'相手を中心へ吸引し、最後に爆発します。',
 heal:'周囲の味方への回復魔法。ダメージ値は使用しません。'
};
const TYPE_FIELDS={
 projectile:['dmg','cost','castTime','radius','count','speed','spreadAng','chain','trail','stun','kb','shape'],
 shockwave:['dmg','cost','castTime','radius','stun','kb','shape','double'],
 dash:['dmg','cost','castTime','speed','dur','stun','kb','shape'],
 rain:['dmg','cost','castTime','radius','count','spread','delay','interval','stun','shape'],
 judgment:['dmg','cost','castTime','radius','count','spread','delay','interval','finalDmg','finalRadius','stun','shape'],
 implode:['dmg','cost','castTime','radius','stun','kb','shape'],
 heal:['cost','castTime','radius','heal','shape']
};
const TYPE_DEFAULTS={
 projectile:{dmg:94,cost:12,castTime:0.35,radius:1.1,count:1,speed:27,spreadAng:0.08,chain:0.05,trail:0.05,stun:0.3,kb:3,shape:1},
 shockwave:{dmg:115,cost:18,castTime:0.55,radius:4,stun:0.4,kb:4,shape:2,double:false},
 dash:{dmg:120,cost:15,castTime:0.28,speed:20,dur:0.45,stun:0.5,kb:5,shape:3},
 rain:{dmg:60,cost:22,castTime:0.75,radius:2,count:7,spread:4,delay:0.2,interval:0.12,stun:0.15,shape:4},
 judgment:{dmg:63,cost:28,castTime:1.2,radius:2,count:8,spread:5,delay:0.2,interval:0.1,finalDmg:310,finalRadius:6,stun:0.2,shape:5},
 implode:{dmg:185,cost:25,castTime:0.95,radius:5,stun:0.6,kb:5,shape:6},
 heal:{cost:18,castTime:0.62,radius:5,heal:185,shape:7}
};
const STAT_FIELDS=[
 ['hp','最大HP',1,200000,1],['speed','移動速度',.1,30,.05],
 ['power','攻撃倍率',.1,20,.01],['armor','被ダメージ倍率',.01,5,.01],
 ['height','表示身長',.1,12,.05],['overGain','奥義蓄積倍率',.1,12,.05],
 ['fluxMul','灯力回復倍率',.1,12,.05]
];
const TEXT_FIELDS=[['name','キャラクター名',40],['title','肩書き',90],['attribute','属性',16]];
const FIELDS=new Set([...STAT_FIELDS.map(v=>v[0]),...TEXT_FIELDS.map(v=>v[0])]);
const DEFAULT_STAT_VALUES=Object.freeze({hp:1000,speed:5,power:1,armor:1,height:1.8,overGain:1,fluxMul:1});
const SKILL_KEYS=new Set(SKILL_FIELDS.map(v=>v[0]));
const SLOT_MAX=24;
const TIERS={
 normal:{label:'一般',hp:[800,1600],speed:[4.7,7.2],power:[.85,1.14],armor:[.86,1.18],height:[1.65,3.7],overGain:[.8,1.3],fluxMul:[.9,1.28],slots:[3,5],strength:1},
 minion:{label:'雑魚敵',hp:[320,750],speed:[3.5,6.5],power:[.6,.9],armor:[1.08,1.55],height:[1.4,3],overGain:[.6,1.05],fluxMul:[.6,1],slots:[1,3],strength:.75},
 small:{label:'小ボス',hp:[1400,2800],speed:[4.1,7.3],power:[.94,1.23],armor:[.75,1.02],height:[2,3.7],overGain:[.9,1.4],fluxMul:[.95,1.45],slots:[3,5],strength:1.18},
 middle:{label:'中ボス',hp:[2900,5800],speed:[4.3,7.3],power:[1.03,1.36],armor:[.66,.92],height:[2,4],overGain:[1,1.6],fluxMul:[1.02,1.6],slots:[4,7],strength:1.46},
 great:{label:'大ボス',hp:[6400,12600],speed:[4.4,7.6],power:[1.17,1.56],armor:[.54,.79],height:[2.3,4.7],overGain:[1.12,1.7],fluxMul:[1.12,1.7],slots:[6,10],strength:1.85},
 final:{label:'ラスボス',hp:[13000,27000],speed:[4.8,8],power:[1.34,1.8],armor:[.4,.65],height:[2.8,5.4],overGain:[1.25,1.9],fluxMul:[1.2,1.9],slots:[8,12],strength:2.2}
};
const random=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[Math.floor(Math.random()*a.length)];
const round=(v,n=2)=>+v.toFixed(n);
const ENGLISH_KIND={projectile:'魔弾',shockwave:'震界',dash:'閃駆',rain:'星雨',judgment:'審判',implode:'渦牢',heal:'聖癒'};
const NAME_HEAD=['天領','黄昏','悠久','双月','幻界','神代','白夜','深淵','暁光','久遠','蒼天','幽玄','銀嶺','深緑'];
const NAME_TAIL=['の守人','の王','の旅人','の戦士','の術師','の竜','の騎士','の巨人','の公卿','の精霊'];
const MAGIC_HEAD=['蒼皇','神代','天刃','極光','終極','深淵','久遠','無双','双月','星界','覇王','翠光'];
const MAGIC_TAIL=['轟裂','奏鳴','天穿','極葬','輪廻','凶刃','陣界','絶唱','瀑流','降臨'];
const KEEP_KIND='__rf_keep_kind__';
function chooseEffect(element,kind){
 const v={projectile:'orb',shockwave:'nova',dash:'blade',rain:'meteor',judgment:'pillar',implode:'orb',heal:'orb'};
 if(kind==='projectile'&&element?.[0]==='雷')return 'laser';
 return v[kind]||'orb';
}
function generatedSkill(element,kind,tier,slot,type='skills'){
 const d=TYPE_DEFAULTS[kind]||TYPE_DEFAULTS.projectile;
 const base=round(tier.strength*random(.84,1.18),2);
 const elem=element?.[1]??0;
 const spec={...d,name:pick(MAGIC_HEAD)+(element?.[0]||'天')+ENGLISH_KIND[kind]+pick(MAGIC_TAIL),kind,
   elem,color:element?.[2]||0x7ecfff,visual:chooseEffect(element,kind),shape:Math.floor(random(0,24))};
 const scale=type==='hi'?base*3.0:type==='over'?base*2.1:base;
 if(kind==='heal')spec.heal=Math.round(165*scale);
 else spec.dmg=Math.round((d.dmg||92)*scale);
 if(kind==='judgment')spec.finalDmg=Math.round(280*scale);
 spec.cost=type==='skills'?Math.min(96,Math.round((d.cost||15)*random(.85,1.2))):0;
 spec.castTime=round((d.castTime||.5)*random(.85,1.2)*(type==='hi'?1.65:type==='over'?1.28:1),2);
 if('radius'in spec)spec.radius=round((d.radius||2)*(type==='hi'?1.5:type==='over'?1.3:1)*random(.9,1.12),2);
 if('finalRadius'in spec)spec.finalRadius=round((d.finalRadius||5)*random(.9,1.17),2);
 if('count'in spec)spec.count=Math.min(24,Math.max(1,Math.round((d.count||1)*random(.85,1.28))));
 if('spread'in spec)spec.spread=round(d.spread*random(.85,1.22),2);
 if('stun'in spec)spec.stun=round(d.stun*random(.75,1.25),2);
 if('speed'in spec)spec.speed=round(d.speed*random(.9,1.1),2);
 return spec;
}
function generatedCharacter(tierKey,slotPref=null,modePref=null){
 const tier=TIERS[tierKey]||TIERS.normal,element=pick(ELEMENTS);
 const slots=slotPref==null?Math.round(random(tier.slots[0],tier.slots[1])):Math.min(SLOT_MAX,Math.max(1,Math.round(slotPref)));
 const mode=modePref||pick(['fixed','sequence']);
 const result={name:pick(NAME_HEAD)+element[0]+pick(['守','帝','姫','王','公','士'])+String(Math.floor(random(1,999))),
 title:tier.label+'・'+element[0]+'属性 '+pick(NAME_TAIL).replace('の',''),attribute:element[0]};
 for(const [k,,min,max]of STAT_FIELDS){
   const v=tier[k]||[DEFAULT_STAT_VALUES[k]||min,DEFAULT_STAT_VALUES[k]||min];
   result[k]=k==='hp'?Math.round(random(v[0],v[1])/10)*10:round(random(v[0],v[1]),k==='height'?2:2);
 }
 const kinds=SKILL_TYPES.map(([id])=>id);
 const skills=Array.from({length:slots},(_,i)=>generatedSkill(element,pick(kinds),tier,i));
 return {tierKey,...result,slots,mode,skills,over:generatedSkill(element,pick(['judgment','rain','shockwave','implode']),tier,0,'over'),hi:generatedSkill(element,'judgment',tier,0,'hi')};
}
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
    const fields={};for(const k of FIELDS)if(d[k]!==undefined)fields[k]=d[k];
    baseSnapshot.set(key,{...fields,skills:clone(d.skills||[]),over:clone(d.over||{}),hi:clone(d.hi||{}),
      pool:Array.isArray(d.pool)?clone(d.pool):null,fixedSlots:!!d.fixedSlots});
  }
}
function applyPublic(map){
  if(!map||typeof map!=='object'||Array.isArray(map))return;
  // Restore the complete original spell list; changing slotCount must never mutate the original snapshot.
  for(const [key,base] of baseSnapshot){
    const d=FIGHTERS[key];if(!d)continue;
    for(const k of FIELDS){if(k in base)d[k]=base[k];}
    d.skills=clone(base.skills);
    d.over=clone(base.over);if(Object.keys(base.hi).length)d.hi=clone(base.hi);else delete d.hi;
    if(base.pool)d.pool=clone(base.pool);else delete d.pool;
    d.fixedSlots=base.fixedSlots;
  }
  for(const [key,p] of Object.entries(map)){
    const d=FIGHTERS[key];if(!d||!p||typeof p!=='object')continue;
    for(const k of FIELDS)if(Object.hasOwn(p,k))d[k]=p[k];
    const cnt=Math.max(1,Math.min(SLOT_MAX,Number.isInteger(p.skillCount)?p.skillCount:d.skills.length||1));
    // New slots are complete spells supplied by the chief-authenticated server.
    d.skills.length=cnt;
    for(let i=0;i<cnt;i++){
      if(!d.skills[i])d.skills[i]=clone(TYPE_DEFAULTS.projectile);
      if(p.skills?.[i])Object.assign(d.skills[i],p.skills[i]);
    }
    for(const t of ['over','hi'])if(p[t]){d[t]||={};Object.assign(d[t],p[t]);}
    if(p.skillMode==='fixed'){delete d.pool;d.fixedSlots=true;}
    else if(p.skillMode==='sequence'){d.pool=Array.from({length:cnt},(_,i)=>i);d.fixedSlots=false;}
    else if(Array.isArray(d.pool))d.pool=d.pool.filter(i=>i>=0&&i<cnt);
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
  const r={};
  for(const [k,info]of inputs){
    if(info.type==='text'||info.type==='select'){r[k]=info.el.value.trim();continue;}
    if(info.type==='checkbox'){r[k]=!!info.el.checked;continue;}
    if(info.type==='color'){r[k]=parseInt(info.el.value.slice(1),16);continue;}
    if(!String(info.el.value).trim())throw Error(info.label+'を入力してください');
    const v=Number(info.el.value);
    if(!Number.isFinite(v)||v<info.min||v>info.max)throw Error(info.label+'は'+info.min+'～'+info.max+'で入力してください');
    r[k]=v;
  }
  return r;
}
function makeSelect(options,value){
  const s=make('select');for(const [id,label]of options){const o=make('option','',label);o.value=String(id);s.append(o);}
  s.value=String(value);return s;
}
function skillEditable(orig){
  const spec={...orig};
  if(!SKILL_KINDS.has(spec.kind))spec.kind=spec.kind||KEEP_KIND;
  spec.name=String(spec.name||'新しい技');
  return spec;
}
function normalizeSkill(spec,orig={},newSlot=false){
  const normalized={};
  for(const k of SKILL_KEYS){
    if(k in spec && spec[k]!==undefined&&spec[k]!==null &&!(k==='kind'&&spec[k]===KEEP_KIND)){
      if(k==='kind'&&!SKILL_KINDS.has(spec[k])&&spec[k]!==orig.kind)throw Error('選択できない技の種類です');
      normalized[k]=spec[k];
    }
  }
  const kind=normalized.kind||orig.kind||'projectile';
  const defs=TYPE_DEFAULTS[kind]||{};
  const isChangedKind=kind!==orig.kind;
  if(newSlot||isChangedKind){
    for(const k of TYPE_FIELDS[kind]||[]){if(normalized[k]===undefined){normalized[k]=orig[k]??defs[k];}}
    if(!normalized.name)normalized.name='新しい技';
    normalized.kind=kind;
    normalized.visual ||=chooseEffect(ELEMENTS[0],kind);
    normalized.elem ??=0;normalized.color??=0x7ecfff;
  }
  return normalized;
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
function rfEditedPatch(key,inputs,draftSkills,skillCount,skillMode,over,hi){
  const base=original(key)||{},raw=collectNumbers(inputs),patch={};
  for(const [k,v]of Object.entries(raw)){
    if(k==='name'&&!v)throw Error('キャラクター名を入力してください');
    if(typeof v==='string'&&!v)continue;
    if(base[k]===undefined){if(v!==DEFAULT_STAT_VALUES[k])patch[k]=v;}
    else if(v!==base[k])patch[k]=v;
  }
  if(!Number.isInteger(skillCount)||skillCount<1||skillCount>SLOT_MAX)throw Error('技スロットは1～24枠です');
  if(skillCount!==(base.skills?.length||0))patch.skillCount=skillCount;
  const originalMode=base.pool?.length?'sequence':'fixed';
  if(skillMode!==originalMode)patch.skillMode=skillMode;
  const newSkills=[];
  let any=false;
  for(let i=0;i<skillCount;i++){
    const orig=base.skills?.[i]||{};
    const curr=normalizeSkill(draftSkills[i]||{},orig,i>=base.skills.length);
    if(!curr.name?.trim())throw Error('通常技 '+(i+1)+' の名前が空です');
    const modified={};
    for(const [k,v]of Object.entries(curr))if(SKILL_KEYS.has(k)&&v!==orig[k])modified[k]=v;
    if(i>=base.skills.length){
      if(!SKILL_KINDS.has(modified.kind)||!modified.name)throw Error('追加した技の種類・名前を選択してください');
      // New slots always need a complete and valid spell.
      Object.assign(modified,normalizeSkill({...TYPE_DEFAULTS[modified.kind],...curr}, {},true));
    }
    if(Object.keys(modified).length){newSkills[i]=modified;any=true;}else newSkills[i]=null;
  }
  if(any)patch.skills=newSkills;
  for(const [keySpec,spec]of [['over',over],['hi',hi]]){
    const orig=base[keySpec]||{};
    const curr=normalizeSkill(spec||{},orig,!Object.keys(orig).length);
    const modified={};for(const [k,v]of Object.entries(curr))if(SKILL_KEYS.has(k)&&v!==orig[k])modified[k]=v;
    if(Object.keys(modified).length)patch[keySpec]=modified;
  }
  return patch;
}
// V32: Preview-first, one-commit batch balancing. Never alter models or permission flags.
const RF_BULK_STATS=['hp','speed','power','armor','height','overGain','fluxMul'];
const RF_BULK_MODES=[['stats','能力値だけ（名前・固有技は変更しない）'],['balance','能力値＋技・奥義の威力・コスト'],['random','基本情報・能力値・技構成もランダム生成']];
const RF_BULK_SCOPES=[['all','全キャラクター（隠しキャラ含む）'],['general','一般・通常キャラのみ'],['staff','運営・運営長・特別キャラのみ']];
const rfHash=(s)=>{let h=2166136261;for(const c of String(s)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;};
const rfUnit=(s)=>rfHash(s)/4294967296;
const rfNum=(d,key)=>{const v=Number(d?.[key]);return Number.isFinite(v)&&v>0?v:(DEFAULT_STAT_VALUES[key]||1);};
function bulkTier(key,def,selection){
  if(selection!=='auto')return TIERS[selection]?selection:'normal';
  const hp=rfNum(def,'hp');
  if(/final|lastboss|endboss|ultimate/i.test(key)||def?.finalBoss)return 'final';
  if(/boss|maou|gaizorg|gigantes/i.test(key)||hp>=9000)return 'great';
  if(def?.special==='chief'||hp>=4000)return 'middle';
  if(def?.special||def?.locked||def?.hidden||hp>=1900)return 'small';
  return 'normal';
}
function bulkTargets(scope){
  return Object.entries(FIGHTERS).filter(([key,d])=>{
    if(!d||typeof d!=='object'||!Array.isArray(d.skills))return false;
    const special=!!(d.special||d.locked||d.hidden);
    return scope==='general'?!special:scope==='staff'?special:true;
  });
}
function balancedStatsFor(entries,options){
  const ranks={};
  for(const k of RF_BULK_STATS){
    const sorted=entries.slice().sort((a,b)=>rfNum(a[1],k)-rfNum(b[1],k));
    ranks[k]=new Map(sorted.map(([id],i)=>[id,sorted.length===1?.5:i/(sorted.length-1)]));
  }
  const output={};
  for(const [key,def]of entries){
    const tierKey=bulkTier(key,def,options.tier),tier=TIERS[tierKey],stats={};
    for(const field of RF_BULK_STATS){
      if(field==='height'&&options.preserveHeight)continue;
      const [low,high]=tier[field];
      const q=ranks[field].get(key)??.5;
      const variation=(rfUnit(key+'/'+field+'/'+options.seed)-.5)*.16;
      const rank=clampNum(.12 + .76*q + variation,.04,.96);
      const result=low+(high-low)*rank;
      stats[field]=field==='hp'?Math.max(1,Math.round(result/10)*10):round(result,2);
    }
    output[key]={tierKey,stats};
  }
  return output;
}
function clampNum(n,min,max){return Math.min(max,Math.max(min,n));}
function compactRandomSkill(s,originalSkill={},full=false){
  if(full)return clone(s);
  const allowed=['name','kind','elem','color','visual','dmg','cost','radius','castTime','speed','count','spread','delay','interval','finalDmg','finalRadius','heal','dur','stun','kb','shape'];
  const out={};for(const k of allowed)if(s[k]!==undefined&&s[k]!==originalSkill[k])out[k]=s[k];
  return out;
}
function planBulkChange(options){
  const targets=bulkTargets(options.scope);
  if(!targets.length)throw Error('対象キャラクターがいません。');
  const result=balancedStatsFor(targets,options);
  const all=clone(activeOverlays),rows=[];
  for(const [key,def]of targets){
    const b=original(key)||{},prev=all[key]||{},item=result[key],tier=TIERS[item.tierKey];
    const p=clone(prev);
    Object.assign(p,item.stats);
    let slots=Number.isInteger(p.skillCount)?p.skillCount:(def.skills?.length||1);
    if(options.slots!=='keep')slots=Number(options.slots);
    slots=clampNum(slots,1,SLOT_MAX);
    const originalCount=b.skills?.length||0;
    const prevSkills=Array.isArray(p.skills)?p.skills:[];
    const shownSlots=Array.isArray(def.skills)?def.skills.length:0;
    const mode=options.skillMode==='keep'?(p.skillMode||(def.pool?.length?'sequence':'fixed')):options.skillMode;
    const element=ELEMENTS.find(v=>v[0]===String(def.attribute||'').trim())||ELEMENTS.find(v=>v[1]===def.element)||ELEMENTS[7];
    if(options.editMode==='random'){
      const g=generatedCharacter(item.tierKey,slots,mode);
      if(options.randomIdentity){for(const id of ['name','title','attribute'])p[id]=g[id];}
      // Skills are generated individually, while original GLB and roster identity remain unchanged by default.
      const currentElem=options.randomIdentity?(ELEMENTS.find(v=>v[0]===g.attribute)||element):element;
      const kinds=SKILL_TYPES.map(v=>v[0]);
      p.skills=Array.from({length:slots},(_,i)=>{
        const spec=generatedSkill(currentElem,pick(kinds),tier,i);
        return compactRandomSkill(spec,b.skills?.[i]||{},i>=originalCount);
      });
      p.over=compactRandomSkill(generatedSkill(currentElem,pick(['judgment','rain','implode','shockwave']),tier,0,'over'),b.over||{},!Object.keys(b.over||{}).length);
      p.hi=compactRandomSkill(generatedSkill(currentElem,'judgment',tier,0,'hi'),b.hi||{},!Object.keys(b.hi||{}).length);
    }else if(options.editMode==='balance'){
      const list=[];
      const originals=Array.isArray(def.skills)?def.skills:[];
      for(let i=0;i<slots;i++){
        const old=originals[i],keep=prevSkills[i]||{};
        if(i>=shownSlots){list[i]=generatedSkill(element,'projectile',tier,i);continue;}
        const kind=old?.kind||'projectile',foundation=TYPE_DEFAULTS[kind]||TYPE_DEFAULTS.projectile;
        const weight=.83+rfUnit(key+':skill:'+i)*.34;
        const newValues={...keep};
        if(kind==='heal')newValues.heal=Math.round((foundation.heal||185)*tier.strength*weight);
        else newValues.dmg=Math.round((foundation.dmg||95)*tier.strength*weight);
        if(kind==='judgment')newValues.finalDmg=Math.round((foundation.finalDmg||310)*tier.strength*weight);
        newValues.cost=Math.round(clampNum((foundation.cost||16)*(0.86+rfUnit(key+':cost:'+i)*.27),0,90));
        list[i]=newValues;
      }
      // All added slots must be complete spells based on the ORIGINAL server definitions.
      for(let i=originalCount;i<slots;i++)if(!list[i]?.kind)list[i]=generatedSkill(element,'projectile',tier,i);
      p.skills=list;
      for(const skillName of ['over','hi']){
        const old=def[skillName]||{},kind=old.kind||'judgment',f=TYPE_DEFAULTS[kind]||TYPE_DEFAULTS.judgment;
        const weight=(skillName==='hi'?2.4:1.8)*tier.strength*(.91+.18*rfUnit(key+skillName));
        const v={...(prev[skillName]||{})};
        if(kind==='heal')v.heal=Math.round((f.heal||190)*weight);
        else v.dmg=Math.round((f.dmg||115)*weight);
        if(kind==='judgment')v.finalDmg=Math.round((f.finalDmg||310)*weight);
        p[skillName]=v;
      }
    }else if(options.slots!=='keep'){
      // Stats-only should never rewrite existing spells. Add defaults only when expanding slots.
      const list=Array.from({length:slots},(_,i)=>prevSkills[i]||null);
      for(let i=originalCount;i<slots;i++)if(!list[i])list[i]=generatedSkill(element,'projectile',tier,i);
      p.skills=list;
    }
    if(options.slots!=='keep')p.skillCount=slots;
    if(options.skillMode!=='keep')p.skillMode=options.skillMode;
    all[key]=p;
    rows.push({key,name:def.name||key,tier:tier.label,oldHp:rfNum(def,'hp'),hp:p.hp,oldPower:rfNum(def,'power'),power:p.power,oldArmor:rfNum(def,'armor'),armor:p.armor,oldSpeed:rfNum(def,'speed'),speed:p.speed,oldSlots:shownSlots,slots,mode});
  }
  if(options.keepGaizorgTop && all.gaizorg && rows.some(r=>r.key==='gaizorg')){
    const maxOther=Math.max(0,...Object.entries(FIGHTERS).filter(([k])=>k!=='gaizorg').map(([k,d])=>Number(all[k]?.hp??d.hp)||0));
    const top=Math.min(200000,Math.max(Number(all.gaizorg.hp)||0,maxOther+100));
    all.gaizorg.hp=top;const row=rows.find(r=>r.key==='gaizorg');row.hp=top;
  }
  const serialized=JSON.stringify(all);
  if(serialized.length>142000)throw Error('全件の保存サイズが大きすぎます（'+Math.round(serialized.length/1024)+'KB）。技スロット数を減らすか、「能力値のみ」を選んでください。');
  return {all,rows,baseRevision:revision,serializedSize:serialized.length,scope:options.scope,editMode:options.editMode,tier:options.tier};
}

function createPanel(){
  const root=make('div','rf-ce-root');root.id='rf-chief-character-editor';root.hidden=true;
  root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','運営長専用キャラクター編集');
  const shell=make('div','rf-ce-shell');const head=make('header','rf-ce-header');
  const heading=make('div');heading.append(make('small','','CHIEF COMMAND · CHARACTER LAB'),make('h2','','キャラクター編集・自動生成'));heading.querySelector('h2').style.margin='3px 0 0';
  const close=make('button','rf-ce-outline','閉じる');close.type='button';close.addEventListener('click',()=>closePanel());head.append(heading,close);
  const info=make('p','rf-ce-note','テンプレート・ランダム生成は保存前の案です。運営長の確認・保存までは既存キャラや全プレイヤーを変更しません。');
  const content=make('div','rf-ce-content');const left=make('aside','rf-ce-list');const right=make('form','rf-ce-form');right.autocomplete='off';right.noValidate=true;
  const search=textInput('',45);search.placeholder='キャラクター検索';search.setAttribute('aria-label','キャラクター検索');
  const list=make('div','rf-ce-list-items');left.append(search,list);
  const status=make('div','rf-ce-status','');status.setAttribute('role','status');
  const actions=make('div','rf-ce-actions');
  const save=make('button','rf-ce-primary','変更を保存・公開');save.type='button';
  const reset=make('button','rf-ce-outline','このキャラを元に戻す');reset.type='button';
  const refresh=make('button','rf-ce-outline','サーバーから再読込');refresh.type='button';
  actions.append(save,reset,refresh);content.append(left,right);shell.append(head,info,content,actions,status);root.append(shell);document.body.append(root);
  let selected='',inputs=new Map(),draftSkills=[],draftOver=null,draftHi=null,slotCount=1,skillMode='fixed',tierChoice='normal';
  let skillArea=null,slotEl=null,modeEl=null,preview=null;
  const tell=(msg,type='')=>{status.textContent=msg;status.dataset.type=type;};
  // V32: Apply a tier to ALL characters in one preview-and-confirmed transaction.
  let bulkDraft=null;
  const bulk=make('section','rf-ce-bulk');bulk.setAttribute('aria-label','全キャラクター一括編集');
  bulk.append(make('h3','','全キャラクター一括バランス編集'));
  bulk.append(make('p','rf-ce-note','強さのテンプレートを選択し、対象キャラの能力値を一括で調整します。名前・元モデル・使用権限は初期設定では変更されません。必ず変更一覧を確認してから公開してください。'));
  const bulkTools=make('div','rf-ce-bulk-grid');
  const bulkTierChoice=makeSelect([['auto','役割別に自動割当（おすすめ）'],...Object.entries(TIERS).map(([k,v])=>[k,v.label])],'auto');
  bulkTierChoice.setAttribute('aria-label','全キャラの強さテンプレート');
  const bulkScopeChoice=makeSelect(RF_BULK_SCOPES,'all');bulkScopeChoice.setAttribute('aria-label','一括編集の対象');
  const bulkEditChoice=makeSelect(RF_BULK_MODES,'stats');bulkEditChoice.setAttribute('aria-label','一括編集の内容');
  const bulkSlotChoice=makeSelect([['keep','技スロット数を維持'],...Array.from({length:SLOT_MAX},(_,i)=>[String(i+1),(i+1)+'枠'])],'keep');
  const bulkModeChoice=makeSelect([['keep','元の固定／順番設定を維持'],['fixed','全員を固定方式'],['sequence','全員を順番方式']],'keep');
  bulkTools.append(formGroup('強さテンプレート',bulkTierChoice),formGroup('対象キャラクター',bulkScopeChoice),formGroup('編集範囲',bulkEditChoice),formGroup('技スロット数',bulkSlotChoice),formGroup('固定／順番',bulkModeChoice));
  const bulkOptions=make('div','rf-ce-bulk-options');
  const bulkHeight=make('input');bulkHeight.type='checkbox';bulkHeight.checked=true;
  const bulkIdentity=make('input');bulkIdentity.type='checkbox';bulkIdentity.checked=false;
  const bulkGaiz=make('input');bulkGaiz.type='checkbox';bulkGaiz.checked=true;
  const checkField=(title,el)=>{const lbl=make('label','rf-ce-check');lbl.append(el,make('span','',title));return lbl;};
  bulkOptions.append(checkField('既存キャラの表示身長を維持する',bulkHeight),checkField('全ランダム生成時にキャラ名・肩書き・属性も変更する',bulkIdentity),checkField('ガイゾルグのHP最上位を維持する',bulkGaiz));
  const bulkActions=make('div','rf-ce-bulk-actions');
  const bulkPreviewButton=make('button','rf-ce-outline','一括変更をプレビュー');bulkPreviewButton.type='button';
  const bulkSaveButton=make('button','rf-ce-primary','確認して一括保存・公開');bulkSaveButton.type='button';bulkSaveButton.disabled=true;
  bulkActions.append(bulkPreviewButton,bulkSaveButton);
  const bulkNotice=make('p','rf-ce-bulk-note','プレビュー段階では保存・公開されません。');bulkNotice.setAttribute('aria-live','polite');
  const bulkTable=make('div','rf-ce-bulk-preview');bulkTable.hidden=true;
  bulk.append(bulkTools,bulkOptions,bulkActions,bulkNotice,bulkTable);
  shell.insertBefore(bulk,content);
  function invalidateBulk(){bulkDraft=null;bulkSaveButton.disabled=true;bulkTable.hidden=true;bulkTable.replaceChildren();bulkNotice.textContent='設定を変更しました。「一括変更をプレビュー」を押してください。';}
  for(const el of [bulkTierChoice,bulkScopeChoice,bulkEditChoice,bulkSlotChoice,bulkModeChoice,bulkHeight,bulkIdentity,bulkGaiz])el.addEventListener('change',invalidateBulk);
  function drawBulkPreview(draft){
    bulkTable.replaceChildren();
    const info=make('p','rf-ce-bulk-summary',draft.rows.length+'キャラ分の変更案 ／ '+Math.round(draft.serializedSize/1024)+'KB ／ テンプレート：'+(draft.tier==='auto'?'役割別に自動':TIERS[draft.tier].label));
    const table=make('table','rf-ce-bulk-table'),thead=make('thead'),tr=make('tr');
    for(const label of ['キャラクター','階級','HP（前→後）','攻撃倍率','被ダメ倍率','速度','技枠'])tr.append(make('th','',label));
    thead.append(tr);table.append(thead);
    const tb=make('tbody');const fmt=n=>typeof n==='number'?Number(n.toFixed(2)).toLocaleString('ja-JP'):String(n);
    for(const row of draft.rows){const tr=make('tr');for(const value of [row.name,row.tier,fmt(row.oldHp)+' → '+fmt(row.hp),fmt(row.oldPower)+' → '+fmt(row.power),fmt(row.oldArmor)+' → '+fmt(row.armor),fmt(row.oldSpeed)+' → '+fmt(row.speed),row.oldSlots+' → '+row.slots])tr.append(make('td','',value));tb.append(tr);}
    table.append(tb);bulkTable.append(info,table);bulkTable.hidden=false;
  }
  bulkPreviewButton.addEventListener('click',async()=>{
    if(busy)return;bulkPreviewButton.disabled=true;bulkNotice.textContent='保存済みデータを確認し、変更一覧を作成しています…';
    try{
      if(inBattle())throw Error('戦闘中は一括編集できません。');
      if(!(await authorized()))throw Error('運営長の権限を確認できません。再認証してください。');
      await syncPublic(true);
      const options={tier:bulkTierChoice.value,scope:bulkScopeChoice.value,editMode:bulkEditChoice.value,slots:bulkSlotChoice.value,skillMode:bulkModeChoice.value,
        preserveHeight:bulkHeight.checked,randomIdentity:bulkIdentity.checked,keepGaizorgTop:bulkGaiz.checked,seed:Date.now()};
      bulkDraft=planBulkChange(options);drawBulkPreview(bulkDraft);bulkSaveButton.disabled=false;
      bulkNotice.textContent='変更前後を確認してください。まだサーバーには保存していません。再プレビューで別の数値を生成できます。';
    }catch(e){bulkDraft=null;bulkSaveButton.disabled=true;bulkTable.hidden=true;bulkNotice.textContent=e.message||String(e);tell('一括プレビュー：'+(e.message||String(e)),'error');}
    finally{bulkPreviewButton.disabled=false;}
  });
  bulkSaveButton.addEventListener('click',async()=>{
    if(busy||!bulkDraft)return;busy=true;disable(true);bulkPreviewButton.disabled=true;bulkSaveButton.disabled=true;
    const draft=bulkDraft;
    try{
      if(inBattle())throw Error('戦闘中は保存できません。');
      if(revision!==draft.baseRevision)throw Error('編集中に別の保存が行われました。再プレビューしてください。');
      const confirmed=await editorConfirm('全キャラクターの変更を公開しますか？',
        draft.rows.length+'キャラクターの能力値'+(draft.editMode==='stats'?'':'・技構成')+'を一括更新します。モデル・運営権限は維持されます。公開後は全プレイヤーの次回戦闘へ反映されます。','全'+draft.rows.length+'件を一括保存');
      if(!confirmed){bulkNotice.textContent='一括保存をキャンセルしました。プレビューは保持されています。';return;}
      if(!(await authorized()))throw Error('運営長の認証が無効です。');
      bulkNotice.textContent='Cloudflare Workerへ一括保存しています…';
      const r=await api('/chief/characters/save',{token:tokenOf(),revision:draft.baseRevision,overrides:draft.all});
      if(!r.ok){if(r.error==='stale')throw Error('編集データが更新されています。再プレビューしてください。');
        if(r.error==='invalid_character_values')throw Error('サーバーが技スロット／値を拒否しました。V31のWorkerが公開済みか確認してください。');
        throw Error('一括保存に失敗しました：'+(r.error||('HTTP '+r.status)));}
      applyPublic(draft.all);revision=r.revision;lastFetch=0;
      let refreshed=true;try{await syncPublic(true);}catch(e){refreshed=false;console.warn('[Bulk balance refresh]',e);}
      bulkDraft=null;renderList();if(selected&&FIGHTERS[selected])select(selected);
      bulkNotice.textContent=refreshed?'全'+draft.rows.length+'件を保存・公開しました。次の戦闘から反映されます。':'保存成功。最新の再読込のみ失敗しました。';
      tell('全キャラ一括保存：'+draft.rows.length+'件の変更を公開しました。','success');
      bulkTable.hidden=true;
    }catch(e){bulkNotice.textContent=e.message||String(e);tell('一括保存：'+(e.message||String(e)),'error');}
    finally{busy=false;disable(false);bulkPreviewButton.disabled=false;bulkSaveButton.disabled=!bulkDraft;}
  });

  function select(key){
    if(!FIGHTERS[key])return;selected=key;right.replaceChildren();inputs=new Map();
    const d=FIGHTERS[key],base=original(key)||{},ov=activeOverlays[key]||{};
    slotCount=Math.max(1,Math.min(SLOT_MAX,ov.skillCount||d.skills?.length||1));
    skillMode=ov.skillMode||(d.pool?.length?'sequence':'fixed');
    draftSkills=Array.from({length:slotCount},(_,i)=>skillEditable(d.skills?.[i]||generatedSkill(ELEMENTS[7],'projectile',TIERS.normal,i)));
    draftOver=skillEditable(d.over||generatedSkill(ELEMENTS[7],'judgment',TIERS.normal,0,'over'));
    draftHi=skillEditable(d.hi||generatedSkill(ELEMENTS[7],'judgment',TIERS.normal,0,'hi'));
    const title=make('div','rf-ce-char-title');title.append(make('strong','',d.name||key),make('small','',key+' · '+(d.special==='chief'?'運営長専用':d.special==='operator'?'運営専用':'キャラクター')));right.append(title);
    if(d.face){const portrait=make('img','rf-ce-portrait');portrait.src=d.face;portrait.alt='';portrait.loading='lazy';right.append(portrait);}
    // Templates are presets only; they do NOT modify character roles or models.
    const tool=make('section','rf-ce-generator');
    tool.append(make('h3','','ステータステンプレート・一括ランダム生成'));
    const control=make('div','rf-ce-generator-tools');
    const tier=makeSelect(Object.entries(TIERS).map(([k,v])=>[k,v.label]),tierChoice);tier.setAttribute('aria-label','ステータステンプレート');
    tier.addEventListener('change',()=>{tierChoice=tier.value;drawPreview('「'+TIERS[tierChoice].label+'」テンプレートを選択中。まだキャラクターは変更されていません。');});
    const applyPreset=make('button','rf-ce-outline','テンプレート値を適用');applyPreset.type='button';
    const randomButton=make('button','rf-ce-primary','基本情報・能力・技魔法を全ランダム生成');randomButton.type='button';
    control.append(formGroup('強さのテンプレート',tier),applyPreset,randomButton);
    tool.append(control);tool.append(make('p','rf-ce-note','生成後は数値と技を自由に調整できます。「保存」を押すまでは公開されません。モデル・権限・テクスチャは変更しません。'));
    preview=make('div','rf-ce-preview','テンプレート選択後、ランダム生成できます。');preview.setAttribute('aria-live','polite');tool.append(preview);right.append(tool);
    const textArea=make('div','rf-ce-fields');
    for(const [k,label,max] of TEXT_FIELDS){const v=ov[k]??base[k]??d[k]??'';const el=textInput(v,max);inputs.set(k,{type:'text',label,el});textArea.append(formGroup(label,el));}
    right.append(make('h3','','基本情報'),textArea);
    const statArea=make('div','rf-ce-fields');
    for(const [k,label,min,max] of STAT_FIELDS){const v=ov[k]??base[k]??d[k]??DEFAULT_STAT_VALUES[k]??min;const el=numberInput(v,min,max);inputs.set(k,{type:'number',min,max,label,el});statArea.append(formGroup(label,el));}
    right.append(make('h3','','能力値'),statArea);
    const slotsHeader=make('h3','','技・魔法のスロット設定');right.append(slotsHeader);
    const slotBar=make('div','rf-ce-slot-controls');
    slotEl=numberInput(slotCount,1,SLOT_MAX,1);slotEl.step='1';slotEl.setAttribute('aria-label','通常技のスロット数');
    modeEl=makeSelect([['fixed','固定：各ボタン・パネルで指定技'],['sequence','順番：技A／技Bで登録順に使用']],skillMode);
    modeEl.setAttribute('aria-label','技の切り替え方式');
    slotBar.append(formGroup('通常技スロット数（1～24）',slotEl),formGroup('技の使用方式',modeEl));right.append(slotBar);
    const modeHelp=make('p','rf-ce-note','固定：技A／技Bと個別スロットを使用。順番：技A／技Bを押すたびに通常技を順番に使用。追加技は戦闘中の技パネルから個別発動できます。');right.append(modeHelp);
    right.append(make('h3','','技・魔法・奥義・秘奥義の詳細設定'));
    skillArea=make('div','rf-ce-skills');right.append(skillArea);
    function drawPreview(message=''){
      const n=inputs.get('name')?.el.value||d.name, attr=inputs.get('attribute')?.el.value||'';
      preview.textContent=(message?message+'\n':'')+'名前: '+n+' ／ 属性: '+attr+' ／ 通常技: '+slotCount+'枠 ／ 方式: '+(skillMode==='fixed'?'固定':'順番')+' ／ 奥義・秘奥義各1枠';
    }
    function fieldsFor(kind,baseSpec){
      const extras=TYPE_FIELDS[kind]||SKILL_FIELDS.map(x=>x[0]).filter(k=>k in baseSpec);
      return ['name','kind','visual','elem','color',...extras];
    }
    function addSkillEditor(name,spec,orig,type,index=0){
      const el=make('details','rf-ce-skill');const summary=make('summary','',name+' · '+(spec.name||'新しい技'));el.append(summary);
      const content=make('div','rf-ce-fields');el.append(content);
      const help=make('p','rf-ce-skill-kind-description','');el.append(help);
      const cache=spec;
      let currentKind=cache.kind;
      const render=()=>{
        content.replaceChildren();const kind=cache.kind;
        help.textContent=KINDS_DESCRIPTION[kind]||'固有技です。種類を変更しなければ元の特殊な演出を保持します。';
        for(const k of fieldsFor(kind,orig)){
          const cfg=SKILL_FIELDS.find(x=>x[0]===k);if(!cfg)continue;
          const [,label,tp,min,max]=cfg;
          let inp;
          if(k==='kind'){
            const opts=SKILL_TYPES.slice();
            if(!SKILL_KINDS.has(cache.kind))opts.unshift([cache.kind||KEEP_KIND,'固有技を維持（'+(cache.kind||'未指定')+'）']);
            inp=makeSelect(opts,cache.kind||KEEP_KIND);
            inp.addEventListener('change',()=>{
              const next=inp.value;
              if(next!==cache.kind){
                cache.kind=next;
                if(SKILL_KINDS.has(next)){
                  for(const [kk,vv]of Object.entries(TYPE_DEFAULTS[next]))cache[kk]=vv;
                  cache.visual=chooseEffect(ELEMENTS.find(e=>e[1]===cache.elem),next);
                }
                render();
              }
            });
          }else if(k==='visual'){
            const opts=VISUALS.slice();if(cache.visual&&!opts.some(([id])=>id===cache.visual))opts.unshift([cache.visual,'元の演出：'+cache.visual]);
            inp=makeSelect(opts,cache.visual||'orb');inp.addEventListener('change',()=>{cache.visual=inp.value;});
          }else if(k==='elem'){
            inp=makeSelect(ELEMENTS.map(e=>[e[1],e[0]]),cache.elem??0);inp.addEventListener('change',()=>{
              cache.elem=Number(inp.value);const def=ELEMENTS.find(e=>e[1]===cache.elem);cache.color=def?.[2]||0x6acaff;render();
            });
          }else if(k==='color'){
            inp=make('input');inp.type='color';inp.value='#'+(Number(cache.color??0x7ecfff)&0xffffff).toString(16).padStart(6,'0');
            inp.addEventListener('input',()=>{cache.color=parseInt(inp.value.slice(1),16);});
          }else if(tp==='checkbox'){
            inp=make('input');inp.type='checkbox';inp.checked=!!cache[k];inp.addEventListener('change',()=>{cache[k]=!!inp.checked;});
          }else if(tp==='text'){
            inp=textInput(cache[k]??'新技',max);inp.addEventListener('input',()=>{cache[k]=inp.value;summary.textContent=name+' · '+inp.value;});
          }else{
            const initial=cache[k]??orig?.[k]??TYPE_DEFAULTS[kind]?.[k]??min;
            cache[k]=initial;
            inp=numberInput(initial,min,max);inp.addEventListener('input',()=>{
              const n=Number(inp.value);if(inp.value!==''&&Number.isFinite(n))cache[k]=n;
            });
          }
          content.append(formGroup(label,inp));
        }
      };
      render();skillArea.append(el);return el;
    }
    function drawSkillEditors(){
      skillArea.replaceChildren();
      for(let i=0;i<slotCount;i++)addSkillEditor('通常技 '+(i+1),draftSkills[i],base.skills?.[i]||{},'skills',i);
      addSkillEditor('奥義',draftOver,base.over||{},'over');
      addSkillEditor('秘奥義',draftHi,base.hi||{},'hi');
      drawPreview();
    }
    slotEl.addEventListener('change',()=>{
      const number=Number(slotEl.value);
      if(!Number.isInteger(number)||number<1||number>SLOT_MAX){tell('通常技のスロット数は1～24枠です。','error');slotEl.value=slotCount;return;}
      while(draftSkills.length<number)draftSkills.push(generatedSkill(ELEMENTS[7],'projectile',TIERS.normal,draftSkills.length));
      slotCount=number;drawSkillEditors();tell('スロット数を変更しました。保存するまで公開されません。');
    });
    modeEl.addEventListener('change',()=>{skillMode=modeEl.value;drawPreview();});
    function applyStats(g,copyBasic=false,copySkills=false){
      if(copyBasic){for(const k of ['name','title','attribute'])inputs.get(k).el.value=g[k];}
      for(const [k]of STAT_FIELDS){inputs.get(k).el.value=String(g[k]);}
      if(copySkills){
        slotCount=g.slots;slotEl.value=slotCount;skillMode=g.mode;modeEl.value=skillMode;
        draftSkills=g.skills.map(v=>clone(v));draftOver=clone(g.over);draftHi=clone(g.hi);drawSkillEditors();
      }
      drawPreview(copyBasic?'一括ランダム生成した保存前プレビューです。':'テンプレートに応じて能力値を設定しました。');
    }
    applyPreset.addEventListener('click',()=>{
      const g=generatedCharacter(tier.value,slotCount,skillMode);
      applyStats(g,false,false);tell('「'+TIERS[tier.value].label+'」テンプレートの能力値を適用しました。保存前です。');
    });
    randomButton.addEventListener('click',()=>{
      const g=generatedCharacter(tier.value,null,null);
      applyStats(g,true,true);tell('「'+TIERS[tier.value].label+'」の基本情報・ステータス・技/魔法を一括生成しました。再生成・手動編集が可能です。');
    });
    drawSkillEditors();
    list.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.key===key));
    tell('保存まで他のプレイヤーには反映されません。');
  }
  function renderList(){
    const q=search.value.toLocaleLowerCase('ja');list.replaceChildren();
    const all=Object.entries(FIGHTERS).filter(([k,d])=>d&&!d.hidden&&((d.name||'').toLocaleLowerCase('ja').includes(q)||k.includes(q))).sort((a,b)=>String(a[1].name).localeCompare(String(b[1].name),'ja'));
    for(const [key,d]of all.slice(0,300)){
      const b=make('button','rf-ce-character',d.name||key);b.type='button';b.dataset.key=key;b.title=key;
      b.classList.toggle('active',key===selected);b.addEventListener('click',()=>select(key));list.append(b);
    }
    if(!all.length)list.append(make('p','rf-ce-note','一致するキャラクターがありません。'));
  }
  search.addEventListener('input',renderList);
  function disable(flag){save.disabled=reset.disabled=refresh.disabled=flag;}
  async function saveChanges(){
    if(busy)return;if(!selected){tell('キャラクターを選択してください。','error');return;}
    busy=true;disable(true);tell('編集内容を検証しています…');const key=selected;
    try{
      if(inBattle())throw Error('戦闘中は変更できません');
      const patch=rfEditedPatch(key,inputs,draftSkills,slotCount,skillMode,draftOver,draftHi);
      const all=clone(activeOverlays);if(Object.keys(patch).length)all[key]=patch;else delete all[key];
      if(JSON.stringify(all)===JSON.stringify(activeOverlays)){tell('保存済みの内容と同じです。');return;}
      const n=inputs.get('name').el.value;
      const confirm=await editorConfirm('変更を全プレイヤーへ公開しますか？',
        '対象：'+(n||key)+' ／ 通常技'+slotCount+'枠 ／ '+(skillMode==='fixed'?'固定':'順番')+'方式。基本情報・能力値・技構成が次の戦闘から反映されます。','保存・公開する');
      if(!confirm){tell('保存をキャンセルしました。');return;}
      tell('運営長の権限を照合しています…');if(!(await authorized()))throw Error('運営長の認証が必要です。設定から再認証してください');
      tell('サーバーに保存しています…');const r=await api('/chief/characters/save',{token:tokenOf(),revision,overrides:all});
      if(!r.ok){if(r.error==='stale')throw Error('他の編集が先に保存されました。再読込してください');
        if(r.error==='denied')throw Error('運営長の認証が無効です');
        if(r.error==='invalid_character_values')throw Error('技の設定値が不正です。新規スロットの種類・名前・数値を確認してください');
        if(r.status===404)throw Error('Cloudflare WorkerをV31に更新してください');
        throw Error('保存に失敗：'+(r.error||('HTTP '+r.status)));}
      bulkDraft=null;bulkSaveButton.disabled=true;bulkNotice.textContent='個別保存が行われました。一括編集は再プレビューしてください。';
      applyPublic(all);revision=Number.isSafeInteger(r.revision)?r.revision:revision+1;lastFetch=0;
      let refreshed=true;try{await syncPublic(true);}catch(e){refreshed=false;console.warn('[Character editor V31] refresh:',e);}
      renderList();select(key);tell(refreshed?'保存しました。次の戦闘から全プレイヤーに反映されます。':'サーバー保存済みです。再取得のみ失敗しました。','success');
    }catch(e){console.warn('[Character editor V31] save:',e);tell(e.message||String(e),'error');}
    finally{busy=false;disable(false);}
  }
  save.addEventListener('click',()=>{void saveChanges();});
  right.addEventListener('submit',e=>{e.preventDefault();void saveChanges();});
  reset.addEventListener('click',async()=>{
    if(busy||!selected)return;busy=true;disable(true);const key=selected;
    try{
      if(!Object.hasOwn(activeOverlays,key)){tell('保存済み変更がありません。');return;}
      const confirmed=await editorConfirm('初期設定へ戻しますか？','「'+(FIGHTERS[key]?.name||key)+'」の保存済み編集を削除します。','初期設定へ戻す',true);
      if(!confirmed){tell('初期化をキャンセルしました。');return;}
      if(inBattle())throw Error('戦闘中は変更できません');
      if(!(await authorized()))throw Error('運営長の再認証が必要です');
      const all=clone(activeOverlays);delete all[key];tell('初期化をサーバーに保存中…');
      const r=await api('/chief/characters/save',{token:tokenOf(),revision,overrides:all});
      if(!r.ok)throw Error('初期化できませんでした（'+(r.error||r.status)+'）');
      bulkDraft=null;bulkSaveButton.disabled=true;bulkNotice.textContent='個別の初期化が行われました。一括編集は再プレビューしてください。';
      applyPublic(all);revision=r.revision;lastFetch=0;try{await syncPublic(true);}catch{}
      renderList();select(key);tell('初期設定に戻しました。','success');
    }catch(e){tell(e.message||String(e),'error');}finally{busy=false;disable(false);}
  });
  refresh.addEventListener('click',async()=>{if(busy)return;try{await syncPublic(true);renderList();select(selected);tell('最新データを取得しました。','success');}catch(e){tell(e.message,'error');}});
  root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('.rf-ce-confirm-overlay')){e.stopPropagation();closePanel();}});
  return {root,tell,open:async()=>{root.hidden=false;document.body.classList.add('rf-character-editor-open');try{await syncPublic(true);renderList();select(selected&&FIGHTERS[selected]?selected:Object.keys(FIGHTERS)[0]);}catch(e){tell(e.message,'error');}},close:()=>{root.hidden=true;document.body.classList.remove('rf-character-editor-open');}};
}
function closePanel(){panel?.close();}
// The standard game has only two spell buttons. This makes slots 1–24 genuinely usable.
function setupBattleSlotPanel({Fighter,getState}){
  if(!Fighter?.prototype||Fighter.prototype.__rfChiefSlotsV31||typeof document==='undefined')return;
  Fighter.prototype.__rfChiefSlotsV31=true;
  let queued=null;
  const oldUpdate=Fighter.prototype.update;
  Fighter.prototype.update=function(dt,input){
    if(queued&&queued.f===this&&!this.remoteAuth&&this.isPlayer&&!this.dead){
      const next={...(input||{}),skill:false,skill2:false,attack:false,heal:false,over:false,skillIdx:queued.slot};
      queued=null;return oldUpdate.call(this,dt,next);
    }
    return oldUpdate.call(this,dt,input);
  };
  const panel=make('div','rf-ce-battle-slots');panel.id='rf-ce-battle-slots';panel.hidden=true;
  const head=make('div','rf-ce-battle-slots-header');
  const toggle=make('button','rf-ce-battle-slots-toggle','技一覧');toggle.type='button';
  const label=make('span','','');head.append(toggle,label);
  const list=make('div','rf-ce-battle-slots-list');panel.append(head,list);document.body.append(panel);
  let expanded=false,lastSig='';
  toggle.onclick=()=>{expanded=!expanded;list.hidden=!expanded;toggle.textContent=expanded?'技を閉じる':'技一覧';};
  list.hidden=true;
  const current=()=>{
    const state=typeof getState==='function'?getState():null;
    if(!state?.battle||state.paused||document.querySelector('.screen.on'))return null;
    return state.battle.fighters?.find(f=>f.isPlayer&&!f.remoteAuth&&!f.dead)||null;
  };
  document.addEventListener('keydown',e=>{
    if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.target?.closest?.('input,textarea,select,[contenteditable]'))return;
    if(!expanded||!/^Digit[1-9]$/.test(e.code))return;
    const f=current();if(!f||!Object.hasOwn(activeOverlays,f.key))return;
    const slot=Number(e.code.slice(-1))-1;
    if(slot<f.def.skills.length){queued={f,slot};e.preventDefault();}
  });
  setInterval(()=>{
    const f=current();const changed=f&&Object.hasOwn(activeOverlays,f.key)&&(f.def.skills?.length>4||!!activeOverlays[f.key]?.skillMode);
    if(!changed){panel.hidden=true;queued=null;return;}
    panel.hidden=false;
    const mode=f.def.pool?.length?'順番':'固定';
    label.textContent=f.def.name+' · '+f.def.skills.length+'技 · '+mode;
    const sig=f.key+'|'+mode+'|'+f.def.skills.map(s=>s?.name).join(';');
    if(sig===lastSig)return;lastSig=sig;list.replaceChildren();
    f.def.skills.forEach((s,i)=>{
      const b=make('button','',String(i+1).padStart(2,'0')+' · '+String(s?.name||'新技'));b.type='button';
      b.addEventListener('click',()=>{queued={f,slot:i};});list.append(b);
    });
  },220);
}
export function initChiefCharacterEditor(options){
  if(!options?.FIGHTERS||typeof document==='undefined')return;
  FIGHTERS=options.FIGHTERS;chiefCheck=options.isChief||(()=>false);tokenOf=options.roleToken||(()=> '');inBattle=options.inBattle||(()=>false);
  setupBattleSlotPanel(options);
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
