import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import Board from '../board/Board';
import FixedCamera from '../board/FixedCamera';
import Scenery from '../scenery/Scenery';
import Sky, { HORIZON_COLOR } from '../scenery/Sky';
import BuildSite from './BuildSite';
import Dice from './Dice';
import Pawn, { FIGURE_NAMES } from './Pawn';
import { DICE_TIME, actionEnd, actionStart, shownField } from './timing';
import { FIELD_TYPES, SPECIAL_TYPES } from '../board/fieldTypes';
import boardData from '../data/board.json';

const fields = boardData.fields;
const DECISIONS = { gamble: 'Gambling', lift: 'Felvonó', trap: 'Csapda', build: 'Építkezés' };

const hk = (n) => `${n.toLocaleString('hu-HU')} HK`;

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

function buildPrice(building, discount) {
  return Math.round((building.price * (100 - discount)) / 100 / 50) * 50;
}

// egy építési elem állapota a játékosnál: megvan / megvehető / hiányzik az előfeltétele
function buildState(building, owned) {
  if (owned.includes(building.id)) return 'owned';
  return building.requires.every((r) => owned.includes(r)) ? 'available' : 'locked';
}

// a kör végi építkezés: legfeljebb egy elem, vásárlási mezőn kedvezménnyel
function BuildDecision({ pending, buildings, busy, onChoose }) {
  const options = buildings.filter((b) => pending.options.includes(b.id));
  return (
    <div className="decision">
      <b>Építkezés a kör végén</b>
      <p>
        Legfeljebb egy elemet építhetsz meg.
        {pending.discount > 0 && ` Vásárlási mezőn állsz: ${pending.discount}% kedvezmény!`}
      </p>
      <div className="choices build-options">
        {options.map((b) => (
          <button key={b.id} disabled={busy} onClick={() => onChoose(b.id)}>
            {b.name}
            <span className="price">
              {pending.discount > 0 && <s>{hk(b.price)}</s>} {hk(buildPrice(b, pending.discount))}
            </span>
          </button>
        ))}
        <button className="secondary" disabled={busy} onClick={() => onChoose('no')}>
          Most nem építek
        </button>
      </div>
    </div>
  );
}

// a saját építkezés: mi van meg, mi vehető, minek hiányzik az előfeltétele
function BuildList({ buildings, owned }) {
  const nameOf = (id) => buildings.find((b) => b.id === id)?.name;
  return (
    <div className="build-list">
      <div>
        Építkezésem: <b>{owned.length} / {buildings.length}</b>
      </div>
      <div className="progress">
        <span style={{ width: `${(owned.length / buildings.length) * 100}%` }} />
      </div>
      <ul>
        {buildings.map((b) => {
          const state = buildState(b, owned);
          const missing = b.requires.filter((r) => !owned.includes(r)).map(nameOf);
          return (
            <li key={b.id} className={state} title={missing.length ? `Előfeltétel: ${missing.join(', ')}` : ''}>
              <span className="mark">{state === 'owned' ? '✔' : state === 'available' ? '●' : '🔒'}</span>
              {b.name}
              <span className="price">{state === 'owned' ? 'kész' : hk(b.price)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// a speciális mezőn hozott döntés gombjai; csak annál látszik, aki a mezőre lépett
function Decision({ pending, rules, buildings, me, busy, onChoose }) {
  if (pending.type === 'build') return <BuildDecision pending={pending} buildings={buildings} busy={busy} onChoose={onChoose} />;
  if (pending.type === 'gamble') {
    return (
      <div className="decision">
        <b>Gambling</b>
        <p>
          Kockáztatsz? 1–3: {rules.gamble_back} mezőt vissza, 4–6: +{hk(rules.gamble_prize)}.
        </p>
        <div className="choices">
          <button disabled={busy} onClick={() => onChoose('yes')}>
            Igen, dobok
          </button>
          <button className="secondary" disabled={busy} onClick={() => onChoose('no')}>
            Nem
          </button>
        </div>
      </div>
    );
  }
  if (pending.type === 'lift') {
    const poor = me.money < rules.lift_cost;
    return (
      <div className="decision">
        <b>Felvonó</b>
        <p>
          {hk(rules.lift_cost)}-ért átvisz egy másik felvonóhoz.{poor && ' Nincs elég pénzed.'}
        </p>
        <div className="choices">
          {pending.targets.map((t) => (
            <button key={t} disabled={busy || poor} onClick={() => onChoose(String(t))}>
              #{t}
            </button>
          ))}
          <button className="secondary" disabled={busy} onClick={() => onChoose('no')}>
            Maradok
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="decision">
      <b>Csapda</b>
      <p>Rakj csapdát! Aki legközelebb ide lép, azt ezzel szívatod meg:</p>
      <div className="choices">
        <button disabled={busy} onClick={() => onChoose('back')}>
          {rules.trap_back} mező vissza
        </button>
        <button disabled={busy} onClick={() => onChoose('money')}>
          {hk(rules.trap_money)} nekem
        </button>
      </div>
    </div>
  );
}

function GamePanel({ game, settled, playerId, fieldOf, phase, busy, action, error, onRoll, onChoose, onLeave }) {
  const myTurn = game.turn_player_id === playerId;
  const turnPlayer = game.players.find((p) => p.id === game.turn_player_id);
  const me = game.players.find((p) => p.id === playerId);
  const pending = phase === 'idle' ? game.pending : null;
  const roller = action && game.players.find((p) => p.id === action.player_id);
  // pénz, oktatás, csapdák és napló a mozgás végéig az előző állapot szerint, hogy ne derüljön ki előre
  const settledPlayer = (p) => settled.players.find((s) => s.id === p.id) ?? p;
  const nameOf = (id) => game.players.find((p) => p.id === id)?.name ?? '?';

  let label = myTurn ? 'Dobás' : 'Várj a sorodra';
  if (phase === 'rolling') label = 'Gurul…';
  else if (phase === 'moving') label = 'Lép…';
  else if (game.pending) label = `${turnPlayer?.name} dönt…`;

  return (
    <div className="game-panel">
      {pending && pending.player_id === playerId ? (
        <Decision pending={pending} rules={game.rules} buildings={game.buildings} me={me} busy={busy} onChoose={onChoose} />
      ) : (
        <button onClick={onRoll} disabled={!myTurn || busy || !!game.pending}>
          {label}
        </button>
      )}
      {myTurn && me?.in_school && !game.pending && phase === 'idle' && (
        <div className="hint">Oktatáson vagy: páros dobással mehetsz tovább.</div>
      )}
      <div>
        Következik: <b>{myTurn ? 'te' : turnPlayer?.name}</b>
        {pending && pending.player_id !== playerId && ` (${DECISIONS[pending.type]})`}
      </div>
      <div>
        Dobott szám: <b>{action?.dice && phase !== 'rolling' ? `${action.dice} (${roller?.name ?? '?'})` : '–'}</b>
      </div>
      <ul className="panel-players">
        {game.players.map((p) => {
          const s = settledPlayer(p);
          return (
            <li key={p.id} className={p.id === game.turn_player_id ? 'turn' : ''}>
              <span className="dot" style={{ background: p.color }} />
              <span>
                {p.name}
                {p.id === playerId && ' (te)'}: <FieldName field={fields[fieldOf(p)]} />
                <br />
                <span className={s.money < 0 ? 'money debt' : 'money'}>{hk(s.money)}</span>
                {s.in_school && ' · oktatáson'}
                {' · '}
                <span title={s.buildings.map((id) => game.buildings.find((b) => b.id === id)?.name).join(', ')}>
                  🏗 {s.buildings.length}/{game.buildings.length}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {me && <BuildList buildings={game.buildings} owned={settledPlayer(me).buildings} />}
      {Object.keys(settled.traps).length > 0 && (
        <div className="traps">
          {Object.entries(settled.traps).map(([field, trap]) => (
            <div key={field}>
              Csapda a #{field} mezőn: {nameOf(trap.owner)}
              {trap.owner === playerId &&
                ` (${trap.kind === 'back' ? `${game.rules.trap_back} mező vissza` : hk(game.rules.trap_money)})`}
            </div>
          ))}
        </div>
      )}
      {settled.log.length > 0 && (
        <ul className="log">
          {settled.log
            .slice(-4)
            .reverse()
            .map((text, i) => (
              <li key={settled.log.length - i}>{text}</li>
            ))}
        </ul>
      )}
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

export default function GameScreen({ game, playerId, onRoll, onChoose, onLeave }) {
  const [hovered, setHovered] = useState(null);
  const fontsReady = useFontsReady();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  // Az utolsó mozgás a szerver órája szerinti időpontban indult. Ezt mozgásonként egyszer számoljuk
  // át a böngésző órájára, így minden böngészőben egyszerre fut a kocka és a bábu animációja.
  const last = game.last_action;
  const action = useMemo(() => last && { ...last, start: actionStart(last, game) }, [last?.seq]);
  const end = action ? actionEnd(action, action.start) : 0;

  // amíg tart a mozgás, a gomb, a panel és a kamera az időt követi
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!action) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= end) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [action, end]);

  // idle -> rolling (kocka gurul) -> moving (a bábu lép vagy felvonóval megy) -> idle
  let phase = 'idle';
  if (action && now < end) phase = action.dice && now < action.start + DICE_TIME ? 'rolling' : 'moving';

  // a mozgás végén frissül a panelen a pénz, a napló és a csapdák
  const [settled, setSettled] = useState(game);
  useEffect(() => {
    if (phase === 'idle') setSettled(game);
  }, [phase, game]);

  const busy = phase !== 'idle' || requesting;
  const myTurn = game.turn_player_id === playerId;
  // a mozgó bábu az animáció szerinti mezőn látszik, a többiek a szerver szerinti helyükön
  const fieldOf = (p) => shownField(p, action, now);
  // mindenkinél a saját bábuja felé fordul a kamera; mások lépésére nem változik a nézet
  const me = game.players.find((p) => p.id === playerId);
  const focusField = me ? fieldOf(me) : 0;
  const side = Math.floor(focusField / 10);
  // a középen látható építkezés is csak a mozgás végén frissül
  const settledMe = me && (settled.players.find((p) => p.id === me.id) ?? me);
  const diceRoll = useMemo(
    () => action?.dice && { value: action.dice, seq: action.seq, start: action.start },
    [action],
  );

  const send = async (request) => {
    setRequesting(true);
    setError('');
    try {
      await request();
    } catch (e) {
      setError(e.message);
    } finally {
      setRequesting(false);
    }
  };
  const rollDice = () => {
    if (!busy && myTurn && !game.pending) send(onRoll);
  };
  const choose = (choice) => {
    if (!busy) send(() => onChoose(choice));
  };

  return (
    <>
      <Canvas shadows="percentage" dpr={[1, 2]} camera={{ fov: 55, near: 0.5, far: 400 }}>
        {/* meseszerű pára: a távoli hegyek a horizont rózsaszínjébe halványulnak */}
        <fog attach="fog" args={[HORIZON_COLOR, 90, 300]} />
        <Sky />
        <FixedCamera side={side} />
        <hemisphereLight args={['#e8f0f8', '#f4eee8', 1.25]} />
        <directionalLight
          position={[-28, 24, 6]}
          color="#fff0db"
          intensity={2.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
          shadow-camera-left={-35}
          shadow-camera-right={35}
          shadow-camera-top={35}
          shadow-camera-bottom={-35}
          shadow-camera-near={1}
          shadow-camera-far={90}
        />
        <Suspense fallback={null}>
          <Scenery />
        </Suspense>
        {fontsReady && <Board fields={fields} onHover={setHovered} />}
        <group rotation-y={(-side * Math.PI) / 2}>
          <Dice roll={diceRoll} disabled={busy || !myTurn || !!game.pending} onClick={rollDice} />
        </group>
        {settledMe && (
          <Suspense fallback={null}>
            <BuildSite buildings={game.buildings} owned={settledMe.buildings} side={side} />
          </Suspense>
        )}
        <Suspense fallback={null}>
          {game.players.map((p, i) => (
            <Pawn
              key={p.id}
              field={p.position}
              action={action?.player_id === p.id ? action : null}
              slot={i}
              color={p.color}
              lifted={phase === 'idle' && hovered?.id === p.position}
            />
          ))}
        </Suspense>
      </Canvas>
      <GamePanel
        game={game}
        settled={settled}
        playerId={playerId}
        fieldOf={fieldOf}
        phase={phase}
        busy={busy}
        action={action}
        error={error}
        onRoll={rollDice}
        onChoose={choose}
        onLeave={onLeave}
      />
      {game.status === 'finished' && phase === 'idle' && (
        <Victory game={game} playerId={playerId} onLeave={onLeave} />
      )}
    </>
  );
}

// a játék vége: a győztes, a figurája és a felépült síparadicsom; további lépés már nincs
function Victory({ game, playerId, onLeave }) {
  const index = game.players.findIndex((p) => p.id === game.winner_id);
  const winner = game.players[index];
  if (!winner) return null;
  return (
    <div className="victory">
      <div className="victory-card">
        <div className="trophy">🏆</div>
        <h2>{winner.id === playerId ? 'Nyertél!' : `${winner.name} nyert!`}</h2>
        <p>
          <span className="dot" style={{ background: winner.color }} /> {winner.name} · {FIGURE_NAMES[index % FIGURE_NAMES.length]}
        </p>
        <p>
          Felépítette a teljes síparadicsomot ({game.buildings.length}/{game.buildings.length}), és {hk(winner.money)}{' '}
          maradt a számláján.
        </p>
        <ul>
          {game.buildings.map((b) => (
            <li key={b.id}>✔ {b.name}</li>
          ))}
        </ul>
        <button onClick={onLeave}>Új játék</button>
      </div>
    </div>
  );
}
