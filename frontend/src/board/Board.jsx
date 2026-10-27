import Tile from './Tile';
import { tilePlacement } from './layout';

// A keret és a környezet a Blenderből exportált modellben van (Scenery), itt csak a mezők;
// a tábla közepét az építkezés tölti ki (game/BuildSite).
export default function Board({ fields, onHover }) {
  return (
    <group>
      {fields.map((field, i) => (
        <Tile key={field.id} field={field} placement={tilePlacement(i)} onHover={onHover} />
      ))}
    </group>
  );
}
