import { useEffect, useState } from 'react';
import { listGames } from './api';
import { VisibilityIcon } from './VisibilityToggle';

const REFRESH = 3000; // ms, ilyen gyakran frissül a lista

// A nyitott (nyilvános), még várakozó társaságok listája; a zártkörűek nem szerepelnek benne (azokhoz kód kell).
export default function PublicLobbies({ busy, onJoin }) {
  const [lobbies, setLobbies] = useState(null); // null: még tölt
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      listGames()
        .then((data) => {
          if (!alive) return;
          setLobbies(data.lobbies);
          setOffline(false);
        })
        .catch(() => alive && setOffline(true));
    load();
    const timer = setInterval(load, REFRESH);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="public-lobbies">
      <h2 className="public-lobbies-title">
        Nyitott társaságok {lobbies?.length > 0 && <span className="count">{lobbies.length}</span>}
      </h2>
      {offline && <p className="public-lobbies-empty">A lista most nem érhető el.</p>}
      {!offline && lobbies?.length === 0 && (
        <p className="public-lobbies-empty">Most nincs nyitott társaság. Indíts egyet!</p>
      )}
      {lobbies?.length > 0 && (
        <ul>
          {lobbies.map((lobby) => {
            const full = lobby.players >= lobby.max_players;
            return (
              <li key={lobby.code}>
                <span className="public-lobby-name">
                  <VisibilityIcon isPublic /> {lobby.host} társasága
                </span>
                <span className="public-lobby-count">
                  {lobby.players} / {lobby.max_players} fő
                </span>
                <button
                  className="btn secondary"
                  disabled={busy || full}
                  onClick={() => onJoin(lobby.code)}
                >
                  {full ? 'Megtelt' : 'Csatlakozom'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
