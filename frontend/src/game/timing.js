// A dobás animációjának ütemezése. A szerver megadja, mikor történt a dobás ("at"), és minden
// böngésző ehhez az időponthoz igazítja az animációt, így mindenkinél egyszerre fut. Ha egy fül
// közben a háttérben volt, visszaváltáskor ott folytatódik, ahol a többieknél tart.
// Az értékek egyezzenek a backend/main.py DICE_MS és STEP_MS értékeivel.
export const DICE_TIME = 1200; // ms, amíg a kocka gurul
export const STEP_TIME = 300; // ms mezőnként
export const FIELD_COUNT = 40;

// a dobás kezdete a böngésző órája szerint (ms)
export function rollStart(roll, game) {
  return roll.at - (game.server_time - game.received_at);
}

export function rollEnd(roll, start) {
  return start + DICE_TIME + roll.value * STEP_TIME;
}

// melyik mezőn jár a dobó bábuja az adott pillanatban
export function fieldAt(roll, start, now) {
  const steps = Math.floor((now - start - DICE_TIME) / STEP_TIME);
  return (roll.from + Math.min(Math.max(steps, 0), roll.value)) % FIELD_COUNT;
}
