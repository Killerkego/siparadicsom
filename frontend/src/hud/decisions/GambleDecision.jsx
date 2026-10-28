import { hk } from '../../game/format';

// gambling: kockáztat-e a játékos (1–3: vissza, 4–6: nyeremény)
export default function GambleDecision({ rules, busy, onChoose }) {
  return (
    <div className="decision">
      <b>Gambling</b>
      <p>
        Kockáztatsz? 1–3: {rules.gamble_back} mezőt vissza, 4–6: +{hk(rules.gamble_prize)}.
      </p>
      <div className="choices">
        <button disabled={busy} onClick={() => onChoose('yes')}>
          Igen, dobok
        </button>
        <button className="secondary" disabled={busy} onClick={() => onChoose('no')}>
          Nem
        </button>
      </div>
    </div>
  );
}
