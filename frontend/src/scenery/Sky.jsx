import { useMemo } from 'react';
import * as THREE from 'three';

// Meseszerű, de visszafogott téli égbolt: fent halvány égkék, a horizont felé meleg krémszín.
// A pufók felhők a Blender-modellben vannak (Felho.*).
export const HORIZON_COLOR = '#f3ece6'; // ködhöz: a távoli hegyek ebbe a színbe halványulnak
// az ég alapszínei; a szezonesemények (Weather) ezekből indulva színezik át
export const BASE_SKY = { horizon: HORIZON_COLOR, middle: '#f1e4de', zenith: '#a9c6df' };

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 horizon;
  uniform vec3 middle;
  uniform vec3 zenith;
  varying vec3 vDir;
  void main() {
    float h = clamp(vDir.y, 0.0, 1.0);
    // a kamera alig néz a horizont fölé, ezért a kék már alacsonyan kezdődik
    vec3 color = mix(horizon, middle, smoothstep(0.0, 0.05, h));
    color = mix(color, zenith, smoothstep(0.06, 0.32, h));
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// uniformsRef: ide kerülnek az ég színei, hogy a szezonesemények átszínezhessék
export default function Sky({ uniformsRef }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          horizon: { value: new THREE.Color(BASE_SKY.horizon) },
          middle: { value: new THREE.Color(BASE_SKY.middle) },
          zenith: { value: new THREE.Color(BASE_SKY.zenith) },
        },
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    [],
  );
  if (uniformsRef) uniformsRef.current = material.uniforms;

  return (
    <mesh material={material} renderOrder={-1} raycast={() => null}>
      <sphereGeometry args={[350, 32, 16]} />
    </mesh>
  );
}
