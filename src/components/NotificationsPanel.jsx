import { useCallback, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BrainCircuit,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useDerivedAlerts } from '../utils/useDerivedAlerts';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'critical', label: 'Critical' },
  { id: 'approval', label: 'Approvals' },
  { id: 'failure', label: 'Failures' },
  { id: 'system', label: 'System' },
];

const TYPE_META = {
  critical: {
    icon: AlertTriangle,
    tone: 'border-aurora-rose/20 bg-aurora-rose/[0.08] text-aurora-rose',
    rail: 'bg-aurora-rose',
  },
  approval: {
    icon: ShieldCheck,
    tone: 'border-aurora-amber/20 bg-aurora-amber/[0.08] text-aurora-amber',
    rail: 'bg-aurora-amber',
  },
  failure: {
    icon: AlertTriangle,
    tone: 'border-aurora-rose/20 bg-aurora-rose/[0.08] text-aurora-rose',
    rail: 'bg-aurora-rose',
  },
  system: {
    icon: BrainCircuit,
    tone: 'border-aurora-teal/20 bg-aurora-teal/[0.08] text-aurora-teal',
    rail: 'bg-aurora-teal',
  },
  success: {
    icon: CheckCircle2,
    tone: 'border-aurora-green/20 bg-aurora-green/[0.08] text-aurora-green',
    rail: 'bg-aurora-green',
  },
};

function relativeTime(date) {
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function FilterButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'ui-chip rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40',
        active
          ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal'
          : 'border-hairline bg-panel-soft text-text-muted hover:text-text-primary'
      )}
    >
      {label}
    </button>
  );
}

function AlertCard({ alert, onClick, onDismiss }) {
  const meta = TYPE_META[alert.type] || TYPE_META.system;
  const Icon = meta.icon;

  return (
    <Motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 32 }}
      whileHover={{ y: -2 }}
      onClick={() => onClick(alert)}
      className="ui-panel w-full p-4 text-left transition-colors hover:bg-panel-soft"
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', meta.rail)} />
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border', meta.tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-snug text-text-primary">{alert.headline}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text-disabled">{relativeTime(alert.createdAt)}</div>
            </div>
            {alert.unread ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-aurora-teal shadow-[0_0_16px_rgba(0,217,200,0.45)]" /> : null}
          </div>
          <p className="mt-3 text-[12px] leading-6 text-text-body">{alert.detail}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="ui-chip px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">{alert.actionLabel}</span>
            <button
              type="button"
              aria-label={`Dismiss ${alert.headline}`}
              onClick={(event) => {
                event.stopPropagation();
                onDismiss(alert.id);
              }}
              className="rounded-xl border border-hairline bg-panel-soft px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-dim transition-colors hover:text-aurora-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </Motion.button>
  );
}

export function NotificationsPanel({ notificationsOpen, setNotificationsOpen, onNavigate }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [dismissedIds, setDismissedIds] = useState([]);
  const {
    visibleAlerts: derivedVisibleAlerts,
    unreadCount,
    criticalCount,
    approvalCount,
    quietActive,
    notificationRoute,
    commanderPersona,
    alertPosture,
    directive,
  } = useDerivedAlerts();

  const visibleAlerts = useMemo(
    () => derivedVisibleAlerts.filter((alert) => !dismissedIds.includes(alert.id)),
    [derivedVisibleAlerts, dismissedIds]
  );

  const filtered = useMemo(
    () => activeFilter === 'all' ? visibleAlerts : visibleAlerts.filter((alert) => alert.type === activeFilter),
    [activeFilter, visibleAlerts]
  );

  const dismiss = useCallback((id) => setDismissedIds((current) => [...current, id]), []);
  const clearAll = useCallback(() => setDismissedIds(visibleAlerts.map((alert) => alert.id)), [visibleAlerts]);
  const handleAlertClick = useCallback((alert) => {
    if (alert.action && onNavigate) {
      onNavigate(alert.action);
      setNotificationsOpen(false);
    }
  }, [onNavigate, setNotificationsOpen]);

  return (
    <AnimatePresence>
      {notificationsOpen ? (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
            onClick={() => setNotificationsOpen(false)}
          />

          <Motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 220 }}
            className="ui-drawer fixed inset-y-0 right-0 z-50 flex w-[440px] max-w-[96vw] flex-col overflow-hidden shadow-[-18px_0_60px_rgba(0,0,0,0.15)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--color-aurora-teal-soft),transparent_24%),radial-gradient(circle_at_18%_8%,rgba(45,212,191,0.08),transparent_22%),linear-gradient(180deg,var(--color-panel),transparent_24%)]" />

            <div className="relative border-b border-hairline px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="ui-kicker inline-flex items-center gap-2 rounded-full border border-hairline bg-panel-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                    <Bell className="h-3.5 w-3.5 text-[#d6c7a1]" />
                    Command Alerts
                  </div>
                  <h2 className="mt-4 max-w-sm text-2xl font-semibold tracking-tight text-text-primary text-balance">
                    Keep only the alerts worth acting on.
                  </h2>
                  <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-text-muted">
                    The lane is simpler now: current posture, one clear directive, and the alerts that still deserve attention.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={() => setNotificationsOpen(false)}
                  className="ui-button-secondary p-2 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Unread', value: unreadCount },
                  { label: 'Critical', value: criticalCount },
                  { label: 'Approvals', value: approvalCount },
                ].map((item) => (
                  <div key={item.label} className="ui-stat p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{item.label}</div>
                    <div className="mt-2 text-2xl font-semibold text-text-primary">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                <span className="ui-chip px-3 py-1">Posture: {alertPosture === 'critical_only' ? 'Critical Only' : alertPosture === 'full_feed' ? 'Full Feed' : 'Balanced'}</span>
                <span className="ui-chip px-3 py-1">Route: {notificationRoute === 'command_center' ? 'In-App' : notificationRoute}</span>
                <span className="ui-chip px-3 py-1">Persona: {commanderPersona}</span>
                {quietActive ? <span className="ui-chip border-aurora-violet/20 bg-aurora-violet/10 px-3 py-1 text-aurora-violet">Quiet Hours</span> : null}
              </div>
            </div>

            <div className="relative px-5 py-4">
              <button
                type="button"
                onClick={() => handleAlertClick({ action: directive.action })}
                className={cn(
                  'ui-panel w-full p-4 text-left transition-colors hover:bg-panel-soft',
                  directive.tone === 'rose'
                    ? 'border-aurora-rose/20'
                    : directive.tone === 'amber'
                      ? 'border-aurora-amber/20'
                      : 'border-aurora-teal/20'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="ui-kicker text-[10px] font-semibold uppercase">{directive.eyebrow}</div>
                    <div className="mt-2 text-base font-semibold text-text-primary">{directive.title}</div>
                    <p className="mt-2 text-[12px] leading-6 text-text-muted">{directive.detail}</p>
                  </div>
                  <ArrowRight className={cn(
                    'mt-1 h-4 w-4 shrink-0',
                    directive.tone === 'rose' ? 'text-aurora-rose' : directive.tone === 'amber' ? 'text-aurora-amber' : 'text-aurora-teal'
                  )} />
                </div>
              </button>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((filter) => (
                    <FilterButton
                      key={filter.id}
                      active={activeFilter === filter.id}
                      label={filter.label}
                      onClick={() => setActiveFilter(filter.id)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={clearAll}
                  className="ui-chip inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors hover:text-aurora-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </button>
              </div>
            </div>

            <div className="relative flex-1 space-y-3 overflow-y-auto px-5 pb-5 no-scrollbar">
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <Motion.div
                    key="empty-alerts"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="ui-panel flex h-52 flex-col items-center justify-center p-6 text-center"
                  >
                    <Sparkles className="h-5 w-5 text-aurora-teal" />
                    <div className="mt-3 text-sm font-semibold text-text-primary">This lane is clear</div>
                    <p className="mt-2 max-w-[260px] text-[12px] leading-6 text-text-muted">Nothing in this filter deserves your attention right now.</p>
                  </Motion.div>
                ) : (
                  filtered.map((alert) => (
                    <AlertCard
                      key={alert.id}
                      alert={alert}
                      onClick={handleAlertClick}
                      onDismiss={dismiss}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </Motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export default NotificationsPanel;
