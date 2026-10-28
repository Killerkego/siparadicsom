import { CARD_KINDS } from '../../game/format';

// Jósnő: a két lap a képernyő közepén lebeg, rájuk kattintva lehet választani; a lap alatti sávban
// a gombjuk is megvan. A választott lap hatása érvényesül, a másik a pakli aljára kerül.
export default function CardPickDecision({ pending, cards, busy, onChoose }) {
  return (
    <div className="decision card-pick-decision">
      <span className="card-kind">Jósnő · kattints az egyik lapra</span>
      <div className="choices card-pick">
        {pending.options.map((id) => {
          const card = cards.find((c) => c.id === id);
          return (
            <button key={id} className={`card-option ${card.kind}`} disabled={busy} onClick={() => onChoose(id)} title={card.text}>
              {card.name}
              <small>{CARD_KINDS[card.kind]}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
