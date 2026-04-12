import { AlertTriangle, Gauge, ShieldCheck, Wifi } from 'lucide-react';
import { CommandSectionHeader } from '../command/CommandSectionHeader';

function Kpi({ label, value, tone = 'text-text-primary', detail }) {
  return (
    <div className="ui-stat p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${tone}`}>{value}</div>
      {detail ? <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{detail}</p> : null}
    </div>
  );
}

export function FleetHealthPanel({ summary, onOpenDetail }) {
  return (
    <div className="ui-panel p-5">
      <CommandSectionHeader
        eyebrow="Fleet Command Zone"
        title="System Posture"
        description="Health, latency, and operator exceptions across the full machine."
        icon={ShieldCheck}
        tone="blue"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Kpi label="Active" value={summary.activeAgents} tone="text-aurora-teal" detail="Operators currently in motion." />
        <Kpi label="Idle" value={summary.idleAgents} detail="Available capacity ready to take work." />
        <Kpi label="Errors" value={summary.errorAgents} tone="text-aurora-rose" detail="Operators in a failed state." />
        <Kpi label="Success" value={`${summary.successRate}%`} tone="text-aurora-green" detail="Average completion quality across the fleet." />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="ui-stat p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
            <Gauge className="h-3.5 w-3.5 text-aurora-amber" />
            Median latency
          </div>
          <div className="mt-2 font-mono text-2xl text-text-primary">{summary.medianLatency}ms</div>
        </div>
        <div className="ui-stat p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
            <Wifi className="h-3.5 w-3.5 text-aurora-blue" />
            Stalled operators
          </div>
          <div className="mt-2 font-mono text-2xl text-text-primary">{summary.stalledAgents}</div>
        </div>
        <div className="ui-stat p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
            <AlertTriangle className="h-3.5 w-3.5 text-aurora-amber" />
            Watch list
          </div>
          <div className="mt-2 font-mono text-2xl text-text-primary">{summary.flaggedAgentCount}</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {summary.flaggedAgents.length === 0 && (
          <div className="ui-card-row border-aurora-green/15 bg-aurora-green/5 px-4 py-4 text-sm text-aurora-green">
            No flagged operators. Fleet posture is stable.
          </div>
        )}

        {summary.flaggedAgents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => onOpenDetail?.(agent.id)}
            className="ui-card-row flex w-full items-start justify-between px-4 py-4 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35"
          >
            <div>
              <div className="text-sm font-medium text-text-primary">{agent.name}</div>
              <div className="mt-2 text-[12px] leading-relaxed text-text-muted">{agent.reason}</div>
            </div>
            <AlertTriangle className="mt-0.5 h-4 w-4 text-aurora-amber" />
          </button>
        ))}
      </div>
    </div>
  );
}
