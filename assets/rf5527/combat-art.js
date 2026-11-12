import * as THREE from 'three';

const SIZE = 256;
const TAU = Math.PI * 2;
const textures = new Map();
const loader = new THREE.TextureLoader();

function ink(ctx, width, alpha, path, light = 255) {
  ctx.lineWidth = width;
  ctx.strokeStyle = `rgba(${light},${light},${light},${alpha})`;
  ctx.beginPath();
  path();
  ctx.stroke();
}

function arc(ctx, radius, from = 0, to = TAU) {
  ctx.arc(0, 0, radius, from, to);
}

function haze(ctx, radius, xScale, yScale, strength) {
  ctx.save();
  ctx.scale(xScale, yScale);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  glow.addColorStop(0, `rgba(255,255,255,${strength})`);
  glow.addColorStop(.28, `rgba(255,255,255,${strength * .43})`);
  glow.addColorStop(.66, `rgba(255,255,255,${strength * .13})`);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  ctx.restore();
}

function radialMarks(ctx, count, painter, radius = 80) {
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.rotate(i * TAU / count);
    ctx.translate(radius, 0);
    painter(i);
    ctx.restore();
  }
}

function diamond(ctx, width, height) {
  ctx.moveTo(-width, 0);
  ctx.lineTo(0, -height);
  ctx.lineTo(width, 0);
  ctx.lineTo(0, height);
  ctx.closePath();
}

function slash(ctx) {
  ctx.save();
  ctx.translate(0, 18);
  ink(ctx, 9, .31, () => {
    ctx.moveTo(-111, 31);
    ctx.bezierCurveTo(-68, -53, 49, -75, 113, -14);
  }, 28);
  const gradient = ctx.createLinearGradient(-110, 0, 104, -34);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(.24, 'rgba(255,255,255,.38)');
  gradient.addColorStop(.72, 'rgba(255,255,255,.92)');
  gradient.addColorStop(1, 'rgba(255,255,255,.15)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(-119, 36);
  ctx.bezierCurveTo(-85, -49, 37, -89, 116, -12);
  ctx.bezierCurveTo(44, -55, -54, -39, -119, 36);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const offset = i * 5;
    ink(ctx, i % 3 ? 1.0 : 2.6, .60 - i * .068, () => {
      ctx.moveTo(-109 + offset * 1.8, 35 + offset * .3);
      ctx.bezierCurveTo(-81, -30 + offset, 38, -75 + offset, 107 - offset * .9, -13 + offset * .62);
    });
  }
  for (let i = 0; i < 17; i++) {
    const x = -90 + (i * 47 % 190);
    const y = -68 + (i * 13 % 63) + x * .08;
    ink(ctx, 1 + i % 3 * .65, .16 + i % 5 * .13, () => {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 5 + i % 4 * 3, y - 2.1 + i % 3);
    });
  }
  ctx.restore();
}

function shock(ctx) {
  ink(ctx, 8, .31, () => arc(ctx, 96), 28);
  ink(ctx, 2.5, .66, () => arc(ctx, 96));
  ink(ctx, 1.2, .31, () => arc(ctx, 87));
  for (let i = 0; i < 8; i++) {
    const angle = i * TAU / 8;
    ink(ctx, 3.5, i % 2 ? .41 : .65, () => arc(ctx, 103, angle + .14, angle + .41));
  }
  radialMarks(ctx, 24, (i) => {
    ink(ctx, 1.3, i % 3 === 0 ? .65 : .28, () => {
      ctx.moveTo(0, 0);
      ctx.lineTo(i % 3 === 0 ? 14 : 6, 0);
    });
  }, 98);
}

function seal(ctx, motif) {
  ink(ctx, 7, .31, () => arc(ctx, 93), 28);
  ink(ctx, 2.6, .65, () => arc(ctx, 93));
  ink(ctx, 1.35, .40, () => arc(ctx, 83));
  ink(ctx, 1.25, .27, () => arc(ctx, 66));
  radialMarks(ctx, 12, (i) => {
    ink(ctx, i % 3 === 0 ? 2.4 : 1.2, i % 3 === 0 ? .74 : .44, () => diamond(ctx, i % 3 === 0 ? 10 : 6, 3.5));
    if (i % 3 === 0) {
      ink(ctx, 1.2, .48, () => {
        ctx.moveTo(-16, 0);
        ctx.lineTo(-30, 0);
      });
    }
  }, 93);
  if (motif === 'seal-prism') {
    radialMarks(ctx, 4, () => {
      ink(ctx, 2.4, .68, () => diamond(ctx, 39, 27));
    }, 18);
  } else if (motif === 'seal-tide') {
    radialMarks(ctx, 3, () => {
      ink(ctx, 3.1, .64, () => {
        ctx.moveTo(18, -36);
        ctx.bezierCurveTo(-24, -52, -46, -19, -18, 7);
        ctx.bezierCurveTo(2, 24, 24, 12, 14, -4);
      });
    }, 5);
  } else {
    radialMarks(ctx, 6, () => {
      ink(ctx, 2.1, .59, () => {
        ctx.moveTo(-19, -14);
        ctx.lineTo(5, 0);
        ctx.lineTo(-19, 14);
        ctx.moveTo(-8, -16);
        ctx.lineTo(19, 0);
        ctx.lineTo(-8, 16);
      });
    }, 26);
  }
  ink(ctx, 2.4, .78, () => diamond(ctx, 8, 8));
}

function flash(ctx) {
  haze(ctx, 112, 1, .8, .70);
  haze(ctx, 83, 1.4, .24, .57);
  haze(ctx, 83, .27, 1.38, .56);
  ctx.fillStyle = 'rgba(255,255,255,.90)';
  ctx.beginPath();
  ctx.moveTo(-96, 0);
  ctx.quadraticCurveTo(-6, -3, 0, -65);
  ctx.quadraticCurveTo(6, -3, 96, 0);
  ctx.quadraticCurveTo(6, 3, 0, 65);
  ctx.quadraticCurveTo(-6, 3, -96, 0);
  ctx.fill();
  radialMarks(ctx, 8, (i) => {
    if (i % 2 === 0) return;
    ink(ctx, 1.55, .44, () => {
      ctx.moveTo(15, 0);
      ctx.lineTo(52, 0);
    });
  }, 0);
}

function shard(ctx) {
  haze(ctx, 107, 1, 1, .48);
  ctx.fillStyle = 'rgba(255,255,255,.99)';
  ctx.beginPath();
  diamond(ctx, 32, 84);
  ctx.fill();
}

export function combatTexture(kind) {
  if (textures.has(kind)) return textures.get(kind);
  let texture;
  if (kind !== 'mist') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.translate(SIZE / 2, SIZE / 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (kind.startsWith('seal-')) seal(ctx, kind);
      else ({ slash, shock, flash, shard }[kind] || flash)(ctx);
      texture = new THREE.CanvasTexture(canvas);
    }
  }
  if (!texture) {
    const legacy = kind === 'slash' ? 'energy-slash' :
      kind === 'shock' || kind.startsWith('seal-') ? 'arcane-ring' : 'luminous-flare';
    texture = loader.load(new URL(`../rf558/${legacy}.webp`, import.meta.url).href);
  }
  texture.colorSpace = THREE.SRGBColorSpace;
  textures.set(kind, texture);
  return texture;
}
