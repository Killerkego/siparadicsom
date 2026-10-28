import BuildList from './BuildList';
import Decision, { DECISION_NAMES } from './decisions/Decision';
import GameLog from './GameLog';
import TrapList from './TrapList';

// a dobás gomb felirata az aktuális helyzet szerint
function rollLabel({ myTurn, phase, drawing, pending, turnPlayer }) {
  if (phase === 'rolling') return 'Gurul…';
  if (phase === 'moving') return drawing ? 'Kártyát húz…' : 'Lép…';
  if (pending) return `${turnPlayer?.name} dönt…`;
  return myTurn ? 'Dobás' : 'Várj a sorodra';
}

// A jobb felső panel: dobás vagy a saját döntés, ki következik, a saját építkezés, csapdák, napló.
// A pénz, a napló és az épületek a mozgás végéig az előző (settled) állapot szerint látszanak.
export default function GamePanel({ game, settled, playerId, timeline, busy, error, onRoll, onChoose, onLeave }) {
  const { action, phase, drawing } = timeline;
  const myTurn = game.turn_player_id === playerId;
  const turnPlayer = game.players.find((p) => p.id === game.turn_player_id);
  const me = game.players.find((p) => p.id === playerId);
  const settledMe = settled.players.find((p) => p.id === playerId) ?? me;
  const pending = phase === 'idle' ? game.pending : null;
  const roller = action && game.players.find((p) => p.id === action.player_id);

  return (
    <div className="game-panel">
      {pending && pending.player_id === playerId ? (
        <Decision
          pending={pending}
          rules={game.rules}
          buildings={game.buildings}
          me={me}
          busy={busy}
          onChoose={onChoose}
        />
      ) : (
        <button onClick={onRoll} disabled={!myTurn || busy || !!game.pending}>
          {rollLabel({ myTurn, phase, drawing, pending: game.pending, turnPlayer })}
        </button>
      )}
      {myTurn && me?.in_school && !game.pending && phase === 'idle' && (
        <div className="hint">Oktatáson vagy: páros dobással mehetsz tovább.</div>
      )}
      <div>
        Következik: <b>{myTurn ? 'te' : turnPlayer?.name}</b>
        {pending && pending.player_id !== playerId && ` (${DECISION_NAMES[pending.type]})`}
      </div>
      <div>
        Dobott szám: <b>{action?.dice && phase !== 'rolling' ? `${action.dice} (${roller?.name ?? '?'})` : '–'}</b>
      </div>
      {settledMe && <BuildList buildings={game.buildings} owned={settledMe.buildings} />}
      <TrapList traps={settled.traps} players={game.players} rules={game.rules} playerId={playerId} />
      <GameLog log={settled.log} />
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
