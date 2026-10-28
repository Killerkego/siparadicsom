import { useEffect, useRef, useState } from 'react';
import { TILE_ART } from '../board/tileArt';
import { hk } from '../game/format';

const SHOW_TIME = 7000; // ms, ennyi után magától eltűnik

// Bevételi vagy kiadási mezőre lépéskor egy rövid történet felül középen: miért jött vagy ment a pénz.
// Mindenki látja (a szerver sorsolja, így mindenkinél ugyanaz), a mozgás végén jelenik meg, és csak az
// új eseményre: oldalfrissítés után a régi nem ugrik fel újra.
export default function FieldStory({ event, players, playerId }) {
  const seen = useRef(event?.seq ?? 0);
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!event || event.seq <= seen.current) return;
    seen.current = event.seq;
    setShown(event);
  }, [event]);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), SHOW_TIME);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  const player = players.find((p) => p.id === shown.player_id);
  const art = TILE_ART[shown.field];
  const gain = shown.amount > 0;
  const who = shown.player_id === playerId ? 'Te' : (player?.name ?? 'Valaki');

  return (
    <div
      key={shown.seq}
      className={gain ? 'field-story gain' : 'field-story loss'}
      role="status"
      onClick={() => setShown(null)}
    >
      <div className="field-story-icon" aria-hidden="true">
        {art?.icon && <img src={`/fields/${String(art.icon).padStart(2, '0')}.png`} alt="" />}
      </div>
      <div className="field-story-body">
        <p className="field-story-head">
          {player && <span className="dot" style={{ background: player.color }} />} {who} ·{' '}
          <b>{art?.name ?? `#${shown.field}`}</b>
        </p>
        <p className="field-story-text">{shown.story}</p>
        {shown.note && <p className="field-story-note">{shown.note}</p>}
      </div>
      <div className="field-story-amount">
        {gain ? '+' : '−'}
        {hk(Math.abs(shown.amount))}
      </div>
    </div>
  );
}
