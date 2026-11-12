/* V55.11: apply stable geometry-changing appearances to the generated roster. */
import {FIGHTERS,ROSTER} from '../data.js?v=rf-minamoto-v48-20261111';
import {Fighter,Battle} from '../game.js?v=rf553-chief-cpu-20261111';
import {assignUniqueAppearances} from '../appearance-data.js';
import {applyCharacterVariant,disposeCharacterVariant} from '../character-variants.js';
if(!window.__rf561AppearanceReady){
 window.__rf561AppearanceReady=true;
 const general=Object.fromEntries(ROSTER.filter(key=>FIGHTERS[key]).map(key=>[key,FIGHTERS[key]]));
 const report=assignUniqueAppearances(general);
 window.RF561AppearanceStats={total:Object.keys(general).length,uniqueVariants:report.changed.length,baseModels:report.originals.length};
 const originalBuild=Fighter.prototype.buildModel;
 Fighter.prototype.buildModel=function(...args){
  const result=originalBuild.apply(this,args);
  const model=this.modelInstance?.model;
  if(this.def?.appearance&&model){
   try{applyCharacterVariant(model,this.def)}catch(err){console.warn('[RF561 unique fighter]',this.key,err)}
  }
  return result;
 };
 const originalDispose=Battle.prototype.dispose;
 Battle.prototype.dispose=function(...args){
  for(const fighter of this.fighters||[]){
   try{disposeCharacterVariant(fighter.modelInstance?.model)}catch(err){console.warn('[RF561 appearance cleanup]',err)}
  }
  return originalDispose.apply(this,args);
 };
}
