// Shared between the game and Worker permission checks.
export const TENSHI_KEY = 'tenshi';
export const DIVINE_ELEMENT = 10;
const art = (name, kind, divine, properties) => ({
  name, kind, divine, elem:DIVINE_ELEMENT, vivid:true, ...properties
});
export function tenshiDefinition() {
  return {
    name:'天子', title:'双月の天儀を司る者',
    model:'assets/models/tenshi.glb', face:'assets/portraits/tenshi.webp',
    attribute:'神', element:DIVINE_ELEMENT, tint:null, color:0xf4d694,
    height:1.79, hp:1180, speed:6.15, power:1.03, armor:.94,
    overGain:1.08, fluxMul:1.06, locked:true, special:'chief', fixedSlots:true,
    light:{name:'日輪連掌',range:2.28,dmg:43,color:0xffd490,elem:DIVINE_ELEMENT},
    skills:[
      art('暁光の矢','projectile','arrow',{cost:17,castTime:.42,dmg:68,count:1,speed:25,radius:.57,visual:'orb',color:0xffd398}),
      art('星踏み','dash','step',{cost:20,castTime:.37,dmg:99,speed:19,dur:.29,color:0xc7e8ff}),
      art('神紋・星環','tenshi_seal','seal',{cost:25,castTime:.74,dmg:124,radius:3.3,reach:9,delay:.49,color:0xe8c8fb}),
      art('月弧の返し','projectile','moon',{cost:27,castTime:.55,dmg:51,count:3,spreadAng:.13,speed:19,radius:.65,visual:'crescent',color:0xb9e0ff}),
      art('晨光の祈り','heal','mercy',{cost:32,castTime:.75,heal:135,radius:4.5,color:0xb9e9c9})
    ],
    over:art('皇天・暁界','tenshi_seal','dawn',{cost:0,castTime:1.23,dmg:252,radius:5.25,reach:9.3,delay:.62,color:0xffd891}),
    hi:art('双月神楽・天照','tenshi_seal','eclipse',{cost:0,castTime:1.62,dmg:209,echo:136,radius:5.65,reach:9.3,delay:.64,color:0xd4e4ff,hi:true})
  };
}
