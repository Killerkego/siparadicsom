import { useEffect, useState } from 'react';
import DecisionLayer from '../hud/DecisionLayer';
import DevPanel from '../hud/DevPanel';
import FieldStory from '../hud/FieldStory';
import GameMenu from '../hud/GameMenu';
import GamePanel from '../hud/GamePanel';
import LoadingScreen from '../hud/LoadingScreen';
import PlayerCards from '../hud/PlayerCards';
import RollBar from '../hud/RollBar';
import { SeasonBanner } from '../hud/Season';
import SkiRace from '../hud/SkiRace';
import TrapAlert from '../hud/TrapAlert';
import Victory from '../hud/Victory';
import ViewingBanner from '../hud/ViewingBanner';
import { fieldName, fields } from './format';
import GameScene from './GameScene';
import { useGameSounds } from './useGameSounds';
import { useGameTimeline } from './useGameTimeline';

// A játék képernyője: a 3D jelenet és fölötte a felületek (játékoskártyák, panel, középen a saját döntés,
// dobás sáv, játékkód és kilépés, fejlesztői fül, síverseny, a bevételi/kiadási mezők története, értesítés az elsült
// saját csapdáról, győzelem, a modellek betöltéséig a töltőképernyő).
// Itt dől el, ki mit tehet éppen; a szerver felé a kéréseket a `send` küldi, a hibát a panel mutatja.
export default function GameScreen({ game, playerId, onRoll, onRepay, onChoose, onLeave, onDevMove, onDevBuildAll, onDevSeason }) {
  const timeline = useGameTimeline(game);
  const { phase, settled, fieldOf } = timeline;
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [sceneReady, setSceneReady] = useState(false);
  useGameSounds({ game, playerId, timeline, ready: sceneReady });

  const busy = phase !== 'idle' || requesting;
  const myTurn = game.turn_player_id === playerId;
  const canRoll = myTurn && !busy && !game.pending;
  const canAckCard = game.pending?.type === 'card' && game.pending.player_id === playerId && !busy;
  const canPickCard = game.pending?.type === 'card_pick' && game.pending.player_id === playerId && !busy;
  // a saját döntés a mozgás végén nyílik meg, a képernyő közepén
  const myPending = phase === 'idle' && game.pending?.player_id === playerId ? game.pending : null;
  // mindenkinél a saját bábuja felé fordul a kamera; mások lépésére nem változik a nézet
  const me = game.players.find((p) => p.id === playerId);
  const side = Math.floor((me ? fieldOf(me) : 0) / 10);

  // kinek az építkezése látszik középen és a panelen: alapból a sajáté, a játékoskártyára kattintva másé;
  // ha a játékos kilépett, vagy nekünk kell építeni, visszaáll a sajátunkra
  const [viewing, setViewing] = useState(playerId);
  const viewed = settled.players.find((p) => p.id === viewing) ?? settled.players.find((p) => p.id === playerId);
  const viewedId = viewed?.id ?? playerId;
  useEffect(() => {
    if (myPending?.type === 'build') setViewing(playerId);
  }, [myPending?.type, playerId]);

  const send = async (request) => {
    setRequesting(true);
    setError('');
    try {
      await request();
    } catch (e) {
      setError(e.message);
    } finally {
      setRequesting(false);
    }
  };
  const roll = () => canRoll && send(onRoll);
  // önkéntes törlesztés: a saját körben, dobás előtt, ha van hitel és van miből
  const canRepay = canRoll && me?.loan > 0 && me.money > 0;
  const repay = () => canRepay && send(onRepay);
  const choose = (choice) => !busy && send(() => onChoose(choice));

  return (
    <>
      <GameScene
        game={game}
        playerId={playerId}
        timeline={timeline}
        side={side}
        canRoll={canRoll}
        onRoll={roll}
        canAckCard={canAckCard}
        onAckCard={() => choose('ok')}
        canPickCard={canPickCard}
        onPickCard={choose}
        viewedId={viewedId}
        onReady={() => setSceneReady(true)}
      />
      <PlayerCards
        players={settled.players}
        buildings={game.buildings}
        turnPlayerId={game.turn_player_id}
        playerId={playerId}
        viewedId={viewedId}
        onView={setViewing}
        ready={sceneReady}
        fieldLabel={(p) => fieldName(fields[fieldOf(game.players.find((g) => g.id === p.id) ?? p)])}
      />
      <GamePanel
        game={game}
        settled={settled}
        playerId={playerId}
        timeline={timeline}
        viewedId={viewedId}
        onView={setViewing}
        canRepay={canRepay}
        onRepay={repay}
        error={myPending ? '' : error}
      />
      {viewedId !== playerId && <ViewingBanner player={viewed} onBack={() => setViewing(playerId)} />}
      {myPending && (
        <DecisionLayer pending={myPending} game={game} me={me} busy={busy} error={error} onChoose={choose} />
      )}
      <RollBar
        game={game}
        playerId={playerId}
        phase={phase}
        drawing={timeline.drawing}
        canRoll={canRoll}
        onRoll={roll}
      />
      <GameMenu code={game.code} onLeave={onLeave} />
      {game.dev_mode && game.status === 'playing' && (
        <DevPanel
          game={game}
          me={me}
          canMove={canRoll}
          busy={busy}
          onMove={(field) => send(() => onDevMove(field))}
          onBuildAll={() => send(onDevBuildAll)}
          onSeason={(season) => send(() => onDevSeason(season))}
        />
      )}
      <SkiRace action={timeline.action} players={game.players} playerId={playerId} />
      <FieldStory event={settled.field_event} players={settled.players} playerId={playerId} />
      <SeasonBanner season={settled.season} round={settled.round} />
      <TrapAlert event={settled.trap_event} players={settled.players} rules={game.rules} playerId={playerId} />
      {/* a töltőképernyő után nyílik, hogy a konfetti szétrobbanása látsszon */}
      {game.status === 'finished' && phase === 'idle' && sceneReady && (
        <Victory game={game} playerId={playerId} onLeave={onLeave} />
      )}
      <LoadingScreen ready={sceneReady} />
    </>
  );
}
