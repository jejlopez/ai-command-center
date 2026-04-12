import { TrendingUp, TrendingDown } from "lucide-react";

const STAGE_LABELS = {
  prospect_to_quoted: "Prospect → Quoted",
  quoted_to_negotiating: "Quoted → Negotiating",
  negotiating_to_closed: "Negotiating → Closed",
};

function VelocityBar({ label, days, maxDays, isBottleneck }) {
  const pct = maxDays > 0 ? Math.min(100, (days / maxDays) * 100) : 0;
  return (
    <div className={`mb-3 ${isBottleneck ? "opacity-100" : "opacity-80"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-[11px] ${isBottleneck ? "text-jarvis-red font-semibold" : "text-jarvis-body"}`}>
          {label}
          {isBottleneck && <span className="ml-1 chip text-jarvis-red">Bottleneck</span>}
        </span>
        <span className="text-[11px] text-jarvis-ink tabular-nums font-semibold">{days}d</span>
      </div>
      <div className="h-2 bg-jarvis-panel/60 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isBottleneck ? "bg-jarvis-red/60" : "bg-jarvis-cyan/50"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DealVelocity({ dealVelocity }) {
  if (!dealVelocity || Object.keys(dealVelocity).length === 0) {
    return (
      <div className="glass p-6 border border-jarvis-border">
        <div className="label">Deal Velocity</div>
        <p className="text-sm text-jarvis-muted mt-2">Close your first deal to see velocity metrics.</p>
      </div>
    );
  }

  const {
    avg_days = {},
    vs_last_30d_days = 0,
    bottleneck_stage = null,
    deals_closed_30d = 0,
    win_rate_30d = 0,
  } = dealVelocity;

  const stageEntries = Object.entries(STAGE_LABELS).map(([key, label]) => ({
    key,
    label,
    days: avg_days[key] ?? 0,
  }));
  const maxDays = Math.max(...stageEntries.map((e) => e.days), 1);
  const totalCycle = avg_days.total_cycle ?? 0;
  const trendIsGood = vs_last_30d_days <= 0;

  return (
    <div className="glass p-6 border border-jarvis-border">
      <div className="label mb-4">Deal Velocity</div>

      {stageEntries.map((entry) => (
        <VelocityBar
          key={entry.key}
          label={entry.label}
          days={entry.days}
          maxDays={maxDays}
          isBottleneck={bottleneck_stage === entry.key}
        />
      ))}

      <div className="mt-4 pt-3 border-t border-jarvis-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-jarvis-muted">Total cycle:</span>
          <span className="text-sm text-jarvis-ink font-semibold tabular-nums">{totalCycle}d</span>
          {vs_last_30d_days !== 0 && (
            <div className={`flex items-center gap-0.5 ${trendIsGood ? "text-jarvis-green" : "text-jarvis-red"}`}>
              {trendIsGood ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
              <span className="text-[10px] font-semibold">
                {trendIsGood ? "" : "+"}{vs_last_30d_days}d
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="chip text-jarvis-blue">{deals_closed_30d} closed 30d</span>
          <span className="chip text-jarvis-green">{win_rate_30d}% win rate</span>
        </div>
      </div>
    </div>
  );
}
