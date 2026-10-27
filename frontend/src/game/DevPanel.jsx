import { useState } from 'react';
import { FIELD_TYPES, SPECIAL_TYPES } from '../board/fieldTypes';
import boardData from '../data/board.json';

const fields = boardData.fields;

const fieldLabel = (f) => `#${f.id} ${FIELD_TYPES[f.type].label}${f.special ? ` – ${SPECIAL_TYPES[f.special]}` : ''}`;

// Fejlesztői fül (csak ha a backendben DEV_MODE = True): dobás helyett bármelyik mezőre lépés,
// és az összes építési elem ingyen
export default function DevPanel({ game, me, canMove, busy, onMove, onBuildAll }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState(1);
  const allBuilt = me && me.buildings.length === game.buildings.length;

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
                {fieldLabel(f)}
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
        </>
      )}
    </div>
  );
}
