import { TrendingUp, TrendingDown } from "lucide-react";

const STAGE_COLORS = {
  prospect: "bg-jarvis-muted/30",
  quoted: "bg-jarvis-cyan/60",
  negotiating: "bg-jarvis-amber/60",
  closed_won: "bg-jarvis-green/60",
};

function StatChip({ label, value, color }) {
  return (
    <span className="chip">
      <span className="text-jarvis-muted">{label}</span>{" "}
      <span className={`font-semibold ${color}`}>{value}</span>
    </span>
  );
}

function FunnelBar({ funnel }) {
  const totalCount = funnel.reduce((s, f) => s + f.count, 0);
  if (totalCount === 0) return null;
  return (
    <div className="flex rounded-lg overflow-hidden h-5 gap-px mt-3">
      {funnel.map((f) => {
        const pct = totalCount > 0 ? (f.count / totalCount) * 100 : 0;
        if (pct === 0) return null;
        return (
          <div
            key={f.stage}
            className={`${STAGE_COLORS[f.stage] ?? "bg-jarvis-muted/20"} flex items-center justify-center transition-all`}
            style={{ width: `${pct}%` }}
            title={`${f.stage}: ${f.count} deal${f.count !== 1 ? "s" : ""} · $${(f.value ?? 0).toLocaleString()}`}
          >
            <span className="text-[9px] text-white/80 font-semibold truncate px-1">{f.count}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PipelineHero({ pipelineStats }) {
  if (!pipelineStats || Object.keys(pipelineStats).length === 0) {
    return (
      <div className="glass p-6 border border-jarvis-border">
        <div className="label">Pipeline</div>
        <p className="text-sm text-jarvis-muted mt-2">Add your first deal to see pipeline stats.</p>
      </div>
    );
  }

  const {
    total_value = 0,
    active_deals = 0,
    closing_this_week = 0,
    conversion_rate = 0,
    avg_cycle_days = 0,
    velocity_vs_last_month_pct = 0,
    funnel = [],
  } = pipelineStats;

  const isPositive = velocity_vs_last_month_pct >= 0;
  const VelocityIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className="glass p-6 border border-jarvis-blue/20 shadow-glow-blue animate-fadeIn">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="label">Pipeline</div>
          <div className="flex items-baseline gap-3 mt-2">
            <span className="font-display text-3xl text-jarvis-blue tabular-nums">
              ${total_value.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <VelocityIcon size={13} className={isPositive ? "text-jarvis-green" : "text-jarvis-red"} />
              <span className={`text-xs font-semibold ${isPositive ? "text-jarvis-green" : "text-jarvis-red"}`}>
                {isPositive ? "+" : ""}{velocity_vs_last_month_pct}% vs last month
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <StatChip label="Deals" value={active_deals} color="text-jarvis-blue" />
            <StatChip label="Closing" value={closing_this_week} color="text-jarvis-amber" />
            <StatChip label="Conv." value={`${conversion_rate}%`} color="text-jarvis-green" />
            <StatChip label="Avg cycle" value={`${avg_cycle_days}d`} color="text-jarvis-cyan" />
          </div>
          {funnel.length > 0 && <FunnelBar funnel={funnel} />}
          {funnel.length > 0 && (
            <div className="flex gap-4 mt-2">
              {funnel.map((f) => (
                <span key={f.stage} className="text-[10px] text-jarvis-muted">
                  <span className="capitalize">{f.stage.replace("_", " ")}</span>{" "}
                  <span className="text-jarvis-body">{f.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
