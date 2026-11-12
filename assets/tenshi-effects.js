import * as THREE from 'three';

const textures=new Map();
const tau=Math.PI*2;
const colors={
  gold:['#fff0c4','#ffb56a','#e66e56'],
  moon:['#e8f4ff','#9dd5ff','#b7a6f6'],
  jade:['#f5ffdf','#a4efd2','#68c7ad']
};
function ink(ctx,alpha,width,color,path){
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.lineWidth=width;ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=width*1.7;
  ctx.beginPath();path();ctx.stroke();
  ctx.shadowBlur=0;ctx.lineWidth=Math.max(1,width*.27);ctx.strokeStyle='#fff8e8';ctx.stroke();
  ctx.restore();
}
function seal(ctx,palette){
  const [white,a,b]=palette;
  const arc=(r,a,b)=>ctx.arc(0,0,r,a,b);
  ink(ctx,.66,9,a,()=>arc(195,0,tau));
  ink(ctx,.76,3,white,()=>arc(180,0,tau));
  ink(ctx,.33,4,b,()=>arc(123,0,tau));
  for(let i=0;i<12;i++){
    const turn=i*tau/12;
    ink(ctx,.57,4,i%2===0?a:b,()=>arc(151,turn+.055,turn+.39));
    ctx.save();ctx.rotate(turn);
    ink(ctx,.63,3,white,()=>{
      ctx.moveTo(139,-10);ctx.quadraticCurveTo(159,2,139,11);
      ctx.moveTo(180,0);ctx.lineTo(187,0);
    });
    ctx.restore();
  }
  for(const dir of [-1,1]){
    ctx.save();ctx.translate(dir*34,dir*12);ctx.rotate(dir*.28);
    ink(ctx,.79,8,dir===1?b:a,()=>{
      ctx.arc(0,0,53,1.1,4.6);
      ctx.quadraticCurveTo(2,-36,-6,49);
    });
    ctx.restore();
  }
}
function arc(ctx,palette){
  const [white,a,b]=palette;
  const shades=[b,a,white];
  for(let i=0;i<3;i++){
    const offset=i*13;
    ink(ctx,.46+i*.15,14-i*4,shades[i],()=>{
      ctx.moveTo(-207,56-offset);
      ctx.bezierCurveTo(-143,-131-offset,118,-158-offset,203,10-offset);
    });
  }
  ink(ctx,.50,4,b,()=>{
    ctx.moveTo(-161,76);ctx.bezierCurveTo(-85,-52,43,-107,157,-72);
  });
}
function beam(ctx,palette){
  const [white,a,b]=palette;
  const core=ctx.createRadialGradient(0,0,0,0,0,187);
  core.addColorStop(0,'#fffdeb');core.addColorStop(.13,white);
  core.addColorStop(.29,a+'b8');core.addColorStop(.52,b+'41');core.addColorStop(1,b+'00');
  ctx.save();ctx.scale(.48,1.22);ctx.fillStyle=core;ctx.fillRect(-210,-210,420,420);ctx.restore();
  for(let i=0;i<8;i++){
    const angle=i*tau/8+.17, len=i%2===0?180:92;
    ctx.save();ctx.rotate(angle);
    ink(ctx,.39,4,i%2===0?a:b,()=>{ctx.moveTo(9,0);ctx.quadraticCurveTo(len*.37,6,len,0);});
    ctx.restore();
  }
}
export function tenshiTexture(name){
  if(textures.has(name))return textures.get(name);
  const [,shape,paletteName]=name.split('-');
  const palette=colors[paletteName]||colors.gold;
  const painter={seal,arc,beam}[shape]||beam;
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  ctx.translate(256,256);ctx.lineCap='round';ctx.lineJoin='round';
  painter(ctx,palette);
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  textures.set(name,texture);
  return texture;
}
export const divinePalette=art=>['moon','seal','eclipse','step'].includes(art)?'moon':art==='mercy'?'jade':'gold';

export function tenshiImpact(presentation,position,art,radius){
  const palette=divinePalette(art);
  const ground=position.clone().setY(.092);
  const air=position.clone().setY(1.32);
  presentation.emit('tenshi-seal-'+palette,ground,0xffffff,radius*2.01,.72,{spin:.37});
  presentation.emit('tenshi-beam-'+palette,air,0xffffff,radius*.73,.63,
    {rise:.7,stretch:1.64,opacity:.84});
}
