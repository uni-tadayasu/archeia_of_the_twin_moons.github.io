// Authored clips remain in local model space. The game owns movement and hit timing.
import { LoopOnce, LoopRepeat, MathUtils } from 'three';

const names={
 idle:['Idle','Sword_Idle','Idle_No_Loop'],
 walk:['Walk','Walk_Formal_Loop'],
 run:['Run','Sprint_Loop','Walk'],
 jump:['Jump','Jump_Loop','NinjaJump_Idle_Loop','Jump_Start'],
 takeoff:['Jump_Start'],
 land:['Jump_Land'],
 win:['Victory'],
 guard:['Guard','Idle_Shield_Loop','Sword_Block'],
 light:['LightAttack','Attack','Sword_Regular_A','Sword_Attack'],
 light2:['Sword_Regular_B','Attack','LightAttack','Sword_Regular_A'],
 heavy:['HeavyAttack','Sword_Regular_C','Attack','LightAttack'],
 punch:['Punch_Jab','Melee_Hook','Attack'],
 punch2:['Punch_Cross','Punch_Jab','Melee_Hook'],
 punch3:['Melee_Hook','Punch_Cross','HeavyAttack'],
 aim:['Pistol_Shoot','OverhandThrow','Attack'],
 dash:['Sword_Dash','Dash','Run'],
 chant:['Chant','Spell_Simple_Idle_Loop','Cast'],
 cast:['Cast','Spell_Simple_Shoot','Spell_Simple_Exit'],
 over:['Ougi','HeavyAttack','Spell_Simple_Shoot','Cast'],
 hi:['HiOugi','Ougi','HeavyAttack','Cast'],
 hit:['Hit','Hit_Chest','Hit_Knockback'],
 death:['Death','Death01']
};
const normalize=value=>String(value).toLowerCase().replace(/[^a-z0-9]/g,'');
const locomotion=new Set(['walk','run']);
const repeat=new Set(['idle','walk','run','chant','jump','guard']);
const adjusted=new WeakMap();

function inPlace(clip){
 if(adjusted.has(clip))return adjusted.get(clip);
 const tracks=clip.tracks.filter(track=>{
  if(!track.name.endsWith('.position')||track.getValueSize()!==3)return false;
  const node=normalize(track.name.split('.').slice(0,-1).join('.'));
  return /^(?:armature|root|rootmotion|hips|pelvis|mixamorighips|unitadayasuhips|rfroothips)$/.test(node);
 });
 if(!tracks.length){adjusted.set(clip,clip);return clip;}
 const chosen=new Set(tracks.map(t=>t.name));
 const copy=clip.clone();
 for(const track of copy.tracks){
  if(!chosen.has(track.name))continue;
  const v=track.values;
  for(let i=3;i<v.length;i+=3){v[i]=v[0];v[i+2]=v[2];}
 }
 adjusted.set(clip,copy);
 return copy;
}

export function collectMotionClips(clips=[]){
 const available=new Map(clips.filter(clip=>clip.duration>0).map(clip=>[normalize(clip.name),clip]));
 const result={};
 for(const [name,list] of Object.entries(names)){
  const clip=list.map(candidate=>available.get(normalize(candidate))).find(Boolean);
  if(clip)result[name]=inPlace(clip);
 }
 return result;
}

export function playMotion(actor,name,{duration=0,token=null,pace=1}={}){
 const requested=actor.clips[name];
 const clip=requested||(name==='run'?actor.clips.walk:null)||actor.clips.idle;
 if(!actor.mixer||!clip)return false;
 const old=actor.motionPlaying;
 const idleFallback=!requested&&clip===actor.clips.idle;
 if(idleFallback){name='idle';token=null;pace=1;}
 const loop=repeat.has(name)||clip===actor.clips.idle;
 const speed=duration>0&&!loop?MathUtils.clamp(clip.duration/duration,.55,6):pace;
 if(old?.name===name&&old.token===token){
  old.action.setEffectiveTimeScale(speed);
  return true;
 }
 const action=actor.mixer.clipAction(clip);
 const phase=old&&locomotion.has(old.name)&&locomotion.has(name)?old.action.time/old.clip.duration:0;
 const blend=old ? (loop ? .15 : .085) : 0;
 if(old?.action!==action||token!==old?.token){
  old?.action.fadeOut(blend);
  action.reset().setLoop(loop?LoopRepeat:LoopOnce,loop?Infinity:1);
  action.clampWhenFinished=!loop;
  action.time=phase*clip.duration;
  action.setEffectiveWeight(1).setEffectiveTimeScale(speed);
  if(blend&&old?.action!==action)action.fadeIn(blend);
  action.play();
 }else{
  action.setLoop(loop?LoopRepeat:LoopOnce,loop?Infinity:1).setEffectiveTimeScale(speed);
 }
 actor.curAction=action;
 actor.curAnim=name;
 actor.motionPlaying={clip,action,name,token};
 return true;
}

export function fighterMotion(f,requested){
 const action=f.action;
 if(f.dead)return f.clips.death?['death',1.05]:[requested];
 if(requested.startsWith('rf-'))return [requested,action?.dur,action];
 if(f.remoteAuth){
  if(f.remoteMotion?.until>performance.now())return [f.remoteMotion.name,.45,f.remoteMotion];
  return [requested];
 }
 if(f.stun>.06&&!f.guard&&f.clips.hit)return ['hit',.34];
 if(action?.type==='light'){
  const step=Math.max(0,Math.min(2,action.step||0));
  const brawler=/monk|wolf|brawler/.test(f.def.model||'');
  const name=f.def.light?.shots&&f.clips.aim?'aim':brawler?['punch','punch2','punch3'][step]:['light','light2','heavy'][step];
  return [f.clips[name]?name:'light',action.dur,action];
 }
 if(action?.type==='dash')return ['dash',action.dur,action];
 if(action?.type==='chant')return ['chant',action.dur,action];
 if(action?.type==='cast')return [action.motion||'cast',action.dur,action];
 if(f.guard&&f.clips.guard)return ['guard'];
 if(f.key==='tenshi'){
  const now=performance.now();
  if(f.battle?.ended&&f.clips.win&&f.battle.fighters.every(other=>other.team===f.team||other.dead))return ['win',1.4];
  if(requested==='jump'){
   if(!f.tenshiAirborne)f.tenshiJumpAt=now;
   f.tenshiAirborne=true;
   if(now-f.tenshiJumpAt<170&&f.clips.takeoff)return ['takeoff',.17];
  }else{
   if(f.tenshiAirborne){f.tenshiAirborne=false;f.tenshiLandUntil=now+200;}
   if(now<f.tenshiLandUntil&&f.clips.land)return ['land',.20];
  }
 }
 if(requested==='run'&&f.clips.walk&&f.vel.lengthSq()<Math.pow((f.def.speed||5)*.61,2))return ['walk'];
 return [requested];
}

// Static models without a bespoke rig use a subtle body pose on the visual wrapper.
export function animateStatic(actor,dt,{moving=false,fast=false,action=null,guard=false}={}){
 const instance=actor.modelInstance||actor.instance;
 if(!instance||actor.clips?.walk||actor.clips?.run||actor.valgardMotion||
    actor._rfMotionV17||actor._ksMotion||actor._udaMotion||actor._fujMotion)return;
 const wrapper=instance.wrapper;
 const base=actor.staticMotion||=( { y:wrapper.position.y,time:0,amount:0 } );
 const d=MathUtils.clamp(dt||0,0,.065);
 base.time+=d*(fast?13:8);
 base.amount=MathUtils.damp(base.amount,moving?1:0,13,d);
 const phase=MathUtils.clamp((action?.t||0)/(action?.dur||1),0,1);
 const strike=action?.type==='light'||action?.type==='dash'?Math.sin(phase*Math.PI):0;
 const chant=(action?.type==='cast'||action?.type==='chant') ? .05 : 0;
 wrapper.position.y=base.y+Math.abs(Math.sin(base.time))*.034*base.amount;
 wrapper.rotation.x=MathUtils.damp(wrapper.rotation.x,base.amount*.055+strike*.105+(guard ? .12 : 0)-chant,18,d);
 wrapper.rotation.z=MathUtils.damp(wrapper.rotation.z,Math.sin(base.time)*.029*base.amount+strike*.04,18,d);
}
