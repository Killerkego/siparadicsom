import { CARD_KINDS } from '../../game/format';

// Jósnő: két lap közül az egyiket hajtja végre, a másik a pakli aljára kerül
export default function CardPickDecision({ pending, cards, busy, onChoose }) {
  return (
    <div className="decision">
      <b>Jósnő: válassz egy lapot</b>
      <p>A választott lap hatása érvényesül, a másik a pakli aljára kerül.</p>
      <div className="card-pick">
        {pending.options.map((id) => {
          const card = cards.find((c) => c.id === id);
          return (
            <button key={id} className="card-option" disabled={busy} onClick={() => onChoose(id)} title={card.text}>
              <img src={`/cards/${id}.jpg`} alt={card.name} />
              <span>
                {card.name} · {CARD_KINDS[card.kind]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
