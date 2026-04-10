import { BarChart3, DollarSign, Wallet } from 'lucide-react';
import { CommandSectionHeader } from '../command/CommandSectionHeader';

export function CostControlPanel({ summary }) {
  const models = summary.models || [];

  return (
    <div className="ui-panel p-6 shadow-main border-hairline">
      <CommandSectionHeader
        eyebrow="Strategic Control Zone"
        title="Fleet Spend Discipline"
        description="Burn, concentration, and where premium intelligence is actually being consumed."
        icon={DollarSign}
        tone="teal"
      />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="ui-stat p-5 bg-panel border-hairline shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70">Spend Today</div>
          <div className="mt-3 font-mono text-3xl font-black text-text">${Number(summary.total || 0).toFixed(2)}</div>
          <p className="mt-3 text-[12px] leading-relaxed text-text-dim italic font-medium">"Tracked cost currently visible."</p>
        </div>
        <div className="ui-stat p-5 bg-panel border-hairline shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70">Burn Rate</div>
          <div className="mt-3 font-mono text-3xl font-black text-text">${Number(summary.burnRate || 0).toFixed(2)}</div>
          <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-text-dim">PER OPERATIONAL HOUR</div>
        </div>
        <div className="ui-stat p-5 bg-panel border-hairline shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70">Top Driver</div>
          <div className="mt-3 text-base font-black text-text uppercase tracking-tight truncate">{summary.topModel?.name || 'No spend yet'}</div>
          <div className="mt-1 font-mono text-sm font-black text-aurora-teal">{summary.topModel ? `$${Number(summary.topModel.cost || 0).toFixed(2)}` : '—'}</div>
        </div>
      </div>

      <div className="ui-panel-soft mt-6 p-6 border-hairline bg-panel-soft shadow-inner">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-text-dim">
          <BarChart3 className="h-4 w-4 text-aurora-blue" />
          Intelligence Concentration
        </div>
        <div className="mt-6 space-y-5">
          {models.length === 0 && (
            <div className="text-sm font-medium italic text-text-dim">No cost data has been recorded yet.</div>
          )}
          {models.slice(0, 4).map((model) => (
            <div key={model.name} className="group">
              <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-widest">
                <span className="text-text">{model.name}</span>
                <span className="text-text-dim">${Number(model.cost || 0).toFixed(2)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-canvas border border-hairline shadow-inner">
                <Motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Number(model.percentage || 0)}%` }}
                  transition={{ duration: 0.8, ease: "circOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-aurora-teal via-aurora-blue to-aurora-violet shadow-[0_0_10px_-2px_var(--color-aurora-teal)]" 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ui-panel-soft mt-4 flex items-center justify-between px-5 py-4 text-xs font-black uppercase tracking-widest border-hairline bg-panel shadow-sm">
        <span className="flex items-center gap-3 text-text-dim">
          <Wallet className="h-4 w-4 text-aurora-violet" /> 
          Budget posture
        </span>
        <span className="text-aurora-teal">Unbound acceleration</span>
      </div>
    </div>
  );
}
