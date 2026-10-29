import { useState } from 'react';
import { fieldName, fields } from '../game/format';

// Fejlesztői fül (csak ha a backendben DEV_MODE = True): dobás helyett bármelyik mezőre lépés,
// az összes építési elem ingyen, és szezonesemény azonnal (a hatások bemutatásához)
const SEASON_OPTIONS = [
  ['peak', 'Csúcsszezon'],
  ['blizzard', 'Hóvihar'],
  ['audit', 'Ellenőrzés'],
  ['none', 'Nincs esemény'],
];

export default function DevPanel({ game, me, canMove, busy, onMove, onBuildAll, onSeason }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState(1);
  const [season, setSeason] = useState('blizzard');
  const allBuilt = me && me.buildings.length === game.buildings.length;
  // amíg egy esemény tart, újat nem lehet indítani, csak a futót leállítani
  const seasonBlocked = Boolean(game.season) && season !== 'none';

  return (
    <div className="dev-panel">
      <button className="dev-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} Fejlesztői
      </button>
      {open && (
        <>
          <select value={field} onChange={(e) => setField(Number(e.target.value))}>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {fieldName(f)}
              </option>
            ))}
          </select>
          <button className="dev-action" disabled={!canMove} onClick={() => onMove(field)}>
            Odalépek (dobás helyett)
          </button>
          {!canMove && <div className="hint">Lépni csak a saját körödben, döntés nélkül lehet.</div>}
          <button className="dev-action" disabled={busy || !me || allBuilt} onClick={onBuildAll}>
            {allBuilt ? 'Minden elem kész' : 'Minden épület megépítése'}
          </button>
          <select value={season} onChange={(e) => setSeason(e.target.value)}>
            {SEASON_OPTIONS.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <button className="dev-action" disabled={busy || seasonBlocked} onClick={() => onSeason(season)}>
            {season === 'none' ? 'Szezonesemény leállítása' : 'Szezonesemény indítása'}
          </button>
          {seasonBlocked && <div className="hint">Már tart egy esemény: előbb állítsd le, vagy várd meg a végét.</div>}
        </>
      )}
    </div>
  );
}
