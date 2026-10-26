import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PUFFS = 8;
const CYCLE = 6; // másodperc, amíg egy füstpamacs felszáll és eltűnik
const PUFF_GEOMETRY = new THREE.IcosahedronGeometry(1, 1);

function Chimney({ position }) {
  const refs = useRef([]);
  const materials = useMemo(
    () =>
      Array.from(
        { length: PUFFS },
        () => new THREE.MeshStandardMaterial({ color: '#e3e7ea', transparent: true, depthWrite: false, roughness: 1 }),
      ),
    [],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);
  const seed = useMemo(() => Math.random() * CYCLE, []);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime + seed;
    refs.current.forEach((puff, i) => {
      if (!puff) return;
      const t = (time / CYCLE + i / PUFFS) % 1;
      // felfelé száll, a szél kicsit oldalra fújja, közben nő és halványul
      puff.position.set(
        position.x + t * 1.1 + Math.sin(t * 7 + i) * 0.08,
        position.y + t * 3.2,
        position.z - t * 0.4,
      );
      puff.scale.setScalar(0.1 + t * 0.5);
      materials[i].opacity = Math.min(1, t * 8) * (1 - t) * 0.8;
    });
  });

  return materials.map((material, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={PUFF_GEOMETRY} material={material} />
  ));
}

export default function ChimneySmoke({ positions }) {
  return positions.map((p, i) => <Chimney key={i} position={p} />);
}
