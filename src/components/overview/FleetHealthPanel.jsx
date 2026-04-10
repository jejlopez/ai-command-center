import { AlertTriangle, Gauge, ShieldCheck, Wifi } from 'lucide-react';
import { cn } from "../../utils/cn";
import { CommandSectionHeader } from '../command/CommandSectionHeader';

function Kpi({ label, value, tone = 'text-aurora-teal', detail }) {
  return (
    <div className="ui-stat p-6 bg-panel shadow-sm border-hairline transition-all hover:scale-[1.02] rounded-2xl">
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70">{label}</div>
      <div className={cn("mt-4 text-4xl font-black tracking-tighter uppercase", tone)}>{value}</div>
      {detail ? <p className="mt-4 text-[12px] leading-relaxed text-text-dim font-medium italic opacity-80">"{detail}"</p> : null}
    </div>
  );
}

export function FleetHealthPanel({ summary, onOpenDetail }) {
  return (
    <div className="ui-panel p-6 shadow-main border-hairline bg-panel">
      <CommandSectionHeader
        eyebrow="Fleet Command Zone"
        title="System Posture"
        description="Health, latency, and operator exceptions across the full machine."
        icon={ShieldCheck}
        tone="blue"
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Kpi label="Active" value={summary.activeAgents} tone="text-aurora-teal" detail="Operators currently in motion." />
        <Kpi label="Idle" value={summary.idleAgents} tone="text-text-dim" detail="Available capacity ready for work." />
        <Kpi label="Errors" value={summary.errorAgents} tone="text-aurora-rose" detail="Operators in a failed state." />
        <Kpi label="Success" value={`${summary.successRate}%`} tone="text-aurora-green" detail="Average completion quality." />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="ui-stat p-5 bg-panel-soft border border-hairline rounded-xl shadow-inner">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">
            <Gauge className="h-4 w-4 text-aurora-amber" />
            Median latency
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-text uppercase tracking-tight">{summary.medianLatency}ms</div>
        </div>
        <div className="ui-stat p-5 bg-panel-soft border border-hairline rounded-xl shadow-inner">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">
            <Wifi className="h-4 w-4 text-aurora-blue" />
            Stalled units
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-text uppercase tracking-tight">{summary.stalledAgents}</div>
        </div>
        <div className="ui-stat p-5 bg-panel-soft border border-hairline rounded-xl shadow-inner">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">
            <AlertTriangle className="h-4 w-4 text-aurora-amber" />
            Watch list
          </div>
          <div className="mt-3 font-mono text-2xl font-black text-text uppercase tracking-tight">{summary.flaggedAgentCount}</div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {summary.flaggedAgents.length === 0 && (
          <div className="ui-card-row border-aurora-green/20 bg-aurora-green/5 p-6 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-aurora-green">Clear posture report</div>
            <p className="mt-3 text-[13px] leading-relaxed text-text-dim italic">
              "No flagged operators. Fleet posture is currently stable across all active lanes."
            </p>
          </div>
        )}

        {summary.flaggedAgents.map((agent) => (
          <button
            key={agent.id}
            type="button"
            onClick={() => onOpenDetail?.(agent.id)}
            className="ui-card-row group flex w-full items-start justify-between p-6 transition-all hover:bg-panel-soft border shadow-sm bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35"
          >
            <div>
              <div className="text-sm font-black text-text uppercase tracking-tight">{agent.name}</div>
              <p className="mt-3 text-[13px] leading-relaxed text-text-dim font-medium italic opacity-80">"{agent.reason}"</p>
            </div>
            <AlertTriangle className="h-4 w-4 text-aurora-amber opacity-40 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </div>
  );
}
