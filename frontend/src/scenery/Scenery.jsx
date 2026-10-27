import { useLayoutEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import ChimneySmoke from './ChimneySmoke';
import SkiLift from './SkiLift';
import Skiers from './Skiers';

// Blenderben készült: fa keret, havas táj, fenyők, házak, felvonó, síelő- és székminta
// (forrás: blender/palya.blend)
const MODEL_URL = '/models/kornyezet.glb';

function pointsByPrefix(scene, prefix) {
  const nodes = [];
  scene.traverse((o) => o.name.startsWith(prefix) && nodes.push(o));
  nodes.sort((a, b) => a.name.localeCompare(b.name));
  return nodes.map((o) => o.getWorldPosition(new THREE.Vector3()));
}

export default function Scenery() {
  const { scene } = useGLTF(MODEL_URL);

  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    return {
      chimneys: pointsByPrefix(scene, 'Fust'),
      // a két kötélág egy zárt kört alkot: fel a jobb, le a bal oldalon
      liftLoop: [...pointsByPrefix(scene, 'KotelFel'), ...pointsByPrefix(scene, 'KotelLe')],
      chair: scene.getObjectByName('Szek_minta'),
      skier: scene.getObjectByName('Sielo_minta'),
      terrain: scene.getObjectByName('Talaj'),
    };
  }, [scene]);

  useLayoutEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = true;
      o.castShadow = o.name !== 'Talaj';
    });
    // a minták csak másolásra kellenek
    parts.chair.visible = false;
    parts.skier.visible = false;
  }, [scene, parts]);

  return (
    <>
      <primitive object={scene} />
      <ChimneySmoke positions={parts.chimneys} />
      <SkiLift loop={parts.liftLoop} chair={parts.chair} />
      <Skiers template={parts.skier} terrain={parts.terrain} />
    </>
  );
}

useGLTF.preload(MODEL_URL);
