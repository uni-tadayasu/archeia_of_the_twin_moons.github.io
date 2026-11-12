import { Fighter } from '../game.js?v=55.20';
import { finishIllustratedModel } from './rf5520-illustrated-material.js';
const build=Fighter.prototype.buildModel;
Fighter.prototype.buildModel=function(...args){
 const result=build.apply(this,args);
 finishIllustratedModel(this.modelInstance,this.key);
 return result;
};
