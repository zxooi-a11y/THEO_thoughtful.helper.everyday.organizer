// "THEO" with the acronym spelled out underneath; the T-H-E-O letters are highlighted.
export default function Logo({ compact = false }: { compact?: boolean }) {
  const a = (ch: string) => <b className="logo-hl">{ch}</b>;
  return (
    <div className={`logo${compact ? " compact" : ""}`}>
      <div className="logo-title">THEO</div>
      {!compact && (
        <div className="logo-sub">
          {a("T")}houghtful {a("H")}elper &amp; {a("E")}veryday {a("O")}rganizer
        </div>
      )}
    </div>
  );
}
