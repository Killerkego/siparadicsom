import { useEffect, useRef } from 'react';
import { play, playAt } from './sound';
import { CARD_TIME, DICE_TIME, JUMP_TIME, RACE_ROUND_TIME, STEP_TIME } from './timing';

// a játék felületein a gombnyomásra halk koppintás szól
const UI = '.game-panel, .decision-dialog, .card-bar, .roll-bar, .game-menu, .pick-card-anchor, .victory, .dev-panel';
// ezekhez a döntésekhez nincs külön hang (a kártyák már szólnak, amikor a kamera elé repülnek)
const QUIET_DECISIONS = new Set(['card', 'card_pick']);

// A játék hangjai. A mozgás hangjait (kocka, lépések, felvonó, kártya, síverseny) az animációval együtt
// ütemezi, így mindenkinél akkor szólnak, amikor a bábu lép. A saját pénz és építkezés, a csapda, az új
// szezonesemény és a „te jössz” a mozgás végén szól, amikor a felület is frissül (settled). A töltőképernyő
// alatt csend van.
export function useGameSounds({ game, playerId, timeline, ready }) {
  const { action, settled, phase } = timeline;

  // a mozgás hangjai, időzítve
  useEffect(() => {
    if (!action || !ready) return;
    const cancels = [];
    let t = action.start;
    if (action.dice) {
      cancels.push(playAt('dice', t));
      t += DICE_TIME;
    }
    for (const m of action.moves) {
      if (m.type === 'jump') {
        cancels.push(playAt('lift', t));
        t += JUMP_TIME;
      } else {
        for (let i = 1; i <= Math.abs(m.steps); i++) cancels.push(playAt('step', t + i * STEP_TIME - 60));
        t += Math.abs(m.steps) * STEP_TIME;
      }
    }
    if (action.card) {
      cancels.push(playAt('card', t));
      t += CARD_TIME;
    }
    if (action.race) {
      action.race.rounds.forEach((_, i) => cancels.push(playAt('dice', t + i * RACE_ROUND_TIME)));
      cancels.push(playAt('race', t + action.race.rounds.length * RACE_ROUND_TIME));
    }
    return () => cancels.forEach((cancel) => cancel());
  }, [action, ready]);

  // a mozgás végén: pénz, építkezés, csapda, „te jössz”
  const before = useRef(null);
  useEffect(() => {
    const me = settled.players.find((p) => p.id === playerId);
    const now = {
      money: me?.money ?? 0,
      mine: me?.buildings.length ?? 0,
      trap: settled.trap_event?.seq ?? 0,
      season: settled.season?.seq ?? 0,
      myTurn: settled.status === 'playing' && settled.turn_player_id === playerId,
    };
    const prev = before.current;
    before.current = now;
    if (!prev || !ready) return;
    // az építkezés hangja csak annál szól, aki épített (a vételár levonása helyett)
    if (now.mine > prev.mine) play('build');
    else if (now.money > prev.money) play('coin');
    else if (now.money < prev.money) play('pay');
    if (now.trap > prev.trap) play('trap');
    if (now.season > prev.season) play('season');
    else if (now.myTurn && !prev.myTurn) play('turn');
  }, [settled, playerId, ready]);

  // a saját döntés megnyílik a képernyő közepén
  const pending = phase === 'idle' && game.pending?.player_id === playerId ? game.pending : null;
  const pendingKey = pending && !QUIET_DECISIONS.has(pending.type) ? `${pending.type}-${game.last_action?.seq}` : null;
  useEffect(() => {
    if (pendingKey && ready) play('decision');
  }, [pendingKey, ready]);

  // halk koppintás a felületek gombjain
  useEffect(() => {
    const onClick = (e) => {
      const button = e.target.closest?.('button');
      if (button && !button.disabled && button.closest(UI)) play('click');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
}
