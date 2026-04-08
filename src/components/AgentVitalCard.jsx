import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';
import { Send, Eye, Wand2, RotateCcw, AlertTriangle } from 'lucide-react';

const statusConfig = {
  processing: { label: 'In Flow', dot: 'bg-aurora-teal animate-pulse', badge: 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal' },
  idle:       { label: 'Standing By', dot: 'bg-text-muted', badge: 'border-white/10 bg-white/[0.04] text-text-muted' },
  error:      { label: 'Error', dot: 'bg-aurora-rose', badge: 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose' },
};

export function AgentVitalCard({ agent, onOpenDetail, onQuickDispatch, onViewLogs, onTuneAgent }) {
  const status = statusConfig[agent.status] || statusConfig.idle;
  const isError = agent.status === 'error';

  const description = agent.roleDescription
    || agent.systemPrompt?.slice(0, 100)
    || 'Autonomous agent ready for tasking.';

  return (
    <motion.div
      whileHover={{ scale: 1.015, y: -2, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } }}
      whileTap={{ scale: 0.995 }}
      onClick={() => onOpenDetail?.()}
      className="relative h-full cursor-pointer"
    >
      <motion.div
        className={cn(
          'relative h-full overflow-hidden rounded-2xl border transition-all duration-300',
          isError
            ? 'border-aurora-rose/20 bg-[linear-gradient(180deg,rgba(251,113,133,0.06),rgba(17,17,17,0.98))]'
            : 'border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(17,17,17,0.98))]',
        )}
        style={{ boxShadow: isError ? '0 8px 32px rgba(251,113,133,0.08)' : '0 8px 32px rgba(0,0,0,0.28)' }}
      >
        {/* Top accent line */}
        <div
          className="absolute inset-x-0 top-0 h-px opacity-70"
          style={{ background: `linear-gradient(90deg, transparent, ${agent.color}, transparent)` }}
        />

        <div className="flex h-full flex-col justify-between p-5">
          {/* Row 1: Status badge + Token burn */}
          <div className="flex items-start justify-between gap-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05, duration: 0.2 }}
              className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em]', status.badge)}
            >
              <span className={cn('h-2 w-2 rounded-full', status.dot)} />
              {status.label}
            </motion.div>

            <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-2.5 text-right">
              <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-text-disabled">Token Burn</div>
              <div className="mt-0.5 font-mono text-lg font-semibold text-text-primary leading-tight">
                {(agent.totalTokens || 0).toLocaleString()}
              </div>
              <div className="text-[9px] font-mono text-text-disabled">${(agent.totalCost || 0).toFixed(2)} total</div>
            </div>
          </div>

          {/* Row 2: Name + Description */}
          <div className="mt-4 flex-1">
            <h3 className="text-lg font-semibold text-text-primary leading-tight">{agent.name}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted line-clamp-2">
              {description}
            </p>

            {/* Error banner (inline, only for error state) */}
            {isError && agent.errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 flex items-start gap-2 rounded-xl border border-aurora-rose/20 bg-aurora-rose/10 px-3 py-2.5"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-aurora-rose" />
                <span className="text-xs leading-relaxed text-aurora-rose line-clamp-2">{agent.errorMessage}</span>
              </motion.div>
            )}
          </div>

          {/* Row 3: Action buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={(e) => { e.stopPropagation(); onQuickDispatch?.(); }}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-all',
                isError
                  ? 'bg-aurora-rose text-white shadow-[0_0_18px_rgba(251,113,133,0.2)] hover:bg-aurora-rose/90'
                  : 'bg-aurora-teal text-black shadow-[0_0_18px_rgba(0,217,200,0.2)] hover:bg-[#12e8da]'
              )}
            >
              {isError ? <RotateCcw className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}
              {isError ? 'Restart' : 'Dispatch Task'}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={(e) => { e.stopPropagation(); onViewLogs?.(); }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted transition-all hover:border-white/[0.18] hover:text-text-primary"
            >
              <Eye className="h-3.5 w-3.5" />
              View Live Logs
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={(e) => { e.stopPropagation(); onTuneAgent?.(); }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted transition-all hover:border-white/[0.18] hover:text-text-primary"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Tune Agent
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
