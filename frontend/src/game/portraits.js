import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FIGURES } from './figures';

// A bábuk portréja a játékoskártyákhoz: a babuk.glb figuráit egyszer lefényképezzük egy rövid életű,
// külön renderelővel (átlátszó háttér), így a kép mindig ugyanaz, mint a táblán álló bábu.
const MODEL_URL = '/models/babuk.glb';
const SIZE = 256;

let portraits = null; // Promise<string[]>, az összes játékoskártya ugyanazt használja

function render() {
  return new GLTFLoader().loadAsync(MODEL_URL).then(({ scene: model }) => {
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(SIZE, SIZE);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#f4f8fc', '#e8dccb', 2.2));
    const sun = new THREE.DirectionalLight('#fff3e2', 2.4);
    sun.position.set(2, 4, 5);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    const urls = FIGURES.map(({ model: name }) => {
      const figure = model.getObjectByName(name).clone();
      figure.position.set(0, 0, 0);
      scene.add(figure);
      box.setFromObject(figure);
      box.getSize(size);
      box.getCenter(center);
      // kicsit felülről és jobbról, arccal a kamera felé (a figurák +z felé néznek)
      const dist = (Math.max(size.x, size.y) * 0.62) / Math.tan(THREE.MathUtils.degToRad(14));
      camera.position.copy(center).add(new THREE.Vector3(0.28, 0.32, 1).normalize().multiplyScalar(dist));
      camera.lookAt(center);
      renderer.render(scene, camera);
      scene.remove(figure);
      return renderer.domElement.toDataURL('image/png');
    });
    renderer.dispose();
    renderer.forceContextLoss();
    return urls;
  });
}

// a figurák portréi (data URL-ek) a FIGURES sorrendjében; amíg készülnek, üres tömb.
// enabled: csak akkor kezdjük el, ha a 3D jelenet már kész (különben a betöltést lassítaná)
export function usePortraits(enabled = true) {
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    portraits ??= render();
    portraits.then((u) => alive && setUrls(u)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return urls;
}
