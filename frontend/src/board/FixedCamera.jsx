import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Fix nézet: a játékos nem forgathatja és nem zoomolhatja. A kamera a tábla azon oldala elé
// fordul, amelyiken a bábu áll (`side`: 0 = alsó, 1 = bal, 2 = felső, 3 = jobb), és a
// távolsága az ablakmérethez igazodik, hogy a teljes tábla mindig látszódjon.
const TARGET = new THREE.Vector3(0, 0, -0.8);
const VIEW_DIR = new THREE.Vector3(0, 11, 17).normalize();
const UP = new THREE.Vector3(0, 1, 0);
const HALF = 6.7; // a fa keret fele
const CORNERS = [];
for (const x of [-HALF, HALF]) for (const z of [-HALF, HALF]) for (const y of [-0.5, 0.4]) CORNERS.push(new THREE.Vector3(x, y, z));

const MAX_W = 1.9; // NDC-ben (a teljes szélesség 2)
const MAX_H = 1.45; // a fennmaradó rész a háttéré (felvonó, sípálya)
const BOTTOM = -0.97;
const TURN_SPEED = 3; // nagyobb = gyorsabb fordulás

const tmp = new THREE.Vector3();
const dir = new THREE.Vector3();
const target = new THREE.Vector3();

function boundsAt(camera, dist) {
  camera.position.copy(dir).multiplyScalar(dist).add(target);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const c of CORNERS) {
    tmp.copy(c).project(camera);
    b.minX = Math.min(b.minX, tmp.x);
    b.maxX = Math.max(b.maxX, tmp.x);
    b.minY = Math.min(b.minY, tmp.y);
    b.maxY = Math.max(b.maxY, tmp.y);
  }
  return b;
}

function fit(camera, size, yaw) {
  dir.copy(VIEW_DIR).applyAxisAngle(UP, yaw);
  target.copy(TARGET).applyAxisAngle(UP, yaw);
  camera.aspect = size.width / size.height;
  camera.clearViewOffset();
  camera.updateProjectionMatrix();

  let lo = 5;
  let hi = 300;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const b = boundsAt(camera, mid);
    if (b.maxX - b.minX <= MAX_W && b.maxY - b.minY <= MAX_H) hi = mid;
    else lo = mid;
  }
  const b = boundsAt(camera, hi);

  // a tábla alja a képernyő aljához kerül, fölötte marad hely a tájnak
  const offsetY = ((BOTTOM - b.minY) * size.height) / 2;
  camera.setViewOffset(size.width, size.height, 0, offsetY, size.width, size.height);
  camera.updateProjectionMatrix();
}

export default function FixedCamera({ side = 0 }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const yaw = useRef((-side * Math.PI) / 2);
  const goal = useRef(yaw.current);
  const last = useRef({ yaw: null, width: 0, height: 0 });

  useEffect(() => {
    // mindig a rövidebb irányba fordul (pl. a START-on át 3 -> 0 oldal)
    const diff = (-side * Math.PI) / 2 - goal.current;
    goal.current += Math.atan2(Math.sin(diff), Math.cos(diff));
    if (document.hidden) yaw.current = goal.current; // háttérben lévő fülön nem animálunk
  }, [side]);

  useFrame((_, delta) => {
    yaw.current += (goal.current - yaw.current) * (1 - Math.exp(-delta * TURN_SPEED));
    if (Math.abs(goal.current - yaw.current) < 1e-4) yaw.current = goal.current;

    const l = last.current;
    if (l.yaw === yaw.current && l.width === size.width && l.height === size.height) return;
    fit(camera, size, yaw.current);
    last.current = { yaw: yaw.current, width: size.width, height: size.height };
  });

  return null;
}
