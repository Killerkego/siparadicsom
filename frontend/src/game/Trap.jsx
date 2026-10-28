import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { TILE_H, tilePlacement } from '../board/layout';

// Medvecsapda a hóban (Blender: blender/csapda.blend, 'Csapda' jelenet; export: csapda.glb).
// Csak a lerakója látja; a zászló ('Csapda_jelolo') az ő színében.
const MODEL_URL = '/models/csapda.glb';
const SCALE = 0.8; // a Blenderben kb. 0.75 x 0.68, így a mezőn kb. 0.6 x 0.55
const SPOT = 0.52; // a mező külső szélén áll (a mező szerinti z), a bábuk helyei előtt
const POP_TIME = 700; // ms, ennyi alatt „ugrik elő” az új csapda

export default function Trap({ field, color }) {
  const { scene } = useGLTF(MODEL_URL);
  const group = useRef();
  const placedAt = useRef(Date.now());

  const model = useMemo(() => {
    const clone = scene.getObjectByName('Csapda').clone();
    clone.position.set(0, 0, 0);
    clone.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if (o.material.name === 'Csapda_jelolo') {
        o.material = o.material.clone();
        o.material.color.set(color);
      }
    });
    return clone;
  }, [scene, color]);
  useEffect(
    () => () =>
      model.traverse((o) => {
        if (o.isMesh && o.material.name === 'Csapda_jelolo') o.material.dispose();
      }),
    [model],
  );

  const { position, rotationY } = useMemo(() => {
    const tile = tilePlacement(field);
    const cos = Math.cos(tile.rotationY);
    const sin = Math.sin(tile.rotationY);
    return {
      position: [tile.position[0] + SPOT * sin, TILE_H, tile.position[2] + SPOT * cos],
      rotationY: tile.rotationY,
    };
  }, [field]);

  useFrame(() => {
    // lerakáskor rugalmasan előugrik a hóból
    const t = Math.min(1, (Date.now() - placedAt.current) / POP_TIME);
    const s = t < 1 ? 1 - Math.cos(t * Math.PI * 2.5) * Math.exp(-t * 5) : 1;
    group.current.scale.setScalar(SCALE * Math.max(0.01, s));
  });

  return (
    <group ref={group} position={position} rotation-y={rotationY}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
