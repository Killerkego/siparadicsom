import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import Board from '../board/Board';
import FixedCamera from '../board/FixedCamera';
import Scenery from '../scenery/Scenery';
import Dice from './Dice';
import Pawn from './Pawn';
import { DICE_TIME, fieldAt, rollEnd, rollStart } from './timing';
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

function GamePanel({ game, playerId, shownField, phase, busy, roll, error, onRoll, onLeave }) {
  const myTurn = game.turn_player_id === playerId;
  const turnPlayer = game.players.find((p) => p.id === game.turn_player_id);
  const roller = roll && game.players.find((p) => p.id === roll.player_id);

  return (
    <div className="game-panel">
      <button onClick={onRoll} disabled={!myTurn || busy}>
        {phase === 'rolling' ? 'Gurul…' : phase === 'moving' ? 'Lép…' : myTurn ? 'Dobás' : 'Várj a sorodra'}
      </button>
      <div>
        Következik: <b>{myTurn ? 'te' : turnPlayer?.name}</b>
      </div>
      <div>
        Dobott szám: <b>{roll && phase !== 'rolling' ? `${roll.value} (${roller?.name ?? '?'})` : '–'}</b>
      </div>
      <ul className="panel-players">
        {game.players.map((p) => (
          <li key={p.id} className={p.id === game.turn_player_id ? 'turn' : ''}>
            <span className="dot" style={{ background: p.color }} />
            <span>
              {p.name}
              {p.id === playerId && ' (te)'}: <FieldName field={fields[shownField(p)]} />
            </span>
          </li>
        ))}
      </ul>
      {error && <div className="error">{error}</div>}
      <div className="game-code">
        Játékkód: <b>{game.code}</b>{' '}
        <button className="leave" onClick={onLeave}>
          Kilépés
        </button>
      </div>
    </div>
  );
}

export default function GameScreen({ game, playerId, onRoll, onLeave }) {
  const [hovered, setHovered] = useState(null);
  const fontsReady = useFontsReady();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  // Az utolsó dobás a szerver órája szerinti időpontban indult. Ezt dobásonként egyszer számoljuk
  // át a böngésző órájára, így minden böngészőben egyszerre fut a kocka és a bábu animációja.
  const last = game.last_roll;
  const roll = useMemo(() => last && { ...last, start: rollStart(last, game) }, [last?.seq]);
  const end = roll ? rollEnd(roll, roll.start) : 0;

  // amíg tart a dobás, a gomb, a panel és a kamera az időt követi
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!roll) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= end) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [roll, end]);

  // idle -> rolling (kocka gurul) -> moving (a dobó bábuja lép) -> idle
  const phase = !roll || now >= end ? 'idle' : now < roll.start + DICE_TIME ? 'rolling' : 'moving';
  const busy = phase !== 'idle' || requesting;
  const myTurn = game.turn_player_id === playerId;
  // a dobó bábuja az animáció szerinti mezőn látszik, a többiek a szerver szerinti helyükön
  const shownField = (p) => (roll && p.id === roll.player_id ? fieldAt(roll, roll.start, now) : p.position);
  // mindenkinél a saját bábuja felé fordul a kamera; mások lépésére nem változik a nézet
  const me = game.players.find((p) => p.id === playerId);
  const focusField = me ? shownField(me) : 0;

  const rollDice = async () => {
    if (busy || !myTurn) return;
    setRequesting(true);
    setError('');
    try {
      await onRoll();
    } catch (e) {
      setError(e.message);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <>
      <Canvas shadows="percentage" flat dpr={[1, 2]} camera={{ fov: 40, near: 0.5, far: 200 }}>
        <color attach="background" args={['#cfe2f0']} />
        <fog attach="fog" args={['#cfe2f0', 45, 110]} />
        <FixedCamera side={Math.floor(focusField / 10)} />
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
        <Dice roll={roll} disabled={busy || !myTurn} onClick={rollDice} />
        {game.players.map((p, i) => (
          <Pawn
            key={p.id}
            field={p.position}
            roll={roll?.player_id === p.id ? roll : null}
            slot={i}
            color={p.color}
            lifted={phase === 'idle' && hovered?.id === p.position}
          />
        ))}
      </Canvas>
      <Legend hovered={hovered} />
      <GamePanel
        game={game}
        playerId={playerId}
        shownField={shownField}
        phase={phase}
        busy={busy}
        roll={roll}
        error={error}
        onRoll={rollDice}
        onLeave={onLeave}
      />
    </>
  );
}
