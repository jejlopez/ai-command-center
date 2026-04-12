import { AlertTriangle, Shield, TrendingDown, CreditCard, Zap } from "lucide-react";

const TYPE_ICON = { unused_subscription: CreditCard, low_margin_deal: TrendingDown, unprotected_position: TrendingDown, ai_overspend: Zap, stale_pipeline: TrendingDown };
const SEVERITY_COLOR = { high: "text-jarvis-red", medium: "text-jarvis-amber", low: "text-jarvis-body" };

export function MoneyLeaks({ leaks }) {
  if (!leaks || leaks.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Money Leaks</div>
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <Shield size={14} />
          <span>No leaks detected — clean finances.</span>
        </div>
      </div>
    );
  }

  const totalLeak = leaks.reduce((s, l) => s + (l.amount ?? 0), 0);

  return (
    <div className="glass p-5">
      <div className="label mb-3">Money Leaks</div>
      <div className="space-y-2">
        {leaks.map((l) => {
          const Icon = TYPE_ICON[l.type] ?? AlertTriangle;
          const color = SEVERITY_COLOR[l.severity] ?? "text-jarvis-body";
          return (
            <div key={l.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <Icon size={14} className={color} />
              <span className="text-sm text-jarvis-body flex-1">{l.text}</span>
              {l.amount > 0 && <span className="text-xs font-semibold text-jarvis-red tabular-nums">${l.amount.toLocaleString()}</span>}
            </div>
          );
        })}
      </div>
      {totalLeak > 0 && (
        <div className="mt-3 pt-3 border-t border-jarvis-border flex items-center justify-between">
          <span className="text-xs text-jarvis-muted">Total exposure</span>
          <span className="text-sm font-semibold text-jarvis-red tabular-nums">${totalLeak.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
