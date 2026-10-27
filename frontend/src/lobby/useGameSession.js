import { useCallback, useEffect, useState } from 'react';
import { createGame, joinGame, leaveGame, rollDice, startGame } from './api';

// sessionStorage: oldalfrissítés után is megmarad, de böngészőfülenként külön játékos lehet
const STORAGE_KEY = 'siparadicsom-session';
const RECONNECT_DELAY = 2000;

function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

// A játékos melyik játékban van ({ code, playerId }), és a játék élő állapota a szervertől.
export function useGameSession() {
  const [session, setSession] = useState(loadSession);
  const [game, setGameState] = useState(null);
  const [retry, setRetry] = useState(0);

  // az érkezés ideje a server_time-mal együtt megadja, mennyit tér el a böngésző órája a szerverétől
  const setGame = useCallback((state) => setGameState(state && { ...state, received_at: Date.now() }), []);

  const saveSession = useCallback((s) => {
    if (s) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(STORAGE_KEY);
    setSession(s);
    if (!s) setGame(null);
  }, [setGame]);

  // WebSocketen érkezik minden változás (új játékos, kilépés, indítás)
  useEffect(() => {
    if (!session) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(
      `${protocol}://${location.host}/ws/games/${session.code}?player_id=${encodeURIComponent(session.playerId)}`,
    );
    let closedByUs = false;
    ws.onmessage = (e) => setGame(JSON.parse(e.data));
    ws.onclose = (e) => {
      if (closedByUs) return;
      if (e.code === 4404) saveSession(null); // a játék vagy a játékos már nem létezik
      else setTimeout(() => setRetry((r) => r + 1), RECONNECT_DELAY);
    };
    return () => {
      closedByUs = true;
      ws.close();
    };
  }, [session, retry, saveSession, setGame]);

  const enter = (result) => {
    setGame(result.game);
    saveSession({ code: result.game.code, playerId: result.player_id });
  };

  return {
    session,
    game,
    create: async (name) => enter(await createGame(name)),
    join: async (code, name) => enter(await joinGame(code, name)),
    // a válaszból azonnal frissül, nem kell megvárni a WebSocket üzenetet
    start: async () => setGame(await startGame(session.code, session.playerId)),
    roll: async () => setGame(await rollDice(session.code, session.playerId)),
    leave: async () => {
      await leaveGame(session.code, session.playerId).catch(() => {});
      saveSession(null);
    },
  };
}
