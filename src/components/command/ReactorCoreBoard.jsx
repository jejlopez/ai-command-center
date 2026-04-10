import { Activity, AlertTriangle, Gauge, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '../../utils/cn';

const toneClass = {
  ready: 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green',
  caution: 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber',
  blocked: 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose',
};

function ReactorMetric({ label, value, detail, icon, tone = 'ready', bordered = true }) {
  const IconComponent = icon;
  return (
    <div className={cn('px-4 py-3', bordered && 'border-l border-white/[0.05]')}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
        <div className={cn('rounded-xl border p-2', toneClass[tone])}>
          <IconComponent className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-text-primary">{value}</div>
      <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{detail}</p>
    </div>
  );
}

export function ReactorCoreBoard({ truth, summary }) {
  const readinessTone = truth.readinessState || 'caution';
  const interventionCount = truth.pendingApprovals + truth.blockedMissions + truth.criticalAlerts;

  return (
    <div className="deck-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="deck-chip inline-flex items-center gap-2 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
            <Activity className="h-3.5 w-3.5 text-aurora-teal" />
            Reactor Core Readiness
          </div>
          <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-text-primary">{truth.readinessLabel}</div>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-text-muted">
            One place to see if the machine is stable enough to accelerate, or if approvals, failures, or degraded systems still need intervention first.
          </p>
        </div>
        <div className={cn('rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]', toneClass[readinessTone])}>
          {truth.readinessState}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[22px] bg-black/20 ring-1 ring-white/[0.05]">
        <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-4">
        <ReactorMetric
          label="Interventions"
          value={interventionCount}
          detail="How many items are actively stopping clean autonomous flow."
          icon={AlertTriangle}
          tone={interventionCount > 0 ? 'blocked' : 'ready'}
          bordered={false}
        />
        <ReactorMetric
          label="Approval drag"
          value={truth.pendingApprovals}
          detail="Human gates still waiting for judgment."
          icon={ShieldCheck}
          tone={truth.pendingApprovals > 0 ? 'caution' : 'ready'}
        />
        <ReactorMetric
          label="Live throughput"
          value={truth.activeMissions}
          detail="Missions currently moving through the deck."
          icon={Zap}
          tone={truth.activeMissions > 0 ? 'ready' : 'caution'}
        />
        <ReactorMetric
          label="Cost pressure"
          value={`$${Number(summary?.burnRate || 0).toFixed(2)}`}
          detail="Current cost pressure visible in the live command system."
          icon={Gauge}
          tone={Number(summary?.burnRate || 0) > 0 ? 'caution' : 'ready'}
        />
        </div>
      </div>
    </div>
  );
}
