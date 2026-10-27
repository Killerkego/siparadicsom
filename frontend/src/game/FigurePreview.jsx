import { Suspense, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { FIGURES } from './figures';
import { useFigure } from './Pawn';

const HEIGHT = 2; // ekkorára nagyítjuk a figurát, így mindegyik ugyanakkora a képen

// A figura közepe az origóba kerül, ezért a kamera mindig körülötte forog
function Figure({ index, color }) {
  const figure = useFigure(index, color);
  const { scale, offset } = useMemo(() => {
    figure.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(figure);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = HEIGHT / size.y;
    return { scale: s, offset: center.multiplyScalar(-s) };
  }, [figure]);
  return (
    <group position={offset} scale={scale}>
      <primitive object={figure} />
    </group>
  );
}

// A lobbiban a szem ikonra nyíló ablak: a bábu 3D-ben, egérrel körbeforgatható
export default function FigurePreview({ index, color, onClose }) {
  const figure = FIGURES[index];

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="figure-preview" onClick={onClose}>
      <div className="figure-preview-card" role="dialog" aria-label={figure.name} onClick={(e) => e.stopPropagation()}>
        <div className="figure-preview-head">
          <h2>
            {figure.icon} {figure.name}
          </h2>
          <button className="figure-preview-close" onClick={onClose} aria-label="Bezárás">
            ×
          </button>
        </div>
        <div className="figure-preview-stage">
          <Canvas dpr={[1, 2]} camera={{ position: [0, 0.8, 4.2], fov: 35 }}>
            <hemisphereLight args={['#fffaf0', '#e9dfcf', 1.6]} />
            <directionalLight position={[3, 5, 4]} color="#fff0db" intensity={2.2} />
            <Suspense fallback={null}>
              <Figure index={index} color={color} />
            </Suspense>
            {/* csak vízszintesen és kicsit felülről nézhető, hogy ne forduljon fejre */}
            <OrbitControls
              target={[0, 0, 0]}
              enablePan={false}
              minDistance={3}
              maxDistance={6}
              minPolarAngle={Math.PI / 3}
              maxPolarAngle={Math.PI / 2}
            />
          </Canvas>
        </div>
        <p className="hint">Forgasd az egérrel, görgővel nagyíthatsz.</p>
      </div>
    </div>
  );
}
