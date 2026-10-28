import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { TILE_H, tilePlacement } from '../board/layout';
import { FIGURES } from './figures';
import { FIELD_COUNT, pawnState } from './timing';

const HOP = 0.45; // ugrás magassága lépésenként
const JUMP_HOP = 3; // felvonós átugrás ívének magassága
const LIFT = 0.1; // ennyivel emelkedik a mező, ha fölé visszük az egeret
const SCALE = 0.65; // kisebb bábuk, hogy négyen is elférjenek egy mezőn

// Figurás bábuk fatalpon (Blender: babuk.py). A figurát a játékos a lobbiban választja;
// a talp színes csíkja ('Babu_jelolo') a játékos színe.
export const MODEL_URL = '/models/babuk.glb';

// Minden játékosnak saját helye van a mezőn belül (mező szerinti x, z), így nem fedik egymást.
const SLOTS = [[-0.23, -0.45], [0.23, -0.45], [-0.23, 0.05], [0.23, 0.05]];

function slotPlacements(slot) {
  const [ox, oz] = SLOTS[slot % SLOTS.length];
  return Array.from({ length: FIELD_COUNT }, (_, i) => {
    const { position, rotationY } = tilePlacement(i);
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    return {
      position: new THREE.Vector3(position[0] + ox * cos + oz * sin, TILE_H, position[2] - ox * sin + oz * cos),
      rotationY,
    };
  });
}

function angleLerp(a, b, t) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}

// a figura saját példánya a játékos színével (a táblán és a lobbi előnézetében)
export function useFigure(index, color) {
  const { scene } = useGLTF(MODEL_URL);
  const figure = useMemo(() => {
    const clone = scene.getObjectByName(FIGURES[index % FIGURES.length].model).clone();
    clone.position.set(0, 0, 0);
    clone.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if (o.material.name === 'Babu_jelolo') {
        o.material = o.material.clone();
        o.material.color.set(color);
      }
    });
    return clone;
  }, [scene, index, color]);
  useEffect(
    () => () =>
      figure.traverse((o) => {
        if (o.isMesh && o.material.name === 'Babu_jelolo') o.material.dispose();
      }),
    [figure],
  );
  return figure;
}

// A bábu a `field` mezőn áll, arccal a tábla széle (a kamera) felé. Ha `action` is van (a bábu utolsó
// mozgása, `start` időponttal), akkor a kocka után végigjárja: előre vagy hátra mezőről mezőre ugrál,
// felvonóval átrepül. A helyzetét mindig az eltelt időből számoljuk, így minden böngészőben ugyanott tart.
export default function Pawn({ field, action, slot = 0, figure: figureIndex = 0, lifted, color = '#d63031' }) {
  const group = useRef();
  const placements = useMemo(() => slotPlacements(slot), [slot]);
  const figure = useFigure(figureIndex, color);

  useFrame(() => {
    const g = group.current;
    const state = action && pawnState(action, action.start, Date.now());
    if (state) {
      const from = placements[state.from];
      const to = placements[state.to];
      g.position.lerpVectors(from.position, to.position, state.p);
      g.position.y += Math.sin(state.p * Math.PI) * (state.jump ? JUMP_HOP : HOP);
      g.rotation.y = angleLerp(from.rotationY, to.rotationY, state.p);
      return;
    }
    g.position.copy(placements[field].position);
    g.rotation.y = placements[field].rotationY;
    if (lifted) g.position.y += LIFT;
  });

  return (
    <group ref={group} scale={SCALE}>
      <primitive object={figure} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
