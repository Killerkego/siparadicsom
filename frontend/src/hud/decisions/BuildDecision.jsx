import { hk } from '../../game/format';

// a kör végi építkezés: legfeljebb egy elem; az árat a szerver számolja (vásárlási mező, kártyák).
// A most nem megvehető elemek letiltva látszanak, a szerver által adott okkal (pénz, előfeltétel).
export default function BuildDecision({ pending, buildings, busy, onChoose }) {
  const blocked = pending.blocked ?? {};
  const shown = buildings.filter((b) => pending.options.includes(b.id) || blocked[b.id]);
  return (
    <div className="decision">
      <b>Építkezés a kör végén</b>
      <p>
        Legfeljebb egy elemet építhetsz meg.
        {pending.discount > 0 && <strong> Vásárlási mezőn állsz: {pending.discount}% kedvezmény!</strong>}
      </p>
      <div className="build-options">
        {shown.map((b) => {
          const reason = blocked[b.id];
          const price = pending.prices[b.id];
          return (
            <button key={b.id} className="build-tile" disabled={busy || !!reason} onClick={() => onChoose(b.id)}>
              <span className="build-name">{b.name}</span>
              <span className="price">
                {price !== b.price && <s>{hk(b.price)}</s>} {hk(price)}
              </span>
              {reason && <small>{reason}</small>}
            </button>
          );
        })}
      </div>
      <div className="choices">
        <button className="secondary" disabled={busy} onClick={() => onChoose('no')}>
          Most nem építek
        </button>
      </div>
    </div>
  );
}
