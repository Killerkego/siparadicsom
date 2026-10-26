import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import Board from '../board/Board';
import FixedCamera from '../board/FixedCamera';
import Scenery from '../scenery/Scenery';
import Dice from './Dice';
import Pawn from './Pawn';
import { FIELD_TYPES, SPECIAL_TYPES, countByType } from '../board/fieldTypes';
import boardData from '../data/board.json';

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

function FieldName({ field }) {
  return (
    <>
      <b>#{field.id}</b> {FIELD_TYPES[field.type].label}
      {field.special && ` – ${SPECIAL_TYPES[field.special]}`}
    </>
  );
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
      <div className="hovered">{hovered ? <FieldName field={hovered} /> : 'Vidd az egeret egy mezőre'}</div>
    </div>
  );
}

function GamePanel({ code, phase, roll, pawnField, onRoll, onLeave }) {
  return (
    <div className="game-panel">
      <button onClick={onRoll} disabled={phase !== 'idle'}>
        {phase === 'rolling' ? 'Gurul…' : phase === 'moving' ? 'Lép…' : 'Dobás'}
      </button>
      <div>
        Dobott szám: <b>{roll && phase !== 'rolling' ? roll.value : '–'}</b>
      </div>
      <div>
        Bábu: {phase === 'idle' ? <FieldName field={fields[pawnField]} /> : '…'}
      </div>
      <div className="game-code">
        Játékkód: <b>{code}</b>{' '}
        <button className="leave" onClick={onLeave}>
          Kilépés
        </button>
      </div>
    </div>
  );
}

export default function GameScreen({ code, onLeave }) {
  const [hovered, setHovered] = useState(null);
  const fontsReady = useFontsReady();

  // idle -> rolling (kocka gurul) -> moving (bábu lép) -> idle
  const [phase, setPhase] = useState('idle');
  const [roll, setRoll] = useState(null);
  const [pawnField, setPawnField] = useState(0);
  // a mező, amelyen a bábu épp áll lépés közben; ehhez fordul a kamera
  const [pawnAt, setPawnAt] = useState(0);

  const rollDice = () => {
    if (phase !== 'idle') return;
    // később a Python backend adhatja a dobás eredményét
    setRoll({ value: 1 + Math.floor(Math.random() * 6), id: Date.now() });
    setPhase('rolling');
  };

  return (
    <>
      <Canvas shadows="percentage" flat dpr={[1, 2]} camera={{ fov: 40, near: 0.5, far: 200 }}>
        <color attach="background" args={['#cfe2f0']} />
        <fog attach="fog" args={['#cfe2f0', 45, 110]} />
        <FixedCamera side={Math.floor(pawnAt / 10)} />
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
        <Dice
          roll={roll}
          disabled={phase !== 'idle'}
          onClick={rollDice}
          onRolled={(value) => {
            setPhase('moving');
            setPawnField((f) => (f + value) % fields.length);
          }}
        />
        <Pawn
          field={pawnField}
          lifted={phase === 'idle' && hovered?.id === pawnField}
          onStep={setPawnAt}
          onArrived={() => setPhase('idle')}
        />
      </Canvas>
      <Legend hovered={hovered} />
      <GamePanel code={code} phase={phase} roll={roll} pawnField={pawnField} onRoll={rollDice} onLeave={onLeave} />
    </>
  );
}
