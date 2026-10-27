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
    <main className="page">
      <div className="card">
        <h1>Síparadicsom</h1>

        <label className="field">
          <span>Neved</span>
          <input value={name} maxLength={20} placeholder="pl. Anna" onChange={(e) => setName(e.target.value)} />
        </label>

        <button className="btn" disabled={!hasName || busy} onClick={() => run(() => onCreate(name))}>
          Új játék létrehozása
        </button>

        <div className="divider">vagy csatlakozz egy játékhoz</div>

        <form
          className="join"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => onJoin(code, name));
          }}
        >
          <input
            className="code-input"
            value={code}
            maxLength={6}
            placeholder="KÓD"
            aria-label="Játékkód"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button type="submit" className="btn secondary" disabled={!hasName || code.length !== 6 || busy}>
            Csatlakozás
          </button>
        </form>

        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
