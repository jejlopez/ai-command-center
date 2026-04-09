import { motion as Motion } from 'framer-motion';
import { Plus, ShieldAlert, TimerReset } from 'lucide-react';
import { JarvisHalo } from '../JarvisHalo';
import { CommandDeckHero } from '../command/CommandDeckHero';

export function OverviewBriefingHeader({ summary, onDeploy, onNavigate }) {
  const actions = (
    <>
      <Motion.button
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={onDeploy}
        className="flex items-center gap-2 rounded-xl bg-aurora-teal px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-aurora-teal/90 shadow-glow-teal"
      >
        <Plus className="h-4 w-4" />
        Deploy Agent
      </Motion.button>
      <Motion.button
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onNavigate?.('missions')}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white/[0.05]"
      >
        <TimerReset className="h-4 w-4 text-aurora-amber" />
        Open Missions
      </Motion.button>
    </>
  );

  const sideContent = (
    <div className="rounded-[24px] border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Command posture</span>
        <span className="text-[10px] font-mono text-aurora-teal">STABLE</span>
      </div>
      <div className="mt-4 space-y-3 text-[12px]">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Needs attention</span>
          <span className="font-semibold text-aurora-amber">{summary.needsAttention}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Running tasks</span>
          <span className="font-semibold text-text-primary">{summary.runningTasks}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Schedules tracked</span>
          <span className="font-semibold text-text-primary">{summary.scheduledJobs}</span>
        </div>
      </div>
    </div>
  );

  return (
    <CommandDeckHero
      glow="blue"
      eyebrow="Jarvis Operations Briefing"
      eyebrowIcon={ShieldAlert}
      title={summary.primaryMessage}
      description="Human approvals, blocked work, burn rate, and mission drag are already surfaced for you. This page should answer what matters before you dive into any lane."
      badges={[
        { label: 'needs attention', value: summary.needsAttention, tone: 'amber' },
        { label: 'running tasks', value: summary.runningTasks, tone: 'blue' },
        { label: 'schedules tracked', value: summary.scheduledJobs, tone: 'violet' },
      ]}
      actions={actions}
      orb={<JarvisHalo className="h-[180px] w-[180px] sm:h-[220px] sm:w-[220px]" />}
      sideContent={sideContent}
    />
  );
}
