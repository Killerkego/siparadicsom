import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CARD_TIME } from './timing';

// Kártyapakli az építkezés kis terén, a kocka mellett. Kártyahúzó mezőn a felső lap felemelkedik,
// megfordulva a kamera elé repül, és ott lebeg, amíg a húzó játékos le nem okézza (gomb vagy kattintás
// a lapra); utána összemegy és eltűnik. A lapok egyelőre üres fehér lapok, hatásuk nincs.
const W = 0.55;
const H = 0.8;
const T = 0.012;
const COUNT = 14;
const TRAY = 0.05; // a pakli alatti fenyőfa tálca magassága
const DECK = new THREE.Vector3(0.6, 0.06 + TRAY, 2.3); // a tér jobb oldalán (a csoport a kamera felé fordul)
const SHOW = new THREE.Vector3(0, 3.6, 8.0); // a tábla elülső széle fölött, a kamera előtt
const SHOW_SCALE = 4.2;
const OUTRO_TIME = 450; // ms, az elfogadott lap eltűnése

const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// draw: { seq, start } – a húzás kezdete a böngésző órája szerint; held: a lap még elfogadásra vár;
// onAck: ha a néző fogadhatja el, a lapra kattintva is megteheti
export default function CardDeck({ draw, held, onAck }) {
  const card = useRef();
  const outro = useRef({ seq: null, start: 0 });
  const heldSeq = useRef(null); // melyik húzás lapját láttuk várakozni (újratöltéskor a régi ne villanjon fel)
  const geometry = useMemo(() => new RoundedBoxGeometry(W, T, H, 2, 0.035), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbfaf7', roughness: 0.6 }), []);
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9cdb8', roughness: 0.8 }), []);
  const tray = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b98a5e', roughness: 0.6 }), []);
  // a húzott lapnak saját anyaga van, hogy az elhalványulás ne érintse a paklit
  // (kis saját fénnyel, hogy a kamera felé fordítva se szürküljön el)
  const drawn = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#fbfaf7',
        roughness: 0.6,
        transparent: true,
        emissive: '#ffffff',
        emissiveIntensity: 0.35,
      }),
    [],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      edge.dispose();
      drawn.dispose();
      tray.dispose();
    },
    [geometry, material, edge, drawn, tray],
  );

  // amikor a lapot elfogadják, innen indul az eltűnése (helyi idő, rövid animáció)
  useEffect(() => {
    if (draw && held) heldSeq.current = draw.seq;
    else if (draw && heldSeq.current === draw.seq && outro.current.seq !== draw.seq) {
      outro.current = { seq: draw.seq, start: Date.now() };
    }
  }, [draw, held]);

  // a pakli lapjai kicsit elcsúszva, hogy valódi kártyacsomónak tűnjön
  const stack = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        y: DECK.y + T / 2 + i * T,
        rot: Math.sin(i * 2.7) * 0.05,
        dx: Math.sin(i * 1.3) * 0.012,
      })),
    [],
  );
  const top = stack[COUNT - 1];

  useFrame(() => {
    const c = card.current;
    const now = Date.now();
    const t = draw ? clamp01((now - draw.start) / CARD_TIME) : 1;
    const leaving = !held && draw && outro.current.seq === draw.seq;
    const fade = leaving ? clamp01((now - outro.current.start) / OUTRO_TIME) : 0;
    if (!draw || now < draw.start || (!held && !leaving) || fade >= 1) {
      c.visible = false;
      return;
    }
    c.visible = true;
    // 1) felemelkedik a pakliról, 2) megfordulva a kamera elé repül, 3) ott lebeg, 4) elfogadáskor eltűnik
    const lift = smooth(clamp01(t / 0.3));
    const fly = smooth(clamp01((t - 0.3) / 0.7));
    const from = new THREE.Vector3(DECK.x + top.dx, top.y + T + 0.35 * lift, DECK.z);
    c.position.lerpVectors(from, SHOW, fly);
    c.position.y += Math.sin(fly * Math.PI) * 0.8 + (fly === 1 ? 0.06 * Math.sin(now / 500) : 0) + fade * 1.2;
    c.rotation.set(fly * (Math.PI / 2 - 0.25), top.rot * (1 - fly) + fly * Math.PI * 2, 0);
    c.scale.setScalar(THREE.MathUtils.lerp(1, SHOW_SCALE, fly) * (1 - fade * 0.6));
    drawn.opacity = 1 - fade;
  });

  return (
    <group>
      {/* fenyőfa tálca, hogy a fehér pakli ne olvadjon bele a hóba */}
      <mesh position={[DECK.x, DECK.y - TRAY / 2, DECK.z]} material={tray} castShadow receiveShadow>
        <boxGeometry args={[W + 0.14, TRAY, H + 0.14]} />
      </mesh>
      {/* a pakli: alul bézs szélű lapok, felül tiszta fehér */}
      {stack.map((s, i) => (
        <mesh
          key={i}
          geometry={geometry}
          material={i === COUNT - 1 ? material : edge}
          position={[DECK.x + s.dx, s.y, DECK.z]}
          rotation-y={s.rot}
          castShadow
          receiveShadow
        />
      ))}
      {/* a húzott lap */}
      <mesh
        ref={card}
        geometry={geometry}
        material={drawn}
        visible={false}
        castShadow
        onClick={(e) => {
          if (!onAck || !card.current.visible) return;
          e.stopPropagation();
          onAck();
        }}
        onPointerOver={() => onAck && (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      />
    </group>
  );
}
