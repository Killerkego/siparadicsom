import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Szarvasok és őzek a pálya mögötti tisztáson (a két ház és az erdő között). Útvonaluk pontjai között
// sétálnak, a pontokon megállnak legelni vagy körülnézni. A minták testrészei külön forgathatók (Blender: deer.py).
const AREA = { x0: -12, x1: 12, z0: 10, z1: 22, step: 0.5 }; // a talajmagasság-rács kiterjedése
const TURN = 0.8; // ennyi idő alatt fordul az új irányba, mielőtt elindul
const GRAZE = 5;
const LOOK = 3;
const EASE = 0.7; // a fej leengedése / felemelése
const SIZE = 1.25; // a fix kamerából így jól látszanak (a mesés házakhoz és hóemberekhez illő méret)

const ANIMALS = [
  { kind: 'stag', path: [[-6, 15], [-1, 17.5], [4, 15.5], [-2, 14.5]], speed: 0.9, offset: 0 },
  { kind: 'roe', path: [[2, 16], [7, 17.5], [8.5, 14.5], [4, 14]], speed: 1.0, offset: 4 },
  // gida: az anyja mellett jár, ugyanazzal az ütemmel
  { kind: 'roe', scale: 0.65, path: [[2.9, 16.9], [7.7, 18.3], [9.2, 15.3], [4.7, 14.9]], speed: 1.0, offset: 4.3 },
  { kind: 'stag', scale: 0.9, path: [[-7, 18.5], [-3, 16.2], [1, 18.8]], speed: 0.8, offset: 9 },
  { kind: 'roe', path: [[5, 19], [0, 16.2], [-4.5, 18.2]], speed: 0.95, offset: 2 },
];

const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function angleLerp(a, b, t) {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
}

function headingOf(from, to) {
  return Math.atan2(-(to[0] - from[0]), -(to[1] - from[1])); // a minta -z felé néz
}

// mozdulatsor: séta a következő pontig, ott legelés vagy nézelődés, körbe-körbe
function makeSchedule(cfg) {
  const actions = [];
  let time = 0;
  const n = cfg.path.length;
  for (let i = 0; i < n; i++) {
    const from = cfg.path[i];
    const to = cfg.path[(i + 1) % n];
    const prev = cfg.path[(i - 1 + n) % n];
    const dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const walk = TURN + dist / cfg.speed;
    actions.push({ type: 'walk', start: time, end: time + walk, from, to, dist, h0: headingOf(prev, from), h1: headingOf(from, to) });
    time += walk;
    const idle = i % 2 === 0 ? GRAZE : LOOK;
    actions.push({ type: i % 2 === 0 ? 'graze' : 'look', start: time, end: time + idle, at: to, h: headingOf(from, to) });
    time += idle;
  }
  return { actions, total: time };
}

// a talaj magassága a tisztáson, egyszer kiszámolva
function heightGrid(terrain) {
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const origin = new THREE.Vector3();
  const nx = Math.round((AREA.x1 - AREA.x0) / AREA.step) + 1;
  const nz = Math.round((AREA.z1 - AREA.z0) / AREA.step) + 1;
  const h = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      origin.set(AREA.x0 + i * AREA.step, 100, AREA.z0 + j * AREA.step);
      raycaster.set(origin, down);
      h[j * nx + i] = raycaster.intersectObject(terrain, true)[0]?.point.y ?? 0;
    }
  }
  return (x, z) => {
    const fx = THREE.MathUtils.clamp((x - AREA.x0) / AREA.step, 0, nx - 1.001);
    const fz = THREE.MathUtils.clamp((z - AREA.z0) / AREA.step, 0, nz - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const a = THREE.MathUtils.lerp(h[j * nx + i], h[j * nx + i + 1], u);
    const b = THREE.MathUtils.lerp(h[(j + 1) * nx + i], h[(j + 1) * nx + i + 1], u);
    return THREE.MathUtils.lerp(a, b, v);
  };
}

function makeAnimal(template, cfg, index) {
  const root = template.clone();
  root.visible = true;
  root.scale.setScalar((cfg.scale ?? 1) * SIZE);
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  const part = (suffix) => root.getObjectByName(`${template.name}_${suffix}`);
  return {
    cfg,
    root,
    seed: index * 1.7,
    schedule: makeSchedule(cfg),
    neck: part('nyak'),
    tail: part('farok'),
    // átlós párok lépnek együtt
    legs: [
      [part('lab_el_b'), 0],
      [part('lab_hat_j'), 0],
      [part('lab_el_j'), Math.PI],
      [part('lab_hat_b'), Math.PI],
    ],
  };
}

export default function Wildlife({ templates, terrain }) {
  const ground = useMemo(() => heightGrid(terrain), [terrain]);
  const animals = useMemo(
    () => ANIMALS.map((cfg, i) => makeAnimal(templates[cfg.kind], cfg, i)),
    [templates],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const { cfg, root, seed, schedule, neck, tail, legs } of animals) {
      const s = (cfg.scale ?? 1) * SIZE;
      const tau = (t + cfg.offset) % schedule.total;
      const act = schedule.actions.find((a) => tau < a.end) ?? schedule.actions[0];
      const local = tau - act.start;
      const length = act.end - act.start;

      let x;
      let z;
      let heading;
      let phase = 0;
      let stride = 0; // a lábmozgás erőssége
      let neckX = 0;
      let neckY = 0;

      if (act.type === 'walk') {
        const turn = clamp01(local / TURN);
        const along = clamp01((local - TURN) / (length - TURN));
        x = THREE.MathUtils.lerp(act.from[0], act.to[0], along);
        z = THREE.MathUtils.lerp(act.from[1], act.to[1], along);
        heading = angleLerp(act.h0, act.h1, smooth(turn));
        // fordulás közben helyben lépked, utána a megtett úttal arányosan
        phase = turn * Math.PI * 1.5 + (along * act.dist * Math.PI * 2) / (1.3 * s);
        stride = Math.min(1, local / 0.3, (length - local) / 0.3) * (local < TURN ? 0.5 : 1);
        neckX = 0.06 * Math.sin(phase * 2);
      } else {
        [x, z] = act.at;
        heading = act.h;
        const env = Math.min(smooth(clamp01(local / EASE)), smooth(clamp01((length - local) / EASE)));
        if (act.type === 'graze') {
          neckX = -1.45 * env + 0.05 * env * Math.sin(t * 7 + seed);
        } else {
          neckX = 0.22 * env;
          neckY = 0.75 * env * Math.sin((local / length) * Math.PI * 2 + seed);
        }
      }

      root.position.set(x, ground(x, z) + 0.03 * s * Math.abs(Math.sin(phase)) * stride, z);
      root.rotation.set(0, heading, 0);
      for (const [leg, offset] of legs) leg.rotation.x = 0.4 * stride * Math.sin(phase + offset);
      neck.rotation.set(neckX, neckY, 0, 'YXZ');
      // időnként megcsóválja a farkát
      const flick = Math.max(0, Math.sin(t * 0.8 + seed)) ** 8;
      tail.rotation.z = 0.5 * flick * Math.sin(t * 16);
    }
  });

  return animals.map(({ root }, i) => <primitive key={i} object={root} />);
}
