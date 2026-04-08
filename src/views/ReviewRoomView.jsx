import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, AlertTriangle, Code2, FileText, MessageSquare, Database,
  CheckCircle2, XCircle, CornerDownLeft, Clock, BellRing, Archive,
  RotateCcw, Filter,
} from 'lucide-react';
import { cn } from '../utils/cn';
import {
  fetchPendingReviews, fetchCompletedOutputs, fetchRevisions,
  approveReview, rejectReview, subscribeToPendingReviews,
} from '../lib/api';
import { useSystemState } from '../context/SystemStateContext';

// ── Style maps ──────────────────────────────────────────────────
const urgencyStyles = {
  critical: { bg: 'bg-aurora-rose/15', text: 'text-aurora-rose', border: 'border-aurora-rose/30', label: 'Critical', order: 0 },
  high:     { bg: 'bg-aurora-amber/15', text: 'text-aurora-amber', border: 'border-aurora-amber/30', label: 'High', order: 1 },
  normal:   { bg: 'bg-aurora-teal/15', text: 'text-aurora-teal', border: 'border-aurora-teal/30', label: 'Normal', order: 2 },
};

const typeIcons = {
  code:    Code2,
  report:  FileText,
  error:   AlertTriangle,
  message: MessageSquare,
  data:    Database,
};

// ── Helpers ──────────────────────────────────────────────────────
function formatWaiting(ms) {
  if (ms < 60000) return 'Just now';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m waiting`;
  return `${Math.floor(mins / 60)}h waiting`;
}

function OutputRenderer({ item }) {
  if (!item) return null;
  const isError = item.outputType === 'error';
  const isCode  = item.outputType === 'code' || item.outputType === 'data';

  return (
    <div className={cn(
      "p-5 rounded-lg text-sm font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto border",
      isError  ? "bg-aurora-rose/5 border-aurora-rose/20 text-aurora-rose/90"
      : isCode ? "bg-black/40 border-white/5 text-text-primary shadow-inner"
               : "bg-white/[0.02] border-white/5 text-text-body"
    )}>
      {item.payload}
    </div>
  );
}

// ── Queue card ───────────────────────────────────────────────────
function QueueCard({ item, isActive, onClick }) {
  const Icon = typeIcons[item.outputType] || FileText;
  const urg  = item.urgency ? urgencyStyles[item.urgency] : null;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className={cn(
        "spatial-panel p-4 flex flex-col gap-2 text-left transition-all border w-full",
        isActive
          ? "border-aurora-teal/40 bg-aurora-teal/5 shadow-[0_0_15px_rgba(0,217,200,0.1)]"
          : "border-white/5 opacity-70 hover:opacity-100 hover:border-white/15"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span className="text-sm font-semibold text-text-primary truncate">{item.title}</span>
        </div>
        {urg && (
          <span className={cn("shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase", urg.bg, urg.text)}>
            {urg.label}
          </span>
        )}
      </div>
      <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">{item.summary}</p>
      <div className="flex justify-between items-center mt-1">
        <span className="text-[10px] font-mono text-aurora-violet font-bold">{item.agentName}</span>
        <span className="text-[10px] font-mono text-text-disabled">
          {item.waitingMs ? formatWaiting(item.waitingMs) : item.completedAt}
        </span>
      </div>
    </motion.button>
  );
}

// ── Filter pill strip ────────────────────────────────────────────
function FilterPills({ label, options, active, onChange }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] font-mono text-text-disabled uppercase tracking-widest mr-1">{label}</span>
      <div className="flex items-center gap-1 bg-black/40 rounded-md p-0.5 border border-border">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-2 py-0.5 text-[10px] font-mono rounded transition-colors",
              active === opt.value
                ? "bg-white/[0.08] text-text-primary"
                : "text-text-muted hover:text-text-primary hover:bg-white/[0.04]"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main view ────────────────────────────────────────────────────
export function ReviewRoomView() {
  const { setPendingCount } = useSystemState();

  const [activeTab, setActiveTab]           = useState('approvals');
  const [selectedId, setSelectedId]         = useState(null);
  const [feedback, setFeedback]             = useState('');
  const [showReviseForm, setShowReviseForm] = useState(false);
  const [approvals, setApprovals]           = useState([]);
  const [outputs, setOutputs]               = useState([]);
  const [revisions, setRevisions]           = useState([]);
  const [loaded, setLoaded]                 = useState(false);
  const [actionError, setActionError]       = useState(null); // inline error for approve/reject failures

  // ── Full reload helper (used on mount + realtime events) ──────
  const reload = useCallback(async () => {
    const [reviews, completed, revs] = await Promise.all([
      fetchPendingReviews(),
      fetchCompletedOutputs(),
      fetchRevisions(),
    ]);
    setApprovals(reviews);
    setOutputs(completed);
    setRevisions(revs);
    return reviews;
  }, []);

  // Seed from api.js on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const reviews = await reload();
      if (!cancelled) {
        setSelectedId(reviews[0]?.id ?? null);
        setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [reload]);

  // ── Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToPendingReviews(() => {
      // Any insert/update/delete on pending_reviews → full re-sort
      reload();
    });
    return unsub;
  }, [reload]);

  // Filters
  const [urgencyFilter, setUrgencyFilter]   = useState('all');
  const [typeFilter, setTypeFilter]         = useState('all');

  // Keep NavRail badge in sync whenever approvals list changes
  useEffect(() => {
    setPendingCount(approvals.length);
  }, [approvals.length, setPendingCount]);

  // Derived list for current tab (filtered + sorted)
  const currentItems = useMemo(() => {
    let list = activeTab === 'approvals' ? approvals
             : activeTab === 'outputs'   ? outputs
             :                             revisions;

    if (urgencyFilter !== 'all') {
      list = list.filter(i => i.urgency === urgencyFilter);
    }
    if (typeFilter !== 'all') {
      list = list.filter(i => i.outputType === typeFilter);
    }
    // Sort approvals by urgency priority (critical → high → normal)
    if (activeTab === 'approvals') {
      list = [...list].sort((a, b) => {
        const ao = urgencyStyles[a.urgency]?.order ?? 99;
        const bo = urgencyStyles[b.urgency]?.order ?? 99;
        return ao - bo;
      });
    }
    return list;
  }, [activeTab, approvals, outputs, revisions, urgencyFilter, typeFilter]);

  const selected   = currentItems.find(i => i.id === selectedId) || currentItems[0] || null;
  const TypeIcon   = selected ? (typeIcons[selected.outputType] || FileText) : FileText;
  const urgency    = selected?.urgency ? urgencyStyles[selected.urgency] : null;

  // Auto-select first item when tab or filters change
  useEffect(() => {
    if (!currentItems.find(i => i.id === selectedId)) {
      setSelectedId(currentItems[0]?.id ?? null);
    }
  }, [currentItems, selectedId]);

  // ── Actions ───────────────────────────────────────────────────
  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    setShowReviseForm(false);
    setFeedback('');
  }, []);

  const handleApprove = useCallback(async () => {
    if (!selected) return;
    setActionError(null);

    // Optimistic: move to outputs immediately
    const snapshot = approvals;
    setOutputs(prev => [{ ...selected, completedAt: new Date().toLocaleTimeString(), urgency: undefined, waitingMs: undefined, status: 'approved' }, ...prev]);
    setApprovals(prev => prev.filter(i => i.id !== selected.id));
    setShowReviseForm(false);
    setFeedback('');

    try {
      await approveReview(selected.id);
    } catch (err) {
      // Rollback optimistic update
      setApprovals(snapshot);
      setOutputs(prev => prev.filter(i => i.id !== selected.id));
      setActionError(`Approve failed: ${err.message}`);
    }
  }, [selected, approvals]);

  const handleReject = useCallback(async () => {
    if (!selected || !feedback.trim()) return;
    setActionError(null);

    const fb = feedback.trim();
    const snapshot = approvals;
    setRevisions(prev => [{
      ...selected,
      feedback: fb,
      rejectedAt: new Date().toLocaleTimeString(),
      status: 'revision_requested',
    }, ...prev]);
    setApprovals(prev => prev.filter(i => i.id !== selected.id));
    setFeedback('');
    setShowReviseForm(false);
    if (activeTab !== 'approvals') setActiveTab('approvals');

    try {
      await rejectReview(selected.id, fb);
    } catch (err) {
      // Rollback
      setApprovals(snapshot);
      setRevisions(prev => prev.filter(i => i.id !== selected.id));
      setActionError(`Reject failed: ${err.message}`);
    }
  }, [selected, feedback, activeTab, approvals]);

  const dismissError = useCallback(() => setActionError(null), []);

  // ── Keyboard shortcuts ────────────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // never fire while typing

      if (activeTab !== 'approvals') return;

      if (e.key === 'Enter' && !showReviseForm && selected) {
        e.preventDefault();
        handleApprove();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showReviseForm) { setShowReviseForm(false); setFeedback(''); }
      }
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && currentItems.length > 1) {
        e.preventDefault();
        const idx = currentItems.findIndex(i => i.id === selectedId);
        const next = e.key === 'ArrowDown'
          ? Math.min(idx + 1, currentItems.length - 1)
          : Math.max(idx - 1, 0);
        setSelectedId(currentItems[next].id);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeTab, showReviseForm, selected, selectedId, currentItems, handleApprove]);

  // ── Tab config ────────────────────────────────────────────────
  const tabs = [
    { id: 'approvals', label: 'Approvals', icon: ShieldCheck, count: approvals.length, urgent: approvals.some(a => a.urgency === 'critical') },
    { id: 'outputs',   label: 'Outputs',   icon: Archive,     count: outputs.length },
    { id: 'revisions', label: 'Revisions', icon: RotateCcw,   count: revisions.length },
  ];

  const urgencyOptions = [
    { value: 'all',      label: 'All' },
    { value: 'critical', label: 'Critical' },
    { value: 'high',     label: 'High' },
    { value: 'normal',   label: 'Normal' },
  ];
  const typeOptions = [
    { value: 'all',     label: 'All' },
    { value: 'code',    label: 'Code' },
    { value: 'report',  label: 'Report' },
    { value: 'error',   label: 'Error' },
    { value: 'message', label: 'Msg' },
    { value: 'data',    label: 'Data' },
  ];

  // ── Render ────────────────────────────────────────────────────
  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-aurora-teal/30 border-t-aurora-teal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden pb-12">
      {/* Header */}
      <div className="mb-5 flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-1">Review Room</h2>
          <p className="text-sm text-text-muted">Review agent outputs and approve pending actions before they go live.</p>
        </div>
        <div className="flex items-center gap-3">
          {approvals.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 spatial-panel border border-aurora-amber/30">
              <BellRing className="w-4 h-4 text-aurora-amber animate-pulse" />
              <span className="text-sm font-mono text-text-primary">{approvals.length} Pending</span>
            </div>
          )}
          {/* Keyboard hint */}
          {activeTab === 'approvals' && approvals.length > 0 && (
            <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono text-text-disabled">
              <kbd className="px-1 py-0.5 bg-white/5 border border-border rounded text-[9px]">↑↓</kbd> navigate
              <kbd className="px-1.5 py-0.5 bg-white/5 border border-border rounded text-[9px]">↵</kbd> approve
              <kbd className="px-1 py-0.5 bg-white/5 border border-border rounded text-[9px]">Esc</kbd> cancel
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setUrgencyFilter('all');
              setTypeFilter('all');
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-white/[0.08] text-text-primary border border-white/10"
                : "text-text-muted hover:text-text-primary hover:bg-white/[0.03]"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span className={cn(
              "ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold",
              tab.urgent && activeTab !== tab.id
                ? "bg-aurora-rose/20 text-aurora-rose"
                : activeTab === tab.id
                  ? "bg-white/10 text-text-primary"
                  : "bg-white/5 text-text-disabled"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filter strip — only show for approvals with items */}
      <AnimatePresence>
        {activeTab === 'approvals' && approvals.length > 0 && (
          <motion.div
            key="filters"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-4 mb-4 shrink-0 overflow-hidden"
          >
            <Filter className="w-3 h-3 text-text-disabled shrink-0" />
            <FilterPills
              label="Urgency"
              options={urgencyOptions}
              active={urgencyFilter}
              onChange={setUrgencyFilter}
            />
            <FilterPills
              label="Type"
              options={typeOptions}
              active={typeFilter}
              onChange={setTypeFilter}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content — queue + inspector */}
      <div className="flex-1 flex gap-5 overflow-hidden">
        {/* Left: Queue */}
        <div className="w-80 flex flex-col gap-2 overflow-y-auto no-scrollbar pr-1 shrink-0">
          <AnimatePresence mode="popLayout">
            {currentItems.map(item => (
              <QueueCard
                key={item.id}
                item={item}
                isActive={selected?.id === item.id}
                onClick={() => handleSelect(item.id)}
              />
            ))}
          </AnimatePresence>

          {currentItems.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-text-disabled text-sm pt-16">
              <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
              <span>
                {activeTab === 'approvals' && (urgencyFilter !== 'all' || typeFilter !== 'all')
                  ? 'No items match filters'
                  : activeTab === 'approvals'
                    ? 'All clear'
                    : activeTab === 'outputs'
                      ? 'No outputs yet'
                      : 'No revisions sent'}
              </span>
              {(urgencyFilter !== 'all' || typeFilter !== 'all') && (
                <button
                  onClick={() => { setUrgencyFilter('all'); setTypeFilter('all'); }}
                  className="mt-2 text-xs text-aurora-teal underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Inspector */}
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center spatial-panel bg-[#09090b] text-text-disabled">
            <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
            <span className="text-sm">Nothing selected</span>
            <span className="text-xs mt-1 opacity-50">
              {activeTab === 'approvals' ? 'All approvals handled'
               : activeTab === 'outputs' ? 'No outputs yet'
               : 'No revisions sent'}
            </span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-0 spatial-panel overflow-hidden border-border/50 shadow-lg relative bg-[#09090b]">
            {/* Header bar */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-white/[0.03] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <TypeIcon className={cn("w-5 h-5 shrink-0", urgency ? urgency.text : "text-aurora-teal")} />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-text-primary truncate">{selected.title}</h3>
                  <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
                    {selected.outputType} — {selected.agentName}
                    {selected.waitingMs && (
                      <span className="ml-2 text-aurora-amber">
                        <Clock className="w-2.5 h-2.5 inline -mt-0.5" /> {formatWaiting(selected.waitingMs)}
                      </span>
                    )}
                    {selected.rejectedAt && (
                      <span className="ml-2 text-aurora-amber">
                        <RotateCcw className="w-2.5 h-2.5 inline -mt-0.5" /> Sent for revision at {selected.rejectedAt}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {urgency && (
                  <span className={cn("text-xs font-mono px-2 py-1 rounded", urgency.bg, urgency.text)}>
                    {urgency.label}
                  </span>
                )}
                {selected.status === 'revision_requested' && (
                  <span className="text-xs font-mono px-2 py-1 rounded bg-aurora-amber/10 text-aurora-amber">
                    Revision Requested
                  </span>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="px-6 py-3 border-b border-white/5 bg-white/[0.015]">
              <p className="text-xs text-text-body leading-relaxed">{selected.summary}</p>
            </div>

            {/* Revision feedback banner (Revisions tab) */}
            {activeTab === 'revisions' && selected.feedback && (
              <div className="px-6 py-3 border-b border-aurora-amber/20 bg-aurora-amber/5 shrink-0">
                <p className="text-[10px] font-mono text-aurora-amber uppercase tracking-widest mb-1">Revision Instructions Sent</p>
                <p className="text-xs text-text-body leading-relaxed font-mono">"{selected.feedback}"</p>
              </div>
            )}

            {/* Output content */}
            <div className="flex-1 overflow-auto p-6">
              <OutputRenderer item={selected} />
            </div>

            {/* Error banner */}
            {actionError && (
              <div className="shrink-0 px-5 py-2.5 bg-aurora-rose/5 border-t border-aurora-rose/10 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-aurora-rose shrink-0" />
                  <span className="text-[11px] text-aurora-rose font-medium truncate">{actionError}</span>
                </div>
                <button
                  onClick={dismissError}
                  className="px-2 py-1 text-[10px] text-aurora-rose font-bold hover:bg-aurora-rose/10 rounded transition-colors shrink-0 ml-2"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Action bar — approvals only */}
            {activeTab === 'approvals' && (
              <div className="shrink-0 bg-black/60 border-t border-white/10 p-5 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                <AnimatePresence mode="wait">
                  {!showReviseForm ? (
                    <motion.div
                      key="buttons"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex gap-3"
                    >
                      <button
                        onClick={() => setShowReviseForm(true)}
                        className="flex-1 h-12 flex items-center justify-center gap-2 border border-aurora-amber/40 bg-aurora-amber/5 text-aurora-amber hover:bg-aurora-amber/10 hover:border-aurora-amber rounded-xl font-bold tracking-wider uppercase text-sm transition-all"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={handleApprove}
                        className="flex-[2] h-12 flex items-center justify-center gap-2 bg-aurora-teal text-black hover:bg-[#00ebd8] rounded-xl font-bold tracking-wider uppercase text-sm transition-all shadow-[0_0_20px_rgba(0,217,200,0.4)] hover:shadow-[0_0_30px_rgba(0,217,200,0.6)]"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve <kbd className="ml-1 px-1 py-0.5 bg-black/20 rounded text-[10px] font-mono normal-case tracking-normal">↵</kbd>
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex flex-col gap-3"
                    >
                      <p className="text-xs text-text-muted">
                        Provide revision instructions — the agent will receive this feedback and the item will move to the <span className="text-aurora-amber font-mono">Revisions</span> tab.
                      </p>
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={feedback}
                          onChange={e => setFeedback(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && feedback.trim()) handleReject(); }}
                          placeholder="e.g. 'Reduce batch size', 'Extract styles to variables'..."
                          className="flex-1 h-12 bg-[#121212] border border-aurora-amber/50 rounded-xl px-4 text-sm font-mono text-text-primary focus:outline-none focus:shadow-[0_0_20px_rgba(251,191,36,0.15)] transition-all placeholder:text-text-disabled"
                        />
                        <button
                          onClick={() => { setShowReviseForm(false); setFeedback(''); }}
                          className="h-12 px-5 border border-white/10 hover:bg-white/5 rounded-xl text-text-muted font-semibold transition-all text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleReject}
                          disabled={!feedback.trim()}
                          className="h-12 px-6 bg-aurora-amber text-black hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold tracking-wider uppercase flex items-center gap-2 transition-all text-sm shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                        >
                          <CornerDownLeft className="w-4 h-4" /> Send
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
