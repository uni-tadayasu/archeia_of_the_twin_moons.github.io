import { FIGHTERS, ROSTER } from '../data.js?v=rf-minamoto-v48-20261111';
import { finalizeModelQuality } from './celestial-model-quality.js';

const general = new Set(ROSTER.filter(key => !FIGHTERS[key]?.special && !FIGHTERS[key]?.enemy));
const paintedLight = /* glsl */ `
  vec3 rfPaintNormal = normalize(mix(nonPerturbedNormal, normal, 0.82));
  vec3 rfPaintView = normalize(vViewPosition);
  float rfPaintAngle = clamp(dot(rfPaintNormal, rfPaintView), 0.0, 1.0);
  float rfPaintRim = smoothstep(0.36, 0.94, 1.0 - rfPaintAngle);
  float rfPaintKey = smoothstep(-0.54, 0.78, dot(rfPaintNormal, vec3(-0.36, 0.63, 0.69)));
  float rfPaintLuma = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  float rfPaintRoom = 1.0 / (1.0 + 0.82 * max(0.0, rfPaintLuma));
  vec3 rfPaintGrade = mix(vec3(0.87, 0.95, 1.075), vec3(1.105, 1.04, 0.953), rfPaintKey);
  vec3 rfPaintBounce = diffuseColor.rgb * (0.025 + 0.035 * rfPaintKey) * (1.0 - metalnessFactor * 0.66);
  vec3 rfPaintEdge = vec3(0.035, 0.055, 0.079) * rfPaintRim * (0.42 + 0.58 * rfPaintKey);
  outgoingLight = max(vec3(0.0), outgoingLight * rfPaintGrade + (rfPaintBounce + rfPaintEdge) * rfPaintRoom);
  #include <opaque_fragment>
`;

function paint(shader) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', paintedLight);
}

// Retain the authored textures, mesh, skin weights and rig. Only cloned
// standard/physical materials for the general roster receive this finish.
export function finishIllustratedModel(instance, key) {
  if (!instance?.model) return;
  if (!general.has(key)) { finalizeModelQuality(instance); return; }
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
    // Authored packed roughness/metal maps already separate skin from armor.
    // Keep their range rather than flattening the entire atlas into matte cloth.
    material.roughness = source.roughnessMap ? source.roughness : Math.max(polished ? .28 : .58, source.roughness);
    material.metalness = source.metalnessMap ? source.metalness : Math.min(polished ? .72 : .21, source.metalness);
    if (material.aoMap) material.aoMapIntensity *= .94;
    material.envMapIntensity = Math.min(polished ? 1.08 : .88, source.envMapIntensity);
    material.onBeforeCompile = paint;
    material.customProgramCacheKey = () => 'riftfall-celestial-illustration-56.3';
    copies.set(source, material);
    instance.materials.add(material);
    return material;
  }
  instance.model.traverse(node => {
    if (node.isMesh) node.material = Array.isArray(node.material) ? node.material.map(finish) : finish(node.material);
  });
  finalizeModelQuality(instance);
}
