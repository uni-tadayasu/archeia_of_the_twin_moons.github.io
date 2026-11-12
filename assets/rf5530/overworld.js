import * as THREE from 'three';

const palettes = [
  [0x4d673e, 0xa1a267, 0xc2a475, 0x647b87],
  [0x536e49, 0xb7a577, 0xd2ae8d, 0x9398ae],
  [0x6f5736, 0xaf8b55, 0xd6a56c, 0x807c86],
  [0x879db0, 0xd4e0e5, 0xaba8a6, 0x9aaec2],
  [0xa77c4e, 0xe7c88f, 0xd7ad71, 0xae947b],
  [0x3b5844, 0x7d8462, 0xaa956c, 0x738b82],
  [0x5d4844, 0xa17f68, 0xb28769, 0x957977],
  [0x656c92, 0xafbdd5, 0xb6aaa8, 0x858eb1],
  [0x384f57, 0x678f83, 0x8d867b, 0x687e9d],
  [0x818f8a, 0xddd3ae, 0xd3b98c, 0xa3afbb]
];

export function landscapePalette(index) {
  const [shade, field, road, haze] = palettes[index % palettes.length];
  return {
    shade: new THREE.Color(shade), field: new THREE.Color(field),
    road: new THREE.Color(road), haze: new THREE.Color(haze)
  };
}

function hash(x, z, seed) {
  let n = Math.imul(x + seed * 57, 0x45d9f3b) ^ Math.imul(z - seed * 79, 0x119de1f3);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const u = x - ix, v = z - iz;
  const a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iz, seed), hash(ix + 1, iz, seed), a),
    THREE.MathUtils.lerp(hash(ix, iz + 1, seed), hash(ix + 1, iz + 1, seed), a), b
  );
}

export function terrainGeometry(bounds, palette, seed, compact) {
  const width = bounds.maxX - bounds.minX + 40;
  const depth = bounds.maxZ - bounds.minZ + 40;
  const center = (bounds.maxZ + bounds.minZ) / 2;
  const geo = new THREE.PlaneGeometry(width, depth, compact ? 30 : 44, compact ? 70 : 104);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color(), neutral = new THREE.Color(0xffffff);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = center - pos.getY(i);
    const large = noise(x * .024, z * .024, seed);
    const grain = noise(x * .082, z * .082, seed + 81);
    const value = THREE.MathUtils.clamp((large - .5) * 1.45 + grain * .42 + .27, .05, .96);
    color.copy(palette.shade).lerp(palette.field, value).lerp(neutral, .50).toArray(colors, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// A joined strip follows the original route centerline and shares one material.
export function roadRibbon(points, width, level, seed) {
  const samples = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i];
    const count = Math.ceil(Math.hypot(bx - ax, bz - az) / 6);
    for (let n = 1; n <= count; n++) {
      const f = n / count;
      samples.push([ax + (bx - ax) * f, az + (bz - az) * f]);
    }
  }
  const geo = new THREE.BufferGeometry();
  const positions = [], uvs = [], colors = [], indices = [];
  let distance = 0;
  for (let i = 0; i < samples.length; i++) {
    const [x, z] = samples[i];
    const [px, pz] = samples[Math.max(i - 1, 0)];
    const [nx, nz] = samples[Math.min(i + 1, samples.length - 1)];
    const tangent = Math.hypot(nx - px, nz - pz) || 1;
    const perpendicularX = (nz - pz) / tangent;
    const perpendicularZ = -(nx - px) / tangent;
    const segment = Math.hypot(nx - x, nz - z);
    const along = segment > 0 ? (perpendicularX * (nz - z) - perpendicularZ * (nx - x)) / segment : 1;
    const half = width * (.47 + noise(x * .19, z * .19, seed) * .09) / Math.max(.8, along);
    distance += Math.hypot(x - px, z - pz);
    for (const [u, v] of [[0, .55], [.16, .92], [.84, .95], [1, .57]]) {
      const offset = (u * 2 - 1) * half;
      positions.push(x + perpendicularX * offset, level, z + perpendicularZ * offset);
      uvs.push(u, distance / 6.3);
      const fleck = .88 + noise(x * .14, z * .14, seed + 12) * .19;
      colors.push(v * fleck, v * fleck, v * fleck);
    }
    if (i === 0) continue;
    for (let column = 0; column < 3; column++) {
      const a = (i - 1) * 4 + column;
      indices.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
    }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Four ranges sit outside gameplay bounds. Vertex colors bake distant haze.
export function buildRelief(field, bounds, palette, compact) {
  const material = field.mat(new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
  const lengths = [bounds.maxZ - bounds.minZ, bounds.maxX - bounds.minX];
  for (let edge = 0; edge < 4; edge++) {
    const alongZ = edge < 2;
    const sign = edge % 2 ? 1 : -1;
    const start = (alongZ ? bounds.minZ : bounds.minX) - 42;
    const length = lengths[Number(!alongZ)] + 84;
    const bound = alongZ ? (sign > 0 ? bounds.maxX : bounds.minX) : (sign > 0 ? bounds.maxZ : bounds.minZ);
    const columns = Math.ceil(length / (compact ? 14 : 10));
    const positions = [], colors = [], indices = [];
    const color = new THREE.Color();
    const rows = [3, 18, 37, 66, 113, 142];
    for (let row = 0; row < rows.length; row++) {
      for (let column = 0; column <= columns; column++) {
        const along = start + column / columns * length;
        const outward = bound + rows[row] * sign;
        const broad = noise(along * .022, edge + 11 * row, field.o.chapter + 51);
        const detail = noise(along * .064, edge + row, field.o.chapter + 39);
        const height = [-.25, 5, 18, 11, 34, -.35][row] + broad * [0, 9, 28, 13, 32, 0][row] + detail * [0, 3, 8, 3, 7, 0][row];
        positions.push(alongZ ? outward : along, height, alongZ ? along : outward);
        color.copy(palette.shade).lerp(palette.haze, [.38, .39, .62, .56, .87, .9][row] + broad * .05);
        color.multiplyScalar([.79, .95, .95, .86, 1.16, 1.02][row]);
        color.toArray(colors, colors.length);
      }
    }
    const stride = columns + 1;
    for (let row = 0; row < rows.length - 1; row++) {
      for (let column = 0; column < columns; column++) {
        const a = row * stride + column;
        indices.push(a, a + 1, a + stride, a + 1, a + stride + 1, a + stride);
      }
    }
    const geo = field.geo(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    const range = new THREE.Mesh(geo, material);
    range.name = 'Overworld distant relief';
    field.group.add(range);
  }
}

export function woodlandCrown(radius, height, evergreen) {
  const shape = evergreen ? [
    [.16, -.49], [.87, -.42], [.55, -.22], [.74, -.19], [.43, .02],
    [.58, .05], [.23, .28], [.3, .29], [.017, .5]
  ] : [
    [.10, -.50], [.72, -.38], [.99, -.13], [.91, .13], [.76, .32], [.45, .46], [.02, .5]
  ];
  const geo = new THREE.LatheGeometry(shape.map(([r, y]) => new THREE.Vector2(r * radius, y * height)), evergreen ? 12 : 11);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const phase = Math.atan2(z, x);
    const warp = 1 + .12 * Math.sin(phase * 3 + y * 3) + .07 * Math.cos(phase * 5 - y * 4);
    pos.setXYZ(i, x * warp + y * .11, y + Math.sin(phase * 4) * Math.hypot(x, z) * .075, z * warp);
  }
  geo.computeVertexNormals();
  return geo;
}

// The small baked texture adds depth and a soft rim without a per-frame water pass.
export function pondSurface() {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1) * 2 - 1, v = y / (size - 1) * 2 - 1;
      const radius = Math.hypot(u, v);
      const wave = Math.sin(v * 36 + Math.sin(u * 12) * 2 + Math.cos(u * 19 + v * 6)) * .5 + .5;
      const streak = Math.pow(wave, 10) * (.32 + .43 * noise(x * .16, y * .13, 8));
      const fringe = 1 - THREE.MathUtils.smoothstep(radius, .76, 1);
      const light = 122 + streak * 48 + (1 - fringe) * 77;
      const at = (y * size + x) * 4;
      data[at] = light * .86; data[at + 1] = light * .97; data[at + 2] = light;
      data[at + 3] = 255;
    }
  }
  return fieldTexture(data, size);
}

export function frostSurface(repeatX, repeatZ) {
  const size = 64, data = new Uint8Array(size * size * 4);
  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const u = x / size * Math.PI * 2, v = z / size * Math.PI * 2;
      const wind = Math.sin(3 * v + Math.sin(u) * .7) * .5 + .5;
      const pockets = Math.cos(u * 2 - v) * Math.sin(v + u) * 11;
      const grit = hash(x, z, 17);
      const light = 208 + wind * 13 + pockets + grit * 13;
      const at = (z * size + x) * 4;
      data[at] = light * .95; data[at + 1] = light * .98; data[at + 2] = light;
      data[at + 3] = 255;
    }
  }
  const texture = fieldTexture(data, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatZ);
  return texture;
}

function fieldTexture(data, size) {
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

// Instancing is retained, but one off-screen forest no longer keeps all tiles on GPU.
export function partitionInstances(source, tileSize) {
  if (source.count < 80) return [source];
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const tiles = new Map();
  for (let i = 0; i < source.count; i++) {
    source.getMatrixAt(i, matrix);
    const key = Math.floor(matrix.elements[12] / tileSize) + ':' + Math.floor(matrix.elements[14] / tileSize);
    const tile = tiles.get(key);
    if (tile) tile.push(i);
    else tiles.set(key, [i]);
  }
  if (tiles.size < 2) return [source];
  return [...tiles.values()].map(ids => {
    const mesh = new THREE.InstancedMesh(source.geometry, source.material, ids.length);
    mesh.name = source.name;
    mesh.castShadow = source.castShadow;
    mesh.receiveShadow = source.receiveShadow;
    for (const [index, sourceIndex] of ids.entries()) {
      source.getMatrixAt(sourceIndex, matrix);
      mesh.setMatrixAt(index, matrix);
      if (source.instanceColor) {
        source.getColorAt(sourceIndex, color);
        mesh.setColorAt(index, color);
      }
    }
    mesh.computeBoundingSphere();
    return mesh;
  });
}

export function gabledRoof(width, depth, rise) {
  const x = width / 2 + .38, z = depth / 2 + .38;
  const positions = [], uvs = [];
  const panel = (points, texture) => {
    for (let i = 0; i < points.length; i++) {
      positions.push(...points[i]);
      uvs.push(...texture[i]);
    }
  };
  const a = [-x, 0, z], b = [x, 0, z], c = [-x, rise, 0], d = [x, rise, 0];
  const e = [-x, 0, -z], f = [x, 0, -z];
  const quad = [[0, 0], [1, 0], [0, 1], [1, 0], [1, 1], [0, 1]];
  panel([a, b, c, b, d, c], quad);
  panel([f, e, d, e, c, d], quad);
  panel([e, a, c], [[0, 0], [1, 0], [.5, 1]]);
  panel([b, f, d], [[0, 0], [1, 0], [.5, 1]]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}
