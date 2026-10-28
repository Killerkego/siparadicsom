import { useState } from 'react';

// Felül középen: a játékkód és a kilépés, külön a játék vezérlőitől. Kilépés előtt rákérdez.
export default function GameMenu({ code, onLeave }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="game-menu">
      <span className="game-menu-code">
        <span aria-hidden="true">✦</span> Játékkód <b>{code}</b>
      </span>
      {confirming ? (
        <span className="game-menu-confirm">
          Biztosan kilépsz?
          <button onClick={onLeave}>Igen</button>
          <button className="secondary" onClick={() => setConfirming(false)}>
            Mégse
          </button>
        </span>
      ) : (
        <button className="secondary" onClick={() => setConfirming(true)}>
          Kilépés
        </button>
      )}
    </div>
  );
}
