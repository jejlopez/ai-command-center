import { Clock3, GitBranch, PauseCircle } from 'lucide-react';

function formatNextRun(isoString) {
  if (!isoString) return 'No next run';
  const date = new Date(isoString);
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function badgeClasses(kind) {
  if (kind === 'late') return 'border-aurora-rose/30 bg-aurora-rose/10 text-aurora-rose';
  if (kind === 'paused') return 'border-white/10 bg-white/[0.04] text-text-muted';
  if (kind === 'active') return 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal';
  if (kind === 'missed') return 'text-aurora-rose';
  if (kind === 'success') return 'text-aurora-green';
  if (kind === 'failed') return 'text-aurora-rose';
  if (kind === 'running') return 'text-aurora-blue';
  return 'text-text-primary';
}

export function SchedulesBottlenecksPanel({ summary, schedules, loading }) {
  const blockers = [
    { label: 'Awaiting approval', value: summary.pendingApprovals, tone: 'text-aurora-amber' },
    { label: 'Failed tasks', value: summary.failedTasks, tone: 'text-aurora-rose' },
    { label: 'Stalled agents', value: summary.stalledAgents, tone: 'text-aurora-blue' },
  ];
  const sortedSchedules = [...schedules].sort((a, b) => {
    const now = Date.now();
    const aLate = a.status === 'active' && a.nextRunAt && new Date(a.nextRunAt).getTime() < now;
    const bLate = b.status === 'active' && b.nextRunAt && new Date(b.nextRunAt).getTime() < now;
    if (aLate !== bLate) return aLate ? -1 : 1;
    if (a.status !== b.status) {
      if (a.status === 'active') return -1;
      if (b.status === 'active') return 1;
    }
    return new Date(a.nextRunAt || 0).getTime() - new Date(b.nextRunAt || 0).getTime();
  });
  const blockersTotal = blockers.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="jarvis-console p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.26em] text-text-disabled">Schedules & Bottlenecks</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">Operational bottlenecks and scheduled work</div>
          <div className="mt-2 text-sm leading-6 text-text-muted">
            Monitor what is queued, what is late, and which automations are drifting out of rhythm.
          </div>
        </div>
        <div className="hidden rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-text-muted md:block">
          Jarvis Ops Grid
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="jarvis-column p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-disabled">
            <Clock3 className="h-3.5 w-3.5 text-aurora-blue" />
            Schedule Visibility
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="jarvis-kpi flex items-center justify-between px-3 py-2">
              <span className="text-text-muted">Cron jobs tracked</span>
              <span className="font-mono text-text-primary">{loading ? '...' : schedules.length}</span>
            </div>
            <div className="jarvis-kpi flex items-center justify-between px-3 py-2">
              <span className="text-text-muted">Late schedules</span>
              <span className="font-mono text-text-primary">{loading ? '...' : summary.lateSchedules}</span>
            </div>
            {loading && (
              <div className="jarvis-schedule-card px-4 py-4 text-text-muted">
                Loading schedules...
              </div>
            )}
            {!loading && schedules.length === 0 && (
              <div className="jarvis-schedule-card px-4 py-4 text-text-muted">
                No scheduled jobs are configured yet.
              </div>
            )}
            {!loading && sortedSchedules.length > 0 && sortedSchedules.slice(0, 3).map((job) => {
              const isLate = job.status === 'active' && job.nextRunAt && new Date(job.nextRunAt).getTime() < Date.now();
              return (
              <div
                key={job.id}
                className={`jarvis-schedule-card px-5 py-4 ${isLate ? 'jarvis-schedule-card-late' : ''}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold text-text-primary">{job.name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-text-disabled">{job.agentName} · {job.scheduleLabel}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isLate && (
                      <span className={`jarvis-badge ${badgeClasses('late')}`}>
                        Late
                      </span>
                    )}
                    <span className={`jarvis-badge ${badgeClasses(job.status)}`}>
                      {job.status}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="uppercase tracking-[0.16em] text-text-disabled">Next run</div>
                    <div className={`mt-2 font-mono text-[15px] ${isLate ? 'text-aurora-rose' : 'text-text-primary'}`}>{formatNextRun(job.nextRunAt)}</div>
                  </div>
                  <div>
                    <div className="uppercase tracking-[0.16em] text-text-disabled">Last result</div>
                    <div className={`mt-2 font-mono text-[15px] uppercase ${badgeClasses(job.lastRunStatus)}`}>{job.lastRunStatus}</div>
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>

        <div className="jarvis-column p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-disabled">
            <GitBranch className="h-3.5 w-3.5 text-aurora-violet" />
            Current Bottlenecks
          </div>
          {blockersTotal === 0 && (
            <div className="jarvis-callout mt-4 px-4 py-4 text-base font-medium leading-8 text-aurora-green">
              All clear right now. No active approval, failure, or stalled-agent bottlenecks detected.
            </div>
          )}
          <div className="mt-4 space-y-3">
            {blockers.map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-text-muted">{item.label}</span>
                  <span className={`font-mono ${item.tone}`}>{item.value}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.05] shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-aurora-violet via-aurora-blue to-aurora-teal"
                    style={{ width: `${Math.min(100, Math.max(item.value * 18, item.value ? 12 : 4))}%`, opacity: item.value === 0 ? 0.18 : 1 }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            <div className="jarvis-kpi flex items-center justify-between px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-text-muted"><PauseCircle className="h-4 w-4 text-aurora-amber" /> Oldest pending</span>
              <span className="font-mono text-text-primary">{summary.oldestPendingLabel}</span>
            </div>
            <div className="jarvis-kpi flex items-center justify-between px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-text-muted"><Clock3 className="h-4 w-4 text-aurora-blue" /> Avg approval wait</span>
              <span className="font-mono text-text-primary">{summary.avgApprovalWaitLabel}</span>
            </div>
            <div className="jarvis-kpi flex items-center justify-between px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-text-muted"><Clock3 className="h-4 w-4 text-aurora-rose" /> Longest approval wait</span>
              <span className="font-mono text-text-primary">{summary.longestApprovalWaitLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
