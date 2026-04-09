import { useMemo, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { BrainCircuit, ChevronRight, History, TrendingUp, Zap } from 'lucide-react';
import { cn } from '../../utils/cn';

const ownerIcon = {
  Tony: BrainCircuit,
  Buffett: TrendingUp,
  Elon: Zap,
};

const toneClass = {
  teal: 'border-aurora-teal/18 bg-aurora-teal/[0.04] text-aurora-teal',
  blue: 'border-aurora-blue/18 bg-aurora-blue/[0.04] text-aurora-blue',
  amber: 'border-aurora-amber/18 bg-aurora-amber/[0.04] text-aurora-amber',
  rose: 'border-aurora-rose/18 bg-aurora-rose/[0.04] text-aurora-rose',
  violet: 'border-aurora-violet/18 bg-aurora-violet/[0.04] text-aurora-violet',
};

function formatTimestamp(value) {
  if (!value) return 'Not recorded yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded yet';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMetricValue(value) {
  if (value == null) return 'None';
  if (typeof value === 'number') {
    if (Math.abs(value) >= 100) return Math.round(value).toLocaleString();
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).replaceAll('_', ' ');
}

function DoctrineDrawer({ item, onClose }) {
  if (!item) return null;
  const Icon = ownerIcon[item.owner] || BrainCircuit;
  const metrics = Object.entries(item.metrics || {});
  const history = item.history || [];

  return (
    <AnimatePresence>
      {item && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <Motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 30 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-[92vw] flex-col border-l border-white/10 bg-[linear-gradient(180deg,rgba(8,10,14,0.98),rgba(6,9,12,0.98))] shadow-[-20px_0_60px_rgba(0,0,0,0.55)]"
          >
            <div className="border-b border-white/[0.08] px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', toneClass[item.tone] || toneClass.teal)}>
                    <Icon className="h-3 w-3" />
                    {item.owner}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight text-text-primary">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{item.detail}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-text-muted transition-colors hover:text-text-primary"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Confidence</div>
                  <div className="mt-2 text-3xl font-semibold text-text-primary">{item.confidence}%</div>
                  <p className="mt-2 text-[12px] text-text-muted">{item.changeSummary}</p>
                </div>
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Recorded</div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">{formatTimestamp(item.latestSnapshotAt || item.lastSeenAt)}</div>
                  <p className="mt-2 text-[12px] text-text-muted">
                    {item.persistenceEnabled
                      ? `Tracking history since ${formatTimestamp(item.firstSeenAt)}.`
                      : 'Running in derived mode until the learning-memory tables are live.'}
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  <BrainCircuit className="h-3.5 w-3.5 text-aurora-teal" />
                  Why The System Believes This
                </div>
                <div className="mt-4 space-y-2">
                  {(item.whyItBelievesThis || []).map((fact) => (
                    <div key={fact} className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-[12px] leading-relaxed text-text-body">
                      {fact}
                    </div>
                  ))}
                </div>
              </div>

              {metrics.length > 0 && (
                <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Signal Metrics</div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {metrics.map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">{key.replaceAll('_', ' ')}</div>
                        <div className="mt-2 text-sm font-semibold text-text-primary">{formatMetricValue(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  <History className="h-3.5 w-3.5 text-aurora-violet" />
                  Doctrine Change Over Time
                </div>
                <div className="mt-4 space-y-3">
                  {history.length === 0 && (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3 text-[12px] text-text-muted">
                      No historical snapshots yet.
                    </div>
                  )}
                  {history.map((entry, index) => (
                    <div key={entry.id || `${entry.snapshotHash}-${index}`} className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[12px] font-semibold text-text-primary">{entry.title}</div>
                        <div className="text-[11px] font-mono text-aurora-teal">{entry.confidence}%</div>
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-text-disabled">{formatTimestamp(entry.observedAt)}</div>
                      <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{entry.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function DoctrineCards({ items = [], compact = false, columns = 'three' }) {
  const [selectedId, setSelectedId] = useState(null);
  const selectedItem = useMemo(
    () => items.find((item) => (item.id || item.title) === selectedId) || null,
    [items, selectedId]
  );

  const gridClass = columns === 'two'
    ? 'grid-cols-1 xl:grid-cols-2'
    : columns === 'one'
      ? 'grid-cols-1'
      : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';

  return (
    <>
      <div className={cn('grid gap-3', gridClass)}>
        {items.map((item) => {
          const Icon = ownerIcon[item.owner] || BrainCircuit;
          return (
            <Motion.button
              key={item.id || item.title}
              whileHover={{ y: -2 }}
              type="button"
              onClick={() => setSelectedId(item.id || item.title)}
              className="rounded-[22px] border border-white/8 bg-black/20 p-4 text-left transition-colors hover:border-white/14 hover:bg-black/26"
            >
              <div className="flex items-start justify-between gap-2">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', toneClass[item.tone] || toneClass.teal)}>
                  <Icon className="h-3 w-3" />
                  {item.owner}
                </span>
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-mono text-text-muted">
                  {item.confidence}%
                </span>
              </div>
              <div className={cn('mt-3 font-semibold text-text-primary', compact ? 'text-[13px]' : 'text-sm')}>{item.title}</div>
              <p className={cn('mt-2 leading-relaxed text-text-muted', compact ? 'text-[11px]' : 'text-[12px]')}>{item.detail}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[10px] text-text-disabled">{item.changeSummary || 'Open for doctrine details'}</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-teal">
                  Why
                  <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </Motion.button>
          );
        })}
      </div>

      <DoctrineDrawer item={selectedItem} onClose={() => setSelectedId(null)} />
    </>
  );
}
