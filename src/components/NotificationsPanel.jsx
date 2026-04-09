import React, { useCallback, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Radar,
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

function AlertCard({ alert, onClick, onDismiss }) {
  const meta = TYPE_META[alert.type] || TYPE_META.system;
  const Icon = meta.icon;

  return (
    <Motion.button
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 32 }}
      whileHover={{ y: -2 }}
      onClick={() => onClick(alert)}
      className="group relative w-full overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4 text-left"
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px]', meta.rail)} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(180deg,rgba(255,255,255,0.16)_0px,rgba(255,255,255,0.16)_1px,transparent_1px,transparent_12px)]" />
      <div className="flex items-start gap-3">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', meta.tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] font-semibold leading-snug text-text-primary">{alert.headline}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-text-disabled">{relativeTime(alert.createdAt)}</div>
            </div>
            {alert.unread && <span className="mt-1 h-2.5 w-2.5 rounded-full bg-aurora-teal shadow-[0_0_16px_rgba(0,217,200,0.45)]" />}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-text-body">{alert.detail}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              {alert.actionLabel}
            </span>
            <button
              onClick={(event) => {
                event.stopPropagation();
                onDismiss(alert.id);
              }}
              className="rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-disabled transition-colors hover:text-aurora-rose"
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

  const visibleAlerts = useMemo(() => {
    return derivedVisibleAlerts.filter((alert) => !dismissedIds.includes(alert.id));
  }, [derivedVisibleAlerts, dismissedIds]);
  const filtered = useMemo(
    () => activeFilter === 'all' ? visibleAlerts : visibleAlerts.filter((alert) => alert.type === activeFilter),
    [activeFilter, visibleAlerts]
  );

  const dismiss = useCallback((id) => setDismissedIds((prev) => [...prev, id]), []);
  const clearAll = useCallback(() => setDismissedIds(visibleAlerts.map((alert) => alert.id)), [visibleAlerts]);
  const handleAlertClick = useCallback((alert) => {
    if (alert.action && onNavigate) {
      onNavigate(alert.action);
      setNotificationsOpen(false);
    }
  }, [onNavigate, setNotificationsOpen]);

  return (
    <AnimatePresence>
      {notificationsOpen && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm"
            onClick={() => setNotificationsOpen(false)}
          />

          <Motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[420px] max-w-[96vw] flex-col overflow-hidden border-l border-white/8 bg-[linear-gradient(180deg,rgba(8,10,14,0.98),rgba(6,9,12,0.98))] shadow-[-18px_0_60px_rgba(0,0,0,0.55)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.10),transparent_24%),radial-gradient(circle_at_18%_8%,rgba(45,212,191,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_24%)]" />

            <div className="relative border-b border-white/[0.08] px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                    <Bell className="h-3.5 w-3.5 text-aurora-amber" />
                    Command Alerts
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">Live command traffic, approvals, and failures.</h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-text-muted">Tony’s alert bus. Elon’s attention filter. Only the things worth acting on should survive here.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                      Alert posture: {alertPosture === 'critical_only' ? 'Critical only' : alertPosture === 'full_feed' ? 'Full feed' : 'Balanced'}
                    </div>
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                      Route: {notificationRoute === 'command_center' ? 'In-app' : notificationRoute}
                    </div>
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                      Persona: {commanderPersona}
                    </div>
                    {quietActive && (
                      <div className="inline-flex items-center rounded-full border border-aurora-violet/20 bg-aurora-violet/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-violet">
                        Quiet hours active
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2 text-text-muted transition-colors hover:text-text-primary"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'Unread', value: unreadCount, icon: Radar, tone: 'text-aurora-teal' },
                  { label: 'Critical', value: criticalCount, icon: AlertTriangle, tone: 'text-aurora-rose' },
                  { label: 'Approvals', value: approvalCount, icon: ShieldCheck, tone: 'text-aurora-amber' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{stat.label}</span>
                      <stat.icon className={cn('h-3.5 w-3.5', stat.tone)} />
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-text-primary">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative px-5 pt-4">
              <button
                onClick={() => handleAlertClick({ action: directive.action })}
                className={cn(
                  'mb-4 w-full rounded-[22px] border p-4 text-left transition-colors',
                  directive.tone === 'rose'
                    ? 'border-aurora-rose/20 bg-aurora-rose/[0.07]'
                    : directive.tone === 'amber'
                      ? 'border-aurora-amber/20 bg-aurora-amber/[0.07]'
                      : 'border-aurora-teal/20 bg-aurora-teal/[0.07]'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{directive.eyebrow}</div>
                    <div className="mt-2 text-base font-semibold text-text-primary">{directive.title}</div>
                    <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{directive.detail}</p>
                  </div>
                  <ArrowRight className={cn(
                    'mt-1 h-4 w-4 shrink-0',
                    directive.tone === 'rose' ? 'text-aurora-rose' : directive.tone === 'amber' ? 'text-aurora-amber' : 'text-aurora-teal'
                  )} />
                </div>
                <div className="mt-4 inline-flex items-center rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  {directive.actionLabel}
                </div>
              </button>

              <div className="flex flex-wrap gap-2">
                {FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
                      activeFilter === filter.id
                        ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal'
                        : 'border-white/8 bg-white/[0.03] text-text-muted hover:text-text-primary'
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative flex-1 space-y-3 overflow-y-auto px-5 py-4 no-scrollbar">
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <Motion.div
                    key="empty-alerts"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex h-52 flex-col items-center justify-center rounded-[24px] border border-white/8 bg-black/20 text-center"
                  >
                    <Sparkles className="h-5 w-5 text-aurora-teal" />
                    <div className="mt-3 text-sm font-semibold text-text-primary">Command lane is clean.</div>
                    <p className="mt-2 max-w-[250px] text-[12px] leading-relaxed text-text-muted">Nothing in this filter deserves your attention right now.</p>
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

            <div className="relative border-t border-white/[0.08] px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">System health</div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">{criticalCount > 0 ? 'Needs attention' : 'Nominal'}</div>
                </div>
                <button
                  onClick={clearAll}
                  className="rounded-[20px] border border-white/8 bg-black/20 p-3 text-left transition-colors hover:border-aurora-rose/20"
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                    <Trash2 className="h-3.5 w-3.5 text-aurora-rose" />
                    Clear lane
                  </div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">Dismiss all alerts</div>
                </button>
              </div>
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default NotificationsPanel;
