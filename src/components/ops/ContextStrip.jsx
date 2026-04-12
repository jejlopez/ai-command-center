const fmtUsd = (n) => (n == null ? "$—" : `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString()}`);

export function ContextStrip({ mode, sales, trading, build }) {
  const salesSummary = (
    <span className="flex items-center gap-2">
      <span className="text-jarvis-muted">Sales</span>
      <span className="text-blue-400 font-medium">{sales?.followUpsDue ?? 0} follow-ups</span>
      <span className="text-jarvis-ghost">·</span>
      <span className="text-jarvis-body">${((sales?.pipelineValue ?? 0) / 1000).toFixed(0)}k pipeline</span>
    </span>
  );

  const tradingSummary = (
    <span className="flex items-center gap-2">
      <span className="text-jarvis-muted">Trading</span>
      <span className={`font-medium ${(trading?.plToday ?? 0) >= 0 ? "text-jarvis-success" : "text-jarvis-danger"}`}>
        {fmtUsd(trading?.plToday)} today
      </span>
      <span className="text-jarvis-ghost">·</span>
      <span className="text-jarvis-body">{trading?.openPositions ?? 0} open</span>
    </span>
  );

  const buildSummary = (
    <span className="flex items-center gap-2">
      <span className="text-jarvis-muted">Build</span>
      <span className="text-cyan-400 font-medium">{build?.shipsToday ?? 0} shipped</span>
      <span className="text-jarvis-ghost">·</span>
      <span className="text-jarvis-body">{build?.tasksPending ?? 0} tasks</span>
    </span>
  );

  return (
    <div className="flex items-center gap-4 px-6 py-1.5 border-t border-jarvis-border bg-jarvis-surface/30 shrink-0 text-[10px] overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {mode !== "sales"   && salesSummary}
      {mode !== "sales" && mode !== "trading" && <span className="text-jarvis-ghost select-none">|</span>}
      {mode !== "trading" && tradingSummary}
      {mode !== "build"   && <span className="text-jarvis-ghost select-none">|</span>}
      {mode !== "build"   && buildSummary}
    </div>
  );
}
