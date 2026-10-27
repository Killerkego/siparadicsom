import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// A sípálya középvonala (Blender: x = 2.5). A pálya y = 11..30 között fut, de a fix
// kamerából széles ablakban kb. y = 19-ig látszik, ezért a síelők ezen a szakaszon csúsznak.
const PISTE_X = 2.5;
const Z_TOP = -19.5;
const Z_BOTTOM = -10.5;
const SAMPLES = 160;
const FADE = 0.08; // a lesiklás elején és végén ennyi ideig tűnik fel / el

const SKIERS = [
  { color: '#e74c3c', offset: -1.2, amp: 1.4, turns: 2, duration: 10, phase: 0.0 },
  { color: '#2f80ed', offset: 0.8, amp: 1.8, turns: 1.5, duration: 12, phase: 0.35 },
  { color: '#f1c40f', offset: 0.0, amp: 1.1, turns: 2.5, duration: 9, phase: 0.6 },
  { color: '#27ae60', offset: 1.4, amp: 1.3, turns: 2, duration: 11, phase: 0.82 },
  { color: '#e056fd', offset: -0.4, amp: 2.0, turns: 1.5, duration: 13, phase: 0.18 },
  { color: '#ff7f50', offset: 0.5, amp: 1.5, turns: 2, duration: 10.5, phase: 0.5 },
];

function turnAngle(cfg, t) {
  return t * Math.PI * 2 * cfg.turns + cfg.phase * 10;
}

function pathX(cfg, t) {
  return PISTE_X + cfg.offset + cfg.amp * Math.sin(turnAngle(cfg, t));
}

// a talaj magassága a pálya mentén, egyszer kiszámolva
function sampleHeights(cfg, terrain) {
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  return Array.from({ length: SAMPLES + 1 }, (_, i) => {
    const t = i / SAMPLES;
    origin.set(pathX(cfg, t), 100, THREE.MathUtils.lerp(Z_TOP, Z_BOTTOM, t));
    raycaster.set(origin, down);
    return raycaster.intersectObject(terrain, true)[0]?.point.y ?? 0;
  });
}

function makeSkier(template, cfg) {
  const skier = template.clone();
  skier.visible = true;
  const materials = [];
  skier.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.transparent = true;
    if (o.material.name === 'Kabat') o.material.color.set(cfg.color);
    o.castShadow = true;
    materials.push(o.material);
  });
  return { skier, materials };
}

export default function Skiers({ template, terrain }) {
  const skiers = useMemo(
    () => SKIERS.map((cfg) => ({ cfg, heights: sampleHeights(cfg, terrain), ...makeSkier(template, cfg) })),
    [template, terrain],
  );
  useEffect(() => () => skiers.forEach((s) => s.materials.forEach((m) => m.dispose())), [skiers]);

  useFrame(({ clock }) => {
    for (const { cfg, heights, skier, materials } of skiers) {
      const t = (clock.elapsedTime / cfg.duration + cfg.phase) % 1;
      const f = t * SAMPLES;
      const i = Math.min(Math.floor(f), SAMPLES - 1);
      const y = THREE.MathUtils.lerp(heights[i], heights[i + 1], f - i);
      const x = pathX(cfg, t);
      const z = THREE.MathUtils.lerp(Z_TOP, Z_BOTTOM, t);
      skier.position.set(x, y, z);

      // menetirány (a minta -z felé néz) és bedőlés a kanyarban
      const dx = pathX(cfg, t + 0.002) - x;
      const dz = (Z_BOTTOM - Z_TOP) * 0.002;
      skier.rotation.set(0, Math.atan2(-dx, -dz), -0.35 * Math.sin(turnAngle(cfg, t)), 'YXZ');

      const opacity = Math.min(1, t / FADE, (1 - t) / FADE);
      materials.forEach((m) => (m.opacity = opacity));
    }
  });

  return skiers.map(({ skier }, i) => <primitive key={i} object={skier} />);
}
