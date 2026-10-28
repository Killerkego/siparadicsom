import { hk } from '../game/format';

// a táblán lévő csapdák; hogy milyen, azt csak a lerakója látja
export default function TrapList({ traps, players, rules, playerId }) {
  const entries = Object.entries(traps);
  if (!entries.length) return <p className="empty">Nincs csapda a táblán.</p>;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? '?';
  return (
    <ul className="traps">
      {entries.map(([field, trap]) => (
        <li key={field}>
          <b>#{field}</b> {nameOf(trap.owner)} csapdája
          {trap.owner === playerId && (
            <span> · {trap.kind === 'back' ? `${rules.trap_back} mező vissza` : hk(rules.trap_money)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
