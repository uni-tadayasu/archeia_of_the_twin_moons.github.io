import {Field} from '../field.js?v=55.21';
if(!window.__rf558CGRuntime){
 window.__rf558CGRuntime=true;
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 function visualProfile(){
   const profile=window.RF556Graphics?.profile?.();
   return ['quality','balanced','economy'].includes(profile)?profile:'balanced';
 }
 const previousWilds=Field.prototype.buildWilds;
 if(typeof previousWilds==='function')Field.prototype.buildWilds=function(...args){
  const result=previousWilds.apply(this,args);
  if(visualProfile()==='economy')return result;
  try{
   let refined=0,visited=0;
   this.group?.traverse(o=>{
    if(visited>=3000)return;
    visited++;
    if(!o.isMesh||o.userData?.arkeiaModel||o.userData?.rf556Particle)return;
    const materials=Array.isArray(o.material)?o.material:[o.material];
    for(const material of materials){
     if(!material || material.userData?.rf558Refined || !material.isMeshStandardMaterial)continue;
     material.userData.rf558Refined=true;
     material.flatShading=false;
     // A readable painted-CG surface, avoiding plastic/metallic random primitives.
     material.roughness=clamp(Number(material.roughness)||.8,.60,.96);
     material.metalness=clamp(Number(material.metalness)||0,0,.17);
     material.needsUpdate=true;refined++;
    }
   });
   this.userData ||= {};
   this.userData.rf558RefinedMaterials=refined;
  }catch(e){console.warn('[Riftfall V55.8] Optional field shading skipped:',e?.message||String(e));}
  return result;
 };
}
