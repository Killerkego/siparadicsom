// a napló utolsó néhány bejegyzése, a legfrissebb felül
export default function GameLog({ log, count = 4 }) {
  if (!log.length) return null;
  return (
    <ul className="log">
      {log
        .slice(-count)
        .reverse()
        .map((text, i) => (
          <li key={log.length - i}>{text}</li>
        ))}
    </ul>
  );
}
