import Decision from './decisions/Decision';

// A saját döntés a képernyő közepén: a húzott kártyánál a lap alatti sávban, a Jósnő két lapjánál a
// lapok alatti gombokkal (game/CardDeck), minden másnál (építkezés, felvonó, gambling, csapda) középre
// nyíló ablakban, a kezdőlap stílusában.
export default function DecisionLayer({ pending, game, me, busy, error, onChoose }) {
  if (pending.type === 'card_pick') {
    return error ? (
      <div className="card-bar">
        <p className="decision-error">{error}</p>
      </div>
    ) : null;
  }
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

  if (pending.type === 'card') {
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
