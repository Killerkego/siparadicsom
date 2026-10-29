import { useEffect, useState } from 'react';
import { isMuted, onMuteChange, play, setMuted } from '../game/sound';
import RulesButton from './Rules';

// hangszóró ikon: hullámokkal, ha szól, áthúzva, ha némítva
function SpeakerIcon({ muted }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 8h3l4-3.5v11L6 12H3z" fill="currentColor" />
      {muted ? (
        <path d="M13 7.5l5 5m0-5l-5 5" />
      ) : (
        <>
          <path d="M13 7.5a3.5 3.5 0 0 1 0 5" />
          <path d="M15.2 5.3a6.6 6.6 0 0 1 0 9.4" />
        </>
      )}
    </svg>
  );
}

// Felül középen: a játékkód, a szabályfüzet, a hang ki/be kapcsolása és a kilépés, külön a játék
// vezérlőitől. Kilépés előtt rákérdez.
export default function GameMenu({ code, onLeave }) {
  const [confirming, setConfirming] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  useEffect(() => onMuteChange(setMutedState), []);

  const toggleSound = () => {
    setMuted(!muted);
    if (muted) play('coin'); // visszakapcsoláskor egy rövid hang jelzi, hogy szól
  };

  return (
    <div className="game-menu">
      <span className="game-menu-code">
        <span aria-hidden="true">✦</span> Játékkód <b>{code}</b>
      </span>
      <RulesButton className="secondary icon-button" />
      <button
        className={muted ? 'secondary sound-toggle muted' : 'secondary sound-toggle'}
        onClick={toggleSound}
        title={muted ? 'Hang bekapcsolása' : 'Hang némítása'}
        aria-label={muted ? 'Hang bekapcsolása' : 'Hang némítása'}
        aria-pressed={muted}
      >
        <SpeakerIcon muted={muted} />
      </button>
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
