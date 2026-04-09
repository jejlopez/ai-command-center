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
} from '../lib/api';
import { useSystemState } from '../context/SystemStateContext';

// ═══════════════════════════════════════════════════════════════
// STATIC PLANNER DATA (until schedules table exists)
// ═══════════════════════════════════════════════════════════════

const PLAN_QUEUE = [
  { id: 'pq1', name: 'Morning cost digest', agent: 'Orion', sched: '09:00 AM', pri: 6, approve: false, est: '~2 min', estC: '$0.04' },
  { id: 'pq2', name: 'Close stale Pipedrive quotes', agent: 'Atlas', sched: '10:00 AM', pri: 9, approve: true, est: '~5 min', estC: '$0.18' },
  { id: 'pq3', name: 'Weekly fleet report', agent: 'Nova', sched: '11:00 AM', pri: 5, approve: false, est: '~3 min', estC: '$0.06' },
];

const PLAN_ROUTINES = [
  { id: 'r1', name: 'Broadway lottery entries', cad: 'Daily 9 AM', agent: 'Atlas', st: 'enabled', last: 'success' },
  { id: 'r2', name: 'Cost digest email', cad: 'Weekdays 8:30 AM', agent: 'Orion', st: 'enabled', last: 'success' },
  { id: 'r3', name: 'Vector index compaction', cad: 'Weekly Sun 2 AM', agent: 'Sol', st: 'enabled', last: 'success' },
];

const INTEL_RECS = [
  { type: 'anomaly', text: 'Check for repeated failures on vector batch tasks. Consider switching to a larger instance.', imp: 'high' },
  { type: 'cost', text: 'Research tasks using Opus could run on Sonnet at 80% lower cost with similar quality.', imp: 'med' },
  { type: 'bottleneck', text: 'Approval queue growing — consider auto-approve rules for low-risk QA passes.', imp: 'high' },
];

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

function Drawer({ item, agents, tasks, logs, onClose, onApprove, onReject, onRetry, onStop, onCopy }) {
  const [tab, setTab] = useState('timeline');
  const [feedback, setFeedback] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);

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
        {tab === 'notes' && <div className="space-y-3"><p className="text-sm text-text-disabled text-center py-4">Notes available after task_notes table is created.</p><textarea placeholder="Add a note..." rows={2} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-xs font-mono text-text-primary resize-none focus:border-aurora-teal/40 outline-none placeholder:text-text-disabled" /></div>}
      </div>

      <div className="shrink-0 border-t border-border p-4 flex gap-2">
        {isApproval && !isCompleted ? (
          <AnimatePresence mode="wait">
            {!showRejectForm ? (
              <motion.div key="btns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2 w-full">
                <button onClick={() => setShowRejectForm(true)} disabled={!!actionLoading} className="flex-1 h-11 flex items-center justify-center gap-2 border border-aurora-rose/30 bg-aurora-rose/5 text-aurora-rose rounded-xl font-bold uppercase text-[11px] hover:bg-aurora-rose/10"><XCircle className="w-4 h-4" />Reject</button>
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

function IntelSidebar({ tasks, approvals, completed }) {
  const totalCost = tasks.reduce((s, t) => s + (t.costUsd || 0), 0);
  return (<div className="flex flex-col gap-4">
    <div className="p-3 rounded-2xl bg-surface border border-border">
      <div className="flex items-center gap-2 mb-2.5"><Sparkles className="w-3.5 h-3.5 text-aurora-violet" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">AI Recommendations</span></div>
      <div className="space-y-1.5">
        {INTEL_RECS.map((r, i) => (
          <div key={i} className={cn("p-2.5 rounded-xl border border-border", r.imp === 'high' ? 'bg-aurora-rose/[0.03] border-l-[3px] border-l-aurora-rose' : 'bg-aurora-amber/[0.03] border-l-[3px] border-l-aurora-amber')}>
            <span className={cn("text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-full mb-1.5 inline-block", r.type === 'anomaly' ? 'bg-aurora-rose/10 text-aurora-rose' : r.type === 'cost' ? 'bg-aurora-amber/10 text-aurora-amber' : 'bg-aurora-violet/10 text-aurora-violet')}>{r.type}</span>
            <p className="text-[11px] text-text-body leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>
    </div>

    <div className="p-3 rounded-2xl bg-surface border border-border">
      <div className="flex items-center gap-2 mb-2.5"><TrendingUp className="w-3.5 h-3.5 text-aurora-teal" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Today's Digest</span></div>
      <div className="space-y-1.5 text-[11px] font-mono">
        <div className="flex justify-between"><span className="text-text-muted">Completed</span><span className="text-aurora-teal">{completed.length}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Approvals</span><span className="text-aurora-amber">{approvals.length}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Failed</span><span className="text-aurora-rose">{tasks.filter(t => t.status === 'failed' || t.status === 'error').length}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Total cost</span><span className="text-text-primary">${totalCost.toFixed(2)}</span></div>
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// PLANNER TAB (static until schedules table)
// ═══════════════════════════════════════════════════════════════

function PlannerTab() {
  return (<div className="flex-1 overflow-y-auto no-scrollbar pr-1">
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3"><Calendar className="w-3.5 h-3.5 text-aurora-teal" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Queued for Today</span></div>
      <div className="space-y-2">
        {PLAN_QUEUE.map(j => (
          <div key={j.id} className="px-4 py-3.5 rounded-2xl border border-border bg-surface">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-6 h-6 rounded-full bg-aurora-teal/10 flex items-center justify-center text-[10px] font-bold text-aurora-teal ring-1 ring-aurora-teal/20">{j.agent[0]}</span>
              <span className="text-[11px] font-medium text-text-muted">{j.agent}</span>
              <span className="text-[13px] font-semibold text-text-primary flex-1 truncate">{j.name}</span>
              <span className="text-[11px] font-mono text-aurora-blue">{j.sched}</span>
              {j.approve && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-aurora-amber/10 text-aurora-amber border border-aurora-amber/20">Approval</span>}
            </div>
            <div className="flex items-center gap-3 ml-8">
              <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Timer className="w-3 h-3" />{j.est}</span>
              <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><DollarSign className="w-3 h-3" />{j.estC}</span>
              <PriBadge v={j.pri} />
            </div>
          </div>
        ))}
      </div>
    </div>
    <div>
      <div className="flex items-center gap-2 mb-3"><Repeat className="w-3.5 h-3.5 text-aurora-violet" /><span className="text-[11px] font-bold uppercase text-text-muted tracking-wider">Automations</span></div>
      <div className="space-y-2">
        {PLAN_ROUTINES.map(r => {
          const cfg = stColor[r.st] || stColor.paused;
          const lCfg = stColor[r.last] || stColor.success;
          return (<div key={r.id} className="px-4 py-3 rounded-2xl border border-border bg-surface">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-aurora-violet/10 flex items-center justify-center text-[10px] font-bold text-aurora-violet ring-1 ring-aurora-violet/20">{r.agent[0]}</span>
              <span className="text-[11px] font-medium text-text-muted">{r.agent}</span>
              <span className="text-[12px] font-semibold text-text-primary flex-1 truncate">{r.name}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", cfg.bg, cfg.tx)}>{cfg.lb}</span>
            </div>
            <div className="flex items-center gap-4 mt-1.5 ml-8 text-[10px] font-mono text-text-disabled">
              <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />{r.cad}</span>
              <span>Last: <span className={lCfg.tx}>{r.last}</span></span>
            </div>
          </div>);
        })}
      </div>
    </div>
    <p className="text-[10px] text-text-disabled text-center mt-6 font-mono">Planner shows static data — schedules table coming in Phase 3</p>
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
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('ops');
  const [sel, setSel] = useState(null);

  const reload = useCallback(async () => {
    const [a, t, l, p, c] = await Promise.all([fetchAgents(), fetchTasks(), fetchActivityLog(), fetchPendingReviews(), fetchCompletedOutputs()]);
    setAgents(a); setTasks(t); setLogs(l); setApprovals(p); setCompleted(c);
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
            { id: 'plan', lb: 'Planner', ic: Calendar, ct: PLAN_QUEUE.length },
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

          {tab === 'plan' && <PlannerTab />}

          {tab === 'app' && approvals.map(a => <ItemRow key={a.id} item={a} agents={agents} selected={sel === a.id} onClick={() => setSel(a.id)} />)}
          {tab === 'app' && approvals.length === 0 && <p className="text-center text-text-disabled py-12">No pending approvals. All clear.</p>}

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
          <IntelSidebar tasks={tasks} approvals={approvals} completed={completed} />
        </div>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedItem && <Drawer item={selectedItem} agents={agents} tasks={tasks} logs={logs} onClose={() => setSel(null)} onApprove={handleApprove} onReject={handleReject} onRetry={handleRetry} onStop={handleStop} onCopy={handleCopy} />}
      </AnimatePresence>
    </div>
  );
}
