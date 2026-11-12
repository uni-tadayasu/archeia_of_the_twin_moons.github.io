import { FIGHTERS, ROSTER } from '../data.js?v=rf-minamoto-v48-20261111';
const general=new Set(ROSTER.filter(key=>!FIGHTERS[key]?.special&&!FIGHTERS[key]?.enemy));
const paintedLight=[
 'vec3 rfInkNormal = normalize(mix(nonPerturbedNormal, normal, 0.38));',
 'float rfEdge = pow(1.0 - clamp(dot(rfInkNormal, normalize(vViewPosition)), 0.0, 1.0), 2.4);',
 'float rfKey = smoothstep(-0.48, 0.76, dot(rfInkNormal, normalize(vec3(-0.38, 0.59, 0.69))));',
 'float rfLightness = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));',
 'outgoingLight = max(vec3(0.0), mix(vec3(rfLightness), outgoingLight, 0.97) * mix(vec3(0.86, 0.94, 1.07), vec3(1.12, 1.035, 0.91), rfKey));',
 'outgoingLight += diffuseColor.rgb * (0.055 + 0.03 * rfKey);',
 'outgoingLight += vec3(0.34, 0.47, 0.59) * rfEdge * (0.055 + 0.12 * rfKey);',
 '#include <opaque_fragment>'
].join('\n');
function paint(shader){
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',paintedLight);
}
// Keep the original texture, geometry and skinning on each GLB instance.
export function finishIllustratedModel(instance,key){
 if(!instance?.model||!general.has(key))return;
 const copies=new Map();
 const finish=source=>{
  if(!source?.isMeshStandardMaterial&&!source?.isMeshPhysicalMaterial)return source;
  if(copies.has(source))return copies.get(source);
  const m=source.clone();
  delete m.userData.appearanceId;
  m.flatShading=false;
  m.roughness=Math.max(.68,source.roughness);
  m.metalness=Math.min(.15,source.metalness);
  if(m.normalMap)m.normalScale.multiplyScalar(.64);
  if(m.aoMap)m.aoMapIntensity*=.74;
  m.envMapIntensity=Math.min(.72,source.envMapIntensity);
  m.onBeforeCompile=paint;
  m.customProgramCacheKey=()=> 'riftfall-illustration-55.21';
  copies.set(source,m);instance.materials.add(m);
  return m;
 };
 instance.model.traverse(node=>{
  if(node.isMesh)node.material=Array.isArray(node.material)?node.material.map(finish):finish(node.material);
 });
}
