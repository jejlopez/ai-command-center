import { AlertTriangle, PlugZap, Rocket, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../utils/cn';

function InterventionButton({ icon, label, detail, tone = 'teal', onClick }) {
  const IconComponent = icon;
  const toneClass = {
    teal: 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal',
    amber: 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber',
    rose: 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose',
    blue: 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[18px] border border-white/8 bg-black/20 p-4 text-left transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn('rounded-xl border p-2', toneClass[tone])}>
          <IconComponent className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 text-sm font-semibold text-text-primary">{label}</div>
      <div className="mt-2 text-[12px] leading-relaxed text-text-muted">{detail}</div>
    </button>
  );
}

export function TacticalInterventionConsole({
  truth,
  onOpenApprovals,
  onOpenSystems,
  onOpenCreator,
  onOpenOps,
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Tactical Intervention</div>
          <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-text-primary">One place to change the deck fast.</div>
        </div>
        <div className={cn(
          'rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
          truth.readinessState === 'ready'
            ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green'
            : truth.readinessState === 'blocked'
              ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
              : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
        )}>
          {truth.readinessLabel}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <InterventionButton
          icon={ShieldCheck}
          label="Clear approval pressure"
          detail={truth.pendingApprovals > 0 ? `${truth.pendingApprovals} approvals are still waiting.` : 'Approval lane is already clear.'}
          tone="amber"
          onClick={onOpenApprovals}
        />
        <InterventionButton
          icon={PlugZap}
          label="Check systems dock"
          detail={truth.connectedSystemsCount > 0 ? `${truth.connectedSystemsCount} connected systems are live.` : 'No connected systems are wired yet.'}
          tone="blue"
          onClick={onOpenSystems}
        />
        <InterventionButton
          icon={Rocket}
          label="Launch next mission"
          detail="Open the mission creator with the current doctrine and system truth already in play."
          tone="teal"
          onClick={onOpenCreator}
        />
        <InterventionButton
          icon={SlidersHorizontal}
          label="Stabilize live deck"
          detail={truth.blockedMissions > 0 || truth.criticalAlerts > 0 ? 'Switch back to operations and handle failures first.' : 'Stay on operations and keep launch posture tight.'}
          tone={truth.blockedMissions > 0 || truth.criticalAlerts > 0 ? 'rose' : 'teal'}
          onClick={onOpenOps}
        />
      </div>

      {truth.readinessFailures.length > 0 && (
        <div className="mt-4 rounded-[18px] border border-aurora-amber/20 bg-aurora-amber/[0.07] px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-amber">
            <AlertTriangle className="h-3.5 w-3.5" />
            Current blockers
          </div>
          <div className="mt-3 space-y-2">
            {truth.readinessFailures.slice(0, 3).map((failure) => (
              <div key={failure.id} className="text-[12px] leading-relaxed text-text-body">
                <span className="font-semibold text-text-primary">{failure.label}:</span> {failure.detail}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
