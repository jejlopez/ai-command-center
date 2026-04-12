import { AlertTriangle, BadgeHelp, Clock3, DollarSign, OctagonAlert, ShieldCheck } from 'lucide-react';
import { cn } from '../../utils/cn';

const iconMap = {
  approvals: ShieldCheck,
  questions: BadgeHelp,
  schedules: Clock3,
  failures: OctagonAlert,
  stalled: Clock3,
  cost: DollarSign,
  alerts: AlertTriangle,
};

export function AttentionStrip({ items, loading, onSelect }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = iconMap[item.id] || AlertTriangle;
        return (
          <button
            key={item.id}
            onClick={() => onSelect?.(item)}
            className={cn(
              'ui-card-row min-h-[96px] p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35',
              item.tone === 'critical' && 'border-aurora-rose/30 bg-aurora-rose/5',
              item.tone === 'warning' && 'border-aurora-amber/30 bg-aurora-amber/5',
              item.clickable && 'hover:-translate-y-0.5 hover:bg-white/[0.05]'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="ui-panel-soft rounded-lg p-2">
                <Icon className={cn(
                  'h-4 w-4',
                  item.tone === 'critical' ? 'text-aurora-rose' : item.tone === 'warning' ? 'text-aurora-amber' : 'text-aurora-blue'
                )} />
              </div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-text-disabled">{item.badge}</span>
            </div>
            <div className="mt-4 font-mono text-3xl text-text-primary">
              {loading ? '--' : item.value}
            </div>
            <div className="mt-1 text-sm font-medium text-text-primary">{item.label}</div>
            <div className="mt-1 text-[11px] leading-5 text-text-muted">{item.badge}</div>
          </button>
        );
      })}
    </div>
  );
}
