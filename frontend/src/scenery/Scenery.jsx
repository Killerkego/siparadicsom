import { useLayoutEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import ChimneySmoke from './ChimneySmoke';
import SkiLift from './SkiLift';
import Skiers from './Skiers';
import Wildlife from './Wildlife';

// Blenderben készült meseszerű táj: tábla kerete, mesefenyők, négyféle házikó, hóemberek, alpesi grand hotel, gondolás
// felvonó, felhők, síelő-, snowboardos-, szarvas-, őz- és kabinminta (forrás: blender/palya.blend; a hóember forrása: CREDITS.md)
export const MODEL_URL = '/models/kornyezet.glb';

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
      cabin: scene.getObjectByName('Kabin_minta'),
      riders: { ski: scene.getObjectByName('Sielo_minta'), board: scene.getObjectByName('Snowboard_minta') },
      animals: { stag: scene.getObjectByName('Szarvas_minta'), roe: scene.getObjectByName('Oz_minta') },
      terrain: scene.getObjectByName('Talaj'),
    };
  }, [scene]);

  useLayoutEffect(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      // a távoli hegyek és a felhők nem vetnek árnyékot, a felhőket a köd sem halványítja el
      const sky = o.name.startsWith('Felho');
      o.receiveShadow = !sky;
      o.castShadow = o.name !== 'Talaj' && !o.name.startsWith('Hegyvonulat') && !sky;
      if (sky) o.material.fog = false;
    });
    // a minták csak másolásra kellenek
    parts.cabin.visible = false;
    parts.riders.ski.visible = false;
    parts.riders.board.visible = false;
    parts.animals.stag.visible = false;
    parts.animals.roe.visible = false;
  }, [scene, parts]);

  return (
    <>
      <primitive object={scene} />
      <ChimneySmoke positions={parts.chimneys} />
      <SkiLift loop={parts.liftLoop} cabin={parts.cabin} />
      <Skiers templates={parts.riders} terrain={parts.terrain} />
      <Wildlife templates={parts.animals} terrain={parts.terrain} />
    </>
  );
}

useGLTF.preload(MODEL_URL);
