import { hk } from '../../game/format';

// felvonó: pénzért átvisz egy másik felvonó mezőjére
export default function LiftDecision({ pending, rules, me, busy, onChoose }) {
  const poor = me.money < rules.lift_cost;
  return (
    <div className="decision">
      <b>Felvonó</b>
      <p>
        {hk(rules.lift_cost)}-ért átvisz egy másik felvonóhoz.{poor && ' Nincs elég pénzed.'}
      </p>
      <div className="choices">
        {pending.targets.map((t) => (
          <button key={t} disabled={busy || poor} onClick={() => onChoose(String(t))}>
            #{t}
          </button>
        ))}
        <button className="secondary" disabled={busy} onClick={() => onChoose('no')}>
          Maradok
        </button>
      </div>
    </div>
  );
}
