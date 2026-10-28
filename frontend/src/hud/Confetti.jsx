import { useEffect, useRef } from 'react';

const GOLD = ['#e7c783', '#c19b58', '#fff4d6', '#a17b3d', '#f0dfbb'];
const COUNT = 200;

// Arany konfetti és hópelyhek a győzelmi képernyő mögött: az elején a közepéből szétrobban, utána
// lassan hullik. A győztes színe is köztük van. Csökkentett mozgás beállításnál nem animál.
export default function Confetti({ color }) {
  const ref = useRef();

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const colors = color ? [...GOLD, color, color] : GOLD;
    let width = 0;
    let height = 0;
    let frame;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // a fele konfetti szétrobban a középről, a többi felülről hullik; a hópelyhek kerekek
    const pieces = Array.from({ length: COUNT }, (_, i) => {
      const burst = i < COUNT / 2;
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 12;
      return {
        x: burst ? width / 2 : Math.random() * width,
        y: burst ? height * 0.42 : -20 - Math.random() * height,
        vx: burst ? Math.cos(angle) * speed : (Math.random() - 0.5) * 0.6,
        vy: burst ? Math.sin(angle) * speed - 4 : 1 + Math.random() * 1.5,
        size: 9 + Math.random() * 9,
        spin: Math.random() * Math.PI,
        spinSpeed: (Math.random() - 0.5) * 0.25,
        sway: Math.random() * Math.PI * 2,
        snow: i % 5 === 0,
        color: colors[i % colors.length],
      };
    });

    const tick = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of pieces) {
        p.vx *= 0.985;
        p.vy = Math.min(p.vy + 0.12, p.snow ? 1.2 : 2.6);
        p.sway += 0.03;
        p.x += p.vx + Math.sin(p.sway) * 0.5;
        p.y += p.vy;
        p.spin += p.spinSpeed;
        if (p.y > height + 20) {
          p.y = -20;
          p.x = Math.random() * width;
          p.vx = (Math.random() - 0.5) * 0.6;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.snow) {
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.rotate(p.spin);
          ctx.scale(1, Math.cos(p.spin * 2)); // a forgó papírcsík hol szélesebb, hol keskenyebb
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, [color]);

  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
