import { PieChart } from "lucide-react";

const SEGMENTS = [
  { key: "deployed_positions", label: "In Positions", color: "bg-jarvis-green", textColor: "text-jarvis-green" },
  { key: "in_pipeline", label: "Pipeline Value", color: "bg-jarvis-cyan", textColor: "text-jarvis-cyan" },
  { key: "cash_idle", label: "Idle Cash", color: "bg-white/20", textColor: "text-jarvis-muted" },
];

export function CashAllocation({ data }) {
  if (!data) {
    return (
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-3"><PieChart size={14} className="text-jarvis-cyan" /><span className="label">Cash Allocation</span></div>
        <p className="text-sm text-jarvis-muted">No allocation data available yet.</p>
      </div>
    );
  }

  const segments = SEGMENTS.map((s) => ({ ...s, value: data[s.key] ?? 0 }));
  const total = segments.reduce((s, seg) => s + seg.value, 1);

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4"><PieChart size={14} className="text-jarvis-cyan" /><span className="label">Cash Allocation</span></div>
      <div className="flex gap-1 h-4 rounded-full overflow-hidden mb-4">
        {segments.map((s) => {
          const pct = (s.value / total) * 100;
          return pct > 0 ? <div key={s.key} className={`${s.color} transition-all`} style={{ width: `${pct}%` }} title={`${s.label}: $${s.value.toLocaleString()}`} /> : null;
        })}
      </div>
      <div className="space-y-2">
        {segments.map((s) => {
          const pct = ((s.value / total) * 100).toFixed(1);
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.color}`} />
              <span className="text-xs text-jarvis-muted flex-1">{s.label}</span>
              <span className={`text-xs font-semibold tabular-nums ${s.textColor}`}>${s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className="text-xs text-jarvis-muted tabular-nums">{pct}%</span>
            </div>
          );
        })}
      </div>
      {data.cash_idle > data.deployed_positions && (
        <div className="mt-3 px-3 py-2 rounded-xl bg-jarvis-amber/10 border border-jarvis-amber/20">
          <p className="text-xs text-jarvis-amber">Most capital is idle — deploy or it erodes.</p>
        </div>
      )}
    </div>
  );
}
