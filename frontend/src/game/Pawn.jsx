import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE_H, tilePlacement } from '../board/layout';

const FIELD_COUNT = 40;
const STEP_TIME = 0.3; // másodperc mezőnként
const HOP = 0.45; // ugrás magassága lépésenként
const LIFT = 0.1; // ennyivel emelkedik a mező, ha fölé visszük az egeret
const SCALE = 0.65; // kisebb bábuk, hogy hatan is elférjenek egy mezőn

// egyszerű bábu forgástesttel: talp, törzs, gallér; a fej külön gömb
const PROFILE = [
  [0, 0], [0.3, 0], [0.3, 0.06], [0.25, 0.1], [0.17, 0.15], [0.12, 0.22],
  [0.09, 0.44], [0.15, 0.47], [0.15, 0.51], [0.07, 0.54], [0, 0.54],
].map(([r, y]) => new THREE.Vector2(r, y));
const BODY_GEOMETRY = new THREE.LatheGeometry(PROFILE, 32);

// Minden játékosnak saját helye van a mezőn belül (mező szerinti x, z), így nem fedik egymást.
const SLOTS = [[-0.23, -0.45], [0.23, -0.45], [-0.23, 0.05], [0.23, 0.05], [-0.23, 0.55], [0.23, 0.55]];

function slotPositions(slot) {
  const [ox, oz] = SLOTS[slot % SLOTS.length];
  return Array.from({ length: FIELD_COUNT }, (_, i) => {
    const { position, rotationY } = tilePlacement(i);
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    return new THREE.Vector3(position[0] + ox * cos + oz * sin, TILE_H, position[2] - ox * sin + oz * cos);
  });
}

// A bábu mezőről mezőre ugrál, amíg el nem éri a `field` mezőt. Minden érintett mezőnél
// szól az onStep-nek, a célban az onArrived-nak.
export default function Pawn({ field, slot = 0, lifted, color = '#d63031', onStep, onArrived }) {
  const group = useRef();
  const anim = useRef({ current: field, progress: 0 });
  const positions = useMemo(() => slotPositions(slot), [slot]);

  useFrame((_, delta) => {
    const a = anim.current;
    const g = group.current;
    if (a.current === field) {
      g.position.copy(positions[field]);
      if (lifted) g.position.y += LIFT;
      return;
    }
    const next = (a.current + 1) % FIELD_COUNT;
    a.progress = Math.min(1, a.progress + delta / STEP_TIME);
    g.position.lerpVectors(positions[a.current], positions[next], a.progress);
    g.position.y += Math.sin(a.progress * Math.PI) * HOP;
    if (a.progress === 1) {
      a.current = next;
      a.progress = 0;
      onStep?.(next);
      if (next === field) onArrived?.(field);
    }
  });

  return (
    <group ref={group} scale={SCALE}>
      <mesh geometry={BODY_GEOMETRY} castShadow>
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.66, 0]} castShadow>
        <sphereGeometry args={[0.14, 24, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
    </group>
  );
}
