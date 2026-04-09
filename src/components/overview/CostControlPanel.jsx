import { BarChart3, DollarSign, Wallet } from 'lucide-react';
import { CommandSectionHeader } from '../command/CommandSectionHeader';

export function CostControlPanel({ summary }) {
  const models = summary.models || [];

  return (
    <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(45,212,191,0.05),rgba(255,255,255,0.015))] p-5">
      <CommandSectionHeader
        eyebrow="Strategic Control Zone"
        title="Spend Discipline"
        description="Burn, concentration, and where premium intelligence is actually being consumed."
        icon={DollarSign}
        tone="teal"
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">Spend Today</div>
          <div className="mt-2 font-mono text-3xl text-text-primary">${Number(summary.total || 0).toFixed(2)}</div>
          <p className="mt-2 text-[12px] leading-relaxed text-text-muted">Tracked cost currently visible to the command bridge.</p>
        </div>
        <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">Burn Rate</div>
          <div className="mt-2 font-mono text-3xl text-text-primary">${Number(summary.burnRate || 0).toFixed(2)}</div>
          <div className="mt-1 text-xs text-text-muted">per hour</div>
        </div>
        <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">Top Driver</div>
          <div className="mt-2 text-sm font-semibold text-text-primary">{summary.topModel?.name || 'No spend yet'}</div>
          <div className="mt-1 font-mono text-sm text-text-muted">{summary.topModel ? `$${Number(summary.topModel.cost || 0).toFixed(2)}` : '—'}</div>
        </div>
      </div>

      <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-disabled">
          <BarChart3 className="h-3.5 w-3.5 text-aurora-blue" />
          Spend Concentration
        </div>
        <div className="mt-4 space-y-3">
          {models.length === 0 && (
            <div className="text-sm text-text-muted">No cost data has been recorded yet.</div>
          )}
          {models.slice(0, 4).map((model) => (
            <div key={model.name}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-text-primary">{model.name}</span>
                <span className="font-mono text-text-muted">${Number(model.cost || 0).toFixed(2)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full bg-gradient-to-r from-aurora-teal to-aurora-blue" style={{ width: `${Number(model.percentage || 0)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-[20px] border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm">
        <span className="flex items-center gap-2 text-text-muted"><Wallet className="h-4 w-4 text-aurora-violet" /> Budget posture</span>
        <span className="text-text-primary">No budget limit configured</span>
      </div>
    </div>
  );
}
