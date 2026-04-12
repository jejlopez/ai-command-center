export function ExpenseRadar({ expenseRadar }) {
  if (!expenseRadar || expenseRadar.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Monthly Burn</div>
        <p className="text-sm text-jarvis-muted">Add recurring expenses to track your burn rate.</p>
      </div>
    );
  }

  const maxAmount = Math.max(...expenseRadar.map((e) => e.amount), 1);
  const total = expenseRadar.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="glass p-5">
      <div className="label mb-3">Monthly Burn</div>
      <div className="space-y-2">
        {expenseRadar.map((e) => {
          const pct = (e.amount / maxAmount) * 100;
          return (
            <div key={e.category} className="flex items-center gap-3">
              <span className="text-xs text-jarvis-body w-28 shrink-0 truncate">{e.category}</span>
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-jarvis-primary/60" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-jarvis-ink font-semibold tabular-nums w-16 text-right">${e.amount}</span>
              <span className="text-[10px] text-jarvis-muted w-8 text-right">{e.count}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-jarvis-border flex items-center justify-between">
        <span className="text-xs text-jarvis-muted">Total</span>
        <span className="text-sm font-semibold text-jarvis-ink tabular-nums">${total.toLocaleString()}/mo</span>
      </div>
    </div>
  );
}
