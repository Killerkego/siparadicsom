import { useEffect, useMemo, useRef, useState } from 'react';
import { DICE_TIME, actionEnd, actionStart, cardStart, shownField } from './timing';

// A játék időbeli állapota a böngészőben. Az utolsó mozgás a szerver órája szerinti időpontban indult;
// ezt mozgásonként egyszer számoljuk át a böngésző órájára, így minden böngészőben egyszerre fut a kocka,
// a bábu és a kártyahúzás animációja.
//   phase: idle -> rolling (kocka gurul) -> moving (bábu lép, felvonózik, kártyát húz) -> idle
//   settled: a játékállapot a mozgás végén (pénz, napló, épületek), hogy semmi ne derüljön ki előre
export function useGameTimeline(game) {
  const last = game.last_action;
  const action = useMemo(() => last && { ...last, start: actionStart(last, game) }, [last?.seq]);
  const end = action ? actionEnd(action, action.start) : 0;

  // amíg tart a mozgás, a felület az időt követi
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!action) return;
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= end) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [action, end]);

  let phase = 'idle';
  if (action && now < end) phase = action.dice && now < action.start + DICE_TIME ? 'rolling' : 'moving';
  const drawing = phase === 'moving' && action.card && now >= cardStart(action, action.start);

  const [settled, setSettled] = useState(game);
  useEffect(() => {
    if (phase === 'idle') setSettled(game);
  }, [phase, game]);

  const diceRoll = useMemo(
    () => action?.dice && { value: action.dice, seq: action.seq, start: action.start },
    [action],
  );
  // az utolsó kártyahúzás (a lap azonosítójával); megmarad a következő mozgás alatt is, pl. ha a lap
  // maga mozgatja a bábut, hogy a kamera előtti lap ne tűnjön el hirtelen
  const lastDraw = useRef(null);
  if (action?.card && lastDraw.current?.seq !== action.seq) {
    lastDraw.current = { seq: action.seq, start: cardStart(action, action.start), card: action.card };
  }
  const cardDraw = lastDraw.current;

  // a mozgó bábu az animáció szerinti mezőn látszik, a többiek a szerver szerinti helyükön
  const fieldOf = (player) => shownField(player, action, now);

  return { action, phase, drawing, settled, diceRoll, cardDraw, fieldOf };
}
