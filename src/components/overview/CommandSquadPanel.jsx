import { Bot, Plus, Settings2, Sparkles } from 'lucide-react';
import { CommandSectionHeader } from '../command/CommandSectionHeader';
import { cn } from '../../utils/cn';

function getRiskState(agent, flaggedIds) {
  if (!agent.model) return { label: 'Needs config', tone: 'warning', accent: 'text-aurora-amber' };
  if (agent.status === 'error') return { label: 'Error', tone: 'critical', accent: 'text-aurora-rose' };
  if (flaggedIds.has(agent.id)) return { label: 'Check', tone: 'info', accent: 'text-aurora-blue' };
  if (agent.status === 'processing') return { label: 'Active', tone: 'active', accent: 'text-aurora-teal' };
  return { label: 'Ready', tone: 'neutral', accent: 'text-text-dim' };
}

function roleConfig(role) {
  const config = {
    researcher: { label: 'Research', className: 'border-aurora-blue/25 bg-aurora-blue/10 text-aurora-blue' },
    qa: { label: 'QA', className: 'border-aurora-violet/25 bg-aurora-violet/10 text-aurora-violet' },
    ops: { label: 'Ops', className: 'border-aurora-amber/25 bg-aurora-amber/10 text-aurora-amber' },
    'ui-agent': { label: 'Interface', className: 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal' },
  };
  return config[role] || { label: role || 'Operator', className: 'border-hairline bg-panel-soft text-text' };
}

function DelegateCard({ agent, providerByModel, flaggedIds, onOpenDetail }) {
  const risk = getRiskState(agent, flaggedIds);
  const role = roleConfig(agent.role);

  return (
    <button
      type="button"
      onClick={() => onOpenDetail?.(agent.id)}
      className={cn(
        'ui-card-row text-left transition-all hover:scale-[1.02] p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35 shadow-main bg-panel',
        risk.tone === 'active' && 'border-aurora-teal/35 shadow-[0_0_15px_-5px_var(--color-aurora-teal)]',
        risk.tone === 'critical' && 'border-aurora-rose/35 bg-aurora-rose/5',
        risk.tone === 'warning' && 'border-aurora-amber/35 bg-aurora-amber/5',
        risk.tone === 'info' && 'border-aurora-blue/35'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="ui-panel-soft flex h-12 w-12 items-center justify-center rounded-[20px] bg-canvas border border-hairline shadow-inner">
          <Bot className="h-5 w-5 text-aurora-blue" />
        </div>
        <span className={cn(
          'ui-chip px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm',
          risk.tone === 'active' && 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal',
          risk.tone === 'critical' && 'border-aurora-rose/25 bg-aurora-rose/10 text-aurora-rose',
          risk.tone === 'warning' && 'border-aurora-amber/25 bg-aurora-amber/10 text-aurora-amber',
          risk.tone === 'info' && 'border-aurora-blue/25 bg-aurora-blue/10 text-aurora-blue',
          risk.tone === 'neutral' && 'border-hairline bg-panel-soft text-text-dim'
        )}>
          {risk.label}
        </span>
      </div>

      <div className="mt-6">
        <div className="truncate text-2xl font-black tracking-tighter text-text uppercase">{agent.name}</div>
        <div className={cn('mt-4 inline-flex items-center rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.25em] shadow-sm', role.className)}>
          {role.label}
        </div>
      </div>

      <div className="mt-8 grid gap-4">
        <div className="ui-panel-soft p-4 rounded-xl border border-hairline bg-panel-soft shadow-inner">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70">Runtime Backbone</div>
          <div className="mt-2 text-sm font-black text-text uppercase tracking-tight">{providerByModel.get(agent.model) || 'Sovereign'}</div>
          <div className="mt-1 truncate font-mono text-[11px] text-text-dim">{agent.model || 'Unassigned Node'}</div>
        </div>

        <div className="ui-panel-soft flex items-center justify-between gap-3 p-4 rounded-xl border border-hairline bg-panel shadow-sm">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-text-dim opacity-70">Operator Health</div>
            <div className={cn("mt-2 text-xs font-black uppercase tracking-widest", risk.accent)}>{risk.label}</div>
          </div>
          <div className="ui-panel-soft flex h-10 w-10 items-center justify-center rounded-xl bg-canvas border border-hairline">
            <Settings2 className="h-4 w-4 text-aurora-teal" />
          </div>
        </div>
      </div>
    </button>
  );
}

function OpenSlotCard({ onAddOperator }) {
  return (
    <button
      type="button"
      onClick={onAddOperator}
      className="ui-card-row text-left transition-all hover:scale-[1.02] p-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35 bg-panel border-dashed border-hairline/40 shadow-sm"
    >
      <div className="ui-panel-soft flex h-12 w-12 items-center justify-center rounded-[20px] bg-panel-soft border border-hairline">
        <Plus className="h-6 w-6 text-aurora-teal" />
      </div>
      <div className="mt-6 text-xl font-black tracking-tight text-text uppercase">Open Deck Slot</div>
      <p className="mt-3 text-sm leading-relaxed text-text-dim font-medium italic">
        "Attach a specialist for research, execution, QA, or ops support."
      </p>
      <div className="mt-6 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-aurora-teal">
        <Sparkles className="h-4 w-4" />
        Commission operator
      </div>
    </button>
  );
}

export function CommandSquadPanel({ operators, providerByModel, flaggedIds, onOpenDetail, onAddOperator }) {
  const displayOpenSlots = 1;
  const hasOperators = operators.length > 0;

  return (
    <div className="ui-panel p-6 shadow-main border-hairline">
      <CommandSectionHeader
        eyebrow="Operator Deck"
        title="Fleet Specialist coverage"
        description={hasOperators
          ? `${operators.length} specialist operator${operators.length === 1 ? '' : 's'} attached and available for live routing.`
          : 'Add specialist operators to expand research, execution, QA, and ops coverage.'}
        icon={Bot}
        tone="blue"
        action={(
          <button
            type="button"
            onClick={onAddOperator}
            className="ui-button-secondary inline-flex items-center gap-3 px-4 py-2 text-xs font-black uppercase tracking-widest text-text shadow-sm"
          >
            <Plus className="h-4 w-4 text-aurora-teal" />
            Add Operator
          </button>
        )}
      />

      <div className="mt-8 grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        {operators.map((agent) => (
          <DelegateCard
            key={agent.id}
            agent={agent}
            providerByModel={providerByModel}
            flaggedIds={flaggedIds}
            onOpenDetail={onOpenDetail}
          />
        ))}

        {Array.from({ length: displayOpenSlots }).map((_, index) => (
          <OpenSlotCard key={`open-slot-${index}`} onAddOperator={onAddOperator} />
        ))}
      </div>

      {!hasOperators && (
        <div className="mt-6 ui-card-row border-aurora-teal/20 bg-aurora-teal/5 p-6 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-aurora-teal">Bridge readiness report</div>
          <p className="mt-3 text-[13px] leading-relaxed text-text-dim italic">
            "The commander is live, but the bridge is still single-threaded. Commission specialists to turn this into a high-throughput execution deck."
          </p>
        </div>
      )}
    </div>
  );
}
