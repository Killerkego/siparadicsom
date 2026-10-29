// Fent középen, a játékkód alatt: kinek az építkezését nézzük éppen a tábla közepén, és vissza a sajátunkhoz.
export default function ViewingBanner({ player, onBack }) {
  if (!player) return null;
  return (
    <div className="viewing-banner" style={{ '--player': player.color }}>
      <span className="turn-dot" />
      <span>
        <b>{player.name}</b> építkezését nézed
      </span>
      <button onClick={onBack}>Vissza a sajátomhoz</button>
    </div>
  );
}
