import Decision from './decisions/Decision';

// a kártyás döntéseknél a lap(ok) már a képernyő közepén lebegnek, ezért ott csak egy sáv kell alattuk
const ON_CARD = new Set(['card', 'card_pick']);

// A saját döntés a képernyő közepén: a kártyáknál a lap alatti sávban, minden másnál (építkezés,
// felvonó, gambling, csapda) középre nyíló ablakban, a kezdőlap stílusában.
export default function DecisionLayer({ pending, game, me, busy, error, onChoose }) {
  const decision = (
    <Decision
      pending={pending}
      rules={game.rules}
      buildings={game.buildings}
      cards={game.cards}
      me={me}
      busy={busy}
      onChoose={onChoose}
    />
  );
  const problem = error && <p className="decision-error">{error}</p>;

  if (ON_CARD.has(pending.type)) {
    return (
      <div className="card-bar">
        {decision}
        {problem}
      </div>
    );
  }
  return (
    <div className="decision-overlay">
      <div className="decision-dialog" role="dialog" aria-modal="true">
        <p className="decision-eyebrow">
          <span aria-hidden="true">✦</span> A te döntésed <span aria-hidden="true">✦</span>
        </p>
        {decision}
        {problem}
      </div>
    </div>
  );
}
