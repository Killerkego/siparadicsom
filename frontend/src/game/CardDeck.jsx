import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CARD_TIME } from './timing';

// Kártyapakli az építkezés kis terén, a kocka mellett; a lapok teteje a hátlap képe. Kártyahúzó mezőn
// a felső lap felemelkedik, megfordulva (előlappal) a kamera elé repül, és ott lebeg, amíg a húzó játékos
// el nem fogadja (gomb vagy kattintás a lapra); utána összemegy és eltűnik.
const W = 0.6; // a kártyaképek aránya 3:4
const H = 0.8;
const T = 0.012;
const COUNT = 14; // ennyi lap látszik a pakliban (a valódi pakli 40 lapos, a szerver kezeli)
const TRAY = 0.05; // a pakli alatti fenyőfa tálca magassága
const DECK = new THREE.Vector3(0.6, 0.06 + TRAY, 2.3); // a tér jobb oldalán (a csoport a kamera felé fordul)
const SHOW = new THREE.Vector3(0, 3.6, 8.0); // a tábla elülső széle fölött, a kamera előtt
const SHOW_SCALE = 4.2;
const OUTRO_TIME = 450; // ms, az elfogadott lap eltűnése
// a felállított lap ennyivel dől hátra, hogy merőlegesen nézzen a felülről (22°) néző kamerára:
// így a lap teteje sem kerül ferdén távolabb, és a felirat végig éles marad
const FACE_TILT = THREE.MathUtils.degToRad(22);
const BACK_URL = '/cards/hatlap.jpg';
// Jósnő: a két kihúzott lap egymás mellett lebeg a kamera előtt, a választás után eltűnnek
const PICK_SCALE = 3.3;
const PICK_DX = 1.25; // a lapok középvonala a középtől oldalra
const PICK_DELAY = 400; // ms, előbb a Jósnő lapja tűnik el
const PICK_STAGGER = 180; // ms, a jobb oldali lap ennyivel később indul

const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// a kártyaképek egyszer töltődnek be, utána a gyorsítótárból jönnek
const loader = new THREE.TextureLoader();
const textures = new Map();
function cardTexture(url) {
  if (!textures.has(url)) {
    const texture = loader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16; // ferdén nézve is éles (a three a kártya maximumára korlátozza)
    textures.set(url, texture);
  }
  return textures.get(url);
}

// a lap két oldala: a hátlap felfelé, az előlap lefelé néz (a lap fekve a pakliban)
function CardFaces({ back, front }) {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={T / 2 + 0.0008} material={back}>
        <planeGeometry args={[W - 0.01, H - 0.01]} />
      </mesh>
      {front && (
        <mesh rotation-x={Math.PI / 2} position-y={-T / 2 - 0.0008} material={front}>
          <planeGeometry args={[W - 0.01, H - 0.01]} />
        </mesh>
      )}
    </>
  );
}

// Jósnő egyik lapja: a pakli tetejéről a kamera elé repül a helyére (side: -1 bal, 1 jobb), ott lebeg;
// a választó játékos rákattintva választ. leave: a választás ideje, chosen: ezt a lapot választotta.
function PickCard({ id, side, start, leave, chosen, geometry, top, onPick }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  const materials = useMemo(() => {
    const face = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false });
    return {
      edge: new THREE.MeshStandardMaterial({ color: '#e6dccb', roughness: 0.8, transparent: true }),
      back: face(cardTexture(BACK_URL)),
      front: face(cardTexture(`/cards/${id}.jpg`)),
    };
  }, [id]);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);
  useEffect(() => () => (document.body.style.cursor = 'auto'), []);

  const target = useMemo(() => new THREE.Vector3(SHOW.x + side * PICK_DX, SHOW.y - 0.2, SHOW.z), [side]);

  useFrame(() => {
    const c = ref.current;
    const now = Date.now();
    const t = clamp01((now - start) / CARD_TIME);
    const fade = leave ? clamp01((now - leave) / OUTRO_TIME) : 0;
    c.visible = now >= start && fade < 1;
    if (!c.visible) return;
    const lift = smooth(clamp01(t / 0.3));
    const fly = smooth(clamp01((t - 0.3) / 0.7));
    const from = new THREE.Vector3(DECK.x + top.dx, top.y + T + 0.35 * lift, DECK.z);
    c.position.lerpVectors(from, target, fly);
    c.position.y +=
      Math.sin(fly * Math.PI) * 0.8 +
      (fly === 1 ? 0.06 * Math.sin(now / 500 + side) : 0) +
      (chosen ? fade * 1.2 : -fade * 0.6);
    c.rotation.set(-fly * (Math.PI / 2 + FACE_TILT), top.rot * (1 - fly) + fly * Math.PI * 2, 0);
    const pop = hovered && onPick && !leave ? 1.06 : 1;
    c.scale.setScalar(THREE.MathUtils.lerp(1, PICK_SCALE, fly) * pop * (1 - fade * 0.5));
    materials.edge.opacity = materials.back.opacity = materials.front.opacity = 1 - fade;
  });

  const clickable = onPick && !leave;
  return (
    <group
      ref={ref}
      visible={false}
      onClick={(e) => {
        if (!clickable || !ref.current.visible) return;
        e.stopPropagation();
        onPick(id);
      }}
      onPointerOver={() => {
        setHovered(true);
        if (clickable) document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh geometry={geometry} material={materials.edge} castShadow />
      <CardFaces back={materials.back} front={materials.front} />
    </group>
  );
}

// draw: { seq, start, card } – a húzás kezdete a böngésző órája szerint és a lap azonosítója;
// held: a lap még elfogadásra vár; onAck: ha a néző fogadhatja el, a lapra kattintva is megteheti;
// pick: a Jósnő két lapja, amíg a választás tart; onPick: ha a néző választ, a lapra kattintva teheti meg
export default function CardDeck({ draw, held, onAck, pick, onPick }) {
  const card = useRef();
  const outro = useRef({ seq: null, start: 0 });
  const heldSeq = useRef(null); // melyik húzás lapját láttuk várakozni (újratöltéskor a régi ne villanjon fel)
  const geometry = useMemo(() => new RoundedBoxGeometry(W, T, H, 2, 0.03), []);
  // a pakli lapjainak széle a hátlap sötétkékje, így az egész csomag hátlapos lapoknak látszik
  const edge = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1d2a4d', roughness: 0.6 }), []);
  const tray = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b98a5e', roughness: 0.6 }), []);
  const back = useMemo(() => new THREE.MeshStandardMaterial({ map: cardTexture(BACK_URL), roughness: 0.55 }), []);
  // a húzott lapnak saját anyagai vannak, hogy az elhalványulás ne érintse a paklit. A lapok képe
  // fény és tónusleképezés nélkül, pontosan a kép színeivel látszik: a megvilágítás és a filmes
  // tónusleképezés a világos arany feliratot beleolvasztotta a krémszínű háttérbe (homályosnak tűnt)
  const drawn = useMemo(() => {
    const face = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false });
    return {
      edge: new THREE.MeshStandardMaterial({ color: '#e6dccb', roughness: 0.8, transparent: true }),
      back: face(cardTexture(BACK_URL)),
      front: face(null),
    };
  }, []);
  useEffect(
    () => () => {
      [geometry, edge, tray, back, drawn.edge, drawn.back, drawn.front].forEach((x) => x.dispose());
    },
    [geometry, edge, tray, back, drawn],
  );

  // a húzott lap előlapja
  useEffect(() => {
    if (!draw?.card) return;
    const map = cardTexture(`/cards/${draw.card}.jpg`);
    drawn.front.map = map;
    drawn.front.needsUpdate = true;
  }, [draw, drawn]);

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
        rot: Math.sin(i * 2.7) * 0.08,
        dx: Math.sin(i * 1.3) * 0.02,
      })),
    [],
  );
  const top = stack[COUNT - 1];

  // a Jósnő lapjai: megjelenéskor felrepülnek, a választás után (a szerver már nem küldi őket) még
  // egy rövid ideig eltűnőben látszanak; a választó a saját választását is tudja
  const pickKey = pick?.join(',');
  const [picking, setPicking] = useState(null);
  useEffect(() => {
    if (pickKey) {
      setPicking((p) => (p?.key === pickKey ? p : { key: pickKey, options: pickKey.split(','), start: Date.now() + PICK_DELAY }));
      return;
    }
    setPicking((p) => (p && !p.leave ? { ...p, leave: Date.now() } : p));
    const timer = setTimeout(() => setPicking((p) => (p?.leave ? null : p)), OUTRO_TIME + 50);
    return () => clearTimeout(timer);
  }, [pickKey]);
  const choose = (id) => {
    setPicking((p) => p && { ...p, chosen: id });
    onPick(id);
  };

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
    // 1) felemelkedik a pakliról, 2) megfordulva (előlappal a kamera felé) elé repül, 3) ott lebeg,
    // 4) elfogadáskor eltűnik. A -90° körüli fordulat után az előlap néz a kamerára, felfelé dőlve.
    const lift = smooth(clamp01(t / 0.3));
    const fly = smooth(clamp01((t - 0.3) / 0.7));
    const from = new THREE.Vector3(DECK.x + top.dx, top.y + T + 0.35 * lift, DECK.z);
    c.position.lerpVectors(from, SHOW, fly);
    c.position.y += Math.sin(fly * Math.PI) * 0.8 + (fly === 1 ? 0.06 * Math.sin(now / 500) : 0) + fade * 1.2;
    c.rotation.set(-fly * (Math.PI / 2 + FACE_TILT), top.rot * (1 - fly) + fly * Math.PI * 2, 0);
    c.scale.setScalar(THREE.MathUtils.lerp(1, SHOW_SCALE, fly) * (1 - fade * 0.6));
    drawn.edge.opacity = drawn.back.opacity = drawn.front.opacity = 1 - fade;
  });

  return (
    <group>
      {/* fenyőfa tálca, hogy a pakli ne olvadjon bele a hóba */}
      <mesh position={[DECK.x, DECK.y - TRAY / 2, DECK.z]} material={tray} castShadow receiveShadow>
        <boxGeometry args={[W + 0.14, TRAY, H + 0.14]} />
      </mesh>
      {/* a pakli: minden lapon a hátlap képe (az elcsúszott lapok szélén is látszik) */}
      {stack.map((s, i) => (
        <group key={i} position={[DECK.x + s.dx, s.y, DECK.z]} rotation-y={s.rot}>
          <mesh geometry={geometry} material={edge} castShadow receiveShadow />
          <CardFaces back={back} />
        </group>
      ))}
      {/* a húzott lap */}
      <group
        ref={card}
        visible={false}
        onClick={(e) => {
          if (!onAck || !card.current.visible) return;
          e.stopPropagation();
          onAck();
        }}
        onPointerOver={() => onAck && (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      >
        <mesh geometry={geometry} material={drawn.edge} castShadow />
        <CardFaces back={drawn.back} front={drawn.front} />
      </group>
      {/* a Jósnő két lapja */}
      {picking?.options.map((id, i) => (
        <PickCard
          key={`${picking.key}-${id}`}
          id={id}
          side={i ? 1 : -1}
          start={picking.start + i * PICK_STAGGER}
          leave={picking.leave}
          chosen={picking.chosen === id}
          geometry={geometry}
          top={top}
          onPick={onPick && !picking.leave ? choose : null}
        />
      ))}
    </group>
  );
}
