import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// a lapozható szabályfüzet (frontend/public/szabalyok.html); a játék fölött nyílik, a játék közben fut tovább
const RULES_URL = '/szabalyok.html';

// könyv ikon a gombokhoz
export function BookIcon() {
  return (
    <svg className="book-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 5.5C8.3 4.2 5.8 3.8 3 4.2v10.6c2.8-.4 5.3 0 7 1.3 1.7-1.3 4.2-1.7 7-1.3V4.2c-2.8-.4-5.3 0-7 1.3z" />
      <path d="M10 5.5v10.6" />
    </svg>
  );
}

// A szabályfüzet felugró ablakban: Esc-re, a bezáró gombra vagy a háttérre kattintva bezárul.
// A dokumentum gyökerébe kerül (portál), mert az animált (transform) szülőkön belül a fix pozíció
// nem a teljes képernyőhöz igazodna.
export function RulesDialog({ onClose }) {
  const close = useRef();
  useEffect(() => {
    close.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="rules-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rules-dialog" role="dialog" aria-modal="true" aria-label="Játékszabályok">
        <iframe src={RULES_URL} title="Aranyhegy Szálló – Játékszabályok" />
        <button ref={close} className="rules-close" onClick={onClose} aria-label="Szabályok bezárása" title="Bezárás (Esc)">
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}

// Gomb, ami megnyitja a szabályfüzetet. `className` a hely saját gombstílusa, `children` a felirat
// (ha nincs, csak az ikon látszik).
export default function RulesButton({ className, children, title = 'Játékszabályok' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} title={title} aria-label={title}>
        <BookIcon />
        {children}
      </button>
      {open && <RulesDialog onClose={() => setOpen(false)} />}
    </>
  );
}
