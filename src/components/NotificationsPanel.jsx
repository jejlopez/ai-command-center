import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, AlertCircle, CheckCircle2, Clock, Shield, BrainCircuit, Filter, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { generateNotifications } from '../utils/mockData';

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

// ── Relative timestamp with exact time for hover ────────────────
function formatRelativeTime(date) {
  if (!date) return '';
  const now = Date.now();
  const diff = now - date.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatExactTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function NotificationsPanel({ notificationsOpen, setNotificationsOpen, onNavigate }) {
  const [notifications, setNotifications] = useState(() => generateNotifications());
  const [activeFilter, setActiveFilter] = useState('all');

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

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

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const handleClick = useCallback((notif) => {
    markRead(notif.id);
    if (notif.action && onNavigate) {
      onNavigate(notif.action);
      setNotificationsOpen(false);
    }
  }, [markRead, onNavigate, setNotificationsOpen]);

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
                    {notifications.length === 0 ? 'All clear — no notifications' : 'No notifications in this category.'}
                  </motion.div>
                ) : (
                  filtered.map((notif) => {
                    const cat = CATEGORIES[notif.category];
                    const IconComponent = cat.Icon;

                    return (
                      <motion.div
                        key={notif.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -40, transition: { duration: 0.2 } }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                          'w-full text-left px-5 py-3.5 flex gap-3 border-l-2 transition-colors group relative',
                          'hover:bg-white/[0.04]',
                          notif.action && onNavigate ? 'cursor-pointer' : '',
                          !notif.read
                            ? cn(cat.borderClass, 'bg-white/[0.02]')
                            : 'border-l-transparent'
                        )}
                      >
                        {/* Clickable area */}
                        <button
                          className="absolute inset-0 z-0"
                          onClick={() => handleClick(notif)}
                        />

                        {/* Icon + Dot */}
                        <div className="relative mt-0.5 shrink-0 z-10 pointer-events-none">
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
                        <div className="flex-1 min-w-0 z-10 pointer-events-none">
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
                            <span
                              className="text-[10px] text-text-muted whitespace-nowrap mt-0.5"
                              title={formatExactTime(notif.createdAt)}
                            >
                              {formatRelativeTime(notif.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted leading-relaxed mt-0.5 line-clamp-2">
                            {notif.description}
                          </p>
                        </div>

                        {/* Dismiss button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss(notif.id); }}
                          className="relative z-10 shrink-0 mt-0.5 p-1 rounded opacity-0 group-hover:opacity-100 text-text-disabled hover:text-aurora-rose hover:bg-aurora-rose/10 transition-all"
                          title="Dismiss"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <p className="text-[10px] text-text-muted">
                {notifications.length} total &middot; {unreadCount} unread
              </p>
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center gap-1 text-[10px] text-text-disabled hover:text-aurora-rose font-medium transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default NotificationsPanel;
