import { Loader2, AlertTriangle, TrendingDown } from "lucide-react";

function toMonthly(amount, freq) {
  switch ((freq ?? "monthly").toLowerCase()) {
    case "weekly":    return amount * 4.33;
    case "daily":     return amount * 30;
    case "quarterly": return amount / 3;
    case "annual": case "yearly": return amount / 12;
    default: return amount;
  }
}

function flagFor(exp, allMonthly) {
  const mo = toMonthly(exp.amount_usd ?? 0, exp.frequency);
  const top20 = allMonthly.sort((a,b) => b-a)[Math.floor(allMonthly.length * 0.2)] ?? 0;
  const flags = [];
  if (!exp.value_notes && !exp.notes) flags.push({ label: "unused?", style: "text-amber-400" });
  if (mo >= top20 && allMonthly.length > 3) flags.push({ label: "expensive", style: "text-red-400" });
  return flags;
}

export function SubscriptionAudit({ expenses = [], loading = false }) {
  if (loading) {
    return (
      <div className="glass p-5">
        <div className="label mb-4">Subscription Audit</div>
        <div className="flex items-center gap-2 text-[12px] text-jarvis-muted py-4"><Loader2 size={12} className="animate-spin" /> Loading…</div>
      </div>
    );
  }

  const withMonthly = expenses.map(e => ({ ...e, _mo: toMonthly(e.amount_usd ?? 0, e.frequency) }));
  const allMonthly = withMonthly.map(e => e._mo);
  const totalMo = allMonthly.reduce((s, v) => s + v, 0);
  const flagged = withMonthly.filter(e => {
    const f = flagFor(e, [...allMonthly]);
    return f.length > 0;
  });
  const cutPotential = flagged.reduce((s, e) => s + e._mo, 0);

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-1">
        <TrendingDown size={14} className="text-jarvis-purple" />
        <div className="label">Subscription Audit</div>
      </div>
      <div className="text-[11px] text-jarvis-muted mb-4">
        Total: <span className="text-jarvis-ink font-semibold">${totalMo.toFixed(0)}/mo</span>
        {cutPotential > 0 && (
          <span className="ml-2 text-amber-400">· Recommended cuts: ${cutPotential.toFixed(0)}/mo</span>
        )}
      </div>

      {expenses.length === 0 ? (
        <p className="text-[12px] text-jarvis-muted py-3">No subscriptions found. Add expenses to audit them.</p>
      ) : (
        <div className="space-y-1">
          {withMonthly.map((exp) => {
            const flags = flagFor(exp, [...allMonthly]);
            return (
              <div key={exp.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent hover:border-jarvis-border transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-jarvis-ink truncate">{exp.name}</span>
                    {flags.map(f => (
                      <span key={f.label} className={`text-[9px] ${f.style} flex items-center gap-0.5`}>
                        <AlertTriangle size={8} />{f.label}
                      </span>
                    ))}
                  </div>
                  <div className="text-[10px] text-jarvis-muted capitalize">{exp.category}</div>
                </div>
                <div className="text-xs font-semibold tabular-nums text-jarvis-ink">${exp._mo.toFixed(0)}/mo</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
