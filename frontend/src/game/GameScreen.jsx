import { useState } from 'react';
import DecisionLayer from '../hud/DecisionLayer';
import DevPanel from '../hud/DevPanel';
import GameMenu from '../hud/GameMenu';
import GamePanel from '../hud/GamePanel';
import LoadingScreen from '../hud/LoadingScreen';
import PlayerCards from '../hud/PlayerCards';
import RollBar from '../hud/RollBar';
import Victory from '../hud/Victory';
import { fieldName, fields } from './format';
import GameScene from './GameScene';
import { useGameTimeline } from './useGameTimeline';

// A játék képernyője: a 3D jelenet és fölötte a felületek (játékoskártyák, panel, középen a saját döntés,
// dobás sáv, játékkód és kilépés, fejlesztői fül, győzelem, a modellek betöltéséig a töltőképernyő).
// Itt dől el, ki mit tehet éppen; a szerver felé a kéréseket a `send` küldi, a hibát a panel mutatja.
export default function GameScreen({ game, playerId, onRoll, onChoose, onLeave, onDevMove, onDevBuildAll }) {
  const timeline = useGameTimeline(game);
  const { phase, settled, fieldOf } = timeline;
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [sceneReady, setSceneReady] = useState(false);

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
        onReady={() => setSceneReady(true)}
      />
      <PlayerCards
        players={settled.players}
        buildings={game.buildings}
        turnPlayerId={game.turn_player_id}
        playerId={playerId}
        ready={sceneReady}
        fieldLabel={(p) => fieldName(fields[fieldOf(game.players.find((g) => g.id === p.id) ?? p)])}
      />
      <GamePanel
        game={game}
        settled={settled}
        playerId={playerId}
        timeline={timeline}
        error={myPending ? '' : error}
      />
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
        />
      )}
      {game.status === 'finished' && phase === 'idle' && <Victory game={game} playerId={playerId} onLeave={onLeave} />}
      <LoadingScreen ready={sceneReady} />
    </>
  );
}
