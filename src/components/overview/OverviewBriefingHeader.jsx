import { motion } from 'framer-motion';
import { Plus, ShieldAlert, TimerReset } from 'lucide-react';
import { JarvisHalo } from '../JarvisHalo';

export function OverviewBriefingHeader({ summary, onDeploy, onNavigate }) {
  return (
    <div className="relative overflow-hidden spatial-panel">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(96,165,250,0.18),transparent_28%),radial-gradient(circle_at_85%_12%,rgba(167,139,250,0.14),transparent_26%),linear-gradient(120deg,rgba(255,255,255,0.05),transparent_44%)]" />
      <div className="relative flex flex-col gap-8 p-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-text-muted">
            <ShieldAlert className="h-3.5 w-3.5 text-aurora-violet" />
            Jarvis Operations Briefing
          </div>
          <div className="mt-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
            {summary.primaryMessage}
          </div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-text-muted">
            Prioritize human approvals, unblock stalled work, and keep an eye on burn and failure concentration before diving into detailed logs.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-text-disabled">
            <span className="rounded-full border border-aurora-amber/25 bg-aurora-amber/10 px-3 py-1.5 text-aurora-amber">
              {summary.needsAttention} needs attention
            </span>
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
              {summary.runningTasks} running tasks
            </span>
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
              {summary.scheduledJobs} schedules tracked
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 xl:items-end">
          <JarvisHalo className="h-[180px] w-[180px] sm:h-[220px] sm:w-[220px]" />
          <div className="flex flex-wrap justify-center gap-2 xl:justify-end">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onDeploy}
              className="flex items-center gap-2 rounded-xl bg-aurora-teal px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-aurora-teal/90 shadow-glow-teal"
            >
              <Plus className="h-4 w-4" />
              Deploy Agent
            </motion.button>
            <button
              onClick={() => onNavigate?.('missions')}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white/[0.05]"
            >
              <TimerReset className="h-4 w-4 text-aurora-amber" />
              Open Missions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
