import { Activity, AlertTriangle, BellRing, PlugZap, ShieldCheck } from 'lucide-react';
import { cn } from '../../utils/cn';

const iconByType = {
  mission: Activity,
  approval: ShieldCheck,
  system: PlugZap,
  alert: AlertTriangle,
  log: BellRing,
};

const toneByType = {
  mission: 'text-aurora-teal',
  approval: 'text-aurora-amber',
  system: 'text-aurora-blue',
  alert: 'text-aurora-rose',
  log: 'text-text-muted',
};

function formatTimestamp(value) {
  if (!value) return 'Now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Now';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function CommandTimelineRail({ entries = [], title = 'Command Timeline', description = 'What changed most recently across the system.' }) {
  return (
    <div className="ui-panel p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{title}</div>
      <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{description}</p>

      <div className="mt-4 space-y-3">
        {entries.length === 0 && (
          <div className="ui-card-row px-4 py-4 text-[12px] text-text-muted">
            No live command events yet.
          </div>
        )}
        {entries.map((entry, index) => {
          const Icon = iconByType[entry.type] || Activity;
          const tone = toneByType[entry.type] || 'text-text-muted';

          return (
            <div key={entry.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="ui-panel-soft flex h-9 w-9 items-center justify-center">
                  <Icon className={cn('h-4 w-4', tone)} />
                </div>
                {index < entries.length - 1 && <div className="mt-2 w-px flex-1 bg-white/8" />}
              </div>
              <div className="ui-card-row min-w-0 flex-1 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-text-primary">{entry.title}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-text-muted">{entry.detail}</div>
                  </div>
                  <div className="shrink-0 text-[10px] font-mono uppercase tracking-[0.14em] text-text-disabled">
                    {formatTimestamp(entry.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
