import { DollarSign, Loader2 } from "lucide-react";

const FREQ_LABEL = {
  weekly: "/ wk",
  monthly: "/ mo",
  quarterly: "/ qtr",
  annual: "/ yr",
  yearly: "/ yr",
  daily: "/ day",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(nextDue) {
  if (!nextDue) return false;
  return nextDue < todayIso();
}

function isDueThisWeek(nextDue) {
  if (!nextDue) return false;
  const today = new Date();
  const due = new Date(nextDue + "T00:00:00");
  const weekOut = new Date(today);
  weekOut.setDate(weekOut.getDate() + 7);
  return due >= today && due <= weekOut;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toMonthly(amount, freq) {
  switch ((freq ?? "monthly").toLowerCase()) {
    case "weekly":    return amount * 4.33;
    case "daily":     return amount * 30;
    case "quarterly": return amount / 3;
    case "annual":
    case "yearly":    return amount / 12;
    default:          return amount;
  }
}

export function RecurringExpenses({ expenses, loading }) {
  if (loading) {
    return (
      <div className="glass p-5">
        <div className="label mb-4">Recurring Expenses</div>
        <div className="flex items-center gap-2 text-[12px] text-jarvis-muted py-4">
          <Loader2 size={12} className="animate-spin" /> Loading expenses…
        </div>
      </div>
    );
  }

  const monthlyTotal = expenses.reduce((sum, e) => sum + toMonthly(e.amount_usd ?? 0, e.frequency), 0);

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="label">Recurring Expenses</div>
        {expenses.length > 0 && (
          <span className="chip bg-jarvis-surface/40 border border-jarvis-border text-[11px]">
            <DollarSign size={10} className="text-jarvis-muted" />
            <span className="text-jarvis-muted">monthly</span>
            <span className="font-semibold text-jarvis-ink">${monthlyTotal.toFixed(0)}</span>
          </span>
        )}
      </div>

      {expenses.length === 0 ? (
        <p className="text-[12px] text-jarvis-muted py-3">
          No household expenses found. Add expenses with category "household" to track them here.
        </p>
      ) : (
        <div className="space-y-1">
          {expenses.map((exp) => {
            const overdue = isOverdue(exp.next_due);
            const soon = !overdue && isDueThisWeek(exp.next_due);
            const rowColor = overdue
              ? "border-red-500/20 bg-red-500/5"
              : soon
              ? "border-amber-400/20 bg-amber-400/5"
              : "border-transparent";

            return (
              <div
                key={exp.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${rowColor} transition`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-jarvis-ink truncate">{exp.name}</div>
                  <div className="text-[10px] text-jarvis-muted capitalize">{exp.category}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold tabular-nums text-jarvis-ink">
                    ${(exp.amount_usd ?? 0).toLocaleString()}
                    <span className="text-[10px] text-jarvis-muted font-normal ml-1">
                      {FREQ_LABEL[exp.frequency] ?? `/ ${exp.frequency}`}
                    </span>
                  </div>
                  {exp.next_due && (
                    <div className={`text-[10px] ${overdue ? "text-red-400" : soon ? "text-amber-400" : "text-jarvis-muted"}`}>
                      due {fmtDate(exp.next_due)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
