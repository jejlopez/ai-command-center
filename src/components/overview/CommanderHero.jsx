import { motion } from 'framer-motion';
import { Crown, MessageSquareText, Settings2, Sparkles } from 'lucide-react';
import { CommanderNetworkVisual } from './CommanderNetworkVisual';

function StatusBadge({ status }) {
  const styles = {
    processing: 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal',
    idle: 'border-white/10 bg-white/[0.04] text-text-muted',
    error: 'border-aurora-rose/25 bg-aurora-rose/10 text-aurora-rose',
  };

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.16em] ${styles[status] || styles.idle}`}>
      {status || 'unknown'}
    </span>
  );
}

function buildCommanderLine(summary) {
  if (summary.lateSchedules > 0) return `${summary.lateSchedules} late schedule${summary.lateSchedules > 1 ? 's need' : ' needs'} intervention.`;
  if (summary.pendingApprovals > 0) return `${summary.pendingApprovals} approval${summary.pendingApprovals > 1 ? 's are' : ' is'} waiting for your sign-off.`;
  if (summary.runningTasks > 0) return `${summary.runningTasks} live task${summary.runningTasks > 1 ? 's are' : ' is'} currently in motion.`;
  return 'Commander is clear and ready for new instructions.';
}

export function CommanderHero({ commander, provider, operatorCount, ephemeralCount = 0, summary, onOpenDetail, onNavigate }) {
  if (!commander) {
    return (
      <div className="jarvis-console p-6 sm:p-8">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-aurora-amber">
          <Crown className="h-3.5 w-3.5" />
          Command Center
        </div>
        <div className="mt-2 text-2xl font-semibold text-text-primary">Commander missing</div>
        <div className="mt-2 text-sm text-text-muted">This workspace needs a default Commander before orchestration can run cleanly.</div>
      </div>
    );
  }

  const commanderLine = buildCommanderLine(summary);

  return (
    <div className="jarvis-console overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(0,217,200,0.16),transparent_24%),radial-gradient(circle_at_86%_18%,rgba(96,165,250,0.18),transparent_20%),linear-gradient(120deg,rgba(255,255,255,0.035),transparent_46%)]" />
      <div className="relative flex flex-col gap-7 p-6 sm:p-8 lg:gap-9 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.88fr)] xl:items-center xl:gap-10">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-aurora-amber">
              <Crown className="h-3.5 w-3.5" />
              Commander
            </div>
            <div className="h-px min-w-16 flex-1 bg-gradient-to-r from-white/15 to-transparent" />
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-aurora-teal shadow-[0_0_10px_rgba(0,217,200,0.9)]" />
              Live command link
            </div>
          </div>

          <div className="mt-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mt-3 flex flex-wrap items-end gap-4">
                <div className="flex items-center gap-4">
                  <div className="commander-rank-tile">
                    <Crown className="h-6 w-6 text-aurora-amber" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-aurora-amber">Primary Commander</div>
                    <div className="mt-1 text-4xl font-semibold tracking-[-0.03em] text-text-primary sm:text-6xl">
                      {commander.name}
                    </div>
                  </div>
                </div>
                <StatusBadge status={commander.status} />
              </div>
            </div>
            <button
              onClick={() => onOpenDetail?.(commander.id)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-text-primary transition-colors hover:bg-white/[0.07]"
              aria-label="Configure Commander"
            >
              <Settings2 className="h-4.5 w-4.5 text-aurora-blue" />
            </button>
          </div>

          <div className="mt-5 max-w-2xl text-2xl font-semibold leading-[1.15] text-text-primary sm:text-[2rem]">
            {commanderLine}
          </div>
          <div className="mt-3 max-w-xl text-sm leading-6 text-text-body">
            Commander coordinates approvals, routing, and operator execution across the system.
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
            <div className="commander-runtime-slab min-w-0 flex-1">
              <div className="commander-runtime-section">
                <div className="commander-meta-label text-aurora-teal/90">Provider</div>
                <div className="commander-meta-value">{provider || 'Unknown'}</div>
              </div>
              <div className="commander-runtime-divider" />
              <div className="commander-runtime-section min-w-0">
                <div className="commander-meta-label text-aurora-blue/90">Model</div>
                <div className="commander-meta-value">{commander.model || 'Unassigned'}</div>
              </div>
            </div>
            <div className="commander-delegate-stat">
              <div className="commander-meta-label text-aurora-violet/90">Operators</div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-semibold tracking-[-0.03em] text-text-primary">{operatorCount}</span>
                <span className="pb-1 text-xs uppercase tracking-[0.18em] text-text-muted">
                  operator{operatorCount === 1 ? '' : 's'}
                </span>
              </div>
              {ephemeralCount > 0 && (
                <div className="mt-1.5 text-[10px] font-mono text-text-disabled">
                  +{ephemeralCount} temp active
                </div>
              )}
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onNavigate?.('missions')}
              className="commander-comms-button w-full sm:w-auto"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/16 ring-1 ring-black/10">
                <MessageSquareText className="h-5 w-5" />
              </span>
              <span className="min-w-0 text-left">
                <span className="block text-base font-semibold leading-tight">Open Commander Comms</span>
                <span className="mt-1 block text-[10px] uppercase tracking-[0.2em] text-black/70">Primary channel</span>
              </span>
            </motion.button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate?.('missions')}
              className="commander-signal-chip commander-signal-chip-alert text-aurora-amber"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {summary.needsAttention} needs attention
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('missions')}
              className={`commander-signal-chip ${summary.pendingApprovals > 0 ? 'commander-signal-chip-actionable' : ''}`}
            >
              {summary.pendingApprovals} approvals
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center xl:justify-end">
          <CommanderNetworkVisual specialistCount={operatorCount} summary={summary} />
        </div>
      </div>
    </div>
  );
}
