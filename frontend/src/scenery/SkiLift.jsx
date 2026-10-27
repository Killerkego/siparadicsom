import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const CABIN_SPACING = 6; // méter
const SPEED = 1.1; // méter / másodperc

// Gondolák körbe-körbe a kötélen (a kötél pontjai a Blender-modellből jönnek)
export default function SkiLift({ loop, cabin }) {
  const path = useMemo(() => {
    const segments = loop.map((a, i) => {
      const b = loop[(i + 1) % loop.length];
      return { a, b, length: a.distanceTo(b) };
    });
    const total = segments.reduce((sum, s) => sum + s.length, 0);
    return { segments, total };
  }, [loop]);

  const cabins = useMemo(() => {
    const count = Math.floor(path.total / CABIN_SPACING);
    return Array.from({ length: count }, () => {
      const c = cabin.clone();
      c.visible = true;
      c.traverse((o) => (o.castShadow = true));
      return c;
    });
  }, [cabin, path]);

  useFrame(({ clock }) => {
    cabins.forEach((c, i) => {
      let s = (clock.elapsedTime * SPEED + (i * path.total) / cabins.length) % path.total;
      for (const seg of path.segments) {
        if (s <= seg.length) {
          c.position.lerpVectors(seg.a, seg.b, s / seg.length);
          break;
        }
        s -= seg.length;
      }
    });
  });

  return cabins.map((c, i) => <primitive key={i} object={c} />);
}
