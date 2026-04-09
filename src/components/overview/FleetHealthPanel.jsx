import { AlertTriangle, Gauge, ShieldCheck, Wifi } from 'lucide-react';

function Kpi({ label, value, tone = 'text-text-primary' }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">{label}</div>
      <div className={`mt-2 font-mono text-2xl ${tone}`}>{value}</div>
    </div>
  );
}

export function FleetHealthPanel({ summary, onOpenDetail }) {
  return (
    <div className="spatial-panel p-5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-disabled">Fleet Health</div>
      <div className="mt-1 text-lg font-semibold text-text-primary">Fleet posture and risk concentration</div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Kpi label="Active" value={summary.activeAgents} tone="text-aurora-teal" />
        <Kpi label="Idle" value={summary.idleAgents} />
        <Kpi label="Errors" value={summary.errorAgents} tone="text-aurora-rose" />
        <Kpi label="Success" value={`${summary.successRate}%`} tone="text-aurora-green" />
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-text-muted"><Gauge className="h-4 w-4 text-aurora-amber" /> Median latency</span>
          <span className="font-mono text-text-primary">{summary.medianLatency}ms</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-text-muted"><Wifi className="h-4 w-4 text-aurora-blue" /> Stalled agents</span>
          <span className="font-mono text-text-primary">{summary.stalledAgents}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-text-muted"><ShieldCheck className="h-4 w-4 text-aurora-green" /> Pending approvals</span>
          <span className="font-mono text-text-primary">{summary.pendingApprovals}</span>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-3 text-[10px] uppercase tracking-[0.16em] text-text-disabled">Agents To Check</div>
        <div className="space-y-2">
          {summary.flaggedAgents.length === 0 && (
            <div className="rounded-xl border border-aurora-green/15 bg-aurora-green/5 px-4 py-3 text-sm text-aurora-green">
              Fleet looks stable. No agents are currently flagged for follow-up.
            </div>
          )}

          {summary.flaggedAgents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => onOpenDetail?.(agent.id)}
              className="flex w-full items-start justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
            >
              <div>
                <div className="text-sm font-medium text-text-primary">{agent.name}</div>
                <div className="mt-1 text-xs text-text-muted">{agent.reason}</div>
              </div>
              <AlertTriangle className="mt-0.5 h-4 w-4 text-aurora-amber" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
