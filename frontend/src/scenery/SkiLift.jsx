import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const CHAIR_SPACING = 3.2; // méter
const SPEED = 1.1; // méter / másodperc

// Ülőszékek körbe-körbe a kötélen (a kötél pontjai a Blender-modellből jönnek)
export default function SkiLift({ loop, chair }) {
  const path = useMemo(() => {
    const segments = loop.map((a, i) => {
      const b = loop[(i + 1) % loop.length];
      return { a, b, length: a.distanceTo(b) };
    });
    const total = segments.reduce((sum, s) => sum + s.length, 0);
    return { segments, total };
  }, [loop]);

  const chairs = useMemo(() => {
    const count = Math.floor(path.total / CHAIR_SPACING);
    return Array.from({ length: count }, () => {
      const c = chair.clone();
      c.visible = true;
      c.traverse((o) => (o.castShadow = true));
      return c;
    });
  }, [chair, path]);

  useFrame(({ clock }) => {
    chairs.forEach((c, i) => {
      let s = (clock.elapsedTime * SPEED + (i * path.total) / chairs.length) % path.total;
      for (const seg of path.segments) {
        if (s <= seg.length) {
          c.position.lerpVectors(seg.a, seg.b, s / seg.length);
          break;
        }
        s -= seg.length;
      }
    });
  });

  return chairs.map((c, i) => <primitive key={i} object={c} />);
}
