import { Crown, Gauge, MessageSquareText, Rocket, ShieldAlert, Sparkles } from 'lucide-react';
import { CommandDeckHero } from '../command/CommandDeckHero';

function PulseStat({ label, value, tone = 'text-text-primary' }) {
  return (
    <div className="ui-stat p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tracking-[-0.03em] ${tone}`}>{value}</div>
    </div>
  );
}

function readinessTone(readinessState) {
  if (readinessState === 'ready') return 'teal';
  if (readinessState === 'blocked') return 'rose';
  return 'amber';
}

function commanderLine(summary) {
  if (summary.failedTasks > 0) return `${summary.failedTasks} mission${summary.failedTasks > 1 ? 's are' : ' is'} down and need${summary.failedTasks > 1 ? '' : 's'} recovery before full acceleration.`;
  if (summary.pendingApprovals > 0) return `${summary.pendingApprovals} decision gate${summary.pendingApprovals > 1 ? 's are' : ' is'} holding back the next clean launch window.`;
  if (summary.lateSchedules > 0) return `${summary.lateSchedules} automation${summary.lateSchedules > 1 ? 's have' : ' has'} slipped behind schedule and should be reset before scale-up.`;
  if (summary.runningTasks > 0) return `${summary.runningTasks} live mission${summary.runningTasks > 1 ? 's are' : ' is'} in motion and the bridge is clear to push throughput.`;
  return 'The bridge is stable, readable, and ready to launch the next wave.';
}

export function CommanderHero({
  commander,
  provider,
  operatorCount,
  summary,
  readiness,
  policyDelta,
  policyActionGuidance,
  tradeoffOutcome,
  tradeoffCorrectiveAction,
  onOpenRoutingPolicy,
  onHardenPolicy,
  onLoosenPolicy,
  onSwapPolicyLane,
  onStageTradeoffCorrection,
  onOpenDetail,
  onNavigate,
}) {
  if (!commander) {
    return (
      <div className="ui-panel p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-aurora-amber">
          <Crown className="h-3.5 w-3.5" />
          Command Bridge
        </div>
        <div className="mt-2 text-2xl font-semibold text-text-primary">Commander missing</div>
        <div className="mt-2 max-w-xl text-sm leading-6 text-text-muted">
          This bridge needs a primary commander before it can act as the live executive surface for the system.
        </div>
      </div>
    );
  }

  const tone = readinessTone(readiness.state);

  return (
    <CommandDeckHero
      glow="blue"
      chrome="epic"
      eyebrow="Flagship Command Center"
      eyebrowIcon={Rocket}
      title={readiness.headline}
      description={commanderLine(summary)}
      titleClassName="text-[clamp(2.15rem,4vw,3.35rem)] leading-[0.98] tracking-[-0.05em] max-w-3xl"
      descriptionClassName="max-w-2xl text-[15px] leading-7 text-text-body"
      badges={[
        { label: 'primary commander', value: commander.name, tone: 'amber' },
        { label: 'readiness posture', value: readiness.label, tone },
        { label: 'live operators', value: operatorCount, tone: 'blue' },
      ]}
      actions={(
        <>
          <button
            type="button"
            onClick={() => onNavigate?.('missions')}
            className="inline-flex items-center gap-3 rounded-[22px] border border-[#d6c7a1]/20 bg-[#d6c7a1]/[0.08] px-4 py-3 text-sm font-semibold text-[#f4e6c2] transition-colors hover:bg-[#d6c7a1]/[0.12]"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/20 ring-1 ring-[#d6c7a1]/10">
              <MessageSquareText className="h-5 w-5" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-base font-semibold leading-tight">Open Mission Control</span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-[#f4e6c2]/70">Primary launch lane</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onOpenDetail?.(commander.id)}
            className="ui-button-secondary inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-white/[0.05]"
          >
            <Gauge className="h-4 w-4 text-aurora-blue" />
            Tune Commander
          </button>
        </>
      )}
      sideContent={(
        <div className="ui-panel w-full p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">System Pulse</div>
            <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              readiness.state === 'ready'
                ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green'
                : readiness.state === 'blocked'
                  ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
                  : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
            }`}>
              {readiness.state}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <PulseStat label="Live missions" value={summary.runningTasks} tone="text-aurora-teal" />
            <PulseStat label="Needs decision" value={summary.pendingApprovals} tone="text-aurora-amber" />
            <PulseStat label="Blocked / failed" value={summary.failedTasks + summary.stalledAgents + summary.lateSchedules} tone="text-aurora-rose" />
            <PulseStat label="Burn / hour" value={`$${Number(summary.burnRate || 0).toFixed(2)}`} tone="text-aurora-violet" />
          </div>

          <div className="mt-4 ui-panel-soft p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
              <Sparkles className="h-3.5 w-3.5 text-aurora-teal" />
              Bridge readback
            </div>
            <div className="mt-3 ui-card-row px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Primary commander</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{commander.name}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">{commander.status || 'unknown'} posture</div>
                </div>
                <div className="ui-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-amber">
                  Commander
                </div>
              </div>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-text-body">
              {readiness.readback}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                {provider || 'Unknown provider'}
              </div>
              <div className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]">
                {commander.model || 'Unassigned model'}
              </div>
            </div>
          </div>

          {policyDelta?.title && (
            <div className="mt-3 ui-panel-soft p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Policy delta</div>
              <div className="mt-2 text-[12px] font-semibold text-text-primary">{policyDelta.title}</div>
              <p className="mt-2 text-[11px] leading-relaxed text-text-body">
                {policyDelta.providerDelta}. {policyDelta.modelDelta}. {policyDelta.approvalDelta}.
              </p>
              {policyActionGuidance?.evidence?.length ? (
                <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                  Evidence: {policyActionGuidance.evidence.slice(0, 2).join(' • ')}
                </div>
              ) : null}
              {policyActionGuidance?.swap?.enabled ? (
                <div className="mt-2 text-[11px] leading-relaxed text-aurora-blue">
                  {policyActionGuidance.swap.signal}
                </div>
              ) : null}
              {tradeoffOutcome?.available ? (
                <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                  Tradeoff payback: <span className="font-semibold text-text-primary">{tradeoffOutcome.outcomeLabel}</span>. {tradeoffOutcome.detail}
                </div>
              ) : null}
              {tradeoffOutcome?.available && tradeoffCorrectiveAction?.label ? (
                <div className="mt-2 text-[11px] leading-relaxed text-text-body">
                  <span className="font-semibold text-text-primary">Corrective action:</span> {tradeoffCorrectiveAction.label}. {tradeoffCorrectiveAction.detail}
                </div>
              ) : null}
              {tradeoffOutcome?.available && tradeoffCorrectiveAction?.expectedImpact ? (
                <div className="mt-2 rounded-2xl border border-white/[0.06] bg-black/10 px-3 py-2.5">
                  {tradeoffCorrectiveAction.postureComparison ? (
                    <>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Posture shift</div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div className="ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Current</div>
                          <div className="mt-1">{tradeoffCorrectiveAction.postureComparison.current}</div>
                        </div>
                        <div className="ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-blue">Proposed</div>
                          <div className="mt-1">{tradeoffCorrectiveAction.postureComparison.proposed}</div>
                        </div>
                      </div>
                    </>
                  ) : null}
                  <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-teal">Expected improvement</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-text-body">
                    {tradeoffCorrectiveAction.expectedImpact.primary}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-aurora-amber">Expected tradeoff</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-text-muted">
                    {tradeoffCorrectiveAction.expectedImpact.tradeoff}
                  </div>
                  {tradeoffCorrectiveAction.doctrineImpact ? (
                    <>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-aurora-violet">Doctrine confidence impact</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-body">
                        {tradeoffCorrectiveAction.doctrineImpact.confidence}
                      </div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-muted">
                        {tradeoffCorrectiveAction.doctrineImpact.trust}
                      </div>
                    </>
                  ) : null}
                  {tradeoffCorrectiveAction.verificationImpact ? (
                    <>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-aurora-blue">Recommended verification</div>
                      <div className="mt-1 text-[11px] font-semibold leading-relaxed text-text-primary">
                        {tradeoffCorrectiveAction.verificationImpact.threshold}
                      </div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-muted">
                        {tradeoffCorrectiveAction.verificationImpact.detail}
                      </div>
                    </>
                  ) : null}
                  {tradeoffCorrectiveAction.successCriteria?.length ? (
                    <>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-aurora-green">Success criteria</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-muted">
                        {tradeoffCorrectiveAction.successCriteria.slice(0, 2).join(' • ')}
                      </div>
                    </>
                  ) : null}
                  {tradeoffCorrectiveAction.rollbackCriteria?.length ? (
                    <>
                      <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-aurora-rose">Rollback criteria</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-muted">
                        {tradeoffCorrectiveAction.rollbackCriteria.slice(0, 2).join(' • ')}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onOpenRoutingPolicy}
                  className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-primary"
                  title={policyActionGuidance?.open?.detail || policyDelta.detail}
                >
                  Open policy
                </button>
                <button
                  type="button"
                  onClick={onHardenPolicy}
                  className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-amber disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!policyActionGuidance?.harden?.enabled}
                  title={policyActionGuidance?.harden?.detail}
                >
                  Harden approval
                </button>
                <button
                  type="button"
                  onClick={onLoosenPolicy}
                  className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-teal disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!policyActionGuidance?.loosen?.enabled}
                  title={policyActionGuidance?.loosen?.detail}
                >
                  Loosen approval
                </button>
                {policyActionGuidance?.swap ? (
                  <button
                    type="button"
                    onClick={onSwapPolicyLane}
                    className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-blue disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!policyActionGuidance.swap.enabled}
                    title={policyActionGuidance.swap.detail}
                  >
                    {policyActionGuidance.swap.label}
                  </button>
                ) : null}
                {tradeoffOutcome?.available && tradeoffCorrectiveAction?.routeState && onStageTradeoffCorrection ? (
                  <button
                    type="button"
                    onClick={onStageTradeoffCorrection}
                    className="ui-chip px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-violet"
                    title={tradeoffCorrectiveAction.detail}
                  >
                    Stage correction
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {summary.flaggedAgentCount > 0 && (
            <div className="mt-3 rounded-2xl border border-aurora-amber/16 bg-aurora-amber/[0.06] p-3">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-aurora-amber">
                <ShieldAlert className="h-3.5 w-3.5" />
                Operator attention
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-text-body">
                {summary.flaggedAgentCount} operator{summary.flaggedAgentCount === 1 ? '' : 's'} should be checked before the next aggressive launch cycle.
              </p>
            </div>
          )}
        </div>
      )}
    />
  );
}
