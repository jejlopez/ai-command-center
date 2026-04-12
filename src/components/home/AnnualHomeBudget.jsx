import { Loader2, BarChart3 } from "lucide-react";

const CATEGORY_GROUPS = {
  Housing:     ["mortgage", "rent", "hoa", "home", "housing"],
  Utilities:   ["utilities", "utility", "electric", "gas", "water", "internet", "phone"],
  Maintenance: ["maintenance", "repair", "hvac", "pest"],
  Services:    ["cleaning", "landscaping", "service", "subscription", "household"],
  Other:       [],
};

function toMonthly(amount, freq) {
  switch ((freq ?? "monthly").toLowerCase()) {
    case "weekly":    return amount * 4.33;
    case "daily":     return amount * 30;
    case "quarterly": return amount / 3;
    case "annual": case "yearly": return amount / 12;
    default: return amount;
  }
}

function groupExpenses(expenses) {
  const groups = Object.fromEntries(Object.keys(CATEGORY_GROUPS).map(k => [k, 0]));
  for (const e of expenses) {
    const cat = (e.category ?? "").toLowerCase();
    let matched = false;
    for (const [group, keywords] of Object.entries(CATEGORY_GROUPS)) {
      if (group === "Other") continue;
      if (keywords.some(kw => cat.includes(kw))) {
        groups[group] += toMonthly(e.amount_usd ?? 0, e.frequency);
        matched = true;
        break;
      }
    }
    if (!matched) groups["Other"] += toMonthly(e.amount_usd ?? 0, e.frequency);
  }
  return groups;
}

export function AnnualHomeBudget({ expenses = [], loading = false }) {
  if (loading) {
    return (
      <div className="glass p-5">
        <div className="label mb-4">Annual Home Budget</div>
        <div className="flex items-center gap-2 text-[12px] text-jarvis-muted py-4"><Loader2 size={12} className="animate-spin" /> Loading…</div>
      </div>
    );
  }

  const groups = groupExpenses(expenses);
  const totalMonthly = Object.values(groups).reduce((s, v) => s + v, 0);
  const totalAnnual = totalMonthly * 12;
  const maxVal = Math.max(...Object.values(groups), 1);

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={14} className="text-jarvis-purple" />
        <div className="label">Annual Home Budget</div>
      </div>
      <div className="text-[11px] text-jarvis-muted mb-4">
        Projected: <span className="text-jarvis-ink font-semibold">${totalAnnual.toLocaleString(undefined, {maximumFractionDigits:0})}/yr</span>
        <span className="ml-2">(${totalMonthly.toFixed(0)}/mo)</span>
      </div>

      {totalMonthly === 0 ? (
        <p className="text-[12px] text-jarvis-muted py-3">Add expenses to see your annual budget breakdown.</p>
      ) : (
        <div className="space-y-2">
          {Object.entries(groups).filter(([,v]) => v > 0).map(([cat, mo]) => {
            const pct = (mo / maxVal) * 100;
            return (
              <div key={cat}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="text-jarvis-muted">{cat}</span>
                  <span className="text-jarvis-ink font-medium">${(mo * 12).toFixed(0)}/yr</span>
                </div>
                <div className="h-1.5 rounded-full bg-jarvis-surface/60 overflow-hidden">
                  <div className="h-full rounded-full bg-jarvis-purple/60 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
