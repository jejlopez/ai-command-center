import { Crown, Gauge, MessageSquareText, Rocket, ShieldAlert, Sparkles } from 'lucide-react';
import { CommandDeckHero } from '../command/CommandDeckHero';

function PulseStat({ label, value, tone = 'text-text-primary' }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
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
  deltaItems = [],
  onOpenDetail,
  onNavigate,
}) {
  if (!commander) {
    return (
      <div className="jarvis-console p-6 sm:p-8">
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
            className="commander-comms-button"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/16 ring-1 ring-black/10">
              <MessageSquareText className="h-5 w-5" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-base font-semibold leading-tight">Open Mission Control</span>
              <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-black/70">Primary launch lane</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onOpenDetail?.(commander.id)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-white/[0.07]"
          >
            <Gauge className="h-4 w-4 text-aurora-blue" />
            Tune Commander
          </button>
        </>
      )}
      sideContent={(
        <div className="w-full rounded-[24px] border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
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

          <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
              <Sparkles className="h-3.5 w-3.5 text-aurora-teal" />
              Bridge readback
            </div>
            <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Primary commander</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{commander.name}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text-muted">{commander.status || 'unknown'} posture</div>
                </div>
                <div className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-amber">
                  Commander
                </div>
              </div>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-text-body">
              {readiness.readback}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {provider || 'Unknown provider'}
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                {commander.model || 'Unassigned model'}
              </div>
            </div>
            {deltaItems.length > 0 && (
              <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Trust movement</div>
                <div className="mt-3 space-y-2">
                  {deltaItems.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-text-primary">{entry.owner}</div>
                        <div className="mt-1 truncate text-[10px] text-text-muted">{entry.changeSummary}</div>
                      </div>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                        entry.trend === 'up'
                          ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                          : entry.trend === 'down'
                            ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
                            : 'border-white/10 bg-white/[0.03] text-text-muted'
                      }`}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {summary.flaggedAgentCount > 0 && (
            <div className="mt-3 rounded-2xl border border-aurora-amber/20 bg-aurora-amber/[0.07] p-3">
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
