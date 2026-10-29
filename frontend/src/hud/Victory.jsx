import { useEffect } from 'react';
import { FIGURES } from '../game/figures';
import { hk } from '../game/format';
import { usePortraits } from '../game/portraits';
import { play } from '../game/sound';
import Confetti from './Confetti';

// A játék vége: a győztes érmében, mögötte forgó fénysugarak és konfetti; a három teljesült győzelmi
// feltétel, a felépült Aranyhegy Szálló elemei és a többiek helyezése. További lépés már nincs.
export default function Victory({ game, playerId, onLeave }) {
  const portraits = usePortraits();
  useEffect(() => play('victory'), []); // a győzelmi dallam egyszer, amikor az ablak megnyílik
  const winner = game.players.find((p) => p.id === game.winner_id);
  if (!winner) return null;
  const figure = FIGURES[winner.figure];
  const isMe = winner.id === playerId;
  // a többiek: több elem előrébb, egyenlőnél a több pénz
  const others = game.players
    .filter((p) => p.id !== winner.id)
    .sort((a, b) => b.buildings.length - a.buildings.length || b.money - a.money);

  return (
    <div className="victory" style={{ '--player': winner.color }}>
      <Confetti color={winner.color} />
      <div className="victory-card" role="dialog" aria-modal="true" aria-labelledby="victory-title">
        <p className="victory-eyebrow">
          <span aria-hidden="true">✦</span> Vége a szezonnak <span aria-hidden="true">✦</span>
        </p>

        <div className="victory-medal">
          <span className="victory-rays" aria-hidden="true" />
          <div className="victory-portrait">
            {portraits[winner.figure] ? <img src={portraits[winner.figure]} alt={figure.name} /> : <span>{figure.icon}</span>}
          </div>
          <span className="victory-crown" aria-hidden="true">
            ✦
          </span>
        </div>

        <h2 id="victory-title">{isMe ? 'Nyertél!' : `${winner.name} nyert!`}</h2>
        <p className="victory-sub">
          {game.end_reason === 'left'
            ? `Mindenki más kilépett, így ${isMe ? 'te maradtál' : 'ő maradt'} a hegyen · ${figure.name}`
            : `${isMe ? 'Felépítetted' : 'Felépítette'} a teljes Aranyhegy Szállót · ${figure.name}`}
        </p>

        {/* a teljesült győzelmi feltételek és a kész szálló; ha a többiek kiléptek, ezek nem teljesültek */}
        {game.end_reason !== 'left' && (
          <>
            <ul className="victory-goals">
              <li>
                <b>
                  {winner.buildings.length}/{game.buildings.length}
                </b>
                <small>elem kész</small>
              </li>
              <li>
                <b>{hk(winner.money)}</b>
                <small>legalább {hk(game.rules.win_money)}</small>
              </li>
              <li>
                <b>Nincs</b>
                <small>tartozás</small>
              </li>
            </ul>

            <ul className="victory-buildings">
              {game.buildings.map((b, i) => (
                <li key={b.id} style={{ animationDelay: `${900 + i * 90}ms` }}>
                  {b.name}
                </li>
              ))}
            </ul>
          </>
        )}

        {others.length > 0 && (
          <ol className="victory-ranking" start={2}>
            {others.map((p) => (
              <li key={p.id} style={{ '--player': p.color }}>
                <span className="dot" />
                <span className="name">
                  {p.name}
                  {p.id === playerId && <em> (te)</em>}
                </span>
                <span className="built">
                  {p.buildings.length}/{game.buildings.length} elem
                </span>
                <span className="money">{hk(p.money)}</span>
              </li>
            ))}
          </ol>
        )}

        <button className="victory-button" onClick={onLeave}>
          Új játék
        </button>
      </div>
    </div>
  );
}
