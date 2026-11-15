const MAX_DRAW_PIXELS = 3_600_000;
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function renderPixelCeiling(width, height, preferred, maxPixels = MAX_DRAW_PIXELS) {
  const area = Math.max(1, finite(width, 1)) * Math.max(1, finite(height, 1));
  const request = Math.max(.25, Math.min(3, finite(preferred, 1)));
  return Math.min(request, Math.sqrt(Math.max(1, finite(maxPixels, MAX_DRAW_PIXELS)) / area));
}

export function createRenderBudget({ maxPixels = MAX_DRAW_PIXELS } = {}) {
  let ceiling = 1;
  let ratio = 1;
  let renderClock = 0;
  let sampleClock = 0;
  let averageDelta = 0;
  let fastWindows = 0;

  return {
    get ratio() { return ratio; },
    resize(width, height, preferred, reset = false) {
      const next = renderPixelCeiling(width, height, preferred, maxPixels);
      if (reset) {
        ratio = next;
        sampleClock = 0;
        averageDelta = 0;
        fastWindows = 0;
      } else if (next !== ceiling) ratio = Math.min(next, Math.max(Math.min(.5, next), ratio + next - ceiling));
      ceiling = next;
      return ratio;
    },
    frame(delta, fps, visible, active) {
      if (!visible) {
        renderClock = 0;
        sampleClock = 0;
        averageDelta = 0;
        fastWindows = 0;
        return false;
      }
      if (!Number.isFinite(delta) || delta <= 0) return false;
      const interval = 1 / Math.max(1, Math.min(240, finite(fps, 60)));
      if (active && delta < .25) {
        averageDelta = averageDelta ? averageDelta + (delta - averageDelta) * .055 : delta;
        sampleClock += delta;
        if (sampleClock >= 2.5) {
          sampleClock = 0;
          if (averageDelta > interval * 1.17) {
            ratio = Math.max(Math.min(.5, ceiling), ratio - .1);
            fastWindows = 0;
          } else if (averageDelta <= interval * 1.015) {
            if (++fastWindows >= 2) {
              ratio = Math.min(ceiling, ratio + .07);
              fastWindows = 0;
            }
          } else fastWindows = 0;
        }
      } else {
        sampleClock = 0;
        averageDelta = 0;
        fastWindows = 0;
      }
      renderClock += Math.min(delta, interval * 2);
      if (renderClock + 1e-6 < interval) return false;
      renderClock = Math.max(0, Math.min(interval, renderClock - interval));
      return true;
    }
  };
}

export function createStageReflections(THREE, scene, loader, { maxEntries = 3, textureWidth = 512 } = {}) {
  const cache = new Map();
  let currentUrl = null, disposed = false;
  const limit = Math.max(1, Math.floor(finite(maxEntries, 3)));
  const width = Math.max(64, Math.min(512, finite(textureWidth, 512)));

  function evict() {
    while (cache.size > limit) {
      const key = [...cache.keys()].find(value => value !== currentUrl);
      if (!key) break;
      const entry = cache.get(key);entry.retired = true;entry.texture?.dispose();cache.delete(key);
    }
  }
  function setReflections(url) {
    if (disposed || currentUrl === url) return;
    currentUrl = url || null;
    // Never retain another stage's coloured lighting while a new map loads.
    scene.environment = null;
    if (!url) return;
    let entry = cache.get(url);
    if (entry) {
      cache.delete(url);cache.set(url, entry);
      if (entry.texture) scene.environment = entry.texture;
      return;
    }
    entry = { texture: null, retired: false };cache.set(url, entry);evict();
    loader.loadAsync(url).then(source => {
      if (disposed || entry.retired) {source.dispose();return;}
      let texture = source;
      try {
        // A compact panorama supplies soft reflection colours without decoding
        // another full-resolution image every time a stage card is previewed.
        const canvas = document.createElement('canvas');canvas.width = width;canvas.height = width / 2;
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
          texture = new THREE.CanvasTexture(canvas);source.dispose();
        }
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        entry.texture = texture;
        if (currentUrl === url) scene.environment = texture;
      } catch (error) {
        texture.dispose();
        if (cache.get(url) === entry) cache.delete(url);
        if (currentUrl === url) {currentUrl = null;scene.environment = null;}
      }
    }).catch(() => {
      if (cache.get(url) === entry) cache.delete(url);
      if (currentUrl === url && !entry.retired) {currentUrl = null;scene.environment = null;}
    });
  }
  setReflections.dispose = () => {
    disposed = true;currentUrl = null;scene.environment = null;
    for (const entry of cache.values()) {entry.retired = true;entry.texture?.dispose();}
    cache.clear();
  };
  Object.defineProperty(setReflections, 'cacheSize', {get: () => cache.size});
  return setReflections;
}

export function contactShadowMetrics(fighter, arenaRadius, maze = false) {
  const x = Number(fighter?.pos?.x), z = Number(fighter?.pos?.z);
  if (fighter?.dead || fighter?.root?.visible === false || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  const height = Math.max(0, finite(fighter.y, 0));
  const lift = Math.min(1.5, height);
  const width = Math.min(3.8, Math.max(.8, finite(fighter.radius, .5) * 3)) * (1 + lift * .24);
  const edge = maze ? 1 : Math.max(0, Math.min(1, (Math.max(0, finite(arenaRadius, 13)) - Math.hypot(x, z)) / (width * .5)));
  const opacity = .54 * edge / (1 + height * 1.45);
  if (opacity <= .025) return null;
  return { x: x - lift * .11, y: maze ? .062 : .022, z: z - lift * .08, width, opacity };
}

export function createContactShadows(THREE, scene, arenaRadius) {
  const size = 48;
  const pixels = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + .5) / size * 2 - 1;
      const v = (y + .5) / size * 2 - 1;
      const falloff = Math.max(0, 1 - u * u - v * v);
      const soft = falloff ** 3;
      pixels[y * size + x] = Math.round(255 * (.79 * soft + .21 * soft ** 4));
    }
  }
  const map = new THREE.DataTexture(pixels, size, size, THREE.RedFormat);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;

  const group = new THREE.Group();
  group.name = 'Fighter ground-contact shadows';
  scene.add(group);
  const material = new THREE.MeshBasicMaterial({ color: 0x100e16, map, transparent: true, depthWrite: false, toneMapped: false });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float contactOpacity;\nvarying float vContactOpacity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvContactOpacity = contactOpacity;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vContactOpacity;')
      .replace('#include <map_fragment>', 'diffuseColor.a *= texture2D(map, vMapUv).r * vContactOpacity;');
  };
  material.customProgramCacheKey = () => 'riftfall-contact-shadow-55.30';
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -.61);
  const matrix = new THREE.Matrix4();
  let batch;
  let opacityAttribute;
  let capacity = 0;

  function growBatch(count) {
    if (batch) {
      batch.removeFromParent();
      batch.geometry.dispose();
      batch.dispose();
    }
    capacity = Math.max(8, 2 ** Math.ceil(Math.log2(count)));
    const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    opacityAttribute = new THREE.InstancedBufferAttribute(new Uint8Array(capacity), 1, true).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('contactOpacity', opacityAttribute);
    batch = new THREE.InstancedMesh(geometry, material, capacity);
    batch.name = 'Instanced fighter shadows';
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // The instances move across the arena and maze. Clipping four vertices per
    // shadow costs less than rebuilding the batch bounds every draw.
    batch.frustumCulled = false;
    batch.renderOrder = -1;
    group.add(batch);
  }

  return function updateContactShadows(battle, arenaVisible) {
    const maze = Boolean(battle?.rf568Maze);
    const fighters = (maze || arenaVisible) && battle?.fighters;
    if (!fighters?.length) {
      group.visible = false;
      return;
    }
    if (fighters.length > capacity) growBatch(fighters.length);

    let count = 0;
    for (const fighter of fighters) {
      const shadow = contactShadowMetrics(fighter, arenaRadius, maze);
      if (!shadow) continue;
      const { width, opacity } = shadow;
      position.set(shadow.x, shadow.y, shadow.z);
      scale.set(width, 1, width * .80);
      matrix.compose(position, orientation, scale);
      batch.setMatrixAt(count, matrix);
      opacityAttribute.array[count] = Math.round(opacity * 255);
      count++;
    }
    batch.count = count;
    group.visible = count > 0;
    if (!count) return;
    batch.instanceMatrix.clearUpdateRanges();
    batch.instanceMatrix.addUpdateRange(0, count * 16);
    batch.instanceMatrix.needsUpdate = true;
    opacityAttribute.clearUpdateRanges();
    opacityAttribute.addUpdateRange(0, count);
    opacityAttribute.needsUpdate = true;
  };
}
