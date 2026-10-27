import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
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

function GamePanel({ game, playerId, display, phase, busy, lastRoll, error, onRoll, onLeave }) {
  const myTurn = game.turn_player_id === playerId;
  const turnPlayer = game.players.find((p) => p.id === game.turn_player_id);
  const roller = lastRoll && game.players.find((p) => p.id === lastRoll.player_id);

  return (
    <div className="game-panel">
      <button onClick={onRoll} disabled={!myTurn || busy}>
        {phase === 'rolling' ? 'Gurul…' : phase === 'moving' ? 'Lép…' : myTurn ? 'Dobás' : 'Várj a sorodra'}
      </button>
      <div>
        Következik: <b>{myTurn ? 'te' : turnPlayer?.name}</b>
      </div>
      <div>
        Dobott szám: <b>{lastRoll && phase !== 'rolling' ? `${lastRoll.value} (${roller?.name ?? '?'})` : '–'}</b>
      </div>
      <ul className="panel-players">
        {game.players.map((p) => (
          <li key={p.id} className={p.id === game.turn_player_id ? 'turn' : ''}>
            <span className="dot" style={{ background: p.color }} />
            <span>
              {p.name}
              {p.id === playerId && ' (te)'}: <FieldName field={fields[display[p.id] ?? p.position]} />
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

function positionsOf(game) {
  return Object.fromEntries(game.players.map((p) => [p.id, p.position]));
}

export default function GameScreen({ game, playerId, onRoll, onLeave }) {
  const [hovered, setHovered] = useState(null);
  const fontsReady = useFontsReady();

  // A szerver sorsolja a dobást; minden böngésző sorban lejátssza a dobásokat:
  // idle -> rolling (kocka gurul) -> moving (a dobó bábuja lép) -> idle
  const [phase, setPhase] = useState('idle');
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null); // az épp lejátszott (vagy utolsó) dobás
  const seenSeq = useRef(game.last_roll?.seq ?? 0);
  const doneSeq = useRef(game.last_roll?.seq ?? 0);
  // a bábuk látható helye; a dobó bábuja csak a kocka landolása után indul el
  const [display, setDisplay] = useState(() => positionsOf(game));
  // a mező, amelyen a lépő bábu épp jár
  const [pawnAt, setPawnAt] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const r = game.last_roll;
    if (r && r.seq > seenSeq.current) {
      seenSeq.current = r.seq;
      setQueue((q) => [...q, r]);
    }
  }, [game.last_roll]);

  useEffect(() => {
    if (phase !== 'idle' || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setActive(next);
    setPawnAt(next.from);
    setPhase('rolling');
  }, [phase, queue]);

  // ha minden dobás lejátszódott, a bábuk a szerver szerinti helyen állnak (pl. kilépés után)
  useEffect(() => {
    if (phase === 'idle' && (game.last_roll?.seq ?? 0) <= doneSeq.current) setDisplay(positionsOf(game));
  }, [phase, game]);

  const busy = phase !== 'idle' || queue.length > 0 || requesting;
  const diceRoll = useMemo(() => active && { value: active.value, id: active.seq }, [active]);
  // mindenkinél a saját bábuja felé fordul a kamera; mások lépésére nem változik a nézet
  const myPawnMoving = phase !== 'idle' && active?.player_id === playerId;
  const focusField = myPawnMoving ? pawnAt : (display[playerId] ?? 0);

  const rollDice = async () => {
    if (busy || game.turn_player_id !== playerId) return;
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
        <Dice
          roll={diceRoll}
          disabled={busy || game.turn_player_id !== playerId}
          onClick={rollDice}
          onRolled={() => {
            setPhase('moving');
            setDisplay((d) => ({ ...d, [active.player_id]: active.to }));
          }}
        />
        {game.players.map((p, i) => {
          const moving = phase === 'moving' && p.id === active?.player_id;
          return (
            <Pawn
              key={p.id}
              field={display[p.id] ?? p.position}
              slot={i}
              color={p.color}
              lifted={phase === 'idle' && hovered?.id === display[p.id]}
              onStep={moving ? setPawnAt : undefined}
              onArrived={
                moving
                  ? () => {
                      doneSeq.current = active.seq;
                      setPhase('idle');
                    }
                  : undefined
              }
            />
          );
        })}
      </Canvas>
      <Legend hovered={hovered} />
      <GamePanel
        game={game}
        playerId={playerId}
        display={display}
        phase={phase}
        busy={busy}
        lastRoll={active}
        error={error}
        onRoll={rollDice}
        onLeave={onLeave}
      />
    </>
  );
}
