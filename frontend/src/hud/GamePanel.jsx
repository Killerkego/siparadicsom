import { useState } from 'react';
import BuildList from './BuildList';
import { DECISION_NAMES } from './decisions/Decision';

const COLLAPSED_KEY = 'siparadicsom.panelCollapsed';
// a kocka pöttyei egy 3×3-as rácsban (balról jobbra, fentről le)
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

// a panel összecsukásának megjegyzése csak kényelmi funkció, hiba esetén az alapérték marad
function load(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // nem baj, ha nem marad meg
  }
}

// a legutóbbi dobás kis kockán
function DieTile({ value }) {
  return (
    <span className={value ? 'die-tile' : 'die-tile empty'}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={value && PIPS[value].includes(i) ? 'pip' : ''} />
      ))}
    </span>
  );
}

// A jobb oldali panel: fejléc (ki következik, utolsó dobás), a legutóbbi esemény és a saját építkezés.
// A fejlécre kattintva összecsukható. A saját döntés a képernyő közepén, a dobás lent, a kilépés fent van.
// A pénz, a napló és az épületek a mozgás végéig az előző (settled) állapot szerint látszanak.
export default function GamePanel({ game, settled, playerId, timeline, error }) {
  const [collapsed, setCollapsed] = useState(() => load(COLLAPSED_KEY, '0') === '1');
  const { action, phase } = timeline;
  const myTurn = game.turn_player_id === playerId;
  const turnPlayer = game.players.find((p) => p.id === game.turn_player_id);
  const me = game.players.find((p) => p.id === playerId);
  const settledMe = settled.players.find((p) => p.id === playerId) ?? me;
  const pending = phase === 'idle' ? game.pending : null;
  const roller = action && game.players.find((p) => p.id === action.player_id);
  const dice = action?.dice && phase !== 'rolling' ? action.dice : null;

  const toggle = () => {
    setCollapsed((c) => {
      save(COLLAPSED_KEY, c ? '0' : '1');
      return !c;
    });
  };

  let status = null;
  if (pending) status = pending.player_id === playerId ? 'Döntés vár rád' : `${DECISION_NAMES[pending.type]} – dönt…`;
  else if (myTurn && phase === 'idle') status = 'Dobj a kockával';

  return (
    <aside className={collapsed ? 'game-panel collapsed' : 'game-panel'}>
      <header
        className="panel-turn"
        style={{ '--player': turnPlayer?.color }}
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        title={collapsed ? 'Panel kinyitása' : 'Panel összecsukása'}
        onClick={toggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle())}
      >
        <span className="turn-dot" />
        <div className="turn-text">
          <small>
            <span aria-hidden="true">✦</span> Soron <span aria-hidden="true">✦</span>
          </small>
          <b>{myTurn ? 'Te következel' : turnPlayer?.name}</b>
          {status && <em>{status}</em>}
        </div>
        <div className="last-roll" title={dice ? `Legutóbbi dobás: ${dice} (${roller?.name})` : 'Még nem volt dobás'}>
          <DieTile value={dice} />
          <small>{dice ? roller?.name : 'dobás'}</small>
        </div>
        <span className="panel-chevron" aria-hidden="true" />
      </header>

      <section className="panel-action">
        {myTurn && me?.in_school && !game.pending && phase === 'idle' && (
          <div className="hint">Oktatáson vagy: páros dobással mehetsz tovább.</div>
        )}
        {error && <div className="error">{error}</div>}
        {settled.log.length > 0 && (
          <div className="last-event">
            <small>Legutóbb</small>
            {settled.log.at(-1)}
          </div>
        )}
      </section>

      {!collapsed && settledMe && (
        <>
          <h3 className="panel-section">
            <span aria-hidden="true">✦</span> Építkezésem <span aria-hidden="true">✦</span>
          </h3>
          <div className="panel-body">
            <BuildList buildings={game.buildings} owned={settledMe.buildings} />
          </div>
        </>
      )}
    </aside>
  );
}
