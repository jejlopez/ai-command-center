import { useState } from 'react';
import { CheckCircle2, ChevronDown, ShieldCheck } from 'lucide-react';
import { cn } from '../../utils/cn';

export function TruthAuditStrip({ truth }) {
  const [showPlaybook, setShowPlaybook] = useState(false);
  const readinessTone = truth.readinessState === 'ready'
    ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green'
    : truth.readinessState === 'blocked'
      ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
      : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber';
  const items = [
    { label: 'Commander', value: truth.commanderName },
    { label: 'Approvals', value: truth.pendingApprovals },
    { label: 'Active', value: truth.activeMissions },
    { label: 'Blocked', value: truth.blockedMissions },
    { label: 'Systems', value: truth.connectedSystemsCount },
    { label: 'Critical', value: truth.criticalAlerts },
  ];
  const leadChecks = [...truth.readinessChecks]
    .sort((a, b) => Number(a.passed) - Number(b.passed))
    .slice(0, 3);

  return (
    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-aurora-teal" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Truth Audit</span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
            Shared command counts. These numbers should match the shell, mission control, notifications, profile, reports, and intelligence.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPlaybook((current) => !current)}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-text-primary"
        >
          {showPlaybook ? 'Hide Playbook' : 'Open Playbook'}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showPlaybook && 'rotate-180')} />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5 xl:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="rounded-[16px] border border-white/8 bg-black/20 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{item.label}</div>
            <div className="mt-2 text-sm font-semibold text-text-primary">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-[20px] border border-white/8 bg-black/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Launch Readiness</div>
            <div className="mt-2 text-lg font-semibold text-text-primary">{truth.readinessLabel}</div>
            <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
              A compressed go / caution / block read before you trust the deck as the live operating surface.
            </p>
          </div>
          <div className={cn('rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]', readinessTone)}>
            {truth.readinessState}
          </div>
        </div>
        <div className="mt-4 grid gap-2.5 md:grid-cols-3">
          {leadChecks.map((item) => (
            <div key={item.id} className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{item.label}</div>
                <div className={cn(
                  'rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]',
                  item.passed
                    ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green'
                    : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                )}>
                  {item.passed ? 'Pass' : 'Check'}
                </div>
              </div>
              <div className="mt-2 text-[12px] leading-relaxed text-text-muted">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
      {showPlaybook && (
        <div className="mt-4 rounded-[20px] border border-white/8 bg-black/20 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-aurora-teal" />
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Final Truth Checklist</div>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
            Use this playbook before rollout. Every value below should match the listed surfaces with no mock drift.
          </p>
          {truth.readinessFailures.length > 0 && (
            <div className="mt-4 rounded-[18px] border border-aurora-amber/20 bg-aurora-amber/[0.07] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-amber">Blocking checks</div>
              <div className="mt-3 space-y-2">
                {truth.readinessFailures.map((item) => (
                  <div key={item.id} className="text-[12px] leading-relaxed text-text-body">
                    <span className="font-semibold text-text-primary">{item.label}:</span> {item.detail}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-[18px] border border-white/8 bg-white/[0.02] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Profile state</div>
              <div className="mt-2 text-sm font-semibold text-text-primary">{truth.profileState}</div>
            </div>
            <div className="rounded-[18px] border border-white/8 bg-white/[0.02] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Route posture</div>
              <div className="mt-2 text-sm font-semibold text-text-primary">{truth.alertPosture} via {truth.notificationRoute}</div>
            </div>
            <div className="rounded-[18px] border border-white/8 bg-white/[0.02] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Trust doctrine</div>
              <div className="mt-2 text-sm font-semibold text-text-primary">{truth.trustedWriteMode} / {truth.approvalDoctrine}</div>
            </div>
            <div className="rounded-[18px] border border-white/8 bg-white/[0.02] px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Intelligence truth</div>
              <div className="mt-2 text-sm font-semibold text-text-primary">{truth.namespacesCount} ns · {truth.directivesCount} dir · {truth.recommendationsCount} rec</div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {truth.checklist.map((item) => (
              <div key={item.id} className="rounded-[16px] border border-white/8 bg-white/[0.02] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">{item.label}</div>
                    <div className="mt-1 text-sm font-semibold text-text-primary">{item.value}</div>
                    <div className="mt-2 text-[12px] leading-relaxed text-text-muted">Verify in: {item.target}</div>
                  </div>
                  <div className={cn(
                    'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
                    item.healthy
                      ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green'
                      : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                  )}>
                    {item.healthy ? 'Ready' : 'Check'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
