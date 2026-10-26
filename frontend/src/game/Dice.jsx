import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const SIZE = 0.7;
const REST = new THREE.Vector3(0, SIZE / 2, 2.9); // a tábla közepén, a felirat alatt
const DURATION = 1.2; // másodperc
const TAU = Math.PI * 2;

// pöttyök helye a lapon (0..1 koordinátákban)
const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
};

// BoxGeometry lapsorrendje: +x, -x, +y, -y, +z, -z (a szemközti lapok összege 7)
const FACE_VALUES = [2, 5, 1, 6, 3, 4];

// YXZ sorrendű Euler [x, z] szögek, amelyekkel az adott érték kerül felülre
const FACE_UP = {
  1: [0, 0],
  6: [Math.PI, 0],
  2: [0, Math.PI / 2],
  5: [0, -Math.PI / 2],
  3: [-Math.PI / 2, 0],
  4: [Math.PI / 2, 0],
};

function makePipTexture(value) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fbfbf8';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1d1d1f';
  for (const [x, y] of PIPS[value]) {
    ctx.beginPath();
    ctx.arc(x * size, y * size, size * 0.09, 0, TAU);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

const rand = (min, max) => min + Math.random() * (max - min);

// Dobókocka: a `roll` ({ value, id }) változásakor feldobódik, és a `value` lappal felfelé áll meg.
export default function Dice({ roll, onRolled, onClick, disabled }) {
  const mesh = useRef();
  const anim = useRef(null);
  const geometry = useMemo(() => new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, 0.09), []);
  const materials = useMemo(
    () => FACE_VALUES.map((v) => new THREE.MeshStandardMaterial({ map: makePipTexture(v), roughness: 0.35 })),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      materials.forEach((m) => {
        m.map.dispose();
        m.dispose();
      });
    },
    [geometry, materials],
  );

  useEffect(() => {
    if (!roll) return;
    const m = mesh.current;
    const [fx, fz] = FACE_UP[roll.value];
    const spins = () => (2 + Math.floor(Math.random() * 2)) * TAU;
    anim.current = {
      t: 0,
      value: roll.value,
      fromPos: m.position.clone(),
      toPos: new THREE.Vector3(REST.x + rand(-1.2, 1.2), REST.y, REST.z + rand(-0.4, 0.4)),
      fromRot: new THREE.Vector3(m.rotation.x % TAU, m.rotation.y % TAU, m.rotation.z % TAU),
      toRot: new THREE.Vector3(fx + spins(), rand(0, TAU), fz + spins()),
    };
  }, [roll]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a) return;
    const m = mesh.current;
    a.t = Math.min(1, a.t + delta / DURATION);
    const e = 1 - Math.pow(1 - a.t, 3);

    m.position.lerpVectors(a.fromPos, a.toPos, e);
    // magas ív, majd egy kis pattanás a landolás után
    m.position.y +=
      a.t < 0.7 ? Math.sin((a.t / 0.7) * Math.PI) * 1.6 : Math.sin(((a.t - 0.7) / 0.3) * Math.PI) * 0.2;
    m.rotation.set(
      THREE.MathUtils.lerp(a.fromRot.x, a.toRot.x, e),
      THREE.MathUtils.lerp(a.fromRot.y, a.toRot.y, e),
      THREE.MathUtils.lerp(a.fromRot.z, a.toRot.z, e),
    );

    if (a.t === 1) {
      anim.current = null;
      onRolled?.(a.value);
    }
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={materials}
      position={REST}
      rotation-order="YXZ"
      castShadow
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={() => (document.body.style.cursor = disabled ? 'default' : 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    />
  );
}
