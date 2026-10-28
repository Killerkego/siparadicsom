// a húzott kártya elfogadása (a kártyák tartalma később jön)
export default function CardDecision({ busy, onChoose }) {
  return (
    <div className="decision">
      <b>Kártyát húztál</b>
      <p>A kártyák tartalma hamarosan jön. Fogadd el a lapot (gombbal vagy a lapra kattintva).</p>
      <div className="choices">
        <button disabled={busy} onClick={() => onChoose('ok')}>
          Rendben
        </button>
      </div>
    </div>
  );
}
