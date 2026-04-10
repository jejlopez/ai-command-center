import { Bot, Gauge, ShieldCheck, TriangleAlert } from 'lucide-react';
import { cn } from "../../utils/cn";
import { CommandSectionHeader } from '../command/CommandSectionHeader';

function PostureStat({ label, value, tone = 'text-aurora-teal', detail }) {
  return (
    <div className="ui-stat p-6 bg-panel shadow-sm border-hairline transition-all hover:scale-[1.02] rounded-2xl">
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70">{label}</div>
      <div className={cn("mt-4 text-4xl font-black tracking-tighter uppercase", tone)}>{value}</div>
      {detail ? <p className="mt-4 text-[12px] leading-relaxed text-text-dim font-medium italic opacity-80">"{detail}"</p> : null}
    </div>
  );
}

export function AutonomyPosturePanel({ posture }) {
  return (
    <div className="ui-panel p-6 shadow-main border-hairline bg-panel">
      <CommandSectionHeader
        eyebrow="Autonomy Posture"
        title={posture.title}
        description={posture.description}
        icon={Bot}
        tone="violet"
        action={(
          <span className={cn(
            "rounded-lg border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm",
            posture.state === 'self-driving' ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green' :
            posture.state === 'gated' ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose' :
            'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
          )}>
            {posture.state}
          </span>
        )}
      />

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <PostureStat
          label="Autonomous flow"
          value={`${posture.autonomousPercent}%`}
          tone="text-aurora-teal"
          detail="Work advancing without a human stop signal."
        />
        <PostureStat
          label="Human gates"
          value={posture.humanGates}
          tone="text-aurora-amber"
          detail="Approvals or intervention points slowing throughput."
        />
        <PostureStat
          label="Recovery drag"
          value={posture.recoveryDrag}
          tone="text-aurora-rose"
          detail="Failures, stale agents, or late systems reducing trust."
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="ui-panel-soft p-5 border-hairline bg-panel-soft shadow-inner rounded-xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">
            <Gauge className="h-4 w-4 text-aurora-blue" />
            Readiness score
          </div>
          <div className="mt-3 text-2xl font-black text-text uppercase tracking-tight">{posture.score}/100</div>
          <p className="mt-3 text-[12px] leading-relaxed text-text-dim font-medium italic">"{posture.readback}"</p>
        </div>
        <div className="ui-panel-soft p-5 border-hairline bg-panel-soft shadow-inner rounded-xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">
            <ShieldCheck className="h-4 w-4 text-aurora-teal" />
            Strongest lane
          </div>
          <div className="mt-3 text-sm font-black text-text uppercase tracking-widest">{posture.strongestLane}</div>
          <p className="mt-3 text-[12px] leading-relaxed text-text-dim">The cleanest place to push more volume right now.</p>
        </div>
        <div className="ui-panel-soft p-5 border-hairline bg-panel-soft shadow-inner rounded-xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">
            <TriangleAlert className="h-4 w-4 text-aurora-amber" />
            Primary drag
          </div>
          <div className="mt-3 text-sm font-black text-text uppercase tracking-widest">{posture.primaryDrag}</div>
          <p className="mt-3 text-[12px] leading-relaxed text-text-dim">This is the bottleneck to remove before the machine scales cleanly.</p>
        </div>
      </div>
    </div>
  );
}
