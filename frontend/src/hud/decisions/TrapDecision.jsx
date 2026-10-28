import { hk } from '../../game/format';

// csapda: milyen csapdát rak le a játékos a következő idelépőnek
export default function TrapDecision({ rules, busy, onChoose }) {
  return (
    <div className="decision">
      <b>Csapda</b>
      <p>Rakj csapdát! Aki legközelebb ide lép, azt ezzel szívatod meg:</p>
      <div className="choices">
        <button disabled={busy} onClick={() => onChoose('back')}>
          {rules.trap_back} mező vissza
        </button>
        <button disabled={busy} onClick={() => onChoose('money')}>
          {hk(rules.trap_money)} nekem
        </button>
      </div>
    </div>
  );
}
