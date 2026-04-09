/**
 * STATIC MOCKUP — Mission Control Unified View
 *
 * This is a visual prototype only. No real data, no Supabase, no hooks.
 * All data is hardcoded inline for UI review purposes.
 *
 * DO NOT import this into production routes until approved.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Clock, Zap, ShieldCheck, AlertTriangle, X,
  StopCircle, RotateCcw, Copy, CheckCircle2, XCircle,
  CornerDownLeft, FileText, Code2, MessageSquare, Database,
  ExternalLink, ChevronDown,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ═══════════════════════════════════════════════════════════════
//  STATIC SAMPLE DATA
// ═══════════════════════════════════════════════════════════════

const SAMPLE_ITEMS = [
  { id: 'rv2', kind: 'approval', time: '10:07', name: 'Agent Crashed — OOMKilled', status: 'needs_intervention', urgency: 'critical', agent: 'Lyra', outputType: 'error', cost: null,
    summary: 'Lyra exceeded memory limit during data processing. Agent paused.',
    payload: 'ERROR: OOMKilled — memory limit exceeded\nContainer: lyra-agent-worker-02\nMemory limit: 512MB | Peak usage: 743MB' },
  { id: 't4', kind: 'task', time: '10:06', name: 'Wait for Reply', status: 'running', agent: 'Atlas', durationMs: 4200, cost: 0.00 },
  { id: 'rv1', kind: 'approval', time: '10:05', name: 'Navigation Component', status: 'awaiting_approval', urgency: 'high', agent: 'Vega', outputType: 'code', cost: null,
    summary: 'Generated animated sidebar navigation with route transitions.',
    payload: 'import React from "react";\nimport { motion } from "framer-motion";\n\nexport function Navigation() {\n  return <motion.nav />;\n}' },
  { id: 'rv6', kind: 'approval', time: '10:05', name: 'Data Integrity Warning', status: 'awaiting_approval', urgency: 'high', agent: 'Nova', outputType: 'error', cost: null,
    summary: 'Nova detected 2 hallucinated URLs in research output.',
    payload: 'QA ALERT: Hallucination Detected\n\nFlagged items:\n  1. URL does not resolve\n  2. Citation not found in source DB' },
  { id: 't1', kind: 'task', time: '10:04', name: 'Scrape Sites', status: 'completed', agent: 'Atlas', durationMs: 890, cost: 0.12 },
  { id: 'rv3', kind: 'approval', time: '10:03', name: 'QA Report — Lottery Run', status: 'awaiting_approval', urgency: 'normal', agent: 'Nova', outputType: 'report', cost: null,
    summary: 'Quality review — all checks passed.',
    payload: '# QA Report\n\n## Result\n**PASS** — No issues found.' },
  { id: 't2', kind: 'task', time: '10:03', name: 'Parse Results', status: 'completed', agent: 'Atlas', durationMs: 620, cost: 0.08 },
  { id: 't3', kind: 'task', time: '10:02', name: 'Send iMessage', status: 'completed', agent: 'Atlas', durationMs: 210, cost: 0.02 },
  { id: 'rv4', kind: 'approval', time: '10:01', name: 'Send iMessage to Contacts', status: 'awaiting_approval', urgency: 'high', agent: 'Atlas', outputType: 'message', cost: null,
    summary: 'Atlas wants to send lottery confirmation to 2 contacts.',
    payload: 'To: +1 (201) 555-0147\nMessage: "Lottery entries submitted!"' },
  { id: 't5', kind: 'task', time: '10:00', name: 'Enter Lottery', status: 'pending', agent: 'Atlas', durationMs: 0, cost: 0.00 },
  { id: 'rv5', kind: 'approval', time: '09:58', name: 'Dashboard Card Component', status: 'awaiting_approval', urgency: 'normal', agent: 'Vega', outputType: 'code', cost: null,
    summary: 'New reusable metric card with sparkline.',
    payload: 'export function MetricCard({ label, value }) {\n  return <div>{value}</div>;\n}' },
];

const SAMPLE_PRIORITIES = [
  { id: 'ep1', title: 'Clean up stalled quotes in Pipedrive', priority: 'critical', due: 'Today', owner: 'Tony', description: '14 quotes sitting in "sent" for 7+ days. Auto-close or follow up.', progress: 35 },
  { id: 'ep2', title: 'Analyze margin on rush shipments', priority: 'high', due: 'Tomorrow', owner: 'Tony', description: 'Pull last 30 rush jobs over 8 pallets — find where we lose money.', progress: 10 },
  { id: 'ep3', title: 'Build weekly cost digest automation', priority: 'normal', due: 'This week', owner: 'Human', description: 'Replace manual spreadsheet export with automated flow.', progress: 0 },
];

const SAMPLE_NOTES = [
  { id: 'n1', text: 'We are leaking margin on rush jobs > 8 pallets. Have Tony pull last 30 and analyze.', time: '10:02' },
  { id: 'n2', text: 'Automate the weekly cost report — too much manual work.', time: '09:45' },
  { id: 'n3', text: "Pipeline latency spiked after vector batch change. Check Lyra's OOM.", time: '09:30' },
];

const SAMPLE_TIMELINE = [
  { id: 'l1', time: '10:04:12', type: 'SYS', message: 'Atlas context loaded — 4096 tokens', tokens: 4096 },
  { id: 'l2', time: '10:04:14', type: 'NET', message: 'Connecting to lottery.broadwaydirect.com', durationMs: 890 },
  { id: 'l3', time: '10:04:15', type: 'OK', message: 'Firecrawl scrape complete — 3 shows found', tokens: 340 },
  { id: 'l4', time: '10:04:18', type: 'OK', message: 'iMessage sent to +1 (201) 555-0147', durationMs: 210 },
  { id: 'l5', time: '10:04:20', type: 'SYS', message: 'Polling for reply — timeout 11:00 AM' },
];

const SAMPLE_TASK_NOTES = [
  { id: 'tn1', author: 'Tony', text: 'Firecrawl returned 3 shows — all lottery windows confirmed open.', time: '10:04' },
  { id: 'tn2', author: 'Human', text: 'Check if Wicked lottery closes early on matinee days.', time: '09:50' },
];

// ═══════════════════════════════════════════════════════════════
//  STYLE CONSTANTS
// ═══════════════════════════════════════════════════════════════

const statusConfig = {
  completed:           { accent: '#00D9C8', label: 'DONE',    bg: 'bg-aurora-teal/10',  text: 'text-aurora-teal' },
  running:             { accent: '#fbbf24', label: 'RUNNING', bg: 'bg-aurora-amber/10', text: 'text-aurora-amber' },
  pending:             { accent: '#60a5fa', label: 'PENDING', bg: 'bg-aurora-blue/10',  text: 'text-aurora-blue' },
  error:               { accent: '#fb7185', label: 'FAILED',  bg: 'bg-aurora-rose/10',  text: 'text-aurora-rose' },
  awaiting_approval:   { accent: '#fbbf24', label: 'REVIEW',  bg: 'bg-aurora-amber/10', text: 'text-aurora-amber' },
  needs_intervention:  { accent: '#fb7185', label: 'ALERT',   bg: 'bg-aurora-rose/10',  text: 'text-aurora-rose' },
};

const urgencyAccent = { critical: 'border-l-aurora-rose', high: 'border-l-aurora-amber', normal: 'border-l-aurora-teal' };

const priorityStyles = {
  critical: { bg: 'bg-aurora-teal/10', text: 'text-aurora-teal', label: 'Critical' },
  high:     { bg: 'bg-aurora-amber/10', text: 'text-aurora-amber', label: 'High' },
  normal:   { bg: 'bg-white/5',         text: 'text-text-muted',    label: 'Normal' },
};

const typeIcons = { code: Code2, report: FileText, error: AlertTriangle, message: MessageSquare, data: Database };

// ═══════════════════════════════════════════════════════════════
//  COMPONENTS
// ═══════════════════════════════════════════════════════════════

function RailRow({ item, isSelected, onClick }) {
  const cfg = statusConfig[item.status] || statusConfig.pending;
  const isApproval = item.kind === 'approval';
  const isRunning = item.status === 'running';
  const TypeIcon = isApproval ? (typeIcons[item.outputType] || FileText) : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 rounded-lg border-l-[3px] border transition-all duration-150 flex items-center gap-3 group relative",
        isApproval ? (urgencyAccent[item.urgency] || 'border-l-aurora-teal') : 'border-l-transparent',
        isSelected
          ? "bg-white/[0.05] border-r-0 border-t-white/[0.08] border-b-white/[0.08] shadow-[0_0_20px_rgba(0,217,200,0.06)]"
          : "border-white/[0.03] hover:bg-white/[0.025] hover:-translate-y-[1px]"
      )}
    >
      {isRunning && (
        <span className="absolute right-3 top-3 flex h-2 w-2">
          <span className="animate-ping absolute h-full w-full rounded-full opacity-75" style={{ backgroundColor: cfg.accent }} />
          <span className="relative rounded-full h-2 w-2" style={{ backgroundColor: cfg.accent }} />
        </span>
      )}

      <span className="text-[10px] font-mono text-text-disabled w-11 shrink-0">{item.time}</span>

      {isApproval && TypeIcon && (
        <TypeIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
      )}
      {!isApproval && (
        <Zap className="w-3.5 h-3.5 text-text-disabled shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <span className="text-[12px] font-medium text-text-primary truncate block">{item.name}</span>
        {isApproval && item.summary && (
          <span className="text-[10px] text-text-muted truncate block mt-0.5">{item.summary}</span>
        )}
      </div>

      <span className={cn("px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase shrink-0", cfg.bg, cfg.text)}>
        {cfg.label}
      </span>

      <span className="text-[10px] font-mono text-text-disabled shrink-0 w-10 text-right">
        {isApproval ? (item.agent) : (item.cost != null ? `$${item.cost.toFixed(2)}` : '')}
      </span>
    </button>
  );
}

function DrawerContent({ item, onClose }) {
  const [tab, setTab] = useState(item.kind === 'approval' ? 'output' : 'timeline');
  const [feedback, setFeedback] = useState('');
  const [showReject, setShowReject] = useState(false);
  const cfg = statusConfig[item.status] || statusConfig.pending;
  const isApproval = item.kind === 'approval';

  const tabs = isApproval
    ? [{ id: 'output', label: 'Output' }, { id: 'timeline', label: 'Timeline' }, { id: 'notes', label: 'Notes' }]
    : [{ id: 'timeline', label: 'Timeline' }, { id: 'notes', label: 'Notes' }];

  return (
    <>
      <motion.div
        key="drawer-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.div
        key="drawer-panel"
        initial={{ x: '100%' }} animate={{ x: '0%' }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        className="fixed top-0 right-0 bottom-0 w-[500px] bg-surface border-l border-border z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
      >
        {/* Header */}
        <div className="p-5 border-b border-border bg-canvas/30 backdrop-blur shrink-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {isApproval && <ShieldCheck className="w-4 h-4 text-aurora-amber shrink-0" />}
                <h3 className="text-lg font-semibold text-text-primary truncate">{item.name}</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn("text-xs font-mono font-bold uppercase", cfg.text)}>{cfg.label}</span>
                <span className="text-xs text-text-disabled font-mono">{item.agent}</span>
                {item.durationMs > 0 && (
                  <span className="text-xs text-text-disabled font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.durationMs < 1000 ? `${item.durationMs}ms` : `${(item.durationMs / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-text-muted hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-5 shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                tab === t.id ? "border-aurora-teal text-aurora-teal" : "border-transparent text-text-muted hover:text-text-primary"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5">
          {tab === 'output' && isApproval && (
            <div>
              {item.summary && <p className="text-xs text-text-body mb-4 leading-relaxed">{item.summary}</p>}
              <div className={cn(
                "p-4 rounded-lg text-sm font-mono leading-relaxed whitespace-pre-wrap border",
                item.outputType === 'error'
                  ? "bg-aurora-rose/5 border-aurora-rose/20 text-aurora-rose/90"
                  : item.outputType === 'code'
                    ? "bg-black/40 border-white/5 text-text-primary"
                    : "bg-white/[0.02] border-white/5 text-text-body"
              )}>
                {item.payload}
              </div>
            </div>
          )}

          {tab === 'timeline' && (
            <div className="space-y-0">
              {SAMPLE_TIMELINE.map((log, i) => {
                const dotColors = { OK: 'bg-aurora-teal', ERR: 'bg-aurora-rose', NET: 'bg-aurora-blue', SYS: 'bg-white/40' };
                return (
                  <div key={log.id} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={cn("w-2 h-2 rounded-full", dotColors[log.type] || 'bg-white/40')} />
                      {i < SAMPLE_TIMELINE.length - 1 && <div className="w-px flex-1 bg-white/[0.06] mt-1" />}
                    </div>
                    <div className="min-w-0 -mt-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono text-text-disabled">{log.time}</span>
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

          {tab === 'notes' && (
            <div className="space-y-3">
              {SAMPLE_TASK_NOTES.map(note => (
                <div key={note.id} className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn(
                      "text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded",
                      note.author === 'Tony' ? "bg-aurora-amber/10 text-aurora-amber" :
                      note.author === 'Elon' ? "bg-aurora-violet/10 text-aurora-violet" :
                      "bg-aurora-teal/10 text-aurora-teal"
                    )}>{note.author}</span>
                    <span className="text-[10px] font-mono text-text-disabled">{note.time}</span>
                  </div>
                  <p className="text-[12px] text-text-body leading-relaxed">{note.text}</p>
                </div>
              ))}
              <textarea
                placeholder="Add a note..."
                rows={2}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-xs font-mono text-text-primary resize-none focus:border-aurora-teal/40 outline-none transition-colors placeholder:text-text-disabled mt-2"
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-border p-4 bg-canvas/30">
          {isApproval ? (
            <AnimatePresence mode="wait">
              {!showReject ? (
                <motion.div key="approval-btns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2">
                  <button
                    onClick={() => setShowReject(true)}
                    className="flex-1 h-11 flex items-center justify-center gap-2 border border-aurora-rose/30 bg-aurora-rose/5 text-aurora-rose hover:bg-aurora-rose/10 rounded-xl font-bold tracking-wider uppercase text-[11px] transition-all"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button className="flex-[2] h-11 flex items-center justify-center gap-2 bg-aurora-teal text-black hover:bg-[#00ebd8] rounded-xl font-bold tracking-wider uppercase text-[11px] transition-all shadow-[0_0_20px_rgba(0,217,200,0.3)]">
                    <CheckCircle2 className="w-4 h-4" /> Approve
                  </button>
                </motion.div>
              ) : (
                <motion.div key="reject-form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2">
                  <input
                    autoFocus
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="Feedback for revision..."
                    className="flex-1 h-11 bg-[#121212] border border-aurora-rose/40 rounded-xl px-4 text-sm font-mono text-text-primary focus:outline-none placeholder:text-text-disabled"
                  />
                  <button onClick={() => setShowReject(false)} className="h-11 px-4 border border-white/10 hover:bg-white/5 rounded-xl text-text-muted text-[11px] font-semibold">Cancel</button>
                  <button className="h-11 px-5 bg-aurora-rose text-white hover:bg-[#fd3859] rounded-xl font-bold uppercase text-[11px] flex items-center gap-1.5 shadow-[0_0_15px_rgba(251,113,133,0.2)]">
                    <CornerDownLeft className="w-3.5 h-3.5" /> Send
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <div className="flex gap-2">
              {item.status === 'running' && (
                <button className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-rose bg-aurora-rose/5 border border-aurora-rose/20 rounded-lg hover:bg-aurora-rose/10 transition-colors">
                  <StopCircle className="w-3.5 h-3.5" /> Stop
                </button>
              )}
              <button className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-aurora-amber bg-aurora-amber/5 border border-aurora-amber/20 rounded-lg hover:bg-aurora-amber/10 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Rerun
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-text-muted bg-white/[0.03] border border-white/[0.07] rounded-lg hover:bg-white/[0.06] transition-colors ml-auto">
                <Copy className="w-3.5 h-3.5" /> Copy Summary
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN MOCKUP VIEW
// ═══════════════════════════════════════════════════════════════

export function MissionControlMockup() {
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [scratchpad, setScratchpad] = useState('');

  const filtered = filter === 'all' ? SAMPLE_ITEMS
    : filter === 'tasks' ? SAMPLE_ITEMS.filter(i => i.kind === 'task')
    : SAMPLE_ITEMS.filter(i => i.kind === 'approval');

  const selected = SAMPLE_ITEMS.find(i => i.id === selectedId);

  const approvalCount = SAMPLE_ITEMS.filter(i => i.kind === 'approval').length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="shrink-0 mb-5">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-aurora-teal" />
              <h2 className="text-2xl font-bold text-text-primary tracking-tight">Mission Control</h2>
            </div>
            <p className="text-sm text-text-muted mt-1 ml-9">Live tasks, approvals, priorities, and notes — one view.</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Time range */}
            <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-border">
              {['1h', '24h', '7d'].map(r => (
                <button key={r} className="px-3 py-1 text-[11px] font-mono font-medium rounded-md text-text-muted hover:text-text-primary hover:bg-white/[0.04] transition-colors">
                  {r}
                </button>
              ))}
            </div>
            {/* Filter pills */}
            <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-border">
              {[
                { id: 'all', label: 'All' },
                { id: 'tasks', label: 'Tasks' },
                { id: 'approvals', label: `Approvals`, badge: approvalCount },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "px-3 py-1 text-[11px] font-mono font-medium rounded-md transition-colors flex items-center gap-1.5",
                    filter === f.id
                      ? "bg-aurora-teal/10 text-aurora-teal"
                      : "text-text-muted hover:text-text-primary hover:bg-white/[0.04]"
                  )}
                >
                  {f.label}
                  {f.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-aurora-amber/10 text-aurora-amber">
                      {f.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main: 2/3 rail + 1/3 priorities ───────────────────── */}
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">

        {/* Left: Unified Rail */}
        <div className="flex-[2] flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
            {filtered.map(item => (
              <RailRow
                key={item.id}
                item={item}
                isSelected={item.id === selectedId}
                onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
              />
            ))}
          </div>

          {/* Scratchpad */}
          <div className="shrink-0 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-text-disabled" />
              <span className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold">Scratchpad</span>
            </div>
            <textarea
              value={scratchpad}
              onChange={e => setScratchpad(e.target.value)}
              placeholder="Quick thoughts..."
              rows={2}
              className="w-full bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2 text-[11px] font-mono text-text-primary resize-none focus:border-aurora-teal/30 outline-none transition-colors placeholder:text-text-disabled"
            />
          </div>
        </div>

        {/* Right: Priorities + Notes */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto no-scrollbar">
          {/* Priorities */}
          <div className="mb-4">
            <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-3 flex items-center gap-2">
              <Zap className="w-3 h-3 text-aurora-violet" /> Founder Priorities
            </div>
            <div className="space-y-2.5">
              {SAMPLE_PRIORITIES.map(p => {
                const ps = priorityStyles[p.priority] || priorityStyles.normal;
                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-lg border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:-translate-y-[1px] transition-all cursor-pointer bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.015)_1px,transparent_0)] bg-[length:14px_14px]"
                  >
                    <h4 className="text-[12px] font-semibold text-text-primary mb-1.5">{p.title}</h4>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase", ps.bg, ps.text)}>{ps.label}</span>
                      <span className="text-[9px] font-mono text-text-disabled flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {p.due}</span>
                      <span className="text-[9px] font-mono text-text-disabled">{p.owner}</span>
                    </div>
                    <p className="text-[10px] text-text-muted leading-relaxed">{p.description}</p>
                    {p.progress > 0 && (
                      <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden mt-2">
                        <div className="h-full rounded-full bg-aurora-violet/60" style={{ width: `${p.progress}%` }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Founder Notes */}
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-3 flex items-center gap-2">
              <MessageSquare className="w-3 h-3 text-aurora-violet" /> Founder Notes
            </div>
            <div className="space-y-2">
              {SAMPLE_NOTES.map(n => (
                <div key={n.id} className="p-3 bg-white/[0.015] rounded-lg border border-white/[0.04]">
                  <span className="text-[10px] font-mono text-text-disabled block mb-1">{n.time}</span>
                  <p className="text-[11px] text-text-body leading-relaxed">{n.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <DrawerContent
            item={selected}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
