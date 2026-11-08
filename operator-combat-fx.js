/** Effects-only layer for the operator-only Gigantes. Damage & multiplayer
 * remain authoritative in Battle.executeCast and Cloudflare Worker. */
import * as THREE from 'three';
const COLOR=0xdd69ff;
const UP=new THREE.Vector3(0,1,0);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function lineFx(b,start,end,color=COLOR,width=.18,duration=.48){
  if(!b?.fx||!b?.addEffect)return;
  const dir=end.clone().sub(start),distance=dir.length();
  if(distance<.001)return;
  const length=Math.min(distance,44);
  const geom=new THREE.CylinderGeometry(width*.68,width,length,10,1,true);
  const core=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geom,core);
  mesh.position.copy(start).addScaledVector(dir.normalize(),length*.5);
  mesh.quaternion.setFromUnitVectors(UP,dir);
  const haloGeo=new THREE.CylinderGeometry(width*1.9,width*1.9,length,10,1,true);
  const haloMat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.19,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  const halo=new THREE.Mesh(haloGeo,haloMat);halo.position.copy(mesh.position);halo.quaternion.copy(mesh.quaternion);
  b.fx.add(mesh,halo);let t=0;
  b.addEffect(dt=>{
    t+=dt;const left=1-clamp(t/duration,0,1);
    core.opacity=.94*left;haloMat.opacity=.22*left;
    mesh.scale.setScalar(1+.25*Math.sin(t*38));
    if(left>0)return true;
    mesh.removeFromParent();halo.removeFromParent();geom.dispose();haloGeo.dispose();core.dispose();haloMat.dispose();return false;
  });
}
function burst(b,pos,radius=1.4,color=COLOR){
  if(!b?.fx||!b?.addEffect)return;
  const geo=new THREE.TorusGeometry(1,.09,8,48);
  const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.95,depthWrite:false,blending:THREE.AdditiveBlending});
  const o=new THREE.Mesh(geo,mat);o.position.copy(pos);o.rotation.x=Math.PI/2;b.fx.add(o);
  let t=0;b.addEffect(dt=>{t+=dt;o.scale.setScalar(.25+radius*t*2.3);mat.opacity=1-clamp(t/.52,0,1);if(t<.52)return true;o.removeFromParent();geo.dispose();mat.dispose();return false;});
}
function funnels(b,f,end){
  const root=new THREE.Group();b.fx.add(root);
  const geos=[],mats=[],drones=[];const count=6;
  for(let i=0;i<count;i++){
    const g=new THREE.OctahedronGeometry(.28,0);const m=new THREE.MeshStandardMaterial({color:0x504467,emissive:0xce68ff,emissiveIntensity:1.65,metalness:.45,roughness:.2});
    const unit=new THREE.Mesh(g,m);root.add(unit);geos.push(g);mats.push(m);drones.push(unit);
  }
  let t=0,shot=0;
  b.addEffect(dt=>{
    t+=dt;shot+=dt;
    const center=f.root?.position||f.pos;
    drones.forEach((d,i)=>{
      const a=t*5.3+i*Math.PI*2/count;
      d.position.set(center.x+Math.cos(a)*2.8,Math.max(.7,f.y)+2.4+Math.sin(t*6+i)*.28,center.z+Math.sin(a)*2.8);
      d.rotation.y+=dt*7;
    });
    if(shot>.22&&t<1.4){shot=0;
      const idx=Math.floor(t*14)%count;lineFx(b,drones[idx].position,end,0xec98ff,.12,.22);
    }
    if(t<1.6)return true;
    root.removeFromParent();for(const g of geos)g.dispose();for(const m of mats)m.dispose();return false;
  });
}
function blade(b,f,target){
  const start=f.root?.position?.clone?.()||new THREE.Vector3(f.pos.x,f.y,f.pos.z);
  start.y+=(f.def?.height||3)*.67;
  const reach=target.clone().sub(start).normalize();
  const tip=start.clone().addScaledVector(reach,3.8);
  lineFx(b,start,tip,0xfc87ff,.26,.39);
  burst(b,tip,1.5,0xffa4fe);
}
export function installOperatorCombatFx(Battle){
  if(!Battle?.prototype||Battle.prototype.__rfGigantesFx)return;
  const before=Battle.prototype.executeCast;
  if(typeof before!=='function')return;
  Battle.prototype.executeCast=function(f,slot,net){
    const result=before.call(this,f,slot,net);
    if(f?.key!=='operator_gigantes'||this.ended||!this.fx)return result;
    try{
      f.valgardMotion?.triggerAttack(slot);
      const k=slot==='over'?'over':slot==='hi'?'hi':/^s\d$/.test(slot)?slot:slot?.startsWith('f')?'f':'other';
      const target=this.nearestEnemy?.(f);
      const pos=target?.pos?.clone?.()||new THREE.Vector3(f.pos.x+Math.sin(f.facing)*8,0,f.pos.z+Math.cos(f.facing)*8);
      pos.y=Math.max(.8,target?.y||.8)+1;
      const origin=f.pos.clone().setY(f.y+(f.def?.height||4)*.68);
      if(k==='s0'||k==='over'||k==='hi'){
        lineFx(this,origin,pos,k==='over'?0xffddff:0xde65ff,k==='over'?.68:.36,k==='over'?.72:.45);
        burst(this,pos,k==='over'?4.6:2.3);
      }else if(k==='s1')blade(this,f,pos);
      else if(k==='s2'||k==='f')funnels(this,f,pos);
      else if(k==='s3'){
        for(let i=0;i<6;i++){
          const q=pos.clone().add(new THREE.Vector3(Math.sin(i*2.4)*2.8,.5+Math.cos(i)*.8,Math.cos(i*2.4)*2.8));
          lineFx(this,origin,q,0xb48aff,.13,.55);
        }
        burst(this,pos,4.5);
      }
    }catch(error){console.warn('[Gigantes visual effect]',error);}
    return result;
  };
  Battle.prototype.__rfGigantesFx=true;
}
