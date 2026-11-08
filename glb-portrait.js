/** Exact-GLB character select portrait, rendered on-demand, not AI recoloring. */
import * as THREE from 'three';
import { instantiateModel, disposeModel } from './model-runtime.js?v=20261108-grand-four-v3';
const cache=new Map();
export async function renderExactPortrait(gltf,key){
  if(cache.has(key))return cache.get(key);
  const work=(async()=>{
    let renderer=null,instance=null;
    try{
      const scene=new THREE.Scene();
      instance=instantiateModel(gltf,3.8,null);
      scene.add(instance.wrapper);
      instance.wrapper.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(instance.wrapper);
      const size=box.getSize(new THREE.Vector3());
      const center=box.getCenter(new THREE.Vector3());
      if(!Number.isFinite(size.y)||size.y<=0)throw Error('モデルのサイズが無効');
      const camera=new THREE.PerspectiveCamera(32,3/4,.1,100);
      // Retain a full-body frame with ample space for long mechanical wings.
      const width=Math.max(size.x,size.z*.74),fit=Math.max(size.y*.64,width*.95);
      const dist=fit/Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*1.32;
      camera.position.set(center.x+dist*.19,center.y+size.y*.075,center.z+dist);
      camera.lookAt(center.x,center.y+size.y*.07,center.z);
      scene.add(new THREE.HemisphereLight(0xe7f3ff,0x363250,2.0));
      const keyLight=new THREE.DirectionalLight(0xffffff,3.3);keyLight.position.set(4,8,9);scene.add(keyLight);
      const rim=new THREE.DirectionalLight(0x976dff,2.1);rim.position.set(-6,6,-5);scene.add(rim);
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
      renderer.setPixelRatio(1);
      renderer.setSize(480,640,false);
      renderer.setClearColor(0x000000,0);
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.render(scene,camera);
      return renderer.domElement.toDataURL('image/webp',.91);
    }finally{
      if(instance)disposeModel(instance);
      renderer?.dispose();renderer?.forceContextLoss?.();
    }
  })().catch(e=>{cache.delete(key);throw e;});
  cache.set(key,work);
  return work;
}
