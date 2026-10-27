// A Python backend hívásai. Fejlesztés közben a Vite továbbítja az /api kéréseket a backendnek.
const OFFLINE = 'A szerver nem érhető el. Fut a backend (backend/main.py)?';

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(OFFLINE);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (typeof data.detail === 'string') throw new Error(data.detail);
    throw new Error(res.status >= 500 ? OFFLINE : 'Hibás adat.');
  }
  return data;
}

export const createGame = (name) => request('POST', '/games', { name });
export const joinGame = (code, name) => request('POST', `/games/${code}/join`, { name });
export const startGame = (code, playerId) => request('POST', `/games/${code}/start`, { player_id: playerId });
export const rollDice = (code, playerId) => request('POST', `/games/${code}/roll`, { player_id: playerId });
export const chooseOption = (code, playerId, choice) =>
  request('POST', `/games/${code}/choose`, { player_id: playerId, choice });
export const leaveGame =(code, playerId) => request('POST', `/games/${code}/leave`, { player_id: playerId });
