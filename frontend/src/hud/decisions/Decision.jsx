import BuildDecision from './BuildDecision';
import CardDecision from './CardDecision';
import CardPickDecision from './CardPickDecision';
import GambleDecision from './GambleDecision';
import LiftDecision from './LiftDecision';
import TrapDecision from './TrapDecision';

// a várakozó döntés neve (a többi játékos ezt látja: „Anna dönt… (Felvonó)”)
export const DECISION_NAMES = { gamble: 'Gambling', lift: 'Felvonó', trap: 'Csapda', build: 'Építkezés', card: 'Kártya', card_pick: 'Jósnő' };

const DECISIONS = {
  build: BuildDecision,
  card: CardDecision,
  card_pick: CardPickDecision,
  gamble: GambleDecision,
  lift: LiftDecision,
  trap: TrapDecision,
};

// a szervertől kapott `pending` döntés gombjai; csak annál látszik, akinek döntenie kell
export default function Decision({ pending, ...props }) {
  const Component = DECISIONS[pending.type];
  return Component ? <Component pending={pending} {...props} /> : null;
}
