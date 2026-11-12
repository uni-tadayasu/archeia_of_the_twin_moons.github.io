// Minimal isolated runtime contract test; imports replaced with compatible mocks.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/assets/rf563-spatial.js','utf8').replace(/^import .*;\s*$/gm,'');
class Object3D{
 constructor(){this.children=[];this.parent=null;this.visible=true;this.position={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;return this},copy(o){this.x=o.x;this.y=o.y;this.z=o.z;return this},clone(){return {...this,set:this.set,copy:this.copy,clone:this.clone}}};this.rotation={x:0,y:0,z:0};this.scale={setScalar(){}};this.userData={};}
 add(...a){for(const x of a){this.children.push(x);x.parent=this;}return this}
 removeFromParent(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null}}
}
class Geometry{constructor(...x){this.args=x}dispose() {}}
class Material{constructor(args={}){Object.assign(this,args)}dispose(){}}
class Mesh extends Object3D{constructor(g,m){super();this.geometry=g;this.material=m}}
class Group extends Object3D{}
class Light extends Object3D{constructor(...x){super();this.intensity=x[1]}}
class TextureLoader{load(){return {wrapS:0,wrapT:0,anisotropy:0,colorSpace:''}}}
class Player{
 constructor(){this.pos={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;return this},copy(x){this.x=x.x;this.y=x.y;this.z=x.z;return this},clone(){return {x:this.x,y:this.y,z:this.z}}};this.root=new Group()}
}
class Field {
 constructor(scene){this.scene=scene;this.group=new Group();this.scene.add(this.group);this.own=[];this.houses=[{x:18,z:4,w:8,d:8},{x:-17,z:4,w:8,d:8}];this.followers=[];this.player=new Player();this.group.add(this.player.root);this.trail=[];this.townName='試験町';this.L=0;this.maze={V:[new Array(9).fill(true)]};this.goal={x:0,z:-500};this.o={chapter:1,onChest:(v)=>this.reward=v};}
 buildTown() {const g=new Group();this.group.add(g);return 1}
 buildDungeon(){return 2}
 resolve(){}
 regionAt(){return '町'}
 objective(){return 'dummy'}
 update(dt,inp){this.player.pos.x+=Number(inp?.mx||0)*dt;this.player.pos.z+=Number(inp?.mz||0)*dt;this.resolve(this.player.pos,.4);return 'ok'}
 dispose(){return 'disposed'}
 geo(g){this.own.push(g);return g}
 std(n){const m=new Material({color:n});this.own.push(m);return m}
}
class Battle{constructor(){this.scene=new Group();this.fx=new Group();this.scene.add(this.fx);this.fighters=[];}add(k,o){this.fighters.push(k);return {k}}dispose(){return 'done'}}
const THREE={TextureLoader,Group,Mesh,MeshStandardMaterial:Material,MeshBasicMaterial:Material,PlaneGeometry:Geometry,BoxGeometry:Geometry,CylinderGeometry:Geometry,SphereGeometry:Geometry,TorusGeometry:Geometry,AmbientLight:Light,PointLight:Light,DoubleSide:2,BackSide:1,RepeatWrapping:1,SRGBColorSpace:1,Vector3:class {}};
let nodes={};class E {constructor(id){this.id=id;this.hidden=false;this.classList={list:new Set(),contains(x){return this.list.has(x)},add(x){this.list.add(x)},remove(x){this.list.delete(x)}};this.textContent='';this.isConnected=true;this.children=[];this.dataset={}}append(...e){this.children.push(...e)}appendChild(e){this.append(e)}replaceChildren(...e){this.children=e}remove(){this.isConnected=false}setAttribute(){}}
const document={body:new E('body'),addEventListener(){},getElementById(id){return nodes[id]},createElement(){return new E('created')}};
const memory=new Map();
const ctx={THREE,Battle,Field,ARENA_R:14,window:{},document,navigator:{userAgent:'test',deviceMemory:8},localStorage:{getItem:(k)=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v))},console,Math,setTimeout:()=>0};
vm.createContext(ctx);vm.runInContext(source,ctx);
const b=new Battle();const a=b.add('rowen',{});assert(b.__rf563Room,'combat room absent');assert(b.__rf563Room.children.length>12,'room too sparse');b.dispose();
const f=new Field(new Group());f.buildTown();assert(f.__rf563Story,'story room absent');assert(f.__rf563Story.markers.length===2);
const marker=f.__rf563Story.markers[0];f.player.pos.set(marker.x,0,marker.z);f.update(1,{attack:true});assert(f.__rf563Story.mode,'portal did not enter');assert(f.__rf563Story.room.visible,'interior not shown');
f.player.pos.set(106,0,91);f.update(1.2,{attack:true});assert(!f.__rf563Story.locked,'lever failed');f.player.pos.set(98,0,88);f.update(.9,{attack:true});assert(f.__rf563Story.opened,'chest failed');assert(f.reward===36,'reward callback failed');
f.player.pos.set(102,0,100);f.update(1.2,{attack:true});assert(!f.__rf563Story.mode,'exit failed');
const given=f.reward;f.player.pos.set(marker.x,0,marker.z);f.update(1.2,{attack:true});assert(f.__rf563Story.opened,'claimed chest reset');f.player.pos.set(106,0,91);f.update(1.2,{attack:true});assert(!f.__rf563Story.chest.visible,'claimed chest visible again');assert(f.reward===given,'duplicate reward');f.dispose();
console.log('QA_OK combat 3D room, enter interior, lever, chest, exit, cleanup');
