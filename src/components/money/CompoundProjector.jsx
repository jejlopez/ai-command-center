import { useState } from "react";
import { TrendingUp } from "lucide-react";

const PERIODS = [
  { label: "1 yr", months: 12 },
  { label: "5 yr", months: 60 },
  { label: "10 yr", months: 120 },
];

function compound(monthly, annualRatePct, months) {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return monthly * months;
  return monthly * ((Math.pow(1 + r, months) - 1) / r);
}

export function CompoundProjector() {
  const [monthly, setMonthly] = useState("1000");
  const [rate, setRate] = useState("8");

  const m = parseFloat(monthly) || 0;
  const r = parseFloat(rate) || 0;
  const projections = PERIODS.map((p) => ({ ...p, value: compound(m, r, p.months) }));
  const maxVal = Math.max(...projections.map((p) => p.value), 1);

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4"><TrendingUp size={14} className="text-jarvis-cyan" /><span className="label">Compound Projector</span></div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div>
          <label className="text-[10px] text-jarvis-muted block mb-1">Monthly savings ($)</label>
          <input
            type="number"
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            className="w-full bg-white/5 border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-body placeholder-jarvis-muted focus:outline-none focus:border-jarvis-cyan"
          />
        </div>
        <div>
          <label className="text-[10px] text-jarvis-muted block mb-1">Annual growth (%)</label>
          <input
            type="number"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full bg-white/5 border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-body placeholder-jarvis-muted focus:outline-none focus:border-jarvis-cyan"
          />
        </div>
      </div>
      <div className="space-y-3">
        {projections.map((p) => {
          const pct = (p.value / maxVal) * 100;
          return (
            <div key={p.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-jarvis-muted">{p.label}</span>
                <span className="text-sm font-bold text-jarvis-green tabular-nums">
                  ${p.value >= 1_000_000 ? `${(p.value / 1_000_000).toFixed(2)}M` : p.value >= 1000 ? `${(p.value / 1000).toFixed(1)}K` : p.value.toFixed(0)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-jarvis-green transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      {m > 0 && r > 0 && (
        <p className="mt-3 text-xs text-jarvis-muted">
          At ${m.toLocaleString()}/mo · {r}% annually · compounding monthly
        </p>
      )}
    </div>
  );
}
