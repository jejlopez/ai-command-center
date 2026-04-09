import { ArrowRight, CircleAlert, Clock3, Loader2, ShieldAlert } from 'lucide-react';
import { cn } from '../../utils/cn';

const statusTone = {
  error: 'text-aurora-rose',
  pending: 'text-aurora-blue',
  running: 'text-aurora-amber',
  completed: 'text-aurora-green',
};

function formatDuration(ms) {
  if (!ms || ms <= 0) return 'Queued';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function LiveOpsTable({ tasks, loading, onOpenDetail, onNavigate }) {
  return (
    <div className="spatial-panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-disabled">Live Operations</div>
          <div className="mt-1 text-lg font-semibold text-text-primary">Running, queued, and blocked tasks</div>
        </div>
        <button
          onClick={() => onNavigate?.('missions')}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-white/[0.05]"
        >
          Open Mission Control
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.02] text-[10px] uppercase tracking-[0.16em] text-text-disabled">
            <tr>
              <th className="px-5 py-3 text-left font-medium">Task</th>
              <th className="px-4 py-3 text-left font-medium">Agent</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Runtime</th>
              <th className="px-4 py-3 text-left font-medium">Cost</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-text-muted">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-aurora-teal" />
                    Loading live operations
                  </div>
                </td>
              </tr>
            )}

            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-text-muted">
                  No active or pending tasks right now.
                </td>
              </tr>
            )}

            {!loading && tasks.map((task) => (
              <tr key={task.id} className="border-t border-white/[0.04] align-top hover:bg-white/[0.02]">
                <td className="px-5 py-4">
                  <div className="font-medium text-text-primary">{task.name}</div>
                  <div className="mt-1 text-xs text-text-muted">{task.blocker}</div>
                </td>
                <td className="px-4 py-4 text-text-body">{task.agentName || 'Unassigned'}</td>
                <td className="px-4 py-4">
                  <div className={cn('inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-2.5 py-1 text-xs font-mono uppercase', statusTone[task.status] || 'text-text-muted')}>
                    {task.status === 'error' ? <CircleAlert className="h-3 w-3" /> : task.needsReview ? <ShieldAlert className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                    {task.status}
                  </div>
                </td>
                <td className="px-4 py-4 font-mono text-text-primary">{formatDuration(task.durationMs)}</td>
                <td className="px-4 py-4 font-mono text-text-primary">${task.costUsd.toFixed(3)}</td>
                <td className="px-4 py-4">
                  <button
                    onClick={() => (task.needsReview ? onNavigate?.('missions') : onOpenDetail?.(task.agentId))}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-aurora-teal transition-colors hover:text-white"
                  >
                    {task.needsReview ? 'Missions' : 'Open'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
