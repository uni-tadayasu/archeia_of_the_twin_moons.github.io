import * as THREE from 'three';

export const FUJIWARA_KEY = 'fujiwara_nobuyori';

const files = {
  skull: './skull.webp',
  sword: './totsuka.webp',
  judgment: './judgment.webp',
  seal: '../fx/uda-seal-v26.webp',
  chains: '../fx/uda-chains-v26.webp',
  orbs: '../fx/uda-onibi-v26.webp',
  beam: '../fx/uda-eyebeam-v26.webp',
};
const textures = new Map();

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(.19, 'rgba(255,255,255,.9)');
  glow.addColorStop(.47, 'rgba(255,255,255,.31)');
  glow.addColorStop(.82, 'rgba(255,255,255,.065)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function lightningTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  const core = [[92,4],[103,41],[75,68],[99,100],[82,135],[109,172],[90,203],[114,242],[93,281],[106,322],[95,378]];
  const branches = [
    [[76,69],[50,95],[55,121],[27,153],[22,185]],
    [[98,101],[126,129],[125,149],[153,180],[160,223]],
    [[108,172],[67,192],[55,219],[36,241],[38,269]],
    [[114,242],[150,259],[139,291],[162,318]],
    [[92,281],[74,312],[46,329],[36,359]],
  ];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  function stroke(points, width, color) {
    ctx.beginPath();
    for (const [index,[x,y]] of points.entries()) {
      if (index===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  for (const points of [core,...branches]) {
    const major = points===core;
    stroke(points,major?25:12,'rgba(116,86,255,.11)');
    stroke(points,major?12:6,'rgba(116,163,255,.35)');
    stroke(points,major?4.1:1.65,'rgba(246,248,255,.94)');
  }
  return new THREE.CanvasTexture(canvas);
}

export function fujiwaraTexture(key) {
  if (textures.has(key)) return textures.get(key);
  const texture = key === 'glow' ? glowTexture() : key === 'lightning' ? lightningTexture() :
    new THREE.TextureLoader().load(new URL(files[key], import.meta.url).href);
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(key, texture);
  return texture;
}

export function fujiwaraSprite(key, width, height = width, opacity = .9, additive = true) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: fujiwaraTexture(key), transparent: true, opacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false,
  }));
  sprite.scale.set(width, height, 1);
  sprite.renderOrder = 16;
  return sprite;
}

export function showFujiwaraSkull(target) {
  if (!target?.root || target.dead) return null;
  if (target._fujMarkCG) return target._fujMarkCG;
  const height = (target.def?.height || 1.8) * (target.scale || 1);
  const size = THREE.MathUtils.clamp(height * .64, 1.05, 2.15);
  const skull = fujiwaraSprite('skull', size, size, .98, false);
  skull.name = 'Fujiwara skull curse';
  skull.position.y = height + size * .48;
  skull.renderOrder = 22;
  target.root.add(skull);
  target._fujMarkCG = skull;
  return skull;
}

export function clearFujiwaraSkull(target) {
  const skull = target?._fujMarkCG;
  if (!skull) return;
  skull.removeFromParent();
  skull.material.dispose();
  target._fujMarkCG = null;
}
