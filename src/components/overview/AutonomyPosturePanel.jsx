import { Bot, Gauge, ShieldCheck, TriangleAlert } from 'lucide-react';
import { CommandSectionHeader } from '../command/CommandSectionHeader';

function PostureStat({ label, value, tone = 'text-text-primary', detail }) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-black/20 p-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tracking-[-0.03em] ${tone}`}>{value}</div>
      {detail ? <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{detail}</p> : null}
    </div>
  );
}

export function AutonomyPosturePanel({ posture }) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(167,139,250,0.06),rgba(255,255,255,0.02))] p-5">
      <CommandSectionHeader
        eyebrow="Autonomy Posture"
        title={posture.title}
        description={posture.description}
        icon={Bot}
        tone="violet"
        action={(
          <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            posture.state === 'self-driving'
              ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green'
              : posture.state === 'gated'
                ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
                : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
          }`}>
            {posture.state}
          </span>
        )}
      />

      <div className="grid gap-3 md:grid-cols-3">
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

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
            <Gauge className="h-3.5 w-3.5 text-aurora-blue" />
            Readiness score
          </div>
          <div className="mt-2 text-2xl font-semibold text-text-primary">{posture.score}/100</div>
          <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{posture.readback}</p>
        </div>
        <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-aurora-teal" />
            Strongest lane
          </div>
          <div className="mt-2 text-sm font-semibold text-text-primary">{posture.strongestLane}</div>
          <p className="mt-2 text-[12px] leading-relaxed text-text-muted">The cleanest place to push more volume right now.</p>
        </div>
        <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
            <TriangleAlert className="h-3.5 w-3.5 text-aurora-amber" />
            Primary drag
          </div>
          <div className="mt-2 text-sm font-semibold text-text-primary">{posture.primaryDrag}</div>
          <p className="mt-2 text-[12px] leading-relaxed text-text-muted">This is the bottleneck to remove before the machine scales cleanly.</p>
        </div>
      </div>
    </div>
  );
}
