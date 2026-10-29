import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import Board from '../board/Board';
import FixedCamera from '../board/FixedCamera';
import Scenery, { MODEL_URL as SCENERY_URL } from '../scenery/Scenery';
import Sky, { HORIZON_COLOR } from '../scenery/Sky';
import BuildSite, { MODEL_URL as BUILDINGS_URL } from './BuildSite';
import CardDeck from './CardDeck';
import Dice from './Dice';
import { fields } from './format';
import Pawn, { MODEL_URL as FIGURES_URL } from './Pawn';
import Trap from './Trap';

// a mezők feliratai canvasra rajzolódnak, ezért előbb be kell tölteni a betűtípust
function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all(['400', '700', '800'].map((w) => document.fonts.load(`${w} 32px Nunito`))).finally(() =>
      setReady(true),
    );
  }, []);
  return ready;
}

// Jelzi, ha a jelenet tényleg kész: minden modell betöltött, a shaderek lefordultak és már pár képkocka
// kirajzolódott. (A letöltés vége után ez még eltart egy ideig, addig a töltőképernyő marad.)
function SceneReady({ onReady }) {
  useGLTF([SCENERY_URL, FIGURES_URL, BUILDINGS_URL]); // addig vár, amíg mind be nem töltött
  const { gl, scene, camera } = useThree();
  const [compiled, setCompiled] = useState(false);
  const frames = useRef(0);
  // a shaderek fordítása párhuzamosan, nem egy hosszú, mindent megállító lépésben
  useEffect(() => {
    let alive = true;
    gl.compileAsync(scene, camera)
      .catch(() => {})
      .finally(() => alive && setCompiled(true));
    return () => {
      alive = false;
    };
  }, [gl, scene, camera]);
  useFrame(() => {
    if (!compiled) return;
    frames.current += 1;
    if (frames.current === 3) onReady?.();
  });
  return null;
}

// meseszerű téli fények: lágy égbolt-fény és meleg napfény árnyékokkal
function Lights() {
  return (
    <>
      <hemisphereLight args={['#e8f0f8', '#f4eee8', 1.25]} />
      <directionalLight
        position={[-28, 24, 6]}
        color="#fff0db"
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
    </>
  );
}

// A 3D jelenet: táj, tábla, középen a saját építkezés a kockával és a kártyapaklival, a bábuk és a saját csapdák.
// side: melyik oldal felé néz a kamera (0..3); a középső rész is erre fordul.
export default function GameScene({
  game,
  playerId,
  timeline,
  side,
  canRoll,
  onRoll,
  canAckCard,
  onAckCard,
  canPickCard,
  onPickCard,
  viewedId,
  onReady,
}) {
  const [hovered, setHovered] = useState(null);
  const fontsReady = useFontsReady();
  const { action, phase, settled, diceRoll, cardDraw } = timeline;
  const settledMe = settled.players.find((p) => p.id === playerId);
  // a középen látszó építkezés: a kiválasztott játékosé (alapból a sajátunk)
  const viewed = settled.players.find((p) => p.id === viewedId) ?? settledMe;
  // a saját csapdák (más csapdáját nem látja senki); a mozgás végén jelennek meg vagy tűnnek el
  const myTraps = Object.entries(settled.traps ?? {}).filter(([, trap]) => trap.owner === playerId);

  return (
    <Canvas shadows="percentage" dpr={[1, 2]} camera={{ fov: 55, near: 0.5, far: 400 }}>
      {/* meseszerű pára: a távoli hegyek a horizont színébe halványulnak */}
      <fog attach="fog" args={[HORIZON_COLOR, 90, 300]} />
      <Sky />
      <FixedCamera side={side} />
      <Lights />
      <Suspense fallback={null}>
        <Scenery />
      </Suspense>
      {fontsReady && <Board fields={fields} onHover={setHovered} />}

      <group rotation-y={(-side * Math.PI) / 2}>
        <Dice roll={diceRoll} disabled={!canRoll} onClick={onRoll} />
        <CardDeck
          draw={cardDraw}
          held={game.pending?.type === 'card'}
          onAck={canAckCard ? onAckCard : null}
          pick={phase === 'idle' && game.pending?.type === 'card_pick' ? game.pending.options : null}
          onPick={canPickCard ? onPickCard : null}
        />
      </group>
      {viewed && (
        <Suspense fallback={null}>
          {/* játékosváltáskor új építkezés: a már meglévő épületei állnak, nem nőnek ki újra */}
          <BuildSite key={viewed.id} buildings={game.buildings} owned={viewed.buildings} side={side} />
        </Suspense>
      )}

      <Suspense fallback={null}>
        {game.players.map((p, i) => (
          <Pawn
            key={p.id}
            field={p.position}
            action={action?.player_id === p.id ? action : null}
            slot={i}
            figure={p.figure}
            color={p.color}
            lifted={phase === 'idle' && hovered?.id === p.position}
          />
        ))}
        {settledMe &&
          myTraps.map(([field]) => <Trap key={field} field={Number(field)} color={settledMe.color} />)}
      </Suspense>
      <Suspense fallback={null}>
        <SceneReady onReady={onReady} />
      </Suspense>
    </Canvas>
  );
}
