import { Shield, AlertTriangle } from "lucide-react";

export function MarginOfSafety({ positions = [], deals = [] }) {
  const positionDownside = positions
    .filter((p) => p.stop_price && p.entry_price && p.size)
    .map((p) => ({
      label: p.ticker ?? "Position",
      loss: Math.abs((p.entry_price - p.stop_price) * p.size),
      type: "trade",
    }));

  const dealDownside = deals
    .filter((d) => d.hours_invested)
    .map((d) => ({
      label: d.name ?? "Deal",
      loss: d.hours_invested,
      type: "deal",
    }));

  const allDownside = [...positionDownside, ...dealDownside];
  const totalDollarDownside = positionDownside.reduce((s, p) => s + p.loss, 0);
  const totalHoursDownside = dealDownside.reduce((s, d) => s + d.loss, 0);

  const empty = allDownside.length === 0;

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4"><Shield size={14} className="text-jarvis-cyan" /><span className="label">Margin of Safety</span></div>
      {empty ? (
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <Shield size={14} /><span>No significant downside exposure detected.</span>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {positionDownside.map((p, i) => (
              <Row key={i} label={p.label} value={`-$${p.loss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="text-jarvis-red" />
            ))}
            {dealDownside.map((d, i) => (
              <Row key={`d${i}`} label={d.label} value={`${d.loss}h invested`} color="text-jarvis-amber" />
            ))}
          </div>
          <div className="pt-3 border-t border-jarvis-border space-y-1">
            {totalDollarDownside > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-jarvis-muted">Total trade downside</span>
                <span className="font-semibold text-jarvis-red tabular-nums">-${totalDollarDownside.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
            )}
            {totalHoursDownside > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-jarvis-muted">Time at risk</span>
                <span className="font-semibold text-jarvis-amber tabular-nums">{totalHoursDownside}h</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
      <AlertTriangle size={12} className={color} />
      <span className="text-sm text-jarvis-body flex-1 truncate">{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
