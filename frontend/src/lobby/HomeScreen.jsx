import { useState } from 'react';
import RulesButton from '../hud/Rules';
import Snowfall from './Snowfall';

// Kezdőlap: csak a név megadása; utána a társaságok oldala jön (új társaság, nyitott lista, csatlakozás kóddal)
export default function HomeScreen({ initialName = '', onContinue }) {
  const [name, setName] = useState(initialName);
  const hasName = name.trim().length > 0;

  return (
    <main className="page home-page">
      <div className="home-shell">
        <section className="home-visual" aria-labelledby="home-title">
          <img className="home-landscape" src="/alpine-winter.jpg" alt="" aria-hidden="true" />
          <Snowfall />
          <div className="home-brand">
            <p className="home-eyebrow"><span aria-hidden="true">✦</span> ALPESI ÜDÜLŐ · ÖTCSILLAGOS SZÁLLÓ <span aria-hidden="true">✦</span></p>
            <h1 id="home-title">Aranyhegy Szálló</h1>
            <p className="home-tagline">Öt csillag a felhők felett.</p>
          </div>
          <p className="home-caption">Találkozzunk a hegytetőn.</p>
        </section>

        <section className="card home-card" aria-labelledby="home-form-title">
          <div className="home-form-heading">
            <div className="home-crest">
              <img className="home-logo" src="/logo.png" alt="Aranyhegy Szálló" />
            </div>
            <p className="home-form-eyebrow"><span aria-hidden="true">✦</span> ÜDVÖZLÜNK A HEGYEN</p>
            <h2 id="home-form-title">Kezdd el a szezon tervezését.</h2>
            <p className="home-form-copy">Add meg a neved, utána indíthatsz egy társaságot, vagy csatlakozhatsz egyhez.</p>
          </div>

          <form
            className="home-name-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (hasName) onContinue(name.trim());
            }}
          >
            <label className="field">
              <span>Neved</span>
              <input
                value={name}
                maxLength={20}
                placeholder="pl. Anna"
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {!hasName && <p className="name-hint">A játékhoz előbb add meg a neved.</p>}
            <button type="submit" className="btn home-create" disabled={!hasName}>
              Tovább a társaságokhoz
            </button>
          </form>

          <RulesButton className="rules-link">Játékszabályok</RulesButton>
        </section>
      </div>
    </main>
  );
}
