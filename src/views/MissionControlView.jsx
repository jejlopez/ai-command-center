/**
 * Mission Control — Production View
 * Unified command center: Operations / Planner / Approvals
 * Real data from api.js + static placeholders where tables don't exist yet
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Clock, Zap, ShieldCheck, AlertTriangle, X,
  StopCircle, RotateCcw, Copy, CheckCircle2, XCircle,
  FileText, Brain, TrendingUp, Calendar, Repeat, Ban,
  DollarSign, Timer, GitBranch, Sparkles,
  Radio, Lock, Send, Archive, Eye, AlarmClock,
  ChevronDown, Bookmark, Plus, Loader2,
} from 'lucide-react';
import { cn } from '../utils/cn';
import {
  fetchAgents, fetchTasks, fetchActivityLog,
  fetchPendingReviews, fetchCompletedOutputs,
  approveReview, rejectReview, retryTask, stopTask,
  subscribeToPendingReviews,
  fetchTaskNotes, createTaskNote,
  acknowledgeItem, reopenReview, snoozeReview,
  fetchSchedules, toggleSchedule, dispatchFromSchedule,
} from '../lib/api';
import { useSystemState } from '../context/SystemStateContext';

// ═══════════════════════════════════════════════════════════════
// STATIC PLANNER DATA (until schedules table exists)
// ═══════════════════════════════════════════════════════════════

// Intelligence recommendations now derived from real data in IntelSidebar

// ═══════════════════════════════════════════════════════════════
// UI ATOMS
// ═══════════════════════════════════════════════════════════════

function AgentAvatar({ agent, name, size = 'sm' }) {
  const n = agent?.name || name || '?';
  const c = agent?.color || '#60a5fa';
  const big = size === 'lg';
  return (
    <div className="flex items-center gap-2">
      <div className={cn("rounded-full flex items-center justify-center font-bold shrink-0 relative ring-1 ring-white/10", big ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-[10px]')}
        style={{ backgroundColor: `${c}15`, color: c }}>
        {n[0]}
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-canvas" style={{ backgroundColor: c }} />
      </div>
      {big && <div><span className="text-sm font-semibold text-text-primary">{n}</span>{agent?.role && <span className="text-[10px] text-text-muted block font-mono">{agent.role}</span>}</div>}
      {!big && <span className="text-[11px] font-medium text-text-muted">{n}</span>}
    </div>
  );
}

function ModelChip({ model }) {
  if (!model) return null;
  return <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-surface-raised text-text-muted border border-border">{model}</span>;
}

function PriBadge({ v }) {
  if (v == null) return null;
  const c = v >= 8 ? '#fb7185' : v >= 5 ? '#fbbf24' : '#34d399';
  return (<div className="flex items-center gap-1"><div className="w-8 h-1.5 rounded-full bg-surface-raised overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(v*10,100)}%`, backgroundColor: c }} /></div><span className="text-[9px] font-mono font-bold" style={{ color: c }}>{v}</span></div>);
}

const stColor = {
  running:             { bg: 'bg-aurora-amber/10', tx: 'text-aurora-amber', lb: 'Running' },
  completed:           { bg: 'bg-aurora-green/10', tx: 'text-aurora-green', lb: 'Done' },
  failed:              { bg: 'bg-aurora-rose/10', tx: 'text-aurora-rose', lb: 'Failed' },
  error:               { bg: 'bg-aurora-rose/10', tx: 'text-aurora-rose', lb: 'Failed' },
  pending:             { bg: 'bg-aurora-blue/10', tx: 'text-aurora-blue', lb: 'Queued' },
  idle:                { bg: 'bg-white/5', tx: 'text-text-muted', lb: 'Idle' },
  awaiting_approval:   { bg: 'bg-aurora-amber/10', tx: 'text-aurora-amber', lb: 'Review' },
  needs_intervention:  { bg: 'bg-aurora-rose/10', tx: 'text-aurora-rose', lb: 'Alert' },
  approved:            { bg: 'bg-aurora-green/10', tx: 'text-aurora-green', lb: 'Approved' },
  enabled:             { bg: 'bg-aurora-teal/10', tx: 'text-aurora-teal', lb: 'Active' },
  paused:              { bg: 'bg-white/5', tx: 'text-text-muted', lb: 'Paused' },
  success:             { bg: 'bg-aurora-green/10', tx: 'text-aurora-green', lb: 'Pass' },
};

const urgColors = { critical: '#fb7185', high: '#fbbf24', normal: '#00D9C8' };

function Card({ children, className, onClick, selected }) {
  return (<button onClick={onClick} className={cn("w-full text-left rounded-2xl border transition-all duration-200 relative overflow-hidden",
    selected ? "bg-surface-raised border-aurora-teal/30 shadow-glow-teal ring-1 ring-aurora-teal/20" : "bg-surface border-border hover:bg-surface-raised hover:border-border-strong hover:-translate-y-[1px]",
    className)}>{children}</button>);
}

// ═══════════════════════════════════════════════════════════════
// ITEM ROW (tasks + approvals)
// ═══════════════════════════════════════════════════════════════

function ItemRow({ item, agents, selected, onClick }) {
  const cfg = stColor[item.status] || stColor.pending;
  const isRun = item.status === 'running';
  const agent = agents.find(a => a.id === (item.agentId || item.agent_id));
  const urgC = item.urgency ? urgColors[item.urgency] : null;

  return (
    <Card onClick={onClick} selected={selected} className={cn("p-4", urgC && "border-l-[3px]")} style={urgC ? { borderLeftColor: urgC } : undefined}>
      {urgC && <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ backgroundColor: urgC }} />}
      {isRun && <div className="absolute right-4 top-4"><span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-aurora-amber opacity-75" /><span className="relative rounded-full h-2 w-2 bg-aurora-amber" /></span></div>}

      <div className="flex items-center gap-3 mb-2">
        <AgentAvatar agent={agent} name={item.agentName} />
        <span className="text-[13px] font-semibold text-text-primary flex-1 truncate">{item.name || item.title}</span>
        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold", cfg.bg, cfg.tx)}>{cfg.lb}</span>
      </div>

      <div className="flex items-center gap-3 ml-8 flex-wrap">
        {agent?.model && <ModelChip model={agent.model} />}
        {item.durationMs > 0 && <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Timer className="w-3 h-3" />{item.durationMs < 1000 ? `${item.durationMs}ms` : `${(item.durationMs/1000).toFixed(1)}s`}</span>}
        {item.costUsd > 0 && <span className="text-[10px] font-mono text-text-disabled">${item.costUsd.toFixed(3)}</span>}
        {item.waitingMs > 0 && <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round(item.waitingMs/60000)}m waiting</span>}
        {item.status === 'needs_intervention' && <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-aurora-rose"><AlertTriangle className="w-3 h-3" />Needs Me</span>}
      </div>

      {item.summary && <p className="text-[10px] text-text-muted mt-1.5 ml-8 leading-relaxed line-clamp-1">{item.summary}</p>}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════

function Drawer({ item, agents, tasks, logs, onClose, onApprove, onReject, onRetry, onStop, onCopy, onAcknowledge, onReopen, onSnooze, onReload }) {
  const [tab, setTab] = useState('timeline');
  const [feedback, setFeedback] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);

  // Load notes when item changes or notes tab opens
  useEffect(() => {
    if (!item?.id) return;
    let x = false;
    fetchTaskNotes(item.id).then(n => { if (!x) { setNotes(n); setNotesLoaded(true); } });
    return () => { x = true; };
  }, [item?.id]);

  async function handleAddNote() {
    if (!noteText.trim() || !item?.id) return;
    setActionLoading('Note');
    try {
      await createTaskNote(item.id, noteText.trim());
      setNoteText('');
      const updated = await fetchTaskNotes(item.id);
      setNotes(updated);
    } catch (e) { setActionError(`Note failed: ${e.message}`); }
    finally { setActionLoading(null); }
  }

  if (!item) return null;
  const agent = agents.find(a => a.id === (item.agentId || item.agent_id));
  const cfg = stColor[item.status] || stColor.pending;
  const isApproval = item.urgency != null || item.outputType != null;
  const isCompleted = item.status === 'completed' || item.status === 'approved';
  const isRunning = item.status === 'running';
  const itemLogs = logs.filter(l => l.agentId === (item.agentId || item.agent_id));

  async function act(name, fn) {
    setActionLoading(name); setActionError(null);
    try { await fn(); } catch (e) { setActionError(`${name} failed: ${e.message}`); }
    finally { setActionLoading(null); }
  }

  return (<>
    <motion.div key="dbg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
    <motion.div key="dpn" initial={{ x: '100%' }} animate={{ x: '0%' }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      className="fixed top-0 right-0 bottom-0 w-[480px] bg-canvas border-l border-border z-50 flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.6)]">

      <div className="p-5 border-b border-border shrink-0">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2"><AgentAvatar agent={agent} name={item.agentName} size="lg" />{agent?.model && <ModelChip model={agent.model} />}</div>
            <h3 className="text-lg font-semibold text-text-primary truncate">{item.name || item.title}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn("text-xs font-mono font-bold", cfg.tx)}>{cfg.lb}</span>
              {item.durationMs > 0 && <span className="text-xs text-text-disabled font-mono flex items-center gap-1"><Clock className="w-3 h-3" />{item.durationMs < 1000 ? `${item.durationMs}ms` : `${(item.durationMs/1000).toFixed(1)}s`}</span>}
              {item.costUsd > 0 && <span className="text-xs text-text-disabled font-mono">${item.costUsd.toFixed(3)}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-white hover:bg-white/[0.05] rounded-lg"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {item.summary && <div className="px-5 py-3 border-b border-border bg-surface"><p className="text-[12px] text-text-body leading-relaxed">{item.summary}</p></div>}

      {actionError && <div className="px-5 py-2 border-b border-aurora-rose/10 bg-aurora-rose/5 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-aurora-rose shrink-0" /><span className="text-[11px] text-aurora-rose flex-1">{actionError}</span><button onClick={() => setActionError(null)} className="text-[10px] text-aurora-rose font-bold">Dismiss</button></div>}

      <div className="flex border-b border-border px-5 shrink-0">
        {['timeline', 'history', 'output', 'notes'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize", tab === t ? "border-aurora-teal text-aurora-teal" : "border-transparent text-text-muted hover:text-text-primary")}>{t}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-5">
        {tab === 'timeline' && (<div className="space-y-0">
          {itemLogs.length === 0 && <p className="text-sm text-text-disabled text-center py-8">No timeline events.</p>}
          {itemLogs.map((l, i) => {
            const dc = { OK: 'bg-aurora-teal', ERR: 'bg-aurora-rose', NET: 'bg-aurora-blue', SYS: 'bg-white/40' };
            return (<div key={l.id || i} className="flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center shrink-0"><div className={cn("w-2.5 h-2.5 rounded-full", dc[l.type] || 'bg-white/40')} />{i < itemLogs.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}</div>
              <div className="min-w-0 -mt-1">
                <div className="flex items-center gap-2 mb-0.5"><span className="text-[10px] font-mono text-text-disabled">{typeof l.timestamp === 'string' ? l.timestamp : new Date(l.timestamp).toLocaleTimeString()}</span><span className="text-[9px] font-mono font-bold uppercase text-text-disabled">{l.type}</span></div>
                <p className="text-[12px] text-text-body font-mono leading-relaxed">{l.message}</p>
                {(l.tokens > 0 || l.durationMs > 0) && <div className="flex gap-3 mt-1 text-[10px] font-mono text-text-disabled">{l.tokens > 0 && <span>{l.tokens} tok</span>}{l.durationMs > 0 && <span>{l.durationMs}ms</span>}</div>}
              </div>
            </div>);
          })}
        </div>)}
        {tab === 'history' && (() => {
          const itemName = item.name || item.title || '';
          const history = tasks.filter(t => t.name === itemName && t.id !== item.id);
          return (
            <div className="space-y-2">
              {/* Current run */}
              <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-surface-raised border border-aurora-teal/20">
                <span className="text-[11px] font-mono text-text-muted">Current</span>
                <span className={cn("text-[10px] font-mono font-bold", (stColor[item.status] || stColor.pending).tx)}>{item.status}</span>
                <span className="text-[10px] font-mono text-text-disabled">{item.durationMs > 0 ? (item.durationMs < 1000 ? `${item.durationMs}ms` : `${(item.durationMs/1000).toFixed(1)}s`) : '—'}</span>
                <span className="text-[10px] font-mono text-text-disabled">${(item.costUsd || 0).toFixed(3)}</span>
              </div>
              {/* Previous runs */}
              {history.length === 0 && <p className="text-sm text-text-disabled text-center py-6">No previous runs found for this task.</p>}
              {history.map(h => {
                const hc = stColor[h.status] || stColor.completed;
                return (
                  <div key={h.id} className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-surface border border-border">
                    <span className="text-[11px] font-mono text-text-muted">{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : '—'}</span>
                    <span className={cn("text-[10px] font-mono font-bold", hc.tx)}>{h.status}</span>
                    <span className="text-[10px] font-mono text-text-disabled">{h.durationMs > 0 ? (h.durationMs < 1000 ? `${h.durationMs}ms` : `${(h.durationMs/1000).toFixed(1)}s`) : '—'}</span>
                    <span className="text-[10px] font-mono text-text-disabled">${(h.costUsd || 0).toFixed(3)}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {tab === 'output' && item.payload && <div className={cn("p-4 rounded-lg text-sm font-mono leading-relaxed whitespace-pre-wrap border", item.outputType === 'error' ? "bg-aurora-rose/5 border-aurora-rose/20 text-aurora-rose/90" : item.outputType === 'code' ? "bg-black/40 border-white/5 text-text-primary" : "bg-white/[0.02] border-white/5 text-text-body")}>{item.payload}</div>}
        {tab === 'output' && !item.payload && <p className="text-sm text-text-disabled text-center py-8">No output payload.</p>}
        {tab === 'notes' && (
          <div className="space-y-3">
            {notes.map(n => (
              <div key={n.id} className="p-3 bg-surface rounded-xl border border-border">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn("text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-full",
                    n.author === 'Human' ? "bg-aurora-teal/10 text-aurora-teal" : "bg-aurora-amber/10 text-aurora-amber"
                  )}>{n.author}</span>
                  <span className="text-[10px] font-mono text-text-disabled">{new Date(n.createdAt).toLocaleTimeString()}</span>
                </div>
                <p className="text-[12px] text-text-body leading-relaxed">{n.content}</p>
              </div>
            ))}
            {notesLoaded && notes.length === 0 && <p className="text-sm text-text-disabled text-center py-4">No notes yet.</p>}
            <div className="flex gap-2 mt-2">
              <input
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote(); }}
                placeholder="Add a note... (Cmd+Enter to save)"
                className="flex-1 bg-surface-input border border-border rounded-xl px-3 py-2.5 text-xs font-mono text-text-primary focus:border-aurora-teal/40 outline-none placeholder:text-text-disabled"
              />
              <button onClick={handleAddNote} disabled={!noteText.trim() || !!actionLoading}
                className="px-3 py-2.5 bg-aurora-teal text-black text-[11px] font-bold rounded-xl hover:bg-[#00ebd8] transition-colors disabled:opacity-50">
                {actionLoading === 'Note' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border p-4 flex gap-2">
        {isCompleted ? (
          /* Completed item actions */
          <>
            <button onClick={() => act('Acknowledge', () => { const tbl = item.outputType ? 'pending_reviews' : 'tasks'; return onAcknowledge(tbl, item.id); })} disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold text-aurora-teal bg-aurora-teal/5 border border-aurora-teal/20 rounded-xl hover:bg-aurora-teal/10">
              {actionLoading === 'Acknowledge' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}Acknowledge
            </button>
            <button onClick={() => act('Reopen', () => onReopen(item.id))} disabled={!!actionLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold text-aurora-amber bg-aurora-amber/5 border border-aurora-amber/20 rounded-xl hover:bg-aurora-amber/10">
              {actionLoading === 'Reopen' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}Reopen
            </button>
            <button onClick={() => onCopy(item)} className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-text-muted bg-surface border border-border rounded-xl hover:bg-surface-raised ml-auto"><Copy className="w-3.5 h-3.5" />Copy</button>
          </>
        ) : isApproval ? (
          /* Approval actions */
          <AnimatePresence mode="wait">
            {!showRejectForm ? (
              <motion.div key="btns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2 w-full">
                <button onClick={() => setShowRejectForm(true)} disabled={!!actionLoading} className="flex-1 h-11 flex items-center justify-center gap-2 border border-aurora-rose/30 bg-aurora-rose/5 text-aurora-rose rounded-xl font-bold uppercase text-[11px] hover:bg-aurora-rose/10"><XCircle className="w-4 h-4" />Reject</button>
                <button onClick={() => act('Snooze', () => onSnooze(item.id))} disabled={!!actionLoading} className="h-11 px-3 flex items-center justify-center gap-1.5 border border-border bg-surface text-text-muted rounded-xl text-[11px] font-bold hover:bg-surface-raised">
                  {actionLoading === 'Snooze' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlarmClock className="w-3.5 h-3.5" />}30m
                </button>
                <button onClick={() => act('Approve', () => onApprove(item.id))} disabled={!!actionLoading} className="flex-[2] h-11 flex items-center justify-center gap-2 bg-aurora-teal text-black rounded-xl font-bold uppercase text-[11px] shadow-[0_0_20px_rgba(0,217,200,0.2)] hover:bg-[#00ebd8]">{actionLoading === 'Approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Approve</button>
              </motion.div>
            ) : (
              <motion.div key="reject" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2 w-full">
                <input autoFocus value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Feedback..." className="flex-1 h-11 bg-surface-input border border-aurora-rose/40 rounded-xl px-4 text-sm font-mono text-text-primary focus:outline-none placeholder:text-text-disabled" />
                <button onClick={() => { setShowRejectForm(false); setFeedback(''); }} className="h-11 px-4 border border-border rounded-xl text-text-muted text-[11px] font-semibold">Cancel</button>
                <button onClick={() => act('Reject', () => onReject(item.id, feedback.trim()))} disabled={!feedback.trim() || !!actionLoading} className="h-11 px-5 bg-aurora-rose text-white rounded-xl font-bold uppercase text-[11px] flex items-center gap-1.5">{actionLoading === 'Reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}Send</button>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          /* Task actions */
          <>
            {isRunning && <button onClick={() => act('Stop', () => onStop(item.id))} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-rose bg-aurora-rose/5 border border-aurora-rose/20 rounded-xl hover:bg-aurora-rose/10">{actionLoading === 'Stop' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}Stop</button>}
            <button onClick={() => act('Rerun', () => onRetry(item.id))} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-amber bg-aurora-amber/5 border border-aurora-amber/20 rounded-xl hover:bg-aurora-amber/10">{actionLoading === 'Rerun' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}Rerun</button>
            <button onClick={() => onCopy(item)} className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-text-muted bg-surface border border-border rounded-xl hover:bg-surface-raised ml-auto"><Copy className="w-3.5 h-3.5" />Copy</button>
          </>
        )}
      </div>
    </motion.div>
  </>);
}

// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE SIDEBAR
// ═══════════════════════════════════════════════════════════════

function IntelSidebar({ tasks, approvals, completed, agents, schedules }) {
  const totalCost = tasks.reduce((s, t) => s + (t.costUsd || 0), 0);
  const failedCount = tasks.filter(t => t.status === 'failed' || t.status === 'error').length;
  const runningCount = tasks.filter(t => t.status === 'running').length;
  const avgApprovalWait = approvals.length > 0 ? Math.round(approvals.reduce((s, a) => s + (a.waitingMs || 0), 0) / approvals.length / 60000) : 0;

  // Derive recommendations from real data
  const recs = [];
  if (failedCount > 0) {
    const failedAgents = [...new Set(tasks.filter(t => t.status === 'failed' || t.status === 'error').map(t => t.agentName || 'Unknown'))];
    recs.push({ type: 'anomaly', text: `${failedCount} failed task${failedCount > 1 ? 's' : ''} from ${failedAgents.join(', ')}. Check agent health and retry or reassign.`, imp: 'high' });
  }
  if (avgApprovalWait > 3) {
    recs.push({ type: 'bottleneck', text: `Approval queue averaging ${avgApprovalWait}m wait. Consider auto-approve rules for low-risk items.`, imp: 'high' });
  }
  if (totalCost > 1) {
    recs.push({ type: 'cost', text: `Session cost at $${totalCost.toFixed(2)}. Review if research tasks can use cheaper models.`, imp: 'med' });
  }
  if (recs.length === 0 && agents.length > 0) {
    recs.push({ type: 'status', text: `${agents.length} agents in fleet, ${runningCount} active. All systems nominal.`, imp: 'low' });
  }

  // Mission goals derived from real data
  const goals = [
    { lb: 'Approval queue < 2m', pct: avgApprovalWait <= 2 ? 100 : Math.max(0, 100 - avgApprovalWait * 15), c: avgApprovalWait <= 2 ? '#34d399' : '#fbbf24' },
    { lb: 'Zero failures today', pct: failedCount === 0 ? 100 : Math.max(0, 100 - failedCount * 25), c: failedCount === 0 ? '#34d399' : '#fb7185' },
    { lb: `${schedules.length} automations set`, pct: Math.min(100, schedules.length * 20), c: '#60a5fa' },
  ];

  return (<div className="flex flex-col gap-4">
    {/* Mission Goals */}
    <div className="p-3 rounded-2xl bg-surface border border-border">
      <div className="flex items-center gap-2 mb-2.5"><Target className="w-3.5 h-3.5 text-aurora-teal" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Mission Goals</span></div>
      {goals.map(g => (
        <div key={g.lb} className="mb-2.5 last:mb-0">
          <div className="flex items-center justify-between mb-1"><span className="text-[11px] text-text-body">{g.lb}</span><span className="text-[11px] font-mono font-bold" style={{ color: g.c }}>{g.pct}%</span></div>
          <div className="w-full h-1.5 rounded-full bg-surface-raised overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${g.pct}%`, backgroundColor: g.c }} /></div>
        </div>
      ))}
    </div>

    {/* Recommendations */}
    {recs.length > 0 && (
      <div className="p-3 rounded-2xl bg-surface border border-border">
        <div className="flex items-center gap-2 mb-2.5"><Sparkles className="w-3.5 h-3.5 text-aurora-violet" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">AI Recommendations</span></div>
        <div className="space-y-1.5">
          {recs.map((r, i) => (
            <div key={i} className={cn("p-2.5 rounded-xl border border-border border-l-[3px]",
              r.imp === 'high' ? 'bg-aurora-rose/[0.03] border-l-aurora-rose' :
              r.imp === 'med' ? 'bg-aurora-amber/[0.03] border-l-aurora-amber' :
              'bg-aurora-teal/[0.03] border-l-aurora-teal'
            )}>
              <span className={cn("text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-full mb-1.5 inline-block",
                r.type === 'anomaly' ? 'bg-aurora-rose/10 text-aurora-rose' :
                r.type === 'cost' ? 'bg-aurora-amber/10 text-aurora-amber' :
                r.type === 'bottleneck' ? 'bg-aurora-violet/10 text-aurora-violet' :
                'bg-aurora-teal/10 text-aurora-teal'
              )}>{r.type}</span>
              <p className="text-[11px] text-text-body leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Daily Digest */}
    <div className="p-3 rounded-2xl bg-surface border border-border">
      <div className="flex items-center gap-2 mb-2.5"><TrendingUp className="w-3.5 h-3.5 text-aurora-teal" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Today's Digest</span></div>
      <div className="space-y-1.5 text-[11px] font-mono">
        <div className="flex justify-between"><span className="text-text-muted">Agents</span><span className="text-text-primary">{agents.length}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Running</span><span className="text-aurora-amber">{runningCount}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Completed</span><span className="text-aurora-teal">{completed.length}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Approvals</span><span className="text-aurora-amber">{approvals.length}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Failed</span><span className="text-aurora-rose">{failedCount}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Schedules</span><span className="text-aurora-blue">{schedules.filter(s => s.enabled).length}</span></div>
        <div className="flex justify-between border-t border-border pt-1.5 mt-1.5"><span className="text-text-muted">Total cost</span><span className="text-text-primary">${totalCost.toFixed(2)}</span></div>
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// PLANNER TAB (static until schedules table)
// ═══════════════════════════════════════════════════════════════

function PlannerTab({ schedules, agents, onToggle, onDispatch }) {
  const enabled = schedules.filter(s => s.enabled);
  const paused = schedules.filter(s => !s.enabled);

  return (<div className="flex-1 overflow-y-auto no-scrollbar pr-1">
    {/* Queued / upcoming */}
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3"><Calendar className="w-3.5 h-3.5 text-aurora-teal" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Upcoming Schedules ({enabled.length})</span></div>
      {enabled.length === 0 && <p className="text-center text-text-disabled py-8 text-sm">No active schedules. Create one in Supabase to get started.</p>}
      <div className="space-y-2">
        {enabled.map(s => {
          const agent = agents.find(a => a.id === s.agentId);
          const lCfg = stColor[s.lastResult] || stColor.pending;
          return (
            <div key={s.id} className="px-4 py-3.5 rounded-2xl border border-border bg-surface">
              <div className="flex items-center gap-3 mb-2">
                <AgentAvatar agent={agent} name={agent?.name || '?'} />
                <span className="text-[13px] font-semibold text-text-primary flex-1 truncate">{s.name}</span>
                {s.nextRunAt && <span className="text-[11px] font-mono text-aurora-blue">{new Date(s.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                {s.approvalRequired && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-aurora-amber/10 text-aurora-amber border border-aurora-amber/20">Approval</span>}
              </div>
              <div className="flex items-center gap-3 ml-8">
                <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Repeat className="w-3 h-3" />{s.cadence}</span>
                <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Timer className="w-3 h-3" />~{s.estMinutes}m</span>
                <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><DollarSign className="w-3 h-3" />${s.estCost.toFixed(2)}</span>
                <PriBadge v={s.priority} />
                {s.lastResult && <span className="text-[10px] font-mono text-text-disabled">Last: <span className={lCfg.tx}>{s.lastResult}</span></span>}
              </div>
              <div className="flex items-center gap-2 mt-3 ml-8">
                <button onClick={() => onDispatch(s)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-aurora-teal bg-aurora-teal/5 border border-aurora-teal/20 rounded-lg hover:bg-aurora-teal/10"><Send className="w-3 h-3" />Dispatch Now</button>
                <button onClick={() => onToggle(s.id, false)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-text-muted bg-surface border border-border rounded-lg hover:bg-surface-raised"><AlarmClock className="w-3 h-3" />Pause</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Paused */}
    {paused.length > 0 && (
      <div>
        <div className="flex items-center gap-2 mb-3"><Repeat className="w-3.5 h-3.5 text-text-disabled" /><span className="text-[11px] font-bold uppercase text-text-disabled tracking-wider">Paused ({paused.length})</span></div>
        <div className="space-y-2 opacity-60">
          {paused.map(s => {
            const agent = agents.find(a => a.id === s.agentId);
            return (
              <div key={s.id} className="px-4 py-3 rounded-2xl border border-border bg-surface">
                <div className="flex items-center gap-3">
                  <AgentAvatar agent={agent} name={agent?.name || '?'} />
                  <span className="text-[12px] font-semibold text-text-body flex-1 truncate">{s.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-text-muted">Paused</span>
                </div>
                <div className="flex items-center gap-2 mt-2 ml-8">
                  <button onClick={() => onToggle(s.id, true)} className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-aurora-teal bg-aurora-teal/5 border border-aurora-teal/20 rounded-lg hover:bg-aurora-teal/10">Enable</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// MAIN VIEW
// ═══════════════════════════════════════════════════════════════

export function MissionControlView() {
  const { setPendingCount } = useSystemState();
  const [agents, setAgents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('ops');
  const [sel, setSel] = useState(null);

  const reload = useCallback(async () => {
    const [a, t, l, p, c, s] = await Promise.all([fetchAgents(), fetchTasks(), fetchActivityLog(), fetchPendingReviews(), fetchCompletedOutputs(), fetchSchedules()]);
    setAgents(a); setTasks(t); setLogs(l); setApprovals(p); setCompleted(c); setSchedules(s);
    setPendingCount(p.length);
  }, [setPendingCount]);

  useEffect(() => { let x = false; reload().then(() => { if (!x) setLoaded(true); }); return () => { x = true; }; }, [reload]);
  useEffect(() => { const u = subscribeToPendingReviews(() => reload()); return u; }, [reload]);

  const running = tasks.filter(t => t.status === 'running').length;
  const failed = tasks.filter(t => t.status === 'failed' || t.status === 'error').length;

  const criticalItems = useMemo(() => {
    const c = []; approvals.filter(a => a.urgency === 'critical' || a.status === 'needs_intervention').forEach(a => c.push(a));
    tasks.filter(t => t.status === 'failed' || t.status === 'error').slice(0, 2).forEach(t => c.push(t));
    return c.slice(0, 3);
  }, [approvals, tasks]);

  async function handleApprove(id) { await approveReview(id); setSel(null); reload(); }
  async function handleReject(id, fb) { await rejectReview(id, fb); setSel(null); reload(); }
  async function handleRetry(id) { await retryTask(id); reload(); }
  async function handleStop(id) { await stopTask(id); reload(); }
  async function handleAcknowledge(table, id) { await acknowledgeItem(table, id); setSel(null); reload(); }
  async function handleReopen(id) { await reopenReview(id); setSel(null); reload(); }
  async function handleSnooze(id) { await snoozeReview(id, 30); setSel(null); reload(); }
  async function handleToggleSchedule(id, enabled) { await toggleSchedule(id, enabled); reload(); }
  async function handleDispatch(schedule) { await dispatchFromSchedule(schedule, agents); reload(); }
  function handleCopy(item) { navigator.clipboard?.writeText(`${item.name || item.title}\nStatus: ${item.status}\nAgent: ${item.agentName || ''}\nCost: $${item.costUsd?.toFixed(3) || '0.000'}`); }

  const selectedItem = sel ? [...tasks, ...approvals, ...completed].find(i => i.id === sel) : null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  if (!loaded) return <div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 text-aurora-teal animate-spin" /></div>;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="text-[13px] text-text-muted font-mono">{dateStr}</p>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight mt-1">{greeting}, Commander</h1>
            <p className="text-[14px] text-text-muted mt-1">What needs your attention today?</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-aurora-teal text-black text-sm font-semibold hover:bg-[#00ebd8] transition-colors">
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>

        <div className="flex items-center gap-1 bg-surface rounded-2xl p-1 border border-border">
          {[
            { id: 'ops', lb: 'Operations', ic: Radio, ct: running },
            { id: 'plan', lb: 'Planner', ic: Calendar, ct: schedules.filter(s => s.enabled).length },
            { id: 'app', lb: 'Approvals', ic: ShieldCheck, ct: approvals.length },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all",
              tab === t.id ? "bg-surface-raised text-text-primary shadow-sm" : "text-text-muted hover:text-text-primary"
            )}>
              <t.ic className="w-4 h-4" />{t.lb}
              {t.ct > 0 && <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", tab === t.id ? "bg-aurora-teal/10 text-aurora-teal" : "bg-surface-raised text-text-disabled")}>{t.ct}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Pulse strip */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { lb: 'Active', v: running, c: 'text-aurora-amber' },
          { lb: 'Failed', v: failed, c: 'text-aurora-rose' },
          { lb: 'Approvals', v: approvals.length, c: 'text-aurora-amber' },
          { lb: 'Done Today', v: completed.length, c: 'text-aurora-teal' },
        ].map(s => (
          <div key={s.lb} className="flex-1 px-3 py-2.5 rounded-2xl bg-surface border border-border flex items-center gap-2">
            <span className={cn("text-xl font-mono font-bold", s.c)}>{s.v}</span>
            <span className="text-[10px] font-medium text-text-muted uppercase">{s.lb}</span>
          </div>
        ))}
      </div>

      {/* Critical lane */}
      {criticalItems.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 rounded-full bg-aurora-rose animate-pulse" /><span className="text-[11px] font-bold uppercase text-aurora-rose tracking-wider">Critical — Needs You Now</span></div>
          <div className="flex gap-3">
            {criticalItems.map(item => (
              <Card key={item.id} onClick={() => setSel(item.id)} className="flex-1 p-4">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-aurora-rose rounded-l-2xl" />
                <div className="flex items-center gap-2 mb-1">
                  <AgentAvatar agent={agents.find(a => a.id === (item.agentId || item.agent_id))} name={item.agentName} />
                  <span className="text-[12px] font-semibold text-text-primary truncate flex-1">{item.name || item.title}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Main: content + intel sidebar */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        <div className="flex-[3] flex flex-col min-w-0 overflow-y-auto no-scrollbar space-y-2 pr-1">
          {tab === 'ops' && tasks.map(t => <ItemRow key={t.id} item={t} agents={agents} selected={sel === t.id} onClick={() => setSel(t.id)} />)}
          {tab === 'ops' && tasks.length === 0 && <p className="text-center text-text-disabled py-12">No active tasks.</p>}

          {tab === 'plan' && <PlannerTab schedules={schedules} agents={agents} onToggle={handleToggleSchedule} onDispatch={handleDispatch} />}

          {tab === 'app' && (() => {
            const now = Date.now();
            const visible = approvals.filter(a => !a.snoozedUntil || new Date(a.snoozedUntil).getTime() <= now);
            const snoozed = approvals.filter(a => a.snoozedUntil && new Date(a.snoozedUntil).getTime() > now);
            return (<>
              {visible.map(a => <ItemRow key={a.id} item={a} agents={agents} selected={sel === a.id} onClick={() => setSel(a.id)} />)}
              {visible.length === 0 && snoozed.length === 0 && <p className="text-center text-text-disabled py-12">No pending approvals. All clear.</p>}
              {snoozed.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2"><AlarmClock className="w-3 h-3 text-text-disabled" /><span className="text-[11px] font-bold uppercase text-text-disabled tracking-wider">Snoozed ({snoozed.length})</span></div>
                  <div className="space-y-1.5 opacity-60">{snoozed.map(a => <ItemRow key={a.id} item={a} agents={agents} selected={sel === a.id} onClick={() => setSel(a.id)} />)}</div>
                </div>
              )}
            </>);
          })()}

          {/* Recently completed */}
          {(tab === 'ops' || tab === 'app') && completed.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-2"><Archive className="w-3 h-3 text-text-disabled" /><span className="text-[11px] font-bold uppercase text-text-disabled tracking-wider">Recently Completed</span></div>
              <div className="space-y-1.5 opacity-80">
                {completed.map(c => (
                  <button key={c.id} onClick={() => setSel(c.id)} className="w-full text-left px-4 py-3 rounded-2xl border bg-surface/60 border-border/60 hover:bg-surface transition-all flex items-center gap-3">
                    <AgentAvatar agent={agents.find(a => a.id === (c.agentId || c.agent_id))} name={c.agentName} />
                    <span className="text-[12px] text-text-body flex-1 truncate">{c.name || c.title}</span>
                    <span className="text-[10px] font-mono text-text-disabled">{c.completedAt}</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-aurora-teal shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Intel sidebar */}
        <div className="w-[260px] shrink-0 overflow-y-auto no-scrollbar">
          <IntelSidebar tasks={tasks} approvals={approvals} completed={completed} agents={agents} schedules={schedules} />
        </div>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedItem && <Drawer item={selectedItem} agents={agents} tasks={tasks} logs={logs} onClose={() => setSel(null)} onApprove={handleApprove} onReject={handleReject} onRetry={handleRetry} onStop={handleStop} onCopy={handleCopy} onAcknowledge={handleAcknowledge} onReopen={handleReopen} onSnooze={handleSnooze} onReload={reload} />}
      </AnimatePresence>
    </div>
  );
}
