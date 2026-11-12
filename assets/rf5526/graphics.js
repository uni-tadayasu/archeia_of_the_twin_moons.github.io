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
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const distance = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
      pixels.fill(255, index, index + 3);
      pixels[index + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - distance * distance), 3));
    }
  }
  const map = new THREE.DataTexture(pixels, size, size);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearFilter;
  map.needsUpdate = true;

  const group = new THREE.Group();
  group.name = 'Fighter ground-contact shadows';
  scene.add(group);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const shadows = [];

  return function updateContactShadows(battle, arenaVisible) {
    const maze = Boolean(battle?.rf568Maze);
    const fighters = (maze || arenaVisible) && battle?.fighters;
    group.visible = Boolean(fighters?.length);
    if (!group.visible) return;

    let count = 0;
    for (const fighter of fighters) {
      if (fighter.dead || fighter.root?.visible === false) continue;
      const { x, z } = fighter.pos;
      const height = Math.max(0, fighter.y);
      const width = Math.min(3.8, Math.max(.8, fighter.radius * 3)) * (1 + Math.min(1.5, height) * .24);
      const edge = maze ? 1 : Math.max(0, Math.min(1, (arenaRadius - Math.hypot(x, z)) / (width * .5)));
      const opacity = .52 * edge / (1 + height * 1.45);
      if (opacity <= .025) continue;

      let shadow = shadows[count];
      if (!shadow) {
        const material = new THREE.MeshBasicMaterial({ color: 0x100e16, map, transparent: true, depthWrite: false, toneMapped: false });
        shadow = new THREE.Mesh(geometry, material);
        shadow.rotation.x = -Math.PI / 2;
        shadow.renderOrder = -1;
        group.add(shadow);
        shadows.push(shadow);
      }
      count++;
      shadow.visible = true;
      shadow.material.opacity = opacity;
      shadow.position.set(x, maze ? .062 : .022, z);
      shadow.scale.set(width, width * .83, 1);
    }
    for (let i = count; i < shadows.length; i++) shadows[i].visible = false;
  };
}
