import { useEffect, useRef, useState } from 'react';

const SHOW_TIME = 5500; // ms, ennyi után a bejelentés magától eltűnik

// a három szezonesemény ikonja (vonalas, a játék krém–arany stílusában)
export function SeasonIcon({ id }) {
  return (
    <svg className="season-icon" viewBox="0 0 24 24" aria-hidden="true">
      {id === 'peak' && (
        <>
          <circle cx="12" cy="12" r="4.2" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path key={a} d="M12 3.2v2.4" transform={`rotate(${a} 12 12)`} />
          ))}
        </>
      )}
      {id === 'blizzard' && (
        <>
          {[0, 60, 120].map((a) => (
            <g key={a} transform={`rotate(${a} 12 12)`}>
              <path d="M12 3v18" />
              <path d="M9.6 5.2 12 7l2.4-1.8M9.6 18.8 12 17l2.4 1.8" />
            </g>
          ))}
        </>
      )}
      {id === 'audit' && (
        <>
          <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
          <path d="M9 3.5h6v2.5H9z" />
          <path d="M8.5 10.5h7M8.5 13.5h7M8.5 16.5h4" />
        </>
      )}
    </svg>
  );
}

// hány kör van még hátra a futó eseményből (a mostanit is beleszámolva)
export const roundsLeft = (season, round) => season.until - round + 1;

// Új szezonesemény bejelentése a képernyő közepén: mindenkinél a mozgás végén (settled), csak az új
// eseményre; oldalfrissítés után a régi nem ugrik fel újra. Rákattintva vagy pár mp múlva eltűnik.
export function SeasonBanner({ season, round }) {
  const seen = useRef(season?.seq ?? 0);
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!season || season.seq <= seen.current) return;
    seen.current = season.seq;
    setShown({ ...season, left: roundsLeft(season, round) });
  }, [season, round]);

  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(null), SHOW_TIME);
    return () => clearTimeout(timer);
  }, [shown]);

  if (!shown) return null;
  return (
    <div className="season-banner-wrap">
      <div key={shown.seq} className={`season-banner ${shown.id}`} role="status" onClick={() => setShown(null)}>
        <div className="season-banner-icon">
          <SeasonIcon id={shown.id} />
        </div>
        <p className="season-eyebrow">
          <span aria-hidden="true">✦</span> Szezonesemény <span aria-hidden="true">✦</span>
        </p>
        <h3>{shown.name}</h3>
        <p className="season-text">{shown.text}</p>
        <p className="season-length">{shown.left} körig, mindenkire</p>
      </div>
    </div>
  );
}

// A futó esemény kis jelvénye a jobb oldali panelen: ikon, név, meddig tart; rámutatva a leírás.
export function SeasonChip({ season, round }) {
  if (!season) return null;
  const left = roundsLeft(season, round);
  return (
    <div className={`season-chip ${season.id}`} title={season.text}>
      <SeasonIcon id={season.id} />
      <span>
        <b>{season.name}</b>
        <small>{season.text}</small>
      </span>
      <em>{left > 1 ? `még ${left} kör` : 'utolsó kör'}</em>
    </div>
  );
}
