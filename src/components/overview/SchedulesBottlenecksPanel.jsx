import { motion as Motion } from 'framer-motion';
import { Clock3, GitBranch, PauseCircle } from 'lucide-react';
import { cn } from "../../utils/cn";
import { CommandSectionHeader } from '../command/CommandSectionHeader';

function formatNextRun(isoString) {
  if (!isoString) return 'No next run';
  const date = new Date(isoString);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function badgeClasses(kind) {
  if (kind === 'late') return 'border-aurora-rose/30 bg-aurora-rose/10 text-aurora-rose shadow-sm';
  if (kind === 'paused') return 'border-hairline bg-panel-soft text-text-dim';
  if (kind === 'active') return 'border-aurora-teal/30 bg-aurora-teal/10 text-aurora-teal shadow-sm';
  if (kind === 'missed') return 'text-aurora-rose';
  if (kind === 'success') return 'text-aurora-green';
  if (kind === 'failed') return 'text-aurora-rose';
  if (kind === 'running') return 'text-aurora-blue';
  return 'text-text';
}

export function SchedulesBottlenecksPanel({ summary, schedules, loading, referenceNow }) {
  const blockers = [
    { label: 'Awaiting approval', value: summary.pendingApprovals, tone: 'text-aurora-amber' },
    { label: 'Failed tasks', value: summary.failedTasks, tone: 'text-aurora-rose' },
    { label: 'Stalled units', value: summary.stalledAgents, tone: 'text-aurora-blue' },
  ];
  const sortedSchedules = [...schedules].sort((a, b) => {
    const aLate = a.status === 'active' && a.nextRunAt && new Date(a.nextRunAt).getTime() < referenceNow;
    const bLate = b.status === 'active' && b.nextRunAt && new Date(b.nextRunAt).getTime() < referenceNow;
    if (aLate !== bLate) return aLate ? -1 : 1;
    if (a.status !== b.status) {
      if (a.status === 'active') return -1;
      if (b.status === 'active') return 1;
    }
    return new Date(a.nextRunAt || 0).getTime() - new Date(b.nextRunAt || 0).getTime();
  });
  const blockersTotal = blockers.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="ui-panel p-6 shadow-main border-hairline bg-panel">
      <CommandSectionHeader
        eyebrow="Immediate Action Zone"
        title="Automation Radar"
        description="Scheduled work visibility and the bottlenecks holding the machine back."
        icon={GitBranch}
        tone="violet"
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="ui-panel-soft p-5 border-hairline bg-panel-soft shadow-inner rounded-xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-text-dim">
            <Clock3 className="h-4 w-4 text-aurora-blue" />
            Schedule Visibility
          </div>
          <div className="mt-6 space-y-4 text-sm">
            <div className="ui-stat flex items-center justify-between px-4 py-3 bg-panel border-hairline shadow-sm rounded-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">Cron jobs tracked</span>
              <span className="font-mono text-base font-black text-text">{loading ? '...' : schedules.length}</span>
            </div>
            <div className="ui-stat flex items-center justify-between px-4 py-3 bg-panel border-hairline shadow-sm rounded-lg">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">Late schedules</span>
              <span className={cn("font-mono text-base font-black", summary.lateSchedules > 0 ? "text-aurora-rose" : "text-text")}>{loading ? '...' : summary.lateSchedules}</span>
            </div>
            
            {loading && (
              <div className="ui-card-row px-5 py-6 text-center text-text-dim italic">
                Gathering autonomous drift metrics...
              </div>
            )}
            
            {!loading && schedules.length === 0 && (
              <div className="ui-card-row px-5 py-8 text-center text-text-dim border-dashed border-hairline/40 italic">
                "No scheduled jobs configured in the flagship vault."
              </div>
            )}

            {!loading && sortedSchedules.length > 0 && sortedSchedules.slice(0, 3).map((job) => {
              const isLate = job.status === 'active' && job.nextRunAt && new Date(job.nextRunAt).getTime() < referenceNow;
              return (
                <div
                  key={job.id}
                  className={cn(
                    'ui-card-row p-5 transition-all hover:bg-panel shadow-sm border',
                    isLate ? 'border-aurora-rose/35 bg-aurora-rose/5' : 'border-hairline bg-panel'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-black text-text uppercase tracking-tight">{job.name}</div>
                      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70">{job.agentName} · {job.scheduleLabel}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLate && (
                        <span className={cn("ui-chip px-2.5 py-1 text-[9px] font-black uppercase tracking-widest", badgeClasses('late'))}>
                          Late
                        </span>
                      )}
                      <span className={cn("ui-chip px-2.5 py-1 text-[9px] font-black uppercase tracking-widest", badgeClasses(job.status))}>
                        {job.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-text-dim">Next window</div>
                      <div className={cn("mt-2 font-mono text-xs font-black", isLate ? 'text-aurora-rose' : 'text-text')}>{formatNextRun(job.nextRunAt)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-text-dim">Last result</div>
                      <div className={cn("mt-2 font-mono text-xs font-black uppercase", badgeClasses(job.lastRunStatus))}>{job.lastRunStatus}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="ui-panel-soft p-5 border-hairline bg-panel-soft shadow-inner rounded-xl">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-text-dim">
            <GitBranch className="h-4 w-4 text-aurora-violet" />
            Bottleneck Map
          </div>
          
          {blockersTotal === 0 && (
            <div className="mt-6 ui-card-row border-aurora-green/20 bg-aurora-green/5 p-6 shadow-sm">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-aurora-green">Clear flow posture</div>
              <p className="mt-3 text-[13px] leading-relaxed text-text-dim italic">
                "No active approval, failure, or stalled-operator bottlenecks detected from command."
              </p>
            </div>
          )}

          <div className="mt-6 space-y-6 px-1">
            {blockers.map((item) => (
              <div key={item.label} className="group">
                <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-widest">
                  <span className="text-text-dim">{item.label}</span>
                  <span className={cn("font-black", item.tone)}>{item.value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-canvas border border-hairline shadow-inner">
                  {blockersTotal > 0 && (
                    <Motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(item.value * 18, item.value ? 12 : 4))}%` }}
                      transition={{ duration: 0.8, ease: "circOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-aurora-violet via-aurora-blue to-aurora-teal shadow-[0_0_10px_-2px_var(--color-aurora-violet)]"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-3">
            <div className="ui-stat flex items-center justify-between px-5 py-4 bg-panel border-hairline shadow-sm rounded-xl">
              <span className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-text-dim">
                <PauseCircle className="h-4 w-4 text-aurora-amber" /> 
                Oldest pending
              </span>
              <span className="font-mono text-sm font-black text-text">{summary.oldestPendingLabel}</span>
            </div>
            <div className="ui-stat flex items-center justify-between px-5 py-4 bg-panel border-hairline shadow-sm rounded-xl">
              <span className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-text-dim">
                <Clock3 className="h-4 w-4 text-aurora-blue" /> 
                Avg wait
              </span>
              <span className="font-mono text-sm font-black text-text">{summary.avgApprovalWaitLabel}</span>
            </div>
            <div className="ui-stat flex items-center justify-between px-5 py-4 bg-panel border-hairline shadow-sm rounded-xl">
              <span className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-text-dim">
                <Clock3 className="h-4 w-4 text-aurora-rose" /> 
                DRAG PEAK
              </span>
              <span className="font-mono text-sm font-black text-text-dim">{summary.longestApprovalWaitLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
