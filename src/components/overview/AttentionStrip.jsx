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
              'ui-card-row min-h-[110px] p-6 text-left transition-all border shadow-sm group bg-panel',
              item.tone === 'critical' ? 'border-aurora-rose/35 bg-aurora-rose/5' : 'border-hairline',
              item.tone === 'warning' ? 'border-aurora-amber/35 bg-aurora-amber/5' : '',
              item.clickable && 'hover:-translate-y-1 hover:bg-panel-soft hover:shadow-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="ui-panel-soft rounded-xl p-2.5 bg-canvas border border-hairline shadow-inner">
                <Icon className={cn(
                  'h-5 w-5',
                  item.tone === 'critical' ? 'text-aurora-rose shadow-[0_0_10px_-2px_var(--color-aurora-rose)]' : 
                  item.tone === 'warning' ? 'text-aurora-amber shadow-[0_0_10px_-2px_var(--color-aurora-amber)]' : 
                  'text-aurora-blue shadow-[0_0_10px_-2px_var(--color-aurora-blue)]'
                )} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-dim opacity-70 group-hover:opacity-100 transition-opacity">{item.badge}</span>
            </div>
            <div className="mt-5 font-mono text-4xl font-black text-text tracking-tighter">
              {loading ? '--' : item.value}
            </div>
            <div className="mt-1 text-xs font-black text-text uppercase tracking-widest">{item.label}</div>
          </button>
        );
      })}
    </div>
  );
}
