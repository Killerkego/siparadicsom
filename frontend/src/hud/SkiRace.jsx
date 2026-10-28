import { useEffect, useState } from 'react';
import { FIGURES } from '../game/figures';
import { hk } from '../game/format';
import { usePortraits } from '../game/portraits';
import { RACE_ROUND_TIME, raceStart, raceTime } from '../game/timing';

const ROLL_TIME = 1500; // ms, ennyi ideig gurulnak a kockák egy körben; utána látszik, ki dobta a legtöbbet

// a kocka lapjai: melyik érték hol van, és hogyan kell fordítani a kockát, hogy az nézzen előre
const FACES = [
  { value: 1, transform: 'rotateY(0deg)' },
  { value: 6, transform: 'rotateY(180deg)' },
  { value: 2, transform: 'rotateY(90deg)' },
  { value: 5, transform: 'rotateY(-90deg)' },
  { value: 3, transform: 'rotateX(90deg)' },
  { value: 4, transform: 'rotateX(-90deg)' },
];
const SHOW = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] }; // [X, Y] fok
// a pöttyök helye a 3x3-as rácson
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

const easeOut = (t) => 1 - (1 - t) ** 3;

// Egy dobókocka: gurulás közben pörög és pattog, a végén a dobott értékkel előre áll meg.
function Die({ value, t, color, spin }) {
  const e = easeOut(Math.min(1, t));
  const [x, y] = SHOW[value];
  const rx = x + (1 - e) * spin[0] * 360;
  const ry = y + (1 - e) * spin[1] * 360;
  const hop = t < 1 ? Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 18 : 0;
  return (
    <div className="race-die-stage" style={{ transform: `translateY(${-hop}px)` }}>
      <div className="race-die" style={{ transform: `rotateX(${rx}deg) rotateY(${ry}deg)`, '--die-color': color }}>
        {FACES.map((f) => (
          <div key={f.value} className="race-die-face" style={{ transform: `${f.transform} translateZ(var(--half))` }}>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={PIPS[f.value].includes(i) ? 'pip' : 'pip empty'} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Síverseny: a versenymezőre lépés után mindenki dob a saját kockájával; döntetlennél az élen állók
// újra dobnak, a végén kiderül a győztes. A szerver előre sorsolt, itt csak lejátsszuk, mindenkinél
// ugyanabban az időben (a mozgás kezdetéhez igazítva).
export default function SkiRace({ action, players, playerId }) {
  const race = action?.race;
  const start = race ? raceStart(action, action.start) : 0;
  const end = start + raceTime(race);
  const [now, setNow] = useState(Date.now);
  const portraits = usePortraits(true);

  useEffect(() => {
    if (!race) return;
    let frame;
    const tick = () => {
      setNow(Date.now());
      if (Date.now() < end) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [race, end]);

  if (!race || now < start || now >= end) return null;

  const elapsed = now - start;
  const finished = elapsed >= race.rounds.length * RACE_ROUND_TIME;
  const roundIndex = Math.min(race.rounds.length - 1, Math.floor(elapsed / RACE_ROUND_TIME));
  const inRound = finished ? RACE_ROUND_TIME : elapsed - roundIndex * RACE_ROUND_TIME;
  const rolling = inRound < ROLL_TIME;
  const round = race.rounds[roundIndex];
  const best = Math.max(...round.map((r) => r.value));
  const leaders = round.filter((r) => r.value === best);
  const nameOf = (id) => (id === playerId ? 'Te' : (players.find((p) => p.id === id)?.name ?? '?'));

  // minden játékos utolsó dobása: aki már kiesett, az előző körös értékével, halványan látszik
  const lastRoll = {};
  race.rounds.slice(0, roundIndex + 1).forEach((rnd, i) => rnd.forEach((r) => (lastRoll[r.player_id] = { ...r, round: i })));

  let caption = `${roundIndex + 1}. kör – mindenki dob!`;
  if (roundIndex > 0) caption = `Újradobás: ${round.map((r) => nameOf(r.player_id)).join(', ')}`;
  if (!rolling && !finished) {
    caption =
      leaders.length > 1
        ? `Döntetlen! ${leaders.map((r) => nameOf(r.player_id)).join(' és ')} újra dob…`
        : `${nameOf(leaders[0].player_id)} dobta a legtöbbet!`;
  }
  const winner = players.find((p) => p.id === race.winner_id);

  return (
    <div className="race-overlay" aria-live="polite">
      <div className="race-card">
        <p className="decision-eyebrow">
          <span aria-hidden="true">✦</span> Síverseny <span aria-hidden="true">✦</span>
        </p>
        <h2>{finished ? 'Megvan a győztes!' : 'Ki ér le elsőként?'}</h2>
        <div className="race-lanes">
          {players
            .filter((p) => lastRoll[p.id])
            .map((p, index) => {
              const roll = lastRoll[p.id];
              const active = roll.round === roundIndex;
              const isWinner = finished && p.id === race.winner_id;
              const isBest = !rolling && active && roll.value === best;
              const t = active && !finished ? inRound / ROLL_TIME : 1;
              const classes = ['race-lane', !active && 'out', isBest && 'best', isWinner && 'winner'];
              return (
                <div key={p.id} className={classes.filter(Boolean).join(' ')} style={{ '--player': p.color }}>
                  <div className="race-portrait" title={FIGURES[p.figure].name}>
                    {portraits[p.figure] ? <img src={portraits[p.figure]} alt="" /> : <span>{FIGURES[p.figure].icon}</span>}
                  </div>
                  <span className="race-name">{p.id === playerId ? `${p.name} (te)` : p.name}</span>
                  <Die value={roll.value} t={t} color={p.color} spin={[2 + (index % 2), 3 - (index % 2)]} />
                  <span className="race-value">{active && rolling && !finished ? '…' : roll.value}</span>
                </div>
              );
            })}
        </div>
        <p className={finished ? 'race-caption result' : 'race-caption'}>
          {finished
            ? `🏆 ${race.winner_id === playerId ? 'Te nyerted' : `${winner?.name ?? '?'} nyerte`} a síversenyt! +${hk(race.prize)}`
            : caption}
        </p>
      </div>
    </div>
  );
}
