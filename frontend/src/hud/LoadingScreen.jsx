import { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';

// Töltőképernyő, amíg a 3D jelenet el nem készül (letöltés, a modellek feldolgozása, az első kirajzolás):
// a kezdőlap alpesi képe hóeséssel, arany felirat, és egy havas domboldal, amin a síelő folyamatosan csúszik le.
// A kijelzett haladás simán közelít a valódihoz, és ha az épp nem mozdul, lassan tovább kúszik, hogy ne
// álljon meg; amikor a jelenet kész, felfut 100%-ra, és csak utána halványul el.
const MIN_TIME = 1500; // ms, ennyi ideig mindenképp látszik, hogy ne villanjon
const FADE_TIME = 700; // ms, az eltűnés
const TIP_TIME = 3800; // ms, ennyi ideig látszik egy tipp
const CREEP = 6; // %/s, ennyivel kúszik tovább, amíg a valódi haladás nem mozdul
const CREEP_MAX = 92; // a kúszás eddig mehet; a 100% a kész jelenetnek jár
const CATCH_UP = 4; // milyen gyorsan éri utol a kijelzett érték a célt (1/s)
const FINISH_SPEED = 60; // %/s, ilyen gyorsan fut fel 100%-ra, ha kész a jelenet
const FINISH_HOLD = 350; // ms, ennyit áll 100%-on, mielőtt elhalványul

// mit csinálunk éppen, a töltődő fájl alapján
const STEPS = [
  ['kornyezet', 'A hegyek, a házak és a felvonó felépítése…'],
  ['babuk', 'A bábuk felöltöztetése…'],
  ['epuletek', 'Az üdülő tervrajzainak kiterítése…'],
  ['fenyo', 'A fenyőfa keret csiszolása…'],
];

const TIPS = [
  'Vásárlási mezőn 30% kedvezménnyel építhetsz.',
  'A START-on áthaladva 2000 HK jár, és a bank ilyenkor a hiteledből is levon.',
  'Hitellel nem lehet nyerni: előbb rendezd a tartozásod!',
  'A felvonó 500 HK-ért átvisz egy másik felvonó mezőjére.',
  'A Szálloda nyitja meg az Éttermet, a Wellnesst és a Luxus lakosztályokat.',
  'Csapdát rakhatsz a csapdamezőn: a következő idelépő megfizeti az árát.',
  'Az oktatásról csak páros dobással jutsz tovább.',
];

// a domboldal: a síelő ezen az íven csúszik (SVG koordinátákban, a rajz 400 × 110)
const SLOPE = 'M 10 22 C 90 20, 140 62, 230 66 S 330 92, 390 96';
const SLOPE_W = 400;
const SLOPE_H = 110;

function stepText(item, downloaded) {
  if (downloaded) return 'A pálya utolsó simításai…';
  const step = STEPS.find(([key]) => item?.includes(key));
  return step ? step[1] : 'A hó elegyengetése a pályán…';
}

// A kijelzett haladás (0..100): simán követi a valódit, közben lassan kúszik, a végén felfut 100-ra.
function useSmoothProgress(real, finished) {
  const [shown, setShown] = useState(0);
  const state = useRef({ value: 0, real: 0, finished: false });
  state.current.real = Math.max(state.current.real, real); // a drei újraszámolásakor ne essen vissza
  state.current.finished = finished;

  // időzítővel fut (nem képkockánként), így akkor is halad, amikor a 3D betöltése épp lefogja a rajzolást
  useEffect(() => {
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const s = state.current;
      if (s.finished) {
        s.value = Math.min(100, s.value + FINISH_SPEED * dt + (100 - s.value) * Math.min(1, CATCH_UP * dt));
      } else {
        const target = Math.min(CREEP_MAX, Math.max(s.real * 0.9, s.value + CREEP * dt));
        s.value += (target - s.value) * Math.min(1, CATCH_UP * dt);
      }
      setShown(s.value);
      if (s.value >= 100) clearInterval(timer);
    };
    const timer = setInterval(tick, 33);
    return () => clearInterval(timer);
  }, [finished]);

  return shown;
}

// waiting: még a szerverhez kapcsolódunk (a felirat a `message`); ready: a 3D jelenet kész
export default function LoadingScreen({ waiting = false, ready = false, message }) {
  const { progress, item } = useProgress();
  const [shownAt] = useState(Date.now);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [path, setPath] = useState(null);
  const done = ready && !waiting;
  const shown = useSmoothProgress(waiting ? 0 : progress, done);

  // ha kész és a csík felért 100%-ra, a minimális idő után elhalványul, majd eltűnik
  useEffect(() => {
    if (!done || shown < 100 || leaving) return;
    const wait = Math.max(FINISH_HOLD, MIN_TIME - (Date.now() - shownAt));
    const timer = setTimeout(() => setLeaving(true), wait);
    return () => clearTimeout(timer);
  }, [done, shown, leaving, shownAt]);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setGone(true), FADE_TIME);
    return () => clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    const timer = setInterval(() => setTip((t) => (t + 1) % TIPS.length), TIP_TIME);
    return () => clearInterval(timer);
  }, []);

  if (gone) return null;

  // a síelő helye és dőlése a domboldalon
  const p = Math.min(1, Math.max(0, shown / 100));
  let skier = { x: 10, y: 22, angle: 0 };
  if (path) {
    const length = path.getTotalLength();
    const at = path.getPointAtLength(p * length);
    const ahead = path.getPointAtLength(Math.min(length, p * length + 4));
    skier = { x: at.x, y: at.y, angle: (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI };
  }

  return (
    <div className={leaving ? 'loading-screen leaving' : 'loading-screen'} role="status" aria-live="polite">
      <img
        className="loading-landscape"
        src="/alpine-winter.jpg"
        alt=""
        aria-hidden="true"
        ref={(el) => el?.complete && el.classList.add('loaded')} // gyorsítótárból már kész lehet
        onLoad={(e) => e.currentTarget.classList.add('loaded')}
      />
      {/* hóesés CSS-animációval: a böngésző külön szálon mozgatja, így akkor is esik,
          amikor a 3D betöltése rövid időre lefogja az oldalt */}
      <div className="loading-snow far" aria-hidden="true" />
      <div className="loading-snow near" aria-hidden="true" />
      <div className="loading-card">
        <img className="loading-logo" src="/logo.png" alt="" aria-hidden="true" />
        <p className="loading-eyebrow">
          <span aria-hidden="true">✦</span> ALPESI ÜDÜLŐ · ÖTCSILLAGOS SZÁLLÓ <span aria-hidden="true">✦</span>
        </p>
        <h1>Aranyhegy Szálló</h1>
        <p className="loading-step">{message ?? (done ? 'Indul a szezon!' : stepText(item, progress >= 100))}</p>

        <div className="loading-slope">
          <svg viewBox={`0 0 ${SLOPE_W} ${SLOPE_H}`} aria-hidden="true">
            {/* havas domb, a megtett rész arany nyomvonallal */}
            <path d={`${SLOPE} L 390 110 L 10 110 Z`} className="hill" />
            <path d={SLOPE} className="track" />
            <path ref={setPath} d={SLOPE} className="trail" pathLength="1" style={{ strokeDasharray: `${p} 1` }} />
            {[60, 170, 300].map((x, i) => (
              <g key={x} className="pine" transform={`translate(${x} ${[30, 72, 95][i]})`}>
                <path d="M 0 -18 L 7 -6 L 4 -6 L 9 2 L -9 2 L -4 -6 L -7 -6 Z" />
              </g>
            ))}
          </svg>
          {/* a síelő HTML elem, hogy a kanyargása CSS-animáció lehessen; lefelé, a lejtő irányába néz */}
          <span
            className="loading-skier"
            style={{
              left: `${(skier.x / SLOPE_W) * 100}%`,
              top: `${(skier.y / SLOPE_H) * 100}%`,
              transform: `rotate(${skier.angle}deg)`,
            }}
            aria-hidden="true"
          >
            <span>⛷️</span>
          </span>
        </div>

        <div className="loading-percent">{waiting ? '…' : `${Math.round(shown)}%`}</div>
        <p className="loading-tip" key={tip}>
          <b>Tipp:</b> {TIPS[tip]}
        </p>
      </div>
    </div>
  );
}
