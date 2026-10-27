import GameScreen from './game/GameScreen';
import HomeScreen from './lobby/HomeScreen';
import LobbyScreen from './lobby/LobbyScreen';
import { useGameSession } from './lobby/useGameSession';

// Kezdőlap -> lobbi -> játéktábla, a szerveren tárolt játékállapot alapján
export default function App() {
  const { session, game, create, join, pickFigure, start, roll, choose, leave, devMove, devBuildAll } = useGameSession();

  if (!session) return <HomeScreen onCreate={create} onJoin={join} />;
  if (!game) {
    return (
      <main className="page">
        <div className="card">Kapcsolódás a játékhoz…</div>
      </main>
    );
  }
  if (game.status === 'lobby') {
    return (
      <LobbyScreen game={game} playerId={session.playerId} onPickFigure={pickFigure} onStart={start} onLeave={leave} />
    );
  }
  return (
    <GameScreen
      game={game}
      playerId={session.playerId}
      onRoll={roll}
      onChoose={choose}
      onLeave={leave}
      onDevMove={devMove}
      onDevBuildAll={devBuildAll}
    />
  );
}
