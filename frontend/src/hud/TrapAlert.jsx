import { useEffect, useRef, useState } from 'react';
import { hk } from '../game/format';

const SHOW_TIME = 5000; // ms, ennyi után magától eltűnik

// Értesítés a képernyő közepén, ha valaki belelépett a saját csapdánkba. A mozgás végén jelenik meg
// (a `settled` állapotból), és csak az új eseményre: oldalfrissítés után a régi nem ugrik fel újra.
export default function TrapAlert({ event, players, rules, playerId }) {
  const seen = useRef(event?.seq ?? 0);
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!event || event.seq <= seen.current) return;
    seen.current = event.seq;
    if (event.owner_id === playerId) setShown(event);
  }, [event, playerId]);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), SHOW_TIME);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  const victim = players.find((p) => p.id === shown.victim_id);
  const name = victim?.name ?? 'Valaki';
  const effect =
    shown.kind === 'back' ? `${rules.trap_back} mezőt vissza kellett lépnie.` : `${hk(rules.trap_money)}-t fizetett neked.`;

  return (
    <div className="trap-alert-overlay" onClick={() => setShown(null)}>
      <div className="trap-alert" role="alert">
        <p className="decision-eyebrow">
          <span aria-hidden="true">✦</span> Elsült a csapdád <span aria-hidden="true">✦</span>
        </p>
        <div className="trap-alert-icon" aria-hidden="true">
          🪤
        </div>
        <h2>
          {victim && <span className="dot" style={{ background: victim.color }} />} {name} belelépett a csapdádba!
        </h2>
        <p>
          A #{shown.field} mezőn {effect}
        </p>
        <button onClick={() => setShown(null)}>Szuper!</button>
      </div>
    </div>
  );
}
