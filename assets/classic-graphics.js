// Surface detail for the original game. No scene replacement, camera changes,
// character tinting, gameplay hooks, or persistent settings are introduced.
export function createClassicSurfaceFinish(THREE, renderer, {
  getQuality = () => 'high', isTouch = false, loader = new THREE.TextureLoader()
} = {}) {
  const records = new Map();
  const supported = Math.max(1, renderer.capabilities?.getMaxAnisotropy?.() || 1);
  let normal = null, pending = null, disposed = false;
  const quality = () => ['low','standard','high'].includes(getQuality()) ? getQuality() : 'standard';
  function update(record) {
    if (disposed) return;
    const selected = quality(), material = record.material;
    const anisotropy = Math.min(supported, selected === 'low' ? 1 : selected === 'high' && !isTouch ? 8 : 4);
    if (material.map && material.map.anisotropy !== anisotropy) {material.map.anisotropy = anisotropy;material.map.needsUpdate = true;}
    const enabled = selected !== 'low' && normal;
    if (enabled && !record.detail) {
      record.detail = normal.clone();record.detail.wrapS = record.detail.wrapT = THREE.RepeatWrapping;
      if (material.map) {record.detail.repeat.copy(material.map.repeat);record.detail.offset.copy(material.map.offset);}
      record.detail.anisotropy = anisotropy;record.detail.needsUpdate = true;
    }
    if (record.detail && record.detail.anisotropy !== anisotropy) {record.detail.anisotropy = anisotropy;record.detail.needsUpdate = true;}
    const desired = enabled ? record.detail : record.original;
    if (material.normalMap !== desired) {material.normalMap = desired;material.needsUpdate = true;}
    if (enabled) material.normalScale?.set(.14, .14);
    else if (record.normalScale) material.normalScale?.copy(record.normalScale);
  }
  function ensureNormal() {
    if (disposed || pending || normal || quality() === 'low') return;
    pending = loader.loadAsync('assets/rf556/terrain-normal.webp').then(texture => {
      if (disposed) {texture.dispose();return;}
      // A normal map contains vector data; it must not receive sRGB decoding.
      texture.colorSpace = THREE.NoColorSpace;normal = texture;
      for (const record of records.values()) update(record);
    }).catch(() => { /* Keep the authored surface if optional detail is unavailable. */ })
      .finally(() => {pending = null;});
  }
  return {
    apply(material) {
      if (disposed || !material?.isMeshStandardMaterial || records.has(material)) return;
      const record = {material, original:material.normalMap || null, normalScale:material.normalScale?.clone(), detail:null};
      records.set(material,record);update(record);ensureNormal();
    },
    refresh() {for (const record of records.values()) update(record);ensureNormal();},
    dispose() {
      if (disposed) return;disposed = true;
      for (const record of records.values()) {
        if (record.material.normalMap === record.detail) {record.material.normalMap = record.original;record.material.needsUpdate = true;}
        if (record.normalScale) record.material.normalScale?.copy(record.normalScale);
        record.detail?.dispose();
      }
      records.clear();normal?.dispose();normal = null;
    }
  };
}
