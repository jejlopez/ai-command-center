import { TrendingUp, TrendingDown } from "lucide-react";

function Sparkline({ data, width = 200, height = 40 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(Math.abs), 1);
  const mid = height / 2;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${mid - (v / max) * (height / 2 - 2)}`).join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <line x1={0} y1={mid} x2={width} y2={mid} stroke="currentColor" strokeOpacity={0.1} />
      <polyline fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={points} className="text-jarvis-primary" />
    </svg>
  );
}

function StatChip({ label, value, color }) {
  return (
    <span className="chip">
      <span className="text-jarvis-muted">{label}</span>{" "}
      <span className={`font-semibold ${color}`}>{value}</span>
    </span>
  );
}

export function CapitalVelocityHero({ velocity }) {
  const net = velocity?.daily_net ?? 0;
  const isPositive = net >= 0;
  const color = isPositive ? "text-jarvis-green" : "text-jarvis-red";
  const glowClass = isPositive ? "border-jarvis-green/20" : "border-jarvis-red/20";
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const vsPct = velocity?.vs_last_week_pct ?? 0;
  const fmtUsd = (n) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString()}`;

  if (!velocity || Object.keys(velocity).length === 0) {
    return (
      <div className="glass p-6 border border-jarvis-border">
        <div className="label">Capital Velocity</div>
        <p className="text-sm text-jarvis-muted mt-2">Add deals and trades to see your capital velocity.</p>
      </div>
    );
  }

  return (
    <div className={`glass p-6 border ${glowClass} animate-fadeIn`}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="label">Capital Velocity</div>
          <div className="flex items-baseline gap-3 mt-2">
            <span className={`font-display text-4xl tabular-nums ${color}`}>{fmtUsd(net)}</span>
            <span className="text-sm text-jarvis-muted">/day this week</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Icon size={14} className={color} />
            <span className={`text-xs font-semibold ${vsPct >= 0 ? "text-jarvis-green" : "text-jarvis-red"}`}>
              {vsPct >= 0 ? "+" : ""}{vsPct.toFixed(1)}% vs last week
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <StatChip label="Sales" value={fmtUsd(velocity.sales_contribution ?? 0)} color="text-jarvis-primary" />
            <StatChip label="Trading" value={fmtUsd(velocity.trading_contribution ?? 0)} color="text-jarvis-purple" />
            <StatChip label="Costs" value={fmtUsd(velocity.cost_drag ?? 0)} color="text-jarvis-red" />
          </div>
        </div>
        <div className="shrink-0">
          <Sparkline data={velocity.sparkline_7d} />
        </div>
      </div>
    </div>
  );
}
