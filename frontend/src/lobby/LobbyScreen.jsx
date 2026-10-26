import { useState } from 'react';

// Lobbi: itt várnak a játékosok, amíg a házigazda el nem indítja a játékot
export default function LobbyScreen({ game, playerId, onStart, onLeave }) {
  const [error, setError] = useState('');
  const isHost = game.host_id === playerId;
  const enough = game.players.length >= game.min_players;

  const start = async () => {
    setError('');
    try {
      await onStart();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <main className="page">
      <div className="card">
        <h1>Lobbi</h1>

        <div className="code-box">
          <span>Játékkód</span>
          <strong>{game.code}</strong>
        </div>
        <p className="hint">Ezt a kódot add meg a többi játékosnak, hogy csatlakozni tudjanak.</p>

        <h2>
          Játékosok <span className="muted">({game.players.length}/{game.max_players})</span>
        </h2>
        <ul className="players">
          {game.players.map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              {p.id === game.host_id && <span className="badge">házigazda</span>}
              {p.id === playerId && <span className="badge me">te</span>}
            </li>
          ))}
        </ul>

        {isHost ? (
          <>
            <button className="btn" disabled={!enough} onClick={start}>
              Játék indítása
            </button>
            {!enough && <p className="hint">Legalább {game.min_players} játékos kell az indításhoz.</p>}
          </>
        ) : (
          <p className="hint">Várakozás, hogy a házigazda elindítsa a játékot…</p>
        )}

        <button className="btn secondary" onClick={onLeave}>
          Kilépés
        </button>

        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
