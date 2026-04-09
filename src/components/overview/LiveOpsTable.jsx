import { ArrowRight, CircleAlert, Clock3, Loader2, Radio, ShieldAlert, Sparkles } from 'lucide-react';
import { CommandSectionHeader } from '../command/CommandSectionHeader';
import { cn } from '../../utils/cn';

const statusTone = {
  error: 'text-aurora-rose border-aurora-rose/20 bg-aurora-rose/10',
  pending: 'text-aurora-blue border-aurora-blue/20 bg-aurora-blue/10',
  running: 'text-aurora-amber border-aurora-amber/20 bg-aurora-amber/10',
  completed: 'text-aurora-green border-aurora-green/20 bg-aurora-green/10',
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

function urgencyTone(task) {
  if (task.status === 'error') return 'border-aurora-rose/18 bg-[linear-gradient(135deg,rgba(251,113,133,0.08),rgba(255,255,255,0.02))]';
  if (task.needsReview) return 'border-aurora-amber/18 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(255,255,255,0.02))]';
  if (task.status === 'running') return 'border-aurora-teal/18 bg-[linear-gradient(135deg,rgba(45,212,191,0.08),rgba(255,255,255,0.02))]';
  return 'border-white/8 bg-black/20';
}

export function LiveOpsTable({ tasks, loading, onOpenDetail, onNavigate }) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5">
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
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-white/[0.05]"
          >
            Open Mission Control
          </button>
        )}
      />

      <div className="space-y-3">
        {loading && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 px-5 py-10 text-center text-text-muted">
            <div className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-aurora-teal" />
              Loading live command queue
            </div>
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="rounded-[22px] border border-white/8 bg-black/20 px-6 py-10 text-center">
            <div className="text-base font-semibold text-text-primary">No live queue right now</div>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              The bridge is clear. Launch a mission or let the automation lanes take the next cycle.
            </p>
          </div>
        )}

        {!loading && tasks.map((task) => (
          <div
            key={task.id}
            className={cn(
              'rounded-[22px] border p-4 transition-colors hover:bg-white/[0.04]',
              urgencyTone(task)
            )}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-text-primary">{task.name}</div>
                  <div className={cn('inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em]', statusTone[task.status] || 'border-white/10 bg-white/[0.04] text-text-muted')}>
                    {task.status === 'error'
                      ? <CircleAlert className="h-3 w-3" />
                      : task.needsReview
                        ? <ShieldAlert className="h-3 w-3" />
                        : <Clock3 className="h-3 w-3" />}
                    {task.needsReview ? 'review' : task.status}
                  </div>
                  {task.needsReview && (
                    <div className="inline-flex items-center gap-1 rounded-full border border-aurora-amber/20 bg-aurora-amber/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-amber">
                      <Sparkles className="h-3 w-3" />
                      human gate
                    </div>
                  )}
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{task.blocker}</p>
              </div>

              <button
                type="button"
                onClick={() => (task.needsReview ? onNavigate?.('missions') : onOpenDetail?.(task.agentId))}
                className="inline-flex items-center gap-1.5 self-start rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-text-primary transition-colors hover:bg-white/[0.06]"
              >
                {task.needsReview ? 'Resolve in Missions' : 'Open Operator'}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Operator</div>
                <div className="mt-2 text-sm font-semibold text-text-primary">{task.agentName || 'Unassigned'}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Runtime</div>
                <div className="mt-2 font-mono text-sm text-text-primary">{formatDuration(task.durationMs)}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Cost</div>
                <div className="mt-2 font-mono text-sm text-text-primary">${Number(task.costUsd || 0).toFixed(3)}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Posture</div>
                <div className="mt-2 text-sm font-semibold text-text-primary">
                  {task.status === 'error' ? 'Recovery needed' : task.needsReview ? 'Waiting on commander' : task.status === 'pending' ? 'Queued for launch' : 'Advancing'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
