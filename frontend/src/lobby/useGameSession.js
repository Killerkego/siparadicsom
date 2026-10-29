import { useCallback, useEffect, useState } from 'react';
import {
  addBot,
  chooseFigure,
  chooseOption,
  createGame,
  devBuildAll,
  devSeason,
  devMove,
  joinGame,
  leaveGame,
  removeBot,
  repayLoan,
  rollDice,
  setVisibility,
  startGame,
} from './api';

// sessionStorage: oldalfrissítés után is megmarad, de böngészőfülenként külön játékos lehet
const STORAGE_KEY = 'siparadicsom-session';
const NAME_KEY = 'siparadicsom-name'; // a kezdőlapon megadott név; a lobbik oldala és kilépés után is megmarad
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
  const [name, setNameState] = useState(() => sessionStorage.getItem(NAME_KEY) ?? '');
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

  const setName = (value) => {
    sessionStorage.setItem(NAME_KEY, value);
    setNameState(value);
  };

  return {
    session,
    game,
    name,
    setName,
    create: async (name, isPublic) => enter(await createGame(name, isPublic)),
    join: async (code, name) => enter(await joinGame(code, name)),
    // a válaszból azonnal frissül, nem kell megvárni a WebSocket üzenetet
    setPublic: async (isPublic) => setGame(await setVisibility(session.code, session.playerId, isPublic)),
    addBot: async () => setGame(await addBot(session.code, session.playerId)),
    removeBot: async (botId) => setGame(await removeBot(session.code, session.playerId, botId)),
    pickFigure: async (figure) => setGame(await chooseFigure(session.code, session.playerId, figure)),
    start: async () => setGame(await startGame(session.code, session.playerId)),
    roll: async () => setGame(await rollDice(session.code, session.playerId)),
    repay: async () => setGame(await repayLoan(session.code, session.playerId)),
    choose: async (choice) => setGame(await chooseOption(session.code, session.playerId, choice)),
    devMove: async (field) => setGame(await devMove(session.code, session.playerId, field)),
    devBuildAll: async () => setGame(await devBuildAll(session.code, session.playerId)),
    devSeason: async (season) => setGame(await devSeason(session.code, session.playerId, season)),
    leave: async () => {
      await leaveGame(session.code, session.playerId).catch(() => {});
      saveSession(null);
    },
  };
}
