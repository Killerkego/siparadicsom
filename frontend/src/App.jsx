import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import Board from './board/Board';
import FixedCamera from './board/FixedCamera';
import Scenery from './scenery/Scenery';
import { FIELD_TYPES, SPECIAL_TYPES, countByType } from './board/fieldTypes';
import boardData from './data/board.json';

const fields = boardData.fields;
const counts = countByType(fields);

// a mezők feliratai canvasra rajzolódnak, ezért előbb be kell tölteni a betűtípust
function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all(['400', '700', '800'].map((w) => document.fonts.load(`${w} 32px Nunito`))).finally(() =>
      setReady(true),
    );
  }, []);
  return ready;
}

function Legend({ hovered }) {
  return (
    <div className="legend">
      <h1>Síparadicsom</h1>
      <ul>
        {Object.entries(FIELD_TYPES).map(([key, t]) => (
          <li key={key} className={counts[key] === t.count ? '' : 'mismatch'}>
            <span className="name">{t.label}</span>
            <span className="count">{counts[key] ?? 0}</span>
          </li>
        ))}
      </ul>
      <div className="hovered">
        {hovered ? (
          <>
            <b>#{hovered.id}</b> {FIELD_TYPES[hovered.type].label}
            {hovered.special && ` – ${SPECIAL_TYPES[hovered.special]}`}
          </>
        ) : (
          'Vidd az egeret egy mezőre'
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [hovered, setHovered] = useState(null);
  const fontsReady = useFontsReady();

  return (
    <>
      <Canvas shadows="percentage" flat dpr={[1, 2]} camera={{ fov: 40, near: 0.5, far: 200 }}>
        <color attach="background" args={['#cfe2f0']} />
        <fog attach="fog" args={['#cfe2f0', 45, 110]} />
        <FixedCamera />
        <hemisphereLight args={['#eaf4ff', '#b9c7d4', 0.75]} />
        <directionalLight
          position={[-9, 18, 10]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
          shadow-camera-left={-32}
          shadow-camera-right={32}
          shadow-camera-top={32}
          shadow-camera-bottom={-32}
          shadow-camera-near={1}
          shadow-camera-far={60}
        />
        <Suspense fallback={null}>
          <Scenery />
        </Suspense>
        {fontsReady && <Board fields={fields} onHover={setHovered} />}
      </Canvas>
      <Legend hovered={hovered} />
    </>
  );
}
