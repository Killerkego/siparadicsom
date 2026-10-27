import * as THREE from 'three';
import { FIELD_TYPES, SPECIAL_TYPES } from './fieldTypes';

const PX_PER_UNIT = 256;
export const FONT = 'Nunito, system-ui, "Segoe UI", Arial, sans-serif';
export const TILE_COLOR = '#f2f2f2';
const TEXT_DARK = '#1f2a33';

function fitFont(ctx, text, weight, size, maxWidth) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (s > 10 && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
}

function toTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Mező teteje: csak a típus neve, speciálisnál alatta az altípus
export function makeTileTexture(field, w, d) {
  const label = FIELD_TYPES[field.type].label;
  const subtitle = field.special ? SPECIAL_TYPES[field.special] : field.name;

  const cw = Math.round(w * PX_PER_UNIT);
  const ch = Math.round(d * PX_PER_UNIT);
  const s = cw / PX_PER_UNIT;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = TILE_COLOR;
  ctx.fillRect(0, 0, cw, ch);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT_DARK;
  fitFont(ctx, label, 700, 40 * s, cw - 24 * s);
  ctx.fillText(label, cw / 2, subtitle ? ch * 0.44 : ch / 2);

  if (subtitle) {
    fitFont(ctx, subtitle, 400, 32 * s, cw - 24 * s);
    ctx.fillText(subtitle, cw / 2, ch * 0.58);
  }

  return toTexture(canvas);
}

// A tábla közepe: cím hegyekkel (később ide kerül a szálloda állapota)
export function makeEmblemTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.roundRect(24, 24, size - 48, size - 48, 48);
  ctx.setLineDash([28, 20]);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#b8cddc';
  ctx.stroke();
  ctx.setLineDash([]);

  // hegyek havas csúccsal
  const peaks = [
    [300, 520, 210, '#8fb1c9'],
    [700, 520, 190, '#8fb1c9'],
    [512, 560, 300, '#6f94b0'],
  ];
  for (const [x, base, h, color] of peaks) {
    const half = h * 0.95;
    ctx.beginPath();
    ctx.moveTo(x - half, base);
    ctx.lineTo(x, base - h);
    ctx.lineTo(x + half, base);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    const k = 0.32;
    ctx.beginPath();
    ctx.moveTo(x - half * k, base - h * (1 - k));
    ctx.lineTo(x, base - h);
    ctx.lineTo(x + half * k, base - h * (1 - k));
    ctx.lineTo(x + half * k * 0.4, base - h * (1 - k) + 18);
    ctx.lineTo(x - half * k * 0.2, base - h * (1 - k) - 6);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2b4a63';
  fitFont(ctx, 'SÍPARADICSOM', 800, 120, size - 160);
  ctx.fillText('SÍPARADICSOM', size / 2, 660);

  return toTexture(canvas);
}
