// A mozgások ütemezése. A szerver megadja, mikor történt a mozgás ("at"), és minden böngésző
// ehhez az időponthoz igazítja az animációt, így mindenkinél egyszerre fut. Ha egy fül közben a
// háttérben volt, visszaváltáskor ott folytatódik, ahol a többieknél tart.
// Az értékek egyezzenek a backend/config.py DICE_MS, STEP_MS, JUMP_MS, CARD_MS, RACE_ROUND_MS és
// RACE_RESULT_MS értékeivel.
export const DICE_TIME = 1200; // ms, amíg a kocka gurul
export const STEP_TIME = 300; // ms mezőnként
export const JUMP_TIME = 900; // ms, felvonós átugrás
export const CARD_TIME = 1300; // ms, amíg a húzott lap a kamera elé repül
export const RACE_ROUND_TIME = 2600; // ms, síverseny: egy dobási kör
export const RACE_RESULT_TIME = 2400; // ms, síverseny: a győztes kihirdetése
export const FIELD_COUNT = 40;

const wrap = (n) => ((n % FIELD_COUNT) + FIELD_COUNT) % FIELD_COUNT;
const moveTime = (m) => (m.type === 'jump' ? JUMP_TIME : Math.abs(m.steps) * STEP_TIME);

// a mozgás kezdete a böngésző órája szerint (ms)
export function actionStart(action, game) {
  return action.at - (game.server_time - game.received_at);
}

// a kártyahúzás kezdete: a kocka és a lépések után
export function cardStart(action, start) {
  return start + (action.dice ? DICE_TIME : 0) + action.moves.reduce((sum, m) => sum + moveTime(m), 0);
}

// a síverseny kezdete: a lépés (és az esetleges kártyahúzás) után
export function raceStart(action, start) {
  return cardStart(action, start) + (action.card ? CARD_TIME : 0);
}

export function raceTime(race) {
  return race ? race.rounds.length * RACE_ROUND_TIME + RACE_RESULT_TIME : 0;
}

export function actionEnd(action, start) {
  return raceStart(action, start) + raceTime(action.race);
}

// A bábu helyzete mozgás közben: melyik két mező között jár, és hol tart (p: 0..1).
// null, ha a mozgás véget ért; ekkor a bábu a szerver szerinti mezőn áll.
export function pawnState(action, start, now) {
  if (!action.moves.length) return null;
  let t = now - start - (action.dice ? DICE_TIME : 0);
  const first = action.moves[0].from;
  if (t < 0) return { from: first, to: first, p: 0, jump: false };
  for (const m of action.moves) {
    const duration = moveTime(m);
    if (t < duration) {
      if (m.type === 'jump') return { from: m.from, to: m.to, p: t / duration, jump: true };
      const s = t / STEP_TIME;
      const done = Math.floor(s);
      const a = wrap(m.from + Math.sign(m.steps) * done);
      return { from: a, to: wrap(a + Math.sign(m.steps)), p: s - done, jump: false };
    }
    t -= duration;
  }
  return null;
}

// melyik mezőn látszik a bábu (a panelhez és a kamerához)
export function shownField(player, action, now) {
  const state = action && action.player_id === player.id ? pawnState(action, action.start, now) : null;
  if (!state) return player.position;
  return state.p < 0.5 ? state.from : state.to;
}
