import { useState } from 'react';
import GameScreen from './game/GameScreen';
import LoadingScreen from './hud/LoadingScreen';
import HomeScreen from './lobby/HomeScreen';
import LobbyBrowser from './lobby/LobbyBrowser';
import LobbyScreen from './lobby/LobbyScreen';
import { useGameSession } from './lobby/useGameSession';

// Kezdőlap (név) -> lobbik oldala (új lobbi, nyilvános lista, kóddal belépés) -> lobbi -> játéktábla,
// a szerveren tárolt játékállapot alapján
export default function App() {
  const {
    session,
    game,
    name,
    setName,
    create,
    join,
    setPublic,
    addBot,
    removeBot,
    pickFigure,
    start,
    roll,
    repay,
    choose,
    leave,
    devMove,
    devBuildAll,
    devSeason,
  } = useGameSession();
  const [editingName, setEditingName] = useState(false);

  if (!session) {
    if (!name || editingName) {
      return (
        <HomeScreen
          initialName={name}
          onContinue={(value) => {
            setName(value);
            setEditingName(false);
          }}
        />
      );
    }
    return <LobbyBrowser name={name} onChangeName={() => setEditingName(true)} onCreate={create} onJoin={join} />;
  }
  if (!game) return <LoadingScreen waiting message="Kapcsolódás a játékhoz…" />;
  if (game.status === 'lobby') {
    return (
      <LobbyScreen
        game={game}
        playerId={session.playerId}
        onSetPublic={setPublic}
        onAddBot={addBot}
        onRemoveBot={removeBot}
        onPickFigure={pickFigure}
        onStart={start}
        onLeave={leave}
      />
    );
  }
  return (
    <GameScreen
      game={game}
      playerId={session.playerId}
      onRoll={roll}
      onRepay={repay}
      onChoose={choose}
      onLeave={leave}
      onDevMove={devMove}
      onDevBuildAll={devBuildAll}
      onDevSeason={devSeason}
    />
  );
}
