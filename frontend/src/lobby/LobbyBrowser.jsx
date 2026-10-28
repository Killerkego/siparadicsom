import { useState } from 'react';
import PublicLobbies from './PublicLobbies';
import VisibilityToggle from './VisibilityToggle';

// A társaságok oldala (a kódban: lobbik) a név megadása után: új társaság (nyitott vagy zártkörű), a nyitott
// társaságok listája és csatlakozás zártkörűhöz a meghívókóddal.
export default function LobbyBrowser({ name, onChangeName, onCreate, onJoin }) {
  const [code, setCode] = useState('');
  const [isPublic, setIsPublic] = useState(true);
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

  return (
    <main className="page lobby-page">
      <div className="card lobby-card lobby-browser">
        <div className="lobby-heading">
          <img className="lobby-logo" src="/logo.png" alt="Aranyhegy Szálló" />
          <p className="lobby-eyebrow">
            <span aria-hidden="true">✦</span> TÁRSASÁGOK
          </p>
          <h1>Kivel indulsz a hegyre?</h1>
        </div>

        <p className="lobby-browser-name">
          Belépve mint <b>{name}</b>
          <button className="link-button" onClick={onChangeName} disabled={busy}>
            Név módosítása
          </button>
        </p>

        <section className="lobby-browser-section">
          <h2>Új társaság</h2>
          <VisibilityToggle value={isPublic} onChange={setIsPublic} disabled={busy} />
          <button className="btn" disabled={busy} onClick={() => run(() => onCreate(name, isPublic))}>
            {isPublic ? 'Nyitott társaság indítása' : 'Zártkörű társaság indítása'}
          </button>
        </section>

        <section className="lobby-browser-section">
          <PublicLobbies busy={busy} onJoin={(lobbyCode) => run(() => onJoin(lobbyCode, name))} />
        </section>

        <section className="lobby-browser-section">
          <h2>Csatlakozás meghívókóddal</h2>
          <p className="hint">Zártkörű társasághoz a házigazdától kapott kóddal csatlakozhatsz.</p>
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
              placeholder="JÁTÉKKÓD"
              aria-label="Játékkód"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button type="submit" className="btn secondary" disabled={code.length !== 6 || busy}>
              Csatlakozás
            </button>
          </form>
        </section>

        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
