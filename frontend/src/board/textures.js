import * as THREE from 'three';
import { FIELD_TYPES, SPECIAL_TYPES } from './fieldTypes';
import { TILE_ART } from './tileArt';

const PX_PER_UNIT = 320;
export const FONT = 'Nunito, system-ui, "Segoe UI", Arial, sans-serif';
const INK = '#f6ecd6'; // a mezőtervek krémszíne: felirat, keret és a rajzok

// mezőtípusonként egy szín (a mezőterv-lap színeiből), hogy a táblán ránézésre látsszon a típus
const TYPE_COLORS = {
  start: '#1f2a4d',
  bevetel: '#1d5a37',
  kiadas: '#7a1a22',
  kartya: '#5a1d48',
  vasarlas: '#8a5a22',
  semleges: '#4a5e5c',
  specialis: '#0d405e',
};

export const tileColor = (field) => TYPE_COLORS[field.type];

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

// a rajzok egyszer töltődnek be, a két azonos rajzú mező (pl. felvonók) közösen használja
const icons = new Map();
function loadIcon(n) {
  if (!icons.has(n)) {
    icons.set(
      n,
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = `/fields/${String(n).padStart(2, '0')}.png`;
      }),
    );
  }
  return icons.get(n);
}

// Mező teteje a mezőterv stílusában: fejléc a típussal (speciálisnál az altípussal), alatta a rajz,
// legalul a mező neve. A rajz betöltése után a textúra frissül.
export function makeTileTexture(field, w, d) {
  const art = TILE_ART[field.id];
  const title = field.special ? SPECIAL_TYPES[field.special] : FIELD_TYPES[field.type].label;
  const name = field.name ?? art?.name;
  const footer = name && name !== title ? name : null;

  const cw = Math.round(w * PX_PER_UNIT);
  const ch = Math.round(d * PX_PER_UNIT);
  const s = Math.min(cw, ch) / PX_PER_UNIT;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const texture = toTexture(canvas);

  const pad = 14 * s;
  const headerH = 64 * s;
  const footerH = footer ? 56 * s : 0;

  const draw = (icon) => {
    ctx.fillStyle = tileColor(field);
    ctx.fillRect(0, 0, cw, ch);

    ctx.strokeStyle = INK;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.roundRect(pad, pad, cw - 2 * pad, ch - 2 * pad, 12 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad, pad + headerH);
    ctx.lineTo(cw - pad, pad + headerH);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    fitFont(ctx, title, 800, 40 * s, cw - 4 * pad);
    ctx.fillText(title, cw / 2, pad + headerH / 2 + 2 * s);
    if (footer) {
      fitFont(ctx, footer, 700, 28 * s, cw - 4 * pad);
      ctx.fillText(footer, cw / 2, ch - pad - footerH / 2);
    }

    if (icon) {
      const top = pad + headerH + 8 * s;
      const bottom = ch - pad - footerH - 8 * s;
      const maxW = cw - 2 * pad - 12 * s;
      const scale = Math.min(maxW / icon.width, (bottom - top) / icon.height);
      const iw = icon.width * scale;
      const ih = icon.height * scale;
      ctx.drawImage(icon, (cw - iw) / 2, top + (bottom - top - ih) / 2, iw, ih);
    }
  };

  draw(null);
  if (art) {
    loadIcon(art.icon).then((icon) => {
      if (!icon) return;
      draw(icon);
      texture.needsUpdate = true;
    });
  }
  return texture;
}
