import { motion } from 'framer-motion';
import { AlertTriangle, Clock, User } from 'lucide-react';
import { cn } from '../../utils/cn';

const priorityStyles = {
  critical: { bg: 'bg-aurora-teal/10', text: 'text-aurora-teal', border: 'border-aurora-teal/20', label: 'Critical' },
  high:     { bg: 'bg-aurora-amber/10', text: 'text-aurora-amber', border: 'border-aurora-amber/20', label: 'High' },
  normal:   { bg: 'ui-well',         text: 'text-text-muted',    border: 'border-hairline',        label: 'Normal' },
};

function MiniSparkline({ progress }) {
  return (
    <div className="w-full h-1 rounded-full ui-well overflow-hidden mt-2">
      <motion.div
        className="h-full rounded-full bg-aurora-violet/60"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  );
}

export function PriorityCards({ priorities, onFilterTasks }) {
  return (
    <div className="space-y-2.5 mb-5">
      {priorities.map((p, i) => {
        const style = priorityStyles[p.priority] || priorityStyles.normal;

        return (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => onFilterTasks?.(p.id)}
            className={cn(
              "w-full text-left p-4 rounded-lg border transition-all duration-200 group",
              "ui-well hover:bg-panel-soft hover:-translate-y-[1px]",
              style.border,
              // Blueprint grid background for Elon section
              "bg-[radial-gradient(circle_at_1px_1px,var(--color-hairline)_1px,transparent_0)] bg-[length:16px_16px]"
            )}
          >
            {/* Title */}
            <h4 className="text-[13px] font-semibold text-text-primary leading-snug mb-2">{p.title}</h4>

            {/* Tags */}
            <div className="flex items-center gap-2 mb-2">
              <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase", style.bg, style.text)}>
                {style.label}
              </span>
              <span className="flex items-center gap-1 text-[9px] font-mono text-text-disabled">
                <Clock className="w-2.5 h-2.5" /> {p.due}
              </span>
              <span className="flex items-center gap-1 text-[9px] font-mono text-text-disabled">
                <User className="w-2.5 h-2.5" /> {p.owner}
              </span>
            </div>

            {/* Description */}
            <p className="text-[11px] text-text-muted leading-relaxed">{p.description}</p>

            {/* Progress sparkline */}
            {p.progress > 0 && <MiniSparkline progress={p.progress} />}
          </motion.button>
        );
      })}
    </div>
  );
}
