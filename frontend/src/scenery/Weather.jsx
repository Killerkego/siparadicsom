import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BASE_SKY } from './Sky';

// A szezonesemények látványa a jelenetben. Lágyan úszik be és ki (pár másodperc alatt):
//   Hóvihar: sűrű, ferdén hulló hó, szürkés ég, sűrű köd, tompább fények
//   Csúcsszezon: meleg, aranyló napfény, felszálló arany csillámok
//   Ellenőrzés: borús, fakó fény, lassan lebegő papírlapok
// A fényeket, a ködöt és az ég színét a meglévő elemeken hangolja át (lights, sky), nem cseréli le.

const FADE = 2.5; // másodperc, amíg egy hangulat teljesen beúszik

// a nyugodt, alap hangulat és az események célértékei
const BASE = {
  ...BASE_SKY,
  fog: '#f3ece6',
  fogNear: 90,
  fogFar: 300,
  hemi: 1.25,
  sun: 2.2,
  sunColor: '#fff0db',
};
const MOODS = {
  blizzard: {
    horizon: '#c6d0da',
    middle: '#b7c3ce',
    zenith: '#8796a6',
    fog: '#cdd6de',
    fogNear: 22,
    fogFar: 130,
    hemi: 1.0,
    sun: 0.8,
    sunColor: '#e6eef6',
  },
  peak: {
    horizon: '#fbe3c2',
    middle: '#f6d6b0',
    zenith: '#8bb6e2',
    fog: '#f8e6cc',
    fogNear: 110,
    fogFar: 340,
    hemi: 1.4,
    sun: 3.0,
    sunColor: '#ffdc9c',
  },
  audit: {
    horizon: '#d9d5cf',
    middle: '#d0cbc4',
    zenith: '#9aa5af',
    fog: '#d8d4ce',
    fogNear: 65,
    fogFar: 250,
    hemi: 1.05,
    sun: 1.4,
    sunColor: '#f1eee8',
  },
};
const COLOR_KEYS = ['horizon', 'middle', 'zenith', 'fog', 'sunColor'];
const NUMBER_KEYS = ['fogNear', 'fogFar', 'hemi', 'sun'];

const SNOW = 4000;
const SNOW_BOX = { x: 34, y: 26, z: 34 };
const SPARKLES = 320;
const PAPERS = 36;

// puha, kerek pötty a részecskéknek
function dotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const rand = (a, b) => a + Math.random() * (b - a);

// hó: a tábla fölötti dobozban esik, a széllel ferdén; ami leér, újra felülről indul
function Snow({ weight }) {
  const points = useRef();
  const { geometry, material, speeds } = useMemo(() => {
    const positions = new Float32Array(SNOW * 3);
    const speeds = new Float32Array(SNOW);
    for (let i = 0; i < SNOW; i++) {
      positions[i * 3] = rand(-SNOW_BOX.x, SNOW_BOX.x);
      positions[i * 3 + 1] = rand(0, SNOW_BOX.y);
      positions[i * 3 + 2] = rand(-SNOW_BOX.z, SNOW_BOX.z);
      speeds[i] = rand(3.5, 7);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.3,
      map: dotTexture(),
      transparent: true,
      depthWrite: false,
      fog: false, // a köd ne nyelje el a pelyheket: épp a hóvihar ködében kell látszaniuk
      opacity: 0,
      color: '#ffffff',
    });
    return { geometry, material, speeds };
  }, []);
  useEffect(() => () => (geometry.dispose(), material.map.dispose(), material.dispose()), [geometry, material]);

  useFrame(({ clock }, delta) => {
    const w = weight.current;
    material.opacity = w * 0.95;
    points.current.visible = w > 0.01;
    if (!points.current.visible) return;
    const pos = geometry.attributes.position.array;
    const gust = 2.5 + Math.sin(clock.elapsedTime * 0.7) * 1.5; // a szél erőssége hullámzik
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < SNOW; i++) {
      pos[i * 3] += gust * dt;
      pos[i * 3 + 1] -= speeds[i] * dt;
      pos[i * 3 + 2] += Math.sin(clock.elapsedTime + i) * 0.4 * dt;
      if (pos[i * 3 + 1] < 0) {
        pos[i * 3 + 1] = SNOW_BOX.y;
        pos[i * 3] = rand(-SNOW_BOX.x, SNOW_BOX.x);
      }
      if (pos[i * 3] > SNOW_BOX.x) pos[i * 3] -= SNOW_BOX.x * 2;
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />;
}

// csillámok: lassan felszálló, pislákoló arany pöttyök a tábla körül
function Sparkles({ weight }) {
  const points = useRef();
  const { geometry, material, phase } = useMemo(() => {
    const positions = new Float32Array(SPARKLES * 3);
    const phase = new Float32Array(SPARKLES);
    for (let i = 0; i < SPARKLES; i++) {
      const r = rand(2, 13);
      const a = rand(0, Math.PI * 2);
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = rand(0, 9);
      positions[i * 3 + 2] = Math.sin(a) * r;
      phase[i] = rand(0, Math.PI * 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      size: 0.26,
      map: dotTexture(),
      transparent: true,
      depthWrite: false,
      // nem additív: a világos havas háttéren az additív arany fehérré égne ki
      fog: false,
      opacity: 0,
      color: '#f0b23c',
    });
    return { geometry, material, phase };
  }, []);
  useEffect(() => () => (geometry.dispose(), material.map.dispose(), material.dispose()), [geometry, material]);

  useFrame(({ clock }, delta) => {
    const w = weight.current;
    // az egész réteg finoman lüktet, így pislákolónak hat
    material.opacity = w * (0.8 + Math.sin(clock.elapsedTime * 2.2) * 0.2);
    points.current.visible = w > 0.01;
    if (!points.current.visible) return;
    const pos = geometry.attributes.position.array;
    const dt = Math.min(delta, 0.05);
    for (let i = 0; i < SPARKLES; i++) {
      pos[i * 3 + 1] += (0.35 + (i % 5) * 0.08) * dt;
      pos[i * 3] += Math.sin(clock.elapsedTime * 0.8 + phase[i]) * 0.15 * dt;
      if (pos[i * 3 + 1] > 9) pos[i * 3 + 1] = 0;
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />;
}

// papírlapok: lassan, forogva lebegnek le a tábla fölött (Ellenőrzés)
function Papers({ weight }) {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const { geometry, material, sheets } = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(0.34, 0.44);
    const material = new THREE.MeshStandardMaterial({
      color: '#f7f2e6',
      roughness: 0.9,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const sheets = Array.from({ length: PAPERS }, () => ({
      x: rand(-9, 9),
      y: rand(0, 12),
      z: rand(-9, 9),
      fall: rand(0.5, 0.9),
      spin: rand(0.6, 1.6),
      phase: rand(0, Math.PI * 2),
    }));
    return { geometry, material, sheets };
  }, []);
  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  useFrame(({ clock }, delta) => {
    const w = weight.current;
    material.opacity = w;
    mesh.current.visible = w > 0.01;
    if (!mesh.current.visible) return;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 0.05);
    sheets.forEach((s, i) => {
      s.y -= s.fall * dt;
      if (s.y < 0.1) {
        s.y = 12;
        s.x = rand(-9, 9);
        s.z = rand(-9, 9);
      }
      // lebegés: ide-oda ring, közben forog, mint egy leeső papírlap
      dummy.position.set(s.x + Math.sin(t * s.spin + s.phase) * 0.6, s.y, s.z + Math.cos(t * 0.7 + s.phase) * 0.4);
      dummy.rotation.set(Math.sin(t * s.spin + s.phase) * 0.9, t * s.spin * 0.5 + s.phase, Math.cos(t * s.spin) * 0.5);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geometry, material, PAPERS]} frustumCulled={false} raycast={() => null} />;
}

// season: a futó szezonesemény azonosítója vagy null; lights: { hemi, sun } fények; sky: az ég uniformjai
export default function Weather({ season, lights, sky }) {
  const { scene } = useThree();
  // az egyes hangulatok súlya (0..1), lágyan követi a futó eseményt
  const weights = useRef({ blizzard: 0, peak: 0, audit: 0 });
  const refs = { blizzard: useRef(0), peak: useRef(0), audit: useRef(0) };
  const colors = useMemo(() => {
    const parse = (mood) => Object.fromEntries(COLOR_KEYS.map((k) => [k, new THREE.Color(mood[k])]));
    return { base: parse(BASE), ...Object.fromEntries(Object.entries(MOODS).map(([k, m]) => [k, parse(m)])) };
  }, []);
  const work = useMemo(() => Object.fromEntries(COLOR_KEYS.map((k) => [k, new THREE.Color()])), []);

  useFrame((_, delta) => {
    const step = Math.min(delta, 0.1) / FADE;
    for (const id of Object.keys(MOODS)) {
      const target = season === id ? 1 : 0;
      const w = weights.current[id];
      weights.current[id] = w < target ? Math.min(target, w + step) : Math.max(target, w - step);
      refs[id].current = weights.current[id];
    }

    // a színek és számok: az alapból indulva minden hangulat felé a súlyával
    COLOR_KEYS.forEach((k) => work[k].copy(colors.base[k]));
    const numbers = Object.fromEntries(NUMBER_KEYS.map((k) => [k, BASE[k]]));
    for (const [id, mood] of Object.entries(MOODS)) {
      const w = weights.current[id];
      if (!w) continue;
      COLOR_KEYS.forEach((k) => work[k].lerp(colors[id][k], w));
      NUMBER_KEYS.forEach((k) => (numbers[k] += (mood[k] - BASE[k]) * w));
    }

    if (scene.fog) {
      scene.fog.color.copy(work.fog);
      scene.fog.near = numbers.fogNear;
      scene.fog.far = numbers.fogFar;
    }
    if (lights.hemi.current) lights.hemi.current.intensity = numbers.hemi;
    if (lights.sun.current) {
      lights.sun.current.intensity = numbers.sun;
      lights.sun.current.color.copy(work.sunColor);
    }
    if (sky.current) {
      sky.current.horizon.value.copy(work.horizon);
      sky.current.middle.value.copy(work.middle);
      sky.current.zenith.value.copy(work.zenith);
    }
  });

  return (
    <>
      <Snow weight={refs.blizzard} />
      <Sparkles weight={refs.peak} />
      <Papers weight={refs.audit} />
    </>
  );
}
