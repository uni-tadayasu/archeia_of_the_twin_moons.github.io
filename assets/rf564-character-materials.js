import { Fighter } from '../game.js?v=55.21';
import { finishIllustratedModel } from './rf5520-illustrated-material.js?v=55.21';
const build=Fighter.prototype.buildModel;
Fighter.prototype.buildModel=function(...args){
 const result=build.apply(this,args);
 finishIllustratedModel(this.modelInstance,this.key);
 return result;
};
