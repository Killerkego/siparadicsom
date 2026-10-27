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

// esés (másodpercben): borulás, csúszás a hóban, fekvés, felállás
const TUMBLE = 0.6;
const SLIDE = 1.0;
const GET_UP = 2.2; // ekkor kezd felállni
const FALL_TIME = 3.0;
const SLIDE_DIST = 0.05; // ennyit csúszik még a lesiklás hosszához képest
const PUFF_COUNT = 9;
const PUFF_GEOMETRY = new THREE.IcosahedronGeometry(0.16, 1);

// kind: ski / board; fall: a lesiklás melyik pontján esik el (ha elesik)
const RIDERS = [
  { kind: 'ski', jacket: '#b5574f', pants: '#6f7f95', offset: -1.2, amp: 1.4, turns: 2, duration: 10, phase: 0.0 },
  { kind: 'board', jacket: '#5b7fa3', pants: '#c9b79c', board: '#c9805a', hat: '#d1a94f', offset: 0.8, amp: 1.9, turns: 1.5, duration: 11, phase: 0.43 },
  { kind: 'ski', jacket: '#d1a94f', pants: '#7f8d9c', offset: 0.0, amp: 1.1, turns: 2.5, duration: 9, phase: 0.86, fall: 0.45 },
  { kind: 'ski', jacket: '#5e8a6c', pants: '#8a7a6a', offset: 1.4, amp: 1.3, turns: 2, duration: 11, phase: 0.29 },
  { kind: 'board', jacket: '#8a76a3', pants: '#6f7f95', board: '#7e9a88', hat: '#b5574f', offset: -0.4, amp: 2.1, turns: 1.5, duration: 12, phase: 0.71, fall: 0.55 },
  { kind: 'ski', jacket: '#c9805a', pants: '#5b6f86', offset: 0.5, amp: 1.5, turns: 2, duration: 10.5, phase: 0.14 },
  { kind: 'board', jacket: '#a9554c', pants: '#8d929c', board: '#5b7fa3', hat: '#e8dfd2', offset: -0.9, amp: 1.7, turns: 2, duration: 10, phase: 0.57 },
];

const RECOLOR = { Kabat: 'jacket', Nadrag: 'pants', Lec: 'board', Sapka: 'hat' };

function turnAngle(cfg, t) {
  return t * Math.PI * 2 * cfg.turns + cfg.phase * 10;
}

function pathX(cfg, t) {
  return PISTE_X + cfg.offset + cfg.amp * Math.sin(turnAngle(cfg, t));
}

const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

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

function heightAt(heights, t) {
  const f = clamp01(t) * SAMPLES;
  const i = Math.min(Math.floor(f), SAMPLES - 1);
  return THREE.MathUtils.lerp(heights[i], heights[i + 1], f - i);
}

function makeRider(templates, cfg) {
  const rider = templates[cfg.kind].clone();
  rider.visible = true;
  rider.position.set(0, 0, 0);
  const materials = [];
  rider.traverse((o) => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.transparent = true;
    const key = RECOLOR[o.material.name];
    if (key && cfg[key]) o.material.color.set(cfg[key]);
    o.castShadow = true;
    materials.push(o.material);
  });
  // a borulás a talpak alatti pont körül történik, ezért a modell egy forgatható csoportban van
  const body = new THREE.Group();
  body.add(rider);
  const root = new THREE.Group();
  root.add(body);

  let puff = null;
  if (cfg.fall) {
    const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, depthWrite: false });
    materials.push(material);
    puff = new THREE.Group();
    for (let i = 0; i < PUFF_COUNT; i++) {
      const ball = new THREE.Mesh(PUFF_GEOMETRY, material);
      const a = (i / PUFF_COUNT) * Math.PI * 2;
      ball.userData.dir = new THREE.Vector3(Math.cos(a), 0.6 + (i % 3) * 0.25, Math.sin(a));
      puff.add(ball);
    }
    puff.visible = false;
  }
  return { root, body, puff, materials };
}

// A lesiklás haladása (0..1) és az esés állapota a ciklus adott idejében. Az eső síelő
// ciklusa FALL_TIME-mal hosszabb: borul, csúszik egy kicsit, fekszik, feláll, majd továbbmegy.
function progress(cfg, time) {
  const cycle = cfg.duration + (cfg.fall ? FALL_TIME : 0);
  const tau = (time + cfg.phase * cfg.duration) % cycle;
  if (!cfg.fall) return { t: tau / cfg.duration, fall: null };
  const fallStart = cfg.fall * cfg.duration;
  if (tau < fallStart) return { t: tau / cfg.duration, fall: null };
  const s = tau - fallStart;
  if (s < FALL_TIME) {
    const slide = 1 - (1 - clamp01(s / SLIDE)) ** 2;
    return { t: cfg.fall + SLIDE_DIST * slide, fall: s };
  }
  // a hátralévő utat a megmaradt idő alatt teszi meg
  const rest = (tau - fallStart - FALL_TIME) / (cfg.duration * (1 - cfg.fall));
  return { t: cfg.fall + SLIDE_DIST + rest * (1 - cfg.fall - SLIDE_DIST), fall: null };
}

export default function Skiers({ templates, terrain }) {
  const riders = useMemo(
    () => RIDERS.map((cfg) => ({ cfg, heights: sampleHeights(cfg, terrain), ...makeRider(templates, cfg) })),
    [templates, terrain],
  );
  useEffect(() => () => riders.forEach((r) => r.materials.forEach((m) => m.dispose())), [riders]);

  useFrame(({ clock }) => {
    for (const { cfg, heights, root, body, puff, materials } of riders) {
      const { t, fall } = progress(cfg, clock.elapsedTime);
      const x = pathX(cfg, t);
      const z = THREE.MathUtils.lerp(Z_TOP, Z_BOTTOM, t);
      root.position.set(x, heightAt(heights, t), z);

      // menetirány (a minta -z felé néz) és bedőlés a kanyarban; a deszkások jobban dőlnek
      const dx = pathX(cfg, t + 0.002) - x;
      const dz = (Z_BOTTOM - Z_TOP) * 0.002;
      const heading = Math.atan2(-dx, -dz);
      const lean = (cfg.kind === 'board' ? -0.45 : -0.35) * Math.sin(turnAngle(cfg, t));
      root.rotation.set(0, heading, 0);

      if (fall === null) {
        body.rotation.set(0, 0, lean);
        body.position.set(0, 0, 0);
      } else {
        // borulás oldalra pörögve, fekvés közben kis kapálózás, aztán felállás
        const down = smooth(clamp01(fall / TUMBLE));
        const up = smooth(clamp01((fall - GET_UP) / (FALL_TIME - GET_UP)));
        const lying = down * (1 - up);
        const wiggle = fall > TUMBLE && fall < GET_UP ? 0.08 * Math.sin(fall * 9) : 0;
        const side = cfg.kind === 'board' ? -1 : 1;
        body.rotation.set(0, (down - up) * side * 2.4, THREE.MathUtils.lerp(lean, side * 1.45, lying) + wiggle);
        body.position.set(0, 0.15 * lying + 0.35 * Math.sin(Math.PI * clamp01(fall / TUMBLE)) * (1 - up), 0);
      }

      if (puff) {
        // hófelhő a becsapódásnál
        const p = fall !== null ? (fall - TUMBLE * 0.7) / 1.1 : -1;
        puff.visible = p > 0 && p < 1;
        if (puff.visible) {
          puff.position.copy(root.position);
          puff.children.forEach((ball) => {
            ball.position.copy(ball.userData.dir).multiplyScalar(0.25 + p * 0.9);
            ball.scale.setScalar(0.6 + p * 1.6);
          });
          puff.children[0].material.opacity = 0.85 * (1 - p);
        }
      }

      const opacity = Math.min(1, t / FADE, (1 - t) / FADE);
      materials.forEach((m) => {
        if (!puff || m !== puff.children[0].material) m.opacity = opacity;
      });
    }
  });

  return riders.map(({ root, puff }, i) => (
    <group key={i}>
      <primitive object={root} />
      {puff && <primitive object={puff} />}
    </group>
  ));
}
