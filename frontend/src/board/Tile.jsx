import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { GAP, TILE_H } from './layout';
import { TILE_COLOR, makeTileTexture } from './textures';

export default function Tile({ field, placement, onHover }) {
  const [hovered, setHovered] = useState(false);
  const [w, d] = placement.size;

  const materials = useMemo(() => {
    const side = new THREE.MeshStandardMaterial({ color: TILE_COLOR });
    const top = new THREE.MeshStandardMaterial({ map: makeTileTexture(field, w, d) });
    // BoxGeometry lapjainak sorrendje: +x, -x, +y (teteje), -y, +z, -z
    return [side, side, top, side, side, side];
  }, [field, w, d]);

  useEffect(
    () => () => {
      materials[2].map.dispose();
      materials.forEach((m) => m.dispose());
    },
    [materials],
  );

  const [x, y, z] = placement.position;

  return (
    <mesh
      position={[x, hovered ? y + 0.1 : y, z]}
      rotation={[0, placement.rotationY, 0]}
      material={materials}
      castShadow
      receiveShadow
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover?.(field);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover?.(null);
      }}
    >
      <boxGeometry args={[w - GAP, TILE_H, d - GAP]} />
    </mesh>
  );
}
