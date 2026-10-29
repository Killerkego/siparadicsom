import { FIGURES } from '../game/figures';
import { EFFECT_LABELS, hk } from '../game/format';
import { usePortraits } from '../game/portraits';

// a kártyák függő hatásai kis jelvényekként; rámutatva látszik a magyarázat
function Effects({ effects }) {
  const active = Object.entries(effects ?? {}).filter(([key, n]) => n && EFFECT_LABELS[key]);
  if (!active.length) return null;
  return (
    <div className="effects">
      {active.map(([key, n]) => {
        const [icon, describe] = EFFECT_LABELS[key];
        return (
          <span key={key} className="effect" title={describe(n)}>
            {icon}
          </span>
        );
      })}
    </div>
  );
}

// Játékoskártyák a bal felső sarokban: bábu portréja, egyenleg, hitel és az építkezés állása.
// A kártya a tábla keretét idézi: fenyőfa csík, aranyvonal, alul festett rombuszlánc.
// Egy kártyára kattintva annak a játékosnak az építkezése látszik a tábla közepén (`viewedId`).
// `players`: a mozgás végén frissülő (settled) állapot, hogy a pénz ne változzon előre.
export default function PlayerCards({ players, buildings, turnPlayerId, playerId, viewedId, onView, fieldLabel, ready }) {
  const portraits = usePortraits(ready);
  return (
    <div className="player-cards">
      {players.map((p) => {
        const figure = FIGURES[p.figure];
        const built = p.buildings.length;
        const turn = p.id === turnPlayerId;
        const classes = ['player-card', turn && 'turn', p.id === viewedId && 'viewed'].filter(Boolean).join(' ');
        return (
          <div
            key={p.id}
            className={classes}
            style={{ '--player': p.color }}
            role="button"
            tabIndex={0}
            aria-pressed={p.id === viewedId}
            title={p.id === playerId ? 'A saját építkezésed középen' : `${p.name} építkezése középen`}
            onClick={() => onView(p.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onView(p.id))}
          >
            <div className="player-card-head">
              <div className="portrait" title={figure.name}>
                {portraits[p.figure] ? <img src={portraits[p.figure]} alt={figure.name} /> : <span>{figure.icon}</span>}
              </div>
              <div className="who">
                <b>
                  {p.name}
                  {p.id === playerId && <span className="me"> (te)</span>}
                </b>
                <span className="where">
                  {p.bot && 'Gépi · '}
                  {figure.name} · {fieldLabel(p)}
                </span>
              </div>
              {turn && <span className="badge">Soron</span>}
            </div>
            <dl className="stats">
              <dt>Egyenleg</dt>
              <dd className={p.money < 0 ? 'debt' : ''}>{hk(p.money)}</dd>
              <dt>Hitel</dt>
              <dd className={p.loan > 0 ? 'debt' : 'none'}>{p.loan > 0 ? hk(p.loan) : 'nincs'}</dd>
            </dl>
            <div className="build-row" title={`Építkezés: ${buildings.filter((b) => p.buildings.includes(b.id)).map((b) => b.name).join(', ') || 'még semmi'}`}>
              <div className="build-pips">
                {buildings.map((b) => (
                  <span key={b.id} className={p.buildings.includes(b.id) ? 'pip done' : 'pip'} />
                ))}
              </div>
              <b>
                {built}/{buildings.length}
              </b>
            </div>
            <Effects effects={p.effects} />
          </div>
        );
      })}
    </div>
  );
}
