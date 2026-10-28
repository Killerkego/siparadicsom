import { buildState, hk } from '../game/format';

// kis arany ikonok: kész (pipa), megvehető (gyűrű), előfeltétel hiányzik (lakat)
const ICONS = {
  owned: <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />,
  available: <circle cx="8" cy="8" r="4.5" />,
  locked: (
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
    </>
  ),
};

// a saját építkezés: mi van meg, mi vehető, minek hiányzik az előfeltétele (az alatta olvasható)
export default function BuildList({ buildings, owned }) {
  const nameOf = (id) => buildings.find((b) => b.id === id)?.name;
  return (
    <div className="build-list">
      <div className="build-progress">
        <div className="progress">
          <span style={{ width: `${(owned.length / buildings.length) * 100}%` }} />
        </div>
        <small>
          {owned.length} / {buildings.length} elem kész
        </small>
      </div>
      <ul>
        {buildings.map((b) => {
          const state = buildState(b, owned);
          const missing = b.requires.filter((r) => !owned.includes(r)).map(nameOf);
          return (
            <li key={b.id} className={state}>
              <svg className="mark" viewBox="0 0 16 16" aria-hidden="true">
                {ICONS[state]}
              </svg>
              <span className="build-info">
                {b.name}
                {missing.length > 0 && <small>Előfeltétel: {missing.join(', ')}</small>}
              </span>
              <span className="price">{state === 'owned' ? 'kész' : hk(b.price)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
