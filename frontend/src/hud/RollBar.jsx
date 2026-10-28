// Dobás a képernyő alján középen. A saját körben arany gomb, máskor csak kiírja, ki jön (mozgás közben: ki lép).
// Döntés közben nem látszik: a kártya a képernyő közepén, a többi döntés a jobb oldali panelen van.
export default function RollBar({ game, playerId, phase, drawing, canRoll, onRoll }) {
  if ((phase === 'idle' && game.pending) || game.status !== 'playing') return null;
  // a szerver a dobás után azonnal továbbadja a kört, ezért a mozgás alatt a dobót mutatjuk, nem a következőt
  const actorId = phase === 'idle' ? game.turn_player_id : (game.last_action?.player_id ?? game.turn_player_id);
  const myTurn = actorId === playerId;
  const turnPlayer = game.players.find((p) => p.id === actorId);

  let label = 'Dobás';
  if (phase === 'rolling') label = 'Gurul…';
  else if (phase === 'moving') label = drawing ? 'Kártyát húz…' : 'Lép…';

  return (
    <div className="roll-bar">
      {myTurn ? (
        <button className="roll-button" onClick={onRoll} disabled={!canRoll}>
          <span className="roll-die" aria-hidden="true">
            ⚄
          </span>
          {label}
        </button>
      ) : (
        <p className="roll-wait" style={{ '--player': turnPlayer?.color }}>
          <span className="turn-dot" />
          {phase === 'idle' ? `${turnPlayer?.name} következik` : `${turnPlayer?.name}: ${label.toLowerCase()}`}
        </p>
      )}
    </div>
  );
}
