/* Riftfall Arena V55.14 — preserve authored GLB faces and rigged motion,
   render general fighters with smooth shaded materials and consistent variants
   in battle, story field, remote-visible actors and character selection. */
import {FIGHTERS} from '../data.js?v=rf-minamoto-v48-20261111';
import {Fighter} from '../game.js?v=rf553-chief-cpu-20261111';
import {Field} from '../field.js?v=rf-v9-2-20261109';
import {applyCharacterVariant,disposeCharacterVariant} from '../character-variants.js';
if(!window.__rf564CharacterMaterials){
 window.__rf564CharacterMaterials=true;
 const low=/Android|iPhone|iPad/i.test(navigator.userAgent)||(navigator.deviceMemory||8)<=4;
 function improve(model){
   if(!model)return;
   model.traverse(node=>{
     if(!node.isMesh)return;
     node.frustumCulled=node.isSkinnedMesh?false:node.frustumCulled;
     for(const mat of (Array.isArray(node.material)?node.material:[node.material])){
       if(!mat || !mat.isMaterial)continue;
       if(mat.flatShading){mat.flatShading=false;mat.needsUpdate=true;}
       if(mat.roughness!==undefined && Number.isFinite(mat.roughness)){
         mat.roughness=Math.min(1,Math.max(.42,mat.roughness));
       }
       // glTF UVs remain untouched; mipmaps/anisotropy only improve texture clarity.
       if(mat.map && mat.map.isTexture)mat.map.anisotropy=Math.max(mat.map.anisotropy||1,low?2:6);
     }
   });
 }
 const oldBuild=Fighter.prototype.buildModel;
 Fighter.prototype.buildModel=function(...args){
   const result=oldBuild.apply(this,args);
   try{improve(this.modelInstance?.model)}catch(e){console.warn('[RF564 fighter quality]',e)}
   return result;
 };
 function allActors(field){
   return [field.player,...(field.followers||[]),...(field.npcs||[]),...(field.syms||[]),field.boss]
     .filter(x=>x?.model);
 }
 function actorKey(field,actor){
   if(actor===field.player)return field.o?.mainKey;
   const i=field.followers?.indexOf(actor)??-1;
   if(i>=0)return (field.o?.partyKeys||[]).filter(k=>k!==field.o?.mainKey)[i];
   const n=field.npcs?.indexOf(actor)??-1;
   if(n>=0)return field.o?.npcKeys?.[n%field.o.npcKeys.length];
   if(actor.key)return actor.key;
   if(actor===field.boss)return field.o?.ch?.enemies?.[0]?.k;
   return null;
 }
 const oldFieldBuild=Field.prototype.buildActors;
 Field.prototype.buildActors=function(...args){
   const result=oldFieldBuild.apply(this,args);
   const variants=[];
   for(const actor of allActors(this)){
     const key=actorKey(this,actor),def=FIGHTERS[key];
     if(def?.appearance){
       try{applyCharacterVariant(actor.model,def);variants.push(actor.model)}
       catch(e){console.warn('[RF564 story appearance]',key,e)}
     }
     try{improve(actor.model)}catch(e){console.warn('[RF564 story actor quality]',key,e)}
   }
   this.__rf564VariantModels=variants;
   return result;
 };
 const oldFieldDispose=Field.prototype.dispose;
 Field.prototype.dispose=function(...args){
   for(const model of this.__rf564VariantModels||[]){
     try{disposeCharacterVariant(model)}catch{}
   }
   this.__rf564VariantModels=[];
   return oldFieldDispose.apply(this,args);
 };
 window.RF564CharacterQuality={version:'55.14',originalGLBTextures:true,smoothAppearance:true};
}
