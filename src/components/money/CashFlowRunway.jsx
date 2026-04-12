import { Plane } from "lucide-react";

export function CashFlowRunway({ data }) {
  const burn = data?.monthly_burn ?? 0;
  const pipeline = data?.pipeline ?? [];
  const expectedRevenue = pipeline.reduce((s, d) => s + (d.value ?? 0) * ((d.probability ?? 0) / 100), 0);
  const net = expectedRevenue - burn;
  const runway = burn > 0 && net < 0 ? (data?.cash_on_hand ?? 0) / burn : null;

  const maxBar = Math.max(burn, expectedRevenue, 1);
  const burnPct = Math.min((burn / maxBar) * 100, 100);
  const revPct = Math.min((expectedRevenue / maxBar) * 100, 100);

  const statusColor = net > 0 ? "text-jarvis-green" : net === 0 ? "text-jarvis-amber" : "text-jarvis-red";
  const barBurnColor = net < 0 ? "bg-jarvis-red" : "bg-jarvis-amber";
  const barRevColor = "bg-jarvis-green";

  if (!data) {
    return (
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-3"><Plane size={14} className="text-jarvis-cyan" /><span className="label">Cash Flow Runway</span></div>
        <p className="text-sm text-jarvis-muted">No financial data available yet.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4"><Plane size={14} className="text-jarvis-cyan" /><span className="label">Cash Flow Runway</span></div>
      {runway !== null && (
        <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-jarvis-border">
          <p className="text-xs text-jarvis-muted mb-1">At current pace</p>
          <p className={`text-2xl font-bold tabular-nums ${runway < 3 ? "text-jarvis-red" : runway < 6 ? "text-jarvis-amber" : "text-jarvis-green"}`}>
            {runway.toFixed(1)} <span className="text-sm font-normal">months runway</span>
          </p>
        </div>
      )}
      <div className="space-y-2">
        <BarRow label="Monthly Burn" value={burn} pct={burnPct} barColor={barBurnColor} prefix="-$" />
        <BarRow label="Expected Revenue" value={expectedRevenue} pct={revPct} barColor={barRevColor} prefix="+$" />
      </div>
      <div className="mt-3 pt-3 border-t border-jarvis-border flex items-center justify-between">
        <span className="text-xs text-jarvis-muted">Net / month</span>
        <span className={`text-sm font-semibold tabular-nums ${statusColor}`}>
          {net >= 0 ? "+" : ""}${net.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}

function BarRow({ label, value, pct, barColor, prefix }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-jarvis-muted">{label}</span>
        <span className="text-xs font-semibold text-jarvis-body tabular-nums">{prefix}${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
