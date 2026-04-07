import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, AlertCircle, CheckCircle2, Clock, Shield, BrainCircuit, Filter } from 'lucide-react';
import { cn } from '../utils/cn';

const CATEGORIES = {
  error: {
    label: 'Error',
    color: 'aurora-rose',
    dotClass: 'bg-aurora-rose',
    borderClass: 'border-l-aurora-rose',
    Icon: AlertCircle,
  },
  success: {
    label: 'Completed',
    color: 'aurora-green',
    dotClass: 'bg-aurora-green',
    borderClass: 'border-l-aurora-green',
    Icon: CheckCircle2,
  },
  approval: {
    label: 'Approval',
    color: 'aurora-amber',
    dotClass: 'bg-aurora-amber',
    borderClass: 'border-l-aurora-amber',
    Icon: Clock,
  },
  system: {
    label: 'System',
    color: 'aurora-teal',
    dotClass: 'bg-aurora-teal',
    borderClass: 'border-l-aurora-teal',
    Icon: BrainCircuit,
  },
};

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'error', label: 'Errors' },
  { id: 'approval', label: 'Approvals' },
  { id: 'system', label: 'System' },
];

const initialNotifications = [
  {
    id: 1,
    category: 'error',
    title: 'Scraper agent failed',
    description: 'Agent 4: Rate limit exceeded on target API. Retries exhausted after 3 attempts.',
    time: '2m ago',
    read: false,
  },
  {
    id: 2,
    category: 'approval',
    title: 'PR #18 awaiting review',
    description: 'Researcher submitted refactor of data pipeline. Queued in Review Room.',
    time: '8m ago',
    read: false,
  },
  {
    id: 3,
    category: 'success',
    title: 'Research task #42 completed',
    description: 'Researcher agent finished competitive analysis. 14 sources synthesized.',
    time: '15m ago',
    read: false,
  },
  {
    id: 4,
    category: 'system',
    title: 'Memory Core at 85% capacity',
    description: 'Long-term memory store approaching threshold. Consider archiving stale embeddings.',
    time: '22m ago',
    read: false,
  },
  {
    id: 5,
    category: 'error',
    title: 'UI agent render timeout',
    description: 'Agent 7: Component tree exceeded 5s render budget on Dashboard view.',
    time: '1h ago',
    read: true,
  },
  {
    id: 6,
    category: 'approval',
    title: 'Deploy approval required',
    description: 'Commander requesting production deploy for build v2.4.1. Manual sign-off needed.',
    time: '1h ago',
    read: true,
  },
  {
    id: 7,
    category: 'success',
    title: 'QA suite passed',
    description: 'QA agent completed 847 assertions across 12 modules. Zero regressions detected.',
    time: '2h ago',
    read: true,
  },
  {
    id: 8,
    category: 'system',
    title: 'Fleet scaling event',
    description: 'Auto-scaler provisioned 2 additional worker agents to handle task queue backlog.',
    time: '3h ago',
    read: true,
  },
  {
    id: 9,
    category: 'system',
    title: 'Telemetry pipeline restored',
    description: 'Metrics ingestion recovered after 4m interruption. No data loss confirmed.',
    time: '4h ago',
    read: true,
  },
  {
    id: 10,
    category: 'error',
    title: 'Context window overflow',
    description: 'Agent 12: Prompt exceeded 128k token limit during document summarization.',
    time: '5h ago',
    read: true,
  },
];

export function getUnreadCount(notifications) {
  return notifications.filter((n) => !n.read).length;
}

export function NotificationsPanel({ notificationsOpen, setNotificationsOpen }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [activeFilter, setActiveFilter] = useState('all');

  const unreadCount = useMemo(() => getUnreadCount(notifications), [notifications]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    return notifications.filter((n) => n.category === activeFilter);
  }, [notifications, activeFilter]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  return (
    <AnimatePresence>
      {notificationsOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setNotificationsOpen(false)}
          />

          {/* Panel */}
          <motion.div
            key="notif-panel"
            initial={{ x: 380, opacity: 0, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 380, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 32, stiffness: 200, mass: 0.8 }}
            className="fixed top-0 bottom-0 right-0 z-50 w-[360px] bg-surface/95 backdrop-blur-2xl border-l border-border flex flex-col shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <Bell className="w-5 h-5 text-aurora-teal" />
                <h2 className="text-sm font-semibold text-text-primary tracking-wide">
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-aurora-rose/20 text-aurora-rose leading-none">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] text-text-muted hover:text-aurora-teal transition-colors font-medium"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-5 pb-3">
              <div className="flex items-center gap-1 bg-black/30 rounded-lg p-1 border border-border">
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveFilter(tab.id)}
                    className={cn(
                      'flex-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors',
                      activeFilter === tab.id
                        ? 'bg-white/[0.08] text-text-primary'
                        : 'text-text-muted hover:text-text-primary hover:bg-white/[0.04]'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border mx-5" />

            {/* Notification List */}
            <div className="flex-1 overflow-y-auto no-scrollbar">
              <AnimatePresence mode="popLayout">
                {filtered.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-40 text-text-muted text-sm"
                  >
                    <Filter className="w-5 h-5 mb-2 opacity-40" />
                    No notifications in this category.
                  </motion.div>
                ) : (
                  filtered.map((notif) => {
                    const cat = CATEGORIES[notif.category];
                    const IconComponent = cat.Icon;

                    return (
                      <motion.button
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => markRead(notif.id)}
                        className={cn(
                          'w-full text-left px-5 py-3.5 flex gap-3 border-l-2 transition-colors',
                          'hover:bg-white/[0.04]',
                          !notif.read
                            ? cn(cat.borderClass, 'bg-white/[0.02]')
                            : 'border-l-transparent'
                        )}
                      >
                        {/* Icon + Dot */}
                        <div className="relative mt-0.5 shrink-0">
                          <IconComponent
                            className={cn(
                              'w-4 h-4',
                              !notif.read
                                ? `text-${cat.color}`
                                : 'text-text-muted'
                            )}
                          />
                          {!notif.read && (
                            <span
                              className={cn(
                                'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-surface',
                                cat.dotClass
                              )}
                            />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                'text-[13px] font-medium leading-snug',
                                !notif.read
                                  ? 'text-text-primary'
                                  : 'text-text-body'
                              )}
                            >
                              {notif.title}
                            </span>
                            <span className="text-[10px] text-text-muted whitespace-nowrap mt-0.5">
                              {notif.time}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted leading-relaxed mt-0.5 line-clamp-2">
                            {notif.description}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border">
              <p className="text-[10px] text-text-muted text-center">
                {notifications.length} total &middot; {unreadCount} unread
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Hook-friendly helper: returns the default unread count from initial data */
NotificationsPanel.defaultUnreadCount = initialNotifications.filter(
  (n) => !n.read
).length;

export default NotificationsPanel;
