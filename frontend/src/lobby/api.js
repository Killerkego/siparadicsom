// A Python backend hívásai. Fejlesztés közben a Vite továbbítja az /api kéréseket a backendnek.
async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Hibás adat vagy nem elérhető a szerver.');
  }
  return data;
}

export const createGame = (name) => request('POST', '/games', { name });
export const joinGame = (code, name) => request('POST', `/games/${code}/join`, { name });
export const startGame = (code, playerId) => request('POST', `/games/${code}/start`, { player_id: playerId });
export const leaveGame = (code, playerId) => request('POST', `/games/${code}/leave`, { player_id: playerId });
