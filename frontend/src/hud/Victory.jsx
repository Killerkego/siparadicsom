import { FIGURES } from '../game/figures';
import { hk } from '../game/format';
import { usePortraits } from '../game/portraits';

// a játék vége: a győztes, a figurája és a felépült síparadicsom; további lépés már nincs
export default function Victory({ game, playerId, onLeave }) {
  const portraits = usePortraits();
  const winner = game.players.find((p) => p.id === game.winner_id);
  if (!winner) return null;
  const figure = FIGURES[winner.figure];
  return (
    <div className="victory">
      <div className="victory-card">
        {portraits[winner.figure] ? (
          <img className="winner-portrait" src={portraits[winner.figure]} alt={figure.name} />
        ) : (
          <div className="trophy">🏆</div>
        )}
        <h2>{winner.id === playerId ? 'Nyertél!' : `${winner.name} nyert!`}</h2>
        <p>
          <span className="dot" style={{ background: winner.color }} /> {winner.name} · {figure.icon} {figure.name}
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
