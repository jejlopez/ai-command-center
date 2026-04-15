export function ScoreZone({ score, whale, breakdown, labels = { score: "Score", whale: "Whale" } }) {
  const scoreColor = score >= 70 ? "text-jarvis-success" : score >= 40 ? "text-jarvis-warning" : "text-jarvis-danger";
  const whaleColor = whale >= 70 ? "text-cyan-400" : whale >= 40 ? "text-jarvis-warning" : "text-jarvis-muted";

  return (
    <div className="flex gap-5 items-end">
      <div>
        <div className="text-[8px] text-jarvis-muted uppercase tracking-[0.12em]">{labels.score}</div>
        <div className={`text-xl font-display font-bold tabular-nums ${scoreColor}`}>{score ?? "—"}</div>
      </div>
      <div>
        <div className="text-[8px] text-jarvis-muted uppercase tracking-[0.12em]">{labels.whale}</div>
        <div className={`text-xl font-display font-bold tabular-nums ${whaleColor}`}>{whale ?? "—"}</div>
      </div>
      {breakdown && (
        <div className="flex-1 text-[9px] text-jarvis-muted leading-relaxed">
          {Object.entries(breakdown).map(([k, v]) => (
            <span key={k} className="mr-2">{k.replace(/_/g, " ")} {v}</span>
          ))}
        </div>
      )}
    </div>
  );
}
