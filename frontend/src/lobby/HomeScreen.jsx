import { useState } from 'react';

// Kezdőlap: új játék létrehozása vagy csatlakozás egy meglévőhöz a kódjával
export default function HomeScreen({ onCreate, onJoin }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const hasName = name.trim().length > 0;

  return (
    <main className="page home-page">
      <div className="home-shell">
        <section className="home-visual" aria-labelledby="home-title">
          <img className="home-landscape" src="/alpine-winter.jpg" alt="" aria-hidden="true" />
          <div className="home-brand">
            <p className="home-eyebrow"><span aria-hidden="true">✦</span> ALPINE CLUB · AURELIA RESORT <span aria-hidden="true">✦</span></p>
            <h1 id="home-title">Síparadicsom</h1>
            <p className="home-tagline">Öt csillag a felhők felett.</p>
          </div>
          <p className="home-caption">Találkozzunk a hegytetőn.</p>
        </section>

        <section className="card home-card" aria-labelledby="home-form-title">
          <div className="home-form-heading">
            <p className="home-form-eyebrow"><span aria-hidden="true">✦</span> ÜDVÖZLÜNK A HEGYEN</p>
            <h2 id="home-form-title">Kezdd el a szezon tervezését.</h2>
            <p className="home-form-copy">Add meg a neved, és indulhat a közös játék.</p>
          </div>

          <label className="field">
            <span>Neved</span>
            <input value={name} maxLength={20} placeholder="pl. Anna" onChange={(e) => setName(e.target.value)} />
          </label>

          <button className="btn home-create" disabled={!hasName || busy} onClick={() => run(() => onCreate(name))}>
            Új játék létrehozása
          </button>

          <div className="divider">vagy csatlakozz egy játékhoz</div>

          <form
            className="join home-join"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => onJoin(code, name));
            }}
          >
            <input
              className="code-input"
              value={code}
              maxLength={6}
              placeholder="JÁTÉKKÓD"
              aria-label="Játékkód"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button type="submit" className="btn secondary" disabled={!hasName || code.length !== 6 || busy}>
              Csatlakozás
            </button>
          </form>

          {error && <p className="error">{error}</p>}
        </section>
      </div>
    </main>
  );
}
