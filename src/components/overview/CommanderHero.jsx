import { Crown, Gauge, MessageSquareText, Rocket, ShieldAlert, Sparkles } from 'lucide-react';
import { CommandDeckHero } from '../command/CommandDeckHero';
import { cn } from '../../utils/cn';

function PulseStat({ label, value, tone = 'text-aurora-teal' }) {
  return (
    <div className="ui-stat p-3 bg-panel-soft border-hairline shadow-sm">
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim">{label}</div>
      <div className={cn("mt-2 text-2xl font-black tracking-tighter", tone)}>{value}</div>
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
  onOpenDetail,
  onNavigate,
}) {
  if (!commander) {
    return (
      <div className="ui-panel p-8 shadow-main">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-aurora-amber">
          <Crown className="h-3.5 w-3.5" />
          Command Bridge
        </div>
        <div className="mt-4 text-3xl font-black text-text uppercase">Commander missing</div>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-text-dim">
          This bridge needs a primary commander before it can act as the live executive surface for the system.
        </p>
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
      descriptionClassName="max-w-2xl text-[15px] leading-7 text-text-dim"
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
            className="group inline-flex items-center gap-4 rounded-[26px] border border-hairline bg-panel p-1.5 pr-6 text-sm font-black text-text transition-all hover:bg-panel-strong shadow-main"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-canvas border border-hairline shadow-inner">
              <MessageSquareText className="h-5 w-5 text-aurora-teal" />
            </span>
            <span className="min-w-0 text-left">
              <span className="block text-base font-black tracking-tight leading-none">Open Mission Control</span>
              <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.2em] text-text-dim opacity-60">Primary launch lane</span>
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => onOpenDetail?.(commander.id)}
            className="ui-button-secondary inline-flex items-center gap-3 rounded-[24px] px-6 py-4 text-xs font-black uppercase tracking-widest text-text shadow-main"
          >
            <Gauge className="h-4 w-4 text-aurora-blue" />
            Tune Commander
          </button>
        </>
      )}
      sideContent={(
        <div className="ui-panel w-full p-6 backdrop-blur-md shadow-main border-hairline">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">System Pulse</div>
            <div className={cn(
              "rounded-lg border px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] shadow-sm",
              readiness.state === 'ready' ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green' :
              readiness.state === 'blocked' ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose' :
              'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
            )}>
              {readiness.state}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <PulseStat label="Live missions" value={summary.runningTasks} tone="text-aurora-teal" />
            <PulseStat label="Needs decision" value={summary.pendingApprovals} tone="text-aurora-amber" />
            <PulseStat label="Blocked / failed" value={summary.failedTasks + summary.stalledAgents + summary.lateSchedules} tone="text-aurora-rose" />
            <PulseStat label="Burn / hour" value={`$${Number(summary.burnRate || 0).toFixed(2)}`} tone="text-aurora-violet" />
          </div>

          <div className="mt-6 p-1 bg-panel-soft rounded-2xl border border-hairline">
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">
                <Sparkles className="h-3.5 w-3.5 text-aurora-teal" />
                Bridge readback
              </div>
              
              <div className="ui-card-row p-4 border-hairline bg-panel shadow-sm">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim">Primary commander</div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-black text-text tracking-tight uppercase">{commander.name}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">{commander.status || 'OFFLINE'} POSTURE</div>
                  </div>
                  <div className="ui-chip px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] bg-aurora-amber/10 border-aurora-amber/20 text-aurora-amber">
                    Commander
                  </div>
                </div>
              </div>
              
              <p className="px-1 text-[13px] leading-relaxed text-text-dim font-medium italic">
                "{readiness.readback}"
              </p>
              
              <div className="flex flex-wrap gap-2 pt-2">
                <div className="ui-chip px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-panel border-hairline">
                  {provider || 'Sovereign'}
                </div>
                <div className="ui-chip px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-panel border-hairline">
                  {commander.model || 'Unknown Backbone'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    />
  );
}
