import { useEffect, useMemo } from 'react';
import Tile from './Tile';
import { BOARD_SIZE, TILE_D, tilePlacement } from './layout';
import { makeEmblemTexture } from './textures';

function CenterEmblem() {
  const texture = useMemo(() => makeEmblemTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  const size = BOARD_SIZE - 2 * TILE_D - 0.4;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={texture} transparent depthWrite={false} roughness={0.9} />
    </mesh>
  );
}

// A keret és a környezet a Blenderből exportált modellben van (Scenery), itt csak a mezők.
export default function Board({ fields, onHover }) {
  return (
    <group>
      <CenterEmblem />
      {fields.map((field, i) => (
        <Tile key={field.id} field={field} placement={tilePlacement(i)} onHover={onHover} />
      ))}
    </group>
  );
}
