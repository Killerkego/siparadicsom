import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Fix nézet: nincs forgatás és zoom, a kamera távolsága az ablakmérethez igazodik,
// hogy a teljes tábla mindig látszódjon, felette pedig a hegyek.
const TARGET = new THREE.Vector3(0, 0, -0.8);
const VIEW_DIR = new THREE.Vector3(0, 11, 17).normalize();
const HALF = 6.7; // a fa keret fele
const CORNERS = [];
for (const x of [-HALF, HALF]) for (const z of [-HALF, HALF]) for (const y of [-0.5, 0.4]) CORNERS.push(new THREE.Vector3(x, y, z));

const MAX_W = 1.9; // NDC-ben (a teljes szélesség 2)
const MAX_H = 1.2; // a fennmaradó rész a háttéré (felvonó, sípálya)
const BOTTOM = -0.95;

const tmp = new THREE.Vector3();

function boundsAt(camera, dist) {
  camera.position.copy(VIEW_DIR).multiplyScalar(dist).add(TARGET);
  camera.lookAt(TARGET);
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

export default function FixedCamera() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
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
  }, [camera, size]);

  return null;
}
