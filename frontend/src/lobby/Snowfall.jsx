import { useEffect, useRef } from 'react';

const FLAKES_PER_PIXEL = 1 / 5000; // a hópelyhek sűrűsége a terület arányában

function newFlake(width, height, anywhere) {
  const depth = Math.random(); // 0: távoli (kicsi, lassú, halvány), 1: közeli
  return {
    x: Math.random() * width,
    y: anywhere ? Math.random() * height : -10,
    r: 0.8 + depth * 2.4,
    speed: 14 + depth * 36, // px/s
    sway: 6 + Math.random() * 14,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.35 + depth * 0.55,
  };
}

// Hóesés a kezdőlap képe fölött. Egyszerű canvas-animáció; csökkentett mozgás beállításnál nem fut.
export default function Snowfall() {
  const canvas = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = canvas.current;
    const ctx = el.getContext('2d');
    let flakes = [];
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = el.clientWidth;
      height = el.clientHeight;
      el.width = width * dpr;
      el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(width * height * FLAKES_PER_PIXEL);
      flakes = Array.from({ length: count }, (_, i) => flakes[i] ?? newFlake(width, height, true));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    let frame;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05); // háttérfülről visszatérve se ugorjon nagyot
      last = now;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.y += f.speed * dt;
        f.phase += dt * 0.9;
        if (f.y > height + 10) flakes[i] = newFlake(width, height, false);
        ctx.globalAlpha = f.alpha;
        ctx.beginPath();
        ctx.arc(f.x + Math.sin(f.phase) * f.sway, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvas} className="home-snow" aria-hidden="true" />;
}
