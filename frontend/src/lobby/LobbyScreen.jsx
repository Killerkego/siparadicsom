import { useState } from 'react';
import FigurePreview from '../game/FigurePreview';
import RulesButton from '../hud/Rules';
import { FIGURES } from '../game/figures';
import VisibilityToggle, { VisibilityIcon } from './VisibilityToggle';

// Lobbi: itt várnak a játékosok, amíg a házigazda el nem indítja a játékot
export default function LobbyScreen({
  game,
  playerId,
  onSetPublic,
  onAddBot,
  onRemoveBot,
  onPickFigure,
  onStart,
  onLeave,
}) {
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null); // melyik figura látszik nagyban (sorszám)
  const [copied, setCopied] = useState(false);

  // A vágólap API csak https-en és localhoston érhető el; helyi hálózati címen (http://192.168...)
  // a régi execCommand módszerrel másolunk.
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(game.code);
    } catch {
      const input = document.createElement('textarea');
      input.value = game.code;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const isHost = game.host_id === playerId;
  const enough = game.players.length >= game.min_players;
  const full = game.players.length >= game.max_players;

  const run = async (request) => {
    setError('');
    try {
      await request();
    } catch (e) {
      setError(e.message);
    }
  };
  const start = () => run(onStart);
  const me = game.players.find((p) => p.id === playerId);
  const ownerOf = (figure) => game.players.find((p) => p.figure === figure);

  return (
    <main className="page lobby-page">
      <div className="card lobby-card">
        <div className="lobby-heading">
          <img className="lobby-logo" src="/logo.png" alt="Aranyhegy Szálló" />
          <p className="lobby-eyebrow">
            <span aria-hidden="true">✦</span> VÁRÓTEREM
          </p>
          <h1>Gyülekező a völgyállomáson</h1>
        </div>

        <div className="code-box">
          <span>Játékkód</span>
          <strong>{game.code}</strong>
          <button className="copy-code" onClick={copyCode}>
            {copied ? '✔ Kimásolva' : 'Kód másolása'}
          </button>
        </div>
        {isHost ? (
          <VisibilityToggle value={game.public} onChange={(value) => run(() => onSetPublic(value))} />
        ) : (
          <p className="lobby-visibility">
            <VisibilityIcon isPublic={game.public} />{' '}
            {game.public ? 'Nyitott társaság: a listában is látszik.' : 'Zártkörű társaság: csak meghívókóddal lehet csatlakozni.'}
          </p>
        )}
        <p className="hint">
          {game.public
            ? 'A többiek a társaságok listájából vagy ezzel a kóddal csatlakozhatnak.'
            : 'Ezt a meghívókódot add meg a többi játékosnak, hogy csatlakozni tudjanak.'}
        </p>

        <h2 className="players-title">
          Játékosok
          <span className="player-count">
            {game.players.length} / {game.max_players} fő
          </span>
        </h2>
        <ul className="players">
          {game.players.map((p) => (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} />
              <span title={FIGURES[p.figure].name}>{FIGURES[p.figure].icon}</span>
              <span>{p.name}</span>
              {p.id === game.host_id && <span className="badge">házigazda</span>}
              {p.id === playerId && <span className="badge me">te</span>}
              {p.bot && <span className="badge bot">gépi</span>}
              {p.bot && isHost && (
                <button
                  className="remove-bot"
                  onClick={() => run(() => onRemoveBot(p.id))}
                  title={`${p.name} eltávolítása`}
                  aria-label={`${p.name} eltávolítása`}
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        {isHost && (
          <button className="add-bot" disabled={full} onClick={() => run(onAddBot)}>
            + Gépi játékos hozzáadása
          </button>
        )}

        <h2>Bábud</h2>
        <div className="figure-picker">
          {FIGURES.map((f, i) => {
            const owner = ownerOf(i);
            const mine = owner?.id === playerId;
            return (
              <div key={f.model} className="figure-card">
                <button
                  className={mine ? 'figure mine' : 'figure'}
                  disabled={!!owner}
                  onClick={() => run(() => onPickFigure(i))}
                  title={owner && !mine ? `${owner.name} választotta` : f.name}
                >
                  <span className="icon">{f.icon}</span>
                  <span>{f.name}</span>
                  <span className="owner">{mine ? 'a tiéd' : (owner?.name ?? 'szabad')}</span>
                </button>
                <button
                  className="figure-eye"
                  onClick={() => setPreview(i)}
                  title={`${f.name} megtekintése`}
                  aria-label={`${f.name} megtekintése`}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path
                      d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                    />
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
        {preview !== null && (
          <FigurePreview
            index={preview}
            color={ownerOf(preview)?.color ?? me?.color ?? '#d63031'}
            onClose={() => setPreview(null)}
          />
        )}
        {me && (
          <p className="hint">
            A bábud talpán lévő csík színe: <span className="dot" style={{ background: me.color }} />
          </p>
        )}

        {isHost ? (
          <>
            <button className="btn" disabled={!enough} onClick={start}>
              Játék indítása
            </button>
            {!enough && <p className="hint">Legalább {game.min_players} játékos kell az indításhoz.</p>}
          </>
        ) : (
          <p className="hint">Várakozás, hogy a házigazda elindítsa a játékot…</p>
        )}

        <RulesButton className="btn secondary rules-btn">Játékszabályok</RulesButton>

        <button className="btn secondary" onClick={onLeave}>
          Kilépés
        </button>

        {error && <p className="error">{error}</p>}
      </div>
    </main>
  );
}
