import { FIGHTERS, ROSTER } from '../data.js?v=rf-minamoto-v48-20261111';

const general = new Set(ROSTER.filter(key => !FIGHTERS[key]?.special && !FIGHTERS[key]?.enemy));
const paintedLight = /* glsl */ `
  vec3 rfPaintNormal = normalize(mix(nonPerturbedNormal, normal, 0.46));
  vec3 rfPaintView = normalize(vViewPosition);
  float rfPaintAngle = clamp(dot(rfPaintNormal, rfPaintView), 0.0, 1.0);
  float rfPaintRim = smoothstep(0.36, 0.94, 1.0 - rfPaintAngle);
  float rfPaintKey = smoothstep(-0.54, 0.78, dot(rfPaintNormal, vec3(-0.36, 0.63, 0.69)));
  float rfPaintLuma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  float rfPaintRoom = 1.0 / (1.0 + 0.82 * max(0.0, rfPaintLuma));
  vec3 rfPaintGrade = mix(vec3(0.87, 0.95, 1.075), vec3(1.105, 1.04, 0.953), rfPaintKey);
  vec3 rfPaintBounce = diffuseColor.rgb * (0.055 + 0.055 * rfPaintKey) * (1.0 - metalnessFactor * 0.66);
  vec3 rfPaintEdge = vec3(0.054, 0.083, 0.119) * rfPaintRim * (0.42 + 0.58 * rfPaintKey);
  outgoingLight = max(vec3(0.0), outgoingLight * rfPaintGrade + (rfPaintBounce + rfPaintEdge) * rfPaintRoom);
  #include <opaque_fragment>
`;

function paint(shader) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', paintedLight);
}

// Retain the authored textures, mesh, skin weights and rig. Only cloned
// standard/physical materials for the general roster receive this finish.
export function finishIllustratedModel(instance, key) {
  if (!instance?.model || !general.has(key)) return;
  const copies = new Map();
  function finish(source) {
    if ((!source?.isMeshStandardMaterial && !source?.isMeshPhysicalMaterial) || source.userData.rf5527Painted) return source;
    if (copies.has(source)) return copies.get(source);
    const material = source.clone();
    delete material.userData.appearanceId;
    material.userData.rf5527Painted = true;
    const polished = /metal|gold|silver|steel|armor|blade|brass|jewel|銅|金具|刀|甲冑/i.test(source.name) ||
      source.metalness > .22;
    material.flatShading = false;
    material.roughness = polished ? Math.max(.31, source.roughness) : Math.max(.65, source.roughness);
    material.metalness = Math.min(polished ? .62 : .21, source.metalness);
    if (material.normalMap) material.normalScale.multiplyScalar(polished ? .94 : .82);
    if (material.aoMap) material.aoMapIntensity *= .86;
    material.envMapIntensity = Math.min(polished ? .98 : .78, source.envMapIntensity);
    material.onBeforeCompile = paint;
    material.customProgramCacheKey = () => 'riftfall-illustration-55.27';
    copies.set(source, material);
    instance.materials.add(material);
    return material;
  }
  instance.model.traverse(node => {
    if (node.isMesh) node.material = Array.isArray(node.material) ? node.material.map(finish) : finish(node.material);
  });
}
