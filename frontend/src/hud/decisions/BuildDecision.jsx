import { buildPrice, hk } from '../../game/format';

// a kör végi építkezés: legfeljebb egy elem, vásárlási mezőn kedvezménnyel
export default function BuildDecision({ pending, buildings, busy, onChoose }) {
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
