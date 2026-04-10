import { ArrowRight, CircleAlert, Clock3, Loader2, Radio, ShieldAlert, Sparkles } from 'lucide-react';
import { CommandSectionHeader } from '../command/CommandSectionHeader';
import { cn } from '../../utils/cn';

const statusTone = {
  error: 'text-aurora-rose border-aurora-rose/25 bg-aurora-rose/10',
  pending: 'text-aurora-blue border-aurora-blue/25 bg-aurora-blue/10',
  running: 'text-aurora-amber border-aurora-amber/25 bg-aurora-amber/10',
  completed: 'text-aurora-green border-aurora-green/25 bg-aurora-green/10',
};

function formatDuration(ms) {
  if (!ms || ms === 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function urgencyTone(task) {
  if (task.status === 'error') return 'border-aurora-rose/35 bg-gradient-to-br from-aurora-rose/5 to-transparent';
  if (task.needsReview) return 'border-aurora-amber/35 bg-gradient-to-br from-aurora-amber/5 to-transparent';
  if (task.status === 'running') return 'border-aurora-teal/35 bg-gradient-to-br from-aurora-teal/5 to-transparent';
  return 'border-hairline bg-panel-soft/50';
}

export function LiveOpsTable({ tasks, loading, onOpenDetail, onNavigate }) {
  return (
    <div className="ui-panel p-6 shadow-main border-hairline bg-panel">
      <CommandSectionHeader
        eyebrow="Immediate Action Zone"
        title="Command Queue"
        description="The live lane for running, blocked, and human-gated work."
        icon={Radio}
        tone="teal"
        action={(
          <button
            type="button"
            onClick={() => onNavigate?.('missions')}
            className="ui-button-secondary px-4 py-2 text-xs font-black uppercase tracking-widest shadow-sm"
          >
            Open Mission Control
          </button>
        )}
      />

      <div className="mt-6 space-y-4">
        {loading && (
          <div className="ui-card-row px-6 py-12 text-center text-text-dim border-hairline bg-panel-soft">
            <div className="inline-flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-aurora-teal" />
              <span className="font-black uppercase tracking-widest text-[10px]">Loading live command queue</span>
            </div>
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="ui-card-row px-8 py-16 text-center border-dashed border-hairline/40 rounded-2xl">
            <div className="text-xl font-black text-text uppercase tracking-tight">No live queue right now</div>
            <p className="mt-3 text-sm leading-relaxed text-text-dim font-medium italic">
              "The bridge is clear. Launch a mission or let the automation lanes take the next cycle."
            </p>
          </div>
        )}

        {!loading && tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              'ui-card-row p-6 transition-all hover:scale-[1.01] border shadow-sm',
              urgencyTone(task)
            )}
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-lg font-black text-text uppercase tracking-tight">{task.name}</div>
                  <div className={cn('inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] shadow-sm', statusTone[task.status] || 'border-hairline bg-panel-soft text-text-dim')}>
                    {task.status === 'error'
                      ? <CircleAlert className="h-3 w-3" />
                      : task.needsReview
                        ? <ShieldAlert className="h-3 w-3" />
                        : <Clock3 className="h-3 w-3" />}
                    {task.needsReview ? 'REVIEW ARCHIVE' : task.status}
                  </div>
                  {task.needsReview && (
                    <div className="inline-flex items-center gap-2 rounded-lg border border-aurora-amber/25 bg-aurora-amber/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-aurora-amber shadow-sm">
                      <Sparkles className="h-3 w-3" />
                      Commander Gate
                    </div>
                  )}
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-text-dim font-medium italic opacity-80">"{task.blocker}"</p>
              </div>

              <button
                type="button"
                onClick={() => (task.needsReview ? onNavigate?.('missions') : onOpenDetail?.(task.agentId))}
                className="ui-button-secondary inline-flex items-center gap-2 rounded-xl self-start px-5 py-3 text-[10px] font-black uppercase tracking-widest shadow-sm bg-panel"
              >
                {task.needsReview ? 'Resolve on bridge' : 'Open Node Detail'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              <div className="ui-stat px-4 py-4 bg-panel-soft border border-hairline rounded-xl shadow-inner">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70">Operator Node</div>
                <div className="mt-2 text-xs font-black text-text uppercase tracking-tight">{task.agentName || 'Unassigned'}</div>
              </div>
              <div className="ui-stat px-4 py-4 bg-panel-soft border border-hairline rounded-xl shadow-inner">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70">Runtime Active</div>
                <div className="mt-2 font-mono text-xs font-black text-text">{formatDuration(task.durationMs)}</div>
              </div>
              <div className="ui-stat px-4 py-4 bg-panel-soft border border-hairline rounded-xl shadow-inner">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70">Unit Cost</div>
                <div className="mt-2 font-mono text-xs font-black text-aurora-teal">${Number(task.costUsd || 0).toFixed(3)}</div>
              </div>
              <div className="ui-stat px-4 py-4 bg-panel-soft border border-hairline rounded-xl shadow-inner">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70">Strategic Posture</div>
                <div className="mt-2 text-[10px] font-black text-text uppercase tracking-tighter">
                  {task.status === 'error' ? 'Recovery Lane' : task.needsReview ? 'Human Pending' : task.status === 'pending' ? 'Queued' : 'Advancing'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
