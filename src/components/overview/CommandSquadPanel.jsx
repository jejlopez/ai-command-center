import { Bot, Plus, Settings2, Sparkles } from 'lucide-react';

function getRiskState(agent, flaggedIds) {
  if (!agent.model) return { label: 'Needs config', tone: 'warning', accent: 'text-aurora-amber' };
  if (agent.status === 'error') return { label: 'Error', tone: 'critical', accent: 'text-aurora-rose' };
  if (flaggedIds.has(agent.id)) return { label: 'Check', tone: 'info', accent: 'text-aurora-blue' };
  if (agent.status === 'processing') return { label: 'Active', tone: 'active', accent: 'text-aurora-teal' };
  return { label: 'Ready', tone: 'neutral', accent: 'text-text-muted' };
}

function roleConfig(role) {
  const config = {
    researcher: { label: 'Research', className: 'delegate-role-research' },
    qa: { label: 'QA', className: 'delegate-role-qa' },
    ops: { label: 'Ops', className: 'delegate-role-ops' },
    'ui-agent': { label: 'Interface', className: 'delegate-role-ui' },
  };
  return config[role] || { label: role || 'Operator', className: 'delegate-role-default' };
}

function DelegateCard({ agent, providerByModel, flaggedIds, onOpenDetail }) {
  const risk = getRiskState(agent, flaggedIds);
  const role = roleConfig(agent.role);

  return (
    <button
      onClick={() => onOpenDetail?.(agent.id)}
      className={`delegate-council-card delegate-council-card-${risk.tone} text-left transition-transform hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="delegate-agent-mark">
          <Bot className="h-4.5 w-4.5 text-aurora-blue" />
        </div>
        <span className={`delegate-status-badge ${risk.tone}`}>
          {risk.label}
        </span>
      </div>

      <div className="mt-5">
        <div className="truncate text-2xl font-semibold tracking-[-0.03em] text-text-primary">{agent.name}</div>
        <div className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${role.className}`}>
          {role.label}
        </div>
      </div>

        <div className="mt-5 grid gap-3">
          <div className="delegate-runtime-stack">
            <div className="delegate-runtime-heading">Runtime</div>
            <div className="mt-2 text-sm font-semibold text-text-primary">{providerByModel.get(agent.model) || 'Unknown'}</div>
            <div className="mt-1 truncate font-mono text-[12px] text-text-muted">{agent.model || 'Unassigned'}</div>
          </div>

          <div className={`delegate-status-panel ${risk.tone}`}>
            <div>
              <div className="delegate-runtime-heading">Operator status</div>
              <div className={`mt-2 text-sm font-semibold ${risk.accent}`}>{risk.label}</div>
            </div>
            <div className="delegate-config-icon">
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
      onClick={onAddOperator}
      className="delegate-open-slot text-left transition-transform hover:-translate-y-0.5"
    >
      <div className="delegate-open-slot-icon">
        <Plus className="h-5 w-5 text-aurora-teal" />
      </div>
      <div className="mt-5 text-xl font-semibold tracking-[-0.03em] text-text-primary">Open slot</div>
      <div className="mt-2 text-sm leading-6 text-text-muted">
        Add another operator for research, execution, review, or operations support.
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

  return (
    <div className="jarvis-console p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-disabled">Commander operators</div>
          <div className="mt-1 text-xl font-semibold text-text-primary">Command squad</div>
          <div className="mt-1 text-sm text-text-muted">
            {operators.length} operator{operators.length === 1 ? '' : 's'} ready for orchestration.
          </div>
        </div>
        <button
          onClick={onAddOperator}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white/[0.05]"
        >
          <Plus className="h-4 w-4 text-aurora-teal" />
          Add Operator
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
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
    </div>
  );
}
