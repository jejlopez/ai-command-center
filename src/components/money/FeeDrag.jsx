import { Zap } from "lucide-react";

const FEE_CATEGORIES = [
  { key: "trading_fees", label: "Trading Fees" },
  { key: "ai_costs", label: "AI Costs" },
  { key: "subscription_fees", label: "Subscriptions" },
];

export function FeeDrag({ data }) {
  if (!data) {
    return (
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-3"><Zap size={14} className="text-jarvis-cyan" /><span className="label">Fee Drag</span></div>
        <p className="text-sm text-jarvis-muted">No fee data available yet.</p>
      </div>
    );
  }

  const rows = FEE_CATEGORIES.map((c) => ({ ...c, amount: data[c.key] ?? 0 }));
  const totalFees = rows.reduce((s, r) => s + r.amount, 0);
  const grossIncome = data.gross_income ?? 0;
  const feePct = grossIncome > 0 ? ((totalFees / grossIncome) * 100).toFixed(1) : null;
  const severity = feePct !== null ? (parseFloat(feePct) > 20 ? "text-jarvis-red" : parseFloat(feePct) > 10 ? "text-jarvis-amber" : "text-jarvis-green") : "text-jarvis-body";

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4"><Zap size={14} className="text-jarvis-cyan" /><span className="label">Fee Drag</span></div>
      <div className="space-y-2 mb-3">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
            <span className="text-sm text-jarvis-body">{r.label}</span>
            <span className="text-xs font-semibold text-jarvis-muted tabular-nums">${r.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</span>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t border-jarvis-border space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-jarvis-muted">Total fee drag</span>
          <span className="font-semibold text-jarvis-red tabular-nums">${totalFees.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</span>
        </div>
        {feePct !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-jarvis-muted">Fees ate</span>
            <span className={`font-semibold tabular-nums ${severity}`}>{feePct}% of gross income</span>
          </div>
        )}
      </div>
    </div>
  );
}
