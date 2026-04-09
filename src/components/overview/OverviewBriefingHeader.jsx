import { motion } from 'framer-motion';
import { ArrowRight, Plus, ShieldAlert, TimerReset } from 'lucide-react';
import { JarvisHalo } from '../JarvisHalo';

export function OverviewBriefingHeader({ summary, onDeploy, onNavigate }) {
  const quickActions = [
    { label: 'Mission Control', route: 'missions', value: summary.pendingApprovals > 0 ? `${summary.pendingApprovals} pending` : 'Queue clear' },
    { label: 'Live Tasks', route: 'overview', value: `${summary.runningTasks} running` },
    { label: 'Schedules', route: 'overview', value: summary.lateSchedules > 0 ? `${summary.lateSchedules} late` : `${summary.scheduledJobs} tracked` },
  ];

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

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="rounded-2xl border border-aurora-amber/25 bg-aurora-amber/10 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-amber">Needs Attention</div>
              <div className="mt-1 font-mono text-2xl text-text-primary">{summary.needsAttention}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-disabled">Active Agents</div>
              <div className="mt-1 font-mono text-2xl text-text-primary">{summary.activeAgents}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-disabled">Burn Rate</div>
              <div className="mt-1 font-mono text-2xl text-text-primary">${summary.burnRate.toFixed(2)}/hr</div>
            </div>
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

      <div className="grid gap-3 border-t border-white/[0.06] p-4 md:grid-cols-3">
        {quickActions.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate?.(item.route)}
            className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
          >
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-disabled">{item.label}</div>
              <div className="mt-1 text-sm font-medium text-text-primary">{item.value}</div>
            </div>
            <ArrowRight className="h-4 w-4 text-text-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}
