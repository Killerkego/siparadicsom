import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// A saját építkezés a tábla teljes közepén, egyetlen üdülőként: közös havas terep ösvényekkel és kis térrel
// (ott áll a kocka), rajta a 8 épület. A megépült elem teljes színben áll, a megvehető halvány aranyos
// „szellem”, a zárolt (hiányzó előfeltétel) alig látszik. Az egész a kamera felé fordul.
// (Blender: buildings.py, diorama.py – a terep ösvényei ezekhez a helyekhez vezetnek)
export const MODEL_URL = '/models/epuletek.glb';
const GROUND_TOP = 0.05; // a terep felső síkja
const GROW_TIME = 900; // ms, ennyi idő alatt „nő ki” az új épület
const SIZE = 2.6; // a Blenderben kb. 1.1 széles épületek nagyítása (így kb. 2.9 szélesek)
const MAX_HEIGHT = 1.7; // ennél magasabb épület már nagyon takarná a túloldali mezőket

// hely (x, z), elfordulás a tér felé, és ha kell, saját magassághatár
const LAYOUT = {
  palya: { x: -2.6, z: -2.55, rot: 0.2 },
  felvono: { x: -0.95, z: -2.75, rot: 0.1 }, // a pályarendszer dombja mellett, mintha arra vinne fel
  helipad: { x: 2.55, z: -2.6, rot: -0.2 },
  wellness: { x: -2.5, z: -0.05, rot: 0.15 },
  szalloda: { x: 0.45, z: -0.45, rot: 0, maxHeight: 2.3 },
  lakosztaly: { x: 2.75, z: 0.05, rot: -0.3 },
  etterem: { x: -2.6, z: 2.6, rot: 0.25 },
  bar: { x: 2.6, z: 2.6, rot: -0.25 },
};

const ghostAvailable = new THREE.MeshStandardMaterial({
  color: '#fff1cf',
  emissive: '#e8c77a',
  emissiveIntensity: 0.25,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
});
const ghostLocked = new THREE.MeshStandardMaterial({ color: '#e6edf3', transparent: true, opacity: 0.16, depthWrite: false });

// a templát másolata a megadott állapothoz: eredeti anyagok vagy szellem
function cloneBuilding(template, state, maxHeight) {
  const clone = template.clone();
  const height = new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3()).y;
  clone.position.set(0, 0, 0);
  clone.scale.multiplyScalar(Math.min(SIZE, maxHeight / height));
  clone.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = state === 'owned';
    if (state !== 'owned') o.material = state === 'available' ? ghostAvailable : ghostLocked;
  });
  return clone;
}

function Building({ building, state, grownAt }) {
  const { scene } = useGLTF(MODEL_URL);
  const model = useRef();
  const spot = LAYOUT[building.id];
  const figure = useMemo(
    () => cloneBuilding(scene.getObjectByName(`Epulet_${building.id}`), state, spot.maxHeight ?? MAX_HEIGHT),
    [scene, building.id, state, spot],
  );

  useFrame(() => {
    // frissen megépült elem: rugalmasan kinő a terepből
    const t = grownAt ? Math.min(1, (Date.now() - grownAt) / GROW_TIME) : 1;
    const s = t < 1 ? 1 - Math.cos(t * Math.PI * 2.5) * Math.exp(-t * 5) : 1;
    model.current.scale.setScalar(Math.max(0.01, s));
  });

  return (
    <group ref={model} position={[spot.x, GROUND_TOP, spot.z]} rotation-y={spot.rot}>
      <primitive object={figure} />
    </group>
  );
}

function Ground() {
  const { scene } = useGLTF(MODEL_URL);
  const ground = useMemo(() => {
    const clone = scene.getObjectByName('Epitkezes_alap').clone();
    clone.position.set(0, 0, 0);
    clone.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = true;
      o.castShadow = true;
    });
    return clone;
  }, [scene]);
  return <primitive object={ground} />;
}

// buildings: a szerver katalógusa; owned: a néző megépített elemei; side: a kamera oldala (0..3)
export default function BuildSite({ buildings, owned, side }) {
  const group = useRef();
  const yaw = (-side * Math.PI) / 2;
  // az újonnan megépült elemek időpontja a kinövés animációhoz (a betöltéskor meglévők már állnak)
  const seen = useRef(null);
  const grown = useRef({});
  if (seen.current === null) seen.current = new Set(owned);
  for (const id of owned) {
    if (!seen.current.has(id)) {
      seen.current.add(id);
      grown.current[id] = Date.now();
    }
  }

  useFrame((_, delta) => {
    const g = group.current;
    g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * (1 - Math.exp(-delta * 3));
  });

  return (
    <group ref={group} rotation-y={yaw}>
      <Ground />
      {buildings.map((b) => {
        const state = owned.includes(b.id) ? 'owned' : b.requires.every((r) => owned.includes(r)) ? 'available' : 'locked';
        return <Building key={b.id} building={b} state={state} grownAt={grown.current[b.id]} />;
      })}
    </group>
  );
}

useGLTF.preload(MODEL_URL);
