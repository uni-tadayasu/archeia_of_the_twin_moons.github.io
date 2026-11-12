const MAX_DRAW_PIXELS = 3_600_000;

export function createRenderBudget() {
  let ceiling = 1;
  let ratio = 1;
  let renderClock = 0;
  let sampleClock = 0;
  let averageDelta = 0;
  let fastWindows = 0;

  return {
    get ratio() { return ratio; },
    resize(width, height, preferred, reset = false) {
      const next = Math.min(preferred, Math.sqrt(MAX_DRAW_PIXELS / (width * height)));
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
      if (delta <= 0) return false;
      const interval = 1 / fps;
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

export function createStageReflections(THREE, scene, loader) {
  const cache = new Map();
  let currentUrl = null;

  return function setReflections(url) {
    if (currentUrl === url) return;
    currentUrl = url;
    if (!url) {
      scene.environment = null;
      return;
    }
    let entry = cache.get(url);
    if (!entry) {
      entry = { texture: null };
      cache.set(url, entry);
      loader.loadAsync(url).then((source) => {
        // Specular lighting needs the low-frequency colors of the panorama.
        // Downsample before Three.js builds the prefiltered reflection texture.
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        if (context) context.drawImage(source.image, 0, 0, canvas.width, canvas.height);
        const texture = context ? new THREE.CanvasTexture(canvas) : source;
        if (context) source.dispose();
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        entry.texture = texture;
        if (currentUrl === url) scene.environment = texture;
      }).catch(() => {
        cache.delete(url);
        if (currentUrl === url) currentUrl = null;
      });
    }
    if (entry.texture) scene.environment = entry.texture;
  };
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
      if (fighter.dead || fighter.root?.visible === false) continue;
      const { x, z } = fighter.pos;
      const height = Math.max(0, fighter.y);
      const lift = Math.min(1.5, height);
      const width = Math.min(3.8, Math.max(.8, fighter.radius * 3)) * (1 + lift * .24);
      const edge = maze ? 1 : Math.max(0, Math.min(1, (arenaRadius - Math.hypot(x, z)) / (width * .5)));
      const opacity = .54 * edge / (1 + height * 1.45);
      if (opacity <= .025) continue;

      position.set(x - lift * .11, maze ? .062 : .022, z - lift * .08);
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
