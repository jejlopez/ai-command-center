import { BarChart2 } from "lucide-react";

const fmtK = (n) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${Math.round(n)}`;

function ForecastBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-jarvis-muted">{label}</span>
        <span className={`text-xs font-semibold ${color}`}>{fmtK(value)}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function RevenueForecast({ deals = [] }) {
  const now = new Date();

  function weightedByWindow(days) {
    const cutoff = new Date(now.getTime() + days * 86400_000);
    return deals
      .filter(d => d.stage !== "closed_lost" && d.expected_close_date)
      .filter(d => new Date(d.expected_close_date) <= cutoff)
      .reduce((s, d) => s + (d.value || 0) * ((d.probability || 50) / 100), 0);
  }

  const f30 = weightedByWindow(30);
  const f60 = weightedByWindow(60);
  const f90 = weightedByWindow(90);
  const max = Math.max(f90, 1);

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <BarChart2 size={13} className="text-jarvis-muted" />
        <span className="label">Revenue Forecast</span>
      </div>

      {deals.length === 0 ? (
        <p className="text-xs text-jarvis-ghost py-2">Add deals with close dates and probability to see forecast.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <ForecastBar label="30 days" value={f30} max={max} color="text-blue-400" />
          <ForecastBar label="60 days" value={f60} max={max} color="text-jarvis-primary" />
          <ForecastBar label="90 days" value={f90} max={max} color="text-jarvis-success" />
        </div>
      )}
      <div className="text-[9px] text-jarvis-ghost">Weighted by close probability. Active deals only.</div>
    </div>
  );
}
