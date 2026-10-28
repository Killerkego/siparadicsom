// Nyitott vagy zártkörű társaság (a kódban: nyilvános / privát lobbi): kétgombos kapcsoló a magyarázattal
// (társaságok oldala és lobbi), és a két fajta ikonja.

// felvonókabin a kötélen: bárki beszállhat
function GondolaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="visibility-icon">
      <path d="M2 5.5 22 2.5" />
      <path d="M12 4v4" />
      <rect x="5" y="8" width="14" height="12.5" rx="3" />
      <rect x="8" y="11" width="8" height="4" rx="1" />
      <path d="M5 17.5h14" />
    </svg>
  );
}

// régi szállodai szobakulcs: csak a meghívottak jöhetnek
function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="visibility-icon">
      <circle cx="6.5" cy="12" r="3.8" />
      <circle cx="6.5" cy="12" r="1.3" />
      <path d="M10.3 12H21.5" />
      <path d="M17 12v3.2M20.2 12v2.4" />
    </svg>
  );
}

export function VisibilityIcon({ isPublic }) {
  return isPublic ? <GondolaIcon /> : <KeyIcon />;
}

const OPTIONS = [
  { value: true, label: 'Nyitott', hint: 'Bárki láthatja a társaságok listájában, és egy kattintással csatlakozhat.' },
  { value: false, label: 'Zártkörű', hint: 'Nem látszik a listában, csak a meghívókóddal lehet csatlakozni.' },
];

export default function VisibilityToggle({ value, onChange, disabled }) {
  const current = OPTIONS.find((o) => o.value === value);
  return (
    <div className="visibility">
      <div className="visibility-options" role="radiogroup" aria-label="Ki csatlakozhat?">
        {OPTIONS.map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={o.value === value ? 'active' : ''}
            disabled={disabled}
            onClick={() => o.value !== value && onChange(o.value)}
          >
            <VisibilityIcon isPublic={o.value} /> {o.label}
          </button>
        ))}
      </div>
      <p className="visibility-hint">{current.hint}</p>
    </div>
  );
}
