// Hangeffektek a böngészőben szintetizálva (Web Audio), hangfájlok nélkül. Mind rövid és halk, puha
// lecsengéssel, hogy ne zavarjanak: kocka, lépés a hóban, kártya, pénz, építkezés, felvonó, „te jössz”,
// döntés, kattintás és a győzelem dallama. A némítás a böngészőben megmarad.
// A böngésző csak felhasználói mozdulat (kattintás, billentyű) után enged hangot: addig a hangok
// csendben elmaradnak, az első kattintás után szólnak.

const MUTE_KEY = 'siparadicsom.muted';
const VOLUME = 0.32; // a teljes hangerő; az egyes hangok ehhez képest halkak

let ctx = null;
let master = null;
let noise = null;
let muted = load();
const listeners = new Set();

function load() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export const isMuted = () => muted;

export function setMuted(value) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // a némítás megjegyzése csak kényelmi funkció
  }
  if (master) master.gain.value = value ? 0 : VOLUME;
  listeners.forEach((fn) => fn(value));
}

export function onMuteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// az első kattintásra a hangrendszer „felébred” (a böngészők addig nem engednek hangot)
function unlock() {
  const c = audio();
  if (c && c.state === 'suspended') c.resume();
}
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

function audio() {
  if (ctx) return ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  master.connect(ctx.destination);
  // fehér zaj a kocka, a hó és a suhogás hangjához
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

// egy hangszín: frekvencia, hossz (s), forma, hangerő, késleltetés (s), opcionális csúszás egy másik frekvenciára
function tone(freq, dur, { type = 'sine', gain = 0.2, delay = 0, slide = null, attack = 0.005 } = {}) {
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// szűrt zajlöket: kocka koppanása, hó ropogása, suhogás (a szűrő `sweep` frekvenciára csúszhat)
function burst(dur, { freq = 2000, q = 1, gain = 0.2, delay = 0, type = 'bandpass', sweep = null } = {}) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t);
  if (sweep) filter.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

// csengő: alaphang és két felhang, hosszabb lecsengéssel
function bell(freq, { gain = 0.12, delay = 0, dur = 1.1 } = {}) {
  tone(freq, dur, { gain, delay });
  tone(freq * 2.01, dur * 0.6, { gain: gain * 0.35, delay });
  tone(freq * 3.02, dur * 0.35, { gain: gain * 0.15, delay });
}

const SOUNDS = {
  // a kocka gurul: egyre ritkuló koppanások, a végén két koppanás, ahogy megáll
  dice() {
    let t = 0;
    for (let i = 0; i < 9; i++) {
      t += 0.06 + i * 0.022 + Math.random() * 0.03;
      burst(0.035, { freq: 2600 + Math.random() * 1600, q: 4, gain: 0.16 - i * 0.01, delay: t });
    }
    tone(900, 0.05, { type: 'triangle', gain: 0.1, delay: t + 0.1 });
    tone(760, 0.06, { type: 'triangle', gain: 0.08, delay: t + 0.2 });
  },
  // egy lépés a hóban: halk, tompa ropogás
  step() {
    burst(0.07, { freq: 900 + Math.random() * 500, q: 0.8, gain: 0.07, type: 'lowpass' });
  },
  // felvonó: halk, emelkedő suhogás
  lift() {
    burst(0.8, { freq: 300, sweep: 1400, q: 1.5, gain: 0.08 });
    tone(330, 0.7, { gain: 0.03, slide: 495 });
  },
  // kártyahúzás: papírsuhogás, a végén egy pöccintés
  card() {
    burst(0.32, { freq: 500, sweep: 3200, q: 0.9, gain: 0.12 });
    burst(0.05, { freq: 4000, q: 3, gain: 0.07, delay: 0.32 });
  },
  // pénzt kapott: két csillanó érmehang
  coin() {
    tone(1318, 0.18, { type: 'triangle', gain: 0.09 });
    tone(1760, 0.35, { type: 'triangle', gain: 0.08, delay: 0.08 });
  },
  // pénzt fizetett: halk, lefelé csúszó hang
  pay() {
    tone(392, 0.32, { gain: 0.08, slide: 262 });
    tone(196, 0.3, { type: 'triangle', gain: 0.04, slide: 147 });
  },
  // építkezés: tompa koppanás, utána felfelé lépő hármashangzat
  build() {
    tone(110, 0.16, { gain: 0.16, slide: 70 });
    burst(0.08, { freq: 600, q: 1, gain: 0.06, type: 'lowpass' });
    [523, 659, 784].forEach((f, i) => bell(f, { gain: 0.06, delay: 0.12 + i * 0.09, dur: 0.7 }));
  },
  // te következel: egy puha csengőhang
  turn() {
    bell(880, { gain: 0.07, dur: 1.2 });
    bell(1320, { gain: 0.04, delay: 0.12, dur: 0.9 });
  },
  // döntés nyílik: halk, felfelé pattanó hang
  decision() {
    tone(587, 0.12, { gain: 0.06, slide: 880 });
  },
  // gombnyomás: alig hallható koppintás
  click() {
    tone(1400, 0.03, { type: 'triangle', gain: 0.035 });
  },
  // síverseny győztese: rövid fanfár
  race() {
    [784, 988, 1175].forEach((f, i) => bell(f, { gain: 0.06, delay: i * 0.1, dur: 0.6 }));
  },
  // új szezonesemény: halk szélfúvás és egy ünnepélyes, kétszólamú csengetés
  season() {
    burst(1.2, { freq: 400, sweep: 1200, q: 0.7, gain: 0.05 });
    bell(659, { gain: 0.07, delay: 0.1, dur: 1.4 });
    bell(988, { gain: 0.05, delay: 0.1, dur: 1.2 });
    bell(784, { gain: 0.06, delay: 0.45, dur: 1.6 });
  },
  // csapda elsült: két lefelé lépő hang
  trap() {
    tone(466, 0.14, { type: 'triangle', gain: 0.07 });
    tone(349, 0.3, { type: 'triangle', gain: 0.07, delay: 0.12 });
  },
  // győzelem: csengős dallam, a végén kitartott akkord és csillogás
  victory() {
    [523, 659, 784, 1047].forEach((f, i) => bell(f, { gain: 0.08, delay: i * 0.14, dur: 0.9 }));
    [523, 659, 784, 1047].forEach((f) => bell(f, { gain: 0.05, delay: 0.7, dur: 2.2 }));
    for (let i = 0; i < 6; i++) tone(2093 + i * 260, 0.25, { gain: 0.025, delay: 0.75 + i * 0.07 });
  },
};

// egy hang lejátszása (némítva vagy a hangrendszer feloldása előtt csendben elmarad)
export function play(name) {
  if (muted) return;
  const c = audio();
  if (!c || c.state !== 'running') return;
  SOUNDS[name]?.();
}

// a hang lejátszása egy későbbi időpontban (ms, a böngésző órája szerint); visszaadja a lemondó függvényt
export function playAt(name, when) {
  const wait = when - Date.now();
  if (wait < -150) return () => {}; // ami már elmúlt (pl. oldalfrissítés után), az nem szól utólag
  const timer = setTimeout(() => play(name), Math.max(0, wait));
  return () => clearTimeout(timer);
}
