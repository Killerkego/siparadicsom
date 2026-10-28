import { CARD_KINDS } from '../../game/format';

// a húzott kártya: neve, fajtája és hatása; elfogadáskor hajtja végre a szerver
export default function CardDecision({ pending, cards, busy, onChoose }) {
  const card = cards.find((c) => c.id === pending.card);
  return (
    <div className={`decision card-decision ${card.kind}`}>
      <span className="card-kind">{CARD_KINDS[card.kind]}</span>
      <b>{card.name}</b>
      <p>{card.text}</p>
      {pending.blocked_by && (
        <p className="card-blocked">Ez a lap most nem számít ({pending.blocked_by}).</p>
      )}
      <div className="choices">
        <button disabled={busy} onClick={() => onChoose('ok')}>
          Rendben
        </button>
      </div>
    </div>
  );
}
