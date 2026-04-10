import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, StopCircle, RotateCcw, Copy, Clock, MessageSquare } from 'lucide-react';
import { cn } from '../../utils/cn';

function formatElapsed(ms) {
  if (!ms || ms === 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

function formatTimestamp(ts) {
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return ''; }
}

const statusColors = {
  completed: 'text-aurora-teal',
  running: 'text-aurora-amber',
  pending: 'text-aurora-blue',
  error: 'text-aurora-rose',
};

export function TaskDetailDrawer({ task, logs, notes, onClose }) {
  const [activeTab, setActiveTab] = useState('timeline');

  useEffect(() => {
    if (!task) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [task, onClose]);

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            key="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            className="fixed top-0 right-0 bottom-0 w-[480px] bg-canvas border-l border-hairline z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.1)]"
          >
            {/* Header */}
            <div className="p-5 border-b border-hairline bg-panel-soft/30 backdrop-blur shrink-0">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-text-primary truncate">{task.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={cn("text-xs font-mono font-bold uppercase", statusColors[task.status] || 'text-text-muted')}>
                      {task.status}
                    </span>
                    <span className="text-xs text-text-disabled font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatElapsed(task.durationMs)}
                    </span>
                    <span className="text-xs text-text-disabled font-mono">
                      {task.agentName || '—'}
                    </span>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-panel-soft rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border px-5 shrink-0">
              {[
                { id: 'timeline', label: 'Timeline', icon: Clock },
                { id: 'notes', label: 'Notes', icon: MessageSquare },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    activeTab === tab.id
                      ? "border-aurora-teal text-aurora-teal"
                      : "border-transparent text-text-muted hover:text-text-primary"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-5">
              {activeTab === 'timeline' && (
                <div className="space-y-0">
                  {logs.length === 0 && (
                    <p className="text-sm text-text-disabled text-center py-8">No timeline events yet.</p>
                  )}
                  {logs.map((log, i) => {
                    const typeColors = {
                      OK: 'border-aurora-teal/40 bg-aurora-teal',
                      ERR: 'border-aurora-rose/40 bg-aurora-rose',
                      NET: 'border-aurora-blue/40 bg-aurora-blue',
                      SYS: 'border-hairline bg-panel-soft',
                    };
                    const dotColor = typeColors[log.type] || typeColors.SYS;

                    return (
                      <div key={log.id || i} className="flex gap-3 pb-4 last:pb-0">
                        {/* Vertical line + dot */}
                        <div className="flex flex-col items-center shrink-0">
                          <div className={cn("w-2 h-2 rounded-full border", dotColor.split(' ')[0])} style={{ backgroundColor: dotColor.split(' ')[1]?.replace('bg-', '') }}>
                            <div className={cn("w-full h-full rounded-full", dotColor.split(' ')[1])} />
                          </div>
                          {i < logs.length - 1 && <div className="w-px flex-1 border-r border-hairline mt-1" />}
                        </div>
                        {/* Content */}
                        <div className="min-w-0 -mt-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-mono text-text-disabled">{formatTimestamp(log.timestamp)}</span>
                            <span className="text-[9px] font-mono font-bold uppercase text-text-disabled">{log.type}</span>
                          </div>
                          <p className="text-[12px] text-text-body font-mono leading-relaxed">{log.message}</p>
                          {(log.tokens > 0 || log.durationMs > 0) && (
                            <div className="flex gap-3 mt-1 text-[10px] font-mono text-text-disabled">
                              {log.tokens > 0 && <span>{log.tokens} tok</span>}
                              {log.durationMs > 0 && <span>{log.durationMs}ms</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-3">
                  {/* TODO: Wire to task_notes table when it exists */}
                  {notes.map(note => (
                    <div key={note.id} className="p-3 ui-well rounded-lg border border-hairline">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn(
                          "text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded",
                          note.author === 'Tony' ? "bg-aurora-amber/10 text-aurora-amber" :
                          note.author === 'Elon' ? "bg-aurora-violet/10 text-aurora-violet" :
                          "bg-aurora-teal/10 text-aurora-teal"
                        )}>
                          {note.author}
                        </span>
                        <span className="text-[10px] font-mono text-text-disabled">{formatTimestamp(note.timestamp)}</span>
                      </div>
                      <p className="text-[12px] text-text-body leading-relaxed">{note.text}</p>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p className="text-sm text-text-disabled text-center py-8">No notes yet.</p>
                  )}
                  {/* Add note textarea */}
                  <div className="mt-4">
                    <textarea
                      placeholder="Add a note... (Cmd+Enter to save)"
                      rows={3}
                      className="w-full bg-panel-soft border border-hairline rounded-lg px-3 py-2.5 text-xs font-mono text-text-primary resize-none focus:border-aurora-teal/40 outline-none transition-colors leading-relaxed placeholder:text-text-disabled"
                    />
                    <p className="text-[9px] text-text-disabled mt-1">TODO: Note saving will be wired when task_notes table is created.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="shrink-0 border-t border-border p-4 flex items-center gap-2 bg-canvas/30">
              {task.status === 'running' && (
                <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-aurora-rose bg-aurora-rose/5 border border-aurora-rose/20 rounded-lg hover:bg-aurora-rose/10 transition-colors">
                  <StopCircle className="w-3.5 h-3.5" /> Stop Task
                </button>
              )}
              <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-aurora-amber bg-aurora-amber/5 border border-aurora-amber/20 rounded-lg hover:bg-aurora-amber/10 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Rerun
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-text-muted bg-panel-soft border border-hairline rounded-lg hover:bg-panel transition-colors ml-auto">
                <Copy className="w-3.5 h-3.5" /> Copy Summary
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
