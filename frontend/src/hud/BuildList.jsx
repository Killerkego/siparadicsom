import { buildState, hk } from '../game/format';

const MARKS = { owned: '✔', available: '●', locked: '🔒' };

// a saját építkezés: mi van meg, mi vehető, minek hiányzik az előfeltétele
export default function BuildList({ buildings, owned }) {
  const nameOf = (id) => buildings.find((b) => b.id === id)?.name;
  return (
    <div className="build-list">
      <div>
        Építkezésem: <b>{owned.length} / {buildings.length}</b>
      </div>
      <div className="progress">
        <span style={{ width: `${(owned.length / buildings.length) * 100}%` }} />
      </div>
      <ul>
        {buildings.map((b) => {
          const state = buildState(b, owned);
          const missing = b.requires.filter((r) => !owned.includes(r)).map(nameOf);
          return (
            <li key={b.id} className={state} title={missing.length ? `Előfeltétel: ${missing.join(', ')}` : ''}>
              <span className="mark">{MARKS[state]}</span>
              {b.name}
              <span className="price">{state === 'owned' ? 'kész' : hk(b.price)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
