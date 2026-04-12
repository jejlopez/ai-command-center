import { TrendingDown, TrendingUp, DollarSign } from "lucide-react";

export function CostPerDeal({ data }) {
  const current = data?.cost_per_deal_current ?? 0;
  const previous = data?.cost_per_deal_previous ?? 0;
  const deals = data?.deals_closed_30d ?? 0;
  const totalCost = data?.total_monthly_cost ?? 0;

  const delta = previous > 0 ? current - previous : null;
  const cheaper = delta !== null && delta < 0;

  if (!data) {
    return (
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-3"><DollarSign size={14} className="text-jarvis-cyan" /><span className="label">Cost Per Deal</span></div>
        <p className="text-sm text-jarvis-muted">Close your first deal to see acquisition cost.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4"><DollarSign size={14} className="text-jarvis-cyan" /><span className="label">Cost Per Deal</span></div>
      <div className="p-3 rounded-xl bg-white/[0.03] border border-jarvis-border mb-4">
        <p className="text-xs text-jarvis-muted mb-1">Acquisition cost</p>
        <p className="text-3xl font-bold text-jarvis-body tabular-nums">
          ${current.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          <span className="text-sm font-normal text-jarvis-muted ml-1">/ deal</span>
        </p>
        {delta !== null && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${cheaper ? "text-jarvis-green" : "text-jarvis-red"}`}>
            {cheaper ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
            {cheaper ? "↓" : "↑"} ${Math.abs(delta).toLocaleString(undefined, { maximumFractionDigits: 0 })} vs last month
            {cheaper ? " — getting cheaper" : " — getting more expensive"}
          </div>
        )}
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-jarvis-muted">Deals closed (30d)</span>
          <span className="text-jarvis-body font-semibold">{deals}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-jarvis-muted">Total monthly cost</span>
          <span className="text-jarvis-body font-semibold">${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </div>
      </div>
    </div>
  );
}
