import { hk } from '../game/format';

// a táblán lévő csapdák; hogy milyen, azt csak a lerakója látja
export default function TrapList({ traps, players, rules, playerId }) {
  const entries = Object.entries(traps);
  if (!entries.length) return null;
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? '?';
  return (
    <div className="traps">
      {entries.map(([field, trap]) => (
        <div key={field}>
          Csapda a #{field} mezőn: {nameOf(trap.owner)}
          {trap.owner === playerId && ` (${trap.kind === 'back' ? `${rules.trap_back} mező vissza` : hk(rules.trap_money)})`}
        </div>
      ))}
    </div>
  );
}
