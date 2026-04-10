import { Bot, Plus, Settings2, Sparkles } from 'lucide-react';
import { CommandSectionHeader } from '../command/CommandSectionHeader';

function getRiskState(agent, flaggedIds) {
  if (!agent.model) return { label: 'Needs config', tone: 'warning', accent: 'text-aurora-amber' };
  if (agent.status === 'error') return { label: 'Error', tone: 'critical', accent: 'text-aurora-rose' };
  if (flaggedIds.has(agent.id)) return { label: 'Check', tone: 'info', accent: 'text-aurora-blue' };
  if (agent.status === 'processing') return { label: 'Active', tone: 'active', accent: 'text-aurora-teal' };
  return { label: 'Ready', tone: 'neutral', accent: 'text-text-muted' };
}

function roleConfig(role) {
  const config = {
    researcher: { label: 'Research', className: 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue' },
    qa: { label: 'QA', className: 'border-aurora-violet/20 bg-aurora-violet/10 text-aurora-violet' },
    ops: { label: 'Ops', className: 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber' },
    'ui-agent': { label: 'Interface', className: 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal' },
  };
  return config[role] || { label: role || 'Operator', className: 'border-hairline bg-panel-soft text-text-primary' };
}

function DelegateCard({ agent, providerByModel, flaggedIds, onOpenDetail }) {
  const risk = getRiskState(agent, flaggedIds);
  const role = roleConfig(agent.role);

  return (
    <button
      type="button"
      onClick={() => onOpenDetail?.(agent.id)}
      className={cn(
        'ui-card-row text-left transition-transform hover:-translate-y-0.5 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35',
        risk.tone === 'active' && 'border-aurora-teal/18',
        risk.tone === 'critical' && 'border-aurora-rose/20 bg-aurora-rose/[0.05]',
        risk.tone === 'warning' && 'border-aurora-amber/20 bg-aurora-amber/[0.04]',
        risk.tone === 'info' && 'border-aurora-blue/18'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="ui-panel-soft flex h-11 w-11 items-center justify-center rounded-2xl">
          <Bot className="h-4.5 w-4.5 text-aurora-blue" />
        </div>
        <span className={cn(
          'ui-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
          risk.tone === 'active' && 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal',
          risk.tone === 'critical' && 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose',
          risk.tone === 'warning' && 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber',
          risk.tone === 'info' && 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue'
        )}>
          {risk.label}
        </span>
      </div>

      <div className="mt-5">
        <div className="truncate text-2xl font-semibold tracking-[-0.03em] text-text-primary">{agent.name}</div>
        <div className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${role.className}`}>
          {role.label}
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="ui-panel-soft p-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Runtime</div>
          <div className="mt-2 text-sm font-semibold text-text-primary">{providerByModel.get(agent.model) || 'Unknown'}</div>
          <div className="mt-1 truncate font-mono text-[12px] text-text-muted">{agent.model || 'Unassigned'}</div>
        </div>

        <div className="ui-panel-soft flex items-center justify-between gap-3 p-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Operator status</div>
            <div className={`mt-2 text-sm font-semibold ${risk.accent}`}>{risk.label}</div>
          </div>
          <div className="ui-panel-soft flex h-9 w-9 items-center justify-center rounded-xl">
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
      className="ui-card-row text-left transition-transform hover:-translate-y-0.5 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35"
    >
      <div className="ui-panel-soft flex h-11 w-11 items-center justify-center rounded-2xl">
        <Plus className="h-5 w-5 text-aurora-teal" />
      </div>
      <div className="mt-5 text-xl font-semibold tracking-[-0.03em] text-text-primary">Open slot</div>
      <div className="mt-2 text-sm leading-6 text-text-muted">
        Add another specialist for research, execution, QA, or ops support.
      </div>
      <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-aurora-teal">
        <Sparkles className="h-4 w-4" />
        Add operator
      </div>
    </button>
  );
}

export function CommandSquadPanel({ operators, providerByModel, flaggedIds, onOpenDetail, onAddOperator }) {
  const displayOpenSlots = 1;
  const hasOperators = operators.length > 0;

  return (
    <div className="ui-panel p-5">
      <CommandSectionHeader
        eyebrow="Operator Deck"
        title="Specialist coverage"
        description={hasOperators
          ? `${operators.length} specialist operator${operators.length === 1 ? '' : 's'} attached and available for live routing.`
          : 'Add specialist operators to expand research, execution, QA, and ops coverage.'}
        icon={Bot}
        tone="blue"
        action={(
          <button
            type="button"
            onClick={onAddOperator}
            className="ui-button-secondary inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-text-primary"
          >
            <Plus className="h-4 w-4 text-aurora-teal" />
            Add Operator
          </button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
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
        <div className="mt-4 ui-card-row border-aurora-teal/15 bg-aurora-teal/[0.04] px-4 py-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-teal">Bridge readiness</div>
          <p className="mt-2 text-sm leading-6 text-text-body">
            The commander is live, but the bridge is still single-threaded. Add specialists to turn this into a real execution deck.
          </p>
        </div>
      )}
    </div>
  );
}
