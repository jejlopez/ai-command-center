import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

const statusConfig = {
  completed: { accent: '#00D9C8', label: 'DONE',    bg: 'bg-aurora-teal/10',  text: 'text-aurora-teal' },
  running:   { accent: '#fbbf24', label: 'RUNNING', bg: 'bg-aurora-amber/10', text: 'text-aurora-amber' },
  pending:   { accent: '#60a5fa', label: 'PENDING', bg: 'bg-aurora-blue/10',  text: 'text-aurora-blue' },
  error:     { accent: '#fb7185', label: 'FAILED',  bg: 'bg-aurora-rose/10',  text: 'text-aurora-rose' },
};

function formatTime(ts) {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

export function LiveTaskRail({ tasks, selectedId, onSelect }) {
  const listRef = useRef(null);
  const selectedIdx = tasks.findIndex(t => t.id === selectedId);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!tasks.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min((selectedIdx < 0 ? -1 : selectedIdx) + 1, tasks.length - 1);
      onSelect(tasks[next].id);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max((selectedIdx < 0 ? 1 : selectedIdx) - 1, 0);
      onSelect(tasks[prev].id);
    } else if (e.key === 'Enter' && selectedIdx >= 0) {
      // Already selected — drawer opens via parent
    } else if (e.key === 'Escape') {
      onSelect(null);
    }
  }, [tasks, selectedIdx, onSelect]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.addEventListener('keydown', handleKeyDown);
    return () => { if (el) el.removeEventListener('keydown', handleKeyDown); };
  }, [handleKeyDown]);

  if (!tasks.length) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-disabled text-sm">
        No tasks in this time range.
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      tabIndex={0}
      className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 outline-none focus:ring-1 focus:ring-aurora-teal/20 rounded-lg pr-1"
    >
      {tasks.map((task, i) => {
        const cfg = statusConfig[task.status] || statusConfig.pending;
        const isSelected = task.id === selectedId;
        const isRunning = task.status === 'running';

        return (
          <motion.button
            key={task.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onSelect(task.id)}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg border transition-all duration-200 flex items-center gap-4 group relative overflow-hidden",
              isSelected
                ? "bg-white/[0.04] border-aurora-teal/30 shadow-[0_0_15px_rgba(0,217,200,0.08)]"
                : "bg-white/[0.015] border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.08] hover:-translate-y-[1px]"
            )}
          >
            {/* Left accent bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
              style={{ backgroundColor: cfg.accent }}
            />

            {/* Running pulse dot */}
            {isRunning && (
              <div className="absolute right-3 top-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: cfg.accent }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: cfg.accent }} />
                </span>
              </div>
            )}

            {/* Time */}
            <span className="text-[10px] font-mono text-text-disabled w-12 shrink-0">
              {formatTime(task.createdAt)}
            </span>

            {/* Task name */}
            <span className="text-[12px] font-medium text-text-primary flex-1 truncate" title={task.name}>
              {task.name}
            </span>

            {/* Status pill */}
            <span className={cn("px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase", cfg.bg, cfg.text)}>
              {cfg.label}
            </span>

            {/* Metrics */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] font-mono text-text-disabled">
                {task.durationMs < 1000 ? `${task.durationMs}ms` : `${(task.durationMs / 1000).toFixed(1)}s`}
              </span>
              <span className="text-[10px] font-mono text-text-disabled">
                ${task.costUsd?.toFixed(3) ?? '0.000'}
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
