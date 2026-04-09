import { BarChart3, DollarSign, Wallet } from 'lucide-react';

export function CostControlPanel({ summary }) {
  return (
    <div className="spatial-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-disabled">Cost Control</div>
          <div className="mt-1 text-lg font-semibold text-text-primary">Spend and burn</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
          <DollarSign className="h-4 w-4 text-aurora-teal" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">Spend Today</div>
          <div className="mt-2 font-mono text-3xl text-text-primary">${summary.total.toFixed(2)}</div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">Burn Rate</div>
          <div className="mt-2 font-mono text-3xl text-text-primary">${summary.burnRate.toFixed(2)}</div>
          <div className="mt-1 text-xs text-text-muted">per hour</div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">Top Driver</div>
          <div className="mt-2 text-sm font-semibold text-text-primary">{summary.topModel?.name || 'No spend yet'}</div>
          <div className="mt-1 font-mono text-sm text-text-muted">{summary.topModel ? `$${summary.topModel.cost.toFixed(2)}` : '—'}</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-disabled">
          <BarChart3 className="h-3.5 w-3.5 text-aurora-blue" />
          Cost By Model
        </div>
        <div className="mt-4 space-y-3">
          {summary.models.length === 0 && (
            <div className="text-sm text-text-muted">No cost data has been recorded yet.</div>
          )}
          {summary.models.slice(0, 4).map((model) => (
            <div key={model.name}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-text-primary">{model.name}</span>
                <span className="font-mono text-text-muted">${model.cost.toFixed(2)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full bg-gradient-to-r from-aurora-teal to-aurora-blue" style={{ width: `${model.percentage}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-text-muted"><Wallet className="h-4 w-4 text-aurora-violet" /> Budget status</span>
        <span className="text-text-primary">No budget limit configured</span>
      </div>
    </div>
  );
}
